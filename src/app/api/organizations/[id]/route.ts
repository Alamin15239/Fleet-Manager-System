import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { controlDb, decryptOrganizationDatabaseUrl } from '@/lib/db'

const ownerSchema = z.object({
  ownerName: z.string().trim().min(1).max(100),
  ownerEmail: z.string().trim().email().max(254)
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let tenantDb: PrismaClient | null = null
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN' || !user.isPrimaryOrganization) {
      return NextResponse.json({ error: 'Only an administrator of the original organization can manage organizations' }, { status: 403 })
    }

    const { id } = await params
    const parsed = ownerSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter a valid administrator name and email address.' }, { status: 400 })
    }

    const organizationModel = (controlDb as any).organization
    const organization = await organizationModel.findUnique({ where: { id } })
    if (!organization || organization.isPrimary) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    if (organization.status !== 'FAILED' && organization.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Wait for organization setup to finish before changing administrator details.' }, { status: 409 })
    }

    const ownerName = parsed.data.ownerName
    const ownerEmail = parsed.data.ownerEmail.toLowerCase()
    let tenantAdminId: string | null = null

    if (organization.schemaReady && organization.encryptedDatabaseUrl && organization.ownerEmail) {
      tenantDb = new PrismaClient({
        log: ['error'],
        datasources: { db: { url: decryptOrganizationDatabaseUrl(organization.encryptedDatabaseUrl) } }
      })
      const existingOwner = await tenantDb.user.findFirst({
        where: { email: { equals: organization.ownerEmail.trim().toLowerCase(), mode: 'insensitive' } },
        select: { id: true }
      })
      if (existingOwner) tenantAdminId = existingOwner.id
      if (existingOwner && organization.ownerEmail.trim().toLowerCase() !== ownerEmail) {
        const emailInUse = await tenantDb.user.findFirst({
          where: { email: { equals: ownerEmail, mode: 'insensitive' } },
          select: { id: true }
        })
        if (emailInUse && emailInUse.id !== existingOwner.id) {
          return NextResponse.json({ error: 'That email already belongs to another user in this organization.' }, { status: 409 })
        }
      }
    }
    if (organization.status === 'ACTIVE' && (!tenantDb || !tenantAdminId)) {
      return NextResponse.json({ error: 'Could not find the current administrator account in this organization database.' }, { status: 409 })
    }

    const previousOwner = { ownerName: organization.ownerName, ownerEmail: organization.ownerEmail }
    try {
      const updated = await organizationModel.update({
        where: { id },
        data: { ownerName, ownerEmail }
      })
      if (tenantAdminId && tenantDb) {
        const emailChanged = organization.ownerEmail?.trim().toLowerCase() !== ownerEmail
        await tenantDb.user.update({
          where: { id: tenantAdminId },
          data: {
            name: ownerName,
            email: ownerEmail,
            ...(emailChanged ? {
              isEmailVerified: false,
              otpCode: null,
              otpExpires: null,
              lastOtpRequest: null
            } : {})
          }
        })
      }
      return NextResponse.json({
        success: true,
        organization: { id: updated.id, ownerName: updated.ownerName, ownerEmail: updated.ownerEmail }
      }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
    } catch (error) {
      await organizationModel.update({ where: { id }, data: previousOwner }).catch(() => undefined)
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'No token provided' || message === 'Invalid token') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'That email already belongs to another user in this organization.' }, { status: 409 })
    }
    console.error('Failed to update organization administrator:', error)
    return NextResponse.json({ error: 'Could not update the organization administrator details.' }, { status: 500 })
  } finally {
    await tenantDb?.$disconnect().catch(() => undefined)
  }
}
