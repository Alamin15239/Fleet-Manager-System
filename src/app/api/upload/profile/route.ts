import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'profile', 'update')
    
    // Get form data
    let data: FormData
    try {
      data = await request.formData()
    } catch (formError) {
      console.error('Failed to parse form data:', formError)
      return NextResponse.json(
        { error: 'Invalid form data' },
        { status: 400 }
      )
    }
    
    const submittedFile = data.get('file')
    const file: File | null = submittedFile instanceof File ? submittedFile : null

    if (!file || file.size <= 0) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (max 1MB for base64 storage)
    const maxSize = 1 * 1024 * 1024 // 1MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 1MB.' },
        { status: 400 }
      )
    }

    // Process file
    let bytes: ArrayBuffer
    try {
      bytes = await file.arrayBuffer()
    } catch (fileError) {
      console.error('Failed to read file:', fileError)
      return NextResponse.json(
        { error: 'Failed to process file' },
        { status: 400 }
      )
    }
    
    const buffer = Buffer.from(bytes)
    const startsWith = (signature: number[]) => buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(Buffer.from(signature))
    const validSignature =
      (file.type === 'image/jpeg' && startsWith([0xff, 0xd8, 0xff])) ||
      (file.type === 'image/jpg' && startsWith([0xff, 0xd8, 0xff])) ||
      (file.type === 'image/png' && startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
      (file.type === 'image/gif' && (buffer.subarray(0, 6).toString('ascii') === 'GIF87a' || buffer.subarray(0, 6).toString('ascii') === 'GIF89a')) ||
      (file.type === 'image/webp' && buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP')
    if (!validSignature) {
      return NextResponse.json({ error: 'Image content does not match the declared file type.' }, { status: 415 })
    }

    // Convert to base64 data URL
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    // Update profile image in database
    try {
      const updatedUser = await db.user.update({
        where: { id: user.id },
        data: { profileImage: dataUrl }
      })

      console.log(`Profile image updated for user ${user.id}`)

      return NextResponse.json({
        success: true,
        url: dataUrl,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          profileImage: updatedUser.profileImage,
          phone: updatedUser.phone,
          department: updatedUser.department,
          title: updatedUser.title,
          bio: updatedUser.bio,
          isActive: updatedUser.isActive,
          isApproved: updatedUser.isApproved,
          isEmailVerified: updatedUser.isEmailVerified
        },
        message: 'Profile image uploaded successfully'
      })

    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to save profile image to database' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Profile image upload error:', error)
    const message = error instanceof Error ? error.message : ''
    if (['No token provided', 'Invalid token', 'User not found or inactive'].includes(message)) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (message === 'Insufficient permissions') {
      return NextResponse.json({ error: 'You do not have permission to edit your profile' }, { status: 403 })
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to upload profile image', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
