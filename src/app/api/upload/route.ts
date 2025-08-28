import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = requireAuth(request)
    
    const data = await request.formData()
    const file: File | null = data.get('file') as unknown as File
    const type = data.get('type') as string // 'truck' or 'maintenance'
    const entityId = data.get('entityId') as string

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    if (!type || !entityId) {
      return NextResponse.json(
        { error: 'Type and entity ID are required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed' },
        { status: 400 }
      )
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', type, entityId)
    await mkdir(uploadDir, { recursive: true })

    // Generate unique filename
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const fileExtension = file.name.split('.').pop()
    const fileName = `${timestamp}-${randomId}.${fileExtension}`
    const filePath = join(uploadDir, fileName)

    // Write file to disk
    await writeFile(filePath, buffer)

    // Return file info
    const fileInfo = {
      id: `${timestamp}-${randomId}`,
      name: file.name,
      originalName: file.name,
      size: file.size,
      type: file.type,
      url: `/uploads/${type}/${entityId}/${fileName}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: user.userId
    }

    return NextResponse.json(fileInfo)
  } catch (error) {
    console.error('Error uploading file:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json(
          { error: error.message },
          { status: 401 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    )
  }
}