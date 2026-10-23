import { createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'
import { createUser, generateToken, hashPassword } from '@/lib/auth'
import { db, findOrganizationBySlug, withOrganization } from '@/lib/db'
import { logUserLogin } from '@/lib/activity-tracking'
import { trackRegistration } from '@/lib/activity-tracker'

export const runtime = 'nodejs'

const STATE_COOKIE = 'google-oauth-state'
const SESSION_COOKIE = 'auth-token'

type OAuthState = jwt.JwtPayload & {
  purpose: 'google-oauth'
  state: string
  nonce: string
  codeVerifier: string
  organizationSlug: string
  flow: 'login' | 'signup'
}

type GoogleJwk = JsonWebKey & { [key: string]: unknown; kid?: string; kty?: string; use?: string; alg?: string }
type GoogleIdentity = {
  sub: string
  email: string
  email_verified: boolean | string
  name?: string
  picture?: string
  iss: string
  aud: string | string[]
  azp?: string
  exp: number
  iat: number
  nonce: string
}

let cachedGoogleJwks: { keys: GoogleJwk[]; expiresAt: number } | null = null

function getAppBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  return new URL(configuredUrl || request.nextUrl.origin)
}

function loginRedirect(request: NextRequest, organizationSlug: string | undefined, code: string) {
  const url = new URL('/login', getAppBaseUrl(request))
  if (organizationSlug) url.searchParams.set('org', organizationSlug)
  url.searchParams.set('google', code)
  const response = NextResponse.redirect(url)
  response.cookies.set(STATE_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/api/auth/google/callback' })
  return response
}

async function loadGoogleKeys(forceRefresh = false): Promise<GoogleJwk[]> {
  if (!forceRefresh && cachedGoogleJwks && cachedGoogleJwks.expiresAt > Date.now()) {
    return cachedGoogleJwks.keys
  }

  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cache: 'no-store' })
  if (!response.ok) throw new Error('Google signing keys could not be loaded')
  const result = await response.json() as { keys?: GoogleJwk[] }
  if (!Array.isArray(result.keys)) throw new Error('Google signing keys response was invalid')
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 3600)
  cachedGoogleJwks = { keys: result.keys, expiresAt: Date.now() + maxAge * 1000 }
  return result.keys
}

async function verifyGoogleIdentity(idToken: string, expectedNonce: string, clientId: string): Promise<GoogleIdentity> {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('Google identity token is malformed')

  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as { alg?: string; kid?: string }
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Google identity token algorithm is not supported')

  let keys = await loadGoogleKeys()
  let jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA')
  if (!jwk) {
    keys = await loadGoogleKeys(true)
    jwk = keys.find((key) => key.kid === header.kid && key.kty === 'RSA')
  }
  if (!jwk) throw new Error('Google identity signing key was not found')

  const publicKey = createPublicKey({ key: jwk, format: 'jwk' })
  const verified = verifySignature(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(parts[2], 'base64url')
  )
  if (!verified) throw new Error('Google identity token signature is invalid')

  const identity = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as GoogleIdentity
  const audienceMatches = Array.isArray(identity.aud) ? identity.aud.includes(clientId) : identity.aud === clientId
  const authorizedPartyMatches = !Array.isArray(identity.aud) || identity.azp === clientId
  const emailVerified = identity.email_verified === true || identity.email_verified === 'true'
  const now = Math.floor(Date.now() / 1000)

  if (!['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss)) {
    throw new Error('Google identity issuer is invalid')
  }
  if (
    !audienceMatches || !authorizedPartyMatches || !identity.sub || !identity.email ||
    !Number.isFinite(identity.exp) || !Number.isFinite(identity.iat) ||
    identity.exp <= now || identity.iat > now + 300
  ) {
    throw new Error('Google identity claims are invalid')
  }
  if (identity.nonce !== expectedNonce) throw new Error('Google identity nonce is invalid')
  if (!emailVerified) throw new Error('Google email is not verified')

  return identity
}

function isUniqueConstraintError(error: unknown) {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002'
}

export async function GET(request: NextRequest) {
  const stateCookie = request.cookies.get(STATE_COOKIE)?.value
  const queryState = request.nextUrl.searchParams.get('state')
  let oauthState: OAuthState | null = null

  try {
    const secret = process.env.JWT_SECRET
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
    if (!secret || !clientId || !clientSecret || !stateCookie || !queryState) {
      return loginRedirect(request, undefined, 'failed')
    }

    const decoded = jwt.verify(stateCookie, secret) as OAuthState
    if (decoded.purpose !== 'google-oauth' || decoded.state !== queryState || !decoded.codeVerifier || !decoded.nonce || !decoded.organizationSlug) {
      return loginRedirect(request, undefined, 'failed')
    }
    oauthState = decoded

    const providerError = request.nextUrl.searchParams.get('error')
    const code = request.nextUrl.searchParams.get('code')
    if (providerError || !code) {
      return loginRedirect(request, oauthState.organizationSlug, providerError === 'access_denied' ? 'cancelled' : 'failed')
    }

    const callbackUrl = new URL('/api/auth/google/callback', getAppBaseUrl(request)).toString()
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        code_verifier: oauthState.codeVerifier,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
    })
    if (!tokenResponse.ok) throw new Error('Google authorization code could not be exchanged')
    const tokenData = await tokenResponse.json() as { id_token?: string }
    if (!tokenData.id_token) throw new Error('Google did not return an identity token')

    const identity = await verifyGoogleIdentity(tokenData.id_token, oauthState.nonce, clientId)
    const organization = await findOrganizationBySlug(oauthState.organizationSlug)
    const normalizedEmail = identity.email.trim().toLowerCase()

    const result = await withOrganization(organization, async () => {
      let user = await db.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      }) as any
      let isNewUser = false

      if (user?.isDeleted) throw new Error('google_account_deleted')

      if (!user) {
        try {
          user = await createUser({
            email: normalizedEmail,
            password: await hashPassword(randomBytes(48).toString('base64url')),
            name: identity.name?.trim() || normalizedEmail.split('@')[0],
            role: 'USER',
            permissions: {},
            isActive: true,
            isApproved: false,
            isEmailVerified: true,
          })
          isNewUser = true
        } catch (createError) {
          if (!isUniqueConstraintError(createError) && !(createError instanceof Error && createError.message === 'User already exists')) {
            throw createError
          }
          user = await db.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
          }) as any
          if (!user) throw createError
        }
      }

      if (user.isDeleted) throw new Error('google_account_deleted')
      if (!user.isActive) throw new Error('google_account_disabled')

      if (!user.isEmailVerified || (!user.profileImage && identity.picture) || (!user.name && identity.name)) {
        user = await db.user.update({
          where: { id: user.id },
          data: {
            isEmailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpires: null,
            ...(user.profileImage || !identity.picture ? {} : { profileImage: identity.picture }),
            ...(user.name || !identity.name ? {} : { name: identity.name.trim() }),
          },
        }) as any
      }

      if (isNewUser) {
        try {
          await trackRegistration(user.id, user.email, request)
        } catch (trackingError) {
          console.warn('Could not record Google account registration')
        }
      }

      if (!user.isApproved) return { pendingApproval: true as const }

      try {
        await logUserLogin(user.id, request)
      } catch (trackingError) {
        console.warn('Could not record Google sign-in activity')
      }

      const currentUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          isApproved: true,
          isEmailVerified: true,
          isDeleted: true,
          permissions: true,
          profileImage: true,
          phone: true,
          department: true,
          title: true,
          bio: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      if (!currentUser || currentUser.isDeleted || !currentUser.isActive || !currentUser.isApproved || !currentUser.isEmailVerified) {
        throw new Error('google_account_disabled')
      }
      return { pendingApproval: false as const, user: currentUser }
    })

    if (result.pendingApproval) {
      return loginRedirect(request, organization.slug, 'pending_approval')
    }

    const token = generateToken({
      id: result.user.id,
      email: result.user.email,
      name: result.user.name || undefined,
      role: result.user.role,
      isActive: result.user.isActive,
      isApproved: result.user.isApproved,
      isEmailVerified: result.user.isEmailVerified,
      permissions: result.user.permissions,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      isPrimaryOrganization: organization.isPrimary,
    })
    const redirectUrl = new URL('/login', getAppBaseUrl(request))
    redirectUrl.searchParams.set('google', 'complete')
    redirectUrl.searchParams.set('org', organization.slug)
    const response = NextResponse.redirect(redirectUrl)
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })
    response.cookies.set(STATE_COOKIE, '', { httpOnly: true, maxAge: 0, path: '/api/auth/google/callback' })
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const code = message === 'google_account_deleted'
      ? 'account_deleted'
      : message === 'google_account_disabled'
        ? 'account_disabled'
        : message === 'Google email is not verified'
          ? 'email_unverified'
          : message === 'Organization was not found or is not ready'
            ? 'invalid_organization'
            : 'failed'
    console.error('Google sign-in callback failed:', code)
    return loginRedirect(request, oauthState?.organizationSlug, code)
  }
}
