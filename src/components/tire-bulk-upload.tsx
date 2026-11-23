'use client'
import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from '@/lib/localized-toast'

export default function TireBulkUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [tireSize, setTireSize] = useState('')
  const [origin, setOrigin] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const downloadTemplate = () => {
    const csv = 'Date,Truck #,Name Driver,Serial Number,OUT QTY\n2026-11-23,4905,Driver Name,SERIAL-001,1'
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = 'tire-outgoing-upload-template.csv'; a.click(); URL.revokeObjectURL(url)
  }
  const submit = async () => {
    if (!file || !tireSize || !origin) { setError('Choose a file, tire size, and origin before uploading.'); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const data = new FormData(); data.append('file', file); data.append('tireSize', tireSize); data.append('origin', origin)
      const response = await fetch('/api/tires/bulk-upload', { method: 'POST', credentials: 'include', body: data })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Upload failed')
      setMessage(result.message); toast.success(result.message); setFile(null)
    } catch (e) { const msg = e instanceof Error ? e.message : 'Upload failed'; setError(msg); toast.error(msg) }
    finally { setBusy(false) }
  }
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Bulk tire issue upload</CardTitle><p className="text-sm text-muted-foreground">Upload outgoing tire records for trucks.</p></CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm"><p className="mb-2 font-medium">Required columns</p><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-xs"><thead><tr>{['Date','Truck #','Name Driver','Serial Number','OUT QTY'].map(x => <th key={x} className="border-b px-2 py-2">{x}</th>)}</tr></thead><tbody><tr>{['2026-11-23','4905','Driver Name','SERIAL-001','1'].map((x,i) => <td key={i} className="px-2 py-2 text-muted-foreground">{x}</td>)}</tr></tbody></table></div><Button type="button" variant="outline" size="sm" className="mt-3" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Download template</Button></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Tire size *</Label><Input value={tireSize} onChange={e => setTireSize(e.target.value)} placeholder="e.g. 295/80R22.5" /></div>
      <div className="space-y-2"><Label>Origin *</Label><Select value={origin} onValueChange={setOrigin}><SelectTrigger><SelectValue placeholder="Select tire origin" /></SelectTrigger><SelectContent><SelectItem value="CHINESE">China</SelectItem><SelectItem value="JAPANESE">Japan</SelectItem><SelectItem value="EUROPEAN">Europe</SelectItem><SelectItem value="AMERICAN">America</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent></Select></div></div>
      <div className="space-y-2"><Label>Excel / CSV file *</Label><Input type="file" accept=".xlsx,.xls,.csv" onChange={e => setFile(e.target.files?.[0] || null)} /></div>
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
      <Button onClick={submit} disabled={busy || !file || !tireSize || !origin}>{busy ? 'Uploading…' : <><Upload className="mr-2 h-4 w-4" />Validate and upload</>}</Button>
      <p className="text-xs text-muted-foreground">Truck numbers must match an active truck. Tires are created individually; ambiguous serial ranges are retained in notes for verification.</p>
    </CardContent></Card>
}
