'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, FileText, RefreshCw, ShieldAlert, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocalizedText } from '@/components/localized-text'
import { usePermissions } from '@/contexts/permissions-context'
import { useLanguage } from '@/contexts/language-context'
import { toast } from '@/lib/localized-toast'
import { apiFetch, apiGet } from '@/lib/api'

const documentTypes = ['Fire extinguisher', 'Operation card', 'Istimara', 'Insurance', 'Driver card', 'Fahas'] as const
type DocumentType = typeof documentTypes[number]
type ExpiryDocument = { id: string; title: string; documentType: DocumentType; fileName: string | null; validFrom: string | null; validUntil: string; reminderStartDate: string | null; createdAt: string }
type ExpiryTruck = { id: string; licensePlate: string; make: string; model: string; year: number; driverName: string | null; vehicleDocuments: ExpiryDocument[] }
type TrackerRow = { truck: ExpiryTruck; type: DocumentType; document?: ExpiryDocument; status: 'missing' | 'expired' | 'reminder' | 'current' }

function localDateKey(value = new Date()) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
}

function reminderDateKey(expiryDate: string) {
  if (!expiryDate) return ''
  const date = new Date(`${expiryDate}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return ''
  date.setUTCDate(date.getUTCDate() - 10)
  return date.toISOString().slice(0, 10)
}

function readableDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)
}

export function VehicleExpiryTracker() {
  const { canCreate, canUpdate } = usePermissions()
  const { t } = useLanguage()
  const [trucks, setTrucks] = useState<ExpiryTruck[]>([])
  const [selectedTruck, setSelectedTruck] = useState('')
  const [documentType, setDocumentType] = useState<DocumentType>(documentTypes[0])
  const [validFrom, setValidFrom] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const requiresFile = documentType !== 'Fire extinguisher'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiGet('/api/vehicle-documents?view=expiry')
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not load document expiry data.')
      setTrucks(data.trucks || [])
      setSelectedTruck(current => current || data.trucks?.[0]?.id || '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load document expiry data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const rows = useMemo<TrackerRow[]>(() => {
    const today = localDateKey()
    return trucks.flatMap(truck => documentTypes.map(type => {
      const document = truck.vehicleDocuments.find(item => item.documentType === type)
      let status: TrackerRow['status'] = 'missing'
      if (document && document.validUntil) {
        const expiry = document.validUntil?.slice(0, 10) || ''
        const reminder = reminderDateKey(expiry)
        status = expiry && expiry < today ? 'expired' : reminder && reminder <= today ? 'reminder' : 'current'
      }
      return { truck, type, document, status }
    }))
  }, [trucks])

  const visibleRows = rows.filter(row => {
    const searchable = `${row.truck.licensePlate} ${row.truck.make} ${row.truck.model} ${row.truck.driverName || ''} ${row.type}`.toLowerCase()
    return (!search || searchable.includes(search.toLowerCase())) &&
      (statusFilter === 'all' || row.status === statusFilter) &&
      (typeFilter === 'all' || row.type === typeFilter)
  })

  const counts = rows.reduce((acc, row) => { acc[row.status] += 1; return acc }, { missing: 0, expired: 0, reminder: 0, current: 0 })

  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const fileInput = event.currentTarget.elements.namedItem('expiryFile') as HTMLInputElement | null
    if (!selectedTruck || (requiresFile && !file)) {
      toast.error(requiresFile ? 'Select a truck and document file.' : 'Select a truck.')
      return
    }
    if (!validUntil || (validFrom && validUntil < validFrom)) {
      toast.error('Check the valid-from and expiry dates.')
      return
    }
    setBusy(true)
    try {
      const form = new FormData()
      form.set('sourceType', 'TRUCK')
      form.set('sourceId', selectedTruck)
      form.set('documentType', documentType)
      form.set('validFrom', validFrom)
      form.set('validUntil', validUntil)
      if (requiresFile && file) form.set('file', file)
      const response = await apiFetch('/api/vehicle-documents', { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save the document.')
      setFile(null)
      if (fileInput) fileInput.value = ''
      toast.success(documentType === 'Fire extinguisher' ? 'Expiry dates saved. A Fire Extinguisher file is not required.' : 'Document and expiry dates saved. Re-uploading this type for the truck replaces its existing file.')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the document.')
    } finally {
      setBusy(false)
    }
  }

  const openFile = async (documentId: string) => {
    const preview = window.open('about:blank', '_blank')
    if (!preview) {
      toast.error('Allow pop-ups to view this document.')
      return
    }
    try {
      const response = await apiGet(`/api/vehicle-documents/${documentId}`)
      if (!response.ok) throw new Error('Could not open the document.')
      const blobUrl = URL.createObjectURL(await response.blob())
      preview.location.href = blobUrl
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      preview.close()
      toast.error(error instanceof Error ? error.message : 'Could not open the document.')
    }
  }

  const statusLabel: Record<TrackerRow['status'], string> = { missing: 'Missing', expired: 'Expired', reminder: 'Reminder started', current: 'Current' }
  const statusStyle: Record<TrackerRow['status'], string> = {
    missing: 'border-slate-400/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
    expired: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    reminder: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
    current: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  }

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><div className="mb-1 flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-sky-300"><CalendarClock className="h-4 w-4"/><LocalizedText>Fleet compliance</LocalizedText></div><h1 className="text-2xl font-bold tracking-tight md:text-3xl"><LocalizedText>Document expiry tracker</LocalizedText></h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground"><LocalizedText>Track fire extinguisher, operation card, Istimara, insurance, driver card, and Fahas dates for trucks. Trucks and trailers keep their separate Protection Card file on their own detail pages.</LocalizedText></p></div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}/><LocalizedText>Refresh</LocalizedText></Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<FileText className="h-4 w-4"/>} label="Tracked document slots" value={rows.length} tone="blue"/>
        <Metric icon={<CheckCircle2 className="h-4 w-4"/>} label="Current" value={counts.current} tone="green"/>
        <Metric icon={<Clock3 className="h-4 w-4"/>} label="Reminder started" value={counts.reminder} tone="amber"/>
        <Metric icon={<ShieldAlert className="h-4 w-4"/>} label="Expired or missing" value={counts.expired + counts.missing} tone="rose"/>
      </div>

      {(canCreate('trucks') || canUpdate('trucks')) && <Card className="glass-card"><CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-sky-600"/><LocalizedText>Add or update a truck document</LocalizedText></CardTitle><CardDescription><LocalizedText>Fire Extinguisher is date-only. Its reminder starts 10 days before expiry. Upload files for the other five document types.</LocalizedText></CardDescription></CardHeader><CardContent><form onSubmit={upload} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <div className="space-y-1.5 xl:col-span-2"><Label htmlFor="expiryTruck"><LocalizedText>Truck</LocalizedText></Label><select id="expiryTruck" required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedTruck} onChange={event => setSelectedTruck(event.target.value)}><option value=""><LocalizedText>Select truck</LocalizedText></option>{trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.licensePlate} · {truck.make} {truck.model}</option>)}</select></div>
        <div className="space-y-1.5 xl:col-span-2"><Label htmlFor="expiryType"><LocalizedText>Document type</LocalizedText></Label><select id="expiryType" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={documentType} onChange={event => { setDocumentType(event.target.value as DocumentType); setFile(null) }}>{documentTypes.map(type => <option key={type} value={type}>{t(type)}</option>)}</select></div>
        <div className="space-y-1.5"><Label htmlFor="validFrom"><LocalizedText>Valid from</LocalizedText></Label><Input id="validFrom" type="date" value={validFrom} onChange={event => setValidFrom(event.target.value)}/></div>
        <div className="space-y-1.5"><Label htmlFor="validUntil"><LocalizedText>Expiry date</LocalizedText></Label><Input id="validUntil" type="date" required value={validUntil} onChange={event => setValidUntil(event.target.value)}/></div>
        <div className="space-y-1.5 xl:col-span-2"><Label htmlFor="reminderStartDate"><LocalizedText>Reminder starts (10 days before expiry)</LocalizedText></Label><Input id="reminderStartDate" type="date" readOnly value={reminderDateKey(validUntil)}/><p className="text-xs text-muted-foreground"><LocalizedText>This reminder date is calculated automatically.</LocalizedText></p></div>
        {requiresFile ? <div className="space-y-1.5 xl:col-span-3"><Label htmlFor="expiryFile"><LocalizedText>Document file</LocalizedText></Label><Input id="expiryFile" name="expiryFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required onChange={event => setFile(event.target.files?.[0] || null)}/><p className="text-xs text-muted-foreground"><LocalizedText>PDF, JPG, PNG, or WEBP · maximum 4 MB</LocalizedText></p></div> : <div className="flex items-center rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-sm text-muted-foreground xl:col-span-3"><LocalizedText>Fire Extinguisher is date-tracked only; no file is required.</LocalizedText></div>}
        <div className="flex items-end xl:col-span-3"><Button type="submit" disabled={busy || loading || !selectedTruck || (requiresFile && !file) || !validUntil} className="w-full sm:w-auto">{busy ? <><RefreshCw className="me-2 h-4 w-4 animate-spin"/><LocalizedText>Saving…</LocalizedText></> : <><Upload className="me-2 h-4 w-4"/><LocalizedText>{requiresFile ? 'Save document' : 'Save expiry dates'}</LocalizedText></>}</Button></div>
      </form></CardContent></Card>}

      <Card className="glass-card"><CardHeader><CardTitle><LocalizedText>Truck document status</LocalizedText></CardTitle><CardDescription><LocalizedText>Missing entries are included so you can see which trucks still need documents.</LocalizedText></CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3"><Input aria-label={t('Search truck, driver, or document')} placeholder={t('Search truck, driver, or document')} value={search} onChange={event => setSearch(event.target.value)}/><select aria-label={t('Filter by document')} className="h-10 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">{t('All document types')}</option>{documentTypes.map(type => <option key={type} value={type}>{t(type)}</option>)}</select><select aria-label={t('Filter by status')} className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">{t('All statuses')}</option><option value="missing">{t('Missing')}</option><option value="expired">{t('Expired')}</option><option value="reminder">{t('Reminder started')}</option><option value="current">{t('Current')}</option></select></div>
        {loading ? <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="me-2 h-4 w-4 animate-spin"/><LocalizedText>Loading expiry tracker</LocalizedText></div> : !trucks.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><AlertTriangle className="mx-auto mb-2 h-5 w-5"/><LocalizedText>No trucks are available.</LocalizedText></div> : !visibleRows.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><LocalizedText>No documents match these filters.</LocalizedText></div> : <div className="overflow-x-auto rounded-xl border"><table className="min-w-[850px] w-full text-sm"><thead className="bg-muted/60 text-left"><tr><th className="px-3 py-3 font-semibold"><LocalizedText>Truck</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Driver</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Document</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Expiry date</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Reminder starts (10 days before expiry)</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Status</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>File</LocalizedText></th></tr></thead><tbody className="divide-y">{visibleRows.map(row => <tr key={`${row.truck.id}-${row.type}`} className="hover:bg-muted/30"><td className="px-3 py-3"><span className="font-medium">{row.truck.licensePlate}</span><span className="block text-xs text-muted-foreground">{[row.truck.make, row.truck.model, row.truck.year].filter(Boolean).join(' ')}</span></td><td className="px-3 py-3">{row.truck.driverName || '—'}</td><td className="px-3 py-3"><LocalizedText>{row.type}</LocalizedText></td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validUntil)}</td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validUntil ? reminderDateKey(row.document.validUntil.slice(0, 10)) : null)}</td><td className="px-3 py-3"><Badge variant="outline" className={statusStyle[row.status]}>{statusLabel[row.status]}</Badge></td><td className="px-3 py-3">{row.document?.fileName ? <Button type="button" size="sm" variant="outline" onClick={() => void openFile(row.document!.id)}><FileText className="me-1 h-4 w-4"/><LocalizedText>View</LocalizedText></Button> : row.document && row.type === 'Fire extinguisher' ? <LocalizedText>Date only</LocalizedText> : row.document ? <LocalizedText>Missing file</LocalizedText> : '—'}</td></tr>)}</tbody></table></div>}
      </CardContent></Card>
    </div>
  )
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  const tones: Record<string, string> = { blue: 'bg-blue-500/10 text-blue-600', green: 'bg-emerald-500/10 text-emerald-600', amber: 'bg-amber-500/10 text-amber-600', rose: 'bg-rose-500/10 text-rose-600' }
  return <Card className="glass-card"><CardContent className="flex items-center gap-3 p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}>{icon}</span><div><p className="text-xs text-muted-foreground"><LocalizedText>{label}</LocalizedText></p><p className="text-2xl font-bold tabular-nums">{value}</p></div></CardContent></Card>
}
