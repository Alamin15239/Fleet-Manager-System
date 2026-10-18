import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { claimOneDriveAccount, db, findOrganizationById, getPrimaryOrganization, OneDriveAccountAlreadyConnectedError, OneDriveAccountRegistryCheckError, restoreOneDriveAccountClaim, withOrganization } from '@/lib/db'
import { ensureOneDriveChangeSubscription, getOneDriveRedirectUri, saveOneDriveConnection, syncOneDriveWorkbook } from '@/lib/onedrive-excel-sync'

export const runtime = 'nodejs'

const STATE_COOKIE = 'onedrive_oauth_state'
const VERIFIER_COOKIE = 'onedrive_pkce_verifier'
const CALLBACK_COOKIE_PATH = '/api/integrations/onedrive/callback'

function settingsRedirect(request: NextRequest, result: string, reason?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const url = new URL('/settings?tab=onedrive', baseUrl)
  url.searchParams.set('onedrive', result)
  if (reason) url.searchParams.set('onedriveReason', reason.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 240))
  return NextResponse.redirect(url)
}

function safeConnectionFailureReason(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (error instanceof OneDriveAccountRegistryCheckError) return message
  if (message.startsWith('Microsoft authorization failed (HTTP ')) return message
  if (message === 'Microsoft did not grant the required OneDrive access. Reconnect and approve the requested access.') return message
  if (message === 'Microsoft account identity could not be verified. Reconnect OneDrive and approve profile access.') return message
  if (message === 'Microsoft did not return a stable account ID. Reconnect OneDrive and try again.') return message
  if (message === 'Administrator account is no longer active') return 'Your administrator account is no longer active. Sign in with an active organization administrator.'
  if (/hashtextextended|42883/i.test(message)) return 'The database could not create the OneDrive account safety lock. Contact support with the deployment time.'
  if (/P1001|P1002|P2024/i.test(message)) return 'The organization database could not be reached to verify this OneDrive account. Try again shortly.'
  if (/P2021|P2022/i.test(message)) return 'The organization registry schema is not ready for OneDrive connections. Wait for the latest deployment to finish, then try again.'
  return 'The server could not complete the organization account check. Ask an administrator to check the Vercel function log for this attempt.'
}

function clearOAuthCookies(response: NextResponse) {
  response.cookies.set(STATE_COOKIE, '', { path: CALLBACK_COOKIE_PATH, maxAge: 0 })
  response.cookies.set(VERIFIER_COOKIE, '', { path: CALLBACK_COOKIE_PATH, maxAge: 0 })
  return response
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const microsoftError = request.nextUrl.searchParams.get('error')
  if (microsoftError) {
    const description = request.nextUrl.searchParams.get('error_description')
    const reason = microsoftError === 'access_denied'
      ? 'Microsoft sign-in was cancelled.'
      : description ? `Microsoft sign-in failed (${microsoftError}): ${description}` : `Microsoft sign-in failed (${microsoftError}).`
    return clearOAuthCookies(settingsRedirect(request, microsoftError === 'access_denied' ? 'cancelled' : 'error', reason))
  }

  const cookieState = request.cookies.get(STATE_COOKIE)?.value
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value
  if (!code || !state || !cookieState || state !== cookieState || !verifier || !process.env.JWT_SECRET) {
    return clearOAuthCookies(settingsRedirect(request, 'error', 'The sign-in session expired or its browser cookies were unavailable. Start Connect OneDrive again.'))
  }

  try {
    const claims = jwt.verify(state, process.env.JWT_SECRET) as { purpose?: string; userId?: string; organizationId?: string }
    if (claims.purpose !== 'onedrive-oauth' || !claims.userId) throw new Error('Invalid authorization state')
    const organization = claims.organizationId ? await findOrganizationById(claims.organizationId) : await getPrimaryOrganization()
    return await withOrganization(organization, async () => {
    const user = await db.user.findUnique({ where: { id: claims.userId }, select: { id: true, role: true, isActive: true, isApproved: true, isDeleted: true } })
    if (!user || user.role !== 'ADMIN' || !user.isActive || !user.isApproved || user.isDeleted) throw new Error('Administrator account is no longer active')

    const tokenResponse = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || '',
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || '',
        grant_type: 'authorization_code',
        code,
        redirect_uri: getOneDriveRedirectUri(request.nextUrl.origin),
        code_verifier: verifier,
        scope: 'openid profile email offline_access User.Read Files.ReadWrite'
      })
    })
    if (!tokenResponse.ok) throw new Error(`Microsoft authorization failed (HTTP ${tokenResponse.status}). Check the app registration redirect URI and credentials.`)
    const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string }
    if (!tokens.access_token || !tokens.refresh_token) throw new Error('Microsoft did not grant the required OneDrive access. Reconnect and approve the requested access.')

    const profileResponse = await fetch('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    })
    if (!profileResponse.ok) throw new Error('Microsoft account identity could not be verified. Reconnect OneDrive and approve profile access.')
    const profile = await profileResponse.json() as { id?: string; mail?: string | null; userPrincipalName?: string | null }
    if (!profile.id) throw new Error('Microsoft did not return a stable account ID. Reconnect OneDrive and try again.')
    const connectedEmail = profile.mail || profile.userPrincipalName || null
    const previousAccountClaim = await claimOneDriveAccount(organization.id, profile.id, connectedEmail)
    try {
      await saveOneDriveConnection(tokens.refresh_token, connectedEmail)
    } catch (error) {
      await restoreOneDriveAccountClaim(organization.id, previousAccountClaim).catch((restoreError) => {
        console.error('Could not roll back the OneDrive account reservation:', restoreError instanceof Error ? restoreError.message : 'Unknown error')
      })
      throw error
    }
    const sync = await syncOneDriveWorkbook()
    if (sync.success) {
      try { await ensureOneDriveChangeSubscription() }
      catch (error) { console.error('OneDrive workbook notifications could not be enabled:', error instanceof Error ? error.message : 'Unknown error') }
    }
    return clearOAuthCookies(settingsRedirect(request, sync.success ? 'connected' : 'sync_failed'))
    })
  } catch (error) {
    if (error instanceof OneDriveAccountAlreadyConnectedError) {
      return clearOAuthCookies(settingsRedirect(request, 'account_in_use', error.message))
    }
    console.error('OneDrive authorization callback failed:', error instanceof Error ? error.message : 'Unknown error')
    return clearOAuthCookies(settingsRedirect(request, 'error', safeConnectionFailureReason(error)))
  }
}
