'use client'
import { LocalizedText } from '@/components/localized-text'

import { useEffect, useState } from 'react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from '@/lib/localized-toast'
import { FileText, Plus, Printer, Download, Pencil, Trash2, Eye, Search, Loader2 } from 'lucide-react'
import { renderJobCardDocument } from '@/lib/job-card-document'
import { createJobCardPdfBlob, downloadJobCardPdf } from '@/lib/job-card-pdf'
import { usePermissions } from '@/contexts/permissions-context'
import { PdfPreviewDialog } from '@/components/pdf-preview-dialog'

type VehicleType = 'truck' | 'trailer'
type LineItem = { type: string; description: string; quantity: number; remarks: string; inventoryItemId?: string | null; unitCost?: number | null }
type InventoryItem = { id: string; name: string; partNumber?: string | null; unit: string; stockQty: number }
type JobForm = {
  vehicleType: VehicleType; vehicleId: string; serviceDate: string; odometerKm: string; serviceType: string;
  reportedIssue: string; technicianName: string; driverName: string; status: string; priority: string; nextServiceOdometer: string;
  nextServiceDate: string; partsCost: string; laborCost: string; notes: string; items: LineItem[]; checklist: Record<string, string>;
  technicianSignature: string; supervisorSignature: string; driverSignature: string
}
type Vehicle = { id: string; label: string; driverName?: string | null; mileage?: number }
type JobCard = any
type Company = { companyName?: string | null; companyAddress?: string | null; companyPhone?: string | null; companyEmail?: string | null }

const checklistItems = [
  ['engineOil', 'Engine oil & filter', 'زيت المحرك والفلتر'], ['airFilter', 'Air filter', 'فلتر الهواء'],
  ['fuelFilter', 'Fuel filter', 'فلتر الوقود'], ['brakes', 'Brakes', 'المكابح'], ['tyres', 'Tyres & pressure', 'الإطارات والضغط'],
  ['battery', 'Battery', 'البطارية'], ['lights', 'Lights & signals', 'الأنوار والإشارات'], ['belts', 'Belts & hoses', 'السيور والخراطيم'],
  ['cooling', 'Cooling system', 'نظام التبريد'], ['transmission', 'Transmission oil', 'زيت ناقل الحركة']
]

const blankForm = (): JobForm => ({
  vehicleType: 'truck', vehicleId: '', serviceDate: new Date().toISOString().slice(0, 10), odometerKm: '', serviceType: '',
  reportedIssue: '', technicianName: '', driverName: '', status: 'OPEN', priority: 'NORMAL', nextServiceOdometer: '', nextServiceDate: '', partsCost: '', laborCost: '',
  notes: '', items: [], checklist: {}, technicianSignature: '', supervisorSignature: '', driverSignature: ''
})

const escapeMap: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => escapeMap[char] || char)
const dateText = (value?: string | Date | null) => value ? new Date(value).toLocaleDateString('en-GB') : '—'
export default function WorkshopJobCards() {
  const { canCreate, canUpdate } = usePermissions()
  const [cards, setCards] = useState<JobCard[]>([])
  const [activitySummary, setActivitySummary] = useState({ oil: { total: 0 }, tires: { total: 0 }, spareParts: { total: 0 }, total: 0 })
  const [company, setCompany] = useState<Company | null>(null)
  const [trucks, setTrucks] = useState<Vehicle[]>([])
  const [trailers, setTrailers] = useState<Vehicle[]>([])
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [form, setForm] = useState<JobForm>(blankForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState('Job card')
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false)
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null)
  const vehicles = form.vehicleType === 'truck' ? trucks : trailers

  useEffect(() => () => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl) }, [pdfPreviewUrl])

  const load = async () => {
    try {
      const [cardsResponse, optionsResponse, inventoryResponse] = await Promise.all([apiGet('/api/job-cards'), apiGet('/api/job-cards/options'), apiGet('/api/inventory')])
      if (!cardsResponse.ok || !optionsResponse.ok) throw new Error('Unable to load workshop job cards')
      const [cardsData, options, inventory] = await Promise.all([cardsResponse.json(), optionsResponse.json(), inventoryResponse.ok ? inventoryResponse.json() : Promise.resolve({ items: [] })])
      setCards(cardsData.jobCards || [])
      setActivitySummary(cardsData.activitySummary || { oil: { total: 0 }, tires: { total: 0 }, spareParts: { total: 0 }, total: 0 })
      setCompany(cardsData.company || null)
      setInventoryItems(inventory.items || [])
      setTrucks((options.trucks || []).map((truck: any) => ({ id: truck.id, label: `${truck.licensePlate} · ${truck.year} ${truck.make} ${truck.model}`, driverName: truck.driverName, mileage: truck.currentMileage })))
      setTrailers((options.trailers || []).map((trailer: any) => ({ id: trailer.id, label: `Trailer ${trailer.number}`, driverName: trailer.driverName })))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load job cards')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const vehicleLabel = (card: JobCard) => card.truck
    ? `${card.truck.licensePlate} · ${card.truck.year} ${card.truck.make} ${card.truck.model}`
    : card.trailer ? `Trailer ${card.trailer.number}` : `Unassigned · ${card.notes?.match(/Original workbook vehicle number: ([^.]+)/)?.[1] || 'vehicle review required'}`

  const startNew = () => { setEditingId(null); setForm(blankForm()); setOpen(true) }
  const startEdit = (card: JobCard) => {
    setEditingId(card.id)
    setForm({
      vehicleType: card.trailerId ? 'trailer' : 'truck', vehicleId: card.truckId || card.trailerId || '',
      serviceDate: new Date(card.serviceDate).toISOString().slice(0, 10), odometerKm: card.odometerKm?.toString() || '',
      serviceType: card.serviceType || '', reportedIssue: card.reportedIssue || '', technicianName: card.technicianName || '',
      driverName: card.driverName || '', status: card.status || 'OPEN', priority: card.priority || 'NORMAL', nextServiceOdometer: card.nextServiceOdometer?.toString() || '',
      nextServiceDate: card.nextServiceDate ? new Date(card.nextServiceDate).toISOString().slice(0, 10) : '', partsCost: card.partsCost?.toString() || '', laborCost: card.laborCost?.toString() || '', notes: card.notes || '',
      items: Array.isArray(card.items) ? card.items : [], checklist: card.checklist || {},
      technicianSignature: card.technicianSignature || '', supervisorSignature: card.supervisorSignature || '', driverSignature: card.driverSignature || ''
    })
    setOpen(true)
  }

  const changeVehicle = (id: string) => {
    const selected = vehicles.find(vehicle => vehicle.id === id)
    setForm(current => ({ ...current, vehicleId: id, driverName: selected?.driverName || current.driverName, odometerKm: selected?.mileage?.toString() || current.odometerKm }))
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.vehicleId) { toast.error('Select a truck or trailer'); return }
    setSaving(true)
    const payload = { ...form, truckId: form.vehicleType === 'truck' ? form.vehicleId : null, trailerId: form.vehicleType === 'trailer' ? form.vehicleId : null }
    try {
      const response = editingId ? await apiPut(`/api/job-cards/${editingId}`, payload) : await apiPost('/api/job-cards', payload)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to save job card')
      toast.success(editingId ? 'Job card updated' : data.reusedExisting ? `Added work to existing job card ${data.jobCard.jobNumber}` : `Job card ${data.jobCard.jobNumber} created`)
      setOpen(false)
      await load()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save job card') }
    finally { setSaving(false) }
  }

  const renderCardDocument = async (card: JobCard) => {
    const response = await apiGet(`/api/job-cards/${encodeURIComponent(card.id)}/share-link`)
    const data = await response.json()
    if (!response.ok || !data.shareUrl) throw new Error(data.error || 'Unable to create a job-card share link')
    return renderJobCardDocument(card, company, data.shareUrl, window.location.origin)
  }
  const viewCardPdf = async (card: JobCard) => {
    setPdfPreviewTitle(`${card.jobNumber} · Job Card`)
    setPdfPreviewOpen(true)
    setPdfPreviewLoading(true)
    setPdfPreviewError(null)
    setPdfPreviewUrl(null)
    try {
      const documentHtml = await renderCardDocument(card)
      const blob = await createJobCardPdfBlob(documentHtml)
      const url = URL.createObjectURL(blob)
      setPdfPreviewUrl(url)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to prepare the job-card PDF'
      setPdfPreviewError(message)
      toast.error(message)
    } finally {
      setPdfPreviewLoading(false)
    }
  }

  const downloadCard = async (card: JobCard) => {
    setDownloadingId(card.id)
    try {
      await downloadJobCardPdf(await renderCardDocument(card), `${String(card.jobNumber || 'job-card').replace(/[^a-z0-9-_]/gi, '_')}.pdf`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to download the job card PDF')
    } finally {
      setDownloadingId(null)
    }
  }

  const addItem = () => setForm(current => ({ ...current, items: [...current.items, { type: 'PART', description: '', quantity: 1, remarks: '' }] }))
  const updateItem = (index: number, key: keyof LineItem, value: string | number) => setForm(current => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }))
  const statusLabel = (status: string) => (status === 'CLOSED' ? 'COMPLETED' : status).replace(/_/g, ' ')
  const normalizedSearch = searchQuery.trim().toLocaleLowerCase()
  const searchedCards = normalizedSearch ? cards.filter(card => {
    const searchable = [
      card.jobNumber, card.serviceDate, vehicleLabel(card), card.serviceType,
      card.technicianName, card.driverName, card.status, card.priority,
      card.reportedIssue, card.notes
    ].filter(Boolean).join(' ').toLocaleLowerCase()
    return searchable.includes(normalizedSearch)
  }) : cards
  const filteredCards = statusFilter === 'ALL' ? searchedCards : searchedCards.filter(card => statusFilter === 'COMPLETED' ? ['COMPLETED', 'CLOSED'].includes(card.status) : card.status === statusFilter)
  const creationSummary = { manual: cards.filter(card => card.creationSource === 'MANUAL').length, workbook: cards.filter(card => card.creationSource === 'WORKBOOK').length, unknown: cards.filter(card => !card.creationSource || card.creationSource === 'UNKNOWN').length }
  const summary = { total: cards.length, open: cards.filter(card => card.status === 'OPEN').length, inProgress: cards.filter(card => card.status === 'IN_PROGRESS').length, completed: cards.filter(card => ['COMPLETED', 'CLOSED'].includes(card.status)).length, cancelled: cards.filter(card => card.status === 'CANCELLED').length, other: cards.filter(card => !['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'].includes(card.status)).length }

  useEffect(() => {
    const handleFleetDataChanged = () => { void load() }
    window.addEventListener('fleet:data-changed', handleFleetDataChanged)
    return () => window.removeEventListener('fleet:data-changed', handleFleetDataChanged)
  }, [])

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-12 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><FileText className="h-4 w-4"/> Workshop operations</div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Job Card Control Center</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">One maintenance visit, one central job card. Oil changes, tire work and spare-parts issues stay in their own workspaces and link back here automatically.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="bg-background/70">Live register</Badge>
            <Badge variant="outline" className="bg-background/70">Separate module activity totals</Badge>
            <Badge variant="outline" className="bg-background/70">Bilingual A4 report</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading}><Loader2 className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>Refresh</Button>
          {canCreate('maintenance') && <Button onClick={startNew} className="shadow-sm"><Plus className="mr-2 h-4 w-4"/>New Job Card</Button>}
        </div>
      </div>
    </section>

    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {[
        {label:'All job cards',value:summary.total,detail:'Total register',tone:'border-l-primary'},
        {label:'Open',value:summary.open,detail:'Awaiting work',tone:'border-l-sky-500'},
        {label:'In progress',value:summary.inProgress,detail:'Workshop active',tone:'border-l-amber-500'},
        {label:'Completed',value:summary.completed,detail:'Closed / completed',tone:'border-l-emerald-500'},
        {label:'Cancelled',value:summary.cancelled,detail:'Cancelled records',tone:'border-l-muted-foreground'},
        {label:'Other status',value:summary.other,detail:'Needs classification',tone:'border-l-violet-500'}
      ].map(item => <Card key={item.label} className={`border-l-4 ${item.tone} shadow-sm`}><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-1 text-3xl font-bold tabular-nums">{item.value}</p><p className="mt-1 text-[11px] text-muted-foreground">{item.detail}</p></CardContent></Card>)}
    </section>

    <Card className="shadow-sm">
      <CardHeader className="pb-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><CardTitle className="text-base">Job Cards Created By Source</CardTitle><CardDescription className="mt-1">Counts show which workflow originally created each card. Reusing an open card does not increase the count.</CardDescription></div><Badge variant="secondary">{summary.total} total cards</Badge></div></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          {label:'Manual Job Cards',value:creationSummary.manual,sub:'Created in Job Cards',icon:'✍️'},
          {label:'Job Card workbook',value:creationSummary.workbook,sub:'Imported Job Card register',icon:'▤'},
          {label:'Unknown / historical',value:creationSummary.unknown,sub:'Source not recorded',icon:'?'}
        ].map(item => <div key={item.label} className="rounded-xl border bg-muted/20 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-muted-foreground">{item.label}</span><span className="text-sm opacity-70">{item.icon}</span></div><p className="mt-2 text-2xl font-bold tabular-nums">{item.value}</p><p className="text-[11px] text-muted-foreground">{item.sub}</p></div>)}
      </CardContent>
    </Card>

    <Card className="shadow-sm">
      <CardHeader className="pb-3"><div><CardTitle className="text-base">Activity Totals · Separate Modules</CardTitle><CardDescription className="mt-1">Read-only quantities from Oil Changes, Tire Management and Spare Parts. These records stay separate and never create or attach to Job Cards.</CardDescription></div></CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {label:'Oil changes',total:activitySummary.oil.total},
          {label:'Tire events',total:activitySummary.tires.total},
          {label:'Spare-parts issues',total:activitySummary.spareParts.total},
          {label:'All module activities',total:activitySummary.total}
        ].map(item => <div key={item.label} className="rounded-xl border bg-muted/20 p-3"><p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{item.total}</p><p className="mt-1 text-[11px] text-muted-foreground">Managed separately</p></div>)}
      </CardContent>
    </Card>

    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="border-b bg-muted/20 pb-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><CardTitle className="text-base">Workshop Job Card Register</CardTitle><CardDescription className="mt-1">{filteredCards.length} shown · {cards.length} saved job cards</CardDescription></div><div className="relative w-full lg:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search job no., plate, service, driver…" aria-label="Search job cards" className="bg-background pl-9"/></div></div>
        <div className="flex flex-wrap gap-2 pt-3">
          {[
            ['ALL','All',summary.total],['OPEN','Open',summary.open],['IN_PROGRESS','In progress',summary.inProgress],['COMPLETED','Completed',summary.completed],['CANCELLED','Cancelled',summary.cancelled]
          ].map(([value,label,count]) => <Button key={value} type="button" size="sm" variant={statusFilter===value?'default':'outline'} onClick={()=>setStatusFilter(String(value))} className="h-8 rounded-full">{label}<span className="ml-2 rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">{count}</span></Button>)}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin"/>Loading job cards…</div> : cards.length===0 ? <div className="py-14 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground"/><p className="font-semibold">No job cards yet</p><p className="mt-1 text-sm text-muted-foreground">Create a job card when a vehicle arrives for workshop service.</p></div> : filteredCards.length===0 ? <div className="py-14 text-center"><Search className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/><p className="font-semibold">No matching job cards</p><p className="mt-1 text-sm text-muted-foreground">Change the search or status filter and try again.</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-muted/30"><TableHead className="whitespace-nowrap">Job number</TableHead><TableHead className="whitespace-nowrap">Service date</TableHead><TableHead>Vehicle</TableHead><TableHead>Work type</TableHead><TableHead>Technician / Driver</TableHead><TableHead>Job Card lines</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredCards.map(card => <TableRow key={card.id} className="group"><TableCell><div className="font-semibold text-primary">{card.jobNumber}</div><div className="mt-1 text-[11px] text-muted-foreground">{card.priority || 'NORMAL'} priority</div></TableCell><TableCell className="whitespace-nowrap text-sm">{dateText(card.serviceDate)}</TableCell><TableCell className="min-w-[180px]"><div className="font-medium">{vehicleLabel(card)}</div><div className="mt-1 text-xs text-muted-foreground">{card.odometerKm ? `${Number(card.odometerKm).toLocaleString()} km` : 'Odometer not recorded'}</div></TableCell><TableCell className="min-w-[140px]"><div className="font-medium">{card.serviceType || 'General service'}</div><div className="mt-1 text-xs text-muted-foreground">{card.reportedIssue || 'No complaint recorded'}</div></TableCell><TableCell className="min-w-[130px]"><div>{card.technicianName || 'Technician pending'}</div><div className="mt-1 text-xs text-muted-foreground">{card.driverName || 'Driver not recorded'}</div></TableCell><TableCell><span className="text-sm tabular-nums">{Array.isArray(card.items) ? card.items.length : 0} lines</span></TableCell><TableCell><Badge variant={['COMPLETED','CLOSED'].includes(card.status)?'default':card.status==='CANCELLED'?'destructive':'secondary'}>{statusLabel(card.status)}</Badge></TableCell><TableCell><div className="flex justify-end gap-0.5"><Button size="icon" variant="ghost" title="View / print PDF" aria-label={`View PDF for ${card.jobNumber}`} onClick={()=>viewCardPdf(card)}><Eye className="h-4 w-4"/></Button><Button size="icon" variant="ghost" title="Download PDF" aria-label={`Download PDF for ${card.jobNumber}`} disabled={downloadingId===card.id} onClick={()=>downloadCard(card)}><Download className="h-4 w-4"/></Button><Button size="icon" variant="ghost" hidden={!canUpdate('maintenance')} title="Edit job card" aria-label={`Edit job card ${card.jobNumber}`} onClick={()=>startEdit(card)}><Pencil className="h-4 w-4"/></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
      </CardContent>
    </Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{editingId ? 'Edit Workshop Job Card' : 'New Workshop Job Card'}</DialogTitle><DialogDescription><LocalizedText>Bilingual A4 form · بيانات أمر الشغل</LocalizedText></DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-5">
        <section className="space-y-3"><h3 className="border-b pb-2 font-semibold"><LocalizedText>Vehicle & Job Details · بيانات المركبة والعمل</LocalizedText></h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label><LocalizedText>Vehicle Type · نوع المركبة</LocalizedText></Label><Select value={form.vehicleType} onValueChange={value => setForm(current => ({ ...current, vehicleType: value as VehicleType, vehicleId: '' }))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="truck"><LocalizedText>Truck · شاحنة</LocalizedText></SelectItem><SelectItem value="trailer"><LocalizedText>Trailer · مقطورة</LocalizedText></SelectItem></SelectContent></Select></div>
          <div className="space-y-1 sm:col-span-2"><Label><LocalizedText>Truck / Trailer · المركبة</LocalizedText></Label><Select value={form.vehicleId} onValueChange={changeVehicle}><SelectTrigger><SelectValue placeholder="Select a vehicle"/></SelectTrigger><SelectContent>{vehicles.map(vehicle => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.label}</SelectItem>)}</SelectContent></Select>{vehicles.length === 0 && <p className="text-xs text-amber-700">No active {form.vehicleType}s are available.</p>}</div>
          <div className="space-y-1"><Label><LocalizedText>Service Date · التاريخ</LocalizedText></Label><Input type="date" required value={form.serviceDate} onChange={e => setForm({ ...form, serviceDate: e.target.value })}/></div>
          <div className="space-y-1"><Label><LocalizedText>Odometer (km) · العداد</LocalizedText></Label><Input type="number" min="0" value={form.odometerKm} onChange={e => setForm({ ...form, odometerKm: e.target.value })}/></div>
          <div className="space-y-1"><Label><LocalizedText>Service Type · نوع الصيانة</LocalizedText></Label><Input required value={form.serviceType} placeholder="Preventive maintenance, repair…" onChange={e => setForm(current => ({ ...current, serviceType: e.target.value }))}/></div>
          <div className="space-y-1"><Label><LocalizedText>Status · الحالة</LocalizedText></Label><Select value={form.status} onValueChange={status => setForm({ ...form, status })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="OPEN"><LocalizedText>Open</LocalizedText></SelectItem><SelectItem value="IN_PROGRESS"><LocalizedText>In Progress</LocalizedText></SelectItem><SelectItem value="COMPLETED"><LocalizedText>Completed</LocalizedText></SelectItem><SelectItem value="CANCELLED"><LocalizedText>Cancelled</LocalizedText></SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label><LocalizedText>Priority · الأولوية</LocalizedText></Label><Select value={form.priority} onValueChange={priority => setForm({ ...form, priority })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="LOW"><LocalizedText>Low</LocalizedText></SelectItem><SelectItem value="NORMAL"><LocalizedText>Normal</LocalizedText></SelectItem><SelectItem value="HIGH"><LocalizedText>High</LocalizedText></SelectItem><SelectItem value="URGENT"><LocalizedText>Urgent</LocalizedText></SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label><LocalizedText>Technician · الفني</LocalizedText></Label><Input value={form.technicianName} onChange={e => setForm({ ...form, technicianName: e.target.value })}/></div><div className="space-y-1"><Label><LocalizedText>Driver · السائق</LocalizedText></Label><Input value={form.driverName} onChange={e => setForm({ ...form, driverName: e.target.value })}/></div>
        </div><div className="space-y-1"><Label><LocalizedText>Reported Issue / Complaint · الشكوى</LocalizedText></Label><Textarea rows={2} value={form.reportedIssue} onChange={e => setForm({ ...form, reportedIssue: e.target.value })}/></div></section>

        <section className="space-y-3"><div className="flex items-center justify-between border-b pb-2"><h3 className="font-semibold"><LocalizedText>Work Performed & Spare Parts · الأعمال وقطع الغيار</LocalizedText></h3><Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="mr-1 h-4 w-4"/>Add line</Button></div>{form.items.length === 0 ? <p className="text-sm text-muted-foreground"><LocalizedText>Add work or parts lines as needed.</LocalizedText></p> : <div className="space-y-2">{form.items.map((item, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_90px_1.5fr_40px] sm:items-end"><div className="space-y-1"><Label><LocalizedText>Type</LocalizedText></Label><Select value={item.type} onValueChange={value => updateItem(index, 'type', value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="LABOUR"><LocalizedText>Labour</LocalizedText></SelectItem><SelectItem value="PART"><LocalizedText>Part</LocalizedText></SelectItem><SelectItem value="OTHER"><LocalizedText>Other</LocalizedText></SelectItem></SelectContent></Select></div><div className="space-y-1"><Label><LocalizedText>Description · الوصف</LocalizedText></Label>{item.type === 'PART' ? <Select value={item.inventoryItemId || 'manual'} onValueChange={value => { const selected = inventoryItems.find(part => part.id === value); setForm(current => ({ ...current, items: current.items.map((line, i) => i === index ? { ...line, inventoryItemId: value === 'manual' ? null : value, description: selected ? selected.name : line.description } : line) })) }}><SelectTrigger><SelectValue placeholder="Select inventory part (optional)"/></SelectTrigger><SelectContent><SelectItem value="manual">Manual part / no stock tracking</SelectItem>{inventoryItems.map(part => <SelectItem key={part.id} value={part.id}>{part.name}{part.partNumber ? ` · ${part.partNumber}` : ''} — {Number(part.stockQty).toFixed(2)} {part.unit}</SelectItem>)}</SelectContent></Select> : null}<Input value={item.description} placeholder="Description" onChange={e => updateItem(index, 'description', e.target.value)}/></div><div className="space-y-1"><Label><LocalizedText>Qty</LocalizedText></Label><Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))}/></div><div className="space-y-1"><Label><LocalizedText>Remarks · ملاحظات</LocalizedText></Label><Input value={item.remarks} onChange={e => updateItem(index, 'remarks', e.target.value)}/></div><Button type="button" variant="ghost" size="icon" aria-label="Remove item" onClick={() => setForm(current => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</div>}</section>

        <section className="space-y-3"><h3 className="border-b pb-2 font-semibold"><LocalizedText>Maintenance Checklist · قائمة الفحص</LocalizedText></h3><div className="grid gap-2 sm:grid-cols-2">{checklistItems.map(([key, en, ar]) => <div key={key} className="grid grid-cols-[1fr_120px] items-center gap-2 rounded border p-2"><span className="text-sm">{en}<span className="ml-1 text-xs text-muted-foreground" dir="rtl">{ar}</span></span><Select value={form.checklist[key] || 'UNSET'} onValueChange={value => setForm(current => ({ ...current, checklist: { ...current.checklist, [key]: value === 'UNSET' ? '' : value } }))}><SelectTrigger className="h-8"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="UNSET"><LocalizedText>Not checked</LocalizedText></SelectItem><SelectItem value="OK"><LocalizedText>OK</LocalizedText></SelectItem><SelectItem value="REPAIR"><LocalizedText>Repair</LocalizedText></SelectItem><SelectItem value="NA"><LocalizedText>N/A</LocalizedText></SelectItem></SelectContent></Select></div>)}</div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label><LocalizedText>Parts Cost</LocalizedText></Label><Input type="number" min="0" step="0.01" value={form.partsCost} onChange={e => setForm({ ...form, partsCost: e.target.value })}/></div><div className="space-y-1"><Label><LocalizedText>Labour Cost</LocalizedText></Label><Input type="number" min="0" step="0.01" value={form.laborCost} onChange={e => setForm({ ...form, laborCost: e.target.value })}/></div></div><div className="space-y-1"><Label><LocalizedText>Notes · ملاحظات</LocalizedText></Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></div></section>

        <section className="space-y-3"><h3 className="border-b pb-2 font-semibold"><LocalizedText>Next Service & Approval · الصيانة القادمة والاعتماد</LocalizedText></h3><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label><LocalizedText>Next Service (km) · العداد القادم</LocalizedText></Label><Input type="number" min="0" placeholder={form.odometerKm ? String(Number(form.odometerKm) + 5000) : 'Odometer + 5,000 km'} value={form.nextServiceOdometer} onChange={e => setForm({ ...form, nextServiceOdometer: e.target.value })}/></div><div className="space-y-1"><Label><LocalizedText>Next Service Date · التاريخ القادم</LocalizedText></Label><Input type="date" value={form.nextServiceDate} onChange={e => setForm({ ...form, nextServiceDate: e.target.value })}/></div>{([['technicianSignature','Technician Signature · توقيع الفني'],['supervisorSignature','Supervisor Signature · توقيع المشرف'],['driverSignature','Driver / Customer Signature · توقيع السائق']] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label>{label}</Label><Input value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value } as JobForm))}/></div>)}</div></section>
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving || (editingId ? !canUpdate('maintenance') : !canCreate('maintenance'))}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Job Card'}</Button></div>
      </form>
    </DialogContent></Dialog>
    <PdfPreviewDialog
      open={pdfPreviewOpen}
      onOpenChange={setPdfPreviewOpen}
      title={pdfPreviewTitle}
      url={pdfPreviewUrl}
      loading={pdfPreviewLoading}
      error={pdfPreviewError}
      downloadName={`${pdfPreviewTitle.replace(/[^a-z0-9-_]+/gi, '_')}.pdf`}
    />
  </div>
}
