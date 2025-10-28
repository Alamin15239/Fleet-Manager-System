import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import path from 'path'
import fs from 'fs/promises'

// GET /api/tires/excel-file - Get the current Excel file
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    const excelPath = path.join(process.cwd(), 'public', 'excel', 'tires.xlsx')
    
    try {
      const fileBuffer = await fs.readFile(excelPath)
      
      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="tires-current.xlsx"`
        }
      })
    } catch (fileError) {
      return NextResponse.json(
        { error: 'Excel file not found. Add some tires first.' },
        { status: 404 }
      )
    }
  } catch (error) {
    console.error('Error accessing Excel file:', error)
    return NextResponse.json(
      { error: 'Failed to access Excel file' },
      { status: 500 }
    )
  }
}