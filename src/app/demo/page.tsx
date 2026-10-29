'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, CircleDot, ClipboardList, Fuel, Gauge, Search, ShieldCheck, Truck, Wrench } from 'lucide-react'

type DemoSection = 'overview' | 'vehicles' | 'maintenance' | 'tires' | 'documents'

const vehicles = [
  { plate: 'TRK-2048', name: 'Mercedes-Benz Actros MP5', type: 'Truck', km: '284,120 km', status: 'Active', health: 92 },
  { plate: 'TRK-1783', name: 'Mercedes-Benz Actros MP4', type: 'Truck', km: '316,840 km', status: 'Maintenance due', health: 68 },
  { plate: 'TRL-0912', name: 'Schmitz Cargobull Curtain Trailer', type: 'Trailer', km: '—', status: 'Active', health: 96 },
  { plate: 'TRK-2206', name: 'Volvo FH 2023', type: 'Truck', km: '128,540 km', status: 'Inspection due', health: 74 },
  { plate: 'TRL-1038', name: 'Flatbed Trailer 3 Axle', type: 'Trailer', km: '—', status: 'Active', health: 88 },
]
const jobs = [
  { id: 'WO-2408', vehicle: 'TRK-1783', issue: 'Brake inspection and adjustment', due: 'Today', status: 'In progress', priority: 'High' },
  { id: 'WO-2407', vehicle: 'TRK-2206', issue: 'Preventive maintenance — 130,000 km', due: 'Tomorrow', status: 'Scheduled', priority: 'Medium' },
  { id: 'WO-2404', vehicle: 'TRK-2048', issue: 'Engine oil and filter replacement', due: 'Oct 23', status: 'Completed', priority: 'Low' },
]
const tires = [
  { serial: 'FS-315-00841', size: '315/80 R22.5', location: 'TRK-2048 · Front axle', condition: 'Good' },
  { serial: 'FS-315-00877', size: '315/80 R22.5', location: 'TRK-1783 · Rear axle', condition: 'Inspect' },
  { serial: 'BR-385-00116', size: '385/65 R22.5', location: 'TRL-0912 · Axle 1', condition: 'Good' },
  { serial: 'MC-315-00204', size: '315/80 R22.5', location: 'Warehouse · Rack A2', condition: 'In stock' },
]
const documents = [
  { item: 'Vehicle registration', vehicle: 'TRK-1783', date: 'Nov 02, 2026', state: 'Expiring soon' },
  { item: 'Periodic inspection (MVPI)', vehicle: 'TRK-2206', date: 'Nov 08, 2026', state: 'Expiring soon' },
  { item: 'Insurance policy', vehicle: 'TRL-0912', date: 'Dec 14, 2026', state: 'Valid' },
  { item: 'Driver license', vehicle: 'TRK-2048', date: 'Jan 20, 2027', state: 'Valid' },
]

export default function DemoPage() {
  const [section, setSection] = useState<DemoSection>('overview')
  const [query, setQuery] = useState('')
  const filteredVehicles = useMemo(() => vehicles.filter(v => (v.plate + ' ' + v.name + ' ' + v.status).toLowerCase().includes(query.toLowerCase())), [query])
  const nav: { id: DemoSection; label: string; icon: typeof Activity }[] = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'vehicles', label: 'Vehicles', icon: Truck },
    { id: 'maintenance', label: 'Workshop jobs', icon: Wrench },
    { id: 'tires', label: 'Tire inventory', icon: CircleDot },
    { id: 'documents', label: 'Documents', icon: ShieldCheck },
  ]
  const panel = 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900'
  const muted = 'text-slate-500 dark:text-slate-400'
  const th = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
  const td = 'px-4 py-3 text-sm text-slate-700 dark:text-slate-200'

  return <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3 font-bold"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><Truck size={22}/></span><span>FleetInspections<span className="block text-xs font-medium text-slate-500">Fleet operations demo</span></span></Link>
        <div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 sm:inline-flex"><span className="mr-1.5">●</span> Public demo · Sample data</span><Link href="/login" className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900">Sign in</Link></div>
      </div>
    </header>
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300"><CheckCircle2 size={14}/> No account needed</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Fleet operations at a glance</h1><p className={'mt-2 max-w-2xl text-sm sm:text-base ' + muted}>Explore a working sample dashboard with fictional vehicles, maintenance jobs, tire records, and document reminders. Changes are not saved.</p></div>
        <div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-emerald-500"/> Demo workspace <span className="mx-1">/</span> Oct 2026</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Fleet vehicles', value: '24', note: '18 trucks · 6 trailers', icon: Truck, trend: '+2 this month' },
          { label: 'Maintenance due', value: '5', note: '2 need attention today', icon: Wrench, trend: 'Review schedule' },
          { label: 'Tires in inventory', value: '186', note: '12 flagged for inspection', icon: CircleDot, trend: 'Track by serial' },
          { label: 'Documents expiring', value: '3', note: 'Next 30 days', icon: CalendarClock, trend: 'Alerts enabled' },
        ].map(item => <div key={item.label} className={panel + ' p-5'}><div className="flex items-center justify-between"><span className={'text-sm ' + muted}>{item.label}</span><span className="rounded-xl bg-blue-50 p-2 text-blue-700 dark:bg-blue-950 dark:text-blue-300"><item.icon size={19}/></span></div><div className="mt-3 text-3xl font-bold">{item.value}</div><p className={'mt-1 text-xs ' + muted}>{item.note}</p><div className="mt-4 text-xs font-medium text-blue-700 dark:text-blue-300">{item.trend}</div></div>)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className={panel + ' h-fit p-3'}><p className="px-3 pb-3 pt-2 text-xs font-bold uppercase tracking-wider text-slate-400">Demo workspace</p><nav className="space-y-1">{nav.map(n => <button key={n.id} onClick={() => setSection(n.id)} className={'flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ' + (section === n.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}><n.icon size={18}/>{n.label}</button>)}</nav><div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"><ShieldCheck size={16} className="mb-1"/> <strong>Safe preview</strong><br/>Fictional records only. This demo is separate from customer workspaces.</div></aside>
        <section className="min-w-0 space-y-5">
          {section === 'overview' && <>
            <div className={panel + ' p-5 sm:p-6'}><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold">Fleet health overview</h2><p className={'text-sm ' + muted}>Illustrative operational snapshot</p></div><span className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Fleet health: 87%</span></div><div className="mt-6 grid gap-5 md:grid-cols-2"><div><div className="mb-2 flex justify-between text-sm"><span>Preventive maintenance compliance</span><strong>91%</strong></div><div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2.5 w-[91%] rounded-full bg-blue-600"/></div><div className="mb-2 mt-5 flex justify-between text-sm"><span>Vehicle availability</span><strong>88%</strong></div><div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2.5 w-[88%] rounded-full bg-emerald-500"/></div><div className="mb-2 mt-5 flex justify-between text-sm"><span>Document compliance</span><strong>96%</strong></div><div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2.5 w-[96%] rounded-full bg-violet-500"/></div></div><div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60"><p className={'text-sm ' + muted}>Sample maintenance spend · this month</p><p className="mt-2 text-3xl font-bold">SAR 18,420</p><div className="mt-2 flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"><ArrowDownRight size={15}/> 8.4% vs previous month</div><div className="mt-5 grid grid-cols-2 gap-3"><div><p className={'text-xs ' + muted}>Open work orders</p><p className="mt-1 text-xl font-bold">7</p></div><div><p className={'text-xs ' + muted}>Breakdowns this month</p><p className="mt-1 text-xl font-bold">2</p></div></div></div></div></div>
            <div className={panel + ' overflow-hidden'}><div className="flex items-center justify-between p-5"><div><h2 className="font-bold">Priority items</h2><p className={'mt-1 text-sm ' + muted}>Items a fleet manager should review</p></div><AlertTriangle className="text-amber-500"/></div><div className="divide-y divide-slate-100 dark:divide-slate-800">{[{title:'Brake inspection overdue',desc:'TRK-1783 · Work order WO-2408',tag:'High priority'},{title:'Registration expiring soon',desc:'TRK-1783 · Due Nov 02, 2026',tag:'Document alert'},{title:'Tire needs inspection',desc:'FS-315-00877 · Rear axle',tag:'Tire alert'}].map(x=><div key={x.title} className="flex flex-col justify-between gap-2 px-5 py-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold">{x.title}</p><p className={'mt-1 text-xs ' + muted}>{x.desc}</p></div><span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">{x.tag}</span></div>)}</div></div>
          </>}
          {section === 'vehicles' && <div className={panel + ' overflow-hidden'}><div className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center"><div><h2 className="text-lg font-bold">Vehicles & trailers</h2><p className={'text-sm ' + muted}>Sample fleet register · {filteredVehicles.length} records shown</p></div><div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input aria-label="Search vehicles" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search plate or vehicle" className="w-full rounded-lg border border-slate-300 bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 sm:w-64"/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[620px]"><thead className="bg-slate-50 dark:bg-slate-800/60"><tr>{['Vehicle','Plate / ID','Mileage','Health','Status'].map(x=><th key={x} className={th}>{x}</th>)}</tr></thead><tbody>{filteredVehicles.map(v=><tr key={v.plate} className="border-t border-slate-100 dark:border-slate-800"><td className={td+' font-medium'}>{v.name}<span className={'block text-xs font-normal '+muted}>{v.type}</span></td><td className={td}>{v.plate}</td><td className={td}>{v.km}</td><td className={td}><div className="flex items-center gap-2"><div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-1.5 rounded-full bg-emerald-500" style={{width:v.health+'%'}}/></div>{v.health}%</div></td><td className={td}><span className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{v.status}</span></td></tr>)}</tbody></table></div></div>}
          {section === 'maintenance' && <div className={panel + ' overflow-hidden'}><div className="p-5"><h2 className="text-lg font-bold">Workshop job cards</h2><p className={'text-sm ' + muted}>Work order lifecycle and maintenance schedule</p></div><div className="overflow-x-auto"><table className="w-full min-w-[600px]"><thead className="bg-slate-50 dark:bg-slate-800/60"><tr>{['Work order','Vehicle','Reported work','Due','Status'].map(x=><th key={x} className={th}>{x}</th>)}</tr></thead><tbody>{jobs.map(j=><tr key={j.id} className="border-t border-slate-100 dark:border-slate-800"><td className={td+' font-semibold'}>{j.id}<span className={'block text-xs font-normal '+muted}>{j.priority} priority</span></td><td className={td}>{j.vehicle}</td><td className={td}>{j.issue}</td><td className={td}>{j.due}</td><td className={td}><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">{j.status}</span></td></tr>)}</tbody></table></div></div>}
          {section === 'tires' && <div className={panel + ' overflow-hidden'}><div className="p-5"><h2 className="text-lg font-bold">Tire inventory & fitment</h2><p className={'text-sm ' + muted}>Trace tire serials, sizes, condition, and fitted location</p></div><div className="overflow-x-auto"><table className="w-full min-w-[580px]"><thead className="bg-slate-50 dark:bg-slate-800/60"><tr>{['Serial number','Tire size','Fitted location','Condition'].map(x=><th key={x} className={th}>{x}</th>)}</tr></thead><tbody>{tires.map(t=><tr key={t.serial} className="border-t border-slate-100 dark:border-slate-800"><td className={td+' font-semibold'}>{t.serial}</td><td className={td}>{t.size}</td><td className={td}>{t.location}</td><td className={td}>{t.condition}</td></tr>)}</tbody></table></div></div>}
          {section === 'documents' && <div className={panel + ' overflow-hidden'}><div className="p-5"><h2 className="text-lg font-bold">Document expiry tracker</h2><p className={'text-sm ' + muted}>Illustrative vehicle and driver compliance records</p></div><div className="overflow-x-auto"><table className="w-full min-w-[560px]"><thead className="bg-slate-50 dark:bg-slate-800/60"><tr>{['Document','Vehicle','Expiry date','Status'].map(x=><th key={x} className={th}>{x}</th>)}</tr></thead><tbody>{documents.map(d=><tr key={d.item+d.vehicle} className="border-t border-slate-100 dark:border-slate-800"><td className={td+' font-medium'}>{d.item}</td><td className={td}>{d.vehicle}</td><td className={td}>{d.date}</td><td className={td}><span className={'rounded-full px-2 py-1 text-xs font-semibold '+(d.state==='Valid'?'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300':'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200')}>{d.state}</span></td></tr>)}</tbody></table></div></div>}
          <div className="flex flex-col justify-between gap-3 rounded-2xl bg-slate-900 p-5 text-white sm:flex-row sm:items-center"><div><p className="font-semibold">Want to use your own fleet data?</p><p className="mt-1 text-sm text-slate-300">Create a workspace or sign in to your existing account.</p></div><Link href="/signup" className="inline-flex items-center justify-center rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-bold hover:bg-blue-400">Get started <ArrowUpRight size={16} className="ml-2"/></Link></div>
        </section>
      </div>
      <footer className={'mt-8 flex flex-col justify-between gap-2 border-t border-slate-200 pt-5 text-xs sm:flex-row dark:border-slate-800 '+muted}><span>FleetInspections · Contest demo</span><span>All names, identifiers, dates, and figures are fictional sample data.</span></footer>
    </div>
  </main>
}
