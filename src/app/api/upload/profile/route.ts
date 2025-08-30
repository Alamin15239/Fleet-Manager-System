import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import jwt from 'jsonwebtoken'

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
    // Verify JWT_SECRET exists
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is not configured')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    // Get user ID from token
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    let decoded: any
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError)
      if (jwtError instanceof jwt.JsonWebTokenError) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
      }
      if (jwtError instanceof jwt.TokenExpiredError) {
        return NextResponse.json({ error: 'Token expired' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Token verification failed' }, { status: 401 })
    }
    
    // Handle both possible JWT token structures
    const userId = decoded.userId || decoded.id
    if (!userId) {
      console.error('No user ID in token:', decoded)
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 })
    }
    
    console.log('User ID from token:', userId)
    
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
        where: { id: userId },
        data: { profileImage: dataUrl }
      })

      console.log(`Profile image updated for user ${userId}`)

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
    
    return NextResponse.json(
      { 
        error: 'Failed to upload profile image', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}