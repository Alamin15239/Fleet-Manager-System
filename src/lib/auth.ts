import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { logUserLogin } from '@/lib/activity-tracking'
import { NextRequest } from 'next/server'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required')
}

export interface JWTPayload {
  id: string
  email: string
  name?: string
  role: string
  isActive: boolean
  isApproved: boolean
  isEmailVerified?: boolean
  permissions?: any
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload & { userId?: string }
    const id = decoded.id || decoded.userId
    if (!id) return null
    return { ...decoded, id }
  } catch (error) {
    return null
  }
}

export async function authenticateUser(email: string, password: string, request?: NextRequest) {
  try {
    // First, check if user exists at all
    const user = await Promise.race([
      db.user.findFirst({
        where: { email: { equals: email.trim(), mode: 'insensitive' } }
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 8000)
      )
    ]) as any

    if (!user) {
      throw new Error('Invalid credentials')
    }

    // Check if user is deleted
    if (user.isDeleted) {
      throw new Error('Account has been deleted')
    }

    // Check if user is disabled by admin
    if (!user.isActive) {
      throw new Error('Account has been disabled by administrator')
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      throw new Error('Please verify your email address before logging in')
    }

    // Check if user is approved by admin
    if (!user.isApproved) {
      throw new Error('Your account is pending admin approval')
    }

    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    // Keep the admin activity and session views backed by real login events.
    try {
      if (request) {
        await logUserLogin(user.id, request)
      }
    } catch (logError) {
      console.warn('Failed to log login activity:', logError)
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      isApproved: user.isApproved,
      isEmailVerified: user.isEmailVerified,
      permissions: user.permissions
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        isApproved: user.isApproved,
        isEmailVerified: user.isEmailVerified,
        profileImage: user.profileImage,
        permissions: user.permissions
      },
      token
    }
  } catch (error) {
    throw error
  }
}

export async function requireAuth(request: Request): Promise<JWTPayload> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('No token provided')
  }

  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  
  if (!decoded) {
    throw new Error('Invalid token')
  }

  // Re-check the account on each API request so role changes and disabled
  // accounts take effect immediately, and normalize OTP login tokens.
  const user = await db.user.findUnique({
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
      permissions: true
    }
  })

  if (!user || user.isDeleted || !user.isActive || !user.isApproved || !user.isEmailVerified) {
    throw new Error('Invalid token')
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name || undefined,
    role: user.role,
    isActive: user.isActive,
    isApproved: user.isApproved,
    isEmailVerified: user.isEmailVerified,
    permissions: user.permissions
  }
}

export async function requireRole(request: Request, requiredRoles: string[]): Promise<JWTPayload> {
  const decoded = await requireAuth(request)
  
  if (!requiredRoles.includes(decoded.role)) {
    throw new Error('Insufficient permissions')
  }

  return decoded
}

export async function requireAdmin(request: Request): Promise<JWTPayload> {
  return await requireRole(request, ['ADMIN'])
}

export async function requireManager(request: Request): Promise<JWTPayload> {
  return await requireRole(request, ['ADMIN', 'MANAGER'])
}

export function hasPermission(user: JWTPayload, permission: string): boolean {
  if (user.role === 'ADMIN') {
    return true
  }

  if (user.permissions && typeof user.permissions === 'object') {
    return user.permissions[permission] === true
  }

  return false
}

export async function createUser(userData: {
  email: string
  password: string
  name?: string
  role?: string
  permissions?: any
  isActive?: boolean
  /** Accounts created by an authorized user manager are ready to sign in. */
  isApproved?: boolean
  isEmailVerified?: boolean
  /** Reuse a soft-deleted account when an administrator adds that email again. */
  restoreDeleted?: boolean
}) {
  try {
    const email = userData.email.trim()

    // Check if user already exists
    const existingUser = await db.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    })

    if (existingUser) {
      if (existingUser.isDeleted && userData.restoreDeleted) {
        const hashedPassword = await hashPassword(userData.password)
        return db.user.update({
          where: { id: existingUser.id },
          data: {
            email,
            password: hashedPassword,
            name: userData.name,
            role: (userData.role as any) || 'USER',
            permissions: userData.permissions || {},
            isActive: userData.isActive ?? true,
            isApproved: userData.isApproved ?? false,
            isEmailVerified: userData.isEmailVerified ?? false,
            isDeleted: false,
            deletedAt: null,
            deletedBy: null
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            isApproved: true,
            isEmailVerified: true,
            permissions: true,
            createdAt: true,
            updatedAt: true
          }
        })
      }
      throw new Error('User already exists')
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password)

    // Create user
    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name: userData.name,
        role: (userData.role as any) || 'USER',
        permissions: userData.permissions || {},
        isActive: userData.isActive ?? true,
        isApproved: userData.isApproved ?? false,
        isEmailVerified: userData.isEmailVerified ?? false
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        isEmailVerified: true,
        permissions: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return user
  } catch (error) {
    throw error
  }
}

export async function updateUser(userId: string, updateData: {
  email?: string
  name?: string
  role?: string
  isActive?: boolean
  isApproved?: boolean
  permissions?: any
  password?: string
}) {
  try {
    const { password, ...userFields } = updateData
    const data: Record<string, unknown> = { ...userFields }
    if (password) {
      data.password = await hashPassword(password)
    }

    const user = await db.user.update({
      where: { id: userId },
      data: data as any,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        permissions: true,
        updatedAt: true
      }
    })

    return user
  } catch (error) {
    throw error
  }
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  try {
    // Get user with password
    const user = await db.user.findUnique({
      where: { id: userId, isActive: true, isDeleted: false },
      select: { password: true }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Verify current password
    const isValidPassword = await verifyPassword(currentPassword, user.password)
    if (!isValidPassword) {
      throw new Error('Current password is incorrect')
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword)

    // Update password
    await db.user.update({
      where: { id: userId },
      data: { password: hashedPassword }
    })

    return { success: true, message: 'Password changed successfully' }
  } catch (error) {
    throw error
  }
}

export async function resetPassword(email: string) {
  try {
    const user = await db.user.findUnique({
      where: { 
        email,
        isActive: true,
        isDeleted: false 
      }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // Generate temporary password
    const { randomBytes } = await import('crypto')
    const tempPassword = randomBytes(18).toString('base64url')
    const hashedPassword = await hashPassword(tempPassword)

    // Update password
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    })

    return { 
      success: true, 
      message: 'Password reset successful',
      tempPassword // Only for development, remove in production
    }
  } catch (error) {
    throw error
  }
}

// Simple auth function for API routes
export async function auth(request?: Request): Promise<JWTPayload | null> {
  if (request) {
    try {
      return await requireAuth(request);
    } catch {
      return null;
    }
  }
  return null
}
