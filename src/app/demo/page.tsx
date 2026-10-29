'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Activity, AlertTriangle, BarChart3, CalendarClock, CheckCircle2, CircleDot, ClipboardList, FileText, Fuel, Gauge, LayoutDashboard, Plus, Search, Settings, ShieldCheck, Truck, Wrench, X, Download, RefreshCw, DollarSign, Users, History, Package, Bell } from 'lucide-react'

type Section = 'dashboard'|'trucks'|'trailers'|'job-cards'|'breakdowns'|'tires'|'oil'|'documents'|'drivers'|'expenses'|'reports'|'settings'
type Row = Record<string,string>
const seedVehicles: Row[] = [
 {plate:'TRK-2048',name:'Mercedes-Benz Actros MP5',type:'Truck',km:'284120',status:'Active',health:'92%'},
 {plate:'TRK-1783',name:'Mercedes-Benz Actros MP4',type:'Truck',km:'316840',status:'Maintenance due',health:'68%'},
 {plate:'TRK-2206',name:'Volvo FH 2023',type:'Truck',km:'128540',status:'Inspection due',health:'74%'},
 {plate:'TRL-0912',name:'Schmitz Cargobull Curtain Trailer',type:'Trailer',km:'—',status:'Active',health:'96%'},
 {plate:'TRL-1038',name:'Flatbed Trailer 3 Axle',type:'Trailer',km:'—',status:'Active',health:'88%'},
]
const seedJobs: Row[] = [
 {id:'WO-2408',vehicle:'TRK-1783',type:'Brake inspection and adjustment',date:'2026-10-29',priority:'High',status:'In progress',cost:'850'},
 {id:'WO-2407',vehicle:'TRK-2206',type:'Preventive maintenance — 130,000 km',date:'2026-10-30',priority:'Medium',status:'Scheduled',cost:'1200'},
 {id:'WO-2404',vehicle:'TRK-2048',type:'Engine oil and filter replacement',date:'2026-10-23',priority:'Low',status:'Completed',cost:'680'},
]
const seedTires: Row[] = [
 {serial:'FS-315-00841',size:'315/80 R22.5',brand:'Firestone',location:'TRK-2048 · Front axle',condition:'Good'},
 {serial:'FS-315-00877',size:'315/80 R22.5',brand:'Firestone',location:'TRK-1783 · Rear axle',condition:'Inspect'},
 {serial:'BR-385-00116',size:'385/65 R22.5',brand:'Bridgestone',location:'TRL-0912 · Axle 1',condition:'Good'},
 {serial:'MC-315-00204',size:'315/80 R22.5',brand:'Michelin',location:'Warehouse · Rack A2',condition:'In stock'},
]
const seedDocs: Row[] = [
 {item:'Vehicle registration',vehicle:'TRK-1783',issue:'2025-11-02',expiry:'2026-11-02',status:'Expiring soon'},
 {item:'Periodic inspection (MVPI)',vehicle:'TRK-2206',issue:'2025-11-08',expiry:'2026-11-08',status:'Expiring soon'},
 {item:'Insurance policy',vehicle:'TRL-0912',issue:'2026-01-14',expiry:'2026-12-14',status:'Valid'},
 {item:'Driver license',vehicle:'DRV-018',issue:'2024-01-20',expiry:'2027-01-20',status:'Valid'},
]
const nav: {id:Section;label:string;icon:any;group:string}[] = [
 {id:'dashboard',label:'Dashboard',icon:LayoutDashboard,group:'Overview'},
 {id:'trucks',label:'Trucks & vehicles',icon:Truck,group:'Fleet'},
 {id:'trailers',label:'Trailers',icon:Package,group:'Fleet'},
 {id:'drivers',label:'Drivers',icon:Users,group:'Fleet'},
 {id:'job-cards',label:'Workshop job cards',icon:Wrench,group:'Workshop'},
 {id:'breakdowns',label:'Breakdowns',icon:AlertTriangle,group:'Workshop'},
 {id:'oil',label:'Oil change records',icon:Fuel,group:'Workshop'},
 {id:'tires',label:'Tire inventory',icon:CircleDot,group:'Inventory'},
 {id:'documents',label:'Documents & expiry',icon:ShieldCheck,group:'Compliance'},
 {id:'expenses',label:'Expenses & invoices',icon:DollarSign,group:'Insights'},
 {id:'reports',label:'Reports & analytics',icon:BarChart3,group:'Insights'},
 {id:'settings',label:'Settings & integrations',icon:Settings,group:'Administration'},
]
const labels:Record<string,string> = {plate:'Plate / ID',name:'Vehicle / name',type:'Type',km:'Odometer (km)',status:'Status',health:'Health',id:'Job card',vehicle:'Vehicle / asset',type2:'Work type',date:'Date',priority:'Priority',cost:'Cost (SAR)',serial:'Tire serial',size:'Tire size',brand:'Brand',location:'Current location',condition:'Condition',item:'Document',issue:'Issue date',expiry:'Expiry date',driver:'Driver',amount:'Amount (SAR)',category:'Category',description:'Description'}
export default function DemoPage(){
 const [section,setSection]=useState<Section>('dashboard')
 const [vehicles,setVehicles]=useState(seedVehicles)
 const [jobs,setJobs]=useState(seedJobs)
 const [tires,setTires]=useState(seedTires)
 const [docs,setDocs]=useState(seedDocs)
 const [query,setQuery]=useState('')
 const [notice,setNotice]=useState('Demo workspace · all changes stay in this browser session')
 const [showForm,setShowForm]=useState(false)
 const [form,setForm]=useState<Row>({})
 const [records,setRecords]=useState<Record<string,Row[]>>({
  breakdowns:[{id:'BD-1042',vehicle:'TRK-1783',description:'Intermittent braking issue',date:'2026-10-28',priority:'High',status:'Open'}],
  oil:[{vehicle:'TRK-2048',date:'2026-10-23',km:'284000',amount:'32',brand:'15W-40',status:'Completed'},{vehicle:'TRK-1783',date:'2026-09-30',km:'310500',amount:'34',brand:'15W-40',status:'Completed'}],
  drivers:[{driver:'DRV-018 · Ahmed Hassan',vehicle:'TRK-2048',status:'Active',expiry:'2027-01-20'},{driver:'DRV-024 · Omar Saleh',vehicle:'TRK-1783',status:'Active',expiry:'2026-11-15'}],
  expenses:[{date:'2026-10-23',vehicle:'TRK-2048',category:'Engine oil & filters',amount:'680',description:'Scheduled service'},{date:'2026-10-21',vehicle:'TRK-1783',category:'Brake parts',amount:'850',description:'Workshop repair'}]
 })
 const title=nav.find(n=>n.id===section)?.label||'Dashboard'
 const panel='rounded-xl border border-slate-200 bg-white shadow-sm'
 const muted='text-slate-500'
 const filteredVehicles=useMemo(()=>vehicles.filter(v=>Object.values(v).join(' ').toLowerCase().includes(query.toLowerCase())),[vehicles,query])
 const currentRows:Row[]=section==='trucks'?filteredVehicles.filter(v=>v.type==='Truck'):section==='trailers'?filteredVehicles.filter(v=>v.type==='Trailer'):section==='job-cards'?jobs:section==='tires'?tires:section==='documents'?docs:records[section]||[]
 const fields:Record<string,string[]> = {
  trucks:['plate','name','km','status'],trailers:['plate','name','status'], 'job-cards':['id','vehicle','type','date','priority','status','cost'],
  tires:['serial','size','brand','location','condition'],documents:['item','vehicle','issue','expiry','status'],
  breakdowns:['id','vehicle','description','date','priority','status'],oil:['vehicle','date','km','amount','brand','status'],
  drivers:['driver','vehicle','status','expiry'],expenses:['date','vehicle','category','amount','description']
 }
 const fieldList=fields[section]||[]
 function addRecord(){
  const row={...form}
  if(section==='trucks'||section==='trailers'){row.type=section==='trucks'?'Truck':'Trailer';setVehicles(p=>[row,...p])}
  else if(section==='job-cards')setJobs(p=>[{...row,id:row.id||'WO-'+(2410+p.length)},...p])
  else if(section==='tires')setTires(p=>[row,...p])
  else if(section==='documents')setDocs(p=>[row,...p])
  else setRecords(p=>({...p,[section]:[row,...(p[section]||[])]}))
  setForm({});setShowForm(false);setNotice('Sample record added. This change is temporary and not sent to production.')
 }
 function exportCsv(){
  const rows=currentRows
  const keys=fieldList.length?fieldList:Object.keys(rows[0]||{})
  const csv=[keys.join(','),...rows.map(r=>keys.map(k=>'"'+String(r[k]||'').replaceAll('"','""')+'"').join(','))].join('\n')
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download='fleet-demo-'+section+'.csv';a.click();URL.revokeObjectURL(url)
 }
 return <main className="min-h-screen bg-slate-50 text-slate-900">
  <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur"><div className="flex h-16 items-center justify-between px-4 lg:px-6">
   <Link href="/" className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white"><Truck size={22}/></span><span className="font-bold">Fleet Manager Pro <span className="block text-xs font-medium text-slate-500">Fleet operations demo</span></span></Link>
   <div className="flex items-center gap-2"><span className="hidden rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 sm:block">● Public demo · fictional data</span><Link href="/login" className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50">Sign in</Link></div>
  </div></header>
  <div className="flex min-h-[calc(100vh-64px)]">
   <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-3 lg:block"><div className="mb-3 rounded-lg bg-blue-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Workspace</p><p className="mt-1 font-semibold">Demo Transport Co.</p><p className="text-xs text-slate-500">Sample environment</p></div>
    {['Overview','Fleet','Workshop','Inventory','Compliance','Insights','Administration'].map(group=><div key={group} className="mb-3"><p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group}</p>{nav.filter(n=>n.group===group).map(n=><button key={n.id} onClick={()=>{setSection(n.id);setQuery('')}} className={'mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium '+(section===n.id?'bg-blue-600 text-white':'text-slate-600 hover:bg-slate-100')}><n.icon size={17}/>{n.label}</button>)}</div>)}
    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><Bell size={15} className="mb-1"/>Safe demo mode. No production data or notifications are connected.</div>
   </aside>
   <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
    <div className="mb-5 flex gap-2 overflow-x-auto pb-1 lg:hidden">{nav.map(n=><button key={n.id} onClick={()=>setSection(n.id)} className={'whitespace-nowrap rounded-lg px-3 py-2 text-sm '+(section===n.id?'bg-blue-600 text-white':'border bg-white')}>{n.label}</button>)}</div>
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><div className="mb-1 flex items-center gap-2 text-xs font-medium text-blue-700"><span>DEMO WORKSPACE</span><span className="text-slate-300">/</span><span>{title}</span></div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{section==='dashboard'?'Fleet Maintenance Dashboard':title}</h1><p className="mt-1 text-sm text-slate-500">Explore the main fleet workflows using fictional sample records. No account required.</p></div>
     {section!=='dashboard'&&section!=='reports'&&section!=='settings'?<div className="flex flex-wrap gap-2"><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><Download size={15}/> Export CSV</button><button onClick={()=>{setForm({});setShowForm(true)}} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white"><Plus size={16}/> Add record</button></div>:<button onClick={()=>setNotice('Demo dashboard refreshed with sample metrics.')} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold"><RefreshCw size={15}/> Refresh</button>}
    </div>
    {notice&&<div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss"><X size={14}/></button></div>}
    {section==='dashboard'?<><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
     {label:'Total fleet',value:String(vehicles.length),note:'Trucks and trailers',icon:Truck},
     {label:'Maintenance due',value:String(jobs.filter(j=>j.status!=='Completed').length),note:'Scheduled / in progress',icon:Wrench},
     {label:'Tires tracked',value:String(tires.length),note:'Serial-level records',icon:CircleDot},
     {label:'Documents to review',value:String(docs.filter(d=>d.status!=='Valid').length),note:'Expiry reminders',icon:CalendarClock}
    ].map(s=><div key={s.label} className={panel+' p-5'}><div className="flex items-center justify-between text-sm text-slate-500"><span>{s.label}</span><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><s.icon size={18}/></span></div><div className="mt-3 text-3xl font-bold">{s.value}</div><p className="mt-1 text-xs text-slate-500">{s.note}</p></div>)}</div>
     <div className="mt-5 grid gap-5 xl:grid-cols-3"><div className={panel+' p-5 xl:col-span-2'}><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Recent workshop activity</h2><button onClick={()=>setSection('job-cards')} className="text-sm font-semibold text-blue-700">View job cards →</button></div>{jobs.slice(0,3).map(j=><div key={j.id} className="flex flex-col justify-between gap-2 border-t py-3 sm:flex-row sm:items-center"><div><p className="font-semibold">{j.type}</p><p className="text-xs text-slate-500">{j.id} · {j.vehicle} · {j.date}</p></div><span className="w-fit rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">{j.status}</span></div>)}</div>
     <div className={panel+' p-5'}><h2 className="mb-4 font-bold">Attention required</h2>{[...docs.filter(d=>d.status!=='Valid').map(d=>({name:d.item,detail:d.vehicle+' · '+d.expiry,icon:FileText})),...tires.filter(t=>t.condition==='Inspect').map(t=>({name:'Tire inspection',detail:t.serial,icon:CircleDot}))].map((a,i)=><div key={a.name+i} className="flex gap-3 border-t py-3"><span className="rounded-lg bg-amber-50 p-2 text-amber-700"><a.icon size={16}/></span><div><p className="text-sm font-semibold">{a.name}</p><p className="text-xs text-slate-500">{a.detail}</p></div></div>)}</div></div>
     <div className={panel+' mt-5 p-5'}><h2 className="mb-3 font-bold">Fleet health overview</h2><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{vehicles.map(v=><div key={v.plate} className="rounded-lg border p-4"><div className="flex justify-between gap-2"><p className="font-semibold">{v.plate}</p><span className="text-xs text-slate-500">{v.health}</span></div><p className="mt-1 text-sm text-slate-500">{v.name}</p><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-blue-600" style={{width:v.health}}/></div><p className="mt-2 text-xs">{v.status}</p></div>)}</div></div>
    </>:section==='reports'?<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[{name:'Maintenance summary',desc:'Work orders by status and vehicle',icon:BarChart3},{name:'Tire inventory report',desc:'Serials, location and condition',icon:CircleDot},{name:'Oil consumption report',desc:'Liters by truck and service date',icon:Fuel},{name:'Document expiry report',desc:'Upcoming and expired compliance items',icon:ShieldCheck},{name:'Fleet cost report',desc:'Sample expenses by category',icon:DollarSign},{name:'Vehicle history',desc:'Maintenance and breakdown timeline',icon:History}].map(r=><button key={r.name} onClick={()=>setNotice(r.name+' report preview is based on demo records. Use Export CSV from the relevant section to download sample data.')} className={panel+' p-5 text-left transition hover:border-blue-300 hover:shadow-md'}><r.icon className="mb-3 text-blue-600" size={24}/><h2 className="font-bold">{r.name}</h2><p className="mt-1 text-sm text-slate-500">{r.desc}</p><span className="mt-4 inline-block text-sm font-semibold text-blue-700">Preview report →</span></button>)}</div>:section==='settings'?<div className="grid gap-5 xl:grid-cols-2"><div className={panel+' p-5'}><h2 className="font-bold">Workspace settings</h2><p className="mt-1 text-sm text-slate-500">Illustrative configuration controls</p>{['Company profile','Language: English / Arabic','Date and currency formats','User roles and permissions'].map(x=><button key={x} onClick={()=>setNotice(x+' is shown for demonstration; settings are not persisted.')} className="mt-3 flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm">{x}<span className="text-blue-700">Configure →</span></button>)}</div><div className={panel+' p-5'}><h2 className="font-bold">Integrations & alerts</h2><p className="mt-1 text-sm text-slate-500">Production integrations are intentionally disconnected.</p>{['Excel Online / OneDrive two-way sync','Document expiry email alerts','Primary / CC / BCC recipients','Database storage monitor','Maintenance reminders'].map(x=><div key={x} className="mt-3 flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span>{x}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">Demo only</span></div>)}</div></div>:<div className={panel+' overflow-hidden'}><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">{title} records</h2><p className="text-xs text-slate-500">{currentRows.length} sample records · changes are temporary</p></div><div className="relative"><Search className="absolute left-3 top-2.5 text-slate-400" size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search records..." className="w-full rounded-lg border py-2 pl-9 pr-3 text-sm sm:w-64"/></div></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left"><thead className="bg-slate-50">{fieldList.map(k=><th key={k} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{labels[k]||k}</th>)}<th className="px-4 py-3 text-xs font-semibold uppercase text-slate-500">Action</th></thead><tbody>{currentRows.filter(r=>Object.values(r).join(' ').toLowerCase().includes(query.toLowerCase())).map((r,i)=><tr key={String(r.id||r.plate||r.serial||r.item||r.vehicle)+i} className="border-t hover:bg-slate-50">{fieldList.map(k=><td key={k} className="px-4 py-3 text-sm">{r[k]||'—'}</td>)}<td className="px-4 py-3"><button onClick={()=>{setForm({...r});setShowForm(true)}} className="text-sm font-semibold text-blue-700">Edit</button></td></tr>)}</tbody></table>{currentRows.length===0&&<p className="p-8 text-center text-sm text-slate-500">No sample records yet. Add a record to explore this workflow.</p>}</div></div>}
    <div className="mt-6 rounded-xl bg-slate-900 p-5 text-white sm:flex sm:items-center sm:justify-between"><div><p className="font-semibold">This is a safe, interactive demo</p><p className="mt-1 text-sm text-slate-300">Sample changes stay temporary. No customer database, email alerts, or live integrations are connected.</p></div><Link href="/signup" className="mt-4 inline-flex rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-bold hover:bg-blue-400 sm:mt-0">Create your workspace →</Link></div>
    <footer className="mt-6 flex flex-col justify-between gap-2 border-t pt-5 text-xs text-slate-500 sm:flex-row"><span>Fleet Manager Pro · Public contest demo</span><span>Fictional sample data · Production authentication remains protected</span></footer>
   </section>
  </div>
  {showForm&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-xl font-bold">{Object.keys(form).length?'Edit sample record':'Add sample record'}</h2><p className="text-sm text-slate-500">{title} · demo only</p></div><button onClick={()=>setShowForm(false)} className="rounded-lg p-2 hover:bg-slate-100"><X size={20}/></button></div><div className="grid gap-3 sm:grid-cols-2">{(fieldList.length?fieldList.filter(k=>k!=='health'):['name','status']).map(k=><label key={k} className="text-sm font-medium">{labels[k]||k}<input value={form[k]||''} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={labels[k]||k} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"/></label>)}</div><div className="mt-5 flex justify-end gap-2"><button onClick={()=>setShowForm(false)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button><button onClick={addRecord} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Save sample record</button></div><p className="mt-3 text-xs text-slate-500">Changes are held in page memory only and disappear when you reload.</p></div></div>}
 </main>
}
