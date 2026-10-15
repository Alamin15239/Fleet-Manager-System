import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRolePermissionManager } from '@/lib/permission-middleware'
import { logAuditEvent } from '@/lib/audit-logging'
import { logUserActivity } from '@/lib/activity-tracking'
import { ensureOneDriveChangeSubscription, getFleetRecordVersion, syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
import { captureOneDriveWorkbookChanges } from '@/lib/onedrive-excel-import'
import { applyWorkbookChange } from '@/lib/onedrive-excel-apply'

export const runtime = 'nodejs'

const resourceForEntity: Record<string, string> = {
  TRUCK: 'trucks', TRAILER: 'trailers', MAINTENANCE: 'maintenance', OIL_CHANGE: 'maintenance',
  TIRE: 'tire-management', JOBCARD: 'maintenance'
}

function getAction(change: { operation: string }) {
  return change.operation === 'CREATE' ? 'create' : 'update'
}

export async function GET(request: NextRequest) {
  try {
    const { permissionManager } = await getRolePermissionManager(request)
    if (!permissionManager.hasPermission('excel-imports', 'read')) {
      return NextResponse.json({ error: 'Your role cannot review workbook changes.' }, { status: 403 })
    }
    let watchError: string | null = null
    try {
      const subscription = await ensureOneDriveChangeSubscription()
      if (subscription.enabled) {
        const scan = await captureOneDriveWorkbookChanges()
        if (scan.baselineInitializationNeeded) watchError = 'Sync the workbook once to initialize safe Excel imports.'
      }
      else watchError = 'Connect OneDrive and create the live workbook to receive edits.'
    } catch (error) {
      watchError = error instanceof Error ? error.message : 'Could not scan the live workbook.'
    }
    const changes = await db.excelWorkbookChange.findMany({
      where: { status: { in: ['PENDING', 'CONFLICT', 'ERROR'] } },
      orderBy: { detectedAt: 'desc' },
      take: 300
    })
    const visible = changes.flatMap(change => {
      const resource = resourceForEntity[change.entityType]
      if (!resource) return []
      const canApply = permissionManager.hasPermission(resource, getAction(change))
      const canRead = permissionManager.hasPermission(resource, 'read')
      return canApply || canRead ? [{ ...change, canApply }] : []
    })
    return NextResponse.json({ changes: visible, total: visible.length, watchError })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Could not load workbook changes' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, permissionManager } = await getRolePermissionManager(request)
    const body = await request.json() as { id?: string; action?: string }
    if (body.action === 'scan') {
      if (!permissionManager.hasPermission('excel-imports', 'read')) {
        return NextResponse.json({ error: 'Your role cannot review workbook changes.' }, { status: 403 })
      }
      const subscription = await ensureOneDriveChangeSubscription()
      if (!subscription.enabled) return NextResponse.json({ error: 'Connect OneDrive and create the live workbook first.' }, { status: 409 })
      const result = await captureOneDriveWorkbookChanges()
      return NextResponse.json({ success: true, ...result })
    }
    if (!body.id) return NextResponse.json({ error: 'A workbook change ID is required.' }, { status: 400 })
    const change = await db.excelWorkbookChange.findUnique({ where: { id: body.id } })
    if (!change) return NextResponse.json({ error: 'Workbook change not found.' }, { status: 404 })

    if (body.action === 'dismiss') {
      if (user.role !== 'ADMIN') return NextResponse.json({ error: 'Only an administrator can dismiss a workbook change.' }, { status: 403 })
      await db.excelWorkbookChange.update({ where: { id: change.id }, data: { status: 'DISMISSED', error: null } })
      const remaining = await db.excelWorkbookChange.count({ where: { status: { in: ['PENDING', 'CONFLICT'] } } })
      const sync = remaining === 0 ? await syncOneDriveWorkbookAfterChange() : null
      return NextResponse.json({ success: true, status: 'DISMISSED', workbookSync: sync ? sync.success && !sync.queued : null })
    }

    if (change.status !== 'PENDING') return NextResponse.json({ error: 'This change is no longer pending. Refresh the list.' }, { status: 409 })
    const resource = resourceForEntity[change.entityType]
    if (!resource || !permissionManager.hasPermission(resource, getAction(change))) {
      return NextResponse.json({ error: 'Your role does not allow this change.' }, { status: 403 })
    }

    if (change.operation === 'UPDATE' && change.recordId && change.baseUpdatedAt) {
      const latestUpdatedAt = await getFleetRecordVersion(change.entityType, change.recordId, change.rowData)
      if (!latestUpdatedAt || latestUpdatedAt.getTime() !== change.baseUpdatedAt.getTime()) {
        await db.excelWorkbookChange.update({
          where: { id: change.id }, data: { status: 'CONFLICT', error: 'The app record changed after this workbook edit was detected. Review the latest app data before re-importing.' }
        })
        return NextResponse.json({ error: 'This record changed in the app after the workbook edit. It was marked for conflict review.' }, { status: 409 })
      }
    }

    let applied: { id: string } | null
    try {
      applied = await db.$transaction(async tx => {
        const claim = await tx.excelWorkbookChange.updateMany({
          where: { id: change.id, status: 'PENDING' },
          data: { status: 'APPLYING' }
        })
        if (claim.count !== 1) return null
        const record = await applyWorkbookChange(tx, change, user.id)
        await tx.excelWorkbookChange.update({ where: { id: change.id }, data: { status: 'APPLIED', appliedAt: new Date(), appliedById: user.id, error: null } })
        return { id: record.id }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not apply this workbook change.'
      await db.excelWorkbookChange.update({ where: { id: change.id }, data: { error: message.slice(0, 300) } })
      return NextResponse.json({ error: message }, { status: 400 })
    }
    if (!applied) return NextResponse.json({ error: 'This workbook change is already being handled or has been applied.' }, { status: 409 })

    const entityId = applied.id
    try {
      await logAuditEvent({
        action: change.operation === 'CREATE' ? 'CREATE' : 'UPDATE',
        entityType: change.entityType,
        entityId,
        userId: user.id,
        userName: user.name || undefined,
        userEmail: user.email,
        userRole: user.role,
        changes: change.changes,
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: request.headers.get('user-agent') || ''
      })
      await logUserActivity({
        userId: user.id, action: change.operation === 'CREATE' ? 'CREATE' : 'UPDATE',
        entityType: change.entityType, entityId, entityName: `Excel import from ${change.sheetName}`,
        ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: request.headers.get('user-agent') || '', metadata: { workbookChangeId: change.id }
      })
    } catch (error) {
      console.error('Workbook change was applied but audit logging failed:', error instanceof Error ? error.message : 'Unknown error')
    }
    const sync = await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({ success: true, status: 'APPLIED', workbookSync: sync.success && !sync.queued, pendingWorkbookChanges: sync.pendingWorkbookChanges || 0, workbookSyncError: sync.error || null })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Could not apply workbook change' }, { status })
  }
}
