import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db, findOrganizationById, getPrimaryOrganization, withOrganization } from '@/lib/db'
import { deleteOneDriveChangeSubscription, ensureOneDriveChangeSubscription, ensureOrganizationWorkbookIsolated, getOrganizationWorkbookName, isOneDriveConfigured, syncOneDriveWorkbook } from '@/lib/onedrive-excel-sync'
import { captureOneDriveWorkbookChanges } from '@/lib/onedrive-excel-import'

export const runtime = 'nodejs'

async function withAdminOrganization<T>(request: NextRequest, operation: (organization: Awaited<ReturnType<typeof getPrimaryOrganization>>) => Promise<T>) {
  const user = await requireAdmin(request)
  const organization = user.organizationId
    ? await findOrganizationById(user.organizationId)
    : await getPrimaryOrganization()
  return withOrganization(organization, () => operation(organization))
}

export async function GET(request: NextRequest) {
  try {
    return await withAdminOrganization(request, async (organization) => {
    await ensureOrganizationWorkbookIsolated()
    let importWatchError: string | null = null
    const integration = await db.oneDriveIntegration.findUnique({
      where: { id: 'primary' },
      select: { connectedEmail: true, driveItemName: true, webUrl: true, lastSyncAt: true, lastSyncStatus: true, lastSyncError: true, driveItemId: true }
    })
    if (integration?.driveItemId) {
      try {
        await ensureOneDriveChangeSubscription()
        const scan = await captureOneDriveWorkbookChanges()
        if (scan.baselineInitializationNeeded && scan.queued === 0) importWatchError = 'No workbook changes are waiting for review. Use Sync Now to initialize safe Excel imports.'
      } catch (error) {
        importWatchError = error instanceof Error ? error.message : 'Could not check workbook changes.'
      }
    }
    const pendingWorkbookChanges = await db.excelWorkbookChange.count({ where: { status: { in: ['PENDING', 'CONFLICT'] } } })
    return NextResponse.json({
      configured: isOneDriveConfigured(),
      organization: { id: organization.id, name: organization.name, slug: organization.slug },
      connected: Boolean(integration),
      connectedEmail: integration?.connectedEmail || null,
      workbookName: integration?.driveItemName || await getOrganizationWorkbookName(),
      webUrl: integration?.webUrl || null,
      lastSyncAt: integration?.lastSyncAt || null,
      lastSyncStatus: integration?.lastSyncStatus || 'NEVER',
      lastSyncError: integration?.lastSyncError || null,
      syncMode: 'App-to-workbook sync plus role-checked workbook change review',
      pendingWorkbookChanges,
      importWatchError
    }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Administrator access required' : 'Could not load OneDrive status' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withAdminOrganization(request, async () => {
    const result = await syncOneDriveWorkbook()
    if (!result.connected) return NextResponse.json({ error: result.error || 'Connect OneDrive first' }, { status: 409 })
    if (!result.success) return NextResponse.json({ error: result.error || 'Workbook sync failed' }, { status: 502 })
    return NextResponse.json({
      success: true,
      queued: Boolean(result.queued),
      lastSyncAt: result.lastSyncAt || null,
      webUrl: result.webUrl || null,
      workbookName: result.workbookName || await getOrganizationWorkbookName(),
      recoveredFromLock: Boolean(result.recoveredFromLock),
      pendingWorkbookChanges: result.pendingWorkbookChanges || 0,
      recordCounts: result.recordCounts || null
    })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Administrator access required' : 'Could not sync the OneDrive workbook' }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    return await withAdminOrganization(request, async () => {
    await deleteOneDriveChangeSubscription()
    await db.oneDriveIntegration.deleteMany({ where: { id: 'primary' } })
    return NextResponse.json({ success: true, message: 'OneDrive disconnected. The workbook remains in OneDrive.' })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Administrator access required' : 'Could not disconnect OneDrive' }, { status })
  }
}
