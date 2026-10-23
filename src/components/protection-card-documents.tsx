'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, LoaderCircle, ShieldCheck, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DocumentFileInput } from '@/components/document-file-input'
import { Label } from '@/components/ui/label'
import { LocalizedText } from '@/components/localized-text'
import { toast } from '@/lib/localized-toast'
import { apiDelete, apiFetch, apiGet } from '@/lib/api'
import { PdfPreviewDialog } from '@/components/pdf-preview-dialog'

type SourceType = 'TRUCK' | 'TRAILER'
type ProtectionDocument = { id: string; title: string; fileName: string; fileSize: number; updatedAt: string }

export function ProtectionCardDocuments({
  sourceType,
  sourceId,
  canUpload,
  canDelete,
}: {
  sourceType: SourceType
  sourceId: string
  canUpload: boolean
  canDelete: boolean
}) {
  const [currentDocument, setCurrentDocument] = useState<ProtectionDocument | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  const loadDocument = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiGet(`/api/vehicle-documents?sourceType=${sourceType}&sourceId=${encodeURIComponent(sourceId)}`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Could not load the protection card.')
      setCurrentDocument(body.documents?.[0] || null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load the protection card.')
    } finally {
      setLoading(false)
    }
  }, [sourceId, sourceType])

  useEffect(() => { void loadDocument() }, [loadDocument])

  const upload = async () => {
    if (!file) return
    setBusy(true)
    try {
      const form = new FormData()
      form.set('sourceType', sourceType)
      form.set('sourceId', sourceId)
      form.set('documentType', 'Protection Card')
      form.set('title', 'Protection Card')
      form.set('file', file)
      const response = await apiFetch('/api/vehicle-documents', { method: 'POST', body: form })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Could not upload the protection card.')
      setFile(null)
      const input = document.getElementById(`protection-file-${sourceType}-${sourceId}`) as HTMLInputElement | null
      if (input) input.value = ''
      toast.success('Protection card saved. Uploading again replaces the previous file for this vehicle.')
      await loadDocument()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not upload the protection card.')
    } finally {
      setBusy(false)
    }
  }

  const openDocument = async () => {
    if (!currentDocument) return
    setPreviewUrl(null)
    setPreviewError(null)
    setPreviewLoading(true)
    setPreviewOpen(true)
    try {
      const response = await apiGet(`/api/vehicle-documents/${currentDocument.id}`)
      if (!response.ok) throw new Error('Could not open the protection card.')
      const blobUrl = URL.createObjectURL(await response.blob())
      setPreviewUrl(blobUrl)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open the protection card.'
      setPreviewError(message)
      toast.error(error instanceof Error ? error.message : 'Could not open the protection card.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const deleteDocument = async () => {
    if (!currentDocument || !window.confirm('Delete this protection card file?')) return
    setBusy(true)
    try {
      const response = await apiDelete(`/api/vehicle-documents/${currentDocument.id}`)
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Could not delete the protection card.')
      setCurrentDocument(null)
      toast.success('Protection card deleted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete the protection card.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="border-sky-500/20 bg-sky-500/[0.03]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-sky-600"/><LocalizedText>Protection card</LocalizedText></CardTitle>
        <CardDescription><LocalizedText>One private file is stored for this vehicle. It has no expiry tracking.</LocalizedText></CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin"/><LocalizedText>Loading document</LocalizedText></div> : currentDocument ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/70 p-3">
            <div className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-sky-600"/><div className="min-w-0"><p className="truncate text-sm font-medium">{currentDocument.fileName}</p><p className="text-xs text-muted-foreground">{(currentDocument.fileSize / 1024).toFixed(0)} KB · <LocalizedText>Last updated</LocalizedText> {new Date(currentDocument.updatedAt).toLocaleDateString()}</p></div></div>
            <div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => void openDocument()}><LocalizedText>View</LocalizedText></Button>{canDelete && <Button type="button" size="icon" variant="ghost" aria-label="Delete protection card" disabled={busy} onClick={() => void deleteDocument()}><Trash2 className="h-4 w-4 text-destructive"/></Button>}</div>
          </div>
        ) : <p className="text-sm text-muted-foreground"><LocalizedText>No protection card uploaded.</LocalizedText></p>}
        {canUpload && <div className="flex flex-col gap-2 sm:flex-row sm:items-end"><div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor={`protection-file-${sourceType}-${sourceId}`}><LocalizedText>Upload or replace file (optional)</LocalizedText></Label><DocumentFileInput id={`protection-file-${sourceType}-${sourceId}`} accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onFileSelected={setFile}/><p className="text-xs text-muted-foreground"><LocalizedText>PDF, JPG, PNG, or WEBP · maximum 4 MB · optional</LocalizedText></p></div><Button type="button" disabled={!file || busy} onClick={() => void upload()}><Upload className="me-2 h-4 w-4"/>{busy ? <LocalizedText>Saving…</LocalizedText> : <LocalizedText>Save protection card</LocalizedText>}</Button></div>}
      </CardContent>
      <PdfPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={currentDocument?.fileName || 'Protection card'}
        url={previewUrl}
        loading={previewLoading}
        error={previewError}
        downloadName={currentDocument?.fileName || 'protection-card'}
        downloadLabel="Download file"
      />
    </Card>
  )
}
