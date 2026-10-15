import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { ExcelService } from '@/lib/excel-service'

// GET /api/tires/excel-file - Get current Excel export
export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'tire-management', 'read')
    
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

    return new NextResponse(new Uint8Array(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="tires-current.xlsx"`
      }
    })
  } catch (error) {
    console.error('Error creating Excel file:', error)
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json(
      { error: status === 403 ? 'Access denied' : status === 401 ? 'Authentication required' : 'Failed to create Excel file' },
      { status }
    )
  }
}
