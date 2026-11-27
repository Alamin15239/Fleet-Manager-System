import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { requireRolePermission } from '@/lib/permission-middleware'
import { deleteOrganizationObject, getOrganizationObject, putOrganizationObject } from '@/lib/object-storage'

export const runtime = 'nodejs'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])

function validImage(buffer: Buffer, type: string) {
  const starts = (bytes: number[]) => buffer.length >= bytes.length && buffer.subarray(0, bytes.length).equals(Buffer.from(bytes))
  if (type === 'image/jpeg') return starts([0xff, 0xd8, 0xff])
  if (type === 'image/png') return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (type === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  if (type === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  return false
}

async function saveProfileImage(request: NextRequest, fieldName: string) {
  const user = await requireRolePermission(request, 'profile', 'update')
  const form = await request.formData()
  const submitted = form.get(fieldName)
  if (!(submitted instanceof File) || submitted.size <= 0) return NextResponse.json({ error: 'No image uploaded' }, { status: 400 })
  const file = submitted
  if (!IMAGE_TYPES.has(file.type)) return NextResponse.json({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' }, { status: 415 })
  if (file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image must be 5 MB or smaller' }, { status: 413 })
  const body = Buffer.from(await file.arrayBuffer())
  if (!validImage(body, file.type)) return NextResponse.json({ error: 'Image content does not match its declared file type' }, { status: 415 })

  const previous = await db.user.findUnique({ where: { id: user.id }, select: { profileImage: true } })
  const stored = await putOrganizationObject({
    organizationId: user.organizationId || user.organizationSlug || 'primary',
    module: 'profile-images',
    entityId: user.id,
    fileName: file.name,
    contentType: file.type,
    body,
  })
  try {
    await db.user.update({ where: { id: user.id }, data: { profileImage: 's3://' + stored.key } })
  } catch (error) {
    await deleteOrganizationObject(stored.key).catch(cleanup => console.error('Untracked profile image cleanup failed:', cleanup))
    throw error
  }

  if (previous?.profileImage?.startsWith('s3://')) {
    await deleteOrganizationObject(previous.profileImage.slice(5)).catch(error => console.error('Previous profile image cleanup failed:', error))
  }
  return NextResponse.json({
    success: true,
    message: 'Profile picture updated successfully',
    url: '/api/profile/picture',
    user: { id: user.id, profileImage: '/api/profile/picture' },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export async function POST(request: NextRequest) {
  try {
    return await saveProfileImage(request, 'profilePicture')
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token', 'User not found or inactive'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Failed to upload profile picture' : 'Access denied' }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const record = await db.user.findUnique({ where: { id: user.id }, select: { profileImage: true } })
    const value = record?.profileImage || ''
    if (!value) return NextResponse.json({ error: 'Profile image not found' }, { status: 404 })
    if (value.startsWith('s3://')) {
      const object = await getOrganizationObject(value.slice(5))
      return new NextResponse(object.body, { headers: {
        'Content-Type': object.contentType, 'Content-Length': String(object.contentLength),
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      } })
    }
    const match = value.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/=]+)$/)
    if (!match) return NextResponse.json({ error: 'Profile image is unavailable' }, { status: 404 })
    const bytes = Buffer.from(match[2], 'base64')
    return new NextResponse(bytes, { headers: {
      'Content-Type': match[1], 'Content-Length': String(bytes.byteLength),
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : 500
    return NextResponse.json({ error: 'Could not retrieve profile image' }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'profile', 'update')
    const previous = await db.user.findUnique({ where: { id: user.id }, select: { profileImage: true } })
    await db.user.update({ where: { id: user.id }, data: { profileImage: null } })
    if (previous?.profileImage?.startsWith('s3://')) {
      await deleteOrganizationObject(previous.profileImage.slice(5)).catch(error => console.error('Profile image cleanup failed:', error))
    }
    return NextResponse.json({ message: 'Profile picture removed successfully', user: { id: user.id, profileImage: null } }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 500 ? 'Failed to remove profile picture' : 'Access denied' }, { status })
  }
}
