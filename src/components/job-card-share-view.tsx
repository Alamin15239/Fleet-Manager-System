'use client'
import { LocalizedText } from '@/components/localized-text'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, ExternalLink, Loader2, Printer } from 'lucide-react'
import { renderJobCardDocument } from '@/lib/job-card-document'
import { createJobCardPdfBlob, downloadJobCardPdf } from '@/lib/job-card-pdf'

export default function JobCardShareView() {
  const params = useParams<{ id: string }>()
  const id = String(params?.id || '')
  const previewRef = useRef<HTMLIFrameElement>(null)
  const [documentHtml, setDocumentHtml] = useState('')
  const [companyName, setCompanyName] = useState('Saadfreeh Transport')
  const [jobNumber, setJobNumber] = useState('Job card')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const [pdfUrl, setPdfUrl] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const search = new URLSearchParams(window.location.search)
        const token = search.get('token') || ''
        const organizationSlug = search.get('org')
        if (!token) throw new Error('This job-card link is missing its access token')
        const orgParam = organizationSlug ? `&org=${encodeURIComponent(organizationSlug)}` : ''
        const response = await fetch(`/api/public/job-cards/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}${orgParam}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load this job card')
        const shareUrl = window.location.href
        const html = await renderJobCardDocument(data.jobCard, data.company, shareUrl, window.location.origin)
        if (cancelled) return
        setCompanyName(data.company?.companyName || 'Saadfreeh Transport')
        setJobNumber(data.jobCard.jobNumber || 'Job card')
        setDocumentHtml(html)
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load this job card')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (id) void load()
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    let cancelled = false
    let objectUrl = ''
    setPdfUrl('')
    if (!documentHtml) { setPdfLoading(false); return }
    setPdfLoading(true)
    void createJobCardPdfBlob(documentHtml).then(blob => {
      if (cancelled) return
      objectUrl = URL.createObjectURL(blob)
      setPdfUrl(objectUrl)
    }).catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to prepare the job-card PDF')
    }).finally(() => { if (!cancelled) setPdfLoading(false) })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [documentHtml])

  const downloadPdf = async () => {
    if (!documentHtml) return
    setDownloading(true)
    try {
      await downloadJobCardPdf(documentHtml, `${jobNumber.replace(/[^a-z0-9-_]/gi, '_')}.pdf`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to download the job-card PDF')
    } finally {
      setDownloading(false)
    }
  }

  const print = () => {
    const windowToPrint = previewRef.current?.contentWindow
    if (!windowToPrint) return
    windowToPrint.focus()
    windowToPrint.print()
  }

  return (
    <main className="min-h-dvh bg-slate-100 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">{companyName}</p>
          <h1 className="text-lg font-semibold">{jobNumber}</h1>
        </div>
        {pdfUrl && <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => window.open(pdfUrl, '_blank', 'noopener,noreferrer')} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><ExternalLink className="h-4 w-4"/><LocalizedText>Open PDF in browser</LocalizedText></button>
          <button type="button" onClick={print} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><Printer className="h-4 w-4"/>Print</button>
          <button type="button" onClick={downloadPdf} disabled={downloading} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4"/>{downloading ? 'Preparing PDF…' : 'Download PDF'}</button>
        </div>}
      </div>
      {error ? <div role="alert" className="mx-4 mt-6 rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700 sm:mx-auto sm:max-w-2xl">{error}</div> : loading || pdfLoading ? <div className="flex items-center justify-center gap-2 px-4 py-16 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin"/><LocalizedText>Preparing job-card PDF…</LocalizedText></div> : pdfUrl ? <div className="mx-auto max-w-6xl px-2 pb-6 sm:px-6"><iframe ref={previewRef} title={`${jobNumber} PDF`} src={pdfUrl} className="h-[calc(100dvh-88px)] min-h-[640px] w-full rounded-lg border border-slate-300 bg-white shadow-lg"/></div> : null}
    </main>
  )
}
