'use client'

import { useEffect, useState } from 'react'
import { createPurchaseInvoicePdfBlob, type PurchaseInvoicePdfOptions } from '@/lib/purchase-invoice-pdf'

export function usePurchaseInvoicePdfUrl(html: string, options: PurchaseInvoicePdfOptions = {}) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const orientation = options.orientation || 'portrait'
  const pageSelector = options.pageSelector || '.print-page'
  const pageWidthPx = options.pageWidthPx || 794
  const pageHeightPx = options.pageHeightPx || 1123

  useEffect(() => {
    let cancelled = false
    let nextUrl = ''
    setUrl('')
    setError('')
    if (!html) {
      setLoading(false)
      return
    }
    setLoading(true)
    void createPurchaseInvoicePdfBlob(html, { orientation, pageSelector, pageWidthPx, pageHeightPx })
      .then((blob) => {
        if (cancelled) return
        nextUrl = URL.createObjectURL(blob)
        setUrl(nextUrl)
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to prepare PDF preview')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => {
      cancelled = true
      if (nextUrl) URL.revokeObjectURL(nextUrl)
    }
  }, [html, orientation, pageSelector, pageWidthPx, pageHeightPx])

  return { url, loading, error }
}
