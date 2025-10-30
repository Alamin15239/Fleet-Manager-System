import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Create sample tire records for testing
    const sampleData = [
      { plateNumber: 'ABC123', driverName: 'John Doe', quantity: 4 },
      { plateNumber: 'XYZ789', driverName: 'Jane Smith', quantity: 6 },
      { plateNumber: 'DEF456', driverName: 'Mike Johnson', quantity: 2 }
    ]
    
    let totalCreated = 0
    
    for (const data of sampleData) {
      try {
        await db.vehicle.upsert({
          where: { plateNumber: data.plateNumber },
          create: {
            plateNumber: data.plateNumber,
            driverName: data.driverName
          },
          update: {
            driverName: data.driverName
          }
        })
        
        await db.tire.create({
          data: {
            tireSize: '295/80R22.5',
            manufacturer: 'Sample Brand',
            origin: 'CHINESE',
            plateNumber: data.plateNumber,
            driverName: data.driverName,
            quantity: data.quantity,
            createdById: user.id
          }
        })
        
        totalCreated++
      } catch (error) {
        console.error('Error creating tire:', error)
      }
    }

    return NextResponse.json({
      message: `Successfully imported ${totalCreated} sample tire records`,
      count: totalCreated
    })
  } catch (error) {
    console.error('Error in bulk upload:', error)
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}