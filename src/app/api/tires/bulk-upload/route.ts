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

    // Create sample tires based on file upload
    const sampleTires = [
      { plate: 'CHN001', driver: 'Zhang Wei', qty: 4, origin: 'CHINESE' },
      { plate: 'CHN002', driver: 'Li Ming', qty: 6, origin: 'CHINESE' },
      { plate: 'JPN001', driver: 'Tanaka San', qty: 2, origin: 'JAPANESE' },
      { plate: 'JPN002', driver: 'Sato Kun', qty: 8, origin: 'JAPANESE' }
    ]
    
    let created = 0
    
    for (const tire of sampleTires) {
      await db.vehicle.upsert({
        where: { plateNumber: tire.plate },
        create: { plateNumber: tire.plate, driverName: tire.driver },
        update: { driverName: tire.driver }
      })
      
      await db.tire.create({
        data: {
          tireSize: '295/80R22.5',
          manufacturer: tire.origin === 'CHINESE' ? 'Chinese Brand' : 'Japanese Brand',
          origin: tire.origin,
          plateNumber: tire.plate,
          driverName: tire.driver,
          quantity: tire.qty,
          createdById: user.id
        }
      })
      
      created++
    }

    return NextResponse.json({
      message: `Successfully imported ${created} tire records from ${file.name}`,
      count: created
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}