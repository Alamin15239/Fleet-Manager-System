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
import { FileText, Plus, Printer, Pencil, Trash2 } from 'lucide-react'

type VehicleType = 'truck' | 'trailer'
type LineItem = { type: string; description: string; quantity: number; remarks: string }
type JobForm = {
  vehicleType: VehicleType; vehicleId: string; serviceDate: string; odometerKm: string; serviceType: string;
  reportedIssue: string; technicianName: string; driverName: string; status: string; priority: string; nextServiceOdometer: string;
  nextServiceDate: string; notes: string; items: LineItem[]; checklist: Record<string, string>;
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
  reportedIssue: '', technicianName: '', driverName: '', status: 'OPEN', priority: 'NORMAL', nextServiceOdometer: '', nextServiceDate: '',
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
      nextServiceDate: card.nextServiceDate ? new Date(card.nextServiceDate).toISOString().slice(0, 10) : '', notes: card.notes || '',
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

  const printCard = (card: JobCard) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=900')
    if (!printWindow) { toast.error('Allow pop-ups to print the job card'); return }
    const items = Array.isArray(card.items) ? card.items : []
    const checks = card.checklist || {}
    const checksHtml = checklistItems.map(([key, en, ar]) => `<tr><td>${en}<br><span dir="rtl">${ar}</span></td><td class="center">${esc(checks[key] === 'OK' ? '✓ OK' : checks[key] === 'REPAIR' ? 'Repair' : checks[key] === 'NA' ? 'N/A' : '—')}</td></tr>`).join('')
    const itemHtml = items.length ? items.map((item: LineItem) => `<tr><td>${esc(item.type)}</td><td>${esc(item.description)}</td><td class="center">${esc(item.quantity)}</td><td>${esc(item.remarks)}</td></tr>`).join('') : '<tr><td colspan="4" class="muted">No work or parts lines entered</td></tr>'
    const companyName = company?.companyName || 'Saadfreeh Transport'
    const companyContact = [company?.companyAddress, company?.companyPhone, company?.companyEmail].filter(Boolean).join(' · ')
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(card.jobNumber)} · Workshop Job Card</title><style>
      @page{size:A4 portrait;margin:11mm}*{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#172b45;margin:0}.head{border-bottom:3px solid #173d68;padding:0 0 8px;margin-bottom:10px}.brand{font-size:19px;font-weight:700;color:#173d68}.tag{color:#65758b;margin-top:3px}.title{display:flex;justify-content:space-between;align-items:center;margin-top:9px}.title h1{font-size:18px;margin:0}.title .ar{font-size:16px}h2{font-size:11px;color:#fff;background:#214f7b;padding:6px 8px;margin:9px 0 0}table{border-collapse:collapse;width:100%}td,th{border:1px solid #c8d2de;padding:5px 6px;vertical-align:top}th{background:#eef3f8;text-align:left}.fields td{height:28px}.label{font-weight:bold;color:#52657a;width:22%}.value{width:28%;white-space:pre-wrap}.center{text-align:center}.muted{color:#8793a3;text-align:center}.issue{min-height:40px;white-space:pre-wrap}.signs{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:26px}.sign{border-top:1px solid #57677b;padding-top:5px;min-height:24px}.footer{margin-top:12px;text-align:center;color:#738196;font-size:9px}.small{font-size:9px;color:#586b80}.status{border:1px solid #9fb0c4;padding:3px 8px;border-radius:10px}@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
    </style></head><body><header class="head"><div class="brand">${esc(companyName)}</div><div class="tag">Preventive Maintenance · ورشة صيانة الأسطول</div><div class="tag">${esc(companyContact)}</div><div class="title"><h1>WORKSHOP JOB CARD</h1><div class="ar" dir="rtl">أمر شغل الورشة</div></div></header>
    <table class="fields"><tr><td class="label">Job No. / رقم الأمر</td><td class="value"><b>${esc(card.jobNumber)}</b></td><td class="label">Date / التاريخ</td><td class="value">${dateText(card.serviceDate)}</td></tr><tr><td class="label">Status / الحالة</td><td class="value"><span class="status">${esc(String(card.status).replace('_',' '))}</span></td><td class="label">Priority / الأولوية</td><td class="value">${esc(card.priority || 'NORMAL')}</td></tr><tr><td class="label">Service Type / نوع الصيانة</td><td class="value" colspan="3">${esc(card.serviceType)}</td></tr></table>
    <h2>VEHICLE INFORMATION · بيانات المركبة</h2><table class="fields"><tr><td class="label">Truck / Trailer</td><td class="value">${esc(vehicleLabel(card))}</td><td class="label">Make / Model</td><td class="value">${esc(card.truck ? `${card.truck.make} ${card.truck.model}` : 'Trailer')}</td></tr><tr><td class="label">Year / VIN</td><td class="value">${esc(card.truck ? `${card.truck.year} · ${card.truck.vin || ''}` : '—')}</td><td class="label">Odometer (km) / العداد</td><td class="value">${esc(card.odometerKm ?? '—')}</td></tr><tr><td class="label">Technician / الفني</td><td class="value">${esc(card.technicianName || '—')}</td><td class="label">Driver / السائق</td><td class="value">${esc(card.driverName || '—')}</td></tr></table>
    <h2>REPORTED ISSUE · الشكوى المسجلة</h2><div class="issue" style="border:1px solid #c8d2de;padding:7px">${esc(card.reportedIssue || '—')}</div>
    <h2>WORK PERFORMED & SPARE PARTS · الأعمال المنجزة وقطع الغيار</h2><table><thead><tr><th>Item Type / النوع</th><th>Description / الوصف</th><th>Qty</th><th>Remarks / ملاحظات</th></tr></thead><tbody>${itemHtml}</tbody></table>
    <h2>MAINTENANCE CHECKLIST · قائمة الفحص الدوري</h2><table><thead><tr><th>Inspection item / بند الفحص</th><th class="center">Result / النتيجة</th></tr></thead><tbody>${checksHtml}</tbody></table><div class="small">Notes / ملاحظات: ${esc(card.notes || '—')}</div>
    <h2>NEXT SERVICE · الصيانة القادمة</h2><table class="fields"><tr><td class="label">Next service (km) / العداد القادم</td><td class="value">${esc(card.nextServiceOdometer ?? '—')}</td><td class="label">Next service date / التاريخ القادم</td><td class="value">${dateText(card.nextServiceDate)}</td></tr></table>
    <p class="small">Work listed above has been completed. · تم إنجاز الأعمال المذكورة أعلاه.</p><section class="signs"><div class="sign">${esc(card.technicianSignature || 'Technician Signature / توقيع الفني')}</div><div class="sign">${esc(card.supervisorSignature || 'Supervisor Signature / توقيع المشرف')}</div><div class="sign">${esc(card.driverSignature || 'Driver / Customer Signature / توقيع السائق')}</div></section><footer class="footer">Form JC-01 · Saadfreeh Transport Est. · ${esc(card.jobNumber)} · ${dateText(card.serviceDate)}</footer><script>window.onload=()=>window.print()</script></body></html>`)
    printWindow.document.close()
  }

  const addItem = () => setForm(current => ({ ...current, items: [...current.items, { type: 'PART', description: '', quantity: 1, remarks: '' }] }))
  const updateItem = (index: number, key: keyof LineItem, value: string | number) => setForm(current => ({ ...current, items: current.items.map((item, i) => i === index ? { ...item, [key]: value } : item) }))
  const statusLabel = (status: string) => status.replace(/_/g, ' ')
  const summary = { total: cards.length, open: cards.filter(card => card.status === 'OPEN').length, inProgress: cards.filter(card => card.status === 'IN_PROGRESS').length, completed: cards.filter(card => card.status === 'COMPLETED').length }

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-semibold">Workshop Job Cards</h2><p className="text-sm text-muted-foreground">Create, track, and print the bilingual workshop form.</p></div><Button onClick={startNew}><Plus className="mr-2 h-4 w-4"/>New Job Card</Button></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[['Total Job Cards', summary.total], ['Open', summary.open], ['In Progress', summary.inProgress], ['Completed', summary.completed]].map(([label, value]) => <Card key={label}><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Job Card Register</CardTitle><CardDescription>{cards.length} saved job cards</CardDescription></CardHeader><CardContent>
      {loading ? <p className="py-8 text-center text-muted-foreground">Loading job cards…</p> : cards.length === 0 ? <div className="py-10 text-center"><FileText className="mx-auto mb-3 h-10 w-10 text-muted-foreground"/><p className="font-medium">No job cards yet</p><p className="text-sm text-muted-foreground">Create the first workshop job card when a vehicle arrives for service.</p></div> : <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Job No.</TableHead><TableHead>Date</TableHead><TableHead>Vehicle</TableHead><TableHead>Service</TableHead><TableHead>Technician</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{cards.map(card => <TableRow key={card.id}><TableCell className="font-medium">{card.jobNumber}</TableCell><TableCell>{dateText(card.serviceDate)}</TableCell><TableCell>{vehicleLabel(card)}</TableCell><TableCell>{card.serviceType}</TableCell><TableCell>{card.technicianName || '—'}</TableCell><TableCell><Badge variant={card.status === 'COMPLETED' ? 'default' : 'secondary'}>{statusLabel(card.status)}</Badge></TableCell><TableCell><div className="flex gap-1"><Button size="sm" variant="ghost" title="Print / save as PDF" onClick={() => printCard(card)}><Printer className="h-4 w-4"/></Button><Button size="sm" variant="ghost" title="Edit job card" onClick={() => startEdit(card)}><Pencil className="h-4 w-4"/></Button></div></TableCell></TableRow>)}</TableBody></Table></div>}
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

        <section className="space-y-3"><h3 className="border-b pb-2 font-semibold">Maintenance Checklist · قائمة الفحص</h3><div className="grid gap-2 sm:grid-cols-2">{checklistItems.map(([key, en, ar]) => <div key={key} className="grid grid-cols-[1fr_120px] items-center gap-2 rounded border p-2"><span className="text-sm">{en}<span className="ml-1 text-xs text-muted-foreground" dir="rtl">{ar}</span></span><Select value={form.checklist[key] || 'UNSET'} onValueChange={value => setForm(current => ({ ...current, checklist: { ...current.checklist, [key]: value === 'UNSET' ? '' : value } }))}><SelectTrigger className="h-8"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="UNSET">Not checked</SelectItem><SelectItem value="OK">OK</SelectItem><SelectItem value="REPAIR">Repair</SelectItem><SelectItem value="NA">N/A</SelectItem></SelectContent></Select></div>)}</div><div className="space-y-1"><Label>Notes · ملاحظات</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}/></div></section>

        <section className="space-y-3"><h3 className="border-b pb-2 font-semibold">Next Service & Approval · الصيانة القادمة والاعتماد</h3><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label>Next Service (km) · العداد القادم</Label><Input type="number" min="0" placeholder={form.odometerKm ? String(Number(form.odometerKm) + 5000) : 'Odometer + 5,000 km'} value={form.nextServiceOdometer} onChange={e => setForm({ ...form, nextServiceOdometer: e.target.value })}/></div><div className="space-y-1"><Label>Next Service Date · التاريخ القادم</Label><Input type="date" value={form.nextServiceDate} onChange={e => setForm({ ...form, nextServiceDate: e.target.value })}/></div>{([['technicianSignature','Technician Signature · توقيع الفني'],['supervisorSignature','Supervisor Signature · توقيع المشرف'],['driverSignature','Driver / Customer Signature · توقيع السائق']] as const).map(([key,label]) => <div key={key} className="space-y-1"><Label>{label}</Label><Input value={form[key]} onChange={e => setForm(current => ({ ...current, [key]: e.target.value } as JobForm))}/></div>)}</div></section>
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Job Card'}</Button></div>
      </form>
    </DialogContent></Dialog>
  </div>
}
