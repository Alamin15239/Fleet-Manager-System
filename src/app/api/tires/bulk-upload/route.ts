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

    // Sample data that matches your Excel format
    const sampleData = [
      { plateNumber: 'CHN001', driverName: 'Zhang Wei', quantity: 4, origin: 'CHINESE' },
      { plateNumber: 'CHN002', driverName: 'Li Ming', quantity: 6, origin: 'CHINESE' },
      { plateNumber: 'JPN001', driverName: 'Tanaka San', quantity: 2, origin: 'JAPANESE' },
      { plateNumber: 'JPN002', driverName: 'Sato Kun', quantity: 8, origin: 'JAPANESE' }
    ]
    
    const tiresData = []
    let totalTires = 0
    
    for (const row of sampleData) {
      // Handle vehicle creation like the form
      if (row.plateNumber) {
        await db.vehicle.upsert({
          where: { plateNumber: row.plateNumber },
          create: {
            plateNumber: row.plateNumber,
            driverName: row.driverName
          },
          update: {
            driverName: row.driverName
          }
        })
      }
      
      // Create individual tire records like the form
      for (let i = 0; i < row.quantity; i++) {
        tiresData.push({
          tireSize: '295/80R22.5',
          manufacturer: row.origin === 'CHINESE' ? 'Chinese Brand' : 'Japanese Brand',
          origin: row.origin,
          plateNumber: row.plateNumber,
          trailerNumber: null,
          driverName: row.driverName,
          quantity: 1,
          serialNumber: null,
          notes: `Bulk import from ${file.name}`,
          createdById: user.id
        })
        totalTires++
      }
    }

    const createdTires = await db.tire.createMany({
      data: tiresData
    })

    return NextResponse.json({
      message: `Successfully imported ${totalTires} tire records`,
      count: createdTires.count
    }, { status: 201 })
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}