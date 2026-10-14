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
import QRCode from 'qrcode'

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

  const printCard = async (card: JobCard) => {
    const printWindow = window.open('', '_blank', 'width=1000,height=900')
    if (!printWindow) { toast.error('Allow pop-ups to print the job card'); return }
    const items = Array.isArray(card.items) ? card.items : []
    const checks = card.checklist || {}
    const checkedRows = checklistItems.map(([key, en, ar]) => {
      const value = checks[key]
      return `<tr class="checkrow"><td colspan="2">${en} <span dir="rtl">/ ${ar}</span></td><td class="center check-box">${value === 'OK' || value === 'REPAIR' ? '✓' : '□'}</td><td class="center check-box">${value === 'NA' ? '✓' : '□'}</td></tr>`
    }).join('')
    const itemRows = Array.from({ length: Math.max(10, items.length) }, (_, index) => {
      const item = items[index]
      return `<tr class="itemrow"><td>${esc(item?.type || '')}</td><td>${esc(item?.description || '')}</td><td class="center">${item ? esc(item.quantity) : ''}</td><td>${esc(item?.remarks || '')}</td></tr>`
    }).join('')
    const companyName = company?.companyName || 'Saadfreeh Transport Est.'
    const companyContact = [
      'Workshop & Fleet Maintenance',
      company?.companyAddress || 'Second Industrial Area, Kingdom of Saudi Arabia',
      company?.companyPhone || '+966 5 766 24440',
      company?.companyEmail || 'saad@saadfreeh.com'
    ].join('  ·  ')
    const truck = card.truck
    const plate = truck?.licensePlate || card.trailer?.number || ''
    const printDateText = (value?: string | Date | null) => value
      ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
      : ''
    const printNumber = (value?: number | string | null) => value == null || value === ''
      ? ''
      : Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : String(value)
    const printStatus = String(card.status || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
    const qrValue = `JOB CARD | ${card.jobNumber} | ${plate} | ${dateText(card.serviceDate)}`
    let qrDataUrl = ''
    try { qrDataUrl = await QRCode.toDataURL(qrValue, { width: 220, margin: 1, errorCorrectionLevel: 'M' }) }
    catch { toast.error('Unable to generate the job card QR code'); printWindow.close(); return }
    printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(card.jobNumber)} · Job Card</title><style>
      @page{size:A4 portrait;margin:7.62mm 6.35mm}
      *{box-sizing:border-box}
      html,body{margin:0;padding:0;color:#202820;font-family:"Segoe UI",Arial,sans-serif}
      .print-page{width:114.95%;zoom:.87}
      .card-frame{width:100%;border:2px solid #101510}
      .sheet{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px;line-height:1.12}
      .sheet col:nth-child(1){width:15.83%}.sheet col:nth-child(2){width:38.45%}.sheet col:nth-child(3){width:14.07%}.sheet col:nth-child(4){width:31.65%}
      .sheet td,.sheet th{border:1px solid #bfd2c6;padding:3px 5px;vertical-align:middle;overflow-wrap:anywhere;background:#eaf4ee}
      .sheet .logo{padding:2px;text-align:center;background:#fff;border-right:2px solid #b4c9bc}
      .logo img{width:100%;height:80px;object-fit:contain}
      .brand-title{font-size:18px;font-weight:700;color:#006c35;text-align:right;background:#fff!important;border:0!important;padding:3px 8px!important}
      .brand-name{font-size:13px;font-weight:700;background:#fff!important;border:0!important;padding:2px 8px!important}
      .brand-contact{font-size:9px;color:#849188;background:#fff!important;border:0!important;padding:3px 4px!important;white-space:nowrap}
      .banner,.section{background:#0f3d2a!important;color:#fff;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .banner{text-align:center;font-size:14px;letter-spacing:.2px;padding:5px!important}
      .section{font-size:10px;padding:4px 6px!important}
      .label{font-weight:700;color:#718078}
      .value{min-height:19px;white-space:pre-wrap;font-size:11px;font-weight:700;color:#202820}
      .meta td{height:21px}
      .issue{height:48px;vertical-align:top!important;white-space:pre-wrap;font-size:11px}
      .thead th{background:#304f42!important;color:#fff;font-weight:700;text-align:left;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .thead th:nth-child(3),.itemrow td:nth-child(3),.checkrow td:nth-child(3),.checkrow td:nth-child(4){text-align:center}
      .itemrow td{height:20px;font-size:10px}.checkrow td{height:18px}.checkrow td:first-child{font-size:9px}
      .check-box{font-size:14px;line-height:1;color:#173e2c}
      .note{height:23px;white-space:pre-wrap;color:#849188;background:#fff!important}
      .approval td{height:23px}.complete{text-align:left;font-weight:500;height:22px;color:#75847b;background:#fff!important}
      .sig{height:31px;vertical-align:middle!important;text-align:left;padding:4px 8px!important;background:#fff!important}.sigline{border:0;padding-top:3px;white-space:nowrap}
      .driver-sig{height:28px;text-align:left;padding-left:8px!important;vertical-align:middle!important;background:#fff!important}
      .form-footer{text-align:center;font-size:8px;color:#718078;border-top:1px solid #b4c9bc!important;height:20px;background:#fff!important}
      .qr-footer{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:0;font-size:9px;font-weight:700}
      .qr-footer col:first-child{width:54.3%}.qr-footer col:last-child{width:45.7%}
      .qr-footer td{height:50px;text-align:center;vertical-align:middle;border:1px solid #b4c9bc;padding:4px}.qr-footer img{width:66px;height:66px;object-fit:contain}
      .work-complete{display:flex;justify-content:space-between;align-items:center;gap:10px}
      @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.card-frame,.qr-footer{break-inside:avoid}tr{break-inside:avoid}}
    </style></head><body><div class="print-page"><div class="card-frame"><table class="sheet"><colgroup><col><col><col><col></colgroup><tbody>
      <tr><td class="logo" rowspan="3"><img src="${window.location.origin}/saadfreeh-transport-logo.png" alt="Saadfreeh Transportation"></td><td class="brand-title" colspan="3" dir="rtl">سعد فريح معروف ال منيف الزعبي</td></tr>
      <tr><td class="brand-name" colspan="3">${esc(companyName)}</td></tr><tr><td class="brand-contact" colspan="3">${esc(companyContact || 'Workshop Job Card System')}</td></tr>
      <tr><td class="banner" colspan="4">JOB CARD&nbsp; | &nbsp;أمر شغل</td></tr>
      <tr class="meta"><td class="label">Job No. / رقم الأمر</td><td class="value"><b>${esc(card.jobNumber)}</b></td><td class="label">Date / التاريخ</td><td class="value">${printDateText(card.serviceDate)}</td></tr>
      <tr class="meta"><td class="label">Status / الحالة</td><td class="value">${esc(printStatus)}</td><td class="label">Lines on file</td><td class="value">${items.length}</td></tr>
      <tr><td class="section" colspan="4">VEHICLE INFORMATION&nbsp; | &nbsp;بيانات المركبة</td></tr>
      <tr class="meta"><td class="label">Truck No. / رقم الشاحنة</td><td class="value">${esc(plate)}</td><td class="label">Make / Model<br>الماركة</td><td class="value">${esc(truck ? `${truck.make} ${truck.model}` : 'Trailer')}</td></tr>
      <tr class="meta"><td class="label">Year / سنة الصنع</td><td class="value">${esc(truck?.year ?? '')}</td><td class="label">Type / النوع</td><td class="value">${truck ? 'Truck' : 'Trailer'}</td></tr>
      <tr class="meta"><td class="label">VIN / chassis&nbsp; رقم الهيكل</td><td class="value">${esc(truck?.vin || '')}</td><td class="label">Odometer (km) /<br>العداد</td><td class="value">${esc(printNumber(card.odometerKm))}</td></tr>
      <tr class="meta"><td class="label">Service type / نوع الصيانة</td><td class="value">${esc(card.serviceType || '')}</td><td class="label">Technician / الفني</td><td class="value">${esc(card.technicianName || '')}</td></tr>
      <tr class="meta"><td class="label">Next service (km) / القادم</td><td class="value">${esc(printNumber(card.nextServiceOdometer) || 'NA')}</td><td class="label">Next service date /<br>التاريخ</td><td class="value">${printDateText(card.nextServiceDate)}</td></tr>
      <tr class="meta"><td class="label">Priority / الأولوية</td><td class="value">${esc(card.priority || '')}</td><td class="label">Driver / السائق</td><td class="value">${esc(card.driverName || '')}</td></tr>
      <tr><td class="section" colspan="4">REPORTED ISSUE&nbsp; | &nbsp;الشكوى / الملاحظات</td></tr><tr><td class="issue" colspan="4">${esc(card.reportedIssue || '')}</td></tr>
      <tr><td class="section" colspan="4">WORK PERFORMED &amp; SPARE PARTS&nbsp; | &nbsp;الأعمال المنجزة والقطع</td></tr>
      <tr class="thead"><th>Item Type / النوع</th><th>Description / الوصف</th><th>Qty</th><th>Remarks / ملاحظات</th></tr>${itemRows}
      <tr><td class="section" colspan="4">MAINTENANCE CHECKLIST&nbsp; | &nbsp;قائمة الفحص الدوري</td></tr>
      <tr class="thead"><th colspan="2">Checklist item / بند الفحص</th><th>OK / Repair / إصلاح</th><th>N/A</th></tr>${checkedRows}
      <tr><td class="note" colspan="4">Notes / ملاحظات: ${esc(card.notes || '')}</td></tr>
      <tr><td class="section" colspan="4">NEXT SERVICE &amp; APPROVAL&nbsp; | &nbsp;الصيانة القادمة والاعتماد</td></tr>
      <tr class="approval"><td class="label">Next service (km)</td><td class="value">${esc(printNumber(card.nextServiceOdometer) || 'NA')}</td><td class="label">Next service date</td><td class="value">${printDateText(card.nextServiceDate)}</td></tr>
      <tr><td class="complete" colspan="4"><div class="work-complete"><span>Work listed above has been completed.</span><span dir="rtl">تم إنجاز الأعمال المذكورة أعلاه</span></div></td></tr>
      <tr><td class="sig" colspan="2"><div class="sigline">${esc(card.technicianSignature || '_____________')} &nbsp; Technician Signature / توقيع الفني</div></td><td class="sig" colspan="2"><div class="sigline">${esc(card.supervisorSignature || '_____________')} &nbsp; Supervisor Signature / توقيع المشرف</div></td></tr>
      <tr><td class="driver-sig" colspan="4">${esc(card.driverSignature || '____________________________________')} &nbsp; Driver / Customer signature / توقيع السائق</td></tr>
      <tr><td class="form-footer" colspan="4">JC-01 · Form JC-01 · Rev 6 · Saadfreeh Transport Est. — Workshop Job Card System · نموذج</td></tr>
    </tbody></table></div><table class="qr-footer"><colgroup><col><col></colgroup><tbody><tr><td>Scan to view vehicle &amp; job date<br>امسح لعرض بيانات المركبة وتاريخ العمل</td><td><img src="${qrDataUrl}" alt="Job card QR code"></td></tr></tbody></table></div><script>window.onload=()=>setTimeout(()=>window.print(),150)</script></body></html>`)
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
