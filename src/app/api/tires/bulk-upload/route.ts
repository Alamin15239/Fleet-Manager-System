import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import * as XLSX from 'xlsx'

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
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    let totalCreated = 0
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet)
      
      // Determine origin from sheet name
      let origin = 'OTHER'
      if (sheetName.toLowerCase().includes('china')) {
        origin = 'CHINESE'
      } else if (sheetName.toLowerCase().includes('japan')) {
        origin = 'JAPANESE'
      }
      
      // Process each row
      for (const row of data as any[]) {
        try {
          // Extract data from row (flexible column names)
          const plateNumber = row['Truck #'] || row['Truck'] || row['Plate'] || ''
          const driverName = row['Name Driver'] || row['Driver'] || row['Name'] || ''
          const serialNumber = row['Serial Number'] || row['Serial'] || ''
          const quantity = parseInt(row['OUT QTY'] || row['QTY'] || row['Quantity'] || '1')
          const date = row['Date'] || new Date().toISOString()
          
          if (plateNumber && quantity > 0) {
            // Create vehicle if doesn't exist
            await db.vehicle.upsert({
              where: { plateNumber },
              create: {
                plateNumber,
                driverName: driverName || null
              },
              update: {
                driverName: driverName || null
              }
            })
            
            // Create tire record
            await db.tire.create({
              data: {
                tireSize: '295/80R22.5', // Default size
                manufacturer: origin === 'CHINESE' ? 'Chinese Brand' : 'Japanese Brand',
                origin,
                plateNumber,
                driverName: driverName || null,
                quantity,
                serialNumber: serialNumber || null,
                createdById: user.id,
                createdAt: new Date(date)
              }
            })
            
            totalCreated++
          }
        } catch (rowError) {
          console.error('Error processing row:', rowError)
          // Continue with next row
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