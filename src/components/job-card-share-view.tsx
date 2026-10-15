'use client'
import { LocalizedText } from '@/components/localized-text'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, Printer } from 'lucide-react'
import { renderJobCardDocument } from '@/lib/job-card-document'
import { downloadJobCardPdf } from '@/lib/job-card-pdf'

export default function JobCardShareView() {
  const params = useParams<{ id: string }>()
  const id = String(params.id || '')
  const previewRef = useRef<HTMLIFrameElement>(null)
  const [documentHtml, setDocumentHtml] = useState('')
  const [jobNumber, setJobNumber] = useState('Job card')
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const token = new URLSearchParams(window.location.search).get('token') || ''
        if (!token) throw new Error('This job-card link is missing its access token')
        const response = await fetch(`/api/public/job-cards/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`, { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load this job card')
        const shareUrl = window.location.href
        const html = await renderJobCardDocument(data.jobCard, data.company, shareUrl, window.location.origin)
        if (cancelled) return
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800"><LocalizedText>Saadfreeh Transport</LocalizedText></p>
          <h1 className="text-lg font-semibold">{jobNumber}</h1>
        </div>
        {documentHtml && <div className="flex gap-2">
          <button type="button" onClick={print} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><Printer className="h-4 w-4"/>Print</button>
          <button type="button" onClick={downloadPdf} disabled={downloading} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4"/>{downloading ? 'Preparing PDF…' : 'Download PDF'}</button>
        </div>}
      </div>
      {error ? <div role="alert" className="mx-4 mt-6 rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700 sm:mx-auto sm:max-w-2xl">{error}</div> : loading ? <div className="px-4 py-16 text-center text-sm text-slate-600"><LocalizedText>Loading job card…</LocalizedText></div> : <div className="mx-auto max-w-6xl px-2 pb-6 sm:px-6"><iframe ref={previewRef} title={`${jobNumber} PDF preview`} srcDoc={documentHtml} className="h-[calc(100dvh-88px)] min-h-[640px] w-full rounded-lg border border-slate-300 bg-white shadow-lg"/></div>}
    </main>
  )
}
