'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, CheckCircle2, LoaderCircle } from 'lucide-react'

type CheckoutStatus = { status?: string; organization?: { name: string; slug: string }; error?: string }

export default function PurchaseSuccessPage() {
  const [sessionId, setSessionId] = useState('')
  const [status, setStatus] = useState<CheckoutStatus>({ status: 'PENDING' })

  useEffect(() => {
    setSessionId(new URLSearchParams(window.location.search).get('session_id') || '')
  }, [])

  useEffect(() => {
    if (!sessionId) {
      if (typeof window !== 'undefined' && window.location.search) setStatus({ status: 'INVALID' })
      return
    }
    let active = true
    let timeout: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      try {
        const response = await fetch(`/api/billing/organizations/checkout/status?session_id=${encodeURIComponent(sessionId)}`, { cache: 'no-store' })
        const result = await response.json().catch(() => ({})) as CheckoutStatus
        if (!response.ok) throw new Error(result.error || 'Could not verify checkout.')
        if (!active) return
        setStatus(result)
        if (result.status !== 'READY' && result.status !== 'PROVISIONING_FAILED') timeout = setTimeout(poll, 2500)
      } catch (error) {
        if (!active) return
        setStatus({ status: 'CHECK_FAILED', error: error instanceof Error ? error.message : 'Could not verify checkout.' })
      }
    }
    void poll()
    return () => { active = false; if (timeout) clearTimeout(timeout) }
  }, [sessionId])

  const ready = status.status === 'READY'
  const failed = status.status === 'PROVISIONING_FAILED' || status.status === 'CHECKOUT_FAILED'
  const paymentFailed = status.status === 'CHECKOUT_FAILED'
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-indigo-50/60 px-4 py-12">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5 sm:p-10">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${ready ? 'bg-emerald-50 text-emerald-600' : failed ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-600'}`}>
          {ready ? <CheckCircle2 className="h-7 w-7" /> : failed ? <Building2 className="h-7 w-7" /> : <LoaderCircle className="h-7 w-7 animate-spin" />}
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">{ready ? 'Your workspace is ready' : failed ? 'Payment received; setup needs attention' : 'Confirming your subscription'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {ready && status.organization ? `${status.organization.name} has its own database. Use workspace code “${status.organization.slug}” when signing in.` : paymentFailed ? 'Stripe could not complete the payment. You can return to checkout and try again with the same workspace code.' : failed ? 'Stripe confirmed payment, but automatic database setup did not finish. Contact support with your workspace code so setup can be retried.' : 'Stripe is confirming the payment and Fleet Manager is preparing the isolated organization database. Keep this page open for a moment.'}
        </p>
        {status.error && <p role="alert" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{status.error}</p>}
        {ready && <Link href={`/login?org=${encodeURIComponent(status.organization?.slug || '')}`} className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-700">Continue to workspace sign in</Link>}
        {paymentFailed && <Link href="/purchase" className="mt-6 inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 font-medium hover:bg-slate-50">Return to checkout</Link>}
        {failed && !paymentFailed && <Link href="/help" className="mt-6 inline-flex w-full items-center justify-center rounded-xl border px-4 py-3 font-medium hover:bg-slate-50">Get help</Link>}
        {!ready && !failed && <p className="mt-6 text-xs text-slate-500">Workspace creation starts only after Stripe verifies payment.</p>}
      </section>
    </main>
  )
}
