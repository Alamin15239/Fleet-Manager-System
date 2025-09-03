import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    console.log('Profile picture upload started')
    
    const user = await requireAuth(request)
    console.log('User authenticated:', user?.id)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('profilePicture') as File
    
    console.log('File received:', file?.name, file?.size, file?.type)
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    try {
      // Convert file to base64
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
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
    const user = await requireAuth(request)
    
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
    console.error('Error removing profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to remove profile picture' },
      { status: 500 }
    )
  }
}