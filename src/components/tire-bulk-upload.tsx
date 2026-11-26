'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Eye, ShieldCheck, RefreshCw } from 'lucide-react'
import { toast } from '@/lib/localized-toast'

type PreviewUnit = {
  serial: string | null
  tireSize: string
  manufacturer: string
  origin: string
  historyEntries: number
  firstDate: string | null
  lastDate: string | null
  vehicles: string[]
  status: 'READY' | 'DUPLICATE' | 'BLOCKED'
  duplicateReason: string | null
  warnings: string[]
  errors: string[]
}
type ImportPreview = {
  message: string
  fileName: string
  sheets: string[]
  summary: {
    sourceRows: number
    sourceQuantityTotal: number
    tiresDetected: number
    historyEntries: number
    serialUsageOccurrences: number
    uniqueSerialTires: number
    repeatedSerialUsageOccurrences: number
    unnumberedQuantitySlots: number
    unnumberedTireCandidates: number
    unquantifiedRows: number
    repeatedSerialsGrouped: number
    exactDuplicateRowsSkipped: number
    importableTires: number
    importableUsageEntries: number
    existingDuplicates: number
    blockedTires: number
    blockedUsageEntries: number
    warnings: number
  }
  preview: PreviewUnit[]
  previewLimit: number
  previewTruncated: boolean
}

export default function TireBulkUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ImportPreview | null>(null)

  const sendFile = async (mode: 'preview' | 'import') => {
    if (!file) {
      setError('Choose an Excel or CSV file first.')
      return
    }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const data = new FormData()
      data.append('file', file)
      data.append('mode', mode)
      // The app stores its JWT in localStorage. This upload previously sent
      // only cookies, which fails for OTP sessions because the OTP login route
      // returns a token but does not set the auth-token cookie.
      const token = localStorage.getItem('authToken')
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await fetch('/api/tires/bulk-upload', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: data
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Tire sheet operation failed.')
      if (mode === 'preview') {
        setPreview(result as ImportPreview)
        setMessage(result.message || 'Analysis complete. No records have been saved.')
        toast.success('Sheet analyzed. Review the preview before importing.')
      } else {
        setMessage(result.message || 'Tire usage history imported.')
        setPreview(null)
        setFile(null)
        const input = document.getElementById('tire-bulk-file') as HTMLInputElement | null
        if (input) input.value = ''
        toast.success(result.message || 'Tire usage history imported.')
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'Tire sheet operation failed.'
      setError(msg)
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  const formatDate = (value: string | null) => value
    ? new Date(value).toLocaleDateString()
    : '—'

  const statusLabel = (status: PreviewUnit['status']) => status === 'READY'
    ? 'Ready'
    : status === 'DUPLICATE' ? 'Duplicate' : 'Needs review'

  const statusClass = (status: PreviewUnit['status']) => status === 'READY'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : status === 'DUPLICATE'
      ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
      : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'

  const clearSelection = () => {
    setFile(null)
    setPreview(null)
    setMessage('')
    setError('')
    const input = document.getElementById('tire-bulk-file') as HTMLInputElement | null
    if (input) input.value = ''
  }

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Smart tire usage-history import</CardTitle>
      <p className="text-sm text-muted-foreground">Upload the spreadsheet as it is. The importer creates exactly the number of tire records stated in each valid OUT QTY cell. Serial numbers identify those records; they never increase the count.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">No fixed tire-size or origin selection is required</p>
        <p className="mt-1 text-xs text-muted-foreground">The importer reads date, truck or trailer reference, driver, serial number, quantity, tire size, manufacturer, origin and usage history directly from each worksheet. Missing values remain missing; source vehicle references are retained as text.</p>
        <p className="mt-2 text-xs text-muted-foreground">Repeated serials on separate source rows are imported as separate source occurrences. No database serial lookup, fleet lookup, deduplication, or automatic vehicle assignment is performed.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tire-bulk-file">Excel / CSV usage-history file</Label>
        <Input
          id="tire-bulk-file"
          type="file"
          accept=".xlsx,.csv"
          disabled={busy}
          onChange={event => {
            setFile(event.target.files?.[0] || null)
            setPreview(null)
            setMessage('')
            setError('')
          }}
        />
        {file && <p className="text-xs text-muted-foreground">{file.name} · {(file.size / 1024).toFixed(1)} KB</p>}
      </div>

      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

      {!preview && <Button onClick={() => sendFile('preview')} disabled={busy || !file}>
        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing sheet…</> : <><Eye className="mr-2 h-4 w-4" />Analyze sheet and show preview</>}
      </Button>}

      {preview && <>
        <div className="rounded-lg border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">Import analysis</p>
              <p className="text-xs text-muted-foreground">File: {preview.fileName}</p>
              <p className="text-xs text-muted-foreground">Detected worksheets: {preview.sheets.join(', ')}</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">Preview only · database unchanged</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Tires detected', preview.summary.tiresDetected],
              ['Usage entries', preview.summary.historyEntries],
              ['Tire records from sheet', preview.summary.importableTires],
              ['Usage entries to import', preview.summary.importableUsageEntries],
              ['Repeated serial groups (kept separate)', preview.summary.repeatedSerialsGrouped],
              ['Rows without valid OUT QTY', preview.summary.unquantifiedRows],
              ['Warnings', preview.summary.warnings]
            ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-muted/50 p-2">
              <p className="text-lg font-semibold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>)}
          </div>
          <div className="mt-4 rounded-md border p-3">
            <p className="text-sm font-semibold">Quantity reconciliation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              OUT QTY is the total number of tire-usage units recorded in the source. Every OUT QTY slot is retained as a separate tire record. Repeated serials on different rows are not merged or matched. Rows without a valid OUT QTY remain visible in the analysis but create zero tire records. Extra serial numbers never increase the OUT QTY count.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ['Source OUT QTY total', preview.summary.sourceQuantityTotal],
                ['Serial usage occurrences', preview.summary.serialUsageOccurrences],
                ['Unique serial values in sheet', preview.summary.uniqueSerialTires],
                ['Repeated serial appearances (kept separate)', preview.summary.repeatedSerialUsageOccurrences],
                ['Unnumbered quantity slots', preview.summary.unnumberedQuantitySlots],
                ['Unnumbered tire candidates', preview.summary.unnumberedTireCandidates],
                ['Rows without valid OUT QTY', preview.summary.unquantifiedRows]
              ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-muted/50 p-2">
                <p className="text-base font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>)}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Source rows analyzed: {preview.summary.sourceRows}. Each workbook row and quantity slot is counted independently. No database records are changed during analysis.</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Detected tire records</p>
            <span className="text-xs text-muted-foreground">Showing {preview.preview.length} of {preview.summary.tiresDetected}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2">Serial / tire</th>
                  <th className="px-3 py-2">Detected details</th>
                  <th className="px-3 py-2">Usage history</th>
                  <th className="px-3 py-2">Vehicles</th>
                  <th className="px-3 py-2">Import status</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((item, index) => <tr key={(item.serial || 'unserialised') + '-' + index} className="border-t align-top">
                  <td className="px-3 py-3 font-medium">{item.serial || 'Serial not supplied'}</td>
                  <td className="px-3 py-3">
                    <div>{item.tireSize}</div>
                    <div className="text-muted-foreground">{item.manufacturer} · {item.origin}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div>{item.historyEntries} entry/entries</div>
                    <div className="text-muted-foreground">{formatDate(item.firstDate)} – {formatDate(item.lastDate)}</div>
                    {item.warnings.slice(0, 2).map((warning, i) => <p key={i} className="mt-1 text-amber-700 dark:text-amber-300">{warning}</p>)}
                    {item.errors.slice(0, 2).map((problem, i) => <p key={i} className="mt-1 text-red-600 dark:text-red-400">{problem}</p>)}
                  </td>
                  <td className="px-3 py-3">{item.vehicles.join(', ') || 'Unresolved'}</td>
                  <td className="px-3 py-3">
                    <span className={'inline-flex rounded-full px-2 py-1 font-medium ' + statusClass(item.status)}>{statusLabel(item.status)}</span>
                    {item.duplicateReason && <p className="mt-1 text-muted-foreground">{item.duplicateReason}</p>}
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
          {preview.previewTruncated && <p className="text-xs text-muted-foreground">Only the first {preview.previewLimit} tire records are displayed here. All detected source records are included in the import.</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sendFile('import')} disabled={busy || preview.summary.importableTires === 0}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing tire history…</> : <><ShieldCheck className="mr-2 h-4 w-4" />Import {preview.summary.importableTires} tire records from workbook</>}
          </Button>
          <Button type="button" variant="outline" onClick={() => sendFile('preview')} disabled={busy || !file}>
            <RefreshCw className="mr-2 h-4 w-4" />Re-analyze sheet
          </Button>
          <Button type="button" variant="ghost" onClick={clearSelection} disabled={busy}>Cancel</Button>
        </div>
        <p className="text-xs text-muted-foreground">Exactly the valid OUT QTY total is imported. Rows without valid OUT QTY create no tire records; serial identifiers only label quantity slots. No fleet matching, existing-serial matching, grouping, or review-based blocking is performed. Original vehicle references and source row details are saved as text when no database relation is available. Dated rows create tire usage-history events; rows without dates remain as tire source records. Tire imports never create or link Workshop Job Cards. This workbook does not create stock receipts.</p>
      </>}
    </CardContent>
  </Card>
}
