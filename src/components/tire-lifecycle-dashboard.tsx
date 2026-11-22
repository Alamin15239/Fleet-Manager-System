'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowLeftRight, CheckCircle2, Loader2, RefreshCw, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { apiGet, apiPost } from '@/lib/api'
import { toast } from '@/lib/localized-toast'

type Tire = {
  id: string; internalCode?: string | null; tireSize: string; manufacturer: string
  lifecycleStatus?: string; plateNumber?: string | null; trailerNumber?: string | null
}
type Vehicle = { id: string; vehicleType: 'truck' | 'trailer'; label: string; detail?: string; mileage?: number | null; driverName?: string | null }
type Report = {
  summary?: { inStock: number; installed: number; damaged: number; disposed: number; totalReceived: number; damageEvents: number }
  inventory?: any[]; damageByDriver?: any[]; damageByReason?: any[]; damageByVehicle?: any[]; vehicleUsage?: any[]; tireLife?: any[]; averageLife?: any[]
}

const eventLabels: Record<string, string> = {
  INSTALL: 'Install', TRANSFER: 'Transfer to another vehicle', POSITION_CHANGE: 'Change wheel position', REMOVE: 'Remove', DAMAGE: 'Report damage',
  REPAIR: 'Mark repaired', INSPECT: 'Inspect', DISPOSE: 'Dispose'
}

export default function TireLifecycleDashboard() {
  const [tires, setTires] = useState<Tire[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [eventType, setEventType] = useState('INSTALL')
  const [tireId, setTireId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [position, setPosition] = useState('')
  const [driverName, setDriverName] = useState('')
  const [odometerKm, setOdometerKm] = useState('')
  const [damageType, setDamageType] = useState('')
  const [repairable, setRepairable] = useState('unknown')
  const [reason, setReason] = useState('')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')

  const selectedTire = useMemo(() => tires.find(t => t.id === tireId), [tires, tireId])
  const selectedVehicle = useMemo(() => vehicles.find(v => v.id === vehicleId), [vehicles, vehicleId])
  const needsVehicle = eventType === 'INSTALL' || eventType === 'TRANSFER' || eventType === 'POSITION_CHANGE'
  const needsPosition = needsVehicle

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tiresRes, vehiclesRes, reportRes, eventsRes] = await Promise.all([
        apiGet('/api/tires?limit=1000'),
        apiGet('/api/tires/lifecycle-vehicles'),
        apiGet('/api/tires/lifecycle-report'),
        apiGet('/api/tires/events')
      ])
      const [tiresData, vehiclesData, reportData, eventsData] = await Promise.all([
        tiresRes.json(), vehiclesRes.json(), reportRes.json(), eventsRes.json()
      ])
      if (!tiresRes.ok) throw new Error(tiresData.error || 'Could not load tires')
      if (!vehiclesRes.ok) throw new Error(vehiclesData.error || 'Could not load vehicles')
      if (!reportRes.ok) throw new Error(reportData.error || 'Could not load tire reports')
      if (!eventsRes.ok) throw new Error(eventsData.error || 'Could not load tire history')
      setTires(tiresData.tires || [])
      setVehicles([...(vehiclesData.trucks || []), ...(vehiclesData.trailers || [])])
      setReport(reportData)
      setEvents(eventsData.events || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load tire lifecycle data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (selectedVehicle?.driverName && !driverName) setDriverName(selectedVehicle.driverName)
  }, [selectedVehicle, driverName])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tireId) return toast.error('Select a tire')
    if (needsVehicle && !selectedVehicle) return toast.error('Select a destination vehicle')
    if (needsPosition && !position.trim()) return toast.error('Enter the wheel position')
    setSaving(true)
    try {
      const response = await apiPost('/api/tires/events', {
        tireId, eventType,
        ...(selectedVehicle && needsVehicle ? { vehicleType: selectedVehicle.vehicleType, vehicleId: selectedVehicle.id } : {}),
        position: position.trim() || null,
        driverName: driverName.trim() || null,
        odometerKm: odometerKm ? Number(odometerKm) : null,
        damageType: damageType.trim() || null,
        repairable: eventType === 'DAMAGE' ? (repairable === 'yes' ? true : repairable === 'no' ? false : null) : null,
        reason: reason.trim() || null,
        cost: cost ? Number(cost) : null,
        notes: notes.trim() || null
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not save tire event')
      toast.success(`${eventLabels[eventType]} saved. ${data.jobCardId ? 'Linked to the open job card.' : ''}`)
      setPosition(''); setOdometerKm(''); setDamageType(''); setRepairable('unknown'); setReason(''); setCost(''); setNotes('')
      await load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save tire event')
    } finally {
      setSaving(false)
    }
  }

  const count = report?.summary || { inStock: 0, installed: 0, damaged: 0, disposed: 0, totalReceived: 0, damageEvents: 0 }
  const formatDate = (value: string) => value ? new Date(value).toLocaleDateString() : '—'
  const formatNumber = (value: unknown) => Number(value || 0).toLocaleString()

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Tire lifecycle</h2>
          <p className="text-sm text-muted-foreground">Track each tire from receipt through installation, transfer, damage, repair and disposal.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Received', count.totalReceived, 'text-foreground'],
          ['In stock', count.inStock, 'text-emerald-600'],
          ['Installed', count.installed, 'text-blue-600'],
          ['Damaged', count.damaged, 'text-amber-600'],
          ['Disposed', count.disposed, 'text-muted-foreground'],
          ['Damage reports', count.damageEvents, 'text-rose-600']
        ].map(([label, value, color]) => (
          <Card key={String(label)}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={`mt-1 text-2xl font-bold ${color}`}>{formatNumber(value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" />Record tire operation</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="space-y-2">
              <Label>Tire / internal ID</Label>
              <Select value={tireId} onValueChange={setTireId}>
                <SelectTrigger><SelectValue placeholder="Select a tire" /></SelectTrigger>
                <SelectContent>
                  {tires.map(t => <SelectItem key={t.id} value={t.id}>
                    {(t.internalCode || t.id)} · {t.tireSize} · {t.manufacturer} · {t.lifecycleStatus || 'STOCK'}
                  </SelectItem>)}
                </SelectContent>
              </Select>
              {selectedTire && <p className="text-xs text-muted-foreground">{selectedTire.plateNumber || selectedTire.trailerNumber || 'Not assigned'} · {selectedTire.lifecycleStatus || 'STOCK'}</p>}
            </div>
            <div className="space-y-2">
              <Label>Operation</Label>
              <Select value={eventType} onValueChange={value => { setEventType(value); setVehicleId(''); setPosition('') }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(eventLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {needsVehicle && <div className="space-y-2">
              <Label>{eventType === 'TRANSFER' ? 'Destination vehicle' : eventType === 'POSITION_CHANGE' ? 'Same vehicle' : 'Vehicle'}</Label>
              <Select value={vehicleId} onValueChange={value => { setVehicleId(value); const v = vehicles.find(item => item.id === value); if (v?.driverName) setDriverName(v.driverName) }}>
                <SelectTrigger><SelectValue placeholder="Select truck or trailer" /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.label}{v.detail ? ` · ${v.detail}` : ''}</SelectItem>)}</SelectContent>
              </Select>
            </div>}
            {needsPosition && <div className="space-y-2">
              <Label>Wheel position</Label>
              <Input value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Steer-LH, Drive-Outer-RH" />
            </div>}
            <div className="space-y-2">
              <Label>Driver at time of operation</Label>
              <Input value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Driver name" />
            </div>
            <div className="space-y-2">
              <Label>Odometer (km)</Label>
              <Input type="number" min="0" step="1" value={odometerKm} onChange={e => setOdometerKm(e.target.value)} placeholder="Vehicle mileage" />
            </div>
            {eventType === 'DAMAGE' && <>
              <div className="space-y-2"><Label>Damage type</Label><Input value={damageType} onChange={e => setDamageType(e.target.value)} placeholder="e.g. sidewall cut, puncture, burst" /></div>
              <div className="space-y-2"><Label>Damage reason</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. road debris, overload, impact" /></div>
              <div className="space-y-2"><Label>Repairable?</Label><Select value={repairable} onValueChange={setRepairable}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yes">Yes</SelectItem><SelectItem value="no">No</SelectItem><SelectItem value="unknown">Not assessed</SelectItem></SelectContent></Select></div>
            </>}
            {(eventType === 'DAMAGE' || eventType === 'REPAIR') && <div className="space-y-2"><Label>{eventType === 'REPAIR' ? 'Repair cost (SAR)' : 'Damage / replacement cost (SAR)'}</Label><Input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} /></div>}
            <div className="space-y-2 md:col-span-2 xl:col-span-3">
              <Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Additional details, inspection notes or damage location" />
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <Button type="submit" disabled={saving || loading}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : eventType === 'TRANSFER' ? <ArrowLeftRight className="mr-2 h-4 w-4" /> : eventType === 'DAMAGE' ? <AlertTriangle className="mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Save operation
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Inventory by size and brand</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Size</th><th>Brand</th><th>Status</th><th className="text-right">Count</th></tr></thead>
              <tbody>{(report?.inventory || []).map((row, i) => <tr key={i} className="border-b last:border-0"><td className="py-2">{row.tireSize}</td><td>{row.manufacturer}</td><td><Badge variant="outline">{row.lifecycleStatus}</Badge></td><td className="text-right">{formatNumber(row.tireCount)}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Damage accountability by driver</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Driver</th><th className="text-right">Reports</th><th className="text-right">Cost (SAR)</th></tr></thead>
              <tbody>{(report?.damageByDriver || []).map((row, i) => <tr key={i} className="border-b last:border-0"><td className="py-2">{row.driverName}</td><td className="text-right">{formatNumber(row.damageCount)}</td><td className="text-right">{Number(row.damageCost || 0).toLocaleString(undefined,{maximumFractionDigits:2})}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Damage reasons</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Damage type</th><th>Reason</th><th className="text-right">Count</th><th className="text-right">Cost (SAR)</th></tr></thead>
              <tbody>{(report?.damageByReason || []).map((row, i) => <tr key={i} className="border-b last:border-0"><td className="py-2">{row.damageType}</td><td>{row.reason}</td><td className="text-right">{formatNumber(row.damageCount)}</td><td className="text-right">{Number(row.damageCost || 0).toLocaleString(undefined,{maximumFractionDigits:2})}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Damage by vehicle</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Vehicle</th><th className="text-right">Damage reports</th><th className="text-right">Cost (SAR)</th></tr></thead>
              <tbody>{(report?.damageByVehicle || []).map((row, i) => <tr key={i} className="border-b last:border-0"><td className="py-2">{row.vehicleLabel}</td><td className="text-right">{formatNumber(row.damageCount)}</td><td className="text-right">{Number(row.damageCost || 0).toLocaleString(undefined,{maximumFractionDigits:2})}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Average tire life by brand and size</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Brand / size</th><th className="text-right">Tires</th><th className="text-right">Avg. days</th><th className="text-right">Known km</th></tr></thead>
              <tbody>{(report?.averageLife || []).map((row, i) => <tr key={i} className="border-b last:border-0"><td className="py-2">{row.manufacturer} · {row.tireSize}</td><td className="text-right">{formatNumber(row.tireCount)}</td><td className="text-right">{Math.round(Number(row.averageLifeDays || 0))}</td><td className="text-right">{formatNumber(Math.round(Number(row.averageLifeKm || 0)))}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Truck / trailer tire consumption</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Vehicle</th><th className="text-right">Tires used</th><th className="text-right">Usage days</th><th className="text-right">Known km</th></tr></thead>
              <tbody>{(report?.vehicleUsage || []).map((row, i) => <tr key={i} className="border-b last:border-0"><td className="py-2">{row.vehicleLabel}</td><td className="text-right">{formatNumber(row.tiresUsed)}</td><td className="text-right">{Math.round(Number(row.totalDays || 0))}</td><td className="text-right">{formatNumber(row.totalKm)}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Lifetime usage by tire</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Tire ID</th><th>Brand / size</th><th className="text-right">Installations</th><th className="text-right">Days</th><th className="text-right">Known km</th></tr></thead>
              <tbody>{(report?.tireLife || []).slice(0,100).map((row, i) => <tr key={row.id || i} className="border-b last:border-0"><td className="py-2">{row.internalCode || row.id}</td><td>{row.manufacturer} · {row.tireSize}</td><td className="text-right">{formatNumber(row.installations)}</td><td className="text-right">{Math.round(Number(row.lifetimeDays || 0))}</td><td className="text-right">{formatNumber(row.lifetimeKm)}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Recent tire history</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Date</th><th>Tire</th><th>Operation</th><th>Movement / position</th><th>Driver</th><th>Reason</th></tr></thead>
              <tbody>{events.slice(0,30).map((row, i) => <tr key={row.id || i} className="border-b last:border-0"><td className="py-2 whitespace-nowrap">{formatDate(row.eventAt)}</td><td>{row.internalCode || row.tireId}</td><td><Badge variant="outline">{row.eventType}</Badge></td><td>{row.fromVehicleLabel || 'Stock'} {row.fromPosition ? `· ${row.fromPosition}` : ''}{row.toVehicleLabel ? ` → ${row.toVehicleLabel}` : ''}{row.toPosition ? ` · ${row.toPosition}` : ''}</td><td>{row.driverNameSnapshot || '—'}</td><td>{row.reason || row.damageType || '—'}</td></tr>)}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
