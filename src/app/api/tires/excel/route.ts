import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ExcelService } from '@/lib/excel-service'

// GET /api/tires/excel - Export tires to Excel
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    const tires = await db.tire.findMany({
      orderBy: { createdAt: 'desc' }
    })

    const excelBuffer = await ExcelService.exportTiresToExcel(tires)

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="tires-${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    })
  } catch (error) {
    console.error('Error exporting tires to Excel:', error)
    return NextResponse.json(
      { error: 'Failed to export tires' },
      { status: 500 }
    )
  }
}

// POST /api/tires/excel - Import tires from Excel
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

    const buffer = Buffer.from(await file.arrayBuffer())
    const tiresData = await ExcelService.importTiresFromExcel(buffer)

    // Create tires in database
    const createdTires = []
    for (const tireData of tiresData) {
      if (tireData.tireSize && tireData.manufacturer) {
        // Handle vehicle creation if needed
        if (tireData.plateNumber) {
          await db.vehicle.upsert({
            where: { plateNumber: tireData.plateNumber },
            create: {
              plateNumber: tireData.plateNumber,
              trailerNumber: tireData.trailerNumber,
              driverName: tireData.driverName
            },
            update: {
              trailerNumber: tireData.trailerNumber,
              driverName: tireData.driverName
            }
          })
        }

        const tire = await db.tire.create({
          data: {
            ...tireData,
            createdById: user.id
          }
        })
        createdTires.push(tire)
      }
    }

    return NextResponse.json({
      message: `Successfully imported ${createdTires.length} tires`,
      count: createdTires.length
    })
  } catch (error) {
    console.error('Error importing tires from Excel:', error)
    return NextResponse.json(
      { error: 'Failed to import tires' },
      { status: 500 }
    )
  }
}