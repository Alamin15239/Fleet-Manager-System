import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { PrismaClient } from '@prisma/client'
import { requireAuth } from '@/lib/auth'
import { controlDb, decryptOrganizationDatabaseUrl } from '@/lib/db'
import { deletePrismaOrganizationDatabase } from '@/lib/organization-provisioning'

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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request)
    if (user.role !== 'ADMIN' || !user.isPrimaryOrganization) {
      return NextResponse.json({ error: 'Only an administrator of the original organization can delete organizations' }, { status: 403 })
    }

    const { id } = await params
    if (id === user.organizationId) {
      return NextResponse.json({ error: 'The original Fleet Manager organization and database cannot be deleted.' }, { status: 409 })
    }

    const organizationModel = (controlDb as any).organization
    const organization = await organizationModel.findUnique({
      where: { id },
      select: {
        id: true,
        isPrimary: true,
        status: true,
        schemaReady: true,
        databaseProvider: true,
        neonProjectId: true,
        prismaDatabaseId: true,
        encryptedDatabaseUrl: true
      }
    })

    // This check runs before any Neon API call. The original fleet database is
    // never eligible for deletion.
    if (!organization || organization.isPrimary) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }
    if (organization.status === 'PROVISIONING') {
      return NextResponse.json({ error: 'Wait for organization setup to finish before deleting it.' }, { status: 409 })
    }

    const provider = organization.databaseProvider || 'NEON'
    if (provider === 'PRISMA') {
      if (!organization.prismaDatabaseId && (organization.schemaReady || organization.encryptedDatabaseUrl)) {
        return NextResponse.json({
          error: 'This organization has database details but no Prisma database ID. Restore its database ID before deleting it.'
        }, { status: 409 })
      }
      if (organization.prismaDatabaseId) {
        try {
          await deletePrismaOrganizationDatabase(organization.prismaDatabaseId)
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          return NextResponse.json({
            error: message || 'Prisma did not confirm deletion of this organization database. The organization remains listed.'
          }, { status: 502 })
        }
      }
    } else if (provider === 'NEON') {
      // Do not orphan a tenant database if its Neon project ID is missing.
      if (!organization.neonProjectId && (organization.schemaReady || organization.encryptedDatabaseUrl)) {
        return NextResponse.json({
          error: 'This organization has database details but no Neon project ID. Restore its project ID before deleting it.'
        }, { status: 409 })
      }

      if (organization.neonProjectId) {
        const apiKey = process.env.NEON_API_KEY
        if (!apiKey) {
          return NextResponse.json({ error: 'Neon project deletion is not configured. Set NEON_API_KEY and try again.' }, { status: 503 })
        }

        const neonResponse = await fetch(
          `https://console.neon.tech/api/v2/projects/${encodeURIComponent(organization.neonProjectId)}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
            cache: 'no-store'
          }
        )

        // Keep the organization record unless Neon confirms deletion. This avoids
        // losing the project ID when a key or account mismatch causes a 404.
        if (!neonResponse.ok) {
          return NextResponse.json({
            error: `Neon did not confirm deletion of this organization's database (HTTP ${neonResponse.status}). The organization remains listed. Verify NEON_API_KEY and project access.`
          }, { status: 502 })
        }
      }
    } else {
      return NextResponse.json({ error: 'This organization has an unsupported database provider. The organization was not deleted.' }, { status: 409 })
    }

    await organizationModel.delete({ where: { id: organization.id } })
    return NextResponse.json({ success: true, deletedOrganizationId: organization.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message === 'No token provided' || message === 'Invalid token') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    console.error('Failed to delete organization:', error)
    return NextResponse.json({ error: 'Could not delete the organization and its database.' }, { status: 500 })
  }
}
