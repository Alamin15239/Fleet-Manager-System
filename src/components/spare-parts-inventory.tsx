'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost, apiPatch } from '@/lib/api'
import * as XLSX from 'xlsx'
import { toast } from '@/lib/localized-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Boxes, Plus, ArrowDownToLine, Search, RefreshCw, FileSpreadsheet, FileText, Printer } from 'lucide-react'

type Item = { id:string; name:string; partNumber?:string|null; category:string; unit:string; oilGrade?:string|null; reorderLevel:number; stockQty:number }
type VehicleOption = { id:string; label:string }
type Tx = { id:string; itemId:string; itemName:string; partNumber?:string|null; vehicleLabel?:string|null; type:string; quantity:number; unit:string; unitCost?:number|null; transactionDate:string; reference?:string|null; vehicleType?:string|null; vehicleId?:string|null; jobCardId?:string|null; sourceType?:string|null; notes?:string|null }
const labels:Record<string,string> = { OPENING:'Opening stock', PURCHASE:'Purchase / stock in', ISSUE:'Issue to vehicle', CUSTOMER_RETURN:'Return to store', SUPPLIER_RETURN:'Return to supplier', ADJUSTMENT_IN:'Stock adjustment (+)', ADJUSTMENT_OUT:'Stock adjustment (-)' }
const reportTitles:Record<string,string> = { stock:'Current stock report', low:'Low / reorder stock report', movement:'Stock movement ledger', consumption:'Parts issued / consumption report', oil:'Engine oil stock report' }

type SearchOption = { value:string; label:string }
function SearchPicker({value,options,onChange,placeholder,searchPlaceholder}:{value:string;options:SearchOption[];onChange:(value:string)=>void;placeholder:string;searchPlaceholder:string}) {
  const [open,setOpen]=useState(false)
  const [query,setQuery]=useState('')
  const selected=options.find(option=>option.value===value)
  const filtered=options.filter(option=>option.label.toLowerCase().includes(query.trim().toLowerCase()))
  return <div className="relative">
    <Input value={open?query:(selected?.label||'')} placeholder={placeholder} onFocus={()=>{setOpen(true);setQuery('')}} onChange={event=>{setQuery(event.target.value);setOpen(true)}} onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);setQuery('')}if(event.key==='Enter'&&open&&filtered.length===1){event.preventDefault();onChange(filtered[0].value);setOpen(false);setQuery('')}}} />
    {open&&<><button type="button" aria-label="Close search options" className="fixed inset-0 z-20 cursor-default" onClick={()=>{setOpen(false);setQuery('')}}/><div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">{filtered.length?filtered.map(option=><button key={option.value} type="button" className={`block w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${option.value===value?'bg-accent/60 font-medium':''}`} onClick={()=>{onChange(option.value);setOpen(false);setQuery('')}}>{option.label}</button>):<p className="px-3 py-3 text-sm text-muted-foreground">No matching options found</p>}</div></>}
  </div>
}
export function SparePartsInventory() {
  const [items,setItems]=useState<Item[]>([])
  const [transactions,setTransactions]=useState<Tx[]>([])
  const [trucks,setTrucks]=useState<VehicleOption[]>([])
  const [trailers,setTrailers]=useState<VehicleOption[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [tab,setTab]=useState<'stock'|'history'|'reports'>('stock')
  const [entryMode,setEntryMode]=useState<'part'|'movement'|null>(null)
  const [editingItemId,setEditingItemId]=useState('')
  const [editItemForm,setEditItemForm]=useState({name:'',partNumber:'',category:'GENERAL',oilGrade:'',unit:'pcs',stockQty:'0',reorderLevel:'0'})
  const [reportType,setReportType]=useState<'stock'|'low'|'movement'|'consumption'|'oil'>('stock')
  const [reportStart,setReportStart]=useState('')
  const [reportEnd,setReportEnd]=useState('')
  const [itemForm,setItemForm]=useState({name:'',partNumber:'',category:'GENERAL',unit:'pcs',oilGrade:'',reorderLevel:'0'})
  const [txForm,setTxForm]=useState({itemId:'',type:'PURCHASE',quantity:'',transactionDate:new Date().toISOString().slice(0,10),reference:'',vehicleType:'truck',vehicleId:'',unitCost:'',notes:''})
  const [saving,setSaving]=useState(false)
  const [editingIssueId,setEditingIssueId]=useState('')
  const [editIssue,setEditIssue]=useState({itemId:'',quantity:'',transactionDate:'',reference:'',vehicleType:'truck' as 'truck'|'trailer',vehicleId:'',unitCost:'',notes:''})
  const load=useCallback(async()=>{setLoading(true);try{
    const [r,truckResponse,trailerResponse]=await Promise.all([apiGet('/api/inventory'),apiGet('/api/trucks?limit=200'),apiGet('/api/trailers?limit=200')])
    const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load stock')
    setItems(d.items||[]);setTransactions(d.transactions||[])
    if(truckResponse.ok){const options=await truckResponse.json();setTrucks((options.data||[]).map((v:any)=>({id:v.id,label:`${v.licensePlate} · ${v.year} ${v.make} ${v.model}`})))}
    if(trailerResponse.ok){const options=await trailerResponse.json();setTrailers((options.data||[]).map((v:any)=>({id:v.id,label:`Trailer ${v.number}`})))}
  }catch(e){toast.error(e instanceof Error?e.message:'Unable to load stock')}finally{setLoading(false)}},[])
  useEffect(()=>{void load()},[load])
  useEffect(() => {
    const handleFleetDataChanged = () => { void load() }
    window.addEventListener('fleet:data-changed', handleFleetDataChanged)
    return () => window.removeEventListener('fleet:data-changed', handleFleetDataChanged)
  }, [load])

  const filtered=useMemo(()=>items.filter(x=>[x.name,x.partNumber,x.category,x.oilGrade].join(' ').toLowerCase().includes(search.toLowerCase())),[items,search])
  const low=items.filter(x=>x.stockQty<=x.reorderLevel)
  const reportRows=useMemo(()=>{
    const start=reportStart?new Date(reportStart+'T00:00:00').getTime():null
    const end=reportEnd?new Date(reportEnd+'T23:59:59').getTime():null
    const tx=transactions.filter(x=>{
      const dt=new Date(x.transactionDate).getTime()
      const dateOk=(start===null||dt>=start)&&(end===null||dt<=end)
      const searchOk=[x.itemName,x.partNumber,x.vehicleLabel,x.type,x.reference,x.notes].join(' ').toLowerCase().includes(search.toLowerCase())
      return dateOk&&searchOk
    })
    if(reportType==='low')return items.filter(x=>x.stockQty<=x.reorderLevel)
    if(reportType==='movement')return tx
    if(reportType==='consumption')return tx.filter(x=>x.type==='ISSUE')
    if(reportType==='oil')return items.filter(x=>x.category==='ENGINE_OIL'||/oil/i.test(x.name)).map(item=>({itemName:item.name,type:'STOCK_BALANCE',quantity:item.stockQty,unit:item.unit,transactionDate:new Date().toISOString(),reference:'',vehicleType:'',vehicleId:'',notes:'Current oil stock'}))
    return items
  },[items,transactions,reportType,reportStart,reportEnd,search])
  const isTransactionReport=reportType==='movement'||reportType==='consumption'
  const vehicleLabel=(type?:string|null,id?:string|null,recordLabel?:string|null)=>{if(recordLabel)return recordLabel;if(!id)return '';const pool=type?.toLowerCase()==='truck'?trucks:trailers;return pool.find(v=>v.id===id)?.label||id}
  const reportHeaders=isTransactionReport?['Date','Part','Transaction','Quantity','Unit','Reference','Vehicle','Notes']:['Part','Part number','Category','Oil grade','Current stock','Unit','Reorder level','Status']
  const reportData=reportRows.map((x:any)=>isTransactionReport?[new Date(x.transactionDate).toLocaleDateString(),x.itemName,labels[x.type]||x.type,x.quantity,x.unit,x.reference||'',x.vehicleId?vehicleLabel(x.vehicleType,x.vehicleId,x.vehicleLabel):'',x.notes||'']:[x.name,x.partNumber||'',x.category,x.oilGrade||'',x.stockQty,x.unit,x.reorderLevel,x.stockQty<=x.reorderLevel?'REORDER':'IN STOCK'])
  function downloadExcel(){
    const sheet=XLSX.utils.aoa_to_sheet([reportHeaders,...reportData])
    sheet['!cols']=reportHeaders.map(h=>({wch:Math.max(14,h.length+2)}))
    const workbook=XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook,sheet,'Spare Parts Report')
    XLSX.writeFile(workbook,'fleet-manager-spare-parts-'+reportType+'-'+new Date().toISOString().slice(0,10)+'.xlsx')
  }
  function downloadCsv(){
    const csv=[reportHeaders,...reportData].map(row=>row.map((v:any)=>{const s=String(v??'');return '"'+s.replace(/"/g,'""')+'"'}).join(',')).join('\\r\\n')
    const blob=new Blob(['\\uFEFF'+csv],{type:'text/csv;charset=utf-8;'})
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='fleet-manager-spare-parts-'+reportType+'-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url)
  }
  function printReport(){
    const popup=window.open('','_blank','width=1100,height=800')
    if(!popup){toast.error('Your browser blocked the report window. Allow pop-ups and try again.');return}
    const escapeHtml=(value:unknown)=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char] as string))
    const heading=reportTitles[reportType]||'Spare parts report'
    const period=reportStart||reportEnd?('Period: '+(reportStart||'Start')+' to '+(reportEnd||'Today')):'All available dates'
    const tableHead=reportHeaders.map(value=>'<th>'+escapeHtml(value)+'</th>').join('')
    const tableRows=reportData.length?reportData.map(row=>'<tr>'+row.map((value:any)=>'<td>'+escapeHtml(value)+'</td>').join('')+'</tr>').join(''):'<tr><td colspan="'+reportHeaders.length+'" class="empty">No records match this report</td></tr>'
    popup.document.open()
    popup.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+escapeHtml(heading)+'</title><style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;margin:28px;font-size:12px}h1{font-size:21px;margin:0 0 8px}.meta{color:#555;margin:0 0 18px}.count{margin:0 0 12px;font-weight:600}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:7px 8px;text-align:left;vertical-align:top}th{background:#eee;font-weight:700}.empty{text-align:center;padding:24px;color:#555}.footer{margin-top:18px;color:#666;font-size:10px}@page{size:landscape;margin:12mm}@media print{body{margin:0}}</style></head><body><h1>'+escapeHtml(heading)+'</h1><p class="meta">'+escapeHtml(period)+' · Generated '+escapeHtml(new Date().toLocaleString())+'</p><p class="count">'+reportData.length+' records</p><table><thead><tr>'+tableHead+'</tr></thead><tbody>'+tableRows+'</tbody></table><p class="footer">Fleet Manager Pro · Spare Parts & Consumables</p></body></html>')
    popup.document.close()
    popup.onload=()=>{popup.focus();popup.print()}
  }
  async function createItem(e:React.FormEvent){e.preventDefault();setSaving(true);try{const r=await apiPost('/api/inventory',{action:'createItem',...itemForm,reorderLevel:Number(itemForm.reorderLevel)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to add item');setItemForm({name:'',partNumber:'',category:'GENERAL',unit:'pcs',oilGrade:'',reorderLevel:'0'});toast.success('Part added');await load()}catch(e){toast.error(e instanceof Error?e.message:'Unable to add part')}finally{setSaving(false)}}
  async function saveTransaction(e:React.FormEvent){e.preventDefault();if(txForm.type==='ISSUE'&&!txForm.vehicleId){toast.error('Select a truck or trailer before issuing a part');return}setSaving(true);try{const r=await apiPost('/api/inventory',{...txForm,quantity:Number(txForm.quantity),unitCost:txForm.unitCost?Number(txForm.unitCost):null});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to save transaction');setTxForm(v=>({...v,quantity:'',reference:'',vehicleId:'',unitCost:'',notes:''}));toast.success('Stock transaction recorded');await load()}catch(e){toast.error(e instanceof Error?e.message:'Unable to save transaction')}finally{setSaving(false)}}
  function beginEditIssue(transaction:Tx){
    setEditingIssueId(transaction.id)
    setEditIssue({
      itemId:transaction.itemId,
      quantity:String(transaction.quantity),
      transactionDate:new Date(transaction.transactionDate).toISOString().slice(0,10),
      reference:transaction.reference||'',
      vehicleType:transaction.vehicleType==='trailer'?'trailer':'truck',
      vehicleId:transaction.vehicleId||'',
      unitCost:transaction.unitCost==null?'':String(transaction.unitCost),
      notes:transaction.notes||''
    })
  }
  async function saveIssue(transactionId:string){
    if(!editIssue.itemId||!editIssue.vehicleId||!editIssue.quantity||!editIssue.transactionDate){toast.error('Complete the part, quantity, date and vehicle');return}
    setSaving(true)
    try{
      const r=await apiPatch('/api/inventory',{action:'updateIssue',transactionId,...editIssue,quantity:Number(editIssue.quantity),unitCost:editIssue.unitCost===''?null:Number(editIssue.unitCost)})
      const d=await r.json()
      if(!r.ok)throw new Error(d.error||'Unable to update issued part')
      toast.success('Issued part transaction updated')
      setEditingIssueId('')
      await load()
    }catch(e){toast.error(e instanceof Error?e.message:'Unable to update issued part')}
    finally{setSaving(false)}
  }
  function beginEditItem(item:Item){
    setEditingItemId(item.id)
    setEditItemForm({name:item.name,partNumber:item.partNumber||'',category:item.category,oilGrade:item.oilGrade||'',unit:item.unit,stockQty:String(item.stockQty),reorderLevel:String(item.reorderLevel)})
  }
  async function saveItemDetails(){
    const stockQty=Number(editItemForm.stockQty),reorderLevel=Number(editItemForm.reorderLevel)
    if(!editItemForm.name.trim()||!editItemForm.unit.trim()||!Number.isFinite(stockQty)||stockQty<0||!Number.isFinite(reorderLevel)||reorderLevel<0){toast.error('Enter a part name, valid unit, stock quantity and reorder threshold');return}
    setSaving(true)
    try{
      const r=await apiPatch('/api/inventory',{action:'updateItem',itemId:editingItemId,name:editItemForm.name,partNumber:editItemForm.partNumber,category:editItemForm.category,oilGrade:editItemForm.oilGrade,unit:editItemForm.unit,reorderLevel})
      const d=await r.json()
      if(!r.ok)throw new Error(d.error||'Unable to update part details')
      const current=items.find(item=>item.id===editingItemId)
      if(current&&Math.abs(current.stockQty-stockQty)>0.000001){
        const stockResponse=await apiPost('/api/inventory',{action:'setCurrentStock',itemId:editingItemId,quantity:stockQty})
        const stockData=await stockResponse.json()
        if(!stockResponse.ok)throw new Error(stockData.error||'Part details saved, but stock quantity update failed. Reopen and correct stock.')
      }
      toast.success('Part details and stock updated')
      setEditingItemId('')
      await load()
    }catch(e){toast.error(e instanceof Error?e.message:'Unable to update part')}
    finally{setSaving(false)}
  }
  async function editCurrentStock(item:Item){const entered=window.prompt(`Enter the actual stock quantity for ${item.name} (${item.unit}). Current: ${item.stockQty} ${item.unit}`,String(item.stockQty));if(entered===null)return;const next=Number(entered);if(!Number.isFinite(next)||next<0){toast.error('Enter a valid stock quantity of zero or more');return}if(Math.abs(next-item.stockQty)<0.000001)return;setSaving(true);try{const r=await apiPost('/api/inventory',{action:'setCurrentStock',itemId:item.id,quantity:next});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to update current stock');toast.success(`Current stock updated to ${next} ${item.unit}`);await load()}catch(e){toast.error(e instanceof Error?e.message:'Unable to update current stock')}finally{setSaving(false)}}
  async function editReorderLevel(item:Item){const entered=window.prompt(`Set the low-stock reorder threshold for ${item.name} (${item.unit}). Current: ${item.reorderLevel} ${item.unit}`,String(item.reorderLevel));if(entered===null)return;const next=Number(entered);if(!Number.isFinite(next)||next<0){toast.error('Enter a valid reorder level of zero or more');return}if(Math.abs(next-item.reorderLevel)<0.000001)return;setSaving(true);try{const r=await apiPost('/api/inventory',{action:'setReorderLevel',itemId:item.id,reorderLevel:next});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to update reorder level');toast.success(`Reorder level updated to ${next} ${item.unit}`);await load()}catch(e){toast.error(e instanceof Error?e.message:'Unable to update reorder level')}finally{setSaving(false)}}
  return <div className="space-y-6">
    <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="mb-2 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground"><Boxes className="h-3.5 w-3.5"/> Independent inventory workspace</div><h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Parts, stock & consumables</h2><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Track receipts, issues, returns, stock levels and part consumption in one place. Inventory activity stays separate from workshop job cards.</p></div><Button type="button" variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh data</Button></div></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="overflow-hidden border-l-4 border-l-primary"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><Boxes className="h-4 w-4"/>Part types</CardTitle></CardHeader><CardContent className="text-3xl font-semibold tracking-tight tabular-nums">{items.length}</CardContent></Card>
      <Card className={`overflow-hidden border-l-4 ${low.length?'border-l-amber-500':'border-l-emerald-500'}`}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowDownToLine className="h-4 w-4"/>Low / reorder stock</CardTitle></CardHeader><CardContent className="text-3xl font-semibold tracking-tight tabular-nums">{low.length}</CardContent></Card>
      <Card className="overflow-hidden border-l-4 border-l-sky-500"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4"/>Transactions recorded</CardTitle></CardHeader><CardContent className="text-3xl font-semibold tracking-tight tabular-nums">{transactions.length}</CardContent></Card>
    </div>

    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30"><CardTitle>What would you like to do?</CardTitle><p className="text-sm text-muted-foreground">Choose one task. The form opens only when you need it.</p></CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <button type="button" onClick={()=>setEntryMode(entryMode==='part'?null:'part')} className={entryMode==='part'?'rounded-xl border border-primary bg-primary/5 p-4 text-left ring-1 ring-primary':'rounded-xl border p-4 text-left transition-colors hover:bg-muted/60'}>
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Plus className="h-5 w-5"/></span><span className="block font-semibold">Add a new part</span><span className="mt-1 block text-sm text-muted-foreground">Create an inventory item such as a filter, spare part or engine oil.</span>
        </button>
        <button type="button" onClick={()=>setEntryMode(entryMode==='movement'?null:'movement')} className={entryMode==='movement'?'rounded-xl border border-primary bg-primary/5 p-4 text-left ring-1 ring-primary':'rounded-xl border p-4 text-left transition-colors hover:bg-muted/60'}>
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><ArrowDownToLine className="h-5 w-5"/></span><span className="block font-semibold">Record stock movement</span><span className="mt-1 block text-sm text-muted-foreground">Record a purchase, issue parts to a truck/trailer, returns or stock adjustment.</span>
        </button>
      </CardContent>
    </Card>
    {entryMode==='part'&&<Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30"><CardTitle>Add a new part</CardTitle><p className="text-sm text-muted-foreground">Save the part details first. Add its opening quantity using Record stock movement.</p></CardHeader>
      <CardContent className="p-4 sm:p-6"><form onSubmit={createItem} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>Part name *</Label><Input required value={itemForm.name} onChange={e=>setItemForm(v=>({...v,name:e.target.value}))} placeholder="e.g. Engine oil, air filter"/></div>
        <div className="space-y-1"><Label>Part number (optional)</Label><Input value={itemForm.partNumber} onChange={e=>setItemForm(v=>({...v,partNumber:e.target.value}))} placeholder="Manufacturer / catalogue number"/></div>
        <div className="space-y-1"><Label>Category</Label><Select value={itemForm.category} onValueChange={category=>setItemForm(v=>({...v,category}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['GENERAL','ENGINE_OIL','OIL_FILTER','DIESEL_FILTER','AIR_FILTER','AIR_DRYER_FILTER','WATER_SEPARATOR_FILTER','FUEL_FILTER','OTHER'].map(x=><SelectItem key={x} value={x}>{x.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Unit of measure</Label><Select value={itemForm.unit} onValueChange={unit=>setItemForm(v=>({...v,unit}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['pcs','litre','kg','set','box'].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Oil grade (if applicable)</Label><Input value={itemForm.oilGrade} onChange={e=>setItemForm(v=>({...v,oilGrade:e.target.value}))} placeholder="e.g. 15W-40"/></div>
        <div className="space-y-1"><Label>Low-stock alert threshold</Label><Input type="number" min="0" step="0.01" value={itemForm.reorderLevel} onChange={e=>setItemForm(v=>({...v,reorderLevel:e.target.value}))}/><p className="text-xs text-muted-foreground">Show a reorder warning when stock reaches this amount.</p></div>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={saving}><Plus className="mr-2 h-4 w-4"/>Save part</Button><Button type="button" variant="outline" onClick={()=>setEntryMode(null)}>Close</Button></div>
      </form></CardContent>
    </Card>}
    {entryMode==='movement'&&<Card className="overflow-hidden">
      <CardHeader className="border-b bg-muted/30"><CardTitle>Record stock movement</CardTitle><p className="text-sm text-muted-foreground">Every dropdown below is searchable. Type a part name, part number, movement type, truck plate or trailer number to find it quickly.</p></CardHeader>
      <CardContent className="p-4 sm:p-6"><form onSubmit={saveTransaction} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>Part * (search by name or part number)</Label><SearchPicker value={txForm.itemId} placeholder="Search and choose a part" searchPlaceholder="Search parts" onChange={itemId=>setTxForm(v=>({...v,itemId}))} options={items.map(x=>({value:x.id,label:`${x.name}${x.partNumber?' · '+x.partNumber:''}${x.oilGrade?' · '+x.oilGrade:''} — Available: ${x.stockQty} ${x.unit}`}))}/></div>
        <div className="space-y-1"><Label>Movement type * (search to filter)</Label><SearchPicker value={txForm.type} placeholder="Search movement type" searchPlaceholder="Search movement type" onChange={type=>setTxForm(v=>({...v,type,vehicleId:''}))} options={Object.entries(labels).map(([value,label])=>({value,label}))}/><p className="text-xs text-muted-foreground">Purchases and returns to store add stock. Issues and supplier returns remove stock.</p></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Quantity *</Label><Input required type="number" min="0.01" step="0.01" value={txForm.quantity} onChange={e=>setTxForm(v=>({...v,quantity:e.target.value}))}/></div><div className="space-y-1"><Label>Date *</Label><Input required type="date" value={txForm.transactionDate} onChange={e=>setTxForm(v=>({...v,transactionDate:e.target.value}))}/></div></div>
        {txForm.type==='ISSUE'&&<><div className="space-y-1"><Label>Vehicle type *</Label><SearchPicker value={txForm.vehicleType} placeholder="Search vehicle type" searchPlaceholder="Search vehicle type" onChange={vehicleType=>setTxForm(v=>({...v,vehicleType,vehicleId:''}))} options={[{value:'truck',label:'Truck'},{value:'trailer',label:'Trailer'}]}/></div><div className="space-y-1"><Label>{txForm.vehicleType==='truck'?'Truck / plate number * (search)':'Trailer number * (search)'}</Label><SearchPicker value={txForm.vehicleId} placeholder="Search truck plate or trailer number" searchPlaceholder="Search vehicle" onChange={vehicleId=>setTxForm(v=>({...v,vehicleId}))} options={(txForm.vehicleType==='truck'?trucks:trailers).map(vehicle=>({value:vehicle.id,label:vehicle.label}))}/>{(txForm.vehicleType==='truck'?trucks:trailers).length===0&&<p className="text-xs text-amber-700">No active {txForm.vehicleType}s available.</p>}<p className="text-xs text-muted-foreground">This links the issue to the selected vehicle in transaction history.</p></div></>}
        <div className="space-y-1"><Label>Reference number (optional)</Label><Input value={txForm.reference} onChange={e=>setTxForm(v=>({...v,reference:e.target.value}))} placeholder="Invoice, voucher or document number"/></div>
        <div className="space-y-1"><Label>Notes (optional)</Label><Input value={txForm.notes} onChange={e=>setTxForm(v=>({...v,notes:e.target.value}))} placeholder="Add a short explanation"/></div>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><Button disabled={saving||!txForm.itemId}><ArrowDownToLine className="mr-2 h-4 w-4"/>Save stock movement</Button><Button type="button" variant="outline" onClick={()=>setEntryMode(null)}>Close</Button></div>
      </form></CardContent>
    </Card>}
    <Card className="overflow-hidden"><CardHeader className="flex flex-row items-center justify-between space-y-0 border-b bg-muted/30"><CardTitle>{tab==='stock' ? 'Current stock' : tab==='history' ? 'Stock movement history' : 'Spare parts reports'}</CardTitle><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></CardHeader><CardContent className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-2"><Button variant={tab==='stock'?'default':'ghost'} onClick={()=>{setTab('stock');setSearch('')}}>Current stock</Button><Button variant={tab==='history'?'default':'ghost'} onClick={()=>{setTab('history');setSearch('')}}>Stock movement history</Button><Button variant={tab==='reports'?'default':'ghost'} onClick={()=>{setTab('reports');setSearch('')}}><FileText className="mr-2 h-4 w-4"/>Reports</Button><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder={tab==='stock' ? 'Search part name, part number or category' : 'Search part, part number, truck plate, trailer number or transaction'} value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
      {editingItemId&&tab==='stock'&&<div className="rounded-xl border bg-background p-4 sm:p-5"><div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Edit part details</h3><p className="text-sm text-muted-foreground">Update every field for this inventory item. Stock changes are saved as a ledger adjustment.</p></div><Button type="button" variant="ghost" size="sm" onClick={()=>setEditingItemId('')}>Close</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><div className="space-y-1"><Label>Part name *</Label><Input value={editItemForm.name} onChange={e=>setEditItemForm(v=>({...v,name:e.target.value}))}/></div><div className="space-y-1"><Label>Part number</Label><Input value={editItemForm.partNumber} onChange={e=>setEditItemForm(v=>({...v,partNumber:e.target.value}))}/></div><div className="space-y-1"><Label>Category</Label><Select value={editItemForm.category} onValueChange={category=>setEditItemForm(v=>({...v,category}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['GENERAL','ENGINE_OIL','OIL_FILTER','DIESEL_FILTER','AIR_FILTER','AIR_DRYER_FILTER','WATER_SEPARATOR_FILTER','FUEL_FILTER','OTHER'].map(x=><SelectItem key={x} value={x}>{x.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Oil grade / specification</Label><Input value={editItemForm.oilGrade} onChange={e=>setEditItemForm(v=>({...v,oilGrade:e.target.value}))} placeholder="e.g. 15W-40"/></div><div className="space-y-1"><Label>Unit</Label><Select value={editItemForm.unit} onValueChange={unit=>setEditItemForm(v=>({...v,unit}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['pcs','litre','kg','set','box'].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label>Current stock quantity</Label><Input type="number" min="0" step="0.01" value={editItemForm.stockQty} onChange={e=>setEditItemForm(v=>({...v,stockQty:e.target.value}))}/><p className="text-xs text-muted-foreground">Corrections create an adjustment transaction.</p></div><div className="space-y-1"><Label>Reorder threshold</Label><Input type="number" min="0" step="0.01" value={editItemForm.reorderLevel} onChange={e=>setEditItemForm(v=>({...v,reorderLevel:e.target.value}))}/></div></div><div className="mt-4 flex flex-wrap gap-2"><Button type="button" disabled={saving} onClick={()=>void saveItemDetails()}>Save all changes</Button><Button type="button" variant="outline" disabled={saving} onClick={()=>setEditingItemId('')}>Cancel</Button></div></div>}{loading?<p className="py-8 text-center text-sm text-muted-foreground">Loading inventory…</p>:tab==='reports'?<div className="space-y-4"><div className="flex flex-wrap items-end gap-3"><div className="min-w-48 space-y-1"><Label>Report type</Label><Select value={reportType} onValueChange={(v:any)=>setReportType(v)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="stock">Current stock</SelectItem><SelectItem value="low">Low / reorder stock</SelectItem><SelectItem value="movement">Stock movement ledger</SelectItem><SelectItem value="consumption">Parts issued / consumption</SelectItem><SelectItem value="oil">Engine oil stock</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>From</Label><Input type="date" value={reportStart} onChange={e=>setReportStart(e.target.value)}/></div><div className="space-y-1"><Label>To</Label><Input type="date" value={reportEnd} onChange={e=>setReportEnd(e.target.value)}/></div><Button onClick={downloadExcel}><FileSpreadsheet className="mr-2 h-4 w-4"/>Export Excel (.xlsx)</Button><Button variant="outline" onClick={downloadCsv}>Export CSV</Button><Button variant="outline" onClick={printReport}><Printer className="mr-2 h-4 w-4"/>Print / Save PDF</Button></div><p className="text-sm text-muted-foreground">{reportData.length} records · Date filters apply to transaction-based reports. Print / Save PDF opens a report-only page.</p><div className="overflow-x-auto"><Table><TableHeader><TableRow>{reportHeaders.map(h=><TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>{reportData.map((row:any[],i)=><TableRow key={i}>{row.map((v:any,j)=><TableCell key={j}>{v}</TableCell>)}</TableRow>)}{!reportData.length&&<TableRow><TableCell colSpan={reportHeaders.length} className="py-8 text-center text-muted-foreground">No records match this report</TableCell></TableRow>}</TableBody></Table></div></div>:tab==='stock'?<div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Part</TableHead><TableHead>Part no.</TableHead><TableHead>Category / grade</TableHead><TableHead>In stock</TableHead><TableHead>Reorder at</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{filtered.map(x=><TableRow key={x.id}><TableCell className="font-medium">{x.name}</TableCell><TableCell>{x.partNumber||'—'}</TableCell><TableCell>{x.category.replaceAll('_',' ')} {x.oilGrade||''}</TableCell><TableCell>{x.stockQty} {x.unit}</TableCell><TableCell>{x.reorderLevel} {x.unit}</TableCell><TableCell>{x.stockQty<=x.reorderLevel?<span className="inline-flex rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">Reorder</span>:<span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">In stock</span>}</TableCell><TableCell><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="default" disabled={saving} onClick={()=>beginEditItem(x)}>Edit all</Button></div></TableCell></TableRow>)}{!filtered.length&&<TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No parts found</TableCell></TableRow>}</TableBody></Table></div>:<div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Part</TableHead><TableHead>Transaction</TableHead><TableHead>Quantity</TableHead><TableHead>Reference</TableHead><TableHead>Vehicle</TableHead><TableHead>Notes</TableHead><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{transactions.filter(x=>[x.itemName,x.partNumber,x.vehicleLabel,x.type,x.reference,x.notes].join(' ').toLowerCase().includes(search.toLowerCase())).map(x=><TableRow key={x.id}>
      <TableCell>{editingIssueId===x.id?<Input type="date" className="min-w-36" value={editIssue.transactionDate} onChange={e=>setEditIssue(v=>({...v,transactionDate:e.target.value}))}/>:new Date(x.transactionDate).toLocaleDateString()}</TableCell>
      <TableCell>{editingIssueId===x.id?<Select value={editIssue.itemId} onValueChange={itemId=>setEditIssue(v=>({...v,itemId}))}><SelectTrigger className="min-w-48"><SelectValue/></SelectTrigger><SelectContent>{items.map(item=><SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>)}</SelectContent></Select>:x.itemName}</TableCell>
      <TableCell>{labels[x.type]||x.type}</TableCell>
      <TableCell>{editingIssueId===x.id?<div className="min-w-24"><Input type="number" min="0.01" step="0.01" value={editIssue.quantity} onChange={e=>setEditIssue(v=>({...v,quantity:e.target.value}))}/><span className="text-xs text-muted-foreground">{items.find(i=>i.id===editIssue.itemId)?.unit||x.unit}</span></div>:<>{x.quantity} {x.unit}</>}</TableCell>
      <TableCell>{editingIssueId===x.id?<Input className="min-w-32" value={editIssue.reference} onChange={e=>setEditIssue(v=>({...v,reference:e.target.value}))} placeholder="Reference"/>:x.reference||'—'}</TableCell>
      <TableCell>{editingIssueId===x.id?<div className="min-w-56 space-y-2"><Select value={editIssue.vehicleType} onValueChange={(vehicleType:'truck'|'trailer')=>setEditIssue(v=>({...v,vehicleType,vehicleId:''}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="truck">Truck</SelectItem><SelectItem value="trailer">Trailer</SelectItem></SelectContent></Select><Select value={editIssue.vehicleId} onValueChange={vehicleId=>setEditIssue(v=>({...v,vehicleId}))}><SelectTrigger><SelectValue placeholder="Select vehicle"/></SelectTrigger><SelectContent>{(editIssue.vehicleType==='truck'?trucks:trailers).map(v=><SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>)}</SelectContent></Select></div>:x.vehicleId?vehicleLabel(x.vehicleType,x.vehicleId):'—'}</TableCell>
      <TableCell>{editingIssueId===x.id?<div className="min-w-36 space-y-2"><Input type="number" min="0" step="0.01" value={editIssue.unitCost} onChange={e=>setEditIssue(v=>({...v,unitCost:e.target.value}))} placeholder="Unit cost"/><Input value={editIssue.notes} onChange={e=>setEditIssue(v=>({...v,notes:e.target.value}))} placeholder="Notes"/></div>:x.notes||'—'}</TableCell>
      <TableCell>{x.type==='ISSUE'?(editingIssueId===x.id?<div className="flex flex-col gap-1"><Button size="sm" disabled={saving} onClick={()=>void saveIssue(x.id)}>Save</Button><Button size="sm" variant="ghost" disabled={saving} onClick={()=>setEditingIssueId('')}>Cancel</Button></div>:<Button size="sm" variant="outline" disabled={saving} onClick={()=>beginEditIssue(x)}>Edit all</Button>):'—'}</TableCell>
    </TableRow>)}{!transactions.length&&<TableRow><TableCell colSpan={8} className="py-8 text-center text-muted-foreground">No transactions yet</TableCell></TableRow>}</TableBody></Table></div>}
    </CardContent></Card>
  </div>
}
