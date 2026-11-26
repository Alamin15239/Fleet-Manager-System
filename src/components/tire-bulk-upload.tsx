'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Eye, ShieldCheck, RefreshCw, Search, ChevronLeft, ChevronRight, X, FileCheck2, Database, History, Hash, AlertTriangle } from 'lucide-react'
import { toast } from '@/lib/localized-toast'

type PreviewUnit = {
  sourceSheet: string
  sourceRow: number
  sourceOutQty: number
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
  willReconcileExisting?: boolean
}
type ImportErrorDiagnostics = {
  expectedTires?: number
  detectedTires?: number
  sheetTotals?: Array<{ sheetName: string; usageRows: number; tireQuantity: number }>
  sheetReconciliationFailures?: Array<{ sheetName: string; expected: number; detected: number }>
  rowDiagnostics?: Array<{ sheetName: string; rows: Array<{ sourceRow: number; quantityText: string; parsedQuantity: number }> }>
}

type ImportPreview = {
  message: string
  fileName: string
  sheets: string[]
  summary: {
    sourceRows: number
    sourceQuantityTotal: number
    sheetQuantityTotals?: Array<{ sheetName: string; usageRows: number; tireQuantity: number }>
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
    legacyRecordsToReconcile?: number
    newTireRecordsToCreate?: number
    blockedTires: number
    blockedUsageEntries: number
    warnings: number
  }
  preview: PreviewUnit[]
  unquantifiedPreview?: Array<{ sourceSheet: string; sourceRow: number; quantityText: string; serialText: string; vehicleText: string; driver: string; warnings: string[] }>
  previewLimit: number
  previewTruncated: boolean
  pageInfo?: { page: number; pageSize: number; total: number; totalPages: number }
}

const PAGE_SIZE = 50
const number = (value: number) => new Intl.NumberFormat().format(value)
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString() : '—'

export default function TireBulkUpload() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [errorDiagnostics, setErrorDiagnostics] = useState<ImportErrorDiagnostics | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [sheet, setSheet] = useState('all')
  const [confirmImport, setConfirmImport] = useState(false)
  const [dragging, setDragging] = useState(false)

  const clearSelection = useCallback(() => {
    setFile(null); setPreview(null); setMessage(''); setError(''); setErrorDiagnostics(null)
    setPage(1); setSearch(''); setAppliedSearch(''); setSheet('all'); setConfirmImport(false)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const sendFile = async (mode: 'preview' | 'import', requestedPage = 1, searchOverride = appliedSearch, sheetOverride = sheet) => {
    if (!file) { setError('Choose an Excel or CSV file first.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const data = new FormData()
      data.append('file', file)
      data.append('mode', mode)
      data.append('page', String(requestedPage))
      data.append('pageSize', String(PAGE_SIZE))
      data.append('search', searchOverride)
      data.append('sheet', sheetOverride)
      const token = localStorage.getItem('authToken')
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {}
      const response = await fetch('/api/tires/bulk-upload', { method: 'POST', headers, credentials: 'include', body: data })
      const result = await response.json()
      if (!response.ok) {
        setErrorDiagnostics(result as ImportErrorDiagnostics)
        throw new Error(result.error || 'Tire sheet operation failed.')
      }
      setErrorDiagnostics(null)
      if (mode === 'preview') {
        setPreview(result as ImportPreview); setPage(requestedPage)
        setConfirmImport(false)
        setMessage(result.message || 'Analysis complete. No records have been saved.')
      } else {
        setMessage(result.message || 'Tire usage history imported.')
        setPreview(null); setConfirmImport(false); setFile(null)
        if (inputRef.current) inputRef.current.value = ''
        toast.success(result.message || 'Tire usage history imported.')
      }
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : 'Tire sheet operation failed.'
      setError(msg); toast.error(msg)
    } finally { setBusy(false) }
  }

  const chooseFile = (next: File | null) => {
    setFile(next); setPreview(null); setMessage(''); setError(''); setErrorDiagnostics(null)
    setPage(1); setSearch(''); setAppliedSearch(''); setSheet('all'); setConfirmImport(false)
  }

  const applyFilters = () => { const value = search.trim(); setAppliedSearch(value); setPage(1); void sendFile('preview', 1, value, sheet) }
  const goToPage = (next: number) => { if (!busy && next >= 1 && next <= (preview?.pageInfo?.totalPages || 1)) void sendFile('preview', next) }

  const stats = useMemo(() => {
    if (!preview) return []
    const s = preview.summary
    return [
      { label: 'Tire records', value: s.tiresDetected, icon: Database },
      { label: 'Usage history', value: s.historyEntries, icon: History },
      { label: 'Legacy records to reconcile', value: s.legacyRecordsToReconcile ?? 0, icon: RefreshCw },
      { label: 'Rows to review', value: s.unquantifiedRows, icon: AlertTriangle }
    ]
  }, [preview])

  const status = (value: PreviewUnit['status']) => value === 'READY'
    ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">Ready</Badge>
    : value === 'DUPLICATE'
      ? <Badge variant="secondary">Already imported</Badge>
      : <Badge variant="destructive">Blocked</Badge>

  return <div className="space-y-5">
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-950 dark:to-background">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary"><FileSpreadsheet className="h-6 w-6" /></div>
          <div className="min-w-0">
            <CardTitle className="text-xl">Tire history import</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Upload the original workbook. Review the reconciliation, inspect source rows, then confirm one controlled import.</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex gap-3 rounded-xl border p-3"><Hash className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-semibold">Usage quantity controls count</p><p className="text-xs text-muted-foreground">Opening balance stock is excluded; only usage rows create tire history.</p></div></div>
          <div className="flex gap-3 rounded-xl border p-3"><History className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-semibold">History stays separate</p><p className="text-xs text-muted-foreground">New dated events are appended to the matching tire without replacing its earlier history.</p></div></div>
          <div className="flex gap-3 rounded-xl border p-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /><div><p className="text-sm font-semibold">Source-row reconciliation</p><p className="text-xs text-muted-foreground">Repeated serials stay separate. Existing tires are reused only when the complete source row, date, vehicle, size, origin and serial group match exactly.</p></div></div>
        </div>

        <div
          role="button" tabIndex={0}
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={event => { if ((event.key === 'Enter' || event.key === ' ') && !busy) inputRef.current?.click() }}
          onDragOver={event => { event.preventDefault(); if (!busy) setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={event => { event.preventDefault(); setDragging(false); if (!busy) chooseFile(event.dataTransfer.files?.[0] || null) }}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition sm:p-10 ${dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/30'} ${busy ? 'pointer-events-none opacity-60' : ''}`}
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Upload className="h-6 w-6" /></div>
          <p className="font-semibold">{file ? file.name : 'Drop your workbook here'}</p>
          <p className="mt-1 text-sm text-muted-foreground">{file ? `${(file.size / 1024).toFixed(1)} KB · Click to replace file` : 'or browse to select an Excel or CSV file'}</p>
          <p className="mt-2 text-xs text-muted-foreground">.xlsx or .csv · Maximum 10 MB · No template required</p>
          <Input ref={inputRef} id="tire-bulk-file" type="file" accept=".xlsx,.csv" className="sr-only" disabled={busy} onChange={event => chooseFile(event.target.files?.[0] || null)} />
        </div>

        {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
        {errorDiagnostics?.sheetTotals?.length ? <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Blocked import diagnostics</CardTitle><p className="text-sm text-muted-foreground">No records were imported. Compare the parser's row-level values with the original workbook.</p></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">Expected {number(errorDiagnostics.expectedTires || 0)} tires · detected {number(errorDiagnostics.detectedTires || 0)}</p>
            {errorDiagnostics.sheetTotals.map(sheetTotal => {
              const detail = errorDiagnostics.rowDiagnostics?.find(item => item.sheetName === sheetTotal.sheetName)
              return <div key={sheetTotal.sheetName} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><strong>{sheetTotal.sheetName}</strong><span>{number(sheetTotal.tireQuantity)} parsed tires · {number(sheetTotal.usageRows)} rows</span></div>
                {detail?.rows?.length ? <div className="mt-2 max-h-48 overflow-auto rounded border">
                  <table className="w-full text-xs"><thead className="sticky top-0 bg-muted"><tr><th className="p-2 text-left">Source row</th><th className="p-2 text-left">Original OUT QTY</th><th className="p-2 text-right">Parsed</th></tr></thead>
                    <tbody>{detail.rows.map(row => <tr key={row.sourceRow} className="border-t"><td className="p-2">{row.sourceRow}</td><td className="p-2 font-mono">{row.quantityText || 'Blank'}</td><td className="p-2 text-right font-semibold">{row.parsedQuantity}</td></tr>)}</tbody>
                  </table>
                </div> : <p className="mt-2 text-xs text-muted-foreground">No positive quantity rows were parsed.</p>}
              </div>
            })}
          </CardContent>
        </Card> : null}
        {message && <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}

        {!preview && <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => sendFile('preview')} disabled={busy || !file} className="min-w-44">
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing workbook…</> : <><Eye className="mr-2 h-4 w-4" />Analyze workbook</>}
          </Button>
          {file && <Button variant="ghost" onClick={clearSelection} disabled={busy}><X className="mr-2 h-4 w-4" />Clear</Button>}
        </div>}
      </CardContent>
    </Card>

    {preview && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Import analysis</h2><p className="text-sm text-muted-foreground">{preview.fileName} · {preview.summary.sourceRows} source rows · {preview.sheets.length} worksheets</p></div>
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5"><ShieldCheck className="h-3.5 w-3.5" />Preview only · database unchanged</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(item => <Card key={item.label}><CardContent className="flex items-center gap-3 p-4"><div className="rounded-lg bg-muted p-2"><item.icon className="h-5 w-5 text-muted-foreground" /></div><div className="min-w-0"><p className="text-2xl font-bold tabular-nums">{number(item.value)}</p><p className="text-xs text-muted-foreground">{item.label}</p></div></CardContent></Card>)}
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Quantity reconciliation</CardTitle><p className="text-sm text-muted-foreground">OUT QTY controls the number of tire records. Every quantity slot remains separate, even when serial numbers repeat; serials label records and never add quantity. Missing or invalid OUT QTY contributes zero. Opening Balance sections are excluded.</p></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['OUT QTY total', preview.summary.sourceQuantityTotal],
              ['Unique serial values', preview.summary.uniqueSerialTires],
              ['Repeated appearances', preview.summary.repeatedSerialUsageOccurrences],
              ['Unnumbered slots', preview.summary.unnumberedQuantitySlots],
              ['Repeated serial groups (kept separate)', preview.summary.repeatedSerialsGrouped],
              ['Rows without valid quantity', preview.summary.unquantifiedRows],
              ['Usage entries to save', preview.summary.importableUsageEntries],
              ['Warnings', preview.summary.warnings]
            ].map(([label, value]) => <div key={String(label)} className="rounded-xl bg-muted/50 p-3"><p className="text-xl font-semibold tabular-nums">{number(Number(value))}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}
          </div>
          {preview.summary.sheetQuantityTotals?.length ? <div className="space-y-2">
            <p className="text-sm font-semibold">Usage quantity by worksheet</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {preview.summary.sheetQuantityTotals.map(item => <div key={item.sheetName} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="truncate pr-3">{item.sheetName}</span>
                <span className="shrink-0 font-semibold tabular-nums">{number(item.tireQuantity)} tires <span className="font-normal text-muted-foreground">· {number(item.usageRows)} rows</span></span>
              </div>)}
            </div>
          </div> : null}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Worksheets:</span>
            {preview.sheets.map(name => <Badge key={name} variant="secondary">{name}</Badge>)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-base">Source tire records</CardTitle><p className="text-sm text-muted-foreground">Inspect each quantity slot with its original worksheet and row reference.</p></div><Badge variant="outline">{number(preview.pageInfo?.total ?? preview.summary.tiresDetected)} records</Badge></div></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') applyFilters() }} placeholder="Search serial, vehicle, worksheet or tire size…" className="pl-9" /></div>
            <select value={sheet} onChange={event => { const value = event.target.value; setSheet(value); setPage(1); void sendFile('preview', 1, appliedSearch, value) }} className="h-10 rounded-md border bg-background px-3 text-sm sm:w-56"><option value="all">All worksheets</option>{preview.sheets.map(name => <option key={name} value={name}>{name}</option>)}</select>
            <Button variant="secondary" onClick={applyFilters} disabled={busy}><Search className="mr-2 h-4 w-4" />Search</Button>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-3 py-3">Source</th><th className="px-3 py-3">Serial</th><th className="px-3 py-3">Specification</th><th className="px-3 py-3">History</th><th className="px-3 py-3">Source vehicle</th><th className="px-3 py-3">Status</th></tr></thead>
                <tbody>
                  {preview.preview.map((item, index) => <tr key={item.sourceSheet + '-' + item.sourceRow + '-' + index} className="border-t align-top hover:bg-muted/20">
                    <td className="px-3 py-3"><p className="font-medium">{item.sourceSheet}</p><p className="text-xs text-muted-foreground">Row {item.sourceRow} · OUT QTY {item.sourceOutQty}</p></td>
                    <td className="px-3 py-3 font-mono text-xs">{item.serial || <span className="font-sans text-muted-foreground">Not supplied</span>}</td>
                    <td className="px-3 py-3"><p>{item.tireSize || 'Unspecified'}</p><p className="text-xs text-muted-foreground">{item.manufacturer || 'Unspecified'} · {item.origin || 'OTHER'}</p></td>
                    <td className="px-3 py-3"><p>{item.historyEntries} event(s)</p><p className="text-xs text-muted-foreground">{formatDate(item.firstDate)} – {formatDate(item.lastDate)}</p>{item.warnings.slice(0,1).map((warning,i)=><p key={i} className="mt-1 max-w-xs text-xs text-amber-700 dark:text-amber-300">{warning}</p>)}</td>
                    <td className="px-3 py-3">{item.vehicles.join(', ') || <span className="text-muted-foreground">Not supplied</span>}</td>
                    <td className="px-3 py-3">{status(item.status)}{item.willReconcileExisting && <p className="mt-1"><Badge variant="outline">Reconcile existing row</Badge></p>}{item.duplicateReason && <p className="mt-1 max-w-xs text-xs text-muted-foreground">{item.duplicateReason}</p>}{item.errors.length > 0 && <p className="mt-1 max-w-xs text-xs text-destructive">{item.errors[0]}</p>}</td>
                  </tr>)}
                  {preview.preview.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-muted-foreground">No records match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Showing {preview.preview.length ? ((preview.pageInfo?.page || page)-1)*(preview.pageInfo?.pageSize || PAGE_SIZE)+1 : 0}–{Math.min((preview.pageInfo?.page || page)*(preview.pageInfo?.pageSize || PAGE_SIZE), preview.pageInfo?.total ?? preview.summary.tiresDetected)} of {number(preview.pageInfo?.total ?? preview.summary.tiresDetected)}</p>
            <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => goToPage(page-1)} disabled={busy || page <= 1}><ChevronLeft className="h-4 w-4" />Previous</Button><span className="text-xs tabular-nums text-muted-foreground">Page {preview.pageInfo?.page || page} of {preview.pageInfo?.totalPages || 1}</span><Button variant="outline" size="sm" onClick={() => goToPage(page+1)} disabled={busy || page >= (preview.pageInfo?.totalPages || 1)}>Next<ChevronRight className="h-4 w-4" /></Button></div>
          </div>
        </CardContent>
      </Card>

      {(preview.unquantifiedPreview?.length || 0) > 0 && <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Source rows excluded from tire creation</CardTitle><p className="text-sm text-muted-foreground">{number(preview.summary.unquantifiedRows)} rows have a missing or invalid OUT QTY. They remain visible here for review and create zero tire records.</p></CardHeader>
        <CardContent className="space-y-2">
          <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground"><tr><th className="px-3 py-2">Source</th><th className="px-3 py-2">OUT QTY value</th><th className="px-3 py-2">Serial text</th><th className="px-3 py-2">Vehicle / driver</th><th className="px-3 py-2">Review note</th></tr></thead>
            <tbody>{preview.unquantifiedPreview?.map((item,index)=><tr key={item.sourceSheet+'-'+item.sourceRow} className="border-t align-top"><td className="px-3 py-3"><p className="font-medium">{item.sourceSheet}</p><p className="text-xs text-muted-foreground">Row {item.sourceRow}</p></td><td className="px-3 py-3 font-mono">{item.quantityText || 'Blank'}</td><td className="px-3 py-3 font-mono text-xs">{item.serialText || '—'}</td><td className="px-3 py-3">{item.vehicleText || '—'}<p className="text-xs text-muted-foreground">{item.driver || 'Driver not supplied'}</p></td><td className="px-3 py-3 text-xs text-amber-700 dark:text-amber-300">{item.warnings.join(' ') || 'OUT QTY is not valid'}</td></tr>)}</tbody>
          </table></div>
          {preview.summary.unquantifiedRows > (preview.unquantifiedPreview?.length || 0) && <p className="text-xs text-muted-foreground">Showing the first {preview.unquantifiedPreview?.length} excluded source rows.</p>}
        </CardContent>
      </Card>}

      <Card className="border-primary/30">
        <CardContent className="space-y-3 p-4 sm:p-5">
          <div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 text-primary" /><div><p className="font-semibold">Ready to import {number(preview.summary.importableTires)} separate OUT QTY tire slots</p><p className="text-sm text-muted-foreground">{number(preview.summary.newTireRecordsToCreate ?? preview.summary.importableTires)} new records will be created and {number(preview.summary.legacyRecordsToReconcile ?? 0)} exact legacy records will be corrected in place. Repeated serials remain separate. Stable source-row/slot codes prevent re-import duplicates. Truck and trailer references are matched using normalized fleet identifiers; unmatched references remain visible as unverified history. No existing tire records are deleted.</p></div></div>
          {confirmImport ? <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription><strong>Confirm tire reconciliation.</strong> {number(preview.summary.newTireRecordsToCreate ?? preview.summary.importableTires)} new tire records will be created, {number(preview.summary.legacyRecordsToReconcile ?? 0)} existing legacy records will be corrected, and {number(preview.summary.importableUsageEntries)} dated usage-history entries will be saved. All {number(preview.summary.sourceQuantityTotal)} OUT QTY slots will remain separate.</AlertDescription></Alert> : null>
          <div className="flex flex-wrap gap-2">
            {!confirmImport ? <Button onClick={() => setConfirmImport(true)} disabled={busy || preview.summary.importableTires === 0}><ShieldCheck className="mr-2 h-4 w-4" />Review and confirm import</Button> : <Button onClick={() => sendFile('import')} disabled={busy || preview.summary.importableTires === 0}>{busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing records…</> : <><CheckCircle2 className="mr-2 h-4 w-4" />Confirm import of {number(preview.summary.importableTires)} tires</>}</Button>}
            <Button variant="outline" onClick={() => sendFile('preview', 1)} disabled={busy || !file}><RefreshCw className="mr-2 h-4 w-4" />Re-analyze</Button>
            <Button variant="ghost" onClick={clearSelection} disabled={busy}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </>}
  </div>
}
