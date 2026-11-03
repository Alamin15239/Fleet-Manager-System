import { NextRequest, NextResponse } from 'next/server'
import { requireRolePermission } from '@/lib/permission-middleware'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('Profile picture upload started')
    
    let user
    try {
      user = await requireRolePermission(request, 'profile', 'update')
      console.log('User authenticated:', user?.id)
    } catch (authError) {
      console.error('Auth error:', authError)
      const message = authError instanceof Error ? authError.message : ''
      return NextResponse.json(
        { error: message === 'Insufficient permissions' ? 'You do not have permission to edit your profile' : 'Authentication failed' },
        { status: message === 'Insufficient permissions' ? 403 : 401 }
      )
    }
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let formData
    let file
    try {
      formData = await request.formData()
      file = formData.get('profilePicture') as File
      console.log('File received:', file?.name, file?.size, file?.type)
    } catch (formError) {
      console.error('Form data error:', formError)
      return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
    }
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Accept only raster image formats. SVG and other active content are not allowed.
    const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
    if (!(file instanceof File) || !allowedImageTypes.has(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, GIF, and WebP images are allowed' }, { status: 415 })
    }

    // Validate file size (5MB max) and reject empty uploads.
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be between 1 byte and 5MB' }, { status: 413 })
    }

    try {
      // Convert file to base64
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const startsWith = (signature: number[]) => buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(Buffer.from(signature))
      const validSignature =
        (file.type === 'image/jpeg' && startsWith([0xff, 0xd8, 0xff])) ||
        (file.type === 'image/png' && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
        (file.type === 'image/gif' && (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a')) ||
        (file.type === 'image/webp' && buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP')
      if (!validSignature) {
        return NextResponse.json({ error: 'Image content does not match the declared file type' }, { status: 415 })
      }
      const base64 = buffer.toString('base64')
      const dataUrl = `data:${file.type};base64,${base64}`

      console.log('File converted to base64, length:', dataUrl.length)

      // Update user profile picture in database
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: { profileImage: dataUrl },
        select: { id: true, name: true, email: true, profileImage: true, role: true }
      })
      
      return NextResponse.json({ 
        message: 'Profile picture updated successfully',
        user: updatedUser
      })
    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Database error occurred' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error uploading profile picture:', error)
    return NextResponse.json(
      { error: `Failed to upload profile picture: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'profile', 'update')
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Remove profile picture from database
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: { profileImage: null },
      select: { id: true, name: true, email: true, profileImage: true, role: true }
    })

    return NextResponse.json({ 
      message: 'Profile picture removed successfully',
      user: updatedUser
    })
  } catch (error) {
    if (error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'You do not have permission to edit your profile' }, { status: 403 })
    }
    console.error('Error removing profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to remove profile picture' },
      { status: 500 }
    )
  }
}
