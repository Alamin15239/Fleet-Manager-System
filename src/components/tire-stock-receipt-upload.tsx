'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Package } from 'lucide-react'
import { toast } from '@/lib/localized-toast'

export default function TireStockReceiptUpload() {
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const downloadTemplate = () => {
    const csv = [
      'Date,Tire Size,Manufacturer,Origin,Serial Number,Quantity,Supplier,Purchase Reference,Purchase Cost,Notes',
      [new Date().toISOString().slice(0, 10), '295/80R22.5', 'Bridgestone', 'JAPANESE', 'SERIAL-001', '1', 'Supplier Name', 'INV-001', '850.00', 'New tire stock'].map(value => '"' + String(value).replace(/"/g, '""') + '"').join(',')
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'tire-stock-receipt-template.csv'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const submit = async () => {
    if (!file) { setError('Choose an Excel or CSV stock receipt file.'); return }
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch('/api/tires/stock-receipt-upload', {
        method: 'POST',
        credentials: 'include',
        body: form
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Stock receipt upload failed.')
      setMessage(result.message)
      toast.success(result.message)
      setFile(null)
      const input = document.getElementById('tire-stock-receipt-file') as HTMLInputElement | null
      if (input) input.value = ''
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Stock receipt upload failed.'
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Bulk tire stock receipt</CardTitle>
      <p className="text-sm text-muted-foreground">Import newly purchased or received tires into stock. This is separate from the outgoing tire issue sheet.</p>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <p className="font-medium">Required columns</p>
        <p className="mt-2 text-xs text-muted-foreground">Date, Tire Size, Manufacturer, Origin, Quantity</p>
        <p className="mt-1 text-xs text-muted-foreground">Optional: Serial Number, Supplier, Purchase Reference, Purchase Cost, Notes</p>
        <p className="mt-2 text-xs text-muted-foreground">Each new tire is saved as an individual stock record with its own TY code. Existing serial numbers are matched to their current tire record instead of creating duplicates. Existing assignment and lifecycle history are preserved. Use one tire per row when providing a serial number; a multi-quantity row is accepted only without a serial number.</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" /> Download CSV template
        </Button>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tire-stock-receipt-file">Excel / CSV stock receipt file *</Label>
        <Input id="tire-stock-receipt-file" type="file" accept=".xlsx,.xls,.csv" onChange={event => setFile(event.target.files?.[0] || null)} />
      </div>
      {error && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
      {message && <Alert><CheckCircle2 className="h-4 w-4" /><AlertDescription>{message}</AlertDescription></Alert>}
      <Button onClick={submit} disabled={busy || !file}>
        {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Importing…</> : <><Upload className="mr-2 h-4 w-4" />Validate and receive stock</>}
      </Button>
      <p className="text-xs text-muted-foreground">New tire records receive a Tire Lifecycle receipt event. If a serial already exists, the importer merges missing details only and does not create a duplicate tire or repeat receipt event. It does not create workshop job cards.</p>
    </CardContent>
  </Card>
}
