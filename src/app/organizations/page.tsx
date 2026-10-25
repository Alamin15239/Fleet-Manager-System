'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Building2, CheckCircle2, Copy, LoaderCircle, Pencil, Plus, RefreshCw, RotateCw, Save, Trash2, Wallet, X } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocalizedText } from '@/components/localized-text'
import { useToast } from '@/hooks/use-toast'

type Organization = {
  id: string
  name: string
  slug: string
  ownerName: string | null
  ownerEmail: string | null
  status: 'PROVISIONING' | 'ACTIVE' | 'FAILED'
  failureReason: string | null
  isPrimary: boolean
  createdAt: string
}

type BankTransferRequest = {
  id: string
  organizationName: string
  workspaceCode: string
  administratorName: string
  administratorEmail: string
  phone: string | null
  plan: 'MONTHLY' | 'YEARLY'
  amountMinor: number
  currency: string
  paymentReference: string
  status: string
  organizationId: string | null
  createdAt: string
}

function slugFromName(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)
}

export default function OrganizationsPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { toast } = useToast()
  const { t } = useLanguage()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [paymentRequests, setPaymentRequests] = useState<BankTransferRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingOwnerName, setEditingOwnerName] = useState('')
  const [editingOwnerEmail, setEditingOwnerEmail] = useState('')
  const [savingOwnerId, setSavingOwnerId] = useState<string | null>(null)
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [ownerName, setOwnerName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [formError, setFormError] = useState('')

  const isPrimaryAdmin = user?.role === 'ADMIN' && user.isPrimaryOrganization !== false
  const activeOrganizations = useMemo(() => organizations.filter((org) => org.status === 'ACTIVE'), [organizations])

  const loadOrganizations = useCallback(async () => {
    setLoading(true)
    try {
      const response = await apiGet('/api/organizations')
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not load organizations')
      setOrganizations(Array.isArray(data.organizations) ? data.organizations : [])
      const transfersResponse = await apiGet('/api/billing/bank-transfer/requests')
      const transfersData = await transfersResponse.json().catch(() => ({}))
      if (transfersResponse.ok) setPaymentRequests(Array.isArray(transfersData.requests) ? transfersData.requests : [])
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not load organizations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (isPrimaryAdmin) void loadOrganizations()
    else setLoading(false)
  }, [authLoading, isPrimaryAdmin, loadOrganizations])

  const updateName = (value: string) => {
    setName(value)
    if (!slugTouched) setSlug(slugFromName(value))
  }

  const createOrganization = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const response = await apiPost('/api/organizations', { name, slug, ownerName, ownerEmail })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Organization setup failed')
      toast({ title: 'Organization is ready', description: `${data.organization.name} has its own database and administrator.` })
      setName('')
      setSlug('')
      setSlugTouched(false)
      setOwnerName('')
      setOwnerEmail('')
      await loadOrganizations()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Organization setup failed'
      setFormError(message)
      await loadOrganizations()
    } finally {
      setSaving(false)
    }
  }

  const retryOrganization = async (organization: Organization) => {
    setRetryingId(organization.id)
    setFormError('')
    try {
      const response = await apiPost(`/api/organizations/${organization.id}/retry`, {})
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not retry organization setup')
      toast({ title: 'Organization is ready', description: `${organization.name} can now sign in.` })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not retry organization setup')
    } finally {
      setRetryingId(null)
      await loadOrganizations()
    }
  }

  const reviewBankTransfer = async (request: BankTransferRequest, action: 'CONFIRM_TRANSFER' | 'REJECT') => {
    if (action === 'CONFIRM_TRANSFER' && !window.confirm(`Confirm that ${request.amountMinor / 100} SAR was received for reference ${request.paymentReference}, then create ${request.organizationName}'s workspace?`)) return
    if (action === 'REJECT' && !window.confirm(`Reject the bank-transfer request for ${request.organizationName}?`)) return
    setReviewingRequestId(request.id)
    setFormError('')
    try {
      const response = await apiPatch(`/api/billing/bank-transfer/requests/${request.id}`, { action })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not update the transfer request')
      if (action === 'REJECT') {
        toast({ title: 'Transfer request rejected', description: `${request.organizationName} remains unprovisioned.` })
      } else if (data.setupError) {
        toast({ title: 'Transfer confirmed; workspace setup needs attention', description: `${data.setupError} Use Retry setup on the organization below.` })
      } else if (data.emailSent) {
        toast({ title: 'Transfer confirmed and workspace created', description: `A sign-in link was emailed to ${request.administratorEmail}.` })
      } else {
        toast({ title: 'Transfer confirmed and workspace created', description: `Share this sign-in link with ${request.administratorEmail}: ${data.loginUrl}` })
      }
      await loadOrganizations()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not update the transfer request')
    } finally {
      setReviewingRequestId(null)
    }
  }

  const deleteOrganization = async (organization: Organization) => {
    setDeletingId(organization.id)
    setFormError('')
    try {
      const response = await apiDelete(`/api/organizations/${organization.id}`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not delete the organization')
      toast({ title: t('Organization deleted'), description: `${organization.name}: ${t('Organization and its Neon project were deleted. Neon recovery is available for 7 days.')}` })
      setDeleteTarget(null)
      await loadOrganizations()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete the organization'
      setFormError(message)
      toast({ title: t('Organization deletion failed'), description: message, variant: 'destructive' })
    } finally {
      setDeletingId(null)
    }
  }
  const beginEditOwner = (organization: Organization) => {
    setEditingId(organization.id)
    setEditingOwnerName(organization.ownerName || '')
    setEditingOwnerEmail(organization.ownerEmail || '')
    setFormError('')
  }

  const saveOwnerDetails = async (organization: Organization) => {
    setSavingOwnerId(organization.id)
    setFormError('')
    try {
      const response = await apiPatch(`/api/organizations/${organization.id}`, {
        ownerName: editingOwnerName,
        ownerEmail: editingOwnerEmail
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Could not update the administrator')
      toast({
        title: 'Administrator updated',
        description: organization.status === 'FAILED'
          ? 'Retry setup to finish this organization.'
          : 'The organization administrator account has been updated.'
      })
      setEditingId(null)
      await loadOrganizations()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not update the administrator')
    } finally {
      setSavingOwnerId(null)
    }
  }

  const copyLoginLink = async (organization: Organization) => {
    const url = `${window.location.origin}/login?org=${encodeURIComponent(organization.slug)}`
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: 'Login link copied', description: `Share it with ${organization.ownerEmail || 'the organization administrator'}.` })
    } catch {
      window.prompt('Copy this organization login link', url)
    }
  }

  if (!authLoading && !isPrimaryAdmin) {
    return <div className="container mx-auto max-w-3xl p-4 sm:p-6"><Alert><AlertDescription><LocalizedText>Only the primary organization administrator can create organizations.</LocalizedText></AlertDescription></Alert></div>
  }

  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"><Building2 className="h-5 w-5" /></span>
        <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl"><LocalizedText>Organizations</LocalizedText></h1><p className="mt-1 text-sm text-muted-foreground"><LocalizedText>Create a separate workspace and database for each company.</LocalizedText></p></div>
      </header>

      {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}

      <Card className="border-indigo-500/15 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5 text-indigo-600" /><LocalizedText>Start a new organization</LocalizedText></CardTitle>
          <CardDescription><LocalizedText>Each organization starts with an empty fleet database and its own administrator. Your current company data stays in the original workspace.</LocalizedText></CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createOrganization} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="org-name"><LocalizedText>Organization name</LocalizedText></Label><Input id="org-name" required maxLength={80} value={name} onChange={(event) => updateName(event.target.value)} placeholder="Company name" /></div>
            <div className="space-y-2"><Label htmlFor="org-slug"><LocalizedText>Organization code</LocalizedText></Label><Input id="org-slug" required maxLength={48} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/--+/g, '-')) }} placeholder="company-code" /><p className="text-xs text-muted-foreground"><LocalizedText>Users enter this code on sign-in.</LocalizedText></p></div>
            <div className="space-y-2"><Label htmlFor="org-admin-name"><LocalizedText>First administrator name</LocalizedText></Label><Input id="org-admin-name" required maxLength={100} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Administrator name" /></div>
            <div className="space-y-2"><Label htmlFor="org-admin-email"><LocalizedText>First administrator email</LocalizedText></Label><Input id="org-admin-email" required type="email" maxLength={254} value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="admin@company.com" /></div>
            <div className="flex justify-end pt-1 sm:col-span-2"><Button type="submit" disabled={saving || !name || !slug || !ownerEmail || !ownerName}>{saving ? <><LoaderCircle className="me-2 h-4 w-4 animate-spin" /><LocalizedText>Creating isolated database…</LocalizedText></> : <><Plus className="me-2 h-4 w-4" /><LocalizedText>Create organization</LocalizedText></>}</Button></div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-emerald-500/15 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-emerald-600" /><LocalizedText>Bank-transfer requests</LocalizedText></CardTitle>
          <CardDescription><LocalizedText>Check your bank statement for the exact transfer reference before confirming. A customer receipt alone is not payment confirmation.</LocalizedText></CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex justify-center p-6"><LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : paymentRequests.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground"><LocalizedText>No bank-transfer requests yet.</LocalizedText> <a className="font-medium text-indigo-600 underline underline-offset-2" href="/purchase" target="_blank" rel="noreferrer">/purchase</a></p>
          ) : paymentRequests.map((transfer) => (
            <div key={transfer.id} className="rounded-xl border bg-background p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{transfer.organizationName}</p><Badge variant={transfer.status === 'APPROVED' ? 'default' : transfer.status === 'REJECTED' ? 'destructive' : 'secondary'}>{transfer.status.replaceAll('_', ' ')}</Badge></div>
                  <p className="text-sm text-muted-foreground">/{transfer.workspaceCode} · {transfer.plan === 'YEARLY' ? 'Yearly' : 'Monthly'} · {(transfer.amountMinor / 100).toFixed(2)} {transfer.currency}</p>
                  <p className="text-sm">{transfer.administratorName} · <span className="break-all">{transfer.administratorEmail}</span>{transfer.phone ? ` · ${transfer.phone}` : ''}</p>
                  <p className="font-mono text-sm font-semibold tracking-wide">{transfer.paymentReference}</p>
                  <p className="text-xs text-muted-foreground"><LocalizedText>Requested</LocalizedText> {new Date(transfer.createdAt).toLocaleString()}</p>
                </div>
                {transfer.status === 'AWAITING_TRANSFER' && (
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => void reviewBankTransfer(transfer, 'REJECT')} disabled={reviewingRequestId === transfer.id}><X className="me-2 h-4 w-4" /><LocalizedText>Reject</LocalizedText></Button>
                    <Button size="sm" onClick={() => void reviewBankTransfer(transfer, 'CONFIRM_TRANSFER')} disabled={reviewingRequestId === transfer.id}>
                      {reviewingRequestId === transfer.id ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="me-2 h-4 w-4" />}
                      <LocalizedText>Confirm payment & create workspace</LocalizedText>
                    </Button>
                  </div>
                )}
                {transfer.status === 'PROCESSING' && <span className="inline-flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /><LocalizedText>Creating workspace…</LocalizedText></span>}
                {transfer.status === 'APPROVED' && transfer.organizationId && <span className="text-xs text-muted-foreground">{transfer.organizationId}</span>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold"><LocalizedText>Organizations</LocalizedText></h2><p className="text-sm text-muted-foreground" aria-live="polite">{loading ? <LocalizedText>Loading organizations…</LocalizedText> : <>{activeOrganizations.length} <LocalizedText>ready</LocalizedText></>}</p></div><Button variant="outline" size="sm" onClick={() => void loadOrganizations()} disabled={loading}><RefreshCw className={`me-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /><LocalizedText>Refresh</LocalizedText></Button></div>
        {loading ? (
          <div className="flex justify-center p-10"><LoaderCircle className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : organizations.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground"><LocalizedText>No organizations registered yet.</LocalizedText></CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {organizations.map((organization) => (
              <Card key={organization.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{organization.name}</CardTitle>
                      <CardDescription className="mt-1">/{organization.slug}</CardDescription>
                    </div>
                    <Badge variant={organization.status === 'ACTIVE' ? 'default' : organization.status === 'FAILED' ? 'destructive' : 'secondary'}>
                      {organization.isPrimary ? <LocalizedText>Original</LocalizedText> : <LocalizedText>{organization.status}</LocalizedText>}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BadgeCheck className="h-4 w-4 shrink-0" />
                    {organization.ownerName || organization.ownerEmail || '—'}
                    {organization.ownerName && organization.ownerEmail ? <span className="truncate">· {organization.ownerEmail}</span> : null}
                  </div>
                  {organization.failureReason && <p className="rounded-lg bg-destructive/5 p-2 text-xs text-destructive">{organization.failureReason}</p>}

                  {editingId === organization.id && (
                    <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor={`edit-owner-name-${organization.id}`}><LocalizedText>Administrator name</LocalizedText></Label>
                        <Input id={`edit-owner-name-${organization.id}`} value={editingOwnerName} maxLength={100} onChange={(event) => setEditingOwnerName(event.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`edit-owner-email-${organization.id}`}><LocalizedText>Administrator email</LocalizedText></Label>
                        <Input id={`edit-owner-email-${organization.id}`} type="email" value={editingOwnerEmail} maxLength={254} onChange={(event) => setEditingOwnerEmail(event.target.value)} />
                      </div>
                      {organization.status === 'ACTIVE' && (
                        <p className="text-xs text-muted-foreground sm:col-span-2">
                          <LocalizedText>Changing the email requires the administrator to verify the new address before signing in.</LocalizedText>
                        </p>
                      )}
                      <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)} disabled={savingOwnerId === organization.id}>
                          <X className="me-2 h-4 w-4" /><LocalizedText>Cancel</LocalizedText>
                        </Button>
                        <Button size="sm" onClick={() => void saveOwnerDetails(organization)} disabled={savingOwnerId === organization.id || !editingOwnerName.trim() || !editingOwnerEmail.trim()}>
                          {savingOwnerId === organization.id ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Save className="me-2 h-4 w-4" />}
                          <LocalizedText>Save administrator</LocalizedText>
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-2">
                    {organization.status === 'ACTIVE' && !organization.isPrimary && (
                      <Button size="sm" variant="outline" onClick={() => void copyLoginLink(organization)}>
                        <Copy className="me-2 h-4 w-4" /><LocalizedText>Copy login link</LocalizedText>
                      </Button>
                    )}
                    {(organization.status === 'FAILED' || organization.status === 'ACTIVE') && (
                      <Button size="sm" onClick={() => beginEditOwner(organization)} disabled={savingOwnerId === organization.id}>
                        <Pencil className="me-2 h-4 w-4" /><LocalizedText>Edit administrator</LocalizedText>
                      </Button>
                    )}
                    {organization.status === 'FAILED' && (
                      <Button size="sm" variant="outline" disabled={retryingId === organization.id || savingOwnerId === organization.id} onClick={() => void retryOrganization(organization)}>
                        {retryingId === organization.id ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <RotateCw className="me-2 h-4 w-4" />}
                        <LocalizedText>Retry setup</LocalizedText>
                      </Button>
                    )}
                    {!organization.isPrimary && organization.status !== 'PROVISIONING' && (
                      <Button size="sm" variant="destructive" disabled={deletingId === organization.id} onClick={() => setDeleteTarget(organization)}>
                        {deletingId === organization.id ? <LoaderCircle className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
                        <LocalizedText>Delete organization</LocalizedText>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open && deletingId === null) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle><LocalizedText>Delete organization?</LocalizedText></AlertDialogTitle>
            <AlertDialogDescription>
              <LocalizedText>This deletes the organization's separate Neon project and its fleet data. Neon project recovery is available for 7 days. The original Fleet Manager database will not be deleted.</LocalizedText>
              {deleteTarget && <span className="mt-2 block font-medium text-foreground">{deleteTarget.name} · /{deleteTarget.slug}</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}><LocalizedText>Cancel</LocalizedText></AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={!deleteTarget || deletingId !== null}
              onClick={(event) => {
                event.preventDefault()
                if (deleteTarget) void deleteOrganization(deleteTarget)
              }}
            >
              {deletingId ? <><LoaderCircle className="me-2 h-4 w-4 animate-spin" /><LocalizedText>Deleting organization…</LocalizedText></> : <><Trash2 className="me-2 h-4 w-4" /><LocalizedText>Delete database and organization</LocalizedText></>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <p className="text-xs text-muted-foreground"><LocalizedText>Separate databases require Neon API provisioning and available project capacity. Add the setup keys in the deployment environment before creating the first organization.</LocalizedText></p>
    </div>
  )
}
