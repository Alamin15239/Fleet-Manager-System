import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('profilePicture') as File
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

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
  } catch (error) {
    console.error('Error uploading profile picture:', error)
    return NextResponse.json(
      { error: 'Failed to upload profile picture' },
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