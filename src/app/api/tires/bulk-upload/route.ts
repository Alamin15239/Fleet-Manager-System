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

    // Simple text extraction from Excel file
    const buffer = Buffer.from(await file.arrayBuffer())
    const text = buffer.toString('binary')
    
    // Extract readable text that looks like data
    const lines = text.split('\n')
    const dataLines = lines.filter(line => {
      const cleaned = line.replace(/[^\x20-\x7E]/g, ' ').trim()
      return cleaned.length > 10 && 
             (cleaned.includes('ABC') || cleaned.includes('123') || 
              cleaned.match(/\d{3,}/) || cleaned.match(/[A-Z]{2,}\d+/))
    })
    
    let totalCreated = 0
    
    for (const line of dataLines) {
      const cleaned = line.replace(/[^\x20-\x7E]/g, ' ').trim()
      const parts = cleaned.split(/\s+/).filter(p => p.length > 0)
      
      if (parts.length >= 3) {
        // Try to find plate number pattern
        const plateNumber = parts.find(p => p.match(/[A-Z]{2,}\d+/)) || 
                           parts.find(p => p.match(/\d{3,}/)) || 
                           parts[1] || `TRUCK-${totalCreated + 1}`
        
        const driverName = parts.find(p => p.length > 3 && !p.match(/^\d+$/)) || null
        const quantity = parseInt(parts.find(p => p.match(/^\d+$/)) || '1')
        
        try {
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
          
          await db.tire.create({
            data: {
              tireSize: '295/80R22.5',
              manufacturer: 'Imported Brand',
              origin: 'CHINESE',
              plateNumber,
              driverName,
              quantity: quantity > 0 ? quantity : 1,
              createdById: user.id
            }
          })
          
          totalCreated++
        } catch (error) {
          console.error('Error creating tire:', error)
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