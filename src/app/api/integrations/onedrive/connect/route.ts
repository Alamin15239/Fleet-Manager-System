import { createHash, randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { requireAdmin } from '@/lib/auth'
import { getOneDriveRedirectUri, isOneDriveConfigured } from '@/lib/onedrive-excel-sync'

export const runtime = 'nodejs'

const STATE_COOKIE = 'onedrive_oauth_state'
const VERIFIER_COOKIE = 'onedrive_pkce_verifier'
const CALLBACK_COOKIE_PATH = '/api/integrations/onedrive/callback'

export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
    if (!isOneDriveConfigured() || !process.env.JWT_SECRET) {
      return NextResponse.json({ error: 'OneDrive is not configured. Add the Microsoft app ID, app secret, token encryption key, and public app URL to the deployment environment.' }, { status: 503 })
    }

    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const state = jwt.sign({ purpose: 'onedrive-oauth', userId: user.id, organizationId: user.organizationId, organizationSlug: user.organizationSlug, nonce: randomBytes(16).toString('base64url') }, process.env.JWT_SECRET, { expiresIn: '10m' })
    const authorization = new URL('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize')
    authorization.search = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      response_type: 'code',
      response_mode: 'query',
      redirect_uri: getOneDriveRedirectUri(request.nextUrl.origin),
      scope: 'openid profile email offline_access User.Read Files.ReadWrite',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account'
    }).toString()

    const response = NextResponse.json({ authorizationUrl: authorization.toString() })
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 600,
      path: CALLBACK_COOKIE_PATH
    }
    response.cookies.set(STATE_COOKIE, state, cookieOptions)
    response.cookies.set(VERIFIER_COOKIE, verifier, cookieOptions)
    return response
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Administrator access required' : 'Could not start OneDrive authorization' }, { status })
  }
}
