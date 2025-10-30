import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
const XLSX = require('xlsx')

export async function POST(request: NextRequest) {
  try {
    console.log('Starting bulk upload...')
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

    console.log('File received:', file.name, file.size)
    const buffer = Buffer.from(await file.arrayBuffer())
    console.log('Buffer created, size:', buffer.length)
    
    let workbook
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' })
      console.log('Workbook loaded, sheets:', workbook.SheetNames)
    } catch (xlsxError) {
      console.error('XLSX read error:', xlsxError)
      return NextResponse.json(
        { error: 'Invalid Excel file format' },
        { status: 400 }
      )
    }
    
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

    console.log('Total records created:', totalCreated)
    return NextResponse.json({
      message: `Successfully imported ${totalCreated} tire records`,
      count: totalCreated
    })
  } catch (error) {
    console.error('Error in bulk upload:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process file'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}