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
import QRCode from 'qrcode'

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
    const items = Array.isArray(card.items) ? card.items : []
    const checks = card.checklist || {}
    const truck = card.truck
    const plate = truck?.licensePlate || card.trailer?.number || ''
    const companyName = company?.companyName || 'Saadfreeh Transport Est.'
    const companyAddress = company?.companyAddress || 'Second Industrial Area, Kingdom of Saudi Arabia'
    const companyPhone = company?.companyPhone || '+966 5 766 24440'
    const companyEmail = company?.companyEmail || 'saad@saadfreeh.com'
    const printDateText = (value?: string | Date | null) => value
      ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
      : '—'
    const printNumber = (value?: number | string | null) => value == null || value === ''
      ? ''
      : Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : String(value)
    const printStatus = String(card.status || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
    const statusClass = String(card.status || 'open').toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const completionEnglish = card.status === 'COMPLETED' ? 'Work listed above has been completed.' : card.status === 'IN_PROGRESS' ? 'Work is currently in progress.' : card.status === 'CANCELLED' ? 'This job card has been cancelled.' : 'Work is waiting to begin.'
    const completionArabic = card.status === 'COMPLETED' ? 'تم إنجاز الأعمال المذكورة أعلاه' : card.status === 'IN_PROGRESS' ? 'الأعمال قيد التنفيذ' : card.status === 'CANCELLED' ? 'تم إلغاء بطاقة العمل' : 'بانتظار بدء العمل'
    const qrValue = 'JOB CARD | ' + String(card.jobNumber || '') + ' | ' + plate + ' | ' + dateText(card.serviceDate)
    let qrDataUrl = ''
    try { qrDataUrl = await QRCode.toDataURL(qrValue, { width: 180, margin: 1, errorCorrectionLevel: 'M' }) }
    catch { throw new Error('Unable to generate the job card QR code') }

    const field = (label: string, arabic: string, value: unknown) => {
      const text = String(value ?? '').trim()
      return '<div class="field"><div class="field-label"><span>' + esc(label) + '</span><span dir="rtl">' + esc(arabic) + '</span></div><div class="field-value">' + (text ? esc(text) : '<span class="empty-value">—</span>') + '</div></div>'
    }

    const itemRows = Array.from({ length: Math.max(3, items.length) }, (_, index) => {
      const item = items[index]
      const itemType = String(item?.type || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase())
      return '<tr><td>' + esc(itemType) + '</td><td>' + esc(item?.description || '') + '</td><td class="qty-cell">' + (item ? esc(item.quantity) : '') + '</td><td>' + esc(item?.remarks || '') + '</td></tr>'
    }).join('')

    const checklistTable = (rows: string[][]) => rows.map(row => {
      const value = checks[row[0]]
      const isChecked = value === 'OK' || value === 'REPAIR'
      const isNa = value === 'NA'
      const repairText = value === 'REPAIR' ? '<small>Repair</small>' : ''
      return '<tr><td class="check-name"><span>' + esc(row[1]) + '</span><small dir="rtl">' + esc(row[2]) + '</small></td><td class="check-cell"><span class="check-box' + (isChecked ? ' is-checked' : '') + '">' + (isChecked ? '✓' : '') + '</span>' + repairText + '</td><td class="check-cell"><span class="check-box' + (isNa ? ' is-checked' : '') + '">' + (isNa ? '✓' : '') + '</span></td></tr>'
    }).join('')

    const fields = [
      field('Truck / Trailer No.', 'رقم المركبة', plate),
      field('Vehicle type', 'نوع المركبة', truck ? 'Truck' : 'Trailer'),
      field('Make / Model', 'الماركة والطراز', truck ? [truck.make, truck.model].filter(Boolean).join(' ') : 'Trailer'),
      field('Year', 'سنة الصنع', truck?.year ?? ''),
      field('VIN / Chassis', 'رقم الهيكل', truck?.vin || ''),
      field('Odometer (km)', 'العداد', printNumber(card.odometerKm)),
      field('Service type', 'نوع الصيانة', card.serviceType || ''),
      field('Technician', 'الفني', card.technicianName || ''),
      field('Driver', 'السائق', card.driverName || ''),
      field('Next service (km)', 'العداد القادم', printNumber(card.nextServiceOdometer) || '—'),
      field('Next service date', 'تاريخ الصيانة القادمة', printDateText(card.nextServiceDate))
    ].join('')

    return [
      '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>',
      esc(card.jobNumber), ' · Job Card</title><style>',
      '@page{size:A4 portrait;margin:0}',
      '*{box-sizing:border-box}',
      'html,body{margin:0;padding:0;color:#1b2e28;font-family:Arial,"Noto Sans Arabic",sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
      'body{background:#eef2ef}',
      '.print-page{width:100%;max-width:210mm;aspect-ratio:210/297;margin:0 auto;padding:5mm;display:flex;background:#fff}',
      '.card-frame{width:100%;flex:1;border:1.7px solid #244b3d;padding:4mm;display:flex;flex-direction:column;gap:2.6mm;background:#fff}',
      '.masthead{display:grid;grid-template-columns:100px minmax(0,1fr) 145px;align-items:center;gap:12px;padding:1px 2px 9px;border-bottom:2px solid #d8e4dd}',
      '.logo-wrap{display:flex;align-items:center;justify-content:center;min-height:62px}',
      '.logo-wrap img{display:block;width:94px;height:60px;object-fit:contain}',
      '.eyebrow{margin-bottom:3px;color:#648073;font-size:8px;font-weight:700;letter-spacing:1.25px;text-transform:uppercase}',
      '.company-name{color:#315b4a;font-size:11px;font-weight:700}',
      '.main-title{margin:3px 0 0;color:#172c24;font-size:24px;font-weight:800;line-height:1.05;letter-spacing:-.45px}',
      '.main-title span{margin-left:5px;color:#537265;font-size:15px;font-weight:600;letter-spacing:0}',
      '.doc-code{display:flex;flex-direction:column;align-items:flex-end;gap:3px;border-left:2px solid #c6944e;padding-left:10px;text-align:right}',
      '.doc-code span{color:#728279;font-size:7px;font-weight:700;letter-spacing:.65px;text-transform:uppercase}',
      '.doc-code strong{color:#244b3d;font-size:11px}',
      '.contact-line{display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:6px;padding:0 2px 1px;color:#607168;font-size:7.5px}',
      '.contact-line span{overflow-wrap:anywhere}',
      '.summary-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr 1fr;gap:6px}',
      '.summary-card{min-height:42px;border:1px solid #dce6e0;border-radius:3px;background:#f6f9f7;padding:6px 8px}',
      '.summary-label{display:block;margin-bottom:3px;color:#718178;font-size:7px;font-weight:700;letter-spacing:.55px;text-transform:uppercase}',
      '.summary-value{display:block;color:#1e352c;font-size:10px;font-weight:700;overflow-wrap:anywhere}',
      '.status-pill{display:inline-flex;align-items:center;border-radius:99px;background:#e5eee9;padding:2px 7px;color:#315a47;font-size:8px;font-weight:700}',
      '.status-pill.in-progress{background:#fff1d9;color:#805717}.status-pill.completed{background:#e5f4eb;color:#206341}.status-pill.cancelled{background:#fce9e9;color:#913f3f}',
      '.section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:25px;border-left:3px solid #c6944e;background:#214a3b;padding:5px 8px;color:#fff}',
      '.section-title{display:flex;align-items:center;gap:7px;margin:0;font-size:9px;font-weight:700;letter-spacing:.45px;text-transform:uppercase}',
      '.section-index{color:#e9c88c;font-size:8px}',
      '.section-ar{font-size:9px;font-weight:600}',
      '.vehicle-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid #dbe4df;border-left:1px solid #dbe4df}',
      '.field{min-height:39px;border-right:1px solid #dbe4df;border-bottom:1px solid #dbe4df;background:#fff;padding:5px 7px}',
      '.field-label{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-bottom:4px;color:#738279;font-size:6.8px;font-weight:700;letter-spacing:.35px;text-transform:uppercase}',
      '.field-label [dir=rtl]{font-size:7.5px;letter-spacing:0;text-transform:none}',
      '.field-value{min-height:12px;color:#20382e;font-size:9.5px;font-weight:700;line-height:1.2;overflow-wrap:anywhere}',
      '.empty-value{color:#aab5af;font-weight:400}',
      '.issue-panel{min-height:39px;border:1px solid #dbe4df;border-radius:2px;background:#fbfcfb;padding:7px 9px;color:#263a31;font-size:9px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.items-table,.check-table{width:100%;border-collapse:collapse;table-layout:fixed}',
      '.items-table th,.items-table td{border:1px solid #dbe4df;padding:5px 6px;text-align:left;vertical-align:middle;overflow-wrap:anywhere}',
      '.items-table th{background:#edf3ef;color:#455d50;font-size:7px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}',
      '.items-table td{height:22px;color:#263a31;font-size:8px;line-height:1.25}',
      '.items-table tr:nth-child(even) td{background:#fafcfb}',
      '.items-table .qty-cell{text-align:center;font-weight:700}',
      '.check-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}',
      '.check-table th,.check-table td{border:1px solid #dbe4df;padding:4px 5px;vertical-align:middle}',
      '.check-table th{background:#edf3ef;color:#455d50;font-size:6.7px;font-weight:700;text-align:center}',
      '.check-table th:first-child{text-align:left}',
      '.check-table td{height:24px;background:#fff}',
      '.check-name span,.check-name small{display:block}',
      '.check-name span{color:#263a31;font-size:7.2px;font-weight:600}',
      '.check-name small{margin-top:1px;color:#74847b;font-size:7px}',
      '.check-cell{width:16%;text-align:center;white-space:nowrap}',
      '.check-box{display:inline-flex;width:12px;height:12px;align-items:center;justify-content:center;border:1px solid #9aaba1;border-radius:2px;color:#fff;font-size:9px;font-weight:800;vertical-align:middle}',
      '.check-box.is-checked{border-color:#2f684d;background:#2f684d}',
      '.check-cell small{display:inline-block;margin-left:2px;color:#8a5e21;font-size:6px;vertical-align:middle}',
      '.notes-panel{min-height:27px;border:1px solid #dbe4df;border-left:3px solid #c6944e;background:#fafcfb;padding:6px 8px;color:#33483d;font-size:8px;white-space:pre-wrap;overflow-wrap:anywhere}',
      '.notes-panel strong{margin-right:4px;color:#62746a;font-size:7px;text-transform:uppercase}',
      '.service-strip{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dbe4df}',
      '.service-cell{min-height:34px;padding:6px 8px}.service-cell+ .service-cell{border-left:1px solid #dbe4df}',
      '.service-label{display:block;margin-bottom:3px;color:#738279;font-size:7px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}',
      '.service-value{color:#233a30;font-size:9px;font-weight:700}',
      '.completion-note{display:flex;justify-content:space-between;gap:8px;border:1px solid #dbe4df;background:#f4f8f5;padding:6px 8px;color:#456052;font-size:8px;font-weight:600}',
      '.signatures-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}',
      '.signature-box{min-height:45px;border:1px solid #dbe4df;padding:5px 7px}',
      '.signature-value{min-height:17px;border-bottom:1px dotted #8c9b92;color:#2c4939;font-size:8px;font-style:italic;overflow-wrap:anywhere}',
      '.signature-label{display:flex;justify-content:space-between;gap:5px;margin-top:4px;color:#687a70;font-size:6.7px;font-weight:700}',
      '.doc-footer{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;border-top:1px solid #dbe4df;padding-top:6px}',
      '.scan-block{display:flex;align-items:center;gap:7px}',
      '.scan-block img{width:42px;height:42px;object-fit:contain}',
      '.scan-copy strong,.scan-copy span{display:block}',
      '.scan-copy strong{color:#315544;font-size:7.5px}',
      '.scan-copy span{margin-top:2px;color:#718178;font-size:6.5px}',
      '.form-ref{text-align:right;color:#75847b;font-size:6.5px}',
      '.form-ref strong,.form-ref span{display:block}',
      '.form-ref strong{margin-top:3px;color:#335644;font-size:8px}',
      '@media screen and (max-width:720px){body{background:#eef2ef}.print-page{width:100%;aspect-ratio:auto;min-height:100vh;padding:10px}.card-frame{gap:9px;padding:12px}.masthead{grid-template-columns:72px minmax(0,1fr);gap:8px}.logo-wrap{min-height:54px}.logo-wrap img{width:68px;height:48px}.main-title{font-size:20px}.main-title span{font-size:13px}.doc-code{grid-column:1/-1;flex-direction:row;align-items:center;justify-content:space-between;border-left:0;border-top:1px solid #dbe4df;padding:6px 0 0;text-align:left}.contact-line{grid-template-columns:1fr;gap:4px}.summary-grid{grid-template-columns:1fr 1fr}.vehicle-grid{grid-template-columns:1fr 1fr}.check-grid{grid-template-columns:1fr}.doc-footer{align-items:flex-start}}',
      '@media screen and (max-width:420px){.print-page{padding:6px}.card-frame{padding:9px}.main-title{font-size:18px}.summary-card{padding:5px}.vehicle-grid{grid-template-columns:1fr}.section-heading{align-items:flex-start}.section-title{font-size:8px}.section-ar{font-size:8px}.signatures-grid{grid-template-columns:1fr}.completion-note{flex-direction:column;gap:3px}.items-table th,.items-table td{padding:4px 3px;font-size:7px}}',
      '@media print{html,body{width:210mm;height:297mm;min-height:297mm;overflow:hidden;margin:0!important;padding:0!important;background:#fff!important}.print-page{width:210mm;max-width:210mm;height:297mm;min-height:297mm;margin:0;padding:5mm;break-inside:avoid;page-break-inside:avoid}.card-frame{min-height:0;height:100%;padding:4mm;gap:2.3mm;break-inside:avoid;page-break-inside:avoid}.masthead{grid-template-columns:100px minmax(0,1fr) 145px}.contact-line{grid-template-columns:1.15fr 1fr 1fr}.summary-grid{grid-template-columns:1.2fr 1fr 1fr 1fr}.vehicle-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.check-grid{grid-template-columns:1fr 1fr}.signatures-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.completion-note{flex-direction:row}.doc-footer{margin-top:auto}tr,section,.masthead,.summary-grid,.doc-footer{break-inside:avoid;page-break-inside:avoid}}',
      '</style></head><body><main class="print-page"><article class="card-frame">',
      '<header class="masthead"><div class="logo-wrap"><img src="', window.location.origin, '/saadfreeh-transport-logo.png" alt="Saadfreeh Transportation"></div>',
      '<div class="company-lockup"><div class="eyebrow">Workshop &amp; Fleet Maintenance</div><div class="company-name">', esc(companyName), '</div><h1 class="main-title">Job Card <span dir="rtl">أمر شغل</span></h1></div>',
      '<div class="doc-code"><span>Workshop service document</span><strong>FORM · JC-01</strong><span>Revision 6 · A4 Portrait</span></div></header>',
      '<div class="contact-line"><span>', esc(companyAddress), '</span><span>', esc(companyPhone), '</span><span>', esc(companyEmail), '</span></div>',
      '<section class="summary-grid">',
      '<div class="summary-card"><span class="summary-label">Job number · رقم الأمر</span><strong class="summary-value">', esc(card.jobNumber), '</strong></div>',
      '<div class="summary-card"><span class="summary-label">Service date · التاريخ</span><strong class="summary-value">', printDateText(card.serviceDate), '</strong></div>',
      '<div class="summary-card"><span class="summary-label">Status · الحالة</span><span class="status-pill ', statusClass, '">', esc(printStatus || 'Open'), '</span></div>',
      '<div class="summary-card"><span class="summary-label">Priority · الأولوية</span><strong class="summary-value">', esc(card.priority || 'NORMAL'), '</strong></div>',
      '</section>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">01</span> Vehicle &amp; Service Details</h2><span class="section-ar" dir="rtl">بيانات المركبة والصيانة</span></div><div class="vehicle-grid">', fields, '</div></section>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">02</span> Reported Issue</h2><span class="section-ar" dir="rtl">الشكوى والملاحظات</span></div><div class="issue-panel">', esc(card.reportedIssue || ''), '</div></section>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">03</span> Work Performed &amp; Spare Parts</h2><span class="section-ar" dir="rtl">الأعمال المنجزة وقطع الغيار</span></div>',
      '<table class="items-table"><colgroup><col style="width:17%"><col style="width:45%"><col style="width:10%"><col style="width:28%"></colgroup><thead><tr><th>Item type · النوع</th><th>Description · الوصف</th><th>Qty</th><th>Remarks · ملاحظات</th></tr></thead><tbody>', itemRows, '</tbody></table></section>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">04</span> Maintenance Checklist</h2><span class="section-ar" dir="rtl">قائمة الفحص الدوري</span></div>',
      '<div class="check-grid"><table class="check-table"><colgroup><col style="width:68%"><col style="width:18%"><col style="width:14%"></colgroup><thead><tr><th>Inspection point · بند الفحص</th><th>OK / Repair</th><th>N/A</th></tr></thead><tbody>',
      checklistTable(checklistItems.slice(0, 5)), '</tbody></table>',
      '<table class="check-table"><colgroup><col style="width:68%"><col style="width:18%"><col style="width:14%"></colgroup><thead><tr><th>Inspection point · بند الفحص</th><th>OK / Repair</th><th>N/A</th></tr></thead><tbody>',
      checklistTable(checklistItems.slice(5)), '</tbody></table></div></section>',
      '<div class="notes-panel"><strong>Notes · ملاحظات</strong>', esc(card.notes || '—'), '</div>',
      '<section><div class="section-heading"><h2 class="section-title"><span class="section-index">05</span> Next Service &amp; Approval</h2><span class="section-ar" dir="rtl">الصيانة القادمة والاعتماد</span></div>',
      '<div class="service-strip"><div class="service-cell"><span class="service-label">Next service odometer · العداد القادم</span><strong class="service-value">', esc(printNumber(card.nextServiceOdometer) || '—'), '</strong></div><div class="service-cell"><span class="service-label">Next service date · تاريخ الصيانة القادمة</span><strong class="service-value">', printDateText(card.nextServiceDate), '</strong></div></div></section>',
      '<div class="completion-note"><span>', completionEnglish, '</span><span dir="rtl">', completionArabic, '</span></div>',
      '<section class="signatures-grid">',
      '<div class="signature-box"><div class="signature-value">', esc(card.technicianSignature || ''), '</div><div class="signature-label"><span>Technician signature</span><span dir="rtl">توقيع الفني</span></div></div>',
      '<div class="signature-box"><div class="signature-value">', esc(card.supervisorSignature || ''), '</div><div class="signature-label"><span>Supervisor signature</span><span dir="rtl">توقيع المشرف</span></div></div>',
      '<div class="signature-box"><div class="signature-value">', esc(card.driverSignature || ''), '</div><div class="signature-label"><span>Driver / customer</span><span dir="rtl">توقيع السائق</span></div></div>',
      '</section>',
      '<footer class="doc-footer"><div class="scan-block"><img src="', qrDataUrl, '" alt="Job card verification QR code"><div class="scan-copy"><strong>Job card verification</strong><span>Scan to identify this job card</span><span dir="rtl">امسح للتعرف على بطاقة العمل</span></div></div><div class="form-ref"><span>Saadfreeh Transport Est.</span><span>Workshop Job Card System</span><strong>JC-01 · REV 6</strong></div></footer>',
      '</article></main></body></html>'
    ].join('')
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
