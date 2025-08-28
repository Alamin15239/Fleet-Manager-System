import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    const data = await request.formData()
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

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename
    const fileExtension = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExtension}`
    
    // Save file to public/uploads/profiles directory
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'profiles')
    const filePath = join(uploadDir, fileName)

    // Ensure directory exists
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory already exists
    }

    await writeFile(filePath, buffer)

    // Return the URL path
    const imageUrl = `/uploads/profiles/${fileName}`

    return NextResponse.json({
      success: true,
      url: imageUrl,
      message: 'Profile image uploaded successfully'
    })

  } catch (error) {
    console.error('Profile image upload error:', error)
    
    if (error instanceof Error && error.message === 'No token provided') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to upload profile image' },
      { status: 500 }
    )
  }
}