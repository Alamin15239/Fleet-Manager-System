'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, ExternalLink, Loader2, Printer } from 'lucide-react'
import { LocalizedText } from '@/components/localized-text'
import { usePurchaseInvoicePdfUrl } from '@/hooks/use-purchase-invoice-pdf-url'
import { buildPurchaseInvoiceReportEntries, renderPurchaseInvoiceReportDocument, type PurchaseInvoiceReportCompany } from '@/lib/purchase-invoice-report'
import { createPurchaseInvoiceReportQrDataUrl } from '@/lib/purchase-invoice-report-qr'

interface SharedReportData {
  company: PurchaseInvoiceReportCompany | null
  invoices: Array<{ invoice: any; lines: any[]; payable: number }>
  assets: Array<{ key: string; label: string }>
  filters: { assetKeys: string[]; dateFrom: string; dateTo: string; status: 'POSTED' | 'VOID' | 'ALL' }
}

function formatFilterDate(value: string) {
  if (!value) return ''
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' })
}

export default function SharedPurchaseInvoiceReportPage() {
  const params = useParams<{ token: string }>()
  const token = String(params?.token || '')
  const [report, setReport] = useState<SharedReportData | null>(null)
  const [documentHtml, setDocumentHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const { url: pdfUrl, loading: pdfLoading, error: pdfError } = usePurchaseInvoicePdfUrl(documentHtml)

  useEffect(() => {
    let cancelled = false
    async function loadReport() {
      try {
        const response = await fetch(`/api/public/purchase-invoice-reports/${encodeURIComponent(token)}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load this report')
        if (cancelled) return
        const typedData = data as SharedReportData
        setReport(typedData)
        const shareUrl = window.location.href
        const qrDataUrl = await createPurchaseInvoiceReportQrDataUrl(shareUrl)
        if (cancelled) return
        const entries = buildPurchaseInvoiceReportEntries(typedData.invoices, Object.fromEntries(typedData.assets.map((asset) => [asset.key, asset.label])))
        const postedInvoices = typedData.invoices.filter(({ invoice }) => invoice.status === 'POSTED')
        const totals = postedInvoices.reduce((sum, { lines }) => lines.reduce((current, line) => ({
          expense: current.expense + Number(line.netAmount || 0),
          vat: current.vat + Number(line.vatAmount || 0),
          payable: current.payable + Number(line.totalAmount || 0),
        }), sum), { expense: 0, vat: 0, payable: 0 })
        const filters = typedData.filters
        const period = `${filters.dateFrom ? formatFilterDate(filters.dateFrom) : 'All dates'} – ${filters.dateTo ? formatFilterDate(filters.dateTo) : 'Present'}`
        const statusLabel = filters.status === 'ALL' ? 'Posted and reversed' : filters.status === 'VOID' ? 'Reversed' : 'Posted'
        const generatedAt = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' })
        setDocumentHtml(renderPurchaseInvoiceReportDocument({
          company: typedData.company,
          entries,
          assets: typedData.assets.map((asset) => asset.label),
          period,
          statusLabel,
          invoiceCount: typedData.invoices.length,
          expenseTotal: totals.expense,
          vatTotal: totals.vat,
          payableTotal: totals.payable,
          generatedAt,
          shareUrl,
          qrDataUrl,
        }))
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load this report')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (token) void loadReport()
    return () => { cancelled = true }
  }, [token])

  const printPdf = () => {
    const viewer = document.querySelector<HTMLIFrameElement>('#shared-purchase-report-pdf')
    viewer?.contentWindow?.focus()
    viewer?.contentWindow?.print()
  }

  const download = () => {
    if (!pdfUrl) return
    setDownloading(true)
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = 'vehicle-purchase-invoice-report.pdf'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => setDownloading(false), 500)
  }

  return (
    <main className="min-h-dvh bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">{report?.company?.companyName || 'Fleet Manager'}</p><h1 className="text-lg font-semibold"><LocalizedText>Vehicle purchase invoice report</LocalizedText></h1><p className="text-xs text-slate-600"><LocalizedText>Live report link · latest matching records</LocalizedText></p></div>
        {pdfUrl && <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><ExternalLink className="h-4 w-4" /><LocalizedText>Open PDF in browser</LocalizedText></button>
          <button type="button" onClick={printPdf} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><Printer className="h-4 w-4" /><LocalizedText>Print</LocalizedText></button>
          <button type="button" onClick={download} disabled={downloading} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:opacity-60"><Download className="h-4 w-4" /><LocalizedText>Download PDF</LocalizedText></button>
        </div>}
      </div>
      {error ? <div role="alert" className="mx-4 mt-6 rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700 sm:mx-auto sm:max-w-2xl">{error}</div> : loading || pdfLoading ? <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" /><LocalizedText>Preparing report PDF…</LocalizedText></div> : pdfError ? <div role="alert" className="mx-4 mt-6 rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700 sm:mx-auto sm:max-w-2xl">{pdfError}</div> : pdfUrl ? <div className="mx-auto max-w-6xl px-2 pb-6 sm:px-6"><iframe id="shared-purchase-report-pdf" title="Vehicle purchase invoice report PDF" src={pdfUrl} className="h-[calc(100dvh-92px)] min-h-[640px] w-full rounded-lg border border-slate-300 bg-white shadow-lg" /></div> : null}
    </main>
  )
}
