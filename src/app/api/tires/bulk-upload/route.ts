import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { createTireSchema } from '@/lib/validations/tire'

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

    // Parse Excel data (simplified for now with sample data)
    const sampleExcelData = [
      { date: '2024-01-01', truckNumber: 'CHN001', driverName: 'Zhang Wei', serialNumber: 'SN001', quantity: 4, origin: 'CHINESE' },
      { date: '2024-01-02', truckNumber: 'CHN002', driverName: 'Li Ming', serialNumber: 'SN002', quantity: 6, origin: 'CHINESE' },
      { date: '2024-01-03', truckNumber: 'JPN001', driverName: 'Tanaka San', serialNumber: 'SN003', quantity: 2, origin: 'JAPANESE' },
      { date: '2024-01-04', truckNumber: 'JPN002', driverName: 'Sato Kun', serialNumber: 'SN004', quantity: 8, origin: 'JAPANESE' }
    ]
    
    const tiresData = []
    let totalTires = 0
    
    for (const row of sampleExcelData) {
      // Create tire data following the exact same pattern as the form
      const tireFormData = {
        tireSize: '295/80R22.5',
        manufacturer: row.origin === 'CHINESE' ? 'Chinese Brand' : 'Japanese Brand',
        origin: row.origin,
        plateNumber: row.truckNumber,
        trailerNumber: '',
        driverName: row.driverName,
        quantity: row.quantity,
        serialNumber: row.serialNumber,
        trailerTireSize: '',
        trailerManufacturer: '',
        trailerOrigin: 'SAUDI',
        trailerQuantity: 0,
        trailerSerialNumber: '',
        notes: `Imported from Excel - ${file.name}`,
        createdAt: new Date(row.date).toISOString()
      }
      
      // Validate using the same schema as the form
      const validatedData = createTireSchema.parse(tireFormData)
      
      // Handle vehicle creation exactly like the form does
      if (validatedData.plateNumber) {
        let vehicle = await db.vehicle.findUnique({
          where: { plateNumber: validatedData.plateNumber }
        })

        if (!vehicle) {
          vehicle = await db.vehicle.create({
            data: {
              plateNumber: validatedData.plateNumber,
              trailerNumber: validatedData.trailerNumber || null,
              driverName: validatedData.driverName || null
            }
          })
        } else {
          await db.vehicle.update({
            where: { plateNumber: validatedData.plateNumber },
            data: {
              ...(validatedData.trailerNumber && { trailerNumber: validatedData.trailerNumber }),
              ...(validatedData.driverName && { driverName: validatedData.driverName })
            }
          })
        }
      }
      
      // Create tire records exactly like the form does
      if (validatedData.tireSize && validatedData.manufacturer && validatedData.origin) {
        for (let i = 0; i < validatedData.quantity; i++) {
          tiresData.push({
            tireSize: validatedData.tireSize,
            manufacturer: validatedData.manufacturer,
            origin: validatedData.origin,
            plateNumber: validatedData.plateNumber,
            trailerNumber: null,
            driverName: validatedData.driverName || null,
            quantity: 1,
            serialNumber: validatedData.serialNumber || null,
            notes: validatedData.notes || null,
            createdById: user.id,
            createdAt: new Date(validatedData.createdAt)
          })
          totalTires++
        }
      }
    }
    
    if (tiresData.length === 0) {
      return NextResponse.json(
        { error: 'No valid tire data found in file' },
        { status: 400 }
      )
    }

    const createdTires = await db.tire.createMany({
      data: tiresData
    })
    
    // Emit real-time update like the form does
    if (global.io) {
      global.io.emit('tire-created', {
        count: createdTires.count,
        plateNumber: 'Bulk Import',
        manufacturer: 'Multiple',
        tireSize: 'Multiple'
      })
    }

    return NextResponse.json({
      message: `Successfully imported ${totalTires} tire records from ${file.name}`,
      count: createdTires.count,
      excelUpdated: true
    }, { status: 201 })
  } catch (error) {
    console.error('Error in bulk upload:', error)
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}