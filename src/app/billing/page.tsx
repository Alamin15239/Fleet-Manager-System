'use client'

import { useEffect, useState } from 'react'
import { CreditCard, ExternalLink, LoaderCircle, RefreshCw } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { apiGet, apiPost } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Billing = {
  status: string | null
  currency: string | null
  amountMinor: number | null
  currentPeriodEnd: string | null
  cancelAtPeriodEnd: boolean
  portalAvailable: boolean
}

export default function BillingPage() {
  const { user, isLoading: authLoading } = useAuth()
  const [billing, setBilling] = useState<Billing | null>(null)
  const [loading, setLoading] = useState(true)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  const refresh = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await apiGet('/api/billing/portal')
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not load subscription details.')
      setBilling(data.billing)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load subscription details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (!authLoading && user?.role === 'ADMIN' && !user.isPrimaryOrganization) void refresh() }, [authLoading, user])

  const openPortal = async () => {
    setOpening(true)
    setError('')
    try {
      const response = await apiPost('/api/billing/portal', {})
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not open subscription management.')
      const url = new URL(data.url)
      if (url.protocol !== 'https:' || !['billing.stripe.com', 'checkout.stripe.com'].includes(url.hostname)) throw new Error('Stripe returned an invalid billing URL.')
      window.location.assign(url.toString())
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not open subscription management.')
      setOpening(false)
    }
  }

  const formattedAmount = billing?.amountMinor !== null && billing?.amountMinor !== undefined && billing.currency
    ? new Intl.NumberFormat(undefined, { style: 'currency', currency: billing.currency }).format(
      billing.amountMinor / (10 ** new Intl.NumberFormat(undefined, { style: 'currency', currency: billing.currency }).resolvedOptions().maximumFractionDigits)
    )
    : null

  if (!authLoading && (user?.role !== 'ADMIN' || user.isPrimaryOrganization)) {
    return <div className="container mx-auto max-w-3xl p-4 sm:p-6"><Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Subscription management is available to administrators of purchased workspaces.</CardContent></Card></div>
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600"><CreditCard className="h-5 w-5" /></span>
        <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Subscription & billing</h1><p className="mt-1 text-sm text-muted-foreground">Manage your organization’s annual Fleet Manager plan.</p></div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div><CardTitle>Annual organization plan</CardTitle><CardDescription className="mt-1">Billing records are synchronized from Stripe webhooks.</CardDescription></div>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? <div className="flex justify-center py-8"><LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" /></div> : !billing ? <p className="text-sm text-muted-foreground">No subscription details are available.</p> : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 p-4">
                <div><p className="text-sm text-muted-foreground">Workspace</p><p className="font-medium">{user?.organizationName || 'Your organization'}</p></div>
                <Badge variant={billing.status === 'ACTIVE' ? 'default' : 'secondary'}>{billing.status || 'Unknown'}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="text-sm text-muted-foreground">Plan price</p><p className="mt-1 font-semibold">{formattedAmount ? `${formattedAmount} / year` : 'See Stripe billing portal'}</p></div>
                <div><p className="text-sm text-muted-foreground">Next renewal</p><p className="mt-1 font-semibold">{billing.currentPeriodEnd ? new Date(billing.currentPeriodEnd).toLocaleDateString() : 'Not available'}</p></div>
              </div>
              {billing.cancelAtPeriodEnd && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Cancellation is scheduled for the end of this billing period.</p>}
              {user?.role === 'ADMIN' && billing.portalAvailable && <Button onClick={() => void openPortal()} disabled={opening}>{opening ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <ExternalLink className="me-2 h-4 w-4" />}{['CANCELED', 'INCOMPLETE_EXPIRED'].includes(billing.status || '') ? 'Start a new annual subscription' : 'Manage payment method or renewal'}</Button>}
              <p className="text-xs text-muted-foreground">Stripe’s secure portal handles payment methods and renewal cancellation. Canceled workspaces can start a new annual checkout from here.</p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
