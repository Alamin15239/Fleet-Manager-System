import jwt from 'jsonwebtoken'
import type { NextRequest, NextResponse } from 'next/server'

export const PASSKEY_AUTH_OPTIONS_COOKIE = 'passkey-auth-options'
export const PASSKEY_REGISTER_OPTIONS_COOKIE = 'passkey-register-options'
export const PASSKEY_CHALLENGE_SECONDS = 5 * 60

export type PasskeyChallenge = jwt.JwtPayload & {
  purpose: 'passkey-authentication' | 'passkey-registration'
  challenge: string
  userId: string
  organizationId: string
  organizationSlug: string
}

export function getPasskeyRelyingParty(request: NextRequest) {
  const url = request.nextUrl
  if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    throw new Error('Passkeys require a secure HTTPS connection.')
  }
  return { rpID: url.hostname, origin: url.origin }
}

export function signPasskeyChallenge(payload: Pick<PasskeyChallenge, 'purpose' | 'challenge' | 'userId' | 'organizationId' | 'organizationSlug'>) {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return jwt.sign(payload, secret, { expiresIn: PASSKEY_CHALLENGE_SECONDS })
}

export function verifyPasskeyChallenge(token: string, purpose: PasskeyChallenge['purpose']): PasskeyChallenge {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  const payload = jwt.verify(token, secret) as PasskeyChallenge
  if (payload.purpose !== purpose || !payload.challenge || !payload.userId || !payload.organizationId || !payload.organizationSlug) {
    throw new Error('Passkey challenge is invalid or expired')
  }
  return payload
}

export function setChallengeCookie(response: NextResponse, name: string, value: string, path: string) {
  response.cookies.set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: PASSKEY_CHALLENGE_SECONDS,
    path,
  })
}

export function clearChallengeCookie(response: NextResponse, name: string, path: string) {
  response.cookies.set(name, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path,
  })
}

export const noStoreHeaders = { 'Cache-Control': 'private, no-store, max-age=0' }
