import { generateRegistrationOptions } from '@simplewebauthn/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, ensurePasskeySchema } from '@/lib/db'
import { noStoreHeaders, PASSKEY_REGISTER_OPTIONS_COOKIE, setChallengeCookie, signPasskeyChallenge, getPasskeyRelyingParty } from '@/lib/passkeys'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    await ensurePasskeySchema()
    const { rpID } = getPasskeyRelyingParty(request)
    const registered = await (db as any).passkeyCredential.findMany({
      where: { userId: user.id },
      select: { credentialId: true, transports: true },
    }) as Array<{ credentialId: string; transports: string[] }>

    const options = await generateRegistrationOptions({
      rpName: 'Fleet Manager',
      rpID,
      userID: Buffer.from(user.id, 'utf8'),
      userName: user.email,
      userDisplayName: user.name || user.email,
      attestationType: 'none',
      supportedAlgorithmIDs: [-7, -257],
      excludeCredentials: registered.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports as any,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    })

    const challenge = signPasskeyChallenge({
      purpose: 'passkey-registration',
      challenge: options.challenge,
      userId: user.id,
      organizationId: user.organizationId!,
      organizationSlug: user.organizationSlug!,
    })
    const response = NextResponse.json({ options }, { headers: noStoreHeaders })
    setChallengeCookie(response, PASSKEY_REGISTER_OPTIONS_COOKIE, challenge, '/api/auth/passkeys/register/verify')
    return response
  } catch (error) {
    const status = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message) ? 401 : 503
    return NextResponse.json({ error: status === 401 ? 'Sign in again before adding a passkey.' : 'Could not start passkey setup.' }, { status, headers: noStoreHeaders })
  }
}
