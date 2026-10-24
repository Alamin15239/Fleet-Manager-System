'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react'

type Result = {
  success?: boolean
  status?: string
  message?: string
  error?: string
  organization?: { name: string; slug: string; ownerEmail: string }
}

export default function PayPalPurchaseSuccess({ purchaseId, orderId }: { purchaseId: string; orderId: string }) {
  const [result, setResult] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)

  async function capturePayment() {
    if (!purchaseId || !orderId) {
      setResult({ error: 'PayPal did not return a valid order and purchase reference. Return to the purchase page and contact support if you were charged.' })
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/billing/paypal/orders/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseId, orderId })
      })
      const payload = await response.json().catch(() => ({}))
      setResult(payload)
    } catch {
      setResult({ error: 'Could not reach the server to confirm payment. Retry this page.' })
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { void capturePayment() }, [purchaseId, orderId])

  const complete = result?.status === 'COMPLETE'
  const paidButNeedsSetup = result?.status === 'PAID_SETUP_FAILED'

  return <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 text-slate-900">
    <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
      <div className={`mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl ${complete ? 'bg-emerald-100 text-emerald-700' : paidButNeedsSetup || result?.error ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
        {complete ? <CheckCircle2 className="h-7 w-7" /> : paidButNeedsSetup || result?.error ? <ShieldAlert className="h-7 w-7" /> : <Loader2 className="h-7 w-7 animate-spin" />}
      </div>
      <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-blue-700">Fleet Manager · PayPal sandbox</p>
      <h1 className="mt-2 text-center text-2xl font-bold tracking-tight">{complete ? 'Workspace ready' : paidButNeedsSetup ? 'Payment received' : 'Confirming your payment'}</h1>
      <p className="mt-3 text-center text-sm leading-6 text-slate-600">{result?.message || result?.error || 'PayPal is confirming the order. The organization database will be created after payment is verified.'}</p>

      {result?.organization && <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p><span className="font-semibold">Workspace:</span> {result.organization.name} ({result.organization.slug})</p>
        <p className="mt-1"><span className="font-semibold">Administrator:</span> {result.organization.ownerEmail}</p>
      </div>}

      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {complete && result?.organization ? <Link href={`/login?org=${encodeURIComponent(result.organization.slug)}`} className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">Go to workspace sign in</Link> : <button type="button" onClick={() => void capturePayment()} disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Checking…</> : <><RefreshCw className="h-4 w-4" />{paidButNeedsSetup ? 'Retry workspace setup' : 'Check payment again'}</>}</button>}
        <Link href="/" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Return to Fleet Manager</Link>
      </div>
      <p className="mt-6 text-center text-xs leading-5 text-slate-500">If PayPal shows a completed payment but setup keeps failing, contact the Fleet Manager administrator with your order details. Do not send your PayPal secret.</p>
    </section>
  </main>
}