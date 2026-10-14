'use client'

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
import { toast } from 'sonner'
import { FileText, Plus, Printer, Download, Pencil, Trash2 } from 'lucide-react'
import { renderJobCardDocument } from '@/lib/job-card-document'

type VehicleType = 'truck' | 'trailer'
type LineItem = { type: string; description: string; quantity: number; remarks: string }
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
  const [cards, setCards] = useState<JobCard[]>([])
  const [company, setCompany] = useState<Company | null>(null)
  const [trucks, setTrucks] = useState<Vehicle[]>([])
  const [trailers, setTrailers] = useState<Vehicle[]>([])
  const [form, setForm] = useState<JobForm>(blankForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const vehicles = form.vehicleType === 'truck' ? trucks : trailers

  const load = async () => {
    try {
      const [cardsResponse, optionsResponse] = await Promise.all([apiGet('/api/job-cards'), apiGet('/api/job-cards/options')])
      if (!cardsResponse.ok || !optionsResponse.ok) throw new Error('Unable to load workshop job cards')
      const [cardsData, options] = await Promise.all([cardsResponse.json(), optionsResponse.json()])
      setCards(cardsData.jobCards || [])
      setCompany(cardsData.company || null)
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
  const fitCardToPage = (targetDocument: Document, targetWidth: string, maxHeightPx: number) => {
    const page = targetDocument.querySelector<HTMLElement>('.print-page')
    if (!page) throw new Error('Unable to render the job card')
    page.style.zoom = '1'
    page.style.width = targetWidth
    page.style.maxWidth = targetWidth
    page.style.height = 'auto'
    const contentHeight = page.scrollHeight
    page.style.zoom = String(Math.min(1, maxHeightPx / contentHeight))
  }

  const printCard = async (card: JobCard) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=900')
    if (!printWindow) { toast.error('Allow pop-ups to print the job card'); return }
    try {
      printWindow.document.write(await renderCardDocument(card))
      printWindow.document.close()
      printWindow.onbeforeprint = () => fitCardToPage(printWindow.document, '197.3mm', 1080)
      printWindow.onload = () => setTimeout(() => printWindow.print(), 150)
    } catch (error) {
      printWindow.close()
      toast.error(error instanceof Error ? error.message : 'Unable to prepare the job card')
    }
  }

  const downloadCard = async (card: JobCard) => {
    setDownloadingId(card.id)
    let frame: HTMLIFrameElement | null = null
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      frame = document.createElement('iframe')
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:744px;height:1052px;border:0;background:#fff'
      document.body.appendChild(frame)
      const frameDocument = frame.contentDocument
      if (!frameDocument) throw new Error('Unable to prepare the PDF document')
      frameDocument.open()
      frameDocument.write(await renderCardDocument(card))
      frameDocument.close()
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Timed out loading the job card for PDF')), 10000)
        frame!.onload = () => { window.clearTimeout(timer); resolve() }
      })
      const logo = frameDocument.querySelector<HTMLImageElement>('.logo-wrap img')
      if (logo && !logo.complete) await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve()
        logo.onerror = () => reject(new Error('Unable to load the company logo for PDF'))
      })
      const page = frameDocument.querySelector<HTMLElement>('.print-page')
      if (!page) throw new Error('Unable to render the job card')
      const renderWidth = 744
      const renderHeight = 1080
      page.style.zoom = '1'
      page.style.width = `${renderWidth}px`
      page.style.maxWidth = `${renderWidth}px`
      page.style.margin = '0 auto'
      frameDocument.documentElement.style.width = `${renderWidth}px`
      frameDocument.body.style.width = `${renderWidth}px`
      frameDocument.body.style.minHeight = `${renderHeight}px`
      fitCardToPage(frameDocument, renderWidth + 'px', renderHeight)
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: renderWidth, windowHeight: Math.max(renderHeight, page.scrollHeight) })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
      const pageWidth = 210
      const pageHeight = 297
      const pageMargin = 5
      const scaleToFit = Math.min((pageWidth - pageMargin * 2) / canvas.width, (pageHeight - pageMargin * 2) / canvas.height)
      const imageWidth = canvas.width * scaleToFit
      const imageHeight = canvas.height * scaleToFit
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - imageWidth) / 2, (pageHeight - imageHeight) / 2, imageWidth, imageHeight)
      pdf.save(`${String(card.jobNumber || 'job-card').replace(/[^a-z0-9-_]/gi, '_')}.pdf`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to download the job card PDF')
    } finally {
      frame?.remove()
      setDownloadingId(null)
    }
  }

  const addItem = () => setForm(current => ({ ...current, items: [...current.items, { type: 'PART', description: '', quantity: 1, remarks: '' }] }))
  const updateItem = (index: number, key: keyof LineItem, value: string | number) => setForm(current => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }))
  const statusLabel = (status: string) => status.replace(/_/g, ' ')
  const summary = { total: cards.length, open: cards.filter(card => card.status === 'OPEN').length, inProgress: cards.filter(card => card.status === 'IN_PROGRESS').length, completed: cards.filter(card => card.status === 'COMPLETED').length }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold">Workshop Job Cards</h2><p className="text-sm text-muted-foreground">Create, track, and print the bilingual workshop form.</p></div><Button onClick={startNew}><Plus className="mr-2 h-4 w-4"/>New Job Card</Button></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Total Job Cards', summary.total], ['Open', summary.open], ['In Progress', summary.inProgress], ['Completed', summary.completed]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Job Card Register</CardTitle><CardDescription>{cards.length} saved job cards</CardDescription></CardHeader><CardContent>
       {loading ? <p className="py-8 text-center text-muted-foreground">Loading job cards…</p> : cards.length === 0 ? <div className="py-10 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground"/><p className="font-medium">No job cards yet</p><p className="text-sm text-muted-foreground">Create the first workshop job card when a vehicle arrives for service.</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Job No.</TableHead><TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Service</TableHead><TableHead>Technician</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{cards.map(card => <TableRow key={card.id}><TableCell className="font-medium">{card.jobNumber}</TableCell><TableCell>{dateText(card.serviceDate)}</TableCell><TableCell>{vehicleLabel(card)}</TableCell><TableCell>{card.serviceType}</TableCell><TableCell>{card.technicianName || '—'}</TableCell><TableCell><Badge variant={card.status === 'COMPLETED' ? 'default' : 'secondary'}>{statusLabel(card.status)}</Badge></TableCell><TableCell><div className="flex gap-1"><Button size="sm" variant="ghost" title="Print job card" aria-label={`Print job card ${card.jobNumber}`} onClick={() => printCard(card)}><Printer className="h-4 w-4"/></Button><Button size="sm" variant="ghost" title="Download PDF" aria-label={`Download PDF for ${card.jobNumber}`} disabled={downloadingId === card.id} onClick={() => downloadCard(card)}><Download className="h-4 w-4"/></Button><Button size="sm" variant="ghost" title="Edit job card" aria-label={`Edit job card ${card.jobNumber}`} onClick={() => startEdit(card)}><Pencil className="h-4 w-4"/></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
    </CardContent></Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{editingId ? 'Edit Workshop Job Card' : 'New Workshop Job Card'}</DialogTitle><DialogDescription>Bilingual A4 form · بيانات أمر الشغل</DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-5">
        <section className="space-y-3"><h3 className="border-b pb-2 font-semibold">Vehicle & Job Details · بيانات المركبة والعمل</h3><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1"><Label>Vehicle Type · نوع المركبة</Label><Select value={form.vehicleType} onValueChange={value => setForm(current => ({ ...current, vehicleType: value as VehicleType, vehicleId: '' }))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="truck">Truck · شاحنة</SelectItem><SelectItem value="trailer">Trailer · مقطورة</SelectItem></SelectContent></Select></div>
          <div className="space-y-1 sm:col-span-2"><Label>Truck / Trailer · المركبة</Label><Select value={form.vehicleId} onValueChange={changeVehicle}><SelectTrigger><SelectValue placeholder="Select a vehicle"/></SelectTrigger><SelectContent>{vehicles.map(vehicle => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.label}</SelectItem>)}</SelectContent></Select>{vehicles.length === 0 && <p className="text-xs text-amber-700">No active {form.vehicleType}s are available.</p>}</div>
          <div className="space-y-1"><Label>Service Date · التاريخ</Label><Input type="date" required value={form.serviceDate} onChange={e => setForm({ ...form, serviceDate: e.target.value })}/></div>
          <div className="space-y-1"><Label>Odometer (km) · العداد</Label><Input type="number" min="0" value={form.odometerKm} onChange={e => setForm({ ...form, odometerKm: e.target.value })}/></div>
          <div className="space-y-1"><Label>Service Type · نوع الصيانة</Label><Input required value={form.serviceType} placeholder="Preventive maintenance, repair…" onChange={e => setForm({ ...form, serviceType: e.target.value })}/></div>
          <div className="space-y-1"><Label>Status · الحالة</Label><Select value={form.status} onValueChange={status => setForm({ ...form, status })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="OPEN">Open</SelectItem><SelectItem value="IN_PROGRESS">In Progress</SelectItem><SelectItem value="COMPLETED">Completed</SelectItem><SelectItem value="CANCELLED">Cancelled</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>Priority · الأولوية</Label><Select value={form.priority} onValueChange={priority => setForm({ ...form, priority })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="LOW">Low</SelectItem><SelectItem value="NORMAL">Normal</SelectItem><SelectItem value="HIGH">High</SelectItem><SelectItem value="URGENT">Urgent</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>Technician · الفني</Label><Input value={form.technicianName} onChange={e => setForm({ ...form, technicianName: e.target.value })}/></div><div className="space-y-1"><Label>Driver · السائق</Label><Input value={form.driverName} onChange={e => setForm({ ...form, driverName: e.target.value })}/></div>
        </div><div className="space-y-1"><Label>Reported Issue / Complaint · الشكوى</Label><Textarea rows={2} value={form.reportedIssue} onChange={e => setForm({ ...form, reportedIssue: e.target.value })}/></div></section>

        <section className="space-y-3"><div className="flex items-center justify-between border-b pb-2"><h3 className="font-semibold">Work Performed & Spare Parts · الأعمال وقطع الغيار</h3><Button type="button" size="sm" variant="outline" onClick={addItem}><Plus className="mr-1 h-4 w-4"/>Add line</Button></div>{form.items.length === 0 ? <p className="text-sm text-muted-foreground">Add work or parts lines as needed.</p> : <div className="space-y-2">{form.items.map((item, index) => <div key={index} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_2fr_90px_1.5fr_40px] sm:items-end"><div className="space-y-1"><Label>Type</Label><Select value={item.type} onValueChange={value => updateItem(index, 'type', value)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="LABOUR">Labour</SelectItem><SelectItem value="PART">Part</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Description · الوصف</Label><Input value={item.description} onChange={e => updateItem(index, 'description', e.target.value)}/></div><div className="space-y-1"><Label>Qty</Label><Input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(index, 'quantity', Number(e.target.value))}/></div><div className="space-y-1"><Label>Remarks · ملاحظات</Label><Input value={item.remarks} onChange={e => updateItem(index, 'remarks', e.target.value)}/></div><Button type="button" variant="ghost" size="icon" aria-label="Remove item" onClick={() => setForm(current => ({ ...current, items: current.items.filter((_, i) => i !== index) }))}><Trash2 className="h-4 w-4 text-destructive"/></Button></div>)}</div>}</section>

        <section className="space-y-3"><h3 className="border-b pb-2 font-semibold">Maintenance Checklist · قائمة الفحص</h3><div className="grid gap-2 sm:grid-cols-2">{checklistItems.map(([key, en, ar]) => <div key={key} className="grid grid-cols-[1fr_120px] items-center gap-2 rounded border p-2"><span className="text-sm">{en}<span className="ml-1 text-xs text-muted-foreground" dir="rtl">{ar}</span></span><Select value={form.checklist[key] || 'UNSET'} onValueChange={value => setForm(current => ({ ...current, checklist: { ...current.checklist, [key]: value === 'UNSET' ? '' : value } }))}><SelectTrigger className="h-8"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="UNSET">Not checked</SelectItem><SelectItem value="OK">OK</SelectItem><SelectItem value="REPAIR">Repair</SelectItem><SelectItem value="NA">N/A</SelectItem></SelectContent></Select></div>)}</div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Parts Cost</Label><Input type="number" min="0" step="0.01" value={form.partsCost} onChange={e => setForm({ ...form, partsCost: e.target.value })}/></div><div className="space-y-1"><Label>Labour Cost</Label><Input type="number" min="0" step="0.01" value={form.laborCost} onChange={e => setForm({ ...form, laborCost: e.target.value })}/></div></div><div className="space-y-1"><Label>Notes · ملاحظات</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></div></section>

        <section className="space-y-3"><h3 className="border-b pb-2 font-semibold">Next Service & Approval · الصيانة القادمة والاعتماد</h3><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Next Service (km) · العداد القادم</Label><Input type="number" min="0" placeholder={form.odometerKm ? String(Number(form.odometerKm) + 5000) : 'Odometer + 5,000 km'} value={form.nextServiceOdometer} onChange={e => setForm({ ...form, nextServiceOdometer: e.target.value })}/></div><div className="space-y-1"><Label>Next Service Date · التاريخ القادم</Label><Input type="date" value={form.nextServiceDate} onChange={e => setForm({ ...form, nextServiceDate: e.target.value })}/></div>{([['technicianSignature','Technician Signature · توقيع الفني'],['supervisorSignature','Supervisor Signature · توقيع المشرف'],['driverSignature','Driver / Customer Signature · توقيع السائق']] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label>{label}</Label><Input value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value } as JobForm))}/></div>)}</div></section>
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Job Card'}</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>
}
