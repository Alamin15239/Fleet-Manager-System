'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, FileText, Pencil, RefreshCw, ShieldAlert, Upload } from 'lucide-react'
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
type DocumentDraft = { validFrom: string; validUntil: string; file: File | null }
type DocumentDrafts = Record<DocumentType, DocumentDraft>

function emptyDocumentDrafts(): DocumentDrafts {
  return Object.fromEntries(documentTypes.map(type => [type, { validFrom: '', validUntil: '', file: null }])) as DocumentDrafts
}

function draftsForTruck(truck?: ExpiryTruck): DocumentDrafts {
  const drafts = emptyDocumentDrafts()
  for (const type of documentTypes) {
    const document = truck?.vehicleDocuments.find(item => item.documentType === type)
    drafts[type] = {
      validFrom: document?.validFrom?.slice(0, 10) || inferredIssueDateKey(document?.validUntil),
      validUntil: document?.validUntil?.slice(0, 10) || '',
      file: null,
    }
  }
  return drafts
}

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

function inferredIssueDateKey(expiryDate?: string | null) {
  if (!expiryDate) return ''
  const date = new Date(`${expiryDate.slice(0, 10)}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getUTCFullYear() - 1
  const month = date.getUTCMonth()
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
}

function readableDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' }).format(date)
}

export function VehicleExpiryTracker() {
  const { canCreate, canUpdate } = usePermissions()
  const { t } = useLanguage()
  const [trucks, setTrucks] = useState<ExpiryTruck[]>([])
  const [selectedTruck, setSelectedTruck] = useState('')
  const [draftsByTruck, setDraftsByTruck] = useState<Record<string, DocumentDrafts>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const documentSlotRefs = useRef<Partial<Record<DocumentType, HTMLElement | null>>>({})
  const fileInputRefs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({})
  const selectedTruckData = useMemo(() => trucks.find(truck => truck.id === selectedTruck), [trucks, selectedTruck])
  const documentDrafts = useMemo(
    () => draftsByTruck[selectedTruck] || draftsForTruck(selectedTruckData),
    [draftsByTruck, selectedTruck, selectedTruckData],
  )

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

  const updateDraft = (type: DocumentType, values: Partial<DocumentDraft>) => {
    setDraftsByTruck(current => ({
      ...current,
      [selectedTruck]: {
        ...(current[selectedTruck] || draftsForTruck(selectedTruckData)),
        [type]: { ...documentDrafts[type], ...values },
      },
    }))
  }

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
    if (!selectedTruck || !selectedTruckData) {
      toast.error('Select a truck.')
      return
    }
    const missingDates = documentTypes.filter(type => {
      const draft = documentDrafts[type]
      return !draft.validUntil || (draft.validFrom && draft.validUntil < draft.validFrom)
    })
    if (missingDates.length) {
      toast.error('Enter valid issue and expiry dates for all six document types.')
      return
    }
    const missingFiles = documentTypes.filter(type => {
      if (type === 'Fire extinguisher') return false
      const currentDocument = selectedTruckData.vehicleDocuments.find(document => document.documentType === type)
      return !currentDocument?.fileName && !documentDrafts[type].file
    })
    if (missingFiles.length) {
      toast.error('Upload all missing required document files before saving.')
      return
    }
    const invalidFile = documentTypes.find(type => {
      const file = documentDrafts[type].file
      return file && (file.size > 4 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    })
    if (invalidFile) {
      toast.error('Each document file must be a PDF, JPG, PNG, or WEBP file no larger than 4 MB.')
      return
    }

    const changedTypes = documentTypes.filter(type => {
      const draft = documentDrafts[type]
      const existing = selectedTruckData.vehicleDocuments.find(document => document.documentType === type)
      if (!existing || draft.file) return true
      const oldIssueDate = existing.validFrom?.slice(0, 10) || inferredIssueDateKey(existing.validUntil)
      return draft.validFrom !== oldIssueDate || draft.validUntil !== existing.validUntil.slice(0, 10)
    })
    if (!changedTypes.length) {
      toast.success('All truck documents are already up to date.')
      return
    }

    const deniedType = changedTypes.find(type => {
      const exists = selectedTruckData.vehicleDocuments.some(document => document.documentType === type)
      return exists ? !canUpdate('trucks') : !canCreate('trucks')
    })
    if (deniedType) {
      toast.error('Your role cannot save one or more document changes.')
      return
    }

    setBusy(true)
    const savedTypes: DocumentType[] = []
    try {
      for (const type of changedTypes) {
        const draft = documentDrafts[type]
        const form = new FormData()
        form.set('sourceType', 'TRUCK')
        form.set('sourceId', selectedTruck)
        form.set('documentType', type)
        form.set('validFrom', draft.validFrom)
        form.set('validUntil', draft.validUntil)
        if (draft.file) form.set('file', draft.file)
        const response = await apiFetch('/api/vehicle-documents', { method: 'POST', body: form })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(`${t(type)}: ${data.error || 'Could not save the document.'}`)
        savedTypes.push(type)
        if (draft.file || !draft.validFrom) {
          setDraftsByTruck(current => ({ ...current, [selectedTruck]: { ...(current[selectedTruck] || documentDrafts), [type]: { ...draft, validFrom: draft.validFrom || inferredIssueDateKey(draft.validUntil), file: null } } }))
        }
        if (draft.file) {
          if (fileInputRefs.current[type]) fileInputRefs.current[type]!.value = ''
        }
      }
      toast.success('All truck document updates were saved. Existing files are kept unless you replace that same document type.')
      await load()
    } catch (error) {
      const partialMessage = savedTypes.length
        ? `Saved ${savedTypes.map(type => t(type)).join(', ')}. ${error instanceof Error ? error.message : 'The remaining documents could not be saved.'} Submit again to finish the remaining changes.`
        : error instanceof Error ? error.message : 'Could not save the documents.'
      toast.error(partialMessage)
      if (savedTypes.length) await load()
    } finally {
      setBusy(false)
    }
  }

  const focusRowInForm = (row: TrackerRow) => {
    setSelectedTruck(row.truck.id)
    window.setTimeout(() => {
      documentSlotRefs.current[row.type]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
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

      {(canCreate('trucks') || canUpdate('trucks')) && <div className="scroll-mt-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-sky-600"/>
              <LocalizedText>All truck documents</LocalizedText>
            </CardTitle>
            <CardDescription>
              <LocalizedText>Choose one truck, enter dates for all six document types, and upload all five required files. Fire Extinguisher is date-only. Existing files stay unless you replace that same document type.</LocalizedText>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={upload} className="space-y-4">
              <div className="max-w-xl space-y-1.5">
                <Label htmlFor="expiryTruck"><LocalizedText>Truck</LocalizedText></Label>
                <select id="expiryTruck" required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedTruck} onChange={event => setSelectedTruck(event.target.value)}>
                  <option value=""><LocalizedText>Select truck</LocalizedText></option>
                  {trucks.map(truck => <option key={truck.id} value={truck.id}>{truck.licensePlate} · {truck.make} {truck.model}</option>)}
                </select>
              </div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {documentTypes.map(type => {
                  const draft = documentDrafts[type]
                  const currentDocument = selectedTruckData?.vehicleDocuments.find(document => document.documentType === type)
                  const key = type.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                  const isFireExtinguisher = type === 'Fire extinguisher'
                  return <section key={type} ref={element => { documentSlotRefs.current[type] = element }} className="space-y-3 rounded-xl border bg-background/60 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold"><LocalizedText>{type}</LocalizedText></h3>
                      {currentDocument?.fileName && !isFireExtinguisher ? <Badge variant="outline" className="max-w-[55%] truncate">{currentDocument.fileName}</Badge> : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`valid-from-${key}`}><LocalizedText>Issue date</LocalizedText></Label>
                        <Input id={`valid-from-${key}`} type="date" disabled={!selectedTruck || busy} value={draft.validFrom} onChange={event => updateDraft(type, { validFrom: event.target.value })}/>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`valid-until-${key}`}><LocalizedText>Expiry date</LocalizedText></Label>
                        <Input id={`valid-until-${key}`} type="date" required disabled={!selectedTruck || busy} value={draft.validUntil} onChange={event => updateDraft(type, { validUntil: event.target.value })}/>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <LocalizedText>Reminder starts (10 days before expiry)</LocalizedText>: <span className="font-medium tabular-nums">{readableDate(draft.validUntil ? reminderDateKey(draft.validUntil) : null)}</span>
                    </div>
                    {isFireExtinguisher ? <p className="rounded-lg bg-sky-500/5 p-2 text-xs text-muted-foreground"><LocalizedText>Fire Extinguisher is date-tracked only; no file is required.</LocalizedText></p> : <div className="space-y-1.5">
                      <Label htmlFor={`document-file-${key}`}><LocalizedText>{currentDocument?.fileName ? 'Replace this document file (optional)' : 'Document file (required)'}</LocalizedText></Label>
                      <Input key={`${selectedTruck}-${type}`} ref={element => { fileInputRefs.current[type] = element }} id={`document-file-${key}`} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={!selectedTruck || busy} required={!currentDocument?.fileName} onChange={event => updateDraft(type, { file: event.target.files?.[0] || null })}/>
                      <p className="text-xs text-muted-foreground">
                        {draft.file ? <><LocalizedText>Selected file</LocalizedText>: {draft.file.name}. </> : currentDocument?.fileName ? <><LocalizedText>Current file</LocalizedText>: {currentDocument.fileName}. </> : null}
                        <LocalizedText>{currentDocument?.fileName ? 'A new file replaces only this document type.' : 'PDF, JPG, PNG, or WEBP · maximum 4 MB'}</LocalizedText>
                      </p>
                    </div>}
                    <p className="text-xs text-muted-foreground"><LocalizedText>If the issue date is blank, it is saved as one year before expiry.</LocalizedText></p>
                  </section>
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground"><LocalizedText>All six expiry dates are required. All five files are required if they are not already saved for this truck.</LocalizedText></p>
                <Button type="submit" disabled={busy || loading || !selectedTruck} className="w-full sm:w-auto">
                  {busy ? <><RefreshCw className="me-2 h-4 w-4 animate-spin"/><LocalizedText>Saving all documents…</LocalizedText></> : <><Upload className="me-2 h-4 w-4"/><LocalizedText>Save all truck documents</LocalizedText></>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>}

      <Card className="glass-card"><CardHeader><CardTitle><LocalizedText>Truck document status</LocalizedText></CardTitle><CardDescription><LocalizedText>Missing entries are included so you can see which trucks still need documents.</LocalizedText></CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3"><Input aria-label={t('Search truck, driver, or document')} placeholder={t('Search truck, driver, or document')} value={search} onChange={event => setSearch(event.target.value)}/><select aria-label={t('Filter by document')} className="h-10 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">{t('All document types')}</option>{documentTypes.map(type => <option key={type} value={type}>{t(type)}</option>)}</select><select aria-label={t('Filter by status')} className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">{t('All statuses')}</option><option value="missing">{t('Missing')}</option><option value="expired">{t('Expired')}</option><option value="reminder">{t('Reminder started')}</option><option value="current">{t('Current')}</option></select></div>
        {loading ? <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="me-2 h-4 w-4 animate-spin"/><LocalizedText>Loading expiry tracker</LocalizedText></div> : !trucks.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><AlertTriangle className="mx-auto mb-2 h-5 w-5"/><LocalizedText>No trucks are available.</LocalizedText></div> : !visibleRows.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><LocalizedText>No documents match these filters.</LocalizedText></div> : <div className="overflow-x-auto rounded-xl border"><table className="min-w-[1050px] w-full text-sm"><thead className="bg-muted/60 text-left"><tr><th className="px-3 py-3 font-semibold"><LocalizedText>Truck</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Driver</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Document</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Issue date</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Expiry date</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Reminder starts (10 days before expiry)</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Status</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>File</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Actions</LocalizedText></th></tr></thead><tbody className="divide-y">{visibleRows.map(row => <tr key={`${row.truck.id}-${row.type}`} className="hover:bg-muted/30"><td className="px-3 py-3"><span className="font-medium">{row.truck.licensePlate}</span><span className="block text-xs text-muted-foreground">{[row.truck.make, row.truck.model, row.truck.year].filter(Boolean).join(' ')}</span></td><td className="px-3 py-3">{row.truck.driverName || '—'}</td><td className="px-3 py-3"><LocalizedText>{row.type}</LocalizedText></td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validFrom)}</td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validUntil)}</td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validUntil ? reminderDateKey(row.document.validUntil.slice(0, 10)) : null)}</td><td className="px-3 py-3"><Badge variant="outline" className={statusStyle[row.status]}>{statusLabel[row.status]}</Badge></td><td className="px-3 py-3">{row.document?.fileName ? <Button type="button" size="sm" variant="outline" onClick={() => void openFile(row.document!.id)}><FileText className="me-1 h-4 w-4"/><LocalizedText>View</LocalizedText></Button> : row.document && row.type === 'Fire extinguisher' ? <LocalizedText>Date only</LocalizedText> : row.document ? <LocalizedText>Missing file</LocalizedText> : '—'}</td><td className="px-3 py-3">{row.document ? canUpdate('trucks') ? <Button type="button" size="sm" variant="outline" onClick={() => focusRowInForm(row)}><Pencil className="me-1 h-4 w-4"/><LocalizedText>Edit</LocalizedText></Button> : '—' : canCreate('trucks') ? <Button type="button" size="sm" variant="outline" onClick={() => focusRowInForm(row)}><Upload className="me-1 h-4 w-4"/><LocalizedText>Add</LocalizedText></Button> : '—'}</td></tr>)}</tbody></table></div>}
      </CardContent></Card>
    </div>
  )
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  const tones: Record<string, string> = { blue: 'bg-blue-500/10 text-blue-600', green: 'bg-emerald-500/10 text-emerald-600', amber: 'bg-amber-500/10 text-amber-600', rose: 'bg-rose-500/10 text-rose-600' }
  return <Card className="glass-card"><CardContent className="flex items-center gap-3 p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}>{icon}</span><div><p className="text-xs text-muted-foreground"><LocalizedText>{label}</LocalizedText></p><p className="text-2xl font-bold tabular-nums">{value}</p></div></CardContent></Card>
}
