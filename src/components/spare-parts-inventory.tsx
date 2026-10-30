'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '@/lib/api'
import { toast } from '@/lib/localized-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Boxes, Plus, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Search, RefreshCw } from 'lucide-react'

type Item = { id:string; name:string; partNumber?:string|null; category:string; unit:string; oilGrade?:string|null; reorderLevel:number; stockQty:number }
type Tx = { id:string; itemId:string; itemName:string; type:string; quantity:number; unit:string; transactionDate:string; reference?:string|null; vehicleType?:string|null; vehicleId?:string|null; jobCardId?:string|null; notes?:string|null }
const labels:Record<string,string> = { OPENING:'Opening stock', PURCHASE:'Purchase / stock in', ISSUE:'Issue to vehicle', CUSTOMER_RETURN:'Return to store', SUPPLIER_RETURN:'Return to supplier', ADJUSTMENT_IN:'Stock adjustment (+)', ADJUSTMENT_OUT:'Stock adjustment (-)' }

export function SparePartsInventory() {
  const [items,setItems]=useState<Item[]>([])
  const [transactions,setTransactions]=useState<Tx[]>([])
  const [loading,setLoading]=useState(true)
  const [search,setSearch]=useState('')
  const [tab,setTab]=useState<'stock'|'history'>('stock')
  const [itemForm,setItemForm]=useState({name:'',partNumber:'',category:'GENERAL',unit:'pcs',oilGrade:'',reorderLevel:'0'})
  const [txForm,setTxForm]=useState({itemId:'',type:'PURCHASE',quantity:'',transactionDate:new Date().toISOString().slice(0,10),reference:'',vehicleType:'truck',vehicleId:'',jobCardId:'',unitCost:'',notes:''})
  const [saving,setSaving]=useState(false)
  const load=useCallback(async()=>{setLoading(true);try{const r=await apiGet('/api/inventory');const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to load stock');setItems(d.items||[]);setTransactions(d.transactions||[])}catch(e){toast.error(e instanceof Error?e.message:'Unable to load stock')}finally{setLoading(false)}},[])
  useEffect(()=>{void load()},[load])
  const filtered=useMemo(()=>items.filter(x=>[x.name,x.partNumber,x.category,x.oilGrade].join(' ').toLowerCase().includes(search.toLowerCase())),[items,search])
  const low=items.filter(x=>x.stockQty<=x.reorderLevel)
  async function createItem(e:React.FormEvent){e.preventDefault();setSaving(true);try{const r=await apiPost('/api/inventory',{action:'createItem',...itemForm,reorderLevel:Number(itemForm.reorderLevel)});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to add item');setItemForm({name:'',partNumber:'',category:'GENERAL',unit:'pcs',oilGrade:'',reorderLevel:'0'});toast.success('Part added');await load()}catch(e){toast.error(e instanceof Error?e.message:'Unable to add part')}finally{setSaving(false)}}
  async function saveTransaction(e:React.FormEvent){e.preventDefault();setSaving(true);try{const r=await apiPost('/api/inventory',{...txForm,quantity:Number(txForm.quantity),unitCost:txForm.unitCost?Number(txForm.unitCost):null});const d=await r.json();if(!r.ok)throw new Error(d.error||'Unable to save transaction');setTxForm(v=>({...v,quantity:'',reference:'',vehicleId:'',jobCardId:'',unitCost:'',notes:''}));toast.success('Stock transaction recorded');await load()}catch(e){toast.error(e instanceof Error?e.message:'Unable to save transaction')}finally{setSaving(false)}}
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Part types</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{items.length}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Low / reorder stock</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{low.length}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Transactions recorded</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{transactions.length}</CardContent></Card>
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5"/>Add a part / consumable</CardTitle></CardHeader><CardContent><form onSubmit={createItem} className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>Part name *</Label><Input required value={itemForm.name} onChange={e=>setItemForm(v=>({...v,name:e.target.value}))} placeholder="e.g. Engine oil, air filter"/></div>
        <div className="space-y-1"><Label>Part number (optional)</Label><Input value={itemForm.partNumber} onChange={e=>setItemForm(v=>({...v,partNumber:e.target.value}))}/></div>
        <div className="space-y-1"><Label>Category</Label><Select value={itemForm.category} onValueChange={category=>setItemForm(v=>({...v,category}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['GENERAL','ENGINE_OIL','DIESEL_FILTER','AIR_FILTER','AIR_DRYER_FILTER','WATER_SEPARATOR_FILTER','FUEL_FILTER','OTHER'].map(x=><SelectItem key={x} value={x}>{x.replaceAll('_',' ')}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Unit</Label><Select value={itemForm.unit} onValueChange={unit=>setItemForm(v=>({...v,unit}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{['pcs','litre','kg','set','box'].map(x=><SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Oil grade (if applicable)</Label><Input value={itemForm.oilGrade} onChange={e=>setItemForm(v=>({...v,oilGrade:e.target.value}))} placeholder="e.g. 15W-40"/></div>
        <div className="space-y-1"><Label>Reorder level</Label><Input type="number" min="0" step="0.01" value={itemForm.reorderLevel} onChange={e=>setItemForm(v=>({...v,reorderLevel:e.target.value}))}/></div>
        <div className="sm:col-span-2"><Button disabled={saving}><Plus className="mr-2 h-4 w-4"/>Add part</Button></div>
      </form></CardContent></Card>
      <Card><CardHeader><CardTitle>Record stock movement</CardTitle></CardHeader><CardContent><form onSubmit={saveTransaction} className="space-y-3">
        <div className="space-y-1"><Label>Part *</Label><Select value={txForm.itemId} onValueChange={itemId=>setTxForm(v=>({...v,itemId}))}><SelectTrigger><SelectValue placeholder="Choose a part"/></SelectTrigger><SelectContent>{items.map(x=><SelectItem key={x.id} value={x.id}>{x.name}{x.oilGrade?' · '+x.oilGrade:''} ({x.stockQty} {x.unit})</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>Transaction *</Label><Select value={txForm.type} onValueChange={type=>setTxForm(v=>({...v,type}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(labels).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label>Quantity *</Label><Input required type="number" min="0.01" step="0.01" value={txForm.quantity} onChange={e=>setTxForm(v=>({...v,quantity:e.target.value}))}/></div><div className="space-y-1"><Label>Date *</Label><Input required type="date" value={txForm.transactionDate} onChange={e=>setTxForm(v=>({...v,transactionDate:e.target.value}))}/></div></div>
        {txForm.type==='ISSUE'&&<><div className="space-y-1"><Label>Vehicle type</Label><Select value={txForm.vehicleType} onValueChange={vehicleType=>setTxForm(v=>({...v,vehicleType}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="truck">Truck</SelectItem><SelectItem value="trailer">Trailer</SelectItem></SelectContent></Select></div><div className="space-y-1"><Label>Vehicle ID</Label><Input value={txForm.vehicleId} onChange={e=>setTxForm(v=>({...v,vehicleId:e.target.value}))} placeholder="Vehicle record ID"/></div></>}
        <div className="space-y-1"><Label>Reference / job card number</Label><Input value={txForm.reference} onChange={e=>setTxForm(v=>({...v,reference:e.target.value}))}/></div>
        <div className="space-y-1"><Label>Notes</Label><Input value={txForm.notes} onChange={e=>setTxForm(v=>({...v,notes:e.target.value}))}/></div>
        <Button disabled={saving||!txForm.itemId} className="w-full"><ArrowDownToLine className="mr-2 h-4 w-4"/>Record movement</Button>
      </form></CardContent></Card>
    </div>
    <Card><CardHeader className="flex flex-row items-center justify-between space-y-0"><CardTitle>Inventory</CardTitle><Button variant="outline" size="sm" onClick={()=>void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></CardHeader><CardContent className="space-y-3">
      <div className="flex flex-wrap gap-2"><Button variant={tab==='stock'?'default':'outline'} onClick={()=>setTab('stock')}>Current stock</Button><Button variant={tab==='history'?'default':'outline'} onClick={()=>setTab('history')}>Transaction history</Button><div className="relative min-w-48 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="pl-9" placeholder="Search parts or transactions" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>
      {loading?<p className="py-8 text-center text-sm text-muted-foreground">Loading inventory…</p>:tab==='stock'?<div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Part</TableHead><TableHead>Part no.</TableHead><TableHead>Category / grade</TableHead><TableHead>In stock</TableHead><TableHead>Reorder at</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{filtered.map(x=><TableRow key={x.id}><TableCell className="font-medium">{x.name}</TableCell><TableCell>{x.partNumber||'—'}</TableCell><TableCell>{x.category.replaceAll('_',' ')} {x.oilGrade||''}</TableCell><TableCell>{x.stockQty} {x.unit}</TableCell><TableCell>{x.reorderLevel} {x.unit}</TableCell><TableCell>{x.stockQty<=x.reorderLevel?<span className="font-semibold text-amber-600">Reorder</span>:<span className="text-emerald-600">In stock</span>}</TableCell></TableRow>)}{!filtered.length&&<TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No parts found</TableCell></TableRow>}</TableBody></Table></div>:<div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Part</TableHead><TableHead>Transaction</TableHead><TableHead>Quantity</TableHead><TableHead>Reference</TableHead><TableHead>Vehicle</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader><TableBody>{transactions.filter(x=>[x.itemName,x.type,x.reference,x.notes].join(' ').toLowerCase().includes(search.toLowerCase())).map(x=><TableRow key={x.id}><TableCell>{new Date(x.transactionDate).toLocaleDateString()}</TableCell><TableCell>{x.itemName}</TableCell><TableCell>{labels[x.type]||x.type}</TableCell><TableCell>{x.quantity} {x.unit}</TableCell><TableCell>{x.reference||x.jobCardId||'—'}</TableCell><TableCell>{x.vehicleType?x.vehicleType+' · '+x.vehicleId:'—'}</TableCell><TableCell>{x.notes||'—'}</TableCell></TableRow>)}{!transactions.length&&<TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No transactions yet</TableCell></TableRow>}</TableBody></Table></div>}
    </CardContent></Card>
  </div>
}
