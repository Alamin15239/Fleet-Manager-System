'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, Download, FileText, Gauge, Plus, RefreshCw, Search, ShieldAlert, Truck, Wrench } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { usePermissions } from '@/contexts/permissions-context'
import { LocalizedText } from '@/components/localized-text'
import { apiDelete, apiFetch, apiGet, apiPost, apiPut } from '@/lib/api'
import { toast } from '@/lib/localized-toast'

type VehicleType = { id: string; name: string; description?: string | null }
type VehicleDocument = { id: string; title: string; documentType: string; fileName: string; fileSize: number; validFrom?: string | null; validUntil?: string | null; reminderStartDate?: string | null; notes?: string | null }
type MaintenanceType = { id: string; name: string; description?: string | null; intervalDays?: number | null; intervalMileage?: number | null; reminderDaysBefore: number; vehicleTypes: VehicleType[] }
type Vehicle = { id: string; sourceType: 'FLEET' | 'TRUCK' | 'TRAILER'; vehicleNumber: string; vehicleTypeId: string; vehicleType: VehicleType; vin?: string | null; registrationNo?: string | null; make?: string | null; model?: string | null; year?: number | null; currentMileage?: number | null; engineHours?: number | null; driverName?: string | null; status: string; notes?: string | null; documents: VehicleDocument[] }
type JobCard = { id: string; jobNumber: string; truckId?: string | null; trailerId?: string | null; serviceDate: string; serviceType: string; status: string; nextServiceOdometer?: number | null; nextServiceDate?: string | null; createdAt: string; truck?: { id: string; licensePlate: string; currentMileage: number; make: string; model: string; year: number } | null; trailer?: { id: string; number: string } | null }

const emptyVehicle = { vehicleNumber: '', vehicleTypeId: '', vin: '', registrationNo: '', make: '', model: '', year: '', currentMileage: '', engineHours: '', driverName: '', status: 'ACTIVE', notes: '' }
const emptyMaintenanceType = { name: '', description: '', intervalDays: '', intervalMileage: '', reminderDaysBefore: '14', vehicleTypeIds: [] as string[] }
const vehicleDocumentTypes = ['Fire extinguisher', 'Operation card', 'Istimara', 'Insurance', 'Driver card', 'Fahas'] as const
const emptyDocument = { title: '', documentType: vehicleDocumentTypes[0] as string, validFrom: '', validUntil: '', reminderStartDate: '', notes: '' }
const apiError = (data: any, fallback: string) => typeof data?.error === 'string' ? data.error : fallback
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : '—'
function dateAtStartOfLocalDay(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}
function csvCell(value: unknown) { let text = String(value ?? ''); if (/^[=+\-@]/.test(text)) text = `'${text}`; return `"${text.replace(/"/g, '""')}"` }
function dueState(card: JobCard) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const now = today.getTime(), dueDate = dateAtStartOfLocalDay(card.nextServiceDate)
  const mileage = card.truck?.currentMileage ?? null
  if ((dueDate !== null && dueDate < now) || (mileage !== null && card.nextServiceOdometer != null && mileage >= card.nextServiceOdometer)) return 'overdue'
  if ((dueDate !== null && dueDate - now <= 30 * 86400000) || (mileage !== null && card.nextServiceOdometer != null && card.nextServiceOdometer - mileage <= 3000)) return 'due soon'
  return 'upcoming'
}

export function FleetPlanningWorkspace() {
  const { canAccess, canCreate, canUpdate, canDelete } = usePermissions()
  const canReadMaintenance = canAccess('maintenance')
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [maintenanceTypes, setMaintenanceTypes] = useState<MaintenanceType[]>([])
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState('')
  const [vehicleTypeName, setVehicleTypeName] = useState('')
  const [vehicleTypeDescription, setVehicleTypeDescription] = useState('')
  const [vehicleDialog, setVehicleDialog] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [vehicleForm, setVehicleForm] = useState({ ...emptyVehicle })
  const [maintenanceDialog, setMaintenanceDialog] = useState(false)
  const [editingMaintenanceType, setEditingMaintenanceType] = useState<MaintenanceType | null>(null)
  const [maintenanceForm, setMaintenanceForm] = useState({ ...emptyMaintenanceType })
  const [documentVehicle, setDocumentVehicle] = useState<Vehicle | null>(null)
  const [documentDialog, setDocumentDialog] = useState(false)
  const [documentForm, setDocumentForm] = useState({ ...emptyDocument })
  const [documentFile, setDocumentFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const requests = [apiGet('/api/vehicle-types'), apiGet('/api/fleet-vehicles')]
      if (canReadMaintenance) requests.push(apiGet('/api/maintenance-types'), apiGet('/api/job-cards?tracking=1'))
      const responses = await Promise.all(requests)
      const results = await Promise.all(responses.map(async response => ({ response, data: await response.json().catch(() => ({})) })))
      for (const { response, data } of results) if (!response.ok) throw new Error(apiError(data, 'Could not load fleet master data.'))
      setVehicleTypes(results[0].data.vehicleTypes || [])
      setVehicles([
        ...(results[1].data.fleetVehicles || []).map((vehicle: Vehicle) => ({ ...vehicle, sourceType: 'FLEET' as const })),
        ...(results[1].data.legacyVehicles || []),
      ])
      if (canReadMaintenance) {
        setMaintenanceTypes(results[2]?.data.maintenanceTypes || [])
        setJobCards(results[3]?.data.jobCards || [])
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not load fleet master data.') }
    finally { setLoading(false) }
  }, [canReadMaintenance])

  useEffect(() => { void load() }, [load])
  const visibleVehicles = useMemo(() => vehicles.filter(vehicle => `${vehicle.vehicleNumber} ${vehicle.make || ''} ${vehicle.model || ''} ${vehicle.driverName || ''} ${vehicle.vin || ''}`.toLowerCase().includes(search.toLowerCase())), [vehicles, search])
  const trackingRows = useMemo(() => {
    const latest = new Map<string, JobCard>()
    for (const card of [...jobCards].sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime())) {
      if (card.status !== 'COMPLETED') continue
      const key = card.truckId || card.trailerId || card.id
      if (!latest.has(key)) latest.set(key, card)
    }
    const priority: Record<string, number> = { overdue: 0, 'due soon': 1, upcoming: 2 }
    return [...latest.values()]
      .filter(card => card.nextServiceDate || card.nextServiceOdometer != null)
      .map(card => ({ card, state: dueState(card) }))
      .sort((a, b) => priority[a.state] - priority[b.state] || new Date(a.card.nextServiceDate || '9999-12-31').getTime() - new Date(b.card.nextServiceDate || '9999-12-31').getTime())
  }, [jobCards])
  const expiringDocuments = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayTime = today.getTime()
    return vehicles.flatMap(vehicle => (vehicle.documents || []).filter(document => document.validUntil).map(document => {
      const expiryTime = dateAtStartOfLocalDay(document.validUntil)
      const reminderTime = dateAtStartOfLocalDay(document.reminderStartDate)
      return { vehicle, document, expired: expiryTime !== null && expiryTime < todayTime, reminder: reminderTime !== null && reminderTime <= todayTime }
    })).filter(item => item.expired || item.reminder)
  }, [vehicles])

  async function saveVehicle(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try { const response = editingVehicle ? await apiPut(`/api/fleet-vehicles/${editingVehicle.id}`, vehicleForm) : await apiPost('/api/fleet-vehicles', vehicleForm); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(data, 'Could not save vehicle.')); toast.success(editingVehicle ? 'Vehicle updated.' : 'Vehicle added.'); setVehicleDialog(false); setEditingVehicle(null); setVehicleForm({ ...emptyVehicle }); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save vehicle.') } finally { setBusy(false) }
  }
  async function addVehicleType(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try { const response = await apiPost('/api/vehicle-types', { name: vehicleTypeName, description: vehicleTypeDescription }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(data, 'Could not add vehicle type.')); setVehicleTypeName(''); setVehicleTypeDescription(''); toast.success('Vehicle type added.'); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add vehicle type.') } finally { setBusy(false) }
  }
  async function saveMaintenanceType(event: React.FormEvent) {
    event.preventDefault(); setBusy(true)
    try { const response = editingMaintenanceType ? await apiPut(`/api/maintenance-types/${editingMaintenanceType.id}`, maintenanceForm) : await apiPost('/api/maintenance-types', maintenanceForm); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(data, 'Could not save maintenance type.')); toast.success(editingMaintenanceType ? 'Maintenance type updated.' : 'Maintenance type added.'); setMaintenanceDialog(false); setEditingMaintenanceType(null); setMaintenanceForm({ ...emptyMaintenanceType }); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save maintenance type.') } finally { setBusy(false) }
  }
  async function saveDocument(event: React.FormEvent) {
    event.preventDefault(); if (!documentVehicle || !documentFile) { toast.error('Choose a file to upload.'); return }
    const body = new FormData(); body.append('file', documentFile); body.append('sourceId', documentVehicle.id); body.append('sourceType', documentVehicle.sourceType); Object.entries(documentForm).forEach(([key, value]) => body.append(key, value)); setBusy(true)
    try { const response = await apiFetch('/api/vehicle-documents', { method: 'POST', body }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(apiError(data, 'Could not upload document.')); toast.success('Vehicle document uploaded.'); setDocumentDialog(false); setDocumentFile(null); setDocumentForm({ ...emptyDocument }); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not upload document.') } finally { setBusy(false) }
  }
  async function openDocument(document: VehicleDocument) {
    try { const response = await apiFetch(`/api/vehicle-documents/${document.id}`, { method: 'GET' }); if (!response.ok) throw new Error('Could not open document.'); const url = URL.createObjectURL(await response.blob()); window.open(url, '_blank', 'noopener,noreferrer'); window.setTimeout(() => URL.revokeObjectURL(url), 60000) }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not open document.') }
  }
  async function deleteVehicle(vehicle: Vehicle) {
    if (!window.confirm(`Delete ${vehicle.vehicleNumber} and its uploaded documents?`)) return
    try { const response = await apiDelete(`/api/fleet-vehicles/${vehicle.id}`); if (!response.ok) throw new Error('Could not delete vehicle.'); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete vehicle.') }
  }
  async function archiveMaintenanceType(type: MaintenanceType) {
    if (!window.confirm(`Archive ${type.name}?`)) return
    try { const response = await apiDelete(`/api/maintenance-types/${type.id}`); if (!response.ok) throw new Error('Could not archive maintenance type.'); await load() }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Could not archive maintenance type.') }
  }
  function downloadCsv(filename: string, rows: unknown[][]) {
    const blob = new Blob([rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url)
  }
  function downloadMaintenanceReport() {
    downloadCsv('job-card-maintenance-tracking.csv', [['Vehicle','Job card','Service type','Last service date','Next service date','Next service odometer','Current mileage','Status'], ...trackingRows.map(({card,state}) => [card.truck?.licensePlate || `Trailer ${card.trailer?.number || ''}`, card.jobNumber, card.serviceType, formatDate(card.serviceDate), formatDate(card.nextServiceDate), card.nextServiceOdometer ?? '', card.truck?.currentMileage ?? '', state])])
  }
  const field = (label: string, id: string, value: string, onChange: (value: string) => void, type = 'text', required = false) => <div className="space-y-1.5" key={id}><Label htmlFor={id}>{label}</Label><Input id={id} type={type} value={value} required={required} onChange={event => onChange(event.target.value)} /></div>

  return <div className="mx-auto w-full max-w-[1500px] space-y-5 p-4 md:p-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="mb-1 flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-300"><CalendarClock className="h-4 w-4"/>Fleet planning</div><h1 className="text-2xl font-bold tracking-tight md:text-3xl">Vehicle master & maintenance tracking</h1><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Manage mixed vehicle types and document validity. Maintenance due dates come from completed job cards.</p></div><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`me-2 h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</Button></div>
    <div className="flex gap-2 rounded-xl border border-sky-500/15 bg-sky-500/5 p-3 text-sm text-muted-foreground"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"/><p><strong className="text-foreground">Job cards remain the maintenance record.</strong> Set the next service date or odometer on a job card. This page tracks those due values and alerts for uploaded document expiry. <a href="/job-cards" className="font-medium text-primary hover:underline">Open Job Cards</a>.</p></div>

    <Tabs defaultValue="tracking" className="space-y-4"><TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:justify-start"><TabsTrigger value="tracking"><Gauge className="me-1.5"/>Tracking</TabsTrigger><TabsTrigger value="vehicles"><Truck className="me-1.5"/>Vehicle Master</TabsTrigger>{canReadMaintenance&&<TabsTrigger value="maintenance"><Wrench className="me-1.5"/>Maintenance Types</TabsTrigger>}<TabsTrigger value="reports"><FileText className="me-1.5"/>Reports</TabsTrigger></TabsList>
      <TabsContent value="tracking" className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={<Truck className="h-4 w-4"/>} label="Fleet vehicles" value={vehicles.length} tone="blue"/><Metric icon={<Wrench className="h-4 w-4"/>} label="Due soon" value={trackingRows.filter(row=>row.state==='due soon').length} tone="amber"/><Metric icon={<ShieldAlert className="h-4 w-4"/>} label="Overdue maintenance" value={trackingRows.filter(row=>row.state==='overdue').length} tone="rose"/><Metric icon={<FileText className="h-4 w-4"/>} label="Documents needing attention" value={expiringDocuments.length} tone="violet"/></div>
        {canReadMaintenance&&<Card className="glass-card"><CardHeader><CardTitle>Next service from completed job cards</CardTitle><CardDescription>One latest completed job card per truck or trailer. Update next service from the job card form.</CardDescription></CardHeader><CardContent>{trackingRows.length?<div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[850px] text-sm"><thead className="bg-muted/60 text-left"><tr>{['Vehicle','Job card','Service','Last service','Next service date','Next service km','Current km','Status'].map(label=><th key={label} className="px-3 py-2.5 font-medium">{label}</th>)}</tr></thead><tbody>{trackingRows.map(({card,state})=><tr key={card.id} className="border-t"><td className="px-3 py-2.5 font-semibold">{card.truck?.licensePlate||`Trailer ${card.trailer?.number||''}`}</td><td className="px-3 py-2.5">{card.jobNumber}</td><td className="px-3 py-2.5">{card.serviceType}</td><td className="px-3 py-2.5">{formatDate(card.serviceDate)}</td><td className="px-3 py-2.5">{formatDate(card.nextServiceDate)}</td><td className="px-3 py-2.5">{card.nextServiceOdometer?.toLocaleString()??'—'}</td><td className="px-3 py-2.5">{card.truck?.currentMileage?.toLocaleString()??'—'}</td><td className="px-3 py-2.5"><StateBadge state={state}/></td></tr>)}</tbody></table></div>:<Empty>Completed job cards with a next-service date or odometer will appear here.</Empty>}</CardContent></Card>}
        <Card className="glass-card"><CardHeader><CardTitle>Document validity</CardTitle><CardDescription>Vehicle documents that have expired or reached their reminder date.</CardDescription></CardHeader><CardContent>{expiringDocuments.length?<div className="grid gap-3 md:grid-cols-2">{expiringDocuments.map(({vehicle,document,expired})=><div key={document.id} className="flex items-center justify-between gap-3 rounded-lg border p-3"><div className="min-w-0"><p className="truncate font-medium">{document.title} · {vehicle.vehicleNumber}</p><p className="text-xs text-muted-foreground">Valid until {formatDate(document.validUntil)} · Reminder {formatDate(document.reminderStartDate)}</p></div><StateBadge state={expired?'expired':'due soon'}/></div>)}</div>:<Empty>No uploaded documents are currently due or expired.</Empty>}</CardContent></Card>
      </TabsContent>

      <TabsContent value="vehicles" className="space-y-4"><Card className="glass-card"><CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Vehicle Master & Existing Fleet</CardTitle><CardDescription>Manage new mixed fleet assets and set document expiry for existing trucks and trailers too.</CardDescription></div><Button disabled={!canCreate('trucks')} onClick={()=>{setEditingVehicle(null);setVehicleForm({...emptyVehicle,vehicleTypeId:vehicleTypes[0]?.id||''});setVehicleDialog(true)}}><Plus className="me-2 h-4 w-4"/>Add vehicle</Button></CardHeader><CardContent className="space-y-4"><div className="relative max-w-sm"><Search className="absolute start-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search number, VIN, make, or driver" className="ps-9"/></div>{loading?<Empty>Loading vehicle master…</Empty>:visibleVehicles.length?<div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[900px] text-sm"><thead className="bg-muted/60 text-left"><tr>{['Vehicle','Type','Make / model','Year','Mileage / hours','Driver','Documents','Actions'].map(label=><th key={label} className="px-3 py-2.5 font-medium">{label}</th>)}</tr></thead><tbody>{visibleVehicles.map(vehicle=><tr key={`${vehicle.sourceType}-${vehicle.id}`} className="border-t"><td className="px-3 py-2.5"><b>{vehicle.vehicleNumber}</b><div className="text-xs text-muted-foreground">{vehicle.registrationNo||vehicle.vin||'No registration / VIN'}</div></td><td className="px-3 py-2.5">{vehicle.vehicleType.name}</td><td className="px-3 py-2.5">{[vehicle.make,vehicle.model].filter(Boolean).join(' ')||'—'}</td><td className="px-3 py-2.5">{vehicle.year||'—'}</td><td className="px-3 py-2.5">{vehicle.currentMileage?.toLocaleString()??'—'} km {vehicle.engineHours!=null?`· ${vehicle.engineHours.toLocaleString()} h`:''}</td><td className="px-3 py-2.5">{vehicle.driverName||'—'}</td><td className="px-3 py-2.5"><Button size="sm" variant="outline" onClick={()=>{setDocumentVehicle(vehicle);setDocumentDialog(true)}}><FileText className="me-1 h-4 w-4"/>{vehicle.documents?.length||0}</Button></td><td className="px-3 py-2.5"><div className="flex gap-1">{vehicle.sourceType==='FLEET'?<><Button size="sm" variant="ghost" disabled={!canUpdate('trucks')} onClick={()=>{setEditingVehicle(vehicle);setVehicleForm({vehicleNumber:vehicle.vehicleNumber,vehicleTypeId:vehicle.vehicleTypeId,vin:vehicle.vin||'',registrationNo:vehicle.registrationNo||'',make:vehicle.make||'',model:vehicle.model||'',year:String(vehicle.year||''),currentMileage:String(vehicle.currentMileage??''),engineHours:String(vehicle.engineHours??''),driverName:vehicle.driverName||'',status:vehicle.status,notes:vehicle.notes||''});setVehicleDialog(true)}}>Edit</Button>{canDelete('trucks')&&<Button size="sm" variant="ghost" className="text-destructive" onClick={()=>void deleteVehicle(vehicle)}>Delete</Button>}</>:<a className="inline-flex h-9 items-center rounded-md px-3 text-sm text-primary hover:bg-muted" href={vehicle.sourceType==='TRUCK'?'/trucks':'/trailers'}>Manage</a>}</div></td></tr>)}</tbody></table></div>:<Empty>No vehicles match this search. Add your first master vehicle to manage documents here.</Empty>}</CardContent></Card>
        <Card className="glass-card"><CardHeader><CardTitle>Vehicle Types</CardTitle><CardDescription>Set the categories used by the vehicle master and maintenance catalog.</CardDescription></CardHeader><CardContent><form onSubmit={addVehicleType} className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]"><Input required maxLength={80} value={vehicleTypeName} onChange={e=>setVehicleTypeName(e.target.value)} placeholder="e.g. Forklift"/><Input value={vehicleTypeDescription} onChange={e=>setVehicleTypeDescription(e.target.value)} placeholder="Description (optional)"/><Button type="submit" disabled={!canCreate('trucks')||busy}><Plus className="me-1 h-4 w-4"/>Add type</Button></form><div className="mt-4 flex flex-wrap gap-2">{vehicleTypes.map(type=><Badge key={type.id} variant="secondary" className="px-3 py-1">{type.name}</Badge>)}</div></CardContent></Card>
      </TabsContent>

      {canReadMaintenance&&<TabsContent value="maintenance" className="space-y-4"><Card className="glass-card"><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>Maintenance Types</CardTitle><CardDescription>Define each service, repeat interval, reminder lead time, and applicable vehicle types. Types are selectable on job cards.</CardDescription></div><Button disabled={!canCreate('maintenance')} onClick={()=>{setEditingMaintenanceType(null);setMaintenanceForm({...emptyMaintenanceType});setMaintenanceDialog(true)}}><Plus className="me-2 h-4 w-4"/>Add maintenance type</Button></CardHeader><CardContent>{maintenanceTypes.length?<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{maintenanceTypes.map(type=><div key={type.id} className="rounded-xl border bg-background/60 p-4"><div className="flex items-start justify-between"><div><h3 className="font-semibold">{type.name}</h3><p className="mt-1 text-sm text-muted-foreground">{type.description||'No service description provided.'}</p></div><Wrench className="h-4 w-4 text-teal-600"/></div><div className="mt-3 flex flex-wrap gap-2 text-xs"><Badge variant="outline">{type.intervalDays?`Every ${type.intervalDays} days`:'No day interval'}</Badge><Badge variant="outline">{type.intervalMileage?`Every ${type.intervalMileage.toLocaleString()} km`:'No mileage interval'}</Badge><Badge variant="secondary">Remind {type.reminderDaysBefore} days before</Badge></div><p className="mt-3 text-xs text-muted-foreground">For: {type.vehicleTypes.length?type.vehicleTypes.map(item=>item.name).join(', '):'All vehicle types'}</p><div className="mt-3 flex gap-2">{canUpdate('maintenance')&&<Button size="sm" variant="outline" onClick={()=>{setEditingMaintenanceType(type);setMaintenanceForm({name:type.name,description:type.description||'',intervalDays:String(type.intervalDays||''),intervalMileage:String(type.intervalMileage||''),reminderDaysBefore:String(type.reminderDaysBefore),vehicleTypeIds:type.vehicleTypes.map(item=>item.id)});setMaintenanceDialog(true)}}>Edit</Button>}{canDelete('maintenance')&&<Button size="sm" variant="ghost" className="text-destructive" onClick={()=>void archiveMaintenanceType(type)}>Archive</Button>}</div></div>)}</div>:<Empty>Add service types such as oil service, brake inspection, or registration renewal.</Empty>}</CardContent></Card></TabsContent>}

      <TabsContent value="reports" className="space-y-4"><Card className="glass-card"><CardHeader><CardTitle>Fleet reports</CardTitle><CardDescription>Download current vehicle master, document validity, and job-card maintenance tracking data.</CardDescription></CardHeader><CardContent><div className="grid gap-3 sm:grid-cols-3"><Button variant="outline" className="justify-start" onClick={()=>downloadCsv('vehicle-master.csv',[['Vehicle','Type','VIN','Registration','Make','Model','Year','Mileage km','Engine hours','Driver','Status'],...vehicles.map(v=>[v.vehicleNumber,v.vehicleType.name,v.vin||'',v.registrationNo||'',v.make||'',v.model||'',v.year??'',v.currentMileage??'',v.engineHours??'',v.driverName||'',v.status])])}><Download className="me-2 h-4 w-4"/>Vehicle master</Button><Button variant="outline" className="justify-start" onClick={()=>downloadCsv('vehicle-documents.csv',[['Vehicle','Document','Type','File','Valid from','Valid until','Reminder starts','Notes'],...vehicles.flatMap(v=>(v.documents||[]).map(d=>[v.vehicleNumber,d.title,d.documentType,d.fileName,formatDate(d.validFrom),formatDate(d.validUntil),formatDate(d.reminderStartDate),d.notes||'']))])}><Download className="me-2 h-4 w-4"/>Document validity</Button><Button variant="outline" className="justify-start" onClick={downloadMaintenanceReport} disabled={!canReadMaintenance}><Download className="me-2 h-4 w-4"/>Job-card tracking</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Metric icon={<CalendarClock className="h-4 w-4"/>} label="Next-service records" value={trackingRows.length} tone="blue"/><Metric icon={<Wrench className="h-4 w-4"/>} label="Due soon" value={trackingRows.filter(row=>row.state==='due soon').length} tone="amber"/><Metric icon={<ShieldAlert className="h-4 w-4"/>} label="Overdue" value={trackingRows.filter(row=>row.state==='overdue').length} tone="rose"/></div></CardContent></Card></TabsContent>
    </Tabs>

    <Dialog open={vehicleDialog} onOpenChange={setVehicleDialog}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editingVehicle?'Edit vehicle':'Add vehicle to master'}</DialogTitle><DialogDescription>Register a fleet asset with its own type and identifying information.</DialogDescription></DialogHeader><form onSubmit={saveVehicle} className="grid gap-4 sm:grid-cols-2">{field('Vehicle number','vehicleNumber',vehicleForm.vehicleNumber,v=>setVehicleForm({...vehicleForm,vehicleNumber:v}),'text',true)}<div className="space-y-1.5"><Label>Vehicle type</Label><select required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vehicleForm.vehicleTypeId} onChange={e=>setVehicleForm({...vehicleForm,vehicleTypeId:e.target.value})}><option value="">Select type</option>{vehicleTypes.map(type=><option key={type.id} value={type.id}>{type.name}</option>)}</select></div>{field('VIN','vin',vehicleForm.vin,v=>setVehicleForm({...vehicleForm,vin:v}))}{field('Registration / Istimara no.','registrationNo',vehicleForm.registrationNo,v=>setVehicleForm({...vehicleForm,registrationNo:v}))}{field('Make','make',vehicleForm.make,v=>setVehicleForm({...vehicleForm,make:v}))}{field('Model','model',vehicleForm.model,v=>setVehicleForm({...vehicleForm,model:v}))}{field('Year','year',vehicleForm.year,v=>setVehicleForm({...vehicleForm,year:v}),'number')}{field('Current mileage (km)','currentMileage',vehicleForm.currentMileage,v=>setVehicleForm({...vehicleForm,currentMileage:v}),'number')}{field('Engine hours','engineHours',vehicleForm.engineHours,v=>setVehicleForm({...vehicleForm,engineHours:v}),'number')}{field('Assigned driver','driverName',vehicleForm.driverName,v=>setVehicleForm({...vehicleForm,driverName:v}))}<div className="space-y-1.5"><Label>Status</Label><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={vehicleForm.status} onChange={e=>setVehicleForm({...vehicleForm,status:e.target.value})}><option value="ACTIVE">Active</option><option value="MAINTENANCE">In maintenance</option><option value="INACTIVE">Inactive</option></select></div><div className="space-y-1.5 sm:col-span-2"><Label>Notes</Label><Textarea value={vehicleForm.notes} onChange={e=>setVehicleForm({...vehicleForm,notes:e.target.value})}/></div><DialogFooter className="sm:col-span-2"><Button type="button" variant="outline" onClick={()=>setVehicleDialog(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Saving…':editingVehicle?'Save changes':'Add vehicle'}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={maintenanceDialog} onOpenChange={setMaintenanceDialog}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editingMaintenanceType?'Edit maintenance type':'New maintenance type'}</DialogTitle><DialogDescription>Define the service reference that users can select on job cards.</DialogDescription></DialogHeader><form onSubmit={saveMaintenanceType} className="space-y-4">{field('Maintenance type name','maintenanceName',maintenanceForm.name,v=>setMaintenanceForm({...maintenanceForm,name:v}),'text',true)}<div className="space-y-1.5"><Label>What it covers / when to do it</Label><Textarea value={maintenanceForm.description} onChange={e=>setMaintenanceForm({...maintenanceForm,description:e.target.value})}/></div><div className="grid gap-3 sm:grid-cols-3">{field('Repeat every (days)','intervalDays',maintenanceForm.intervalDays,v=>setMaintenanceForm({...maintenanceForm,intervalDays:v}),'number')}{field('Repeat every (km)','intervalMileage',maintenanceForm.intervalMileage,v=>setMaintenanceForm({...maintenanceForm,intervalMileage:v}),'number')}{field('Reminder lead (days)','reminderDaysBefore',maintenanceForm.reminderDaysBefore,v=>setMaintenanceForm({...maintenanceForm,reminderDaysBefore:v}),'number')}</div><div className="space-y-2"><Label>Applicable vehicle types (leave empty for all)</Label><div className="grid grid-cols-2 gap-2 rounded-lg border p-3">{vehicleTypes.map(type=><label key={type.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={maintenanceForm.vehicleTypeIds.includes(type.id)} onChange={e=>setMaintenanceForm({...maintenanceForm,vehicleTypeIds:e.target.checked?[...maintenanceForm.vehicleTypeIds,type.id]:maintenanceForm.vehicleTypeIds.filter(id=>id!==type.id)})}/>{type.name}</label>)}</div></div><DialogFooter><Button type="button" variant="outline" onClick={()=>setMaintenanceDialog(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy?'Saving…':'Save maintenance type'}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={documentDialog} onOpenChange={setDocumentDialog}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Vehicle documents · {documentVehicle?.vehicleNumber}</DialogTitle><DialogDescription>Upload a current vehicle document and set its expiry and reminder dates. Re-uploading the same document type replaces its current file. PDF/JPG/PNG/WEBP files up to 4 MB are stored in this organization’s database.</DialogDescription></DialogHeader><form onSubmit={saveDocument} className="space-y-4"><div className="space-y-1.5"><Label>Existing documents</Label>{documentVehicle?.documents?.length?<div className="space-y-2">{documentVehicle.documents.map(doc=><div key={doc.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5"><div className="min-w-0"><div className="truncate text-sm font-medium"><LocalizedText>{doc.documentType}</LocalizedText> · {doc.title}</div><div className="text-xs text-muted-foreground">Valid until {formatDate(doc.validUntil)} · Reminder starts {formatDate(doc.reminderStartDate)}</div></div><Button type="button" size="sm" variant="outline" onClick={()=>void openDocument(doc)}>View</Button></div>)}</div>:<p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}</div><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="documentTitle">Document title</Label><Input id="documentTitle" value={documentForm.title} onChange={e=>setDocumentForm({...documentForm,title:e.target.value})} placeholder="Optional reference or document number"/></div><div className="space-y-1.5"><Label htmlFor="documentType">Document type</Label><select id="documentType" required className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={documentForm.documentType} onChange={e=>setDocumentForm({...documentForm,documentType:e.target.value as typeof vehicleDocumentTypes[number]})}>{vehicleDocumentTypes.map(type=><option key={type} value={type}><LocalizedText>{type}</LocalizedText></option>)}</select></div><div className="space-y-1.5"><Label htmlFor="validFrom">Valid from</Label><Input id="validFrom" type="date" value={documentForm.validFrom} onChange={e=>setDocumentForm({...documentForm,validFrom:e.target.value})}/></div><div className="space-y-1.5"><Label htmlFor="validUntil">Expiry date</Label><Input id="validUntil" type="date" required value={documentForm.validUntil} onChange={e=>setDocumentForm({...documentForm,validUntil:e.target.value})}/></div><div className="space-y-1.5 sm:col-span-2"><Label htmlFor="reminderStartDate">Start reminder date</Label><Input id="reminderStartDate" type="date" required value={documentForm.reminderStartDate} onChange={e=>setDocumentForm({...documentForm,reminderStartDate:e.target.value})}/></div></div><div className="space-y-1.5"><Label>File (max 4 MB)</Label><Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required onChange={e=>setDocumentFile(e.target.files?.[0]||null)}/></div><div className="space-y-1.5"><Label>Notes</Label><Textarea value={documentForm.notes} onChange={e=>setDocumentForm({...documentForm,notes:e.target.value})}/></div><DialogFooter><Button type="button" variant="outline" onClick={()=>setDocumentDialog(false)}>Close</Button><Button type="submit" disabled={busy||!canCreate('trucks')}>{busy?'Uploading…':'Save expiry document'}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>
}

function Metric({icon,label,value,tone}:{icon:React.ReactNode;label:string;value:number;tone:string}) { const tones:Record<string,string>={blue:'bg-blue-500/10 text-blue-600 dark:text-blue-400',amber:'bg-amber-500/10 text-amber-600 dark:text-amber-400',rose:'bg-rose-500/10 text-rose-600 dark:text-rose-400',violet:'bg-violet-500/10 text-violet-600 dark:text-violet-400'};return <Card className="glass-card"><CardContent className="flex items-center gap-3 p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]||tones.blue}`}>{icon}</span><div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold tabular-nums">{value}</p></div></CardContent></Card> }
function StateBadge({state}:{state:string}) { const styles:Record<string,string>={overdue:'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300','due soon':'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300',upcoming:'border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300',expired:'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'};return <Badge variant="outline" className={styles[state]||''}>{state}</Badge> }
function Empty({children}:{children:React.ReactNode}) { return <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{children}</div> }
