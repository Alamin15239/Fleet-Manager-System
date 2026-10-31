'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, BarChart3, Bell, Building2, CalendarClock, CheckCircle2,
  CircleDot, ClipboardList, Download, FileSpreadsheet, FileText, Fuel, Gauge,
  LayoutDashboard, Menu, Package, Plus, Search, Settings, ShieldCheck, Truck,
  Users, Wrench, X, Pencil, Trash2, RefreshCw, ArrowUpRight, Clock3, Boxes,
  ReceiptText, UserRound, Filter, ChevronDown, CircleHelp
} from 'lucide-react'

type ModuleId =
  | 'dashboard' | 'trucks' | 'trailers' | 'drivers' | 'maintenance' | 'job-cards'
  | 'breakdowns' | 'tires' | 'oil-changes' | 'spare-parts' | 'purchase-invoices'
  | 'mechanics' | 'documents' | 'expenses' | 'analytics' | 'reports'
  | 'excel' | 'notifications' | 'users' | 'organizations' | 'settings'

type RecordRow = Record<string, string>
type Field = { key: string; label: string; placeholder?: string; type?: string; options?: string[] }

const modules: { id: ModuleId; label: string; group: string; icon: any; description: string }[] = [
  { id: 'dashboard', label: 'Dashboard', group: 'Overview', icon: LayoutDashboard, description: 'Fleet performance, workshop activity and operational alerts' },
  { id: 'trucks', label: 'Trucks & Vehicles', group: 'Fleet', icon: Truck, description: 'Vehicle master data, status, mileage and fleet records' },
  { id: 'trailers', label: 'Trailers', group: 'Fleet', icon: Package, description: 'Trailer register, assignments and compliance status' },
  { id: 'drivers', label: 'Drivers', group: 'Fleet', icon: Users, description: 'Driver profiles, assignments and card expiry' },
  { id: 'maintenance', label: 'Preventive Maintenance', group: 'Workshop', icon: CalendarClock, description: 'Service schedules, intervals and upcoming maintenance' },
  { id: 'job-cards', label: 'Workshop Job Cards', group: 'Workshop', icon: ClipboardList, description: 'Work orders, repairs, labor, parts and completion tracking' },
  { id: 'breakdowns', label: 'Breakdowns', group: 'Workshop', icon: AlertTriangle, description: 'Roadside incidents, downtime and corrective actions' },
  { id: 'oil-changes', label: 'Oil Changes', group: 'Workshop', icon: Fuel, description: 'Oil service history, liters, mileage and consumption' },
  { id: 'tires', label: 'Tire Management', group: 'Inventory', icon: CircleDot, description: 'Serial-level tire inventory, fitment, movement and condition' },
  { id: 'spare-parts', label: 'Spare Parts & Consumables', group: 'Inventory', icon: Boxes, description: 'Stock quantities, units, reorder levels and stock movements' },
  { id: 'documents', label: 'Documents & Expiry', group: 'Compliance', icon: ShieldCheck, description: 'Vehicle and driver documents, issue dates and expiry alerts' },
  { id: 'purchase-invoices', label: 'Purchase Invoices', group: 'Finance', icon: ReceiptText, description: 'Supplier invoices, VAT, purchasing and accounts' },
  { id: 'expenses', label: 'Expenses', group: 'Finance', icon: Gauge, description: 'Fleet costs, workshop expenses and expense history' },
  { id: 'mechanics', label: 'Mechanics', group: 'Workshop', icon: Wrench, description: 'Technician profiles, specialties and assigned work' },
  { id: 'analytics', label: 'Advanced Analytics', group: 'Insights', icon: BarChart3, description: 'Cost, utilization, maintenance and fleet trends' },
  { id: 'reports', label: 'Reports', group: 'Insights', icon: FileText, description: 'Operational reports and downloadable sample data' },
  { id: 'excel', label: 'Excel Changes Review', group: 'Insights', icon: FileSpreadsheet, description: 'Review imported workbook changes before accepting them' },
  { id: 'notifications', label: 'Notifications', group: 'Workspace', icon: Bell, description: 'Maintenance, breakdown and compliance notifications' },
  { id: 'users', label: 'Users & Permissions', group: 'Administration', icon: Users, description: 'User accounts, roles and access examples' },
  { id: 'organizations', label: 'Organizations', group: 'Administration', icon: Building2, description: 'Multi-company workspaces and organization overview' },
  { id: 'settings', label: 'Settings & Integrations', group: 'Administration', icon: Settings, description: 'Workspace preferences, integrations and alert settings' },
]

const fields: Partial<Record<ModuleId, Field[]>> = {
  trucks: [
    { key: 'plate', label: 'Plate number' }, { key: 'name', label: 'Vehicle model' },
    { key: 'year', label: 'Model year', type: 'number' }, { key: 'odometer', label: 'Odometer (km)', type: 'number' },
    { key: 'status', label: 'Status', options: ['Active', 'Maintenance', 'Out of service'] },
    { key: 'driver', label: 'Assigned driver' },
  ],
  trailers: [
    { key: 'plate', label: 'Trailer plate' }, { key: 'name', label: 'Trailer type' },
    { key: 'axles', label: 'Axles', type: 'number' }, { key: 'capacity', label: 'Capacity (ton)' },
    { key: 'status', label: 'Status', options: ['Active', 'Available', 'Maintenance'] },
  ],
  drivers: [
    { key: 'name', label: 'Driver name' }, { key: 'id', label: 'Employee ID' },
    { key: 'phone', label: 'Phone' }, { key: 'vehicle', label: 'Assigned vehicle' },
    { key: 'cardExpiry', label: 'Driver card expiry', type: 'date' },
    { key: 'status', label: 'Status', options: ['Active', 'On leave', 'Inactive'] },
  ],
  maintenance: [
    { key: 'vehicle', label: 'Vehicle' }, { key: 'service', label: 'Service type' },
    { key: 'interval', label: 'Interval (km)', type: 'number' }, { key: 'lastService', label: 'Last service date', type: 'date' },
    { key: 'nextDue', label: 'Next due (km)' }, { key: 'status', label: 'Status', options: ['On track', 'Due soon', 'Overdue'] },
  ],
  'job-cards': [
    { key: 'id', label: 'Job card ID' }, { key: 'vehicle', label: 'Vehicle' },
    { key: 'work', label: 'Work description' }, { key: 'date', label: 'Date', type: 'date' },
    { key: 'priority', label: 'Priority', options: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'mechanic', label: 'Assigned mechanic' }, { key: 'cost', label: 'Cost (SAR)', type: 'number' },
    { key: 'status', label: 'Status', options: ['Open', 'In progress', 'Waiting for parts', 'Completed'] },
  ],
  breakdowns: [
    { key: 'id', label: 'Incident ID' }, { key: 'vehicle', label: 'Vehicle' },
    { key: 'issue', label: 'Issue / failure' }, { key: 'date', label: 'Date', type: 'date' },
    { key: 'location', label: 'Location' }, { key: 'severity', label: 'Severity', options: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'status', label: 'Status', options: ['Reported', 'Assigned', 'Repairing', 'Resolved'] },
  ],
  'oil-changes': [
    { key: 'vehicle', label: 'Vehicle' }, { key: 'date', label: 'Service date', type: 'date' },
    { key: 'odometer', label: 'Odometer (km)', type: 'number' }, { key: 'liters', label: 'Oil quantity (litres)', type: 'number' },
    { key: 'oilType', label: 'Oil type / grade' }, { key: 'filter', label: 'Filter replaced', options: ['Yes', 'No'] },
    { key: 'cost', label: 'Cost (SAR)', type: 'number' },
  ],
  tires: [
    { key: 'serial', label: 'Tire serial number' }, { key: 'size', label: 'Tire size' },
    { key: 'brand', label: 'Brand' }, { key: 'position', label: 'Vehicle / position' },
    { key: 'condition', label: 'Condition', options: ['New', 'Good', 'Inspect', 'Damaged', 'Scrap'] },
    { key: 'status', label: 'Status', options: ['In stock', 'Fitted', 'Under inspection', 'Scrapped'] },
  ],
  'spare-parts': [
    { key: 'name', label: 'Part / consumable name' }, { key: 'category', label: 'Category' },
    { key: 'sku', label: 'SKU / part number' }, { key: 'unit', label: 'Stock unit', options: ['pcs', 'set', 'litre', 'box', 'pair', 'roll'] },
    { key: 'stock', label: 'Current stock quantity', type: 'number' },
    { key: 'reorder', label: 'Reorder level', type: 'number' }, { key: 'cost', label: 'Unit cost (SAR)', type: 'number' },
  ],
  documents: [
    { key: 'document', label: 'Document type' }, { key: 'asset', label: 'Vehicle / driver' },
    { key: 'number', label: 'Document number' }, { key: 'issue', label: 'Issue date', type: 'date' },
    { key: 'expiry', label: 'Expiry date', type: 'date' },
    { key: 'status', label: 'Status', options: ['Valid', 'Expiring soon', 'Expired', 'Missing'] },
  ],
  'purchase-invoices': [
    { key: 'id', label: 'Invoice number' }, { key: 'supplier', label: 'Supplier' },
    { key: 'date', label: 'Invoice date', type: 'date' }, { key: 'category', label: 'Purchase category' },
    { key: 'subtotal', label: 'Subtotal (SAR)', type: 'number' }, { key: 'vat', label: 'VAT (SAR)', type: 'number' },
    { key: 'status', label: 'Status', options: ['Draft', 'Posted', 'Paid', 'Overdue'] },
  ],
  expenses: [
    { key: 'date', label: 'Date', type: 'date' }, { key: 'vehicle', label: 'Vehicle' },
    { key: 'category', label: 'Expense category' }, { key: 'description', label: 'Description' },
    { key: 'amount', label: 'Amount (SAR)', type: 'number' }, { key: 'status', label: 'Status', options: ['Recorded', 'Approved', 'Paid'] },
  ],
  mechanics: [
    { key: 'name', label: 'Mechanic name' }, { key: 'specialty', label: 'Specialty' },
    { key: 'phone', label: 'Phone' }, { key: 'jobs', label: 'Assigned jobs', type: 'number' },
    { key: 'status', label: 'Status', options: ['Active', 'Unavailable', 'Inactive'] },
  ],
  excel: [
    { key: 'sheet', label: 'Workbook sheet' }, { key: 'record', label: 'Record / row' },
    { key: 'field', label: 'Changed field' }, { key: 'before', label: 'Previous value' },
    { key: 'after', label: 'New value' }, { key: 'status', label: 'Review status', options: ['Pending review', 'Accepted', 'Rejected'] },
  ],
  users: [
    { key: 'name', label: 'User name' }, { key: 'email', label: 'Email', type: 'email' },
    { key: 'role', label: 'Role', options: ['ADMIN', 'MANAGER', 'USER', 'VIEWER'] },
    { key: 'department', label: 'Department' }, { key: 'status', label: 'Status', options: ['Active', 'Pending', 'Disabled'] },
  ],
  organizations: [
    { key: 'name', label: 'Organization name' }, { key: 'slug', label: 'Workspace slug' },
    { key: 'plan', label: 'Plan' }, { key: 'users', label: 'Users', type: 'number' },
    { key: 'status', label: 'Status', options: ['Active', 'Trial', 'Suspended'] },
  ],
}

const seed: Partial<Record<ModuleId, RecordRow[]>> = {
  trucks: [
    { plate: 'ABC 4821', name: 'Mercedes-Benz Actros MP5', year: '2022', odometer: '284120', status: 'Active', driver: 'Ahmed Hassan' },
    { plate: 'KSA 7319', name: 'Mercedes-Benz Actros MP4', year: '2020', odometer: '316840', status: 'Maintenance', driver: 'Omar Saleh' },
    { plate: 'DMM 2094', name: 'Volvo FH 2023', year: '2023', odometer: '128540', status: 'Active', driver: 'Mahmoud Ali' },
  ],
  trailers: [
    { plate: 'TRL 0912', name: 'Curtain side', axles: '3', capacity: '25', status: 'Active' },
    { plate: 'TRL 1038', name: 'Flatbed', axles: '3', capacity: '28', status: 'Available' },
  ],
  drivers: [
    { name: 'Ahmed Hassan', id: 'DRV-018', phone: '+966 55 000 0180', vehicle: 'ABC 4821', cardExpiry: '2027-01-20', status: 'Active' },
    { name: 'Omar Saleh', id: 'DRV-024', phone: '+966 55 000 0240', vehicle: 'KSA 7319', cardExpiry: '2026-11-15', status: 'Active' },
  ],
  maintenance: [
    { vehicle: 'KSA 7319', service: 'Engine oil & filters', interval: '20000', lastService: '2026-09-15', nextDue: '320000 km', status: 'Due soon' },
    { vehicle: 'ABC 4821', service: 'Preventive inspection', interval: '30000', lastService: '2026-10-01', nextDue: '300000 km', status: 'On track' },
  ],
  'job-cards': [
    { id: 'WO-2408', vehicle: 'KSA 7319', work: 'Brake inspection and adjustment', date: '2026-10-29', priority: 'High', mechanic: 'Rashid Karim', cost: '850', status: 'In progress' },
    { id: 'WO-2407', vehicle: 'DMM 2094', work: 'Preventive maintenance — 130,000 km', date: '2026-10-30', priority: 'Medium', mechanic: 'Mahmoud Ali', cost: '1200', status: 'Open' },
    { id: 'WO-2404', vehicle: 'ABC 4821', work: 'Engine oil and filter replacement', date: '2026-10-23', priority: 'Low', mechanic: 'Mahmoud Ali', cost: '680', status: 'Completed' },
  ],
  breakdowns: [
    { id: 'BD-1042', vehicle: 'KSA 7319', issue: 'Intermittent braking issue', date: '2026-10-28', location: 'Dammam highway', severity: 'High', status: 'Repairing' },
  ],
  'oil-changes': [
    { vehicle: 'ABC 4821', date: '2026-10-23', odometer: '284000', liters: '32', oilType: '15W-40', filter: 'Yes', cost: '680' },
    { vehicle: 'KSA 7319', date: '2026-09-30', odometer: '310500', liters: '34', oilType: '15W-40', filter: 'Yes', cost: '720' },
  ],
  tires: [
    { serial: 'FS-315-00841', size: '315/80 R22.5', brand: 'Firestone', position: 'ABC 4821 · Front axle', condition: 'Good', status: 'Fitted' },
    { serial: 'FS-315-00877', size: '315/80 R22.5', brand: 'Firestone', position: 'KSA 7319 · Rear axle', condition: 'Inspect', status: 'Fitted' },
    { serial: 'BR-385-00116', size: '385/65 R22.5', brand: 'Bridgestone', position: 'TRL 0912 · Axle 1', condition: 'Good', status: 'Fitted' },
    { serial: 'MC-315-00204', size: '315/80 R22.5', brand: 'Michelin', position: 'Warehouse · Rack A2', condition: 'New', status: 'In stock' },
  ],
  'spare-parts': [
    { name: 'Engine oil 15W-40', category: 'Engine Oil', sku: 'OIL-1540', unit: 'litre', stock: '420', reorder: '100', cost: '18' },
    { name: 'Oil filter — Actros MP5', category: 'Oil Filter', sku: 'OF-MP5', unit: 'pcs', stock: '24', reorder: '30', cost: '45' },
    { name: 'Diesel filter', category: 'Diesel Filter', sku: 'DF-220', unit: 'pcs', stock: '46', reorder: '20', cost: '68' },
    { name: 'Air filter', category: 'Air Filter', sku: 'AF-SET', unit: 'set', stock: '12', reorder: '8', cost: '125' },
  ],
  documents: [
    { document: 'Vehicle registration (Istimara)', asset: 'KSA 7319', number: 'REG-7319', issue: '2025-11-02', expiry: '2026-11-02', status: 'Expiring soon' },
    { document: 'Periodic inspection (MVPI)', asset: 'DMM 2094', number: 'MVPI-2094', issue: '2025-11-08', expiry: '2026-11-08', status: 'Expiring soon' },
    { document: 'Insurance policy', asset: 'TRL 0912', number: 'INS-0912', issue: '2026-01-14', expiry: '2026-12-14', status: 'Valid' },
    { document: 'Driver card', asset: 'Omar Saleh', number: 'DRV-024', issue: '2025-11-15', expiry: '2026-11-15', status: 'Expiring soon' },
  ],
  'purchase-invoices': [
    { id: 'INV-2026-184', supplier: 'Al Faisal Auto Parts', date: '2026-10-23', category: 'Filters & oil', subtotal: '4850', vat: '727.50', status: 'Posted' },
    { id: 'INV-2026-183', supplier: 'Gulf Tire Trading', date: '2026-10-21', category: 'Tires', subtotal: '12400', vat: '1860', status: 'Paid' },
  ],
  expenses: [
    { date: '2026-10-23', vehicle: 'ABC 4821', category: 'Engine oil & filters', description: 'Scheduled service', amount: '680', status: 'Approved' },
    { date: '2026-10-21', vehicle: 'KSA 7319', category: 'Brake parts', description: 'Workshop repair', amount: '850', status: 'Recorded' },
  ],
  mechanics: [
    { name: 'Mahmoud Ali', specialty: 'Diesel engine', phone: '+966 55 000 1101', jobs: '128', status: 'Active' },
    { name: 'Rashid Karim', specialty: 'Brakes & suspension', phone: '+966 55 000 1102', jobs: '96', status: 'Active' },
  ],
  excel: [
    { sheet: 'Trucks', record: 'ABC 4821', field: 'Odometer', before: '284,120', after: '285,400', status: 'Pending review' },
    { sheet: 'Oil Changes', record: 'KSA 7319', field: 'Service date', before: '2026-09-30', after: '2026-10-01', status: 'Accepted' },
  ],
  users: [
    { name: 'Demo Administrator', email: 'admin@demo.local', role: 'ADMIN', department: 'Management', status: 'Active' },
    { name: 'Workshop Manager', email: 'workshop@demo.local', role: 'MANAGER', department: 'Workshop', status: 'Active' },
    { name: 'Fleet Viewer', email: 'viewer@demo.local', role: 'VIEWER', department: 'Operations', status: 'Active' },
  ],
  organizations: [
    { name: 'Demo Transport Co.', slug: 'demo-transport', plan: 'Fleet + Workshop', users: '12', status: 'Active' },
    { name: 'Demo Logistics Branch', slug: 'demo-branch', plan: 'Fleet', users: '5', status: 'Trial' },
  ],
  notifications: [
    { title: 'Maintenance due', detail: 'KSA 7319 · Engine service', date: '2026-10-31', status: 'Unread' },
    { title: 'Document expiry', detail: 'Omar Saleh · Driver card', date: '2026-10-30', status: 'Unread' },
    { title: 'Job card completed', detail: 'ABC 4821 · WO-2404', date: '2026-10-29', status: 'Read' },
  ],
}

const currency = (value: number) => new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value)

export default function DemoPage() {
  const [active, setActive] = useState<ModuleId>('dashboard')
  const [data, setData] = useState<Partial<Record<ModuleId, RecordRow[]>>>(seed)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [form, setForm] = useState<RecordRow>({})
  const [mobileNav, setMobileNav] = useState(false)
  const [toast, setToast] = useState('Your isolated demo workspace is ready. All edits stay in this browser.')
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fleet-manager-pro-demo-v2')
      if (saved) setData({ ...seed, ...JSON.parse(saved) })
    } catch { /* Use the bundled fictional sample data. */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) localStorage.setItem('fleet-manager-pro-demo-v2', JSON.stringify(data))
  }, [data, hydrated])

  const current = modules.find(item => item.id === active)!
  const rows = data[active] || []
  const schema = fields[active] || []
  const visibleRows = useMemo(
    () => rows.filter(row => Object.values(row).join(' ').toLowerCase().includes(search.toLowerCase())),
    [rows, search]
  )
  const trucks = data.trucks || []
  const jobs = data['job-cards'] || []
  const tires = data.tires || []
  const parts = data['spare-parts'] || []
  const docs = data.documents || []
  const stockAlerts = parts.filter(part => Number(part.stock || 0) <= Number(part.reorder || 0)).length
  const openJobs = jobs.filter(job => job.status !== 'Completed').length
  const totalExpenses = (data.expenses || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)

  function notify(message: string) {
    setToast(message)
  }
  function openNew() {
    setEditing(null)
    setForm({})
    setModal(true)
  }
  function openEdit(index: number) {
    setEditing(index)
    setForm({ ...rows[index] })
    setModal(true)
  }
  function saveRecord() {
    const next = [...rows]
    if (editing === null) next.unshift(form)
    else next[editing] = form
    setData(previous => ({ ...previous, [active]: next }))
    setModal(false)
    setForm({})
    notify(editing === null ? 'Sample record created and saved in this browser.' : 'Sample record updated in this browser.')
  }
  function deleteRecord(index: number) {
    if (!window.confirm('Delete this sample record from the demo workspace?')) return
    setData(previous => ({ ...previous, [active]: (previous[active] || []).filter((_, i) => i !== index) }))
    notify('Sample record deleted.')
  }
  function exportCsv() {
    const keys = schema.length ? schema.map(field => field.key) : Object.keys(rows[0] || {})
    const csv = [keys.join(','), ...visibleRows.map(row => keys.map(key => '"' + String(row[key] || '').replaceAll('"', '""') + '"').join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'fleet-manager-pro-demo-' + active + '.csv'
    anchor.click()
    URL.revokeObjectURL(url)
    notify('CSV export prepared for ' + current.label + '.')
  }
  function resetDemo() {
    if (!window.confirm('Reset all demo changes and restore the original sample records?')) return
    setData(seed)
    localStorage.removeItem('fleet-manager-pro-demo-v2')
    notify('Demo workspace reset to the original sample dataset.')
  }
  function selectModule(id: ModuleId) {
    setActive(id)
    setSearch('')
    setMobileNav(false)
  }

  const sidebar = (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-sm"><Truck size={22}/></span>
          <span className="text-[15px] font-bold tracking-tight text-slate-900">Fleet Manager Pro<span className="mt-0.5 block text-[11px] font-medium text-slate-500">Fleet operations platform</span></span>
        </Link>
      </div>
      <div className="mx-3 mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-blue-700"><Building2 size={13}/> Demo workspace</div>
        <p className="mt-1.5 text-sm font-semibold text-slate-900">Demo Transport Co.</p>
        <p className="text-[11px] text-slate-500">Sample organization · Admin</p>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {['Overview', 'Fleet', 'Workshop', 'Inventory', 'Compliance', 'Finance', 'Insights', 'Workspace', 'Administration'].map(group => {
          const groupItems = modules.filter(item => item.group === group)
          if (!groupItems.length) return null
          return <div key={group} className="mb-3">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.15em] text-slate-400">{group}</p>
            {groupItems.map(item => {
              const Icon = item.icon
              return <button key={item.id} onClick={() => selectModule(item.id)} className={'mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-[9px] text-left text-[13px] font-medium transition ' + (active === item.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900')}>
                <Icon size={16} strokeWidth={1.9}/><span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.id === 'notifications' && <span className="h-1.5 w-1.5 rounded-full bg-amber-400"/>}
              </button>
            })}
          </div>
        })}
      </nav>
      <div className="border-t border-slate-100 p-3">
        <div className="rounded-lg bg-slate-50 p-3 text-[11px] leading-5 text-slate-500"><ShieldCheck size={15} className="mb-1 text-emerald-600"/>Sandbox mode is active. No production database, email, OneDrive or customer account is connected.</div>
        <div className="mt-3 flex items-center gap-2 px-1"><div className="grid h-8 w-8 place-items-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">DA</div><div><p className="text-xs font-semibold text-slate-800">Demo Administrator</p><p className="text-[10px] text-slate-500">Administrator preview</p></div></div>
      </div>
    </aside>
  )

  return <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
    <div className="flex min-h-screen">
      <div className="hidden lg:block">{sidebar}</div>
      {mobileNav && <div className="fixed inset-0 z-50 flex lg:hidden"><button aria-label="Close menu" className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileNav(false)}/><div className="relative z-10 h-full shadow-2xl">{sidebar}</div></div>}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-[66px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileNav(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu"><Menu size={20}/></button>
            <div className="min-w-0"><div className="hidden items-center gap-2 text-[10px] font-semibold uppercase tracking-[.13em] text-slate-400 sm:flex">Demo workspace <span>/</span> {current.group}</div><p className="truncate text-sm font-semibold text-slate-800 sm:mt-0.5">{current.label}</p></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700 sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/> Offline demo</span>
            <button onClick={resetDemo} title="Reset demo data" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><RefreshCw size={16}/></button>
            <Link href="/login" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Sign in</Link>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 sm:p-6 xl:p-8">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div><div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-blue-700"><span className="rounded bg-blue-50 px-2 py-1 uppercase tracking-wider">Live product preview</span><span className="text-slate-400">·</span><span className="text-slate-500">Fictional sample data</span></div>
                <h1 className="text-[26px] font-bold tracking-tight text-slate-950 sm:text-[30px]">{active === 'dashboard' ? 'Fleet overview' : current.label}</h1>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">{active === 'dashboard' ? 'Monitor vehicles, workshop workload, inventory and compliance from one workspace.' : current.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {active !== 'dashboard' && active !== 'analytics' && active !== 'reports' && active !== 'settings' && active !== 'notifications' && <><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><Download size={15}/> Export CSV</button><button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"><Plus size={16}/> Add {current.label.replace(/s$/, '')}</button></>}
                {(active === 'dashboard' || active === 'analytics') && <button onClick={() => notify('Sample dashboard metrics refreshed.')} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm"><RefreshCw size={15}/> Refresh data</button>}
              </div>
            </div>

            {toast && <div className="mb-5 flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50/80 px-3.5 py-2.5 text-xs text-blue-800"><span>{toast}</span><button onClick={() => setToast('')} aria-label="Dismiss message"><X size={14}/></button></div>}

            {active === 'dashboard' || active === 'analytics' ? <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Total fleet assets', value: String(trucks.length + (data.trailers || []).length), note: trucks.length + ' trucks · ' + (data.trailers || []).length + ' trailers', icon: Truck, tone: 'blue' },
                  { label: 'Open work orders', value: String(openJobs), note: 'Require workshop attention', icon: Wrench, tone: 'amber' },
                  { label: 'Tires tracked', value: String(tires.length), note: tires.filter(t => t.status === 'In stock').length + ' currently in stock', icon: CircleDot, tone: 'violet' },
                  { label: 'Parts to reorder', value: String(stockAlerts), note: 'At or below reorder level', icon: Package, tone: 'rose' },
                ].map(card => {
                  const Icon = card.icon
                  return <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,.03)] sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-slate-500">{card.label}</p><span className="rounded-lg bg-slate-100 p-2 text-slate-600"><Icon size={17}/></span></div><p className="mt-3 text-[30px] font-bold tracking-tight text-slate-950">{card.value}</p><p className="mt-1 text-[11px] text-slate-500">{card.note}</p></div>
                })}
              </div>
              <div className="mt-4 grid gap-4 xl:grid-cols-3">
                <section className="rounded-xl border border-slate-200 bg-white p-5 xl:col-span-2">
                  <div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">Workshop activity</h2><p className="mt-1 text-[11px] text-slate-500">Recent work orders across the sample fleet</p></div><button onClick={() => selectModule('job-cards')} className="text-xs font-semibold text-blue-700">View all <ArrowUpRight size={13} className="inline"/></button></div>
                  <div className="space-y-0">{jobs.slice(0, 4).map((job, index) => <div key={job.id + index} className="flex items-center gap-3 border-t border-slate-100 py-3 first:border-0"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-700"><Wrench size={16}/></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-800">{job.work}</p><p className="mt-1 text-[10px] text-slate-500">{job.id} · {job.vehicle} · {job.date}</p></div><Status value={job.status || 'Open'}/></div>)}</div>
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="text-sm font-bold">Needs attention</h2><p className="mt-1 text-[11px] text-slate-500">Items that may need action</p>
                  <button onClick={() => selectModule('documents')} className="mt-4 flex w-full items-start gap-3 border-t border-slate-100 py-3 text-left"><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><ShieldCheck size={16}/></span><span className="min-w-0 flex-1"><b className="block text-xs font-semibold">{docs.filter(d => d.status !== 'Valid').length} document alerts</b><small className="text-[10px] text-slate-500">Expiry and compliance follow-up</small></span><ArrowUpRight size={14}/></button>
                  <button onClick={() => selectModule('spare-parts')} className="flex w-full items-start gap-3 border-t border-slate-100 py-3 text-left"><span className="rounded-lg bg-rose-50 p-2 text-rose-700"><Boxes size={16}/></span><span className="min-w-0 flex-1"><b className="block text-xs font-semibold">{stockAlerts} low-stock items</b><small className="text-[10px] text-slate-500">Review reorder quantities</small></span><ArrowUpRight size={14}/></button>
                  <button onClick={() => selectModule('breakdowns')} className="flex w-full items-start gap-3 border-t border-slate-100 py-3 text-left"><span className="rounded-lg bg-orange-50 p-2 text-orange-700"><AlertTriangle size={16}/></span><span className="min-w-0 flex-1"><b className="block text-xs font-semibold">{(data.breakdowns || []).filter(b => b.status !== 'Resolved').length} active breakdowns</b><small className="text-[10px] text-slate-500">Open incident records</small></span><ArrowUpRight size={14}/></button>
                </section>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Fleet health</h2><button onClick={() => selectModule('trucks')} className="text-xs font-semibold text-blue-700">Fleet register →</button></div><div className="mt-4 space-y-4">{trucks.slice(0, 4).map((truck, i) => <div key={truck.plate}><div className="mb-1.5 flex justify-between gap-3 text-xs"><span className="font-semibold">{truck.plate} · {truck.name}</span><span className="text-slate-500">{i === 1 ? '68%' : i === 2 ? '81%' : '92%'}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: (i === 1 ? 68 : i === 2 ? 81 : 92) + '%' }}/></div></div>)}</div></section>
                <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Cost snapshot</h2><p className="mt-1 text-[11px] text-slate-500">Sample expense records · not accounting data</p><p className="mt-4 text-3xl font-bold tracking-tight">{currency(totalExpenses)}</p><div className="mt-4 flex h-2 overflow-hidden rounded-full bg-slate-100"><div className="w-[48%] bg-blue-600"/><div className="w-[32%] bg-indigo-400"/><div className="w-[20%] bg-amber-400"/></div><div className="mt-3 flex flex-wrap gap-4 text-[10px] text-slate-500"><span>● Workshop 48%</span><span>● Parts 32%</span><span>● Other 20%</span></div></section>
              </div>
            </> : active === 'reports' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[
              ['Maintenance summary', 'Work orders by status, vehicle and service type', Wrench, 'job-cards'],
              ['Tire inventory report', 'Tire serials, dimensions, position and condition', CircleDot, 'tires'],
              ['Oil consumption report', 'Litres used by vehicle and service date', Fuel, 'oil-changes'],
              ['Document expiry report', 'Issue dates, expiry dates and compliance status', ShieldCheck, 'documents'],
              ['Fleet cost report', 'Workshop, parts and vehicle expenses', Gauge, 'expenses'],
              ['Stock valuation report', 'Current quantity, units and reorder thresholds', Boxes, 'spare-parts'],
            ].map(([name, desc, Icon, target]) => <button key={String(name)} onClick={() => { selectModule(target as ModuleId); notify(String(name) + ' dataset opened. Use Export CSV to download the sample report.') }} className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><span className="mb-4 inline-flex rounded-xl bg-blue-50 p-3 text-blue-700"><Icon size={21}/></span><b className="block text-sm">{String(name)}</b><span className="mt-1 block text-xs leading-5 text-slate-500">{String(desc)}</span><span className="mt-4 block text-xs font-semibold text-blue-700">Open report →</span></button>)}</div> : active === 'settings' ? <div className="grid gap-4 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Workspace preferences</h2><p className="mt-1 text-xs text-slate-500">Illustrative settings; not connected to a live tenant.</p>{['Company profile and logo', 'Language: English / Arabic', 'Date format and timezone', 'Currency: Saudi Riyal (SAR)', 'Roles and permission templates'].map(item => <button key={item} onClick={() => notify(item + ' is represented in this preview only.')} className="mt-3 flex w-full items-center justify-between rounded-lg border border-slate-100 p-3 text-left text-xs font-medium hover:bg-slate-50">{item}<ChevronDown size={14} className="text-slate-400"/></button>)}</section>
              <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold">Integrations & automated alerts</h2><p className="mt-1 text-xs text-slate-500">Production connections are intentionally disabled.</p>{['Excel Online / OneDrive two-way sync', 'Document expiry email alerts', 'Maintenance reminders', 'Resend email delivery', 'Database storage monitor'].map(item => <div key={item} className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-xs"><span>{item}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500">Preview only</span></div>)}</section>
            </div> : active === 'notifications' ? <div className="rounded-xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-bold">Notification centre</h2><p className="mt-1 text-xs text-slate-500">Sample alerts generated for this demo workspace</p></div>{(data.notifications || []).map((item, i) => <div key={item.title + i} className="flex items-start gap-3 border-b border-slate-100 p-4 last:border-0"><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Bell size={16}/></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.detail}</p><p className="mt-1 text-[10px] text-slate-400">{item.date}</p></div><Status value={item.status}/><button onClick={() => setData(prev => ({ ...prev, notifications: (prev.notifications || []).map((row, index) => index === i ? { ...row, status: 'Read' } : row) }))} className="text-[10px] font-semibold text-blue-700">Mark read</button></div>)}</div> : <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,.03)]">
              <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><div><h2 className="text-sm font-bold">{current.label} register</h2><p className="mt-1 text-[11px] text-slate-500">{visibleRows.length} records shown · sample workspace</p></div><div className="flex flex-wrap gap-2"><div className="relative"><Search size={15} className="absolute left-3 top-2.5 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs outline-none focus:border-blue-400 sm:w-60"/></div><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"><Download size={14}/> Export</button></div></div>
              <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50/80"><tr>{schema.map(field => <th key={field.key} className="whitespace-nowrap px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">{field.label}</th>)}<th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</th></tr></thead><tbody>{visibleRows.map(row => { const index = rows.indexOf(row); return <tr key={index} className="border-t border-slate-100 transition hover:bg-slate-50/70">{schema.map(field => <td key={field.key} className="max-w-[240px] truncate px-4 py-3 text-xs text-slate-700">{field.key === 'status' || field.key === 'condition' || field.key === 'priority' ? <Status value={row[field.key] || '—'}/> : row[field.key] || '—'}</td>)}<td className="px-4 py-3"><div className="flex justify-end gap-1"><button onClick={() => openEdit(index)} title="Edit record" className="rounded-md p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil size={14}/></button><button onClick={() => deleteRecord(index)} title="Delete record" className="rounded-md p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 size={14}/></button></div></td></tr> })}</tbody></table>
                {visibleRows.length === 0 && <div className="px-4 py-14 text-center"><Search size={22} className="mx-auto mb-2 text-slate-300"/><p className="text-sm font-semibold text-slate-700">No matching records</p><p className="mt-1 text-xs text-slate-500">Change the search or add a sample record.</p></div>}
              </div>
              <div className="flex flex-col justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 text-[10px] text-slate-500 sm:flex-row"><span>Showing {visibleRows.length} of {rows.length} sample records</span><span>Changes are saved locally in this browser only</span></div>
            </section>}

            <div className="mt-6 flex flex-col justify-between gap-3 rounded-xl bg-slate-900 p-5 text-white sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17} className="text-emerald-400"/> Safe interactive sandbox</div><p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-300">Explore the product with fictional fleet data. Create, edit, delete and export sample records. This preview does not connect to production databases, real customer accounts, email alerts, payment services or Microsoft integrations.</p></div><Link href="/signup" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-400">Create your workspace <ArrowUpRight size={14} className="ml-1"/></Link></div>
            <footer className="flex flex-col justify-between gap-2 py-5 text-[10px] text-slate-400 sm:flex-row"><span>Fleet Manager Pro · Product demonstration</span><span>Fictional data · Local browser storage · No live integrations</span></footer>
          </div>
        </main>
      </div>
    </div>

    {modal && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-widest text-blue-700">{current.label}</p><h2 className="mt-1 text-xl font-bold">{editing === null ? 'Add sample record' : 'Edit sample record'}</h2><p className="mt-1 text-xs text-slate-500">Changes are isolated to this demo workspace.</p></div><button onClick={() => setModal(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button></div><div className="grid gap-4 sm:grid-cols-2">{schema.map(field => <label key={field.key} className="block text-xs font-semibold text-slate-700">{field.label}{field.options ? <select value={form[field.key] || ''} onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-400"><option value="">Select {field.label.toLowerCase()}</option>{field.options.map(option => <option key={option}>{option}</option>)}</select> : <input type={field.type || 'text'} value={form[field.key] || ''} onChange={event => setForm(prev => ({ ...prev, [field.key]: event.target.value }))} placeholder={field.placeholder || field.label} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-normal outline-none focus:border-blue-400"/>}</label>)}</div><div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4"><button onClick={() => setModal(false)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-600">Cancel</button><button onClick={saveRecord} disabled={schema.length > 0 && !schema.some(field => (form[field.key] || '').trim())} className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40">Save record</button></div></div></div>}
  </div>
}

function Status({ value }: { value: string }) {
  const text = value.toLowerCase()
  const tone = text.includes('complete') || text === 'active' || text === 'valid' || text === 'accepted' || text === 'paid' || text === 'good' || text === 'on track'
    ? 'bg-emerald-50 text-emerald-700'
    : text.includes('critical') || text.includes('expired') || text.includes('overdue') || text.includes('damaged') || text.includes('disabled')
      ? 'bg-rose-50 text-rose-700'
      : text.includes('high') || text.includes('due') || text.includes('pending') || text.includes('inspect') || text.includes('reorder') || text.includes('unread')
        ? 'bg-amber-50 text-amber-700'
        : 'bg-slate-100 text-slate-600'
  return <span className={'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ' + tone}>{value}</span>
}
