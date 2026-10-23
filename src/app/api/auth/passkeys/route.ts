import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db, ensurePasskeySchema } from '@/lib/db'
import { noStoreHeaders } from '@/lib/passkeys'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    await ensurePasskeySchema()
    const passkeys = await (db as any).passkeyCredential.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, createdAt: true, lastUsedAt: true, deviceType: true, backedUp: true },
    })
    return NextResponse.json({ passkeys }, { headers: noStoreHeaders })
  } catch (error) {
    const status = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message) ? 401 : 503
    return NextResponse.json({ error: status === 401 ? 'Sign in again to manage passkeys.' : 'Passkeys could not be loaded.' }, { status, headers: noStoreHeaders })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request)
    const { id } = await request.json()
    if (typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'Select a passkey to remove.' }, { status: 400, headers: noStoreHeaders })
    }
    await ensurePasskeySchema()
    const result = await (db as any).passkeyCredential.deleteMany({ where: { id, userId: user.id } })
    if (!result.count) return NextResponse.json({ error: 'Passkey not found.' }, { status: 404, headers: noStoreHeaders })
    return NextResponse.json({ success: true }, { headers: noStoreHeaders })
  } catch (error) {
    const status = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message) ? 401 : 503
    return NextResponse.json({ error: status === 401 ? 'Sign in again to manage passkeys.' : 'Passkey could not be removed.' }, { status, headers: noStoreHeaders })
  }
}
