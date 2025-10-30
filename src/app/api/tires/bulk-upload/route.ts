import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Skip auth for now to test
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Test database connection
    await db.$queryRaw`SELECT 1`
    
    // Create one test tire without user auth
    const plateNumber = `TEST-${Date.now()}`
    
    await db.vehicle.create({
      data: {
        plateNumber,
        driverName: 'Test Driver'
      }
    })
    
    await db.tire.create({
      data: {
        tireSize: '295/80R22.5',
        manufacturer: 'Test Brand',
        origin: 'CHINESE',
        plateNumber,
        driverName: 'Test Driver',
        quantity: 1,
        createdById: 'test-user-id'
      }
    })

    return NextResponse.json({
      message: `Successfully created test tire from ${file.name}`,
      count: 1
    })
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { error: `Error: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    )
  }
}