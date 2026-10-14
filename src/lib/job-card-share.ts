import { createHmac, timingSafeEqual } from 'node:crypto'

function getSigningSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return secret
}

export function createJobCardShareToken(jobCardId: string) {
  return createHmac('sha256', getSigningSecret())
    .update(`job-card-share:${jobCardId}`)
    .digest('base64url')
}

export function verifyJobCardShareToken(jobCardId: string, token: string) {
  try {
    const expected = Buffer.from(createJobCardShareToken(jobCardId))
    const received = Buffer.from(token)
    return expected.length === received.length && timingSafeEqual(expected, received)
  } catch {
    return false
  }
}
