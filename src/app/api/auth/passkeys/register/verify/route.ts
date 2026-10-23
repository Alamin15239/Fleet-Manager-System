import { verifyRegistrationResponse } from '@simplewebauthn/server'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, ensurePasskeySchema } from '@/lib/db'
import { clearChallengeCookie, getPasskeyRelyingParty, noStoreHeaders, PASSKEY_REGISTER_OPTIONS_COOKIE, verifyPasskeyChallenge } from '@/lib/passkeys'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const finish = (payload: Record<string, unknown>, status = 200) => {
    const response = NextResponse.json(payload, { status, headers: noStoreHeaders })
    clearChallengeCookie(response, PASSKEY_REGISTER_OPTIONS_COOKIE, '/api/auth/passkeys/register/verify')
    return response
  }

  try {
    const user = await requireAuth(request)
    const token = request.cookies.get(PASSKEY_REGISTER_OPTIONS_COOKIE)?.value
    if (!token) return finish({ error: 'Passkey setup expired. Please try again.' }, 400)

    const challenge = verifyPasskeyChallenge(token, 'passkey-registration')
    if (challenge.userId !== user.id || challenge.organizationId !== user.organizationId) {
      return finish({ error: 'Passkey setup does not match the signed-in account.' }, 403)
    }

    const { response: credentialResponse, name } = await request.json()
    const relyingParty = getPasskeyRelyingParty(request)
    const verification = await verifyRegistrationResponse({
      response: credentialResponse,
      expectedChallenge: challenge.challenge,
      expectedOrigin: relyingParty.origin,
      expectedRPID: relyingParty.rpID,
    })
    if (!verification.verified || !verification.registrationInfo) {
      return finish({ error: 'The authenticator could not be verified. Try again.' }, 400)
    }

    await ensurePasskeySchema()
    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo
    const passkeyName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : 'Passkey'
    const passkey = await (db as any).passkeyCredential.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: credential.transports || [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        name: passkeyName,
      },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true, deviceType: true, backedUp: true },
    })
    return finish({ success: true, passkey })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message.includes('Unique constraint') || (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') ? 409 : 400
    console.warn('Passkey registration verification failed')
    return finish({ error: status === 409 ? 'This passkey is already registered.' : status === 401 ? 'Sign in again before adding a passkey.' : 'Passkey setup failed. Please try again.' }, status)
  }
}
