import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ error: 'Invalid document link.' }, { status: 404 })
  const document = await db.vehicleDocument.findUnique({
    where: { shareToken: token },
    select: { fileName: true, mimeType: true, fileData: true, shareExpiresAt: true },
  })
  if (!document || !document.fileData || !document.shareExpiresAt || document.shareExpiresAt <= new Date()) {
    return new NextResponse('This document link has expired or is no longer available.', { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } })
  }
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  const mimeType = document.mimeType && allowed.has(document.mimeType) ? document.mimeType : 'application/octet-stream'
  const bytes = new Uint8Array(document.fileData)
  return new NextResponse(bytes, { headers: {
    'Content-Type': mimeType,
    'Content-Length': String(bytes.byteLength),
    'Content-Disposition': 'inline; filename="' + (document.fileName || 'document').replace(/[\\r\\n"\\\\]/g, '_') + '"',
    'Cache-Control': 'private, no-store, max-age=0',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  } })
}
