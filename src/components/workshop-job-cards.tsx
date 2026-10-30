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
import { FileText, Plus, Printer, Download, Pencil, Trash2, Eye } from 'lucide-react'
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
    : `Trailer ${card.trailer?.number || ''}`

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
      toast.success(editingId ? 'Job card updated' : `Job card ${data.jobCard.jobNumber} created`)
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
  const statusLabel = (status: string) => status.replace(/_/g, ' ')
  const summary = { total: cards.length, open: cards.filter(card => card.status === 'OPEN').length, inProgress: cards.filter(card => card.status === 'IN_PROGRESS').length, completed: cards.filter(card => card.status === 'COMPLETED').length }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold"><LocalizedText>Workshop Job Cards</LocalizedText></h2><p className="text-sm text-muted-foreground"><LocalizedText>Create, track, and print the bilingual workshop form.</LocalizedText></p></div>{canCreate('maintenance') && <Button onClick={startNew}><Plus className="mr-2 h-4 w-4"/>New Job Card</Button>}</div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Total Job Cards', summary.total], ['Open', summary.open], ['In Progress', summary.inProgress], ['Completed', summary.completed]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle><LocalizedText>Job Card Register</LocalizedText></CardTitle><CardDescription>{cards.length} saved job cards</CardDescription></CardHeader><CardContent>
       {loading ? <p className="py-8 text-center text-muted-foreground"><LocalizedText>Loading job cards…</LocalizedText></p> : cards.length === 0 ? <div className="py-10 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground"/><p className="font-medium"><LocalizedText>No job cards yet</LocalizedText></p><p className="text-sm text-muted-foreground"><LocalizedText>Create the first workshop job card when a vehicle arrives for service.</LocalizedText></p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead><LocalizedText>Job No.</LocalizedText></TableHead><TableHead><LocalizedText>Date</LocalizedText></TableHead><TableHead><LocalizedText>Vehicle</LocalizedText></TableHead><TableHead><LocalizedText>Service</LocalizedText></TableHead><TableHead><LocalizedText>Technician</LocalizedText></TableHead><TableHead><LocalizedText>Status</LocalizedText></TableHead><TableHead><LocalizedText>Actions</LocalizedText></TableHead></TableRow></TableHeader><TableBody>{cards.map(card => <TableRow key={card.id}><TableCell className="font-medium">{card.jobNumber}</TableCell><TableCell>{dateText(card.serviceDate)}</TableCell><TableCell>{vehicleLabel(card)}</TableCell><TableCell>{card.serviceType}</TableCell><TableCell>{card.technicianName || '—'}</TableCell><TableCell><Badge variant={card.status === 'COMPLETED' ? 'default' : 'secondary'}>{statusLabel(card.status)}</Badge></TableCell><TableCell><div className="flex gap-1"><Button size="sm" variant="ghost" title="View PDF in browser" aria-label={`View PDF for ${card.jobNumber}`} onClick={() => viewCardPdf(card)}><Eye className="h-4 w-4"/></Button><Button size="sm" variant="ghost" title="Preview and print job card" aria-label={`Preview and print job card ${card.jobNumber}`} onClick={() => viewCardPdf(card)}><Printer className="h-4 w-4"/></Button><Button size="sm" variant="ghost" title="Download PDF" aria-label={`Download PDF for ${card.jobNumber}`} disabled={downloadingId === card.id} onClick={() => downloadCard(card)}><Download className="h-4 w-4"/></Button><Button size="sm" variant="ghost" hidden={!canUpdate('maintenance')} title="Edit job card" aria-label={`Edit job card ${card.jobNumber}`} onClick={() => startEdit(card)}><Pencil className="h-4 w-4"/></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
    </CardContent></Card>

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
