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

    // Simple CSV parsing instead of XLSX
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json(
        { error: 'File must have at least header and one data row' },
        { status: 400 }
      )
    }

    let totalCreated = 0
    
    // Skip header row, process data rows
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map(col => col.trim().replace(/"/g, ''))
      
      if (columns.length >= 3) {
        const plateNumber = columns[1] || `TRUCK-${i}`
        const driverName = columns[2] || null
        const quantity = parseInt(columns[4]) || 1
        
        try {
          // Create vehicle if doesn't exist
          await db.vehicle.upsert({
            where: { plateNumber },
            create: {
              plateNumber,
              driverName
            },
            update: {
              driverName
            }
          })
          
          // Create tire record
          await db.tire.create({
            data: {
              tireSize: '295/80R22.5',
              manufacturer: 'Imported Brand',
              origin: 'CHINESE',
              plateNumber,
              driverName,
              quantity,
              serialNumber: columns[3] || null,
              createdById: user.id
            }
          })
          
          totalCreated++
        } catch (error) {
          console.error('Error processing row:', error)
        }
      }
    }

    return NextResponse.json({
      message: `Successfully imported ${totalCreated} tire records`,
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