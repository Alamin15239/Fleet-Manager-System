'use client'

import { useCallback, useEffect, useState } from 'react'
import { startRegistration } from '@simplewebauthn/browser'
import { Fingerprint, KeyRound, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LocalizedText } from '@/components/localized-text'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { useToast } from '@/hooks/use-toast'

type SavedPasskey = {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
  deviceType: string
  backedUp: boolean
}

async function getApiError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data.error === 'string' ? data.error : fallback
  } catch {
    return fallback
  }
}

export function PasskeyManager() {
  const { token } = useAuth()
  const { t } = useLanguage()
  const { toast } = useToast()
  const [passkeys, setPasskeys] = useState<SavedPasskey[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const loadPasskeys = useCallback(async () => {
    if (!token) {
      setPasskeys([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await fetch('/api/auth/passkeys', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(await getApiError(response, 'Passkeys could not be loaded.'))
      const data = await response.json()
      setPasskeys(Array.isArray(data.passkeys) ? data.passkeys : [])
    } catch (error) {
      toast({ title: t(error instanceof Error ? error.message : 'Passkeys could not be loaded.'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [token, toast, t])

  useEffect(() => {
    void loadPasskeys()
  }, [loadPasskeys])

  const addPasskey = async () => {
    if (!token || adding) return
    setAdding(true)
    try {
      const optionsResponse = await fetch('/api/auth/passkeys/register/options', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      if (!optionsResponse.ok) throw new Error(await getApiError(optionsResponse, 'Could not start passkey setup.'))
      const { options } = await optionsResponse.json()
      const registration = await startRegistration({ optionsJSON: options })
      const response = await fetch('/api/auth/passkeys/register/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: registration }),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(await getApiError(response, 'Passkey setup failed.'))
      toast({ title: t('Passkey added'), description: t('You can now use it to sign in.') })
      await loadPasskeys()
    } catch (error) {
      toast({ title: t(error instanceof Error ? error.message : 'Passkey setup failed.'), variant: 'destructive' })
    } finally {
      setAdding(false)
    }
  }

  const removePasskey = async (id: string) => {
    if (!token || removing) return
    if (!window.confirm(t('Remove this passkey from your account?'))) return
    setRemoving(id)
    try {
      const response = await fetch('/api/auth/passkeys', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        cache: 'no-store',
      })
      if (!response.ok) throw new Error(await getApiError(response, 'Passkey could not be removed.'))
      setPasskeys((current) => current.filter((passkey) => passkey.id !== id))
      toast({ title: t('Passkey removed') })
    } catch (error) {
      toast({ title: t(error instanceof Error ? error.message : 'Passkey could not be removed.'), variant: 'destructive' })
    } finally {
      setRemoving(null)
    }
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="border-b border-border/60 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Fingerprint className="h-5 w-5" /></span>
            <div>
              <CardTitle className="text-base"><LocalizedText>Passkeys</LocalizedText></CardTitle>
              <CardDescription className="mt-1"><LocalizedText>Add a device passkey for faster sign-in</LocalizedText></CardDescription>
            </div>
          </div>
          <Button onClick={addPasskey} disabled={!token || adding} className="w-full rounded-xl sm:w-auto">
            {adding ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Plus className="me-2 h-4 w-4" />}
            <LocalizedText>{adding ? 'Adding passkey...' : 'Add passkey'}</LocalizedText>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><LocalizedText>Loading passkeys</LocalizedText></div>
        ) : passkeys.length ? (
          <ul className="space-y-3">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm ring-1 ring-border/70"><KeyRound className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{passkey.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground"><LocalizedText>Added</LocalizedText> {new Date(passkey.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full rounded-lg sm:w-auto" onClick={() => void removePasskey(passkey.id)} disabled={removing !== null}>
                  {removing === passkey.id ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Trash2 className="me-2 h-4 w-4" />}
                  <LocalizedText>Remove</LocalizedText>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground"><LocalizedText>No passkeys saved yet. Add one to sign in with your device or security key.</LocalizedText></p>
        )}
      </CardContent>
    </Card>
  )
}
