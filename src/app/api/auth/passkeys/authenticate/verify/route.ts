import { verifyAuthenticationResponse } from '@simplewebauthn/server'
import { NextRequest, NextResponse } from 'next/server'
import { generateToken } from '@/lib/auth'
import { db, ensurePasskeySchema, findOrganizationById, withOrganization } from '@/lib/db'
import { logUserLogin } from '@/lib/activity-tracking'
import { clearChallengeCookie, getPasskeyRelyingParty, noStoreHeaders, PASSKEY_AUTH_OPTIONS_COOKIE, verifyPasskeyChallenge } from '@/lib/passkeys'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const finish = (payload: Record<string, unknown>, status = 200, token?: string) => {
    const response = NextResponse.json(payload, { status, headers: noStoreHeaders })
    clearChallengeCookie(response, PASSKEY_AUTH_OPTIONS_COOKIE, '/api/auth/passkeys/authenticate/verify')
    if (token) {
      response.cookies.set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      })
    }
    return response
  }

  try {
    const token = request.cookies.get(PASSKEY_AUTH_OPTIONS_COOKIE)?.value
    if (!token) return finish({ error: 'Passkey sign-in expired. Please try again.' }, 400)
    const challenge = verifyPasskeyChallenge(token, 'passkey-authentication')
    const { response: credentialResponse } = await request.json()
    if (!credentialResponse?.id || typeof credentialResponse.id !== 'string') {
      return finish({ error: 'Passkey response is missing its credential ID.' }, 400)
    }

    const organization = await findOrganizationById(challenge.organizationId)
    if (organization.slug !== challenge.organizationSlug) {
      return finish({ error: 'This organization is no longer available.' }, 404)
    }

    const result = await withOrganization(organization, async () => {
      await ensurePasskeySchema()
      const user = await db.user.findUnique({
        where: { id: challenge.userId },
        select: {
          id: true, email: true, name: true, role: true, isActive: true, isApproved: true,
          isEmailVerified: true, isDeleted: true, permissions: true, profileImage: true,
          phone: true, department: true, title: true, bio: true, createdAt: true, updatedAt: true,
        },
      })
      if (!user || user.isDeleted || !user.isActive || !user.isApproved || !user.isEmailVerified) {
        throw new Error('passkey_account_unavailable')
      }

      const passkey = await (db as any).passkeyCredential.findFirst({
        where: { userId: user.id, credentialId: credentialResponse.id },
      })
      if (!passkey) throw new Error('passkey_not_found')

      const relyingParty = getPasskeyRelyingParty(request)
      const verification = await verifyAuthenticationResponse({
        response: credentialResponse,
        expectedChallenge: challenge.challenge,
        expectedOrigin: relyingParty.origin,
        expectedRPID: relyingParty.rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: Number(passkey.counter),
          transports: passkey.transports as any,
        },
      })
      if (!verification.verified) throw new Error('passkey_verification_failed')

      await (db as any).passkeyCredential.update({
        where: { id: passkey.id },
        data: { counter: BigInt(verification.authenticationInfo.newCounter), lastUsedAt: new Date() },
      })
      try {
        await logUserLogin(user.id, request)
      } catch {
        console.warn('Could not record passkey sign-in activity')
      }

      const sessionToken = generateToken({
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        role: user.role,
        isActive: user.isActive,
        isApproved: user.isApproved,
        isEmailVerified: user.isEmailVerified,
        permissions: user.permissions,
        organizationId: organization.id,
        organizationSlug: organization.slug,
        organizationName: organization.name,
        isPrimaryOrganization: organization.isPrimary,
      })
      return { user: { ...user, organizationId: organization.id, organizationSlug: organization.slug, organizationName: organization.name, isPrimaryOrganization: organization.isPrimary }, token: sessionToken }
    })

    return finish({ success: true, user: result.user, token: result.token, message: 'Passkey sign-in successful.' }, 200, result.token)
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const status = ['passkey_account_unavailable', 'passkey_not_found'].includes(code) ? 403 : 400
    const message = code === 'passkey_account_unavailable'
      ? 'This account is not approved to sign in.'
      : code === 'passkey_not_found'
        ? 'That passkey is not registered for this account.'
        : 'Passkey verification failed. Try again.'
    console.warn('Passkey authentication failed:', code || 'unknown error')
    return finish({ error: message }, status)
  }
}
