import { NextRequest, NextResponse } from 'next/server'
import { Workbook } from 'exceljs'
import { db, findOrganizationById, getPrimaryOrganization, withOrganization } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { getRolePermissionManager } from '@/lib/permission-middleware'
import { logAuditEvent } from '@/lib/audit-logging'
import { logUserActivity } from '@/lib/activity-tracking'
import { createFleetWorkbook, ensureOneDriveChangeSubscription, getFleetRecordVersion, syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
import { captureOneDriveWorkbookChanges } from '@/lib/onedrive-excel-import'
import { applyWorkbookChange } from '@/lib/onedrive-excel-apply'

export const runtime = 'nodejs'

async function withRequestOrganization<T>(request: NextRequest, operation: () => Promise<T>) {
  const user = await requireAuth(request)
  const organization = user.organizationId
    ? await findOrganizationById(user.organizationId)
    : await getPrimaryOrganization()
  return withOrganization(organization, operation)
}

const resourceForEntity: Record<string, string> = {
  TRUCK: 'trucks', TRAILER: 'trailers', MAINTENANCE: 'maintenance', OIL_CHANGE: 'maintenance',
  TIRE: 'tire-management', JOBCARD: 'maintenance'
}

function getAction(change: { operation: string }) {
  return change.operation === 'CREATE' ? 'create' : 'update'
}

function canResolveUsingWorkbook(change: { status: string; operation: string; recordId: string | null; baseUpdatedAt: Date | null; error: string | null }) {
  return change.status === 'CONFLICT' && change.operation === 'UPDATE' && Boolean(change.recordId && change.baseUpdatedAt) && (
    change.error?.startsWith('The app and workbook changed these fields after the last sync:') === true ||
    change.error?.startsWith('The app record changed after this workbook edit was detected.') === true
  )
}

type ReviewContext = Awaited<ReturnType<typeof getRolePermissionManager>>
type WorkbookChangeRecord = NonNullable<Awaited<ReturnType<typeof db.excelWorkbookChange.findUnique>>>

function normalizeWorkbookValue(value: unknown): unknown {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value !== 'object') return value
  const cell = value as { text?: string; result?: unknown; richText?: { text: string }[]; formula?: string }
  if (Array.isArray(cell.richText)) return cell.richText.map(part => part.text).join('')
  if ('result' in cell) return normalizeWorkbookValue(cell.result)
  if (typeof cell.text === 'string') return cell.text
  if ('formula' in cell) return ''
  return JSON.stringify(value)
}

function findCurrentWorkbookRow(workbook: Workbook, sheetName: string, recordId: string | null) {
  if (!recordId) return null
  const sheet = workbook.getWorksheet(sheetName)
  if (!sheet) return null
  const rawHeaders = sheet.getRow(1).values as unknown[]
  const headers = Array.isArray(rawHeaders) ? rawHeaders.slice(1).map(value => String(normalizeWorkbookValue(value) || '').trim()) : []
  const idColumn = headers.indexOf('Record ID') + 1
  if (!idColumn) return null
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    if (String(normalizeWorkbookValue(sheet.getRow(rowNumber).getCell(idColumn).value) || '').trim() !== recordId) continue
    const data: Record<string, unknown> = {}
    headers.forEach((header, index) => {
      if (header && !['Record ID', 'Maintenance ID', 'Last Updated', 'App Baseline'].includes(header)) {
        data[header] = normalizeWorkbookValue(sheet.getRow(rowNumber).getCell(index + 1).value)
      }
    })
    return data
  }
  return null
}

async function applyPendingChange(change: WorkbookChangeRecord, context: ReviewContext, request: NextRequest, resolveConflict = false) {
  const { user, permissionManager } = context
  const canResolve = resolveConflict && canResolveUsingWorkbook(change)
  if (change.status !== 'PENDING' && !canResolve) return { status: 'SKIPPED' as const, message: 'This row is not eligible for this action.' }

  const resource = resourceForEntity[change.entityType]
  if (!resource || !permissionManager.hasPermission(resource, getAction(change))) {
    return { status: 'SKIPPED' as const, message: 'Your role cannot apply this row.' }
  }

  if (change.operation === 'UPDATE' && change.recordId && change.baseUpdatedAt) {
    const latestUpdatedAt = await getFleetRecordVersion(change.entityType, change.recordId, change.rowData)
    if (!latestUpdatedAt) {
      return { status: 'CONFLICT' as const, message: 'The app record no longer exists. This workbook row cannot safely update it.' }
    }
    if (latestUpdatedAt.getTime() !== change.baseUpdatedAt.getTime()) {
      const message = 'The app record changed after this workbook edit was detected. Review the latest app data before re-importing.'
      await db.excelWorkbookChange.update({
        where: { id: change.id }, data: { status: 'CONFLICT', error: message }
      })
      return { status: 'CONFLICT' as const, message }
    }
  }

  let applied: { id: string } | null
  try {
    applied = await db.$transaction(async tx => {
      const claim = await tx.excelWorkbookChange.updateMany({
        where: { id: change.id, status: change.status },
        data: { status: 'APPLYING' }
      })
      if (claim.count !== 1) return null
      const record = await applyWorkbookChange(tx, change, user.id)
      await tx.excelWorkbookChange.update({
        where: { id: change.id }, data: { status: 'APPLIED', appliedAt: new Date(), appliedById: user.id, error: null }
      })
      return { id: record.id }
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not apply this workbook change.'
    await db.excelWorkbookChange.update({ where: { id: change.id }, data: { error: message.slice(0, 300) } })
    return { status: 'FAILED' as const, message }
  }
  if (!applied) return { status: 'SKIPPED' as const, message: 'This row is already being handled or has been applied.' }

  try {
    await logAuditEvent({
      action: change.operation === 'CREATE' ? 'CREATE' : 'UPDATE',
      entityType: change.entityType,
      entityId: applied.id,
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
      entityType: change.entityType, entityId: applied.id, entityName: `Excel import from ${change.sheetName}`,
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: request.headers.get('user-agent') || '', metadata: { workbookChangeId: change.id }
    })
  } catch (error) {
    console.error('Workbook change was applied but audit logging failed:', error instanceof Error ? error.message : 'Unknown error')
  }
  return { status: 'APPLIED' as const, entityId: applied.id }
}

export async function GET(request: NextRequest) {
  try {
    return await withRequestOrganization(request, async () => {
    const { permissionManager } = await getRolePermissionManager(request)
    if (!permissionManager.hasPermission('excel-imports', 'read')) {
      return NextResponse.json({ error: 'Your role cannot review workbook changes.' }, { status: 403 })
    }
    let watchError: string | null = null
    try {
      const subscription = await ensureOneDriveChangeSubscription()
      if (subscription.enabled) {
        const scan = await captureOneDriveWorkbookChanges()
        if (scan.baselineInitializationNeeded && scan.queued === 0) watchError = 'No workbook changes are waiting for review. Use Sync Now to initialize safe Excel imports.'
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
    const currentWorkbook = new Workbook()
    if (changes.some(change => change.recordId && change.operation === 'UPDATE')) {
      const snapshot = await createFleetWorkbook()
      await currentWorkbook.xlsx.load(snapshot.bytes as any)
    }
    const visible = changes.flatMap(change => {
      const resource = resourceForEntity[change.entityType]
      if (!resource) return []
      const canApply = permissionManager.hasPermission(resource, getAction(change))
      const canRead = permissionManager.hasPermission(resource, 'read')
      return canApply || canRead ? [{
        ...change,
        currentAppData: findCurrentWorkbookRow(currentWorkbook, change.sheetName, change.recordId),
        canApply,
        canResolveWorkbookValue: canApply && canResolveUsingWorkbook(change)
      }] : []
    })
    return NextResponse.json({ changes: visible, total: visible.length, watchError })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Could not load workbook changes' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withRequestOrganization(request, async () => {
    const { user, permissionManager } = await getRolePermissionManager(request)
    const body = await request.json() as { id?: string; ids?: string[]; action?: string }
    if (body.action === 'scan') {
      if (!permissionManager.hasPermission('excel-imports', 'read')) {
        return NextResponse.json({ error: 'Your role cannot review workbook changes.' }, { status: 403 })
      }
      const subscription = await ensureOneDriveChangeSubscription()
      if (!subscription.enabled) return NextResponse.json({ error: 'Connect OneDrive and create the live workbook first.' }, { status: 409 })
      const result = await captureOneDriveWorkbookChanges()
      return NextResponse.json({ success: true, ...result })
    }
    if (body.action === 'apply-all' || body.action === 'resolve-conflicts') {
      if (!permissionManager.hasPermission('excel-imports', 'read')) {
        return NextResponse.json({ error: 'Your role cannot review workbook changes.' }, { status: 403 })
      }
      const resolveConflicts = body.action === 'resolve-conflicts'
      const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter(id => typeof id === 'string'))] : []
      if (!ids.length || ids.length > 20) {
        return NextResponse.json({ error: 'Choose between 1 and 20 pending rows for each batch.' }, { status: 400 })
      }

      let appliedCount = 0
      let failedCount = 0
      let conflictCount = 0
      let skippedCount = 0
      const results: { id: string; status: string; message?: string }[] = []
      for (const id of ids) {
        const change = await db.excelWorkbookChange.findUnique({ where: { id } })
        if (!change) {
          skippedCount++
          results.push({ id, status: 'SKIPPED', message: 'Row no longer exists.' })
          continue
        }
        const result = await applyPendingChange(change, { user, permissionManager }, request, resolveConflicts)
        results.push({ id, status: result.status, ...('message' in result ? { message: result.message } : {}) })
        if (result.status === 'APPLIED') appliedCount++
        else if (result.status === 'FAILED') failedCount++
        else if (result.status === 'CONFLICT') conflictCount++
        else skippedCount++
      }

      const remainingWorkbookChanges = await db.excelWorkbookChange.count({ where: { status: { in: ['PENDING', 'CONFLICT'] } } })
      const sync = remainingWorkbookChanges === 0 ? await syncOneDriveWorkbookAfterChange() : null
      return NextResponse.json({
        success: true, appliedCount, failedCount, conflictCount, skippedCount, results,
        remainingWorkbookChanges,
        workbookSync: sync ? sync.success && !sync.queued : null,
        workbookSyncError: sync?.error || null
      })
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

    const resolveConflict = body.action === 'resolve-workbook'
    if (resolveConflict && !canResolveUsingWorkbook(change)) {
      return NextResponse.json({ error: 'This conflict cannot safely be resolved using workbook values. Correct the workbook row or resolve its identity issue first.' }, { status: 409 })
    }
    const result = await applyPendingChange(change, { user, permissionManager }, request, resolveConflict)
    if (result.status === 'CONFLICT') return NextResponse.json({ error: 'This record changed in the app after the workbook edit was detected. It was marked for conflict review.' }, { status: 409 })
    if (result.status === 'FAILED') return NextResponse.json({ error: result.message }, { status: 400 })
    if (result.status === 'SKIPPED') return NextResponse.json({ error: result.message }, { status: change.status !== 'PENDING' ? 409 : 403 })

    const sync = await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({ success: true, status: 'APPLIED', workbookSync: sync.success && !sync.queued, pendingWorkbookChanges: sync.pendingWorkbookChanges || 0, workbookSyncError: sync.error || null })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Could not apply workbook change' }, { status })
  }
}
