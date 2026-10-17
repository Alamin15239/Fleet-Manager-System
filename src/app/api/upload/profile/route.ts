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
    
    const file: File | null = data.get('file') as unknown as File

    if (!file) {
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
