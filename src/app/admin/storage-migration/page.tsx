'use client'

import { useState } from 'react'
import { apiPost } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { HardDrive, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react'

type Totals = { scanned: number; planned: number; migrated: number; skipped: number; failed: number }
type Result = {
  mode: string
  totals: Totals
  organizations: Array<{ organization: string; counters: Totals; failures?: Array<{ type: string; id: string; reason: string }>; remaining?: Record<string, number> }>
}

export default function StorageMigrationPage() {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)

  async function run(execute: boolean) {
    setBusy(true)
    setError('')
    try {
      const response = await apiPost('/api/admin/storage-migration', { execute })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Storage migration request failed')
      setResult(data)
      setConfirm(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Storage migration request failed')
    } finally {
      setBusy(false)
    }
  }

  return <main className="container mx-auto max-w-5xl space-y-6 p-6">
    <div>
      <h1 className="flex items-center gap-2 text-2xl font-bold"><HardDrive className="h-6 w-6" /> Document Storage Migration</h1>
      <p className="mt-1 text-sm text-muted-foreground">Move supported embedded files from the database into the configured object-storage bucket. Original database pointers are updated only after upload and SHA-256 verification.</p>
    </div>
    <Alert><ShieldCheck className="h-4 w-4" /><AlertDescription>Scan mode is read-only for files. Migration preserves source data until the bucket copy is verified. External URLs and ordinary text are not changed.</AlertDescription></Alert>
    {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}
    <Card>
      <CardHeader><CardTitle>Run migration</CardTitle><CardDescription>Always scan first. Review the counts and failures before starting migration.</CardDescription></CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button onClick={() => run(false)} disabled={busy}><RefreshCw className={busy ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />Scan documents</Button>
        <Button variant="destructive" onClick={() => setConfirm(true)} disabled={busy || !result || result.mode !== 'scan' || result.totals.planned === 0 || result.totals.failed > 0}>Migrate scanned files</Button>
      </CardContent>
    </Card>
    {confirm && <Card className="border-destructive"><CardHeader><CardTitle>Confirm file migration</CardTitle><CardDescription>This will upload {result?.totals.planned ?? 0} supported files and update their database references after verification.</CardDescription></CardHeader><CardContent className="flex gap-3"><Button variant="destructive" onClick={() => run(true)} disabled={busy}>Confirm and migrate</Button><Button variant="outline" onClick={() => setConfirm(false)} disabled={busy}>Cancel</Button></CardContent></Card>}
    {result && <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(result.totals).map(([key, value]) => <Card key={key}><CardContent className="p-4"><p className="text-sm capitalize text-muted-foreground">{key}</p><p className="text-2xl font-semibold">{value}</p></CardContent></Card>)}
      </div>
      <Card><CardHeader><CardTitle>Organization results</CardTitle><CardDescription>Remaining counts indicate supported embedded files still in the database.</CardDescription></CardHeader><CardContent className="space-y-4">
        {result.organizations.map(org => <section key={org.organization} className="space-y-2 border-b pb-4 last:border-0"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{org.organization}</h3><Badge variant={org.counters.failed ? 'destructive' : 'secondary'}>{org.counters.failed ? 'Failures' : 'No failures'}</Badge></div><p className="text-sm text-muted-foreground">Scanned {org.counters.scanned} · Planned {org.counters.planned} · Migrated {org.counters.migrated} · Skipped {org.counters.skipped} · Failed {org.counters.failed}</p>{org.remaining && <p className="text-xs text-muted-foreground">Remaining: {Object.entries(org.remaining).map(([k,v]) => k + ': ' + v).join(' · ')}</p>}{org.failures?.map((failure, i) => <p key={i} className="text-sm text-destructive">{failure.type} ({failure.id}): {failure.reason}</p>)}</section>)}
      </CardContent></Card>
    </>}
  </main>
}
