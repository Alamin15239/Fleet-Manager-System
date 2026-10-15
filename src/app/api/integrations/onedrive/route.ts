import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteOneDriveChangeSubscription, ensureOneDriveChangeSubscription, isOneDriveConfigured, ONEDRIVE_WORKBOOK_NAME, syncOneDriveWorkbook } from '@/lib/onedrive-excel-sync'
import { captureOneDriveWorkbookChanges } from '@/lib/onedrive-excel-import'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    let importWatchError: string | null = null
    const integration = await db.oneDriveIntegration.findUnique({
      where: { id: 'primary' },
      select: { connectedEmail: true, driveItemName: true, webUrl: true, lastSyncAt: true, lastSyncStatus: true, lastSyncError: true, driveItemId: true }
    })
    if (integration?.driveItemId) {
      try {
        await ensureOneDriveChangeSubscription()
        const scan = await captureOneDriveWorkbookChanges()
        if (scan.baselineInitializationNeeded) importWatchError = 'Sync the workbook once to initialize safe Excel imports.'
      } catch (error) {
        importWatchError = error instanceof Error ? error.message : 'Could not check workbook changes.'
      }
    }
    const pendingWorkbookChanges = await db.excelWorkbookChange.count({ where: { status: { in: ['PENDING', 'CONFLICT'] } } })
    return NextResponse.json({
      configured: isOneDriveConfigured(),
      connected: Boolean(integration),
      connectedEmail: integration?.connectedEmail || null,
      workbookName: integration?.driveItemName || ONEDRIVE_WORKBOOK_NAME,
      webUrl: integration?.webUrl || null,
      lastSyncAt: integration?.lastSyncAt || null,
      lastSyncStatus: integration?.lastSyncStatus || 'NEVER',
      lastSyncError: integration?.lastSyncError || null,
      syncMode: 'App-to-workbook sync plus role-checked workbook change review',
      pendingWorkbookChanges,
      importWatchError
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Administrator access required' : 'Could not load OneDrive status' }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const result = await syncOneDriveWorkbook()
    if (!result.connected) return NextResponse.json({ error: result.error || 'Connect OneDrive first' }, { status: 409 })
    if (!result.success) return NextResponse.json({ error: result.error || 'Workbook sync failed' }, { status: 502 })
    return NextResponse.json({
      success: true,
      queued: Boolean(result.queued),
      lastSyncAt: result.lastSyncAt || null,
      webUrl: result.webUrl || null,
      workbookName: result.workbookName || ONEDRIVE_WORKBOOK_NAME,
      recoveredFromLock: Boolean(result.recoveredFromLock),
      pendingWorkbookChanges: result.pendingWorkbookChanges || 0,
      recordCounts: result.recordCounts || null
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Administrator access required' : 'Could not sync the OneDrive workbook' }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request)
    await deleteOneDriveChangeSubscription()
    await db.oneDriveIntegration.deleteMany({ where: { id: 'primary' } })
    return NextResponse.json({ success: true, message: 'OneDrive disconnected. The workbook remains in OneDrive.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Administrator access required' : 'Could not disconnect OneDrive' }, { status })
  }
}
