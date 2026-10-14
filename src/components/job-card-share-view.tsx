'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Download, Printer } from 'lucide-react'
import { renderJobCardDocument } from '@/lib/job-card-document'

type ShareData = { jobCard: any; company: any }

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
    let frame: HTMLIFrameElement | null = null
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
      frame = document.createElement('iframe')
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:744px;height:1080px;border:0;background:#fff'
      document.body.appendChild(frame)
      const frameDocument = frame.contentDocument
      if (!frameDocument) throw new Error('Unable to prepare the PDF document')
      frameDocument.open()
      frameDocument.write(documentHtml)
      frameDocument.close()
      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Timed out loading the job card for PDF')), 10000)
        frame!.onload = () => { window.clearTimeout(timer); resolve() }
      })
      const logo = frameDocument.querySelector<HTMLImageElement>('.logo-wrap img')
      if (logo && !logo.complete) await new Promise<void>((resolve, reject) => {
        logo.onload = () => resolve()
        logo.onerror = () => reject(new Error('Unable to load the company logo for PDF'))
      })
      const page = frameDocument.querySelector<HTMLElement>('.print-page')
      if (!page) throw new Error('Unable to render the job card')
      const renderWidth = 744
      const renderHeight = 1080
      page.style.zoom = '1'
      page.style.width = `${renderWidth}px`
      page.style.maxWidth = `${renderWidth}px`
      page.style.margin = '0 auto'
      frameDocument.documentElement.style.width = `${renderWidth}px`
      frameDocument.body.style.width = `${renderWidth}px`
      frameDocument.body.style.minHeight = `${renderHeight}px`
      page.style.height = 'auto'
      const contentHeight = page.scrollHeight
      page.style.zoom = String(Math.min(1, renderHeight / contentHeight))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      const canvas = await html2canvas(page, { scale: 2, backgroundColor: '#ffffff', useCORS: true, windowWidth: renderWidth, windowHeight: Math.max(renderHeight, page.scrollHeight) })
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
      const pageWidth = 210
      const pageHeight = 297
      const pageMargin = 5
      const scaleToFit = Math.min((pageWidth - pageMargin * 2) / canvas.width, (pageHeight - pageMargin * 2) / canvas.height)
      const imageWidth = canvas.width * scaleToFit
      const imageHeight = canvas.height * scaleToFit
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pageWidth - imageWidth) / 2, (pageHeight - imageHeight) / 2, imageWidth, imageHeight)
      pdf.save(`${jobNumber.replace(/[^a-z0-9-_]/gi, '_')}.pdf`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to download the job-card PDF')
    } finally {
      frame?.remove()
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
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-800">Saadfreeh Transport</p>
          <h1 className="text-lg font-semibold">{jobNumber}</h1>
        </div>
        {documentHtml && <div className="flex gap-2">
          <button type="button" onClick={print} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium shadow-sm hover:bg-slate-50"><Printer className="h-4 w-4"/>Print</button>
          <button type="button" onClick={downloadPdf} disabled={downloading} className="inline-flex min-h-10 items-center gap-2 rounded-md bg-emerald-800 px-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-900 disabled:cursor-wait disabled:opacity-60"><Download className="h-4 w-4"/>{downloading ? 'Preparing PDF…' : 'Download PDF'}</button>
        </div>}
      </div>
      {error ? <div role="alert" className="mx-4 mt-6 rounded-lg border border-red-200 bg-white p-5 text-sm text-red-700 sm:mx-auto sm:max-w-2xl">{error}</div> : loading ? <div className="px-4 py-16 text-center text-sm text-slate-600">Loading job card…</div> : <div className="mx-auto max-w-6xl px-2 pb-6 sm:px-6"><iframe ref={previewRef} title={`${jobNumber} PDF preview`} srcDoc={documentHtml} className="h-[calc(100dvh-88px)] min-h-[640px] w-full rounded-lg border border-slate-300 bg-white shadow-lg"/></div>}
    </main>
  )
}
