import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    console.log('Bulk upload started')
    const user = await requireAuth(request)
    console.log('User authenticated:', user.id)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      console.log('No file provided')
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    console.log('File received:', file.name)

    // Test database connection
    await db.$queryRaw`SELECT 1`
    console.log('Database connected')

    // Create one test tire
    const plateNumber = `TEST-${Date.now()}`
    
    await db.vehicle.create({
      data: {
        plateNumber,
        driverName: 'Test Driver'
      }
    })
    console.log('Vehicle created')
    
    await db.tire.create({
      data: {
        tireSize: '295/80R22.5',
        manufacturer: 'Test Brand',
        origin: 'CHINESE',
        plateNumber,
        driverName: 'Test Driver',
        quantity: 1,
        createdById: user.id
      }
    })
    console.log('Tire created')

    return NextResponse.json({
      message: 'Successfully created 1 test tire record',
      count: 1
    })
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { error: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}