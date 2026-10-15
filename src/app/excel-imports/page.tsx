'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, Clock3, FileSpreadsheet, Loader2, RefreshCw, ShieldCheck, X, CheckCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { LocalizedText } from '@/components/localized-text'
import { useAuth } from '@/contexts/auth-context'
import { apiGet, apiPost } from '@/lib/api'
import { toast } from '@/lib/localized-toast'

type WorkbookChange = {
  id: string
  sheetName: string
  entityType: string
  operation: 'CREATE' | 'UPDATE'
  rowData: Record<string, unknown>
  changes: Record<string, { from: unknown; to: unknown }> | null
  status: string
  error: string | null
  detectedAt: string
  canApply: boolean
}

function showValue(value: unknown) {
  if (value == null || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function ExcelImportsPage() {
  const { isAdmin } = useAuth()
  const [changes, setChanges] = useState<WorkbookChange[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [watchError, setWatchError] = useState<string | null>(null)
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ complete: number; total: number } | null>(null)

  const loadChanges = useCallback(async () => {
    try {
      const response = await apiGet('/api/integrations/onedrive/imports')
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not load workbook changes.')
      setChanges(data.changes || [])
      setWatchError(data.watchError || null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load workbook changes.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadChanges() }, [loadChanges])

  const applyChange = async (change: WorkbookChange) => {
    setActiveId(change.id)
    try {
      const response = await apiPost('/api/integrations/onedrive/imports', { id: change.id })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not apply workbook change.')
      if (data.workbookSync === false) {
        toast.success('Change applied in the app. The workbook update is queued and may need a Sync Now retry.')
      } else {
        toast.success('Workbook change applied. Your role permissions were checked.')
      }
      await loadChanges()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not apply workbook change.')
      await loadChanges()
    } finally {
      setActiveId(null)
    }
  }

  const eligibleChanges = changes.filter(change => change.status === 'PENDING' && change.canApply)
  const excludedChanges = changes.length - eligibleChanges.length

  const applyAllChanges = async () => {
    const ids = eligibleChanges.map(change => change.id)
    if (!ids.length) return
    setBulkConfirmOpen(false)
    setActiveId('bulk')
    setBulkProgress({ complete: 0, total: ids.length })
    let failed = 0
    let conflicts = 0
    let skipped = 0
    let remainingCount = 0
    let workbookSync: boolean | null = null
    let workbookSyncError: string | null = null
    try {
      for (let index = 0; index < ids.length; index += 20) {
        const batch = ids.slice(index, index + 20)
        const response = await apiPost('/api/integrations/onedrive/imports', { action: 'apply-all', ids: batch })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not apply workbook changes.')
        failed += data.failedCount || 0
        conflicts += data.conflictCount || 0
        skipped += data.skippedCount || 0
        remainingCount = data.remainingWorkbookChanges || 0
        if (data.workbookSync !== null && data.workbookSync !== undefined) workbookSync = data.workbookSync
        if (data.workbookSyncError) workbookSyncError = data.workbookSyncError
        setBulkProgress({ complete: Math.min(index + batch.length, ids.length), total: ids.length })
      }
      const notApplied = failed + conflicts + skipped
      if (notApplied) {
        toast.warning('Bulk apply finished with rows that need review. See each row for details.')
      } else if (remainingCount > 0) {
        toast.warning('Some workbook changes remain. Refresh and review the remaining rows.')
      } else if (workbookSync === false) {
        toast.success('All eligible changes were applied. Workbook sync is queued; retry Sync Now if it does not finish.')
      } else {
        toast.success('Bulk apply finished. All eligible changes were applied.')
      }
      if (workbookSyncError) toast.error(workbookSyncError)
      await loadChanges()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not apply workbook changes.')
      await loadChanges()
    } finally {
      setActiveId(null)
      setBulkProgress(null)
    }
  }

  const dismissChange = async (change: WorkbookChange) => {
    setActiveId(change.id)
    try {
      const response = await apiPost('/api/integrations/onedrive/imports', { id: change.id, action: 'dismiss' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not dismiss workbook change.')
      toast.success('Workbook change dismissed.')
      await loadChanges()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not dismiss workbook change.')
    } finally {
      setActiveId(null)
    }
  }

  const scanWorkbook = async () => {
    setActiveId('scan')
    try {
      const response = await apiPost('/api/integrations/onedrive/imports', { action: 'scan' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not scan the workbook.')
      if (data.queued > 0) toast.success(`Found ${data.queued} workbook change(s) for review.`)
      else if (data.baselineInitializationNeeded) toast.info('No differences found. Use Sync Now in Settings → Excel Sync to initialize workbook imports.')
      else toast.success('Workbook checked. No new changes were found.')
      await loadChanges()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not scan the workbook.')
    } finally {
      setActiveId(null)
    }
  }

  const pending = changes.filter(change => change.status === 'PENDING').length
  const conflicts = changes.filter(change => change.status === 'CONFLICT').length

  return (
    <main className="container mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <FileSpreadsheet className="h-7 w-7 text-primary" />
            <LocalizedText>Excel Changes</LocalizedText>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            <LocalizedText>Workbook edits are checked against your app permissions before they can change fleet records.</LocalizedText>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {eligibleChanges.length > 0 && (
            <Button onClick={() => setBulkConfirmOpen(true)} disabled={loading || activeId !== null}>
              {activeId === 'bulk' ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <CheckCheck className="me-2 h-4 w-4" />}
              {activeId === 'bulk' && bulkProgress ? <><LocalizedText>Applying changes</LocalizedText> {bulkProgress.complete}/{bulkProgress.total}</> : <LocalizedText>Apply all eligible shown</LocalizedText>}
            </Button>
          )}
          <Button variant="outline" onClick={scanWorkbook} disabled={loading || activeId !== null}>
            {activeId === 'scan' ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <RefreshCw className="me-2 h-4 w-4" />}
            <LocalizedText>Check workbook now</LocalizedText>
          </Button>
          <Button variant="ghost" onClick={() => { setLoading(true); void loadChanges() }} disabled={loading || activeId !== null}>
            <RefreshCw className="me-2 h-4 w-4" /><LocalizedText>Refresh</LocalizedText>
          </Button>
        </div>
      </div>

      {watchError && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><LocalizedText>{watchError}</LocalizedText></div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4"><Clock3 className="h-5 w-5 text-blue-600" /><div><p className="text-sm text-muted-foreground"><LocalizedText>Waiting for review</LocalizedText></p><p className="text-xl font-semibold">{pending}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><AlertTriangle className="h-5 w-5 text-amber-600" /><div><p className="text-sm text-muted-foreground"><LocalizedText>Conflicts to resolve</LocalizedText></p><p className="text-xl font-semibold">{conflicts}</p></div></CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4"><ShieldCheck className="h-5 w-5 text-green-600" /><div><p className="text-sm text-muted-foreground"><LocalizedText>Role checks</LocalizedText></p><p className="text-sm font-semibold"><LocalizedText>Checked when applying</LocalizedText></p></div></CardContent></Card>
      </div>

      {loading ? (
        <Card><CardContent className="flex items-center justify-center gap-2 p-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><LocalizedText>Loading workbook changes...</LocalizedText></CardContent></Card>
      ) : changes.length === 0 ? (
        <Card><CardHeader><CardTitle><LocalizedText>No workbook changes</LocalizedText></CardTitle><CardDescription><LocalizedText>Edits and new rows in the connected workbook will appear here for role-checked review.</LocalizedText></CardDescription></CardHeader></Card>
      ) : (
        <div className="space-y-4">
          {changes.map(change => (
            <Card key={change.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      <span>{change.sheetName}</span>
                      <Badge variant={change.operation === 'CREATE' ? 'default' : 'secondary'}>{change.operation === 'CREATE' ? 'New row' : 'Edit'}</Badge>
                      {change.status === 'CONFLICT' && <Badge variant="destructive"><LocalizedText>Conflict</LocalizedText></Badge>}
                      {change.status === 'ERROR' && <Badge variant="destructive"><LocalizedText>Error</LocalizedText></Badge>}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      <LocalizedText>Detected</LocalizedText> {new Date(change.detectedAt).toLocaleString()}
                      {change.rowData['Record ID'] ? ` · ID ${String(change.rowData['Record ID'])}` : ''}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {change.status === 'PENDING' && (
                      <Button size="sm" onClick={() => void applyChange(change)} disabled={!change.canApply || activeId !== null}>
                        {activeId === change.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Check className="me-2 h-4 w-4" />}
                        <LocalizedText>{change.canApply ? 'Apply change' : 'Role cannot apply'}</LocalizedText>
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="outline" onClick={() => void dismissChange(change)} disabled={activeId !== null}>
                        <X className="me-2 h-4 w-4" /><LocalizedText>Dismiss</LocalizedText>
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {change.error && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{change.error}</div>}
                <div>
                  <h3 className="mb-2 text-sm font-semibold"><LocalizedText>Complete workbook row</LocalizedText></h3>
                  {Object.keys(change.rowData).length > 0 ? (
                    <div className="overflow-x-auto rounded-md border">
                      <table className="w-full min-w-[620px] text-sm">
                        <thead className="bg-muted/50 text-left"><tr><th className="p-2"><LocalizedText>Field</LocalizedText></th><th className="p-2"><LocalizedText>Workbook value</LocalizedText></th><th className="p-2"><LocalizedText>Change</LocalizedText></th></tr></thead>
                        <tbody>{Object.entries(change.rowData).map(([field, value]) => {
                          const diff = change.changes?.[field]
                          return (
                            <tr key={field} className={`border-t align-top ${diff ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''}`}>
                              <td className="whitespace-nowrap p-2 font-medium">{field}{diff && <Badge variant="outline" className="ms-2"><LocalizedText>Changed</LocalizedText></Badge>}</td>
                              <td className="max-w-[36rem] break-words p-2">{showValue(value)}</td>
                              <td className="max-w-[24rem] break-words p-2 text-muted-foreground">{diff ? <><LocalizedText>Previous app value</LocalizedText>: {showValue(diff.from)}</> : <LocalizedText>Unchanged in workbook</LocalizedText>}</td>
                            </tr>
                          )
                        })}</tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground"><LocalizedText>No workbook fields were received.</LocalizedText></p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle><LocalizedText>Apply all eligible workbook changes?</LocalizedText></AlertDialogTitle>
            <AlertDialogDescription>
              <LocalizedText>It will apply the complete rows displayed on this page after checking each one against your role and the app’s validation rules.</LocalizedText>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-sm">
            <p><strong>{eligibleChanges.length}</strong> <LocalizedText>eligible pending rows will be applied.</LocalizedText></p>
            {excludedChanges > 0 && <p className="text-muted-foreground"><strong>{excludedChanges}</strong> <LocalizedText>rows are excluded because of conflicts, permissions, or status.</LocalizedText></p>}
            <p className="text-muted-foreground"><LocalizedText>Conflicts and rows outside your permissions will be skipped. Any row that fails app validation will remain pending with an error for review.</LocalizedText></p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel><LocalizedText>Cancel</LocalizedText></AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); void applyAllChanges() }}>
              <LocalizedText>Apply eligible rows</LocalizedText>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
