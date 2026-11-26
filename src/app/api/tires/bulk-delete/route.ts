import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permission-middleware'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
import { ensureTireLifecycleTables } from '@/lib/tire-lifecycle'

// DELETE /api/tires/bulk-delete
// Permanently removes tire inventory and tire-only history. Fleet and workshop
// records are intentionally left untouched.
export async function DELETE(request: NextRequest) {
  const authResult = await requirePermission(request, 'tire-management', 'delete')
  if (authResult instanceof NextResponse) return authResult

  try {
    const body = await request.json().catch(() => ({}))
    if (body?.confirmation !== 'DELETE ALL TIRES') {
      return NextResponse.json(
        { error: 'Explicit confirmation is required to delete all tire records.' },
        { status: 400 }
      )
    }

    const deletedCount = await db.$transaction(async tx => {
      await ensureTireLifecycleTables(tx)

      const tires = await tx.tire.findMany({ select: { id: true } })
      if (tires.length === 0) return 0

      const tireIds = tires.map(tire => tire.id)
      await tx.tireLifecycleEvent.deleteMany({ where: { tireId: { in: tireIds } } })
      await tx.tireUsagePeriod.deleteMany({ where: { tireId: { in: tireIds } } })
      const result = await tx.tire.deleteMany({ where: { id: { in: tireIds } } })
      return result.count
    }, { timeout: 120000 })

    await syncOneDriveWorkbookAfterChange()

    return NextResponse.json({
      message: `Permanently deleted ${deletedCount} tire record(s) and their linked tire history.`,
      deletedCount
    })
  } catch (error) {
    console.error('Error bulk deleting tire records:', error)
    return NextResponse.json(
      { error: 'Failed to permanently delete tire records.' },
      { status: 500 }
    )
  }
}
