'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2, Check, Copy, LoaderCircle, ShieldCheck, Wallet } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'

type PurchaseConfig = {
  available: boolean
  companyName: string
  bank: { name: string; accountName: string; accountNumber: string; iban: string }
  plans: { MONTHLY: number | null; YEARLY: number | null }
  currency: 'SAR'
}

type TransferConfirmation = {
  paymentReference: string
  amountMinor: number
  currency: string
  plan: 'MONTHLY' | 'YEARLY'
  bank: PurchaseConfig['bank']
  companyName: string
}

function money(amountMinor: number) {
  return new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR' }).format(amountMinor / 100)
}

export default function PurchasePage() {
  const [config, setConfig] = useState<PurchaseConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [confirmation, setConfirmation] = useState<TransferConfirmation | null>(null)
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [form, setForm] = useState({
    organizationName: '',
    workspaceCode: '',
    administratorName: '',
    administratorEmail: '',
    phone: '',
    plan: 'YEARLY' as 'MONTHLY' | 'YEARLY'
  })

  useEffect(() => {
    let cancelled = false
    fetch('/api/billing/bank-transfer', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || 'Could not load bank-transfer details.')
        if (!cancelled) setConfig(data)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load bank-transfer details.')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const updateName = (organizationName: string) => {
    setForm((current) => ({
      ...current,
      organizationName,
      workspaceCode: current.workspaceCode || organizationName.toLowerCase()
        .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
    }))
  }

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const response = await fetch('/api/billing/bank-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, agreementAccepted })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not create the transfer request.')
      setConfirmation(data)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create the transfer request.')
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value) } catch { window.prompt('Copy this value', value) }
  }

  if (confirmation) {
    return (
      <main className="min-h-dvh bg-gradient-to-b from-indigo-50/70 via-background to-background px-4 py-8 sm:py-14">
        <div className="mx-auto max-w-2xl space-y-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Fleet Manager</Link>
          <Card className="overflow-hidden border-indigo-200 shadow-xl shadow-indigo-950/5">
            <div className="h-2 bg-gradient-to-r from-indigo-600 via-violet-500 to-sky-500" />
            <CardHeader>
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" /></div>
              <CardTitle className="text-2xl">Transfer instructions</CardTitle>
              <CardDescription>Your workspace request is saved. Transfer the exact amount and include the reference below in the bank transfer description.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border bg-muted/30 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div><p className="text-sm text-muted-foreground">Amount due</p><p className="mt-1 text-3xl font-bold tracking-tight">{money(confirmation.amountMinor)}</p></div>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">{confirmation.plan === 'YEARLY' ? 'Yearly access' : 'Monthly access'}</span>
                </div>
              </div>
              <div className="space-y-3 rounded-2xl border p-4 sm:p-5">
                <p className="font-semibold">Bank account</p>
                {confirmation.bank.name && <InfoRow label="Bank" value={confirmation.bank.name} />}
                <InfoRow label="Account name" value={confirmation.bank.accountName} />
                {confirmation.bank.accountNumber && <InfoRow label="Account number" value={confirmation.bank.accountNumber} copy={copy} />}
                <InfoRow label="IBAN" value={confirmation.bank.iban} copy={copy} />
              </div>
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <p className="text-sm font-semibold">Transfer reference</p>
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3 font-mono text-lg font-bold tracking-wide">
                  <span className="break-all">{confirmation.paymentReference}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => void copy(confirmation.paymentReference)} aria-label="Copy transfer reference"><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="mt-2 text-xs">Use this exact reference so the transfer can be matched to your request.</p>
              </div>
              <Alert><ShieldCheck className="h-4 w-4" /><AlertDescription>Access and the separate Neon database are created after the administrator confirms the transfer in the bank account. A receipt image by itself does not confirm payment.</AlertDescription></Alert>
              <p className="text-sm text-muted-foreground">Keep this reference. Once confirmed, the administrator will receive a workspace sign-in link at <strong className="break-all text-foreground">{form.administratorEmail}</strong>.</p>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  const monthlyPrice = config?.plans.MONTHLY || null
  const yearlyPrice = config?.plans.YEARLY || null
  const selectedPrice = form.plan === 'MONTHLY' ? monthlyPrice : yearlyPrice

  return (
    <main className="min-h-dvh bg-gradient-to-b from-indigo-50/70 via-background to-background px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Fleet Manager</Link>
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/75 px-3 py-1 text-xs font-semibold text-indigo-700"><Wallet className="h-3.5 w-3.5" />Bank transfer</div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Set up your fleet workspace</h1>
          <p className="max-w-2xl text-muted-foreground">Choose an access period and request a separate workspace. Your database is created after we confirm the bank transfer.</p>
        </header>

        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        {loading ? (
          <Card><CardContent className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground"><LoaderCircle className="h-5 w-5 animate-spin" />Loading transfer options…</CardContent></Card>
        ) : !config?.available ? (
          <Card className="border-amber-200"><CardHeader><CardTitle>Bank-transfer setup is not ready</CardTitle><CardDescription>The administrator must add the receiving account details and monthly or yearly prices in Settings before purchase requests can be opened.</CardDescription></CardHeader></Card>
        ) : (
          <form onSubmit={submitRequest} className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <Card className="shadow-lg shadow-indigo-950/5">
              <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-indigo-600" />Organization details</CardTitle><CardDescription>These details are used to create the workspace and its first administrator.</CardDescription></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="purchase-org-name">Organization name</Label><Input id="purchase-org-name" required maxLength={80} value={form.organizationName} onChange={(event) => updateName(event.target.value)} placeholder="Company name" /></div>
                <div className="space-y-2"><Label htmlFor="purchase-workspace-code">Workspace code</Label><Input id="purchase-workspace-code" required maxLength={48} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.workspaceCode} onChange={(event) => setForm((current) => ({ ...current, workspaceCode: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-') }))} placeholder="company-code" /><p className="text-xs text-muted-foreground">This code appears in the workspace sign-in link.</p></div>
                <div className="space-y-2"><Label htmlFor="purchase-admin-name">Administrator name</Label><Input id="purchase-admin-name" required maxLength={100} value={form.administratorName} onChange={(event) => setForm((current) => ({ ...current, administratorName: event.target.value }))} placeholder="First administrator" /></div>
                <div className="space-y-2"><Label htmlFor="purchase-admin-email">Administrator email</Label><Input id="purchase-admin-email" required type="email" maxLength={254} value={form.administratorEmail} onChange={(event) => setForm((current) => ({ ...current, administratorEmail: event.target.value }))} placeholder="admin@company.com" /></div>
                <div className="space-y-2 sm:col-span-2"><Label htmlFor="purchase-phone">Phone number <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="purchase-phone" type="tel" maxLength={40} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+966…" /></div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card className="shadow-lg shadow-indigo-950/5">
                <CardHeader><CardTitle>Choose access period</CardTitle><CardDescription>Renewals are handled by bank transfer and admin confirmation.</CardDescription></CardHeader>
                <CardContent className="space-y-3">
                  <PlanChoice name="MONTHLY" label="Monthly" price={monthlyPrice} selected={form.plan === 'MONTHLY'} onSelect={() => setForm((current) => ({ ...current, plan: 'MONTHLY' }))} />
                  <PlanChoice name="YEARLY" label="Yearly" price={yearlyPrice} selected={form.plan === 'YEARLY'} onSelect={() => setForm((current) => ({ ...current, plan: 'YEARLY' }))} />
                  <div className="border-t pt-4"><div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Due by bank transfer</span><strong className="text-lg">{selectedPrice ? money(selectedPrice) : 'Not configured'}</strong></div></div>
                  <div className="flex items-start gap-2 pt-1">
                    <Checkbox id="purchase-agreement" checked={agreementAccepted} onCheckedChange={(checked) => setAgreementAccepted(checked === true)} />
                    <Label htmlFor="purchase-agreement" className="text-xs font-normal leading-5 text-muted-foreground">I agree to the <Link className="font-medium text-indigo-700 underline underline-offset-2" href="/agreement" target="_blank">User Agreement</Link> and understand access begins after the bank transfer is confirmed.</Label>
                  </div>
                  <Button className="w-full" type="submit" disabled={submitting || loading || !config?.available || !selectedPrice || !agreementAccepted}>
                    {submitting ? <><LoaderCircle className="me-2 h-4 w-4 animate-spin" />Preparing transfer…</> : 'Get bank-transfer instructions'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">No card details are collected. Your request stays pending until the transfer is verified.</p>
                </CardContent>
              </Card>
            </div>
          </form>
        )}
        <footer className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground"><Link href="/privacy" className="hover:text-foreground">Privacy</Link><Link href="/agreement" className="hover:text-foreground">User Agreement</Link><Link href="/help" className="hover:text-foreground">Help</Link></footer>
      </div>
    </main>
  )
}

function PlanChoice({ name, label, price, selected, onSelect }: { name: string; label: string; price: number | null; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} disabled={!price} className={`w-full rounded-xl border p-3 text-start transition ${selected ? 'border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/15' : 'hover:border-indigo-300'} ${!price ? 'cursor-not-allowed opacity-45' : ''}`}>
      <span className="flex items-center justify-between gap-3"><span><span className="block font-semibold">{label}</span><span className="mt-0.5 block text-xs text-muted-foreground">{name === 'YEARLY' ? 'One year of workspace access' : 'One month of workspace access'}</span></span><span className="text-right"><span className="block font-bold">{price ? money(price) : 'Unavailable'}</span>{price && <span className="text-xs text-muted-foreground">/{name === 'YEARLY' ? 'year' : 'month'}</span>}</span></span>
    </button>
  )
}

function InfoRow({ label, value, copy }: { label: string; value: string; copy?: (value: string) => void }) {
  return <div className="flex items-center justify-between gap-3 border-t pt-3 first:border-0 first:pt-0"><span className="text-sm text-muted-foreground">{label}</span><span className="flex min-w-0 items-center gap-2 text-right text-sm font-medium"><span className="break-all">{value}</span>{copy && <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => void copy(value)} aria-label={`Copy ${label}`}><Copy className="h-4 w-4" /></Button>}</span></div>
}
