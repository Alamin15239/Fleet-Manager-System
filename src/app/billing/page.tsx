'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight, Building2, CalendarDays, CreditCard, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Payment = {
  id: string
  kind: string
  amountMinor: number
  currency: string
  status: string
  periodStart: string | null
  periodEnd: string | null
  createdAt: string
  failureReason: string | null
}

type BillingState = {
  organization: { name: string; slug: string; isPrimary: boolean }
  billing: null | {
    provider: string
    status: string
    amountMinor: number
    currency: string
    periodStart: string | null
    periodEnd: string | null
    cancelAtPeriodEnd: boolean
    renewalConfigured: boolean
    cardBrand: string | null
    cardLast4: string | null
    payments: Payment[]
  }
  canManage: boolean
}

const dateLabel = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(value))
  : '—'

const moneyLabel = (amountMinor: number, currency: string) => new Intl.NumberFormat('en', {
  style: 'currency', currency, maximumFractionDigits: 2
}).format(amountMinor / 100)

export default function BillingPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [state, setState] = useState<BillingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiGet('/api/billing/subscription')
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not load billing details.')
      setState(data)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load billing details.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (!authLoading) void load() }, [authLoading, load])

  const changeRenewal = async (action: 'cancel' | 'resume') => {
    const label = action === 'cancel' ? 'cancel automatic renewal' : 'resume automatic renewal'
    if (!window.confirm(`Are you sure you want to ${label}?`)) return
    setSaving(true)
    setError('')
    setMessage('')
    try {
      const response = await apiPost('/api/billing/subscription/cancel', { action })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not update renewal settings.')
      setMessage(action === 'cancel' ? 'Automatic renewal is canceled. Workspace access continues through the paid period.' : 'Automatic renewal is active again.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update renewal settings.')
    } finally {
      setSaving(false)
    }
  }

  const subscription = state?.billing
  const statusStyle = useMemo(() => {
    const status = subscription?.status?.toUpperCase()
    if (status === 'ACTIVE') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200'
    if (status === 'CANCEL_AT_PERIOD_END') return 'bg-amber-100 text-amber-900 dark:bg-amber-400/10 dark:text-amber-100'
    if (status === 'PAST_DUE') return 'bg-red-100 text-red-800 dark:bg-red-400/10 dark:text-red-200'
    return 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200'
  }, [subscription?.status])

  if (authLoading || loading) return <main className="mx-auto flex min-h-[50vh] max-w-5xl items-center justify-center px-5"><LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" /></main>

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Workspace administration</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Billing & subscription</h1>
          <p className="mt-2 text-sm text-muted-foreground">Manage the annual plan for {state?.organization.name || user?.organizationName || 'your organization'}.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="rounded-xl">
          <RefreshCw className="me-2 h-4 w-4" /> Refresh
        </Button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-400/20 dark:bg-red-400/10 dark:text-red-200">{error}</div>}
      {message && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">{message}</div>}

      {!subscription ? (
        <Card className="rounded-2xl border-border/70 shadow-sm">
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-300"><Building2 className="h-5 w-5" /></div>
            <CardTitle>No paid plan found</CardTitle>
            <CardDescription>This workspace does not have an annual paid subscription.</CardDescription>
          </CardHeader>
          <CardContent><Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 underline underline-offset-4 dark:text-blue-300">View the annual plan <ArrowUpRight className="h-4 w-4" /></Link></CardContent>
        </Card>
      ) : (
        <>
          <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <Card className="overflow-hidden rounded-2xl border-border/70 shadow-sm">
              <div className="h-1.5 bg-gradient-to-r from-blue-700 via-cyan-500 to-emerald-400" />
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-700 dark:text-blue-300" /> Organization plan</CardTitle>
                    <CardDescription className="mt-1">{state?.organization.name} · /{state?.organization.slug}</CardDescription>
                  </div>
                  <Badge className={`border-0 ${statusStyle}`}>{subscription.status?.replaceAll('_', ' ') || 'Unknown'}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight">{moneyLabel(subscription.amountMinor, subscription.currency)}</span>
                  <span className="pb-1 text-sm text-muted-foreground">per year</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border bg-muted/25 p-4"><p className="text-xs text-muted-foreground">Current period started</p><p className="mt-1 font-semibold">{dateLabel(subscription.periodStart)}</p></div>
                  <div className="rounded-xl border bg-muted/25 p-4"><p className="text-xs text-muted-foreground">Access through</p><p className="mt-1 font-semibold">{dateLabel(subscription.periodEnd)}</p></div>
                </div>
                {subscription.cardBrand && <p className="flex items-center gap-2 text-sm text-muted-foreground"><CreditCard className="h-4 w-4" /> Saved payment method: {subscription.cardBrand}{subscription.cardLast4 ? ` ending in ${subscription.cardLast4}` : ''}</p>}
                {subscription.cancelAtPeriodEnd ? (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-300/20 dark:bg-amber-400/10 dark:text-amber-100">Automatic renewal is canceled. Your workspace remains available through {dateLabel(subscription.periodEnd)}.</div>
                ) : (
                  <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm leading-6 text-blue-950 dark:border-blue-300/10 dark:bg-blue-400/5 dark:text-blue-100">Your plan renews once per year. You can cancel the next renewal here; workspace access remains active until the paid-through date.</div>
                )}
                {!subscription.renewalConfigured && <p className="text-sm text-amber-700 dark:text-amber-300">The payment provider has not linked a recurring subscription yet. Contact support before relying on renewal.</p>}
                {state?.canManage && subscription.periodEnd && ['ACTIVE', 'PAST_DUE', 'CANCEL_AT_PERIOD_END'].includes(subscription.status) && (
                  <Button variant={subscription.cancelAtPeriodEnd ? 'default' : 'outline'} onClick={() => void changeRenewal(subscription.cancelAtPeriodEnd ? 'resume' : 'cancel')} disabled={saving} className="rounded-xl">
                    {saving ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <CalendarDays className="me-2 h-4 w-4" />}
                    {subscription.cancelAtPeriodEnd ? 'Resume annual renewal' : 'Cancel next renewal'}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Payment security</CardTitle>
                  <CardDescription>Card checkout is handled by {subscription.provider === 'PADDLE' ? 'Paddle' : 'Tap Payments'}.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
                <p>Fleet Manager stores payment and subscription references for renewal. It does not store full card numbers or security codes.</p>
                <p>Questions about a charge or changing your card? <a className="font-medium text-blue-700 underline underline-offset-4 dark:text-blue-300" href="mailto:alaminkhan.xiaomi@gmail.com">Contact support</a>.</p>
              </CardContent>
            </Card>
          </section>

          <Card className="rounded-2xl border-border/70 shadow-sm">
            <CardHeader><CardTitle>Payment history</CardTitle><CardDescription>Recent annual plan charges and renewal attempts.</CardDescription></CardHeader>
            <CardContent>
              {!subscription.payments.length ? <p className="py-5 text-sm text-muted-foreground">No payment records yet.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[620px] text-left text-sm">
                    <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-3 pe-4 font-medium">Date</th><th className="py-3 pe-4 font-medium">Type</th><th className="py-3 pe-4 font-medium">Amount</th><th className="py-3 pe-4 font-medium">Status</th><th className="py-3 font-medium">Period</th></tr></thead>
                    <tbody>{subscription.payments.map((payment) => <tr key={payment.id} className="border-b last:border-0"><td className="py-3 pe-4">{dateLabel(payment.createdAt)}</td><td className="py-3 pe-4">Annual {payment.kind.toLowerCase()}</td><td className="py-3 pe-4 font-medium">{moneyLabel(payment.amountMinor, payment.currency)}</td><td className="py-3 pe-4">{payment.status.replaceAll('_', ' ')}</td><td className="py-3">{payment.periodStart ? `${dateLabel(payment.periodStart)} – ${dateLabel(payment.periodEnd)}` : payment.failureReason || '—'}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  )
}
