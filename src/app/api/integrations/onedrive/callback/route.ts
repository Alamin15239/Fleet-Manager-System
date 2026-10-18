import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { claimOneDriveAccount, db, findOrganizationById, getPrimaryOrganization, OneDriveAccountAlreadyConnectedError, restoreOneDriveAccountClaim, withOrganization } from '@/lib/db'
import { ensureOneDriveChangeSubscription, getOneDriveRedirectUri, saveOneDriveConnection, syncOneDriveWorkbook } from '@/lib/onedrive-excel-sync'

export const runtime = 'nodejs'

const STATE_COOKIE = 'onedrive_oauth_state'
const VERIFIER_COOKIE = 'onedrive_pkce_verifier'
const CALLBACK_COOKIE_PATH = '/api/integrations/onedrive/callback'

function settingsRedirect(request: NextRequest, result: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  return NextResponse.redirect(new URL(`/settings?tab=onedrive&onedrive=${result}`, baseUrl))
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
  if (microsoftError) return clearOAuthCookies(settingsRedirect(request, 'cancelled'))

  const cookieState = request.cookies.get(STATE_COOKIE)?.value
  const verifier = request.cookies.get(VERIFIER_COOKIE)?.value
  if (!code || !state || !cookieState || state !== cookieState || !verifier || !process.env.JWT_SECRET) {
    return clearOAuthCookies(settingsRedirect(request, 'error'))
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
      return clearOAuthCookies(settingsRedirect(request, 'account_in_use'))
    }
    console.error('OneDrive authorization callback failed:', error instanceof Error ? error.message : 'Unknown error')
    return clearOAuthCookies(settingsRedirect(request, 'error'))
  }
}
