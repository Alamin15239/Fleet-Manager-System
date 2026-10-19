'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Cloud, ExternalLink, Loader2, RefreshCw, Unplug } from 'lucide-react'
import { LocalizedText } from '@/components/localized-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiDelete, apiGet, apiPost } from '@/lib/api'
import { toast } from '@/lib/localized-toast'

interface OneDriveStatus {
  configured: boolean
  organization?: { id: string; name: string; slug: string }
  connected: boolean
  connectedEmail: string | null
  workbookName: string
  webUrl: string | null
  lastSyncAt: string | null
  lastSyncStatus: string
  lastSyncError: string | null
  syncNeedsRecovery?: boolean
  syncMode: string
  pendingWorkbookChanges: number
  importWatchError: string | null
}

export default function OneDriveExcelSettings() {
  const [status, setStatus] = useState<OneDriveStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const initialSyncStarted = useRef(false)

  const loadStatus = useCallback(async () => {
    try {
      const response = await apiGet('/api/integrations/onedrive')
      if (!response.ok) throw new Error('Could not load OneDrive status')
      const nextStatus = await response.json() as OneDriveStatus
      setStatus(nextStatus)
      return nextStatus
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load OneDrive status')
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const connect = async () => {
    setBusy(true)
    try {
      const response = await apiPost('/api/integrations/onedrive/connect', {})
      const data = await response.json()
      if (!response.ok || !data.authorizationUrl) throw new Error(data.error || 'Could not start OneDrive connection')
      window.location.assign(data.authorizationUrl)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not start OneDrive connection')
      setBusy(false)
    }
  }

  const syncNow = useCallback(async () => {
    setBusy(true)
    try {
      const response = await apiPost('/api/integrations/onedrive', {})
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Workbook sync failed')
      if (data.queued) {
        if (data.pendingWorkbookChanges > 0) {
          toast.success(`${data.pendingWorkbookChanges} workbook change(s) need role-checked review before sync.`)
        } else {
          toast.success('Workbook update queued')
        }
      } else if (data.recoveredFromLock) {
        toast.success(`The locked workbook was left untouched. A fresh copy, ${data.workbookName}, is now live.`)
      } else if (data.recordCounts) {
        const counts = data.recordCounts as Record<string, number>
        toast.success(`Workbook synced: ${counts['Job Cards'] ?? 0} job cards, ${counts.Tires ?? 0} tires, ${counts['Oil Changes'] ?? 0} oil changes`)
      } else {
        toast.success('Workbook synced successfully')
      }
      await loadStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Workbook sync failed')
      await loadStatus()
    } finally {
      setBusy(false)
    }
  }, [loadStatus])

  useEffect(() => {
    const url = new URL(window.location.href)
    const result = url.searchParams.get('onedrive')
    const reason = url.searchParams.get('onedriveReason')
    const syncFromWorkbook = url.searchParams.get('excelSync') === '1'

    if (result) {
      if (result === 'connected') toast.success('OneDrive connected and workbook created')
      else if (result === 'sync_failed') toast.error('OneDrive connected, but the first workbook sync failed. Check the status below.')
      else if (result === 'account_in_use') {
        const message = reason || 'This Microsoft account is already connected to another organization. Use a different account.'
        setConnectionError(message)
        toast.error(message)
      } else if (result === 'cancelled') {
        const message = reason || 'OneDrive connection was cancelled.'
        setConnectionError(message)
        toast.error(message)
      } else {
        const message = reason || 'Could not connect OneDrive. Check the app registration settings and try again.'
        setConnectionError(message)
        toast.error(message)
      }
      url.searchParams.delete('onedrive')
      url.searchParams.delete('onedriveReason')
    }

    if (syncFromWorkbook) url.searchParams.delete('excelSync')
    if (result || syncFromWorkbook) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
    }
    if (syncFromWorkbook) {
      initialSyncStarted.current = true
      void syncNow()
      return
    }

    void loadStatus().then((currentStatus) => {
      // A fresh organization has a connected account but no workbook upload
      // yet. Start that first sync when the settings panel is opened so it
      // cannot remain indefinitely at "Not synced yet" after OAuth setup.
      if (
        !initialSyncStarted.current &&
        currentStatus?.connected &&
        (
          (!currentStatus.lastSyncAt && ['NEVER', 'ERROR'].includes(currentStatus.lastSyncStatus)) ||
          currentStatus.syncNeedsRecovery
        )
      ) {
        initialSyncStarted.current = true
        void syncNow()
      }
    })
  }, [loadStatus, syncNow])

  const disconnect = async () => {
    setBusy(true)
    try {
      const response = await apiDelete('/api/integrations/onedrive')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not disconnect OneDrive')
      toast.success('OneDrive disconnected. The Excel file remains in OneDrive.')
      await loadStatus()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not disconnect OneDrive')
    } finally {
      setBusy(false)
    }
  }

  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString()
    : status?.syncNeedsRecovery
      ? 'Previous sync stalled; retrying...'
    : status?.lastSyncStatus === 'SYNCING'
      ? 'Sync in progress...'
      : status?.lastSyncStatus === 'PENDING'
        ? 'Waiting for workbook changes to be reviewed'
        : 'Not synced yet'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-blue-600" />
          <LocalizedText>Excel Live Data — OneDrive</LocalizedText>
        </CardTitle>
        <CardDescription>
          <LocalizedText>Changes flow from the app to Excel. Workbook edits are detected and wait for an authorized app user to review and apply them.</LocalizedText>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {connectionError && (
          <div role="alert" className="flex gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{connectionError}</p>
          </div>
        )}
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><LocalizedText>Loading connection status...</LocalizedText></div>
        ) : (
          <>
            <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                {status?.organization && <p className="text-xs text-muted-foreground"><LocalizedText>Workspace</LocalizedText>: {status.organization.name} ({status.organization.slug})</p>}
                <div className="flex items-center gap-2 font-medium">
                  <LocalizedText>Connection</LocalizedText>
                  <Badge variant={status?.connected ? 'default' : 'secondary'}>
                    {status?.connected ? <LocalizedText>Connected</LocalizedText> : <LocalizedText>Not connected</LocalizedText>}
                  </Badge>
                </div>
                <p className="break-all text-sm text-muted-foreground">
                  {status?.connectedEmail || (status?.configured ? 'Connect your personal Microsoft account.' : 'Microsoft app credentials are not configured yet.')}
                </p>
              </div>
              {status?.connected ? (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={syncNow} disabled={busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    <LocalizedText>Sync Now</LocalizedText>
                  </Button>
                  <Button variant="ghost" onClick={disconnect} disabled={busy}>
                    <Unplug className="mr-2 h-4 w-4" /><LocalizedText>Disconnect</LocalizedText>
                  </Button>
                </div>
              ) : (
                <Button onClick={connect} disabled={busy || !status?.configured}>
                  {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Cloud className="mr-2 h-4 w-4" />}
                  <LocalizedText>Connect OneDrive</LocalizedText>
                </Button>
              )}
            </div>

            {!status?.configured && (
              <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium"><LocalizedText>Deployment setup required</LocalizedText></p>
                  <p className="mt-1"><LocalizedText>Add MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TOKEN_ENCRYPTION_KEY, and NEXT_PUBLIC_APP_URL to the server environment. Register the callback URL shown in the setup guide.</LocalizedText></p>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground"><LocalizedText>Workbook</LocalizedText></p>
                <p className="mt-1 break-words font-medium">{status?.workbookName || 'Fleet Manager Live Data.xlsx'}</p>
                {status?.webUrl && <a className="mt-2 inline-flex items-center text-sm text-blue-600 hover:underline" href={status.webUrl} target="_blank" rel="noreferrer"><LocalizedText>Open in OneDrive</LocalizedText><ExternalLink className="ml-1 h-3.5 w-3.5" /></a>}
              </div>
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground"><LocalizedText>Last successful update</LocalizedText></p>
                <p className="mt-1 font-medium">{lastSync}</p>
                {status?.connected && status.lastSyncStatus === 'SUCCESS' && <p className="mt-2 flex items-center gap-1 text-sm text-green-700"><CheckCircle2 className="h-4 w-4" /><LocalizedText>Up to date</LocalizedText></p>}
                {status?.lastSyncError && <p className="mt-2 text-sm text-red-600">{status.lastSyncError}</p>}
              </div>
            </div>

            {status?.connected && (
              <div className="flex flex-col gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium"><LocalizedText>Workbook changes awaiting review</LocalizedText>: {status.pendingWorkbookChanges || 0}</p>
                  <p className="mt-1"><LocalizedText>Excel changes are applied only after a signed-in user passes the app role permission check.</LocalizedText></p>
                  {status.importWatchError && <p className="mt-2 text-amber-800"><LocalizedText>Watcher status</LocalizedText>: <LocalizedText>{status.importWatchError}</LocalizedText></p>}
                </div>
                <Button asChild variant="outline" className="shrink-0">
                  <Link href="/excel-imports"><LocalizedText>Review Excel Changes</LocalizedText></Link>
                </Button>
              </div>
            )}

            <div className="space-y-2 text-sm text-muted-foreground">
              <p><LocalizedText>Workbook tabs include trucks, trailers, maintenance, oil changes, tires, and workshop job cards. The workbook refreshes after those records change and can also be synced manually.</LocalizedText></p>
              <p><LocalizedText>Workbook additions and edits appear in Excel Changes. Deleted worksheet rows never delete app records. Resolve all pending changes before the app replaces the workbook with its current data.</LocalizedText></p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
