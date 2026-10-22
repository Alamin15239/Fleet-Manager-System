'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarClock, Check, CheckCircle2, ChevronsUpDown, Clock3, FileText, Pencil, RefreshCw, ShieldAlert, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DocumentFileInput } from '@/components/document-file-input'
import { LocalizedText } from '@/components/localized-text'
import { readDocumentDates, type DocumentDates } from '@/lib/document-date-ocr'
import { usePermissions } from '@/contexts/permissions-context'
import { useLanguage } from '@/contexts/language-context'
import { toast } from '@/lib/localized-toast'
import { apiFetch, apiGet } from '@/lib/api'

const documentTypes = ['Fire extinguisher', 'Operation card', 'Istimara', 'Insurance', 'Fahas'] as const
const driverCardType = 'Driver card'
type DocumentType = typeof documentTypes[number]
type ExpiryDocument = { id: string; title: string; documentType: string; fileName: string | null; validFrom: string | null; validUntil: string; reminderStartDate: string | null; createdAt?: string }
type ExpiryTruck = { id: string; licensePlate: string; make: string; model: string; year: number; driverName: string | null; vehicleDocuments: ExpiryDocument[] }
type TrackerRow = { truck: ExpiryTruck; type: DocumentType; document?: ExpiryDocument; status: 'missing' | 'expired' | 'reminder' | 'current' }
type DriverOption = { id: string; name: string; phone: string | null; vehicleDocuments: ExpiryDocument[] }
type DriverTrackerRow = { driver: DriverOption; document?: ExpiryDocument; status: TrackerRow['status'] }
type DocumentDraft = { validFrom: string; validUntil: string; file: File | null }
type DocumentDrafts = Record<DocumentType, DocumentDraft>
type DateReadState = 'reading' | 'detected' | 'none' | 'failed'

const dateReadStateText: Record<DateReadState, string> = {
  reading: 'Reading dates from document…',
  detected: 'Dates detected. Change them if needed.',
  none: 'No dates detected. Enter the dates manually.',
  failed: 'Could not read dates. Enter the dates manually.',
}

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
  const [drivers, setDrivers] = useState<DriverOption[]>([])
  const [selectedTruck, setSelectedTruck] = useState('')
  const [truckPickerOpen, setTruckPickerOpen] = useState(false)
  const [dateReadStates, setDateReadStates] = useState<Record<string, DateReadState>>({})
  const [selectedDriverId, setSelectedDriverId] = useState('')
  const [newDriverName, setNewDriverName] = useState('')
  const [showAddDriver, setShowAddDriver] = useState(false)
  const [driverValidFrom, setDriverValidFrom] = useState('')
  const [driverValidUntil, setDriverValidUntil] = useState('')
  const [driverFile, setDriverFile] = useState<File | null>(null)
  const [driverBusy, setDriverBusy] = useState(false)
  const [draftsByTruck, setDraftsByTruck] = useState<Record<string, DocumentDrafts>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const documentSlotRefs = useRef<Partial<Record<DocumentType, HTMLElement | null>>>({})
  const fileInputRefs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({})
  const driverFileInputRef = useRef<HTMLInputElement>(null)
  const driverCardFormRef = useRef<HTMLDivElement>(null)
  const dateReadRequestIds = useRef<Record<string, number>>({})
  const selectedTruckData = useMemo(() => trucks.find(truck => truck.id === selectedTruck), [trucks, selectedTruck])
  const selectedDriver = useMemo(() => drivers.find(driver => driver.id === selectedDriverId), [drivers, selectedDriverId])
  const selectedDriverCard = selectedDriver?.vehicleDocuments.find(document => document.documentType === driverCardType)
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

  const loadDrivers = useCallback(async () => {
    try {
      const response = await apiGet('/api/drivers')
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not load drivers.')
      const nextDrivers = (data.drivers || []) as DriverOption[]
      setDrivers(nextDrivers)
      setSelectedDriverId(current => current || nextDrivers[0]?.id || '')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load drivers.')
    }
  }, [])

  useEffect(() => { void load(); void loadDrivers() }, [load, loadDrivers])

  useEffect(() => {
    setDriverValidFrom(selectedDriverCard?.validFrom?.slice(0, 10) || inferredIssueDateKey(selectedDriverCard?.validUntil))
    setDriverValidUntil(selectedDriverCard?.validUntil?.slice(0, 10) || '')
    setDriverFile(null)
    if (driverFileInputRef.current) driverFileInputRef.current.value = ''
  }, [selectedDriverId, selectedDriverCard?.id, selectedDriverCard?.validFrom, selectedDriverCard?.validUntil])

  const updateDraft = (type: DocumentType, values: Partial<DocumentDraft>) => {
    setDraftsByTruck(current => ({
      ...current,
      [selectedTruck]: {
        ...(current[selectedTruck] || draftsForTruck(selectedTruckData)),
        [type]: { ...documentDrafts[type], ...values },
      },
    }))
  }

  const startDateRead = (key: string, file: File, applyDates: (dates: DocumentDates) => void) => {
    const requestId = (dateReadRequestIds.current[key] || 0) + 1
    dateReadRequestIds.current[key] = requestId
    setDateReadStates(current => ({ ...current, [key]: 'reading' }))
    void readDocumentDates(file).then(dates => {
      if (dateReadRequestIds.current[key] !== requestId) return
      if (!dates.validFrom && !dates.validUntil) {
        setDateReadStates(current => ({ ...current, [key]: 'none' }))
        return
      }
      applyDates(dates)
      setDateReadStates(current => ({ ...current, [key]: 'detected' }))
    }).catch(error => {
      console.warn('Could not read dates from the uploaded document.', error)
      if (dateReadRequestIds.current[key] === requestId) {
        setDateReadStates(current => ({ ...current, [key]: 'failed' }))
      }
    })
  }

  const handleTruckDocumentFile = (type: DocumentType, file: File | null) => {
    const truckId = selectedTruck
    const ocrKey = `${truckId}:${type}`
    updateDraft(type, { file })
    if (!file || !truckId) {
      dateReadRequestIds.current[ocrKey] = (dateReadRequestIds.current[ocrKey] || 0) + 1
      setDateReadStates(current => {
        const next = { ...current }
        delete next[ocrKey]
        return next
      })
      return
    }

    const initialDraft = documentDrafts[type]
    startDateRead(ocrKey, file, dates => {
      setDraftsByTruck(current => {
        const truckDrafts = current[truckId] || draftsForTruck(trucks.find(truck => truck.id === truckId))
        const currentDraft = truckDrafts[type]
        if (currentDraft.file !== file) return current
        const suggestedIssueDate = dates.validFrom || (dates.validUntil ? inferredIssueDateKey(dates.validUntil) : '')
        return {
          ...current,
          [truckId]: {
            ...truckDrafts,
            [type]: {
              ...currentDraft,
              validFrom: currentDraft.validFrom === initialDraft.validFrom && suggestedIssueDate ? suggestedIssueDate : currentDraft.validFrom,
              validUntil: currentDraft.validUntil === initialDraft.validUntil && dates.validUntil ? dates.validUntil : currentDraft.validUntil,
            },
          },
        }
      })
    })
  }

  const handleDriverCardFile = (file: File | null) => {
    setDriverFile(file)
    const driverId = selectedDriverId
    const ocrKey = `driver:${driverId}`
    if (!file || !driverId) {
      dateReadRequestIds.current[ocrKey] = (dateReadRequestIds.current[ocrKey] || 0) + 1
      setDateReadStates(current => {
        const next = { ...current }
        delete next[ocrKey]
        return next
      })
      return
    }

    const initialValidFrom = driverValidFrom
    const initialValidUntil = driverValidUntil
    startDateRead(ocrKey, file, dates => {
      if (selectedDriverId !== driverId) return
      const suggestedIssueDate = dates.validFrom || (dates.validUntil ? inferredIssueDateKey(dates.validUntil) : '')
      if (suggestedIssueDate) setDriverValidFrom(current => current === initialValidFrom ? suggestedIssueDate : current)
      if (dates.validUntil) setDriverValidUntil(current => current === initialValidUntil ? dates.validUntil! : current)
    })
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

  const driverRows = useMemo<DriverTrackerRow[]>(() => {
    const today = localDateKey()
    return drivers.map(driver => {
      const document = driver.vehicleDocuments.find(item => item.documentType === driverCardType)
      const expiry = document?.validUntil?.slice(0, 10) || ''
      const reminder = expiry ? reminderDateKey(expiry) : ''
      const status: TrackerRow['status'] = !expiry ? 'missing' : expiry < today ? 'expired' : reminder <= today ? 'reminder' : 'current'
      return { driver, document, status }
    })
  }, [drivers])

  const visibleRows = rows.filter(row => {
    const searchable = `${row.truck.licensePlate} ${row.truck.make} ${row.truck.model} ${row.truck.driverName || ''} ${row.type}`.toLowerCase()
    return (!search || searchable.includes(search.toLowerCase())) &&
      (statusFilter === 'all' || row.status === statusFilter) &&
      (typeFilter === 'all' || row.type === typeFilter)
  })

  const visibleDriverRows = driverRows.filter(row =>
    (!search || row.driver.name.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'all' || row.status === statusFilter) &&
    (typeFilter === 'all' || typeFilter === driverCardType),
  )

  const counts = [...rows.map(row => row.status), ...driverRows.map(row => row.status)].reduce((acc, status) => { acc[status] += 1; return acc }, { missing: 0, expired: 0, reminder: 0, current: 0 })

  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedTruck || !selectedTruckData) {
      toast.error('Select a truck.')
      return
    }
    if (documentTypes.some(type => dateReadStates[`${selectedTruck}:${type}`] === 'reading')) {
      toast.error('Wait for document date reading to finish.')
      return
    }
    const missingDates = documentTypes.filter(type => {
      const draft = documentDrafts[type]
      return !draft.validUntil || (draft.validFrom && draft.validUntil < draft.validFrom)
    })
    if (missingDates.length) {
      toast.error('Enter an expiry date for each truck document and check any issue dates entered.')
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

  const addDriver = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newDriverName.trim().replace(/\s+/g, ' ')
    if (!name) {
      toast.error('Enter the driver name.')
      return
    }
    setDriverBusy(true)
    try {
      const response = await apiFetch('/api/drivers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.driver) throw new Error(data.error || 'Could not add the driver.')
      const driver = { ...data.driver, vehicleDocuments: [] } as DriverOption
      setDrivers(current => [...current.filter(item => item.id !== driver.id), driver].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedDriverId(driver.id)
      setNewDriverName('')
      setShowAddDriver(false)
      toast.success('Driver added. You can now enter their Driver Card dates.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the driver.')
    } finally {
      setDriverBusy(false)
    }
  }

  const saveDriverCard = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedDriver) {
      toast.error('Select or add a driver first.')
      return
    }
    if (dateReadStates[`driver:${selectedDriver.id}`] === 'reading') {
      toast.error('Wait for document date reading to finish.')
      return
    }
    if (!driverValidUntil || (driverValidFrom && driverValidUntil < driverValidFrom)) {
      toast.error('Enter a valid expiry date and check the issue date if provided.')
      return
    }
    if (driverFile && (driverFile.size > 4 * 1024 * 1024 || !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(driverFile.type))) {
      toast.error('Each document file must be a PDF, JPG, PNG, or WEBP file no larger than 4 MB.')
      return
    }
    if (selectedDriverCard ? !canUpdate('trucks') : !canCreate('trucks')) {
      toast.error('Your role cannot save one or more document changes.')
      return
    }

    setDriverBusy(true)
    try {
      const form = new FormData()
      form.set('sourceType', 'DRIVER')
      form.set('sourceId', selectedDriver.id)
      form.set('documentType', driverCardType)
      form.set('validFrom', driverValidFrom)
      form.set('validUntil', driverValidUntil)
      if (driverFile) form.set('file', driverFile)
      const response = await apiFetch('/api/vehicle-documents', { method: 'POST', body: form })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not save the driver card.')
      setDriverFile(null)
      if (driverFileInputRef.current) driverFileInputRef.current.value = ''
      toast.success(selectedDriverCard ? driverFile ? 'Driver card updated and file replaced.' : 'Driver card dates updated.' : 'Driver card and expiry dates saved.')
      await loadDrivers()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the driver card.')
    } finally {
      setDriverBusy(false)
    }
  }

  const focusRowInForm = (row: TrackerRow) => {
    setSelectedTruck(row.truck.id)
    window.setTimeout(() => {
      documentSlotRefs.current[row.type]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 0)
  }

  const focusDriverInForm = (row: DriverTrackerRow) => {
    setSelectedDriverId(row.driver.id)
    window.setTimeout(() => driverCardFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
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
        <div><div className="mb-1 flex items-center gap-2 text-sm font-medium text-sky-700 dark:text-sky-300"><CalendarClock className="h-4 w-4"/><LocalizedText>Fleet compliance</LocalizedText></div><h1 className="text-2xl font-bold tracking-tight md:text-3xl"><LocalizedText>Document expiry tracker</LocalizedText></h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground"><LocalizedText>Track fire extinguisher, operation card, Istimara, insurance, and Fahas dates for trucks. Driver Cards are saved to driver records. Trucks and trailers keep their separate Protection Card file on their own detail pages.</LocalizedText></p></div>
        <Button variant="outline" onClick={() => { void load(); void loadDrivers() }} disabled={loading}><RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}/><LocalizedText>Refresh</LocalizedText></Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<FileText className="h-4 w-4"/>} label="Tracked document slots" value={rows.length + driverRows.length} tone="blue"/>
        <Metric icon={<CheckCircle2 className="h-4 w-4"/>} label="Current" value={counts.current} tone="green"/>
        <Metric icon={<Clock3 className="h-4 w-4"/>} label="Reminder started" value={counts.reminder} tone="amber"/>
        <Metric icon={<ShieldAlert className="h-4 w-4"/>} label="Expired or missing" value={counts.expired + counts.missing} tone="rose"/>
      </div>

      {(canCreate('trucks') || canUpdate('trucks')) && <div ref={driverCardFormRef} className="scroll-mt-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-violet-600"/><LocalizedText>Driver card documents</LocalizedText></CardTitle>
            <CardDescription><LocalizedText>Driver Cards belong to people, so they are saved to a driver record and stay with that driver if the assigned truck changes.</LocalizedText> <LocalizedText>When you select a file, the app tries to prefill dates. You can adjust them before saving.</LocalizedText></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor="expiryDriver"><LocalizedText>Select driver from system</LocalizedText></Label>
                <select id="expiryDriver" required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={selectedDriverId} onChange={event => setSelectedDriverId(event.target.value)}>
                  <option value=""><LocalizedText>Select driver</LocalizedText></option>
                  {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.name}{driver.phone ? ` · ${driver.phone}` : ''}</option>)}
                </select>
              </div>
              {canCreate('trucks') && <Button type="button" variant="outline" onClick={() => setShowAddDriver(value => !value)}><LocalizedText>{showAddDriver ? 'Cancel' : 'Add driver'}</LocalizedText></Button>}
            </div>
            {showAddDriver && <form onSubmit={addDriver} className="flex flex-col gap-2 rounded-xl border bg-background/50 p-3 sm:flex-row">
              <Input aria-label={t('Driver name')} placeholder={t('Driver name')} required maxLength={120} value={newDriverName} onChange={event => setNewDriverName(event.target.value)} disabled={driverBusy}/>
              <Button type="submit" disabled={driverBusy || !newDriverName.trim()} className="sm:min-w-36"><LocalizedText>{driverBusy ? 'Saving…' : 'Save driver'}</LocalizedText></Button>
            </form>}
            {!drivers.length && <p className="text-sm text-muted-foreground"><LocalizedText>No driver records yet. Add a driver or assign a driver to a truck first.</LocalizedText></p>}
            <form onSubmit={saveDriverCard} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="space-y-1.5">
                <Label htmlFor="driverCardIssueDate"><LocalizedText>Issue date</LocalizedText></Label>
                <Input id="driverCardIssueDate" type="date" disabled={!selectedDriverId || driverBusy} value={driverValidFrom} onChange={event => setDriverValidFrom(event.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="driverCardExpiryDate"><LocalizedText>Expiry date</LocalizedText></Label>
                <Input id="driverCardExpiryDate" type="date" required disabled={!selectedDriverId || driverBusy} value={driverValidUntil} onChange={event => setDriverValidUntil(event.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <Label><LocalizedText>Reminder starts (10 days before expiry)</LocalizedText></Label>
                <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm tabular-nums">{readableDate(driverValidUntil ? reminderDateKey(driverValidUntil) : null)}</div>
              </div>
              <div className="space-y-1.5 xl:col-span-2">
                <Label htmlFor="driverCardFile"><LocalizedText>{selectedDriverCard?.fileName ? 'Replace driver card file (optional)' : 'Driver card file (optional)'}</LocalizedText></Label>
                <DocumentFileInput key={selectedDriverId} ref={driverFileInputRef} id="driverCardFile" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={!selectedDriverId || driverBusy} onFileSelected={handleDriverCardFile}/>
                {dateReadStates[`driver:${selectedDriverId}`] && <p role="status" className="text-xs text-sky-700 dark:text-sky-300"><LocalizedText>{dateReadStateText[dateReadStates[`driver:${selectedDriverId}`]]}</LocalizedText></p>}
                <p className="text-xs text-muted-foreground">
                  {driverFile ? <><LocalizedText>Selected file</LocalizedText>: {driverFile.name}. </> : selectedDriverCard?.fileName ? <><LocalizedText>Current file</LocalizedText>: {selectedDriverCard.fileName}. </> : null}
                  <LocalizedText>{selectedDriverCard?.fileName ? 'A new file replaces only this driver card.' : 'PDF, JPG, PNG, or WEBP · maximum 4 MB · optional'}</LocalizedText>
                </p>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={driverBusy || !selectedDriver || !driverValidUntil || dateReadStates[`driver:${selectedDriverId}`] === 'reading'} className="w-full">
                  {driverBusy ? <><RefreshCw className="me-2 h-4 w-4 animate-spin"/><LocalizedText>Saving…</LocalizedText></> : <><Upload className="me-2 h-4 w-4"/><LocalizedText>{selectedDriverCard ? 'Update driver card' : 'Save driver card'}</LocalizedText></>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>}

      {(canCreate('trucks') || canUpdate('trucks')) && <div className="scroll-mt-6">
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-sky-600"/>
              <LocalizedText>All truck documents</LocalizedText>
            </CardTitle>
            <CardDescription>
              <LocalizedText>Enter dates for all five truck document types. Every document file is optional, and Fire Extinguisher is date-only. Driver Cards are managed separately under their driver.</LocalizedText> <LocalizedText>When you select a file, the app tries to prefill dates. You can adjust them before saving.</LocalizedText>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={upload} className="space-y-4">
              <div className="max-w-xl space-y-1.5">
                <Label htmlFor="expiryTruck"><LocalizedText>Truck</LocalizedText></Label>
                <Popover open={truckPickerOpen} onOpenChange={setTruckPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="expiryTruck"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={truckPickerOpen}
                      aria-required="true"
                      disabled={loading || busy || trucks.length === 0}
                      className="h-10 w-full justify-between font-normal"
                    >
                      <span className="truncate text-start">
                        {selectedTruckData
                          ? `${selectedTruckData.licensePlate} · ${selectedTruckData.make} ${selectedTruckData.model}`
                          : t('Select truck')}
                      </span>
                      <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
                    <Command>
                      <CommandInput placeholder={t('Search trucks…')} />
                      <CommandList>
                        <CommandEmpty>{t('No trucks found')}</CommandEmpty>
                        <CommandGroup>
                          {trucks.map(truck => (
                            <CommandItem
                              key={truck.id}
                              value={`${truck.licensePlate} ${truck.make} ${truck.model} ${truck.year} ${truck.driverName || ''}`}
                              onSelect={() => {
                                setSelectedTruck(truck.id)
                                setTruckPickerOpen(false)
                              }}
                            >
                              <Check className={`me-2 h-4 w-4 ${selectedTruck === truck.id ? 'opacity-100' : 'opacity-0'}`} />
                              <span className="truncate">{truck.licensePlate} · {truck.make} {truck.model} ({truck.year})</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {documentTypes.map(type => {
                  const draft = documentDrafts[type]
                  const currentDocument = selectedTruckData?.vehicleDocuments.find(document => document.documentType === type)
                  const key = type.toLowerCase().replace(/[^a-z0-9]+/g, '-')
                  const dateReadKey = `${selectedTruck}:${type}`
                  const dateReadState = dateReadStates[dateReadKey]
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
                      <Label htmlFor={`document-file-${key}`}><LocalizedText>{currentDocument?.fileName ? 'Replace this document file (optional)' : 'Document file (optional)'}</LocalizedText></Label>
                      <DocumentFileInput key={`${selectedTruck}-${type}`} ref={element => { fileInputRefs.current[type] = element }} id={`document-file-${key}`} accept="application/pdf,image/jpeg,image/png,image/webp" disabled={!selectedTruck || busy} onFileSelected={file => handleTruckDocumentFile(type, file)}/>
                      {dateReadState && <p role="status" className="text-xs text-sky-700 dark:text-sky-300"><LocalizedText>{dateReadStateText[dateReadState]}</LocalizedText></p>}
                      <p className="text-xs text-muted-foreground">
                        {draft.file ? <><LocalizedText>Selected file</LocalizedText>: {draft.file.name}. </> : currentDocument?.fileName ? <><LocalizedText>Current file</LocalizedText>: {currentDocument.fileName}. </> : null}
                        <LocalizedText>{currentDocument?.fileName ? 'A new file replaces only this document type.' : 'PDF, JPG, PNG, or WEBP · maximum 4 MB · optional'}</LocalizedText>
                      </p>
                    </div>}
                    <p className="text-xs text-muted-foreground"><LocalizedText>If the issue date is blank, it is saved as one year before expiry.</LocalizedText></p>
                  </section>
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground"><LocalizedText>Expiry dates are required. Upload any document files you have; files are optional.</LocalizedText></p>
                <Button type="submit" disabled={busy || loading || !selectedTruck || documentTypes.some(type => dateReadStates[`${selectedTruck}:${type}`] === 'reading')} className="w-full sm:w-auto">
                  {busy ? <><RefreshCw className="me-2 h-4 w-4 animate-spin"/><LocalizedText>Saving all documents…</LocalizedText></> : <><Upload className="me-2 h-4 w-4"/><LocalizedText>Save all truck documents</LocalizedText></>}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>}

      <Card className="glass-card"><CardHeader><CardTitle><LocalizedText>Truck document status</LocalizedText></CardTitle><CardDescription><LocalizedText>Missing entries are included so you can see which trucks still need documents.</LocalizedText></CardDescription></CardHeader><CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3"><Input aria-label={t('Search truck, driver, or document')} placeholder={t('Search truck, driver, or document')} value={search} onChange={event => setSearch(event.target.value)}/><select aria-label={t('Filter by document')} className="h-10 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">{t('All document types')}</option>{documentTypes.map(type => <option key={type} value={type}>{t(type)}</option>)}<option value={driverCardType}>{t(driverCardType)}</option></select><select aria-label={t('Filter by status')} className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">{t('All statuses')}</option><option value="missing">{t('Missing')}</option><option value="expired">{t('Expired')}</option><option value="reminder">{t('Reminder started')}</option><option value="current">{t('Current')}</option></select></div>
        {loading ? <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="me-2 h-4 w-4 animate-spin"/><LocalizedText>Loading expiry tracker</LocalizedText></div> : !trucks.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><AlertTriangle className="mx-auto mb-2 h-5 w-5"/><LocalizedText>No trucks are available.</LocalizedText></div> : !visibleRows.length ? <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><LocalizedText>No documents match these filters.</LocalizedText></div> : <div className="overflow-x-auto rounded-xl border"><table className="min-w-[1050px] w-full text-sm"><thead className="bg-muted/60 text-left"><tr><th className="px-3 py-3 font-semibold"><LocalizedText>Truck</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Driver</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Document</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Issue date</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Expiry date</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Reminder starts (10 days before expiry)</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Status</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>File</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Actions</LocalizedText></th></tr></thead><tbody className="divide-y">{visibleRows.map(row => <tr key={`${row.truck.id}-${row.type}`} className="hover:bg-muted/30"><td className="px-3 py-3"><span className="font-medium">{row.truck.licensePlate}</span><span className="block text-xs text-muted-foreground">{[row.truck.make, row.truck.model, row.truck.year].filter(Boolean).join(' ')}</span></td><td className="px-3 py-3">{row.truck.driverName || '—'}</td><td className="px-3 py-3"><LocalizedText>{row.type}</LocalizedText></td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validFrom)}</td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validUntil)}</td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validUntil ? reminderDateKey(row.document.validUntil.slice(0, 10)) : null)}</td><td className="px-3 py-3"><Badge variant="outline" className={statusStyle[row.status]}>{statusLabel[row.status]}</Badge></td><td className="px-3 py-3">{row.document?.fileName ? <Button type="button" size="sm" variant="outline" onClick={() => void openFile(row.document!.id)}><FileText className="me-1 h-4 w-4"/><LocalizedText>View</LocalizedText></Button> : row.document && row.type === 'Fire extinguisher' ? <LocalizedText>Date only</LocalizedText> : row.document ? <LocalizedText>Not uploaded</LocalizedText> : '—'}</td><td className="px-3 py-3">{row.document ? canUpdate('trucks') ? <Button type="button" size="sm" variant="outline" onClick={() => focusRowInForm(row)}><Pencil className="me-1 h-4 w-4"/><LocalizedText>Edit</LocalizedText></Button> : '—' : canCreate('trucks') ? <Button type="button" size="sm" variant="outline" onClick={() => focusRowInForm(row)}><Upload className="me-1 h-4 w-4"/><LocalizedText>Add</LocalizedText></Button> : '—'}</td></tr>)}</tbody></table></div>}
      </CardContent></Card>

      <Card className="glass-card"><CardHeader><CardTitle><LocalizedText>Driver card status</LocalizedText></CardTitle><CardDescription><LocalizedText>Driver Cards are tracked against the driver record, independently from truck assignments.</LocalizedText></CardDescription></CardHeader><CardContent>
        {!visibleDriverRows.length ? <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"><LocalizedText>{drivers.length ? 'No driver cards match these filters.' : 'No driver records yet. Add a driver or assign a driver to a truck first.'}</LocalizedText></div> : <div className="overflow-x-auto rounded-xl border"><table className="min-w-[850px] w-full text-sm"><thead className="bg-muted/60 text-left"><tr><th className="px-3 py-3 font-semibold"><LocalizedText>Driver</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Issue date</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Expiry date</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Reminder starts (10 days before expiry)</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Status</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>File</LocalizedText></th><th className="px-3 py-3 font-semibold"><LocalizedText>Actions</LocalizedText></th></tr></thead><tbody className="divide-y">{visibleDriverRows.map(row => <tr key={row.driver.id} className="hover:bg-muted/30"><td className="px-3 py-3 font-medium">{row.driver.name}</td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validFrom)}</td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validUntil)}</td><td className="px-3 py-3 tabular-nums">{readableDate(row.document?.validUntil ? reminderDateKey(row.document.validUntil.slice(0, 10)) : null)}</td><td className="px-3 py-3"><Badge variant="outline" className={statusStyle[row.status]}>{statusLabel[row.status]}</Badge></td><td className="px-3 py-3">{row.document?.fileName ? <Button type="button" size="sm" variant="outline" onClick={() => void openFile(row.document!.id)}><FileText className="me-1 h-4 w-4"/><LocalizedText>View</LocalizedText></Button> : <LocalizedText>Not uploaded</LocalizedText>}</td><td className="px-3 py-3">{row.document ? canUpdate('trucks') ? <Button type="button" size="sm" variant="outline" onClick={() => focusDriverInForm(row)}><Pencil className="me-1 h-4 w-4"/><LocalizedText>Edit</LocalizedText></Button> : '—' : canCreate('trucks') ? <Button type="button" size="sm" variant="outline" onClick={() => focusDriverInForm(row)}><Upload className="me-1 h-4 w-4"/><LocalizedText>Add</LocalizedText></Button> : '—'}</td></tr>)}</tbody></table></div>}
      </CardContent></Card>
    </div>
  )
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  const tones: Record<string, string> = { blue: 'bg-blue-500/10 text-blue-600', green: 'bg-emerald-500/10 text-emerald-600', amber: 'bg-amber-500/10 text-amber-600', rose: 'bg-rose-500/10 text-rose-600' }
  return <Card className="glass-card"><CardContent className="flex items-center gap-3 p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone] || tones.blue}`}>{icon}</span><div><p className="text-xs text-muted-foreground"><LocalizedText>{label}</LocalizedText></p><p className="text-2xl font-bold tabular-nums">{value}</p></div></CardContent></Card>
}
