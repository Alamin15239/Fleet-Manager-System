import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    const activeAccounts = await db.user.findMany({
      where: { isActive: true, isDeleted: false },
      select: { isApproved: true, isEmailVerified: true, permissions: true },
    })

    const findings: Array<{ severity: 'high' | 'medium' | 'low'; check: string; count: number; message: string }> = []
    const weakJwtSecret = !process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32
    if (weakJwtSecret) findings.push({ severity: 'high', check: 'JWT_SECRET', count: 1, message: 'JWT_SECRET is missing or shorter than 32 characters.' })

    const unapproved = activeAccounts.filter((account) => !account.isApproved).length
    if (unapproved) findings.push({ severity: 'medium', check: 'Account approval', count: unapproved, message: 'Active accounts are awaiting approval.' })

    const unverified = activeAccounts.filter((account) => !account.isEmailVerified).length
    if (unverified) findings.push({ severity: 'low', check: 'Email verification', count: unverified, message: 'Active accounts have unverified email addresses.' })

    const customPermissionAccounts = activeAccounts.filter((account) => account.permissions !== null).length
    if (customPermissionAccounts) findings.push({ severity: 'low', check: 'Custom permissions', count: customPermissionAccounts, message: 'Accounts have individual permission overrides. Review them periodically.' })

    return NextResponse.json({
      success: true,
      scannedAt: new Date().toISOString(),
      checks: 4,
      issues: findings.length,
      findings,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    console.error('Security posture scan failed:', error)
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Security posture scan failed' },
      { status: unauthorized ? 401 : forbidden ? 403 : 503 },
    )
  }
}
