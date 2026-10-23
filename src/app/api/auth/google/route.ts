import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { NextRequest, NextResponse } from 'next/server'
import { findOrganizationBySlug } from '@/lib/db'

export const runtime = 'nodejs'

const STATE_COOKIE = 'google-oauth-state'

function getAppBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  return new URL(configuredUrl || request.nextUrl.origin)
}

function returnToLogin(request: NextRequest, organizationSlug: string | undefined, error: string) {
  const url = new URL('/login', getAppBaseUrl(request))
  if (organizationSlug) url.searchParams.set('org', organizationSlug)
  url.searchParams.set('google', error)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const jwtSecret = process.env.JWT_SECRET
  const requestedSlug = request.nextUrl.searchParams.get('org')?.trim().toLowerCase() || undefined

  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET?.trim() || !jwtSecret) {
    return returnToLogin(request, requestedSlug, 'not_configured')
  }

  try {
    const organization = await findOrganizationBySlug(requestedSlug)
    const state = randomBytes(32).toString('base64url')
    const codeVerifier = randomBytes(48).toString('base64url')
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url')
    const nonce = randomBytes(32).toString('base64url')
    const flow = request.nextUrl.searchParams.get('flow') === 'signup' ? 'signup' : 'login'
    const signedState = jwt.sign({
      purpose: 'google-oauth',
      state,
      nonce,
      codeVerifier,
      organizationSlug: organization.slug,
      flow,
    }, jwtSecret, { expiresIn: '10m' })

    const callbackUrl = new URL('/api/auth/google/callback', getAppBaseUrl(request)).toString()
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authorizationUrl.searchParams.set('client_id', clientId)
    authorizationUrl.searchParams.set('redirect_uri', callbackUrl)
    authorizationUrl.searchParams.set('response_type', 'code')
    authorizationUrl.searchParams.set('scope', 'openid email profile')
    authorizationUrl.searchParams.set('state', state)
    authorizationUrl.searchParams.set('nonce', nonce)
    authorizationUrl.searchParams.set('code_challenge', codeChallenge)
    authorizationUrl.searchParams.set('code_challenge_method', 'S256')
    authorizationUrl.searchParams.set('prompt', 'select_account')

    const response = NextResponse.redirect(authorizationUrl)
    response.cookies.set(STATE_COOKIE, signedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 10 * 60,
      path: '/api/auth/google/callback',
    })
    return response
  } catch (error) {
    console.error('Could not start Google sign-in')
    const code = error instanceof Error && error.message === 'Organization was not found or is not ready'
      ? 'invalid_organization'
      : 'failed'
    return returnToLogin(request, requestedSlug, code)
  }
}
