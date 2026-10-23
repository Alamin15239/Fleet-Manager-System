import { generateAuthenticationOptions } from '@simplewebauthn/server'
import { NextRequest, NextResponse } from 'next/server'
import { db, ensurePasskeySchema, findOrganizationBySlug, withOrganization } from '@/lib/db'
import { getPasskeyRelyingParty, noStoreHeaders, PASSKEY_AUTH_OPTIONS_COOKIE, setChallengeCookie, signPasskeyChallenge } from '@/lib/passkeys'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const { email, organizationSlug } = await request.json()
    if (typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Enter your email address first.' }, { status: 400, headers: noStoreHeaders })
    }
    const organization = await findOrganizationBySlug(typeof organizationSlug === 'string' ? organizationSlug : undefined)
    const { rpID } = getPasskeyRelyingParty(request)

    const options = await withOrganization(organization, async () => {
      await ensurePasskeySchema()
      const normalizedEmail = email.trim().toLowerCase()
      const user = await db.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' }, isActive: true, isApproved: true, isEmailVerified: true, isDeleted: false },
        select: { id: true, email: true },
      })
      if (!user) throw new Error('passkey_unavailable')

      const credentials = await (db as any).passkeyCredential.findMany({
        where: { userId: user.id },
        select: { credentialId: true, transports: true },
      }) as Array<{ credentialId: string; transports: string[] }>
      if (!credentials.length) throw new Error('passkey_unavailable')

      const authenticationOptions = await generateAuthenticationOptions({
        rpID,
        allowCredentials: credentials.map((credential) => ({
          id: credential.credentialId,
          transports: credential.transports as any,
        })),
        userVerification: 'preferred',
      })
      const challengeCookie = signPasskeyChallenge({
        purpose: 'passkey-authentication',
        challenge: authenticationOptions.challenge,
        userId: user.id,
        organizationId: organization.id,
        organizationSlug: organization.slug,
      })
      return { authenticationOptions, challengeCookie }
    })

    const response = NextResponse.json({ options: options.authenticationOptions }, { headers: noStoreHeaders })
    setChallengeCookie(response, PASSKEY_AUTH_OPTIONS_COOKIE, options.challengeCookie, '/api/auth/passkeys/authenticate/verify')
    return response
  } catch (error) {
    const status = error instanceof Error && error.message === 'Organization was not found or is not ready' ? 404 : 400
    const message = error instanceof Error && error.message === 'passkey_unavailable'
      ? 'No active account with a passkey was found in this organization.'
      : status === 404 ? 'Organization not found.' : 'Could not start passkey sign-in.'
    return NextResponse.json({ error: message }, { status, headers: noStoreHeaders })
  }
}
