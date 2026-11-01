'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity, BarChart3, CalendarDays, Clock3, Download,
  Eye, Filter, Globe2, MapPin, Monitor, Radio, RefreshCw, Search, ShieldCheck,
  Smartphone, Users,
} from 'lucide-react'

type Session = {
  id: string
  visitorId: string
  domain: string
  type: string
  pagePath: string
  pages?: { path?: string; at?: string }[]
  ipAddress?: string
  country?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  timezone?: string
  browser?: string
  os?: string
  deviceType?: string
  startedAt: string
  lastSeenAt: string
  pageViews: number
  status: string
  durationSeconds: number
  source?: string
  referrer?: string
  isBot: boolean
  isIdle?: boolean
}
type Analytics = {
  stats: { liveNow: number; totalToday: number; uniqueVisitors: number; pageViews: number }
  sessions: Session[]
  countries: { country: string; count: number }[]
  topPages: { page: string; views: number }[]
  updatedAt: string
}

const dateTime = (value: string) => new Date(value).toLocaleString([], {
  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
})
const duration = (seconds: number) => {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`
}
const statusClass = (status: string) => status === 'Active'
  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
  : status === 'Idle'
    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
    : status === 'Bot'
      ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300'
      : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'

export default function VisitorIntelligencePage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [domain, setDomain] = useState('all')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showBots, setShowBots] = useState(false)

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
    } finally {
      setLoading(false)
    }
  }, [domain])

  useEffect(() => {
    refresh()
    const timer = window.setInterval(refresh, 15000)
    return () => window.clearInterval(timer)
  }, [refresh])

  const filteredSessions = useMemo(() => (data?.sessions ?? []).filter(session => {
    if (!showBots && session.isBot) return false
    if (statusFilter !== 'all' && session.status.toLowerCase() !== statusFilter) return false
    const haystack = [
      session.type, session.domain, session.ipAddress, session.country, session.region,
      session.city, session.browser, session.os, session.deviceType, session.pagePath,
      session.source, session.referrer,
    ].join(' ').toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  }), [data, query, statusFilter, showBots])

  const exportCsv = () => {
    if (!data) return
    const columns = ['Visitor type','Status','Domain','IP address','Country','Region','City','Latitude','Longitude','Timezone','Browser','OS','Device','Current page','Page views','First seen','Last seen','Duration seconds','Source','Referrer']
    const rows = filteredSessions.map(s => [s.type,s.status,s.domain,s.ipAddress,s.country,s.region,s.city,s.latitude,s.longitude,s.timezone,s.browser,s.os,s.deviceType,s.pagePath,s.pageViews,s.startedAt,s.lastSeenAt,s.durationSeconds,s.source,s.referrer])
    const csv = [columns, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'fleet-manager-visitor-intelligence.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const stats = data?.stats
  const statusCounts = {
    active: data?.sessions.filter(s => s.status === 'Active' && !s.isBot).length ?? 0,
    idle: data?.sessions.filter(s => s.status === 'Idle' && !s.isBot).length ?? 0,
    inactive: data?.sessions.filter(s => s.status === 'Inactive' && !s.isBot).length ?? 0,
  }
  const maxCountry = Math.max(1, ...(data?.countries ?? []).map(item => item.count))
  const maxPage = Math.max(1, ...(data?.topPages ?? []).map(item => item.views))

  return (
    <main className="mx-auto w-full max-w-[1720px] space-y-6 p-3 sm:p-5 lg:p-7">
      <section className="relative overflow-hidden rounded-2xl bg-slate-950 px-5 py-6 text-white shadow-xl sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-110px] left-[38%] h-64 w-64 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-cyan-100">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
              REAL-TIME WEBSITE MONITORING
            </div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/10 p-3"><Globe2 className="h-7 w-7 text-cyan-300" /></div>
              <div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Visitor Intelligence</h1><p className="mt-1 text-sm text-slate-300">Understand who is visiting, where traffic comes from, and what pages attract attention.</p></div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Anonymous and signed-in traffic</span>
              <span className="inline-flex items-center gap-1.5"><Wifi className="h-3.5 w-3.5 text-cyan-300" /> Auto-refresh every 15 seconds</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Last 24 hours</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Filter by domain" value={domain} onChange={e => setDomain(e.target.value)} className="h-10 min-w-[190px] rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-400 [&>option]:text-slate-900">
              <option value="all">All domains</option><option value="fleetmaintenance.site">fleetmaintenance.site</option><option value="fleetinspections.tech">fleetinspections.tech</option>
            </select>
            <Button onClick={refresh} variant="secondary" className="h-10 bg-white text-slate-900 hover:bg-slate-100"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
            <Button onClick={exportCsv} variant="outline" disabled={!data} className="h-10 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"><Download className="mr-2 h-4 w-4" />Export</Button>
          </div>
        </div>
      </section>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      <section className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-4">
        {[
          { label: 'Visitors online', value: stats?.liveNow ?? '—', detail: 'Seen in the last 2 minutes', icon: Radio, tone: 'text-emerald-600 bg-emerald-500/10', live: true },
          { label: 'Sessions today', value: stats?.totalToday ?? '—', detail: 'Since midnight, local server time', icon: Users, tone: 'text-blue-600 bg-blue-500/10' },
          { label: 'Unique visitors', value: stats?.uniqueVisitors ?? '—', detail: 'Distinct browser visitor IDs · 24h', icon: Globe2, tone: 'text-violet-600 bg-violet-500/10' },
          { label: 'Page views', value: stats?.pageViews ?? '—', detail: 'Human page views · 24h', icon: Eye, tone: 'text-amber-600 bg-amber-500/10' },
        ].map(item => (
          <div key={item.label} className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between"><div><p className="text-sm font-medium text-muted-foreground">{item.label}</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{item.value}</p></div><div className={`rounded-xl p-3 ${item.tone}`}><item.icon className="h-5 w-5" /></div></div>
            <div className="mt-4 flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{item.detail}</p>{item.live && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />LIVE</span>}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h2 className="font-semibold">Live visitor activity</h2><Badge variant="outline" className="font-normal">{filteredSessions.length} shown</Badge></div><p className="mt-1 text-xs text-muted-foreground">Session-level details, network metadata, device and browsing activity.</p></div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[190px] flex-1 lg:w-56 lg:flex-none"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search IP, city, page..." className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" /></div>
                <div className="relative"><Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" /><select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="h-9 rounded-lg border bg-background pl-8 pr-3 text-sm"><option value="all">All statuses</option><option value="active">Active</option><option value="idle">Idle</option><option value="inactive">Inactive</option></select></div>
                <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-xs text-muted-foreground"><input type="checkbox" checked={showBots} onChange={e => setShowBots(e.target.checked)} className="accent-primary" />Include bots</label>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-emerald-500/8 px-3 py-2"><p className="text-[11px] text-muted-foreground">Active</p><p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-600">{statusCounts.active}</p></div>
              <div className="rounded-lg bg-amber-500/8 px-3 py-2"><p className="text-[11px] text-muted-foreground">Idle</p><p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-600">{statusCounts.idle}</p></div>
              <div className="rounded-lg bg-slate-500/8 px-3 py-2"><p className="text-[11px] text-muted-foreground">Inactive</p><p className="mt-0.5 text-lg font-semibold tabular-nums text-muted-foreground">{statusCounts.inactive}</p></div>
            </div>
          </div>

          {loading && !data ? <div className="py-16 text-center text-sm text-muted-foreground"><RefreshCw className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading visitor activity…</div> : !filteredSessions.length ? (
            <div className="px-5 py-16 text-center"><Globe2 className="mx-auto mb-3 h-9 w-9 text-muted-foreground/50" /><p className="font-medium">No matching visitor sessions</p><p className="mt-1 text-sm text-muted-foreground">Try changing your filters. New visits will appear automatically.</p></div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Visitor</th><th className="px-4 py-3 font-medium">Location / IP</th><th className="px-4 py-3 font-medium">Device</th><th className="px-4 py-3 font-medium">Current page</th><th className="px-4 py-3 font-medium">Activity</th><th className="px-5 py-3 text-right font-medium">Duration</th></tr></thead>
                  <tbody className="divide-y">
                    {filteredSessions.map(session => (
                      <tr key={session.id} className="align-top transition-colors hover:bg-muted/30">
                        <td className="px-5 py-4"><div className="flex items-start gap-2.5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${session.status === 'Active' ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.12)]' : session.status === 'Idle' ? 'bg-amber-500' : 'bg-slate-400'}`} /><div><p className="font-medium">{session.type}</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline" className={`text-[10px] font-medium ${statusClass(session.status)}`}>{session.status}</Badge>{session.isBot && <Badge variant="secondary" className="text-[10px]">Bot</Badge>}</div><p className="mt-1.5 text-[11px] text-muted-foreground">{session.domain}</p></div></div></td>
                        <td className="px-4 py-4"><div className="flex items-start gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" /><div><p className="max-w-[180px] font-medium">{[session.city, session.region, session.country].filter(Boolean).join(', ') || 'Location unavailable'}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{session.ipAddress || 'IP unavailable'}</p>{session.timezone && <p className="mt-1 text-[11px] text-muted-foreground">{session.timezone}</p>}</div></div></td>
                        <td className="px-4 py-4"><div className="flex items-start gap-2">{session.deviceType?.toLowerCase().includes('mobile') ? <Smartphone className="mt-0.5 h-4 w-4 text-muted-foreground" /> : <Monitor className="mt-0.5 h-4 w-4 text-muted-foreground" />}<div><p className="font-medium">{session.browser || 'Unknown browser'}</p><p className="mt-1 text-xs text-muted-foreground">{[session.os, session.deviceType].filter(Boolean).join(' · ') || 'Device unknown'}</p></div></div></td>
                        <td className="px-4 py-4"><p className="max-w-[190px] truncate font-medium" title={session.pagePath}>{session.pagePath}</p><p className="mt-1 text-xs text-muted-foreground">{session.pageViews} page views</p>{session.source && <p className="mt-1 max-w-[190px] truncate text-[11px] text-muted-foreground">Source: {session.source}</p>}</td>
                        <td className="px-4 py-4"><p className="font-medium">{dateTime(session.lastSeenAt)}</p><p className="mt-1 text-xs text-muted-foreground">Started {dateTime(session.startedAt)}</p></td>
                        <td className="px-5 py-4 text-right"><p className="font-semibold tabular-nums">{duration(session.durationSeconds)}</p><p className="mt-1 text-[11px] text-muted-foreground">Session length</p></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-3 md:hidden">
                {filteredSessions.map(session => (
                  <article key={session.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${session.status === 'Active' ? 'bg-emerald-500' : session.status === 'Idle' ? 'bg-amber-500' : 'bg-slate-400'}`} /><div><p className="text-sm font-semibold">{session.type}</p><p className="text-[11px] text-muted-foreground">{session.domain}</p></div></div><Badge variant="outline" className={statusClass(session.status)}>{session.status}</Badge></div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><p className="text-muted-foreground">Location</p><p className="mt-1 font-medium">{[session.city, session.country].filter(Boolean).join(', ') || 'Unavailable'}</p><p className="mt-0.5 font-mono text-muted-foreground">{session.ipAddress || 'IP unavailable'}</p></div><div><p className="text-muted-foreground">Device</p><p className="mt-1 font-medium">{session.browser || 'Unknown browser'}</p><p className="mt-0.5 text-muted-foreground">{[session.os, session.deviceType].filter(Boolean).join(' · ')}</p></div><div><p className="text-muted-foreground">Current page</p><p className="mt-1 break-all font-medium">{session.pagePath}</p><p className="mt-0.5 text-muted-foreground">{session.pageViews} views</p></div><div><p className="text-muted-foreground">Duration / last seen</p><p className="mt-1 font-semibold">{duration(session.durationSeconds)}</p><p className="mt-0.5 text-muted-foreground">{dateTime(session.lastSeenAt)}</p></div></div>
                    {session.referrer && <p className="mt-3 truncate border-t pt-2 text-[11px] text-muted-foreground">Referrer: {session.referrer}</p>}
                  </article>
                ))}
              </div>
            </>
          )}
          <div className="flex flex-col gap-1 border-t px-4 py-3 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>Showing up to 150 sessions from the last 24 hours.</span><span>Last updated: {data ? dateTime(data.updatedAt) : '—'} · Refreshes every 15 seconds</span></div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold">Top countries</h2><p className="mt-1 text-xs text-muted-foreground">Visitor sessions by country</p></div><Globe2 className="h-5 w-5 text-muted-foreground" /></div>
            <div className="mt-5 space-y-4">{data?.countries.length ? data.countries.slice(0, 7).map(item => <div key={item.country}><div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="truncate font-medium">{item.country}</span><span className="tabular-nums text-muted-foreground">{item.count}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600" style={{ width: `${Math.max(4, item.count / maxCountry * 100)}%` }} /></div></div>) : <p className="py-5 text-center text-sm text-muted-foreground">No location data yet.</p>}</div>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between"><div><h2 className="font-semibold">Popular pages</h2><p className="mt-1 text-xs text-muted-foreground">Most viewed paths in this period</p></div><BarChart3 className="h-5 w-5 text-muted-foreground" /></div>
            <div className="mt-5 space-y-4">{data?.topPages.length ? data.topPages.slice(0, 7).map(item => <div key={item.page}><div className="mb-1.5 flex items-center justify-between gap-2 text-xs"><span className="max-w-[220px] truncate font-medium" title={item.page}>{item.page}</span><span className="tabular-nums text-muted-foreground">{item.views}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-600" style={{ width: `${Math.max(4, item.views / maxPage * 100)}%` }} /></div></div>) : <p className="py-5 text-center text-sm text-muted-foreground">No page activity yet.</p>}</div>
          </section>
          <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-card to-blue-500/5 p-5">
            <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-cyan-600" /><h2 className="font-semibold">Data & location notes</h2></div>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground"><li>• IP and city-level location depend on network headers supplied by the hosting provider.</li><li>• Location is approximate; it does not identify a visitor’s exact physical position.</li><li>• Distance is not displayed because the dashboard has no verified visitor-to-business origin to calculate it from.</li><li>• Visitors are identified using first-party session IDs, not device fingerprinting.</li></ul>
          </section>
          <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />Session duration is calculated from the first recorded page view to the latest heartbeat. Browser activity can continue after a tab is backgrounded.</div>
        </aside>
      </section>
    </main>
  )
}
