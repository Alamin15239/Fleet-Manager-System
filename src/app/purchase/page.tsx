'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import { CheckCircle2, CreditCard, Loader2, ShieldCheck } from 'lucide-react'

type Period = 'MONTHLY' | 'YEARLY'
type Pricing = { currency: string; monthly: { amountMinor: number }; yearly: { amountMinor: number }; clientId?: string | null }
type CheckoutDetails = {
  mode: 'new' | 'renew'
  period: Period
  organizationName: string
  organizationSlug: string
  ownerName: string
  ownerEmail: string
  ownerPhone: string
}

type PayPalButtonInstance = {
  render: (container: HTMLElement) => Promise<void>
  close?: () => Promise<void>
}

type PayPalButtonsOptions = {
  createOrder: () => Promise<string>
  onApprove: (data: { orderID?: string }) => void | Promise<void>
  onCancel?: () => void
  onError?: (error: unknown) => void
  style?: { layout?: 'vertical' | 'horizontal'; shape?: 'rect' | 'pill'; label?: 'paypal' }
}

type PayPalSDK = { Buttons: (options: PayPalButtonsOptions) => PayPalButtonInstance }

declare global {
  interface Window {
    paypal?: PayPalSDK
  }
}

const fallbackPricing: Pricing = {
  currency: 'USD',
  monthly: { amountMinor: 2637 },
  yearly: { amountMinor: 26370 }
}

function money(amountMinor: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100)
}

export default function PurchasePage() {
  const [mode, setMode] = useState<'new' | 'renew'>('new')
  const [period, setPeriod] = useState<Period>('MONTHLY')
  const [pricing, setPricing] = useState(fallbackPricing)
  const [paypalClientId, setPaypalClientId] = useState('')
  const [paypalSdkReady, setPaypalSdkReady] = useState(false)
  const [checkoutDetails, setCheckoutDetails] = useState<CheckoutDetails | null>(null)
  const [organizationName, setOrganizationName] = useState('')
  const [organizationSlug, setOrganizationSlug] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [cancelled, setCancelled] = useState(false)
  const [paypalContainer, setPaypalContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setCancelled(params.get('cancelled') === '1')
    if (params.get('mode') === 'renew') {
      setMode('renew')
      setOrganizationSlug(params.get('org') || '')
    }
    fetch('/api/billing/paypal/orders', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return
        const data = await response.json()
        if (data?.currency && data?.monthly?.amountMinor && data?.yearly?.amountMinor) setPricing(data)
        if (typeof data?.clientId === 'string' && data.clientId) setPaypalClientId(data.clientId)
      })
      .catch(() => undefined)
  }, [])

  async function beginCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (!acceptedTerms) {
      setError('Please accept the User Agreement before continuing.')
      return
    }
    if (!paypalClientId) {
      setError('PayPal checkout is not configured yet. Ask the administrator to check the PayPal Sandbox Client ID in Vercel.')
      return
    }
    setCheckoutDetails({
      mode,
      period,
      organizationName,
      organizationSlug: organizationSlug.trim().toLowerCase(),
      ownerName,
      ownerEmail,
      ownerPhone
    })
  }

  useEffect(() => {
    if (!checkoutDetails || !paypalSdkReady || !paypalContainer || !window.paypal?.Buttons) return

    let active = true
    let buttons: PayPalButtonInstance | undefined
    const purchaseRef: { id?: string } = {}

    buttons = window.paypal.Buttons({
      style: { layout: 'vertical', shape: 'rect', label: 'paypal' },
      createOrder: async () => {
        setLoading(true)
        setError('')
        try {
          const response = await fetch('/api/billing/paypal/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(checkoutDetails)
          })
          const result = await response.json().catch(() => ({}))
          if (!response.ok || !result.orderId || !result.purchaseId) {
            throw new Error(result.error || 'Could not start PayPal checkout.')
          }
          purchaseRef.id = result.purchaseId
          setLoading(false)
          return result.orderId as string
        } catch (checkoutError) {
          setLoading(false)
          const message = checkoutError instanceof Error ? checkoutError.message : 'Could not start PayPal checkout.'
          setError(message)
          throw checkoutError
        }
      },
      onApprove: (data) => {
        const orderId = data.orderID
        if (!orderId || !purchaseRef.id) {
          setError('PayPal approved the order but did not return the checkout reference. Contact support before retrying payment.')
          return
        }
        const params = new URLSearchParams({ purchaseId: purchaseRef.id, token: orderId })
        window.location.assign(`/purchase/success?${params.toString()}`)
      },
      onCancel: () => {
        setLoading(false)
        setCancelled(true)
      },
      onError: (sdkError) => {
        setLoading(false)
        console.error('PayPal Standard Checkout failed:', sdkError)
        setError('PayPal could not complete checkout. Please try again or choose another available payment option.')
      }
    })

    void buttons.render(paypalContainer).catch((renderError) => {
      if (!active) return
      console.error('PayPal checkout buttons failed to render:', renderError)
      setError('PayPal checkout could not load. Refresh the page and try again.')
    })

    return () => {
      active = false
      void buttons?.close?.().catch(() => undefined)
    }
  }, [checkoutDetails, paypalSdkReady, paypalContainer])

  const chosenPrice = period === 'MONTHLY' ? pricing.monthly.amountMinor : pricing.yearly.amountMinor

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-sky-100 via-slate-50 to-white px-4 py-10 text-slate-900 sm:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><CreditCard className="h-7 w-7" /></div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-700">Fleet Manager</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Set up your workspace</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Choose prepaid access, enter your organization details, then complete payment securely through PayPal.</p>
        </header>

        <section className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-8">
          {cancelled && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Checkout was cancelled. No payment was captured.</div>}
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
            <button type="button" disabled={!!checkoutDetails} onClick={() => setMode('new')} className={`rounded-lg px-3 py-2.5 transition disabled:cursor-not-allowed disabled:opacity-70 ${mode === 'new' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>New workspace</button>
            <button type="button" disabled={!!checkoutDetails} onClick={() => setMode('renew')} className={`rounded-lg px-3 py-2.5 transition disabled:cursor-not-allowed disabled:opacity-70 ${mode === 'renew' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600'}`}>Renew workspace</button>
          </div>

          <form onSubmit={beginCheckout} className="mt-7 space-y-6">
            <fieldset>
              <legend className="mb-3 text-sm font-semibold text-slate-800">Select prepaid access</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {(['MONTHLY', 'YEARLY'] as const).map((value) => {
                  const price = value === 'MONTHLY' ? pricing.monthly.amountMinor : pricing.yearly.amountMinor
                  const selected = period === value
                  return <button key={value} type="button" disabled={!!checkoutDetails} onClick={() => setPeriod(value)} className={`relative rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-70 ${selected ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-100' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                    {selected && <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-blue-600" />}
                    <span className="block text-sm font-semibold">{value === 'MONTHLY' ? 'Monthly' : 'Yearly'}</span>
                    <span className="mt-2 block text-2xl font-bold tracking-tight">{money(price, pricing.currency)}</span>
                    <span className="mt-1 block text-xs text-slate-500">{value === 'MONTHLY' ? 'One month of access' : 'One year of access'}</span>
                  </button>
                })}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">Prepaid access renews manually. This PayPal checkout does not set up automatic recurring charges.</p>
            </fieldset>

            {mode === 'new' ? <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium sm:col-span-2">Organization name<input required minLength={2} maxLength={80} disabled={!!checkoutDetails} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" placeholder="Company name" /></label>
              <label className="space-y-1.5 text-sm font-medium">Workspace code<input required minLength={2} maxLength={48} disabled={!!checkoutDetails} pattern="[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*" value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value.toLowerCase())} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" placeholder="company-code" /><span className="block text-xs font-normal text-slate-500">Used on the workspace sign-in link.</span></label>
              <label className="space-y-1.5 text-sm font-medium">Administrator name<input required minLength={1} maxLength={100} disabled={!!checkoutDetails} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" placeholder="Full name" /></label>
              <label className="space-y-1.5 text-sm font-medium">Administrator email<input required type="email" maxLength={254} disabled={!!checkoutDetails} value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" placeholder="admin@company.com" /></label>
              <label className="space-y-1.5 text-sm font-medium">Phone number <span className="font-normal text-slate-500">(optional)</span><input type="tel" maxLength={40} disabled={!!checkoutDetails} value={ownerPhone} onChange={(event) => setOwnerPhone(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" placeholder="+966…" /></label>
            </div> : <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">Workspace code<input required minLength={2} maxLength={48} disabled={!!checkoutDetails} value={organizationSlug} onChange={(event) => setOrganizationSlug(event.target.value.toLowerCase())} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" placeholder="company-code" /></label>
              <label className="space-y-1.5 text-sm font-medium">Administrator email<input required type="email" maxLength={254} disabled={!!checkoutDetails} value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100" placeholder="admin@company.com" /></label>
              <p className="text-xs leading-5 text-slate-500 sm:col-span-2">We match the workspace code and administrator email before extending access. Your fleet data stays in the existing workspace database.</p>
            </div>}

            <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700"><input type="checkbox" disabled={!!checkoutDetails} checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" /><span>I agree to the <Link href="/agreement" className="font-semibold text-blue-700 underline">User Agreement</Link> and understand access is prepaid and must be renewed manually.</span></label>

            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="text-xs text-slate-500">Due now</p><p className="text-2xl font-bold">{money(chosenPrice, pricing.currency)}</p><p className="text-xs text-slate-500">Sandbox test · no real charge</p></div>
              {checkoutDetails ? <div className="w-full max-w-sm sm:w-72">
                {loading && <p className="mb-2 flex items-center justify-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Preparing secure checkout…</p>}
                {!paypalSdkReady && <p className="mb-2 text-center text-xs text-slate-500">Loading PayPal checkout…</p>}
                <div ref={setPaypalContainer} />
                <button type="button" onClick={() => { setCheckoutDetails(null); setPaypalSdkReady(false); setError('') }} className="mt-3 w-full text-sm font-medium text-blue-700 hover:underline">Edit organization details</button>
              </div> : <button type="submit" disabled={loading} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">Continue to secure PayPal checkout</button>}
            </div>
          </form>
        </section>

        <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />Payment details are handled by PayPal. The app stores only the verified payment reference.</div>
        <p className="mt-6 text-center text-xs text-slate-500"><Link href="/login" className="font-medium text-blue-700 hover:underline">Back to sign in</Link> · <Link href="/privacy" className="hover:underline">Privacy Policy</Link> · <Link href="/agreement" className="hover:underline">User Agreement</Link></p>
      </div>
      {checkoutDetails && paypalClientId && <Script
        id="paypal-standard-checkout-sdk"
        src={`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&currency=USD&intent=capture&components=buttons&enable-funding=card`}
        strategy="afterInteractive"
        onReady={() => setPaypalSdkReady(true)}
        onError={() => setError('Could not load the PayPal checkout. Please refresh and try again.')}
      />}
    </main>
  )
}
