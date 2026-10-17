'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { LocalizedText } from '@/components/localized-text'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { usePermissions } from '@/contexts/permissions-context'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { toast } from '@/lib/localized-toast'
import { Activity, BadgeCheck, BookOpen, Building2, Calculator, CarFront, Copy, Download, ExternalLink, FilePlus2, FileText, Filter, Loader2, Plus, Printer, Receipt, Search, ShieldCheck, Truck, Undo2, X } from 'lucide-react'
import { renderPurchaseInvoiceDocument, type PurchaseInvoiceCompany, type PurchaseInvoiceDocumentData } from '@/lib/purchase-invoice-document'
import { downloadPurchaseInvoicePdf } from '@/lib/purchase-invoice-pdf'

type Category = 'MAINTENANCE' | 'SPARE_PARTS' | 'TIRE' | 'BATTERY' | 'OIL_FILTER' | 'OTHER'
type AssetType = 'TRUCK' | 'TRAILER'
type Tab = 'invoices' | 'vehicle-accounts' | 'vendor-accounts' | 'vat'

interface Vendor {
  id: string
  name: string
  vatRegistration?: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  isActive: boolean
}

interface TruckOption {
  id: string
  licensePlate: string
  make: string
  model: string
  year: number
}

interface TrailerOption { id: string; number: string }

interface DraftLine {
  key: string
  category: Category
  description: string
  quantity: string
  unitPrice: string
  assetType: AssetType
  assetId: string
}

interface InvoiceLine {
  id: string
  lineNumber: number
  category: Category
  description: string
  quantity: number
  unitPrice: number
  netAmount: number
  vatAmount: number
  totalAmount: number
  truck?: TruckOption | null
  trailer?: TrailerOption | null
}

interface PurchaseInvoice {
  id: string
  internalNumber: string
  vendorInvoiceNumber?: string | null
  invoiceDate: string
  dueDate?: string | null
  isVatInvoice: boolean
  pricesIncludeVat: boolean
  vatRate: number
  subtotal: number
  vatTotal: number
  grandTotal: number
  status: 'POSTED' | 'VOID'
  notes?: string | null
  vendor: Vendor
  lines: InvoiceLine[]
}

interface AccountRow {
  id: string | null
  assetType?: AssetType
  assetId?: string
  vendorId?: string
  label: string
  code: string
  balance: number
  active?: boolean
}

interface LedgerLine {
  id: string
  date: string
  invoiceId: string
  invoiceNumber: string
  vendor: string
  vendorInvoiceNumber?: string | null
  category?: Category | null
  description: string
  debit: number
  credit: number
}

const blankLine = (): DraftLine => ({
  key: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  category: 'MAINTENANCE',
  description: '',
  quantity: '1',
  unitPrice: '',
  assetType: 'TRUCK',
  assetId: '',
})

const categoryLabels: Record<Category, string> = {
  MAINTENANCE: 'Maintenance',
  SPARE_PARTS: 'Spare parts',
  TIRE: 'Tire',
  BATTERY: 'Battery',
  OIL_FILTER: 'Oil & filter',
  OTHER: 'Other expense',
}

const emptySummary = { invoiceCount: 0, subtotal: 0, vatTotal: 0, payableTotal: 0 }

function moneyCents(amount: number) { return Math.round((amount + Number.EPSILON) * 100) }

export default function PurchaseInvoicesPage() {
  const { canAccess, canCreate, canUpdate, loading: permissionsLoading } = usePermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dataError, setDataError] = useState('')
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [trucks, setTrucks] = useState<TruckOption[]>([])
  const [trailers, setTrailers] = useState<TrailerOption[]>([])
  const [vehicleAccounts, setVehicleAccounts] = useState<AccountRow[]>([])
  const [vendorAccounts, setVendorAccounts] = useState<AccountRow[]>([])
  const [inputVatBalance, setInputVatBalance] = useState(0)
  const [summary, setSummary] = useState(emptySummary)
  const [tab, setTab] = useState<Tab>('invoices')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false)
  const [vendorDialogOpen, setVendorDialogOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null)
  const [invoiceDocumentHtml, setInvoiceDocumentHtml] = useState('')
  const [invoiceShareUrl, setInvoiceShareUrl] = useState('')
  const invoicePreviewRef = useRef<HTMLIFrameElement>(null)
  const [ledgerSelection, setLedgerSelection] = useState<{ type: 'TRUCK' | 'TRAILER' | 'VENDOR' | 'VAT'; id: string; label: string; code: string; balance: number } | null>(null)
  const [ledgerLines, setLedgerLines] = useState<LedgerLine[]>([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [activeAssetLine, setActiveAssetLine] = useState<string | null>(null)
  const [vendorSearch, setVendorSearch] = useState('')
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false)
  const [assetSearch, setAssetSearch] = useState<Record<string, string>>({})
  const [vendorForm, setVendorForm] = useState({ name: '', vatRegistration: '', phone: '', email: '', address: '' })
  const [invoiceForm, setInvoiceForm] = useState({
    vendorId: '', vendorInvoiceNumber: '', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '',
    isVatInvoice: true, pricesIncludeVat: false, vatRate: '15', notes: '', lines: [blankLine()],
  })
  const canRead = canAccess('purchase-invoices')
  const canWrite = canCreate('purchase-invoices')
  const canReverse = canUpdate('purchase-invoices')

  const loadData = async () => {
    setDataError('')
    try {
      const response = await apiGet('/api/purchase-invoices')
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not load purchase accounts')
      setInvoices(payload.invoices || [])
      setVendors(payload.vendors || [])
      setTrucks(payload.trucks || [])
      setTrailers(payload.trailers || [])
      setVehicleAccounts(payload.vehicleAccounts || [])
      setVendorAccounts(payload.vendorAccounts || [])
      setInputVatBalance(payload.inputVatBalance || 0)
      setSummary(payload.summary || emptySummary)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load invoices'
      setDataError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  useEffect(() => {
    if (!selectedInvoice) {
      setInvoiceDocumentHtml('')
      setInvoiceShareUrl('')
      return
    }
    let cancelled = false
    const prepareInvoicePreview = async () => {
      setInvoiceDocumentHtml('')
      try {
        const response = await apiGet(`/api/purchase-invoices/${encodeURIComponent(selectedInvoice.id)}/share-link`)
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Unable to prepare invoice preview')
        const qrDataUrl = await QRCode.toDataURL(payload.shareUrl, { errorCorrectionLevel: 'H', margin: 1, width: 512 })
        if (cancelled) return
        setInvoiceShareUrl(payload.shareUrl)
        setInvoiceDocumentHtml(renderPurchaseInvoiceDocument(selectedInvoice as PurchaseInvoiceDocumentData, payload.company as PurchaseInvoiceCompany | null, payload.shareUrl, qrDataUrl))
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Unable to prepare invoice preview')
      }
    }
    void prepareInvoicePreview()
    return () => { cancelled = true }
  }, [selectedInvoice])

  useEffect(() => {
    if (!ledgerSelection) {
      setLedgerLines([])
      return
    }
    let cancelled = false
    const loadLedger = async () => {
      setLedgerLoading(true)
      try {
        const response = await apiGet(`/api/purchase-invoices/ledger?type=${ledgerSelection.type}&id=${encodeURIComponent(ledgerSelection.id)}`)
        const payload = await response.json()
        if (!response.ok) throw new Error(payload.error || 'Could not load account activity')
        if (!cancelled) setLedgerLines(payload.lines || [])
      } catch (error) {
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Could not load account activity')
      } finally {
        if (!cancelled) setLedgerLoading(false)
      }
    }
    void loadLedger()
    return () => { cancelled = true }
  }, [ledgerSelection])

  const assetOptions = useMemo(() => [
    ...trucks.map((truck) => ({ type: 'TRUCK' as const, id: truck.id, label: `${truck.licensePlate} · ${truck.make} ${truck.model} (${truck.year})` })),
    ...trailers.map((trailer) => ({ type: 'TRAILER' as const, id: trailer.id, label: `Trailer ${trailer.number}` })),
  ], [trucks, trailers])

  const lineTotals = (line: DraftLine) => {
    const quantity = Number(line.quantity) || 0
    const unitPrice = Number(line.unitPrice) || 0
    const enteredCents = moneyCents(quantity * unitPrice)
    const rate = invoiceForm.isVatInvoice ? Number(invoiceForm.vatRate) || 0 : 0
    const net = invoiceForm.isVatInvoice && invoiceForm.pricesIncludeVat ? Math.round(enteredCents / (1 + rate / 100)) : enteredCents
    const vat = !invoiceForm.isVatInvoice ? 0 : invoiceForm.pricesIncludeVat ? enteredCents - net : Math.round(net * rate / 100)
    return { net: net / 100, vat: vat / 100, total: (net + vat) / 100 }
  }

  const draftTotals = useMemo(() => invoiceForm.lines.reduce((totals, line) => {
    const amounts = lineTotals(line)
    return { net: totals.net + amounts.net, vat: totals.vat + amounts.vat, total: totals.total + amounts.total }
  }, { net: 0, vat: 0, total: 0 }), [invoiceForm.lines, invoiceForm.isVatInvoice, invoiceForm.pricesIncludeVat, invoiceForm.vatRate])

  const filteredInvoices = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return []
    return invoices.filter((invoice) => {
      const matchesStatus = statusFilter === 'ALL' || invoice.status === statusFilter
      const matchesSearch = [invoice.internalNumber, invoice.vendorInvoiceNumber, invoice.vendor.name,
        ...invoice.lines.flatMap((line) => [line.description, line.truck?.licensePlate, line.trailer?.number])]
        .filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))
      return matchesStatus && matchesSearch
    })
  }, [invoices, search, statusFilter])

  const filteredVehicleAccounts = useMemo(() => vehicleAccounts.filter((account) => account.label.toLowerCase().includes(search.toLowerCase())), [vehicleAccounts, search])
  const filteredVendorAccounts = useMemo(() => vendorAccounts.filter((account) => account.label.toLowerCase().includes(search.toLowerCase())), [vendorAccounts, search])

  const patchLine = (key: string, values: Partial<DraftLine>) => setInvoiceForm((current) => ({
    ...current,
    lines: current.lines.map((line) => line.key === key ? { ...line, ...values } : line),
  }))

  const submitVendor = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await apiPost('/api/purchase-invoices/vendors', vendorForm)
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not create vendor')
      toast.success('Vendor account created')
      setVendorForm({ name: '', vatRegistration: '', phone: '', email: '', address: '' })
      setVendorDialogOpen(false)
      await loadData()
      setInvoiceForm((current) => ({ ...current, vendorId: payload.vendor.id }))
      setVendorSearch(payload.vendor.name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create vendor')
    } finally {
      setSaving(false)
    }
  }

  const submitInvoice = async (event: FormEvent) => {
    event.preventDefault()
    if (!invoiceForm.vendorId) return toast.error('Select a vendor before posting')
    if (invoiceForm.lines.some((line) => !line.assetId)) return toast.error('Assign every invoice line to a truck or trailer')
    setSaving(true)
    try {
      const response = await apiPost('/api/purchase-invoices', {
        ...invoiceForm,
        vatRate: Number(invoiceForm.vatRate) || 0,
        lines: invoiceForm.lines.map(({ key, ...line }) => line),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not post purchase invoice')
      toast.success(`Invoice ${payload.invoice.internalNumber} posted to the vehicle, VAT, and vendor accounts`)
      setInvoiceDialogOpen(false)
      setSearch('')
      setInvoiceForm({ vendorId: '', vendorInvoiceNumber: '', invoiceDate: new Date().toISOString().slice(0, 10), dueDate: '', isVatInvoice: true, pricesIncludeVat: false, vatRate: '15', notes: '', lines: [blankLine()] })
      setVendorSearch('')
      setAssetSearch({})
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not post purchase invoice')
    } finally {
      setSaving(false)
    }
  }

  const reverseInvoice = async (invoice: PurchaseInvoice) => {
    if (!window.confirm(`Reverse ${invoice.internalNumber}? The app will create a matching opposite journal entry and retain the invoice for audit.`)) return
    setSaving(true)
    try {
      const response = await apiPatch('/api/purchase-invoices', { action: 'void', invoiceId: invoice.id })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Could not reverse invoice')
      toast.success('Invoice reversed; its journal history was retained')
      setSelectedInvoice(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not reverse invoice')
    } finally {
      setSaving(false)
    }
  }

  const openAccount = (account: AccountRow, type: 'TRUCK' | 'TRAILER' | 'VENDOR') => {
    const id = type === 'VENDOR' ? account.vendorId : account.assetId
    if (!id) return
    setLedgerSelection({ type, id, label: account.label, code: account.code, balance: account.balance })
  }

  const downloadSelectedInvoice = async () => {
    if (!selectedInvoice || !invoiceDocumentHtml) return
    setSaving(true)
    try {
      await downloadPurchaseInvoicePdf(invoiceDocumentHtml, `${selectedInvoice.internalNumber}.pdf`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to download invoice PDF')
    } finally {
      setSaving(false)
    }
  }

  const printSelectedInvoice = () => {
    const printWindow = invoicePreviewRef.current?.contentWindow
    if (!printWindow || !invoiceDocumentHtml) return
    printWindow.focus()
    printWindow.print()
  }

  const copyInvoiceShareLink = async () => {
    if (!invoiceShareUrl) return
    try {
      await navigator.clipboard.writeText(invoiceShareUrl)
      toast.success('Public invoice link copied')
    } catch {
      window.prompt('Copy this invoice link', invoiceShareUrl)
    }
  }

  const tabButton = (key: Tab, label: string, Icon: typeof FileText) => (
    <button key={key} onClick={() => { setTab(key); setSearch(''); setLedgerSelection(null) }} className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition ${tab === key ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
      <Icon className="h-4 w-4" /><LocalizedText>{label}</LocalizedText>
    </button>
  )

  if (permissionsLoading || loading) return <div className="flex min-h-[55vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
  if (!canRead) return <div className="container mx-auto p-6"><Card><CardContent className="py-12 text-center"><ShieldCheck className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-semibold"><LocalizedText>You do not have access to purchase invoices</LocalizedText></p></CardContent></Card></div>

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary"><Receipt className="h-4 w-4" /><LocalizedText>Fleet accounts</LocalizedText></div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl"><LocalizedText>Purchase invoices</LocalizedText></h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground"><LocalizedText>Post maintenance, spare parts, tires, batteries, and oil invoices directly to each truck or trailer, with separate input VAT and vendor balances.</LocalizedText></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setVendorDialogOpen(true)} disabled={!canWrite}><Building2 className="me-2 h-4 w-4" /><LocalizedText>Add vendor</LocalizedText></Button>
          <Button onClick={() => setInvoiceDialogOpen(true)} disabled={!canWrite}><FilePlus2 className="me-2 h-4 w-4" /><LocalizedText>New invoice</LocalizedText></Button>
        </div>
      </header>

      {dataError && <Card className="border-destructive/40"><CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-destructive">{dataError}</p><Button variant="outline" size="sm" onClick={() => { setLoading(true); void loadData() }}><LocalizedText>Try again</LocalizedText></Button></CardContent></Card>}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={FileText} label="Posted invoices" value={summary.invoiceCount.toLocaleString()} foot="All posted purchase invoices" tone="blue" />
        <MetricCard icon={Calculator} label="Vehicle expenses" value={formatCurrency(summary.subtotal)} foot="Before input VAT" tone="violet" />
        <MetricCard icon={ShieldCheck} label="Input VAT" value={formatCurrency(summary.vatTotal)} foot="Recorded separately for VAT invoices" tone="amber" />
        <MetricCard icon={Building2} label="Vendor payables" value={formatCurrency(summary.payableTotal)} foot="Posted invoice total · before payments" tone="emerald" />
      </section>

      <Card className="overflow-hidden">
        <CardHeader className="gap-4 border-b border-border/60 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><CardTitle className="text-lg"><LocalizedText>Accounts & invoices</LocalizedText></CardTitle><p className="mt-1 text-sm text-muted-foreground"><LocalizedText>Every posted invoice is balanced and traceable to its vehicle and vendor.</LocalizedText></p></div>
            <div className="relative w-full lg:max-w-sm"><Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoices, vendors, or vehicles" className="ps-9" /></div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabButton('invoices', 'Invoices', FileText)}
            {tabButton('vehicle-accounts', 'Truck & trailer accounts', Truck)}
            {tabButton('vendor-accounts', 'Vendor accounts', Building2)}
            {tabButton('vat', 'Input VAT', ShieldCheck)}
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6">
          {tab === 'invoices' && <>
            <div className="mb-4 flex items-center gap-2"><Filter className="h-4 w-4 text-muted-foreground" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-9 rounded-lg border border-input bg-background px-3 text-sm"><option value="ALL">All statuses</option><option value="POSTED">Posted</option><option value="VOID">Reversed</option></select><span className="ms-auto text-xs text-muted-foreground">{filteredInvoices.length} <LocalizedText>shown · newest first</LocalizedText></span></div>
            {filteredInvoices.length === 0 ? <EmptyState title={search.trim() ? 'No matching invoices' : 'Search to view invoices'} description={search.trim() ? 'Try an invoice number, supplier, truck or trailer number.' : 'Invoices are kept out of the list until you search by invoice number, supplier, description, truck or trailer.'} icon={search.trim() ? Receipt : Search} /> : <div className="space-y-3">
              {filteredInvoices.map((invoice) => <button key={invoice.id} onClick={() => setSelectedInvoice(invoice)} className="grid w-full gap-3 rounded-2xl border border-border/70 p-4 text-start transition hover:border-primary/40 hover:bg-muted/30 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] md:items-center">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{invoice.internalNumber}</span><StatusBadge status={invoice.status} /></div><p className="mt-1 truncate text-sm text-muted-foreground">{invoice.vendor.name}{invoice.vendorInvoiceNumber ? ` · ${invoice.vendorInvoiceNumber}` : ''}</p></div>
                <div className="text-sm"><p>{formatDate(invoice.invoiceDate)}</p><p className="mt-1 text-xs text-muted-foreground">{invoice.lines.length} <LocalizedText>lines</LocalizedText> · {invoice.isVatInvoice ? `${invoice.vatRate}% VAT` : 'No VAT'}</p></div>
                <div className="text-sm"><p className="text-muted-foreground"><LocalizedText>Expense</LocalizedText> {formatCurrency(invoice.subtotal)}</p><p className="mt-1 text-muted-foreground"><LocalizedText>VAT</LocalizedText> {formatCurrency(invoice.vatTotal)}</p></div>
                <div className="text-end"><p className="font-semibold tabular-nums">{formatCurrency(invoice.grandTotal)}</p><p className="mt-1 text-xs text-muted-foreground"><LocalizedText>Vendor payable</LocalizedText></p></div>
              </button>)}
            </div>}
            {invoices.length >= 500 && <p className="mt-4 text-xs text-muted-foreground"><LocalizedText>Showing the most recent 500 invoices. Account balances include all posted and reversed entries.</LocalizedText></p>}
          </>}

          {tab === 'vehicle-accounts' && <>
            <p className="mb-4 text-sm text-muted-foreground"><LocalizedText>Each truck and trailer has an expense account. Select an asset to see its complete invoice history and assigned costs.</LocalizedText></p>
            {filteredVehicleAccounts.length === 0 ? <EmptyState title="No active fleet assets found" description="Add trucks or trailers first, then their dedicated expense accounts will be available here." icon={Truck} /> : <AccountGrid rows={filteredVehicleAccounts} onSelect={(account) => openAccount(account, account.assetType!)} />}
          </>}

          {tab === 'vendor-accounts' && <>
            <p className="mb-4 text-sm text-muted-foreground"><LocalizedText>Vendor accounts show posted invoice payables. Payments are not recorded in this invoice-entry workflow yet.</LocalizedText></p>
            {filteredVendorAccounts.length === 0 ? <EmptyState title="No vendors found" description="Add a vendor before creating a purchase invoice." icon={Building2} action={canWrite ? <Button variant="outline" onClick={() => setVendorDialogOpen(true)}><Plus className="me-2 h-4 w-4" /><LocalizedText>Add vendor</LocalizedText></Button> : undefined} /> : <AccountGrid rows={filteredVendorAccounts} onSelect={(account) => openAccount(account, 'VENDOR')} />}
          </>}

          {tab === 'vat' && <>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300"><ShieldCheck className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground"><LocalizedText>Input VAT balance · Tax Authority</LocalizedText></p><p className="mt-1 text-2xl font-bold tabular-nums">{formatCurrency(inputVatBalance)}</p></div></div><p className="mt-4 text-xs leading-5 text-muted-foreground"><LocalizedText>VAT from supplier invoices is posted to a separate input-VAT account. It is not included in the vehicle expense amount.</LocalizedText></p><Button className="mt-4" variant="outline" onClick={() => setLedgerSelection({ type: 'VAT', id: 'input-vat', label: 'Input VAT · Tax Authority', code: 'TAX-INPUT-VAT', balance: inputVatBalance })}><BookOpen className="me-2 h-4 w-4" /><LocalizedText>View VAT ledger</LocalizedText></Button></div>
              <div className="rounded-2xl border border-border/70 p-5"><h3 className="font-semibold"><LocalizedText>Invoice tax totals</LocalizedText></h3><dl className="mt-4 space-y-3 text-sm"><SummaryRow label="Posted invoices" value={summary.invoiceCount.toLocaleString()} /><SummaryRow label="Expense amount excluding VAT" value={formatCurrency(summary.subtotal)} /><SummaryRow label="Input VAT recorded" value={formatCurrency(summary.vatTotal)} /><SummaryRow label="Vendor invoice totals" value={formatCurrency(summary.payableTotal)} strong /></dl><p className="mt-4 text-xs leading-5 text-muted-foreground"><LocalizedText>Totals exclude reversed invoices. No-VAT invoices post zero input VAT.</LocalizedText></p></div>
            </div>
          </>}
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><p><LocalizedText>Posting records the vehicle expense as a debit, input VAT as a separate debit when applicable, and the full invoice total as a vendor payable credit. Posted invoices are locked; authorized users can reverse them with an audit-safe counter-entry.</LocalizedText></p></div>

      <Dialog open={invoiceDialogOpen} onOpenChange={setInvoiceDialogOpen}>
        <DialogContent className="max-h-[94dvh] max-w-5xl overflow-y-auto p-0">
          <form onSubmit={submitInvoice}>
            <DialogHeader className="sticky top-0 z-10 border-b bg-background/95 px-5 py-4 text-start backdrop-blur sm:px-7"><DialogTitle><LocalizedText>Enter purchase invoice</LocalizedText></DialogTitle><DialogDescription><LocalizedText>Choose the vendor, invoice tax treatment, and assign every cost line to its truck or trailer.</LocalizedText></DialogDescription></DialogHeader>
            <div className="space-y-6 px-5 py-5 sm:px-7">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2 xl:col-span-2"><Label><LocalizedText>Vendor</LocalizedText> *</Label><div className="flex gap-2"><div className="relative min-w-0 flex-1"><Input required value={vendorSearch || vendors.find((vendor) => vendor.id === invoiceForm.vendorId)?.name || ''} onFocus={() => setVendorPickerOpen(true)} onChange={(event) => { setVendorSearch(event.target.value); setVendorPickerOpen(true); setInvoiceForm((current) => ({ ...current, vendorId: '' })) }} placeholder="Search vendors" autoComplete="off" />{vendorPickerOpen && <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl">{vendors.filter((vendor) => vendor.isActive && (!vendorSearch || vendor.name.toLowerCase().includes(vendorSearch.toLowerCase()) || vendor.vatRegistration?.toLowerCase().includes(vendorSearch.toLowerCase()))).slice(0, 12).map((vendor) => <button key={vendor.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setInvoiceForm((current) => ({ ...current, vendorId: vendor.id })); setVendorSearch(vendor.name); setVendorPickerOpen(false) }} className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-accent">{vendor.name}{vendor.vatRegistration ? <span className="ms-2 text-xs text-muted-foreground">VAT {vendor.vatRegistration}</span> : null}</button>)}{vendors.filter((vendor) => vendor.isActive && (!vendorSearch || vendor.name.toLowerCase().includes(vendorSearch.toLowerCase()) || vendor.vatRegistration?.toLowerCase().includes(vendorSearch.toLowerCase()))).length === 0 && <p className="px-3 py-3 text-sm text-muted-foreground"><LocalizedText>No matching vendors</LocalizedText></p>}</div>}</div><Button type="button" variant="outline" size="icon" title="Add vendor" onClick={() => { setVendorPickerOpen(false); setVendorDialogOpen(true) }}><Plus className="h-4 w-4" /></Button></div>{vendors.filter((vendor) => vendor.isActive).length === 0 && <p className="text-xs text-amber-700"><LocalizedText>Add a vendor before posting your first invoice.</LocalizedText></p>}</div>
                <div className="space-y-2"><Label><LocalizedText>Vendor invoice no.</LocalizedText></Label><Input value={invoiceForm.vendorInvoiceNumber} onChange={(event) => setInvoiceForm((current) => ({ ...current, vendorInvoiceNumber: event.target.value }))} placeholder="Invoice number from supplier" /></div>
                <div className="space-y-2"><Label><LocalizedText>Invoice date</LocalizedText> *</Label><Input type="date" required value={invoiceForm.invoiceDate} onChange={(event) => setInvoiceForm((current) => ({ ...current, invoiceDate: event.target.value }))} /></div>
                <div className="space-y-2"><Label><LocalizedText>Due date</LocalizedText></Label><Input type="date" value={invoiceForm.dueDate} onChange={(event) => setInvoiceForm((current) => ({ ...current, dueDate: event.target.value }))} /></div>
              </section>

              <section className="rounded-2xl border border-border/70 p-4 sm:p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><h3 className="font-semibold"><LocalizedText>Tax treatment</LocalizedText></h3><p className="mt-1 text-xs text-muted-foreground"><LocalizedText>Select the type shown on the supplier invoice.</LocalizedText></p></div><div className="flex rounded-xl bg-muted p-1"><button type="button" onClick={() => setInvoiceForm((current) => ({ ...current, isVatInvoice: true }))} className={`rounded-lg px-4 py-2 text-sm font-semibold ${invoiceForm.isVatInvoice ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}><LocalizedText>VAT invoice</LocalizedText></button><button type="button" onClick={() => setInvoiceForm((current) => ({ ...current, isVatInvoice: false, pricesIncludeVat: false }))} className={`rounded-lg px-4 py-2 text-sm font-semibold ${!invoiceForm.isVatInvoice ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}><LocalizedText>No VAT</LocalizedText></button></div></div>
                {invoiceForm.isVatInvoice ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label><LocalizedText>VAT rate (%)</LocalizedText></Label><Input type="number" min="0" max="100" step="0.01" value={invoiceForm.vatRate} onChange={(event) => setInvoiceForm((current) => ({ ...current, vatRate: event.target.value }))} /><p className="text-xs text-muted-foreground"><LocalizedText>Saudi standard VAT default: 15%. Change only to match the invoice.</LocalizedText></p></div><div className="space-y-2"><Label><LocalizedText>Prices on invoice</LocalizedText></Label><select value={invoiceForm.pricesIncludeVat ? 'INCLUSIVE' : 'EXCLUSIVE'} onChange={(event) => setInvoiceForm((current) => ({ ...current, pricesIncludeVat: event.target.value === 'INCLUSIVE' }))} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="EXCLUSIVE">Before VAT · add VAT to unit price</option><option value="INCLUSIVE">VAT included · extract VAT from unit price</option></select></div></div> : <p className="mt-4 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground"><LocalizedText>No VAT will be added or posted to the input-VAT account for this invoice.</LocalizedText></p>}
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between"><div><h3 className="font-semibold"><LocalizedText>Expense lines</LocalizedText></h3><p className="mt-1 text-xs text-muted-foreground"><LocalizedText>Assign each line to exactly one truck or trailer account.</LocalizedText></p></div><Button type="button" variant="outline" size="sm" onClick={() => setInvoiceForm((current) => ({ ...current, lines: [...current.lines, blankLine()] }))}><Plus className="me-2 h-4 w-4" /><LocalizedText>Add line</LocalizedText></Button></div>
                {invoiceForm.lines.map((line, index) => {
                  const availableAssets = assetOptions.filter((asset) => asset.type === line.assetType)
                  const chosenAsset = availableAssets.find((asset) => asset.id === line.assetId)
                  const query = assetSearch[line.key] ?? chosenAsset?.label ?? ''
                  const matches = availableAssets.filter((asset) => !query || asset.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
                  const totals = lineTotals(line)
                  return <div key={line.key} className="rounded-2xl border border-border/70 bg-muted/[0.18] p-4">
                    <div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold"><LocalizedText>Line</LocalizedText> {index + 1}</p>{invoiceForm.lines.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setInvoiceForm((current) => ({ ...current, lines: current.lines.filter((row) => row.key !== line.key) }))}><X className="h-4 w-4" /></Button>}</div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-12">
                      <div className="space-y-2 xl:col-span-3"><Label><LocalizedText>Expense category</LocalizedText></Label><select value={line.category} onChange={(event) => patchLine(line.key, { category: event.target.value as Category })} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                      <div className="space-y-2 xl:col-span-3"><Label><LocalizedText>Asset type</LocalizedText></Label><select value={line.assetType} onChange={(event) => { patchLine(line.key, { assetType: event.target.value as AssetType, assetId: '' }); setAssetSearch((current) => ({ ...current, [line.key]: '' })) }} className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="TRUCK">Truck</option><option value="TRAILER">Trailer</option></select></div>
                      <div className="relative space-y-2 xl:col-span-6"><Label><LocalizedText>Search and select vehicle</LocalizedText> *</Label><Input value={query} onFocus={() => setActiveAssetLine(line.key)} onChange={(event) => { setActiveAssetLine(line.key); setAssetSearch((current) => ({ ...current, [line.key]: event.target.value })); patchLine(line.key, { assetId: '' }) }} placeholder={line.assetType === 'TRUCK' ? 'Search truck plate, make, or model' : 'Search trailer number'} autoComplete="off" />{activeAssetLine === line.key && <div className="absolute inset-x-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-xl border bg-popover p-1 shadow-xl">{matches.length ? matches.map((asset) => <button key={asset.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { patchLine(line.key, { assetType: asset.type, assetId: asset.id }); setAssetSearch((current) => ({ ...current, [line.key]: asset.label })); setActiveAssetLine(null) }} className="block w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-accent">{asset.label}</button>) : <p className="px-3 py-3 text-sm text-muted-foreground"><LocalizedText>No matching vehicles</LocalizedText></p>}</div>}{line.assetId && <p className="text-xs text-emerald-700 dark:text-emerald-400"><LocalizedText>Assigned to separate</LocalizedText> {line.assetType.toLowerCase()} <LocalizedText>expense account</LocalizedText></p>}</div>
                      <div className="space-y-2 sm:col-span-2 xl:col-span-5"><Label><LocalizedText>Description</LocalizedText></Label><Input required value={line.description} onChange={(event) => patchLine(line.key, { description: event.target.value })} placeholder="Describe the service or item" /></div>
                      <div className="space-y-2 xl:col-span-2"><Label><LocalizedText>Quantity</LocalizedText></Label><Input required min="0.001" step="0.001" type="number" value={line.quantity} onChange={(event) => patchLine(line.key, { quantity: event.target.value })} /></div>
                      <div className="space-y-2 xl:col-span-2"><Label><LocalizedText>Unit price</LocalizedText></Label><Input required min="0" step="0.0001" type="number" value={line.unitPrice} onChange={(event) => patchLine(line.key, { unitPrice: event.target.value })} /></div>
                      <div className="flex items-end justify-between rounded-lg bg-background px-3 py-2 text-xs sm:col-span-2 xl:col-span-3"><span className="text-muted-foreground"><LocalizedText>Expense</LocalizedText> {formatCurrency(totals.net)}<br /><LocalizedText>VAT</LocalizedText> {formatCurrency(totals.vat)}</span><span className="text-end font-semibold">{formatCurrency(totals.total)}<br /><span className="font-normal text-muted-foreground"><LocalizedText>Line total</LocalizedText></span></span></div>
                    </div>
                  </div>
                })}
              </section>

              <div className="grid gap-4 lg:grid-cols-[1fr_320px]"><div className="space-y-2"><Label><LocalizedText>Invoice notes</LocalizedText></Label><Textarea value={invoiceForm.notes} onChange={(event) => setInvoiceForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional notes for the accounting record" /></div><div className="rounded-2xl border bg-muted/30 p-4"><h3 className="font-semibold"><LocalizedText>Posting preview</LocalizedText></h3><dl className="mt-3 space-y-2 text-sm"><SummaryRow label="Vehicle expenses" value={formatCurrency(draftTotals.net)} /><SummaryRow label="Input VAT" value={formatCurrency(draftTotals.vat)} /><div className="border-t pt-2"><SummaryRow label="Vendor payable" value={formatCurrency(draftTotals.total)} strong /></div></dl><p className="mt-3 text-xs leading-5 text-muted-foreground"><LocalizedText>These entries balance before they are posted. VAT is separated only for a VAT invoice.</LocalizedText></p></div></div>
            </div>
            <DialogFooter className="sticky bottom-0 border-t bg-background/95 px-5 py-4 backdrop-blur sm:px-7"><Button type="button" variant="outline" onClick={() => setInvoiceDialogOpen(false)} disabled={saving}><LocalizedText>Cancel</LocalizedText></Button><Button type="submit" disabled={saving || !canWrite || !vendors.some((vendor) => vendor.id === invoiceForm.vendorId)}>{saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}<LocalizedText>Post invoice</LocalizedText></Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={vendorDialogOpen} onOpenChange={setVendorDialogOpen}>
        <DialogContent className="max-w-xl"><form onSubmit={submitVendor}><DialogHeader><DialogTitle><LocalizedText>Add vendor</LocalizedText></DialogTitle><DialogDescription><LocalizedText>Create a supplier account to use on purchase invoices.</LocalizedText></DialogDescription></DialogHeader><div className="grid gap-4 py-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label><LocalizedText>Vendor name</LocalizedText> *</Label><Input required value={vendorForm.name} onChange={(event) => setVendorForm((current) => ({ ...current, name: event.target.value }))} /></div><div className="space-y-2"><Label><LocalizedText>VAT registration number</LocalizedText></Label><Input value={vendorForm.vatRegistration} onChange={(event) => setVendorForm((current) => ({ ...current, vatRegistration: event.target.value }))} /></div><div className="space-y-2"><Label><LocalizedText>Phone</LocalizedText></Label><Input value={vendorForm.phone} onChange={(event) => setVendorForm((current) => ({ ...current, phone: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label><LocalizedText>Email</LocalizedText></Label><Input type="email" value={vendorForm.email} onChange={(event) => setVendorForm((current) => ({ ...current, email: event.target.value }))} /></div><div className="space-y-2 sm:col-span-2"><Label><LocalizedText>Address</LocalizedText></Label><Textarea value={vendorForm.address} onChange={(event) => setVendorForm((current) => ({ ...current, address: event.target.value }))} /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setVendorDialogOpen(false)} disabled={saving}><LocalizedText>Cancel</LocalizedText></Button><Button type="submit" disabled={saving || !canWrite}>{saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}<LocalizedText>Save vendor</LocalizedText></Button></DialogFooter></form></DialogContent>
      </Dialog>

      <Dialog open={!!selectedInvoice} onOpenChange={(open) => { if (!open) setSelectedInvoice(null) }}>
        <DialogContent className="flex max-h-[96dvh] max-w-5xl flex-col overflow-hidden p-4 sm:p-6"><DialogHeader className="shrink-0"><div className="flex items-center gap-2"><DialogTitle>{selectedInvoice?.internalNumber}</DialogTitle>{selectedInvoice && <StatusBadge status={selectedInvoice.status} />}</div><DialogDescription>{selectedInvoice?.vendor.name}{selectedInvoice?.vendorInvoiceNumber ? ` · ${selectedInvoice.vendorInvoiceNumber}` : ''}</DialogDescription></DialogHeader>
          <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-slate-100">{invoiceDocumentHtml ? <iframe ref={invoicePreviewRef} title={`${selectedInvoice?.internalNumber} invoice preview`} srcDoc={invoiceDocumentHtml} className="h-[min(70dvh,850px)] min-h-[480px] w-full bg-white" /> : <div className="flex h-[min(70dvh,850px)] min-h-[480px] items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><LocalizedText>Preparing invoice preview and QR code</LocalizedText></div>}</div>
          <DialogFooter className="shrink-0 flex-wrap gap-2 sm:justify-between">{selectedInvoice?.status === 'POSTED' && canReverse ? <Button variant="destructive" onClick={() => selectedInvoice && void reverseInvoice(selectedInvoice)} disabled={saving}><Undo2 className="me-2 h-4 w-4" /><LocalizedText>Reverse invoice</LocalizedText></Button> : <span />}{selectedInvoice?.status === 'VOID' && <p className="me-auto text-xs text-muted-foreground"><LocalizedText>This invoice is reversed; its original and counter-entry remain in the ledger.</LocalizedText></p>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void copyInvoiceShareLink()} disabled={!invoiceShareUrl}><Copy className="me-2 h-4 w-4" /><LocalizedText>Copy QR link</LocalizedText></Button>{invoiceShareUrl && <Button variant="outline" asChild><a href={invoiceShareUrl} target="_blank" rel="noreferrer"><ExternalLink className="me-2 h-4 w-4" /><LocalizedText>Open link</LocalizedText></a></Button>}<Button variant="outline" onClick={printSelectedInvoice} disabled={!invoiceDocumentHtml}><Printer className="me-2 h-4 w-4" /><LocalizedText>Print</LocalizedText></Button><Button onClick={() => void downloadSelectedInvoice()} disabled={!invoiceDocumentHtml || saving}><Download className="me-2 h-4 w-4" /><LocalizedText>Download PDF</LocalizedText></Button><Button variant="ghost" onClick={() => setSelectedInvoice(null)}><LocalizedText>Close</LocalizedText></Button></div></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!ledgerSelection} onOpenChange={(open) => { if (!open) setLedgerSelection(null) }}>
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle><LocalizedText>Account activity</LocalizedText></DialogTitle><DialogDescription>{ledgerSelection?.label} · {ledgerSelection?.code}</DialogDescription></DialogHeader><div className="flex items-center justify-between rounded-xl bg-muted/40 p-4"><span className="text-sm text-muted-foreground"><LocalizedText>Current posted balance</LocalizedText></span><strong className="text-lg tabular-nums">{formatCurrency(ledgerSelection?.type === 'VAT' ? inputVatBalance : ledgerSelection?.balance || 0)}</strong></div>{ledgerLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : ledgerLines.length === 0 ? <EmptyState title="No account activity yet" description="Posted invoices assigned to this account will appear here." icon={Activity} /> : <div className="overflow-x-auto rounded-xl border"><table className="w-full min-w-[700px] text-sm"><thead className="bg-muted/50 text-xs uppercase text-muted-foreground"><tr><th className="p-3 text-start"><LocalizedText>Date / invoice</LocalizedText></th><th className="p-3 text-start"><LocalizedText>Vendor</LocalizedText></th><th className="p-3 text-start"><LocalizedText>Description</LocalizedText></th><th className="p-3 text-end"><LocalizedText>Debit</LocalizedText></th><th className="p-3 text-end"><LocalizedText>Credit</LocalizedText></th></tr></thead><tbody>{ledgerLines.map((line) => <tr key={line.id} className="border-t"><td className="p-3">{formatDate(line.date)}<p className="text-xs text-muted-foreground">{line.invoiceNumber}{line.vendorInvoiceNumber ? ` · ${line.vendorInvoiceNumber}` : ''}</p></td><td className="p-3">{line.vendor}</td><td className="p-3">{line.description}{line.category && <p className="text-xs text-muted-foreground">{categoryLabels[line.category]}</p>}</td><td className="p-3 text-end tabular-nums">{formatCurrency(line.debit)}</td><td className="p-3 text-end tabular-nums">{formatCurrency(line.credit)}</td></tr>)}</tbody></table></div>}<DialogFooter><Button variant="outline" onClick={() => setLedgerSelection(null)}><LocalizedText>Close</LocalizedText></Button></DialogFooter></DialogContent>
      </Dialog>
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, foot, tone }: { icon: typeof FileText; label: string; value: string; foot: string; tone: 'blue' | 'violet' | 'amber' | 'emerald' }) {
  const tones = { blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', violet: 'bg-violet-500/10 text-violet-700 dark:text-violet-300', amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', emerald: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' }
  return <Card><CardContent className="flex items-center gap-4 p-5"><div className={`rounded-xl p-3 ${tones[tone]}`}><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="text-xs font-medium text-muted-foreground"><LocalizedText>{label}</LocalizedText></p><p className="mt-1 truncate text-xl font-bold tabular-nums">{value}</p><p className="mt-1 truncate text-xs text-muted-foreground"><LocalizedText>{foot}</LocalizedText></p></div></CardContent></Card>
}

function AccountGrid({ rows, onSelect }: { rows: AccountRow[]; onSelect: (row: AccountRow) => void }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{rows.map((account) => <button key={`${account.assetType || 'VENDOR'}-${account.assetId || account.vendorId}`} onClick={() => onSelect(account)} className="rounded-2xl border border-border/70 p-4 text-start transition hover:border-primary/40 hover:bg-muted/30"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-start gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary">{account.assetType === 'TRAILER' ? <CarFront className="h-4 w-4" /> : account.assetType === 'TRUCK' ? <Truck className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}</div><div className="min-w-0"><p className="truncate font-semibold">{account.label}</p><p className="mt-1 truncate text-xs text-muted-foreground">{account.code}</p></div></div><BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" /></div><div className="mt-4 flex items-end justify-between"><span className="text-xs text-muted-foreground"><LocalizedText>{account.assetType ? 'Lifetime expense total' : 'Amount payable to vendor'}</LocalizedText></span><span className="font-semibold tabular-nums">{formatCurrency(account.balance)}</span></div></button>)}</div>
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-4 ${strong ? 'font-semibold' : ''}`}><span className="text-muted-foreground"><LocalizedText>{label}</LocalizedText></span><span className="tabular-nums">{value}</span></div>
}

function StatusBadge({ status }: { status: 'POSTED' | 'VOID' }) {
  return status === 'POSTED' ? <Badge className="bg-emerald-600 hover:bg-emerald-600"><LocalizedText>Posted</LocalizedText></Badge> : <Badge variant="destructive"><LocalizedText>Reversed</LocalizedText></Badge>
}

function EmptyState({ title, description, icon: Icon, action }: { title: string; description: string; icon: typeof FileText; action?: React.ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-5 py-12 text-center"><div className="mb-3 rounded-2xl bg-muted p-3 text-muted-foreground"><Icon className="h-6 w-6" /></div><p className="font-semibold"><LocalizedText>{title}</LocalizedText></p><p className="mt-1 max-w-md text-sm text-muted-foreground"><LocalizedText>{description}</LocalizedText></p>{action && <div className="mt-4">{action}</div>}</div>
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
