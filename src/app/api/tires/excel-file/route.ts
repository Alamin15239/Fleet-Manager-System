import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { ExcelService } from '@/lib/excel-service'

// GET /api/tires/excel-file - Get current Excel export
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    
    const tires = await db.tire.findMany({
      orderBy: { createdAt: 'desc' }
    })

    if (tires.length === 0) {
      return NextResponse.json(
        { error: 'No tires found' },
        { status: 404 }
      )
    }

    const excelBuffer = await ExcelService.exportTiresToExcel(tires)

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="tires-current.xlsx"`
      }
    })
  } catch (error) {
    console.error('Error creating Excel file:', error)
    return NextResponse.json(
      { error: 'Failed to create Excel file' },
      { status: 500 }
    )
  }
}