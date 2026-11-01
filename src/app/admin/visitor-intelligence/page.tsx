'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Globe2, Users, Eye, Radio, RefreshCw, Download, MapPin, Monitor, Clock, ExternalLink } from 'lucide-react'

type Session = {
  id: string; visitorId: string; domain: string; type: string; pagePath: string
  ipAddress?: string; country?: string; region?: string; city?: string
  browser?: string; os?: string; deviceType?: string; startedAt: string
  lastSeenAt: string; pageViews: number; status: string; durationSeconds: number
  source?: string; referrer?: string; isBot: boolean
}
type Analytics = {
  stats: { liveNow: number; totalToday: number; uniqueVisitors: number; pageViews: number }
  sessions: Session[]; countries: { country: string; count: number }[]
  topPages: { page: string; views: number }[]; updatedAt: string
}

const dateTime = (value: string) => new Date(value).toLocaleString()
const duration = (seconds: number) => {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`
}

export default function VisitorIntelligencePage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [domain, setDomain] = useState('all')

  const refresh = useCallback(async () => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/admin/visitor-analytics?domain=${encodeURIComponent(domain)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(response.status === 403 ? 'Administrator access required.' : 'Unable to load visitor analytics.')
      setData(await response.json())
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load visitor analytics.')
    } finally { setLoading(false) }
  }, [domain])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 15000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const exportCsv = () => {
    if (!data) return
    const columns = ['Visitor type','Status','Domain','IP address','Country','City','Browser','OS','Device','Current page','Page views','First seen','Last seen','Duration','Source']
    const rows = data.sessions.map(s => [s.type,s.status,s.domain,s.ipAddress,s.country,s.city,s.browser,s.os,s.deviceType,s.pagePath,s.pageViews,s.startedAt,s.lastSeenAt,duration(s.durationSeconds),s.source])
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'fleet-manager-visitor-analytics.csv'; link.click(); URL.revokeObjectURL(url)
  }

  const stats = data?.stats
  return <div className="mx-auto w-full max-w-[1600px] space-y-6 p-4 md:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2"><Globe2 className="h-6 w-6 text-primary"/><h1 className="text-2xl font-bold tracking-tight">Visitor Intelligence</h1></div><p className="mt-1 text-sm text-muted-foreground">Live anonymous visitor and registered-user traffic across your public and app domains.</p></div>
      <div className="flex flex-wrap gap-2">
        <select value={domain} onChange={e => setDomain(e.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm"><option value="all">All domains</option><option value="fleetmaintenance.site">fleetmaintenance.site</option><option value="fleetinspections.tech">fleetinspections.tech</option></select>
        <Button variant="outline" onClick={exportCsv} disabled={!data}><Download className="mr-2 h-4 w-4"/>Export CSV</Button>
        <Button onClick={refresh} variant="outline"><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button>
      </div>
    </div>

    {error && <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        { label: 'Live visitors', value: stats?.liveNow ?? '—', icon: Radio, hint: 'Seen in the last 2 minutes' },
        { label: 'Visitors today', value: stats?.totalToday ?? '—', icon: Users, hint: 'Sessions started today' },
        { label: 'Unique visitors', value: stats?.uniqueVisitors ?? '—', icon: Globe2, hint: 'Unique browser IDs · last 24 hours' },
        { label: 'Page views', value: stats?.pageViews ?? '—', icon: Eye, hint: 'Human page views · last 24 hours' },
      ].map(item => <Card key={item.label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{item.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{item.value}</p><p className="mt-1 text-xs text-muted-foreground">{item.hint}</p></div><div className="rounded-xl bg-primary/10 p-3 text-primary"><item.icon className="h-5 w-5"/></div></CardContent></Card>)}
    </div>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="min-w-0">
        <CardHeader className="flex flex-row items-center justify-between space-y-0"><div><CardTitle>Live visitor sessions</CardTitle><p className="mt-1 text-xs text-muted-foreground">Automatically refreshes every 15 seconds · {data ? `Updated ${dateTime(data.updatedAt)}` : 'Loading'}</p></div><Badge variant="outline" className="gap-1"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"/>Live feed</Badge></CardHeader>
        <CardContent>
          {loading && !data ? <p className="py-10 text-center text-sm text-muted-foreground">Loading visitor sessions…</p> : !data?.sessions.length ? <div className="py-12 text-center"><Globe2 className="mx-auto mb-3 h-8 w-8 text-muted-foreground"/><p className="font-medium">No visitor sessions yet</p><p className="mt-1 text-sm text-muted-foreground">New sessions will appear after the tracker is deployed and visitors browse the site.</p></div> :
          <div className="space-y-3">{data.sessions.map(session => <div key={session.id} className="rounded-xl border p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${session.status === 'Active' ? 'bg-emerald-500' : session.status === 'Idle' ? 'bg-amber-500' : 'bg-muted-foreground'}`}/><span className="font-medium">{session.type}</span><Badge variant={session.status === 'Active' ? 'default' : 'secondary'}>{session.status}</Badge>{session.isBot && <Badge variant="outline">Bot</Badge>}</div><span className="text-xs text-muted-foreground">{session.domain}</span></div>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
              <div className="flex min-w-0 gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/><div className="min-w-0"><p className="truncate font-medium">{[session.city,session.region,session.country].filter(Boolean).join(', ') || 'Location unavailable'}</p><p className="truncate text-xs text-muted-foreground">{session.ipAddress || 'IP unavailable'}</p></div></div>
              <div className="flex min-w-0 gap-2"><Monitor className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/><div className="min-w-0"><p className="truncate font-medium">{[session.browser,session.os].filter(Boolean).join(' · ') || 'Unknown browser'}</p><p className="text-xs text-muted-foreground">{session.deviceType || 'Unknown device'}</p></div></div>
              <div className="flex min-w-0 gap-2"><ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/><div className="min-w-0"><p className="truncate font-medium" title={session.pagePath}>{session.pagePath}</p><p className="text-xs text-muted-foreground">{session.pageViews} page views</p></div></div>
              <div className="flex min-w-0 gap-2"><Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"/><div className="min-w-0"><p className="font-medium">{duration(session.durationSeconds)}</p><p className="text-xs text-muted-foreground">Last seen {dateTime(session.lastSeenAt)}</p></div></div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground"><span>First seen: {dateTime(session.startedAt)}</span>{session.source && <span>Source: {session.source}</span>}{session.referrer && <span className="max-w-full truncate">Referrer: {session.referrer}</span>}</div>
          </div>)}</div>}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card><CardHeader><CardTitle className="text-base">Top countries</CardTitle></CardHeader><CardContent className="space-y-3">{data?.countries.length ? data.countries.map(item => <div key={item.country} className="flex items-center justify-between text-sm"><span className="truncate">{item.country}</span><Badge variant="secondary">{item.count}</Badge></div>) : <p className="text-sm text-muted-foreground">No location data yet.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Popular pages</CardTitle></CardHeader><CardContent className="space-y-3">{data?.topPages.length ? data.topPages.map(item => <div key={item.page} className="flex items-center justify-between gap-2 text-sm"><span className="truncate" title={item.page}>{item.page}</span><Badge variant="secondary">{item.views}</Badge></div>) : <p className="text-sm text-muted-foreground">No page views yet.</p>}</CardContent></Card>
        <Card><CardContent className="p-4 text-xs leading-relaxed text-muted-foreground">Location is estimated from hosting-provider network headers and may be unavailable. IP addresses identify a network connection, not a person's exact physical location. Visitor IDs are first-party identifiers; no device fingerprinting is used.</CardContent></Card>
      </div>
    </div>
  </div>
}
