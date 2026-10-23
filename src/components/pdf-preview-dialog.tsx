'use client'

import { useRef } from 'react'
import { Download, LoaderCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LocalizedText } from '@/components/localized-text'

type PdfPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  url: string | null
  loading?: boolean
  error?: string | null
  downloadName?: string
  downloadLabel?: string
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  title,
  url,
  loading = false,
  error = null,
  downloadName,
  downloadLabel = 'Download PDF',
}: PdfPreviewDialogProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  const download = () => {
    if (!url || !downloadName) return
    const link = document.createElement('a')
    link.href = url
    link.download = downloadName
    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[95dvh] max-h-[95dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-hidden p-3 sm:w-[96vw] sm:max-w-[96vw] sm:p-5"
      >
        <DialogHeader className="flex shrink-0 flex-col items-stretch justify-between gap-3 text-start sm:flex-row sm:items-center">
          <DialogTitle className="truncate">{title}</DialogTitle>
          <div className="flex shrink-0 items-center gap-2">
            {url && <Button type="button" size="sm" variant="outline" onClick={() => frameRef.current?.contentWindow?.print()}><Printer className="me-2 h-4 w-4" /><LocalizedText>Print</LocalizedText></Button>}
            {url && downloadName && <Button type="button" size="sm" variant="outline" onClick={download}><Download className="me-2 h-4 w-4" /><LocalizedText>{downloadLabel}</LocalizedText></Button>}
            <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}><LocalizedText>Close</LocalizedText></Button>
          </div>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-slate-200/70 dark:bg-slate-900">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" /><LocalizedText>Preparing PDF preview…</LocalizedText></div>
          ) : error ? (
            <div role="alert" className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">{error}</div>
          ) : url ? (
            <iframe ref={frameRef} title={`${title} preview`} src={url} className="h-full w-full bg-white" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><LocalizedText>No PDF is ready to preview.</LocalizedText></div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
