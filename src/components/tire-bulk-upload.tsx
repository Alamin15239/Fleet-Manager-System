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
      <p className="text-sm text-muted-foreground">Upload the spreadsheet as it is. The system detects the columns and tire information, checks the fleet and existing serial numbers, then shows a review preview before saving anything.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">No fixed tire-size or origin selection is required</p>
        <p className="mt-1 text-xs text-muted-foreground">The importer looks for date, truck or trailer, driver, serial number, quantity, tire size, manufacturer, origin and usage-history columns across the workbook. Missing tire details are shown in the preview as Unspecified or OTHER rather than guessed.</p>
        <p className="mt-2 text-xs text-muted-foreground">When the same serial appears on multiple dated vehicle rows, it is grouped as one physical tire with a chronological usage history. A serial already registered in Tire Management is flagged as a database duplicate and is not imported again.</p>
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
              ['Unique tires to import', preview.summary.importableTires],
              ['Usage entries to import', preview.summary.importableUsageEntries],
              ['Database duplicates', preview.summary.existingDuplicates],
              ['Needs review', preview.summary.blockedTires],
              ['Repeated serial groups', preview.summary.repeatedSerialsGrouped],
              ['Duplicate rows skipped', preview.summary.exactDuplicateRowsSkipped],
              ['Warnings', preview.summary.warnings]
            ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-muted/50 p-2">
              <p className="text-lg font-semibold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>)}
          </div>
          <div className="mt-4 rounded-md border p-3">
            <p className="text-sm font-semibold">Quantity reconciliation</p>
            <p className="mt-1 text-xs text-muted-foreground">
              OUT QTY is the total number of tire-usage units recorded in the source. Repeated serial numbers represent the same physical tire and are grouped into one tire record. Unnumbered units cannot be reliably matched across separate rows.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                ['Source OUT QTY total', preview.summary.sourceQuantityTotal],
                ['Serial usage occurrences', preview.summary.serialUsageOccurrences],
                ['Unique serial tires', preview.summary.uniqueSerialTires],
                ['Repeated serial appearances grouped', preview.summary.repeatedSerialUsageOccurrences],
                ['Unnumbered quantity slots', preview.summary.unnumberedQuantitySlots],
                ['Unnumbered tire candidates', preview.summary.unnumberedTireCandidates],
                ['Rows without valid OUT QTY', preview.summary.unquantifiedRows]
              ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-muted/50 p-2">
                <p className="text-base font-semibold tabular-nums">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>)}
            </div>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Source rows analyzed: {preview.summary.sourceRows}. Repeated serials across different vehicles or dates are treated as usage history, not duplicate tires. No database records are changed during analysis.</p>
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
                  <th className="px-3 py-2">Review status</th>
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
          {preview.previewTruncated && <p className="text-xs text-muted-foreground">Only the first {preview.previewLimit} tires are displayed here. All detected records are included in the server-side review and duplicate checks.</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => sendFile('import')} disabled={busy || preview.summary.importableTires === 0}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing history…</> : <><ShieldCheck className="mr-2 h-4 w-4" />Import {preview.summary.importableUsageEntries} usage entries across {preview.summary.importableTires} tire(s)</>}
          </Button>
          <Button type="button" variant="outline" onClick={() => sendFile('preview')} disabled={busy || !file}>
            <RefreshCw className="mr-2 h-4 w-4" />Recheck duplicates
          </Button>
          <Button type="button" variant="ghost" onClick={clearSelection} disabled={busy}>Cancel</Button>
        </div>
        <p className="text-xs text-muted-foreground">Only records marked Ready are saved. Existing serial duplicates and rows with unresolved dates or vehicles are skipped. Each saved usage entry is linked to the vehicle’s open workshop Job Card, or a Job Card is created when no open one exists.</p>
      </>}
    </CardContent>
  </Card>
}
