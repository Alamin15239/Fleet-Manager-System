'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Building2, CheckCircle2, CircleAlert, LoaderCircle, RefreshCw } from 'lucide-react'

type PurchaseState = {
  ready: boolean
  organizationSlug?: string
  setup?: string
  payment?: string
  periodEnd?: string | null
  error?: string
}

export function PurchaseCompletionStatus() {
  const searchParams = useSearchParams()
  const organization = searchParams.get('org') || ''
  const [state, setState] = useState<PurchaseState | null>(null)
  const [loading, setLoading] = useState(false)

  const checkStatus = useCallback(async () => {
    if (!organization) {
      setState({ ready: false, error: 'The organization code was not included in the payment return link.' })
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`/api/billing/status?org=${encodeURIComponent(organization)}`, { cache: 'no-store' })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not check payment status.')
      setState(result)
    } catch (error) {
      setState({ ready: false, error: error instanceof Error ? error.message : 'Could not check payment status.' })
    } finally {
      setLoading(false)
    }
  }, [organization])

  useEffect(() => { void checkStatus() }, [checkStatus])

  const ready = Boolean(state?.ready)
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-blue-50 px-5 py-10 dark:from-slate-950 dark:to-slate-900">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-xl dark:border-white/10 dark:bg-slate-900 sm:p-10">
        <span className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${ready ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-400/10 dark:text-blue-300'}`}>
          {ready ? <CheckCircle2 className="h-7 w-7" /> : <Building2 className="h-7 w-7" />}
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-950 dark:text-white">{ready ? 'Your workspace is ready' : 'Confirming your annual plan'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {ready
            ? 'Payment is confirmed and the separate organization database has been provisioned. The first administrator can now sign in.'
            : state?.error || 'Tap will send payment confirmation to Fleet Manager. The workspace opens once payment and database setup are complete.'}
        </p>
        {state?.error && <div className="mt-5 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-xs leading-5 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{state.error}</div>}
        {state?.payment && !ready && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Payment state: {state.payment} · setup state: {state.setup}</p>}
        {ready && state?.organizationSlug ? (
          <Link href={`/login?org=${encodeURIComponent(state.organizationSlug)}`} className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800">Sign in to your workspace</Link>
        ) : (
          <button onClick={() => void checkStatus()} disabled={loading || !organization} className="mt-7 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/5">
            {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{loading ? 'Checking…' : 'Check payment status'}
          </button>
        )}
        <Link href="/pricing" className="mt-5 inline-block text-sm text-slate-500 underline underline-offset-4 dark:text-slate-400">Return to annual plan details</Link>
      </section>
    </main>
  )
}
