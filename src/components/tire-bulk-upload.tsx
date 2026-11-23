'use client'
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from '@/lib/localized-toast'

type ActiveVehicle = {
  licensePlate: string
  driverName: string | null
  make: string | null
  model: string | null
  year: number | null
}

export default function TireBulkUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [tireSize, setTireSize] = useState('')
  const [origin, setOrigin] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingTrucks, setLoadingTrucks] = useState(true)
  const [trucks, setTrucks] = useState<ActiveVehicle[]>([])
  const [trailers, setTrailers] = useState<Array<{ number: string; driverName: string | null }>>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const loadTrucks = async () => {
      try {
        const response = await fetch('/api/tires/bulk-upload', { credentials: 'include' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not load active trucks.')
        if (!cancelled) {
          setTrucks(Array.isArray(result.trucks) ? result.trucks : [])
          setTrailers(Array.isArray(result.trailers) ? result.trailers : [])
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load active trucks.')
      } finally {
        if (!cancelled) setLoadingTrucks(false)
      }
    }
    loadTrucks()
    return () => { cancelled = true }
  }, [])

  const downloadTemplate = () => {
    if (!trucks.length) {
      setError('No active trucks are available. Add or activate a truck before downloading the template.')
      return
    }
    const truck = trucks[0]
    const localDate = new Date()
    const date = [localDate.getFullYear(), String(localDate.getMonth() + 1).padStart(2, '0'), String(localDate.getDate()).padStart(2, '0')].join('-')
    const csv = [
      'Date,Vehicle Type,Truck #,Trailer #,Name Driver,Serial Number,OUT QTY',
      [date, 'TRUCK', truck.licensePlate, '', truck.driverName || 'Driver Name', 'SERIAL-001', '1'].map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'tire-outgoing-upload-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const submit = async () => {
    if (!file || !tireSize.trim() || !origin) { setError('Choose a file, tire size, and origin before uploading.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const data = new FormData()
      data.append('file', file)
      data.append('tireSize', tireSize.trim())
      data.append('origin', origin)
      const response = await fetch('/api/tires/bulk-upload', { method: 'POST', credentials: 'include', body: data })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Upload failed')
      setMessage(result.message)
      toast.success(result.message)
      setFile(null)
      const fileInput = document.getElementById('tire-bulk-file') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed'
      setError(msg); toast.error(msg)
    } finally { setBusy(false) }
  }

  const sampleTruck = trucks[0]
  const sampleTrailer = trailers[0]
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Bulk tire issue upload</CardTitle>
      <p className="text-sm text-muted-foreground">Upload outgoing tire records for trucks and trailers.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="mb-2 font-medium">Required columns</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left text-xs">
            <thead><tr>{['Date','Vehicle Type','Truck #','Trailer #','Name Driver','Serial Number','OUT QTY'].map(x => <th key={x} className="border-b px-2 py-2">{x}</th>)}</tr></thead>
            <tbody><tr>
              {[new Date().toISOString().slice(0, 10), 'TRUCK', sampleTruck?.licensePlate || 'Loading active trucks…', '', sampleTruck?.driverName || 'Driver Name', 'SERIAL-001', '1'].map((x,i) => <td key={i} className="px-2 py-2 text-muted-foreground">{x}</td>)}
            </tr></tbody>
          </table>
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={downloadTemplate} disabled={loadingTrucks || trucks.length === 0}>
          <Download className="mr-2 h-4 w-4" />Download template
        </Button>
        <div className="mt-3 text-xs text-muted-foreground">
          {loadingTrucks ? 'Loading active fleet numbers…' : trucks.length || trailers.length ? 'Template sample uses a real active truck. For a trailer row, enter TRAILER under Vehicle Type and its number under Trailer #.' : 'No active trucks or trailers found. Activate a fleet vehicle before uploading.'}
        </div>
        {(trucks.length > 0 || trailers.length > 0) && <div className="mt-2 space-y-2">
          {trucks.length > 0 && <div><p className="mb-1 text-xs font-medium">Active trucks</p><div className="flex flex-wrap gap-2">{trucks.map(truck => <span key={truck.licensePlate} className="rounded-md border bg-background px-2 py-1 text-xs font-medium">{truck.licensePlate}</span>)}</div></div>}
          {trailers.length > 0 && <div><p className="mb-1 text-xs font-medium">Active trailers</p><div className="flex flex-wrap gap-2">{trailers.map(trailer => <span key={trailer.number} className="rounded-md border bg-background px-2 py-1 text-xs font-medium">{trailer.number}</span>)}</div></div>}
        </div>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label>Tire size *</Label><Input value={tireSize} onChange={e => setTireSize(e.target.value)} placeholder="e.g. 295/80R22.5" /></div>
        <div className="space-y-2"><Label>Origin *</Label><Select value={origin} onValueChange={setOrigin}><SelectTrigger><SelectValue placeholder="Select tire origin" /></SelectTrigger><SelectContent><SelectItem value="CHINESE">China</SelectItem><SelectItem value="SAUDI">Saudi</SelectItem><SelectItem value="JAPANESE">Japan</SelectItem></SelectContent></Select></div>
      </div>
      <div className="space-y-2"><Label>Excel / CSV file *</Label><Input id="tire-bulk-file" type="file" accept=".xlsx,.csv" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
      <Button onClick={submit} disabled={busy || !file || !tireSize.trim() || !origin || loadingTrucks || (trucks.length === 0 && trailers.length === 0)}>
        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</> : <><Upload className="mr-2 h-4 w-4" />Validate and upload</>}
      </Button>
      <p className="text-xs text-muted-foreground">Truck and trailer numbers are loaded from active fleet records. Use Vehicle Type with Truck # or Trailer #; legacy Truck # sheets remain supported. Each OUT QTY unit creates an individual tire record assigned as ASSIGNED_UNVERIFIED until its wheel position is recorded. The issue is linked to that vehicle’s existing open job card, or a new card is created only if none is open.</p>
    </CardContent>
  </Card>
}
