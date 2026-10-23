import { NextRequest, NextResponse } from 'next/server'
import { generateToken, verifyToken } from '@/lib/auth'
import { db, findOrganizationById, getPrimaryOrganization, withOrganization } from '@/lib/db'

export const runtime = 'nodejs'

const privateNoStore = { 'Cache-Control': 'private, no-store, max-age=0' }

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get('auth-token')?.value
  const decoded = sessionCookie ? verifyToken(sessionCookie) : null
  if (!decoded) {
    return NextResponse.json({ error: 'Google sign-in session is missing or expired.' }, { status: 401, headers: privateNoStore })
  }

  try {
    const organization = decoded.organizationId
      ? await findOrganizationById(decoded.organizationId)
      : await getPrimaryOrganization()
    const user = await withOrganization(organization, () => db.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        isEmailVerified: true,
        isDeleted: true,
        permissions: true,
        profileImage: true,
        phone: true,
        department: true,
        title: true,
        bio: true,
        createdAt: true,
        updatedAt: true,
      },
    }))

    if (!user || user.isDeleted || !user.isActive || !user.isApproved || !user.isEmailVerified) {
      const response = NextResponse.json({ error: 'This account is not approved to sign in.' }, { status: 403, headers: privateNoStore })
      response.cookies.set('auth-token', '', { httpOnly: true, maxAge: 0, path: '/' })
      return response
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      role: user.role,
      isActive: user.isActive,
      isApproved: user.isApproved,
      isEmailVerified: user.isEmailVerified,
      permissions: user.permissions,
      organizationId: organization.id,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      isPrimaryOrganization: organization.isPrimary,
    })

    return NextResponse.json({
      token,
      user: {
        ...user,
        organizationId: organization.id,
        organizationSlug: organization.slug,
        organizationName: organization.name,
        isPrimaryOrganization: organization.isPrimary,
      },
    }, { headers: privateNoStore })
  } catch (error) {
    console.error('Could not complete Google sign-in session')
    const response = NextResponse.json({ error: 'Could not complete Google sign-in.' }, { status: 503, headers: privateNoStore })
    response.cookies.set('auth-token', '', { httpOnly: true, maxAge: 0, path: '/' })
    return response
  }
}
