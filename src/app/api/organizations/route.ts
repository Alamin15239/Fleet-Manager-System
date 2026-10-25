import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { controlDb } from '@/lib/db'
import { provisionOrganization } from '@/lib/organization-provisioning'

export const maxDuration = 300

const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(48),
  ownerName: z.string().trim().min(1).max(100),
  ownerEmail: z.string().trim().email().max(254)
})

async function requirePrimaryAdministrator(request: NextRequest) {
  const user = await requireAuth(request)
  if (user.role !== 'ADMIN' || !user.isPrimaryOrganization) {
    throw new Error('Primary organization administrator access required')
  }
  return user
}

function accessError(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (message === 'No token provided' || message === 'Invalid token') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }
  if (message === 'Primary organization administrator access required') {
    return NextResponse.json({ error: 'Only an administrator of the original organization can manage organizations' }, { status: 403 })
  }
  return null
}

export async function GET(request: NextRequest) {
  try {
    await requirePrimaryAdministrator(request)
    const organizations = await (controlDb as any).organization.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerName: true,
        ownerEmail: true,
        status: true,
        schemaReady: true,
        failureReason: true,
        isPrimary: true,
        createdAt: true,
        updatedAt: true
      }
    })
    return NextResponse.json({ organizations }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    return accessError(error) || NextResponse.json({ error: 'Unable to load organizations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const creator = await requirePrimaryAdministrator(request)
    const parsed = createOrganizationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Check the organization name, code, and administrator details.' }, { status: 400 })
    }

    const organization = await (controlDb as any).organization.create({
      data: {
        name: parsed.data.name,
        slug: parsed.data.slug,
        ownerName: parsed.data.ownerName || creator.name || parsed.data.ownerEmail,
        ownerEmail: parsed.data.ownerEmail.toLowerCase(),
        status: 'PROVISIONING',
        isPrimary: false
      }
    })

    await provisionOrganization(organization.id)
    return NextResponse.json({
      success: true,
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        ownerEmail: organization.ownerEmail,
        status: 'ACTIVE'
      }
    }, { status: 201, headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
  } catch (error) {
    const denied = accessError(error)
    if (denied) return denied
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'That organization code is already in use.' }, { status: 409 })
    }
    const message = error instanceof Error ? error.message : 'Organization setup failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
