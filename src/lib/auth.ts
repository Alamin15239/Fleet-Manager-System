import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

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
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error) {
    return null
  }
}

export async function authenticateUser(email: string, password: string) {
  try {
    // First, check if user exists at all
    const user = await db.user.findUnique({
      where: { email }
    })

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

    // Try to log login activity, but don't fail if it doesn't work
    try {
      await db.loginHistory.create({
        data: {
          userId: user.id,
          loginTime: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0'
        }
      })
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

  // Check if user still exists and is active (only check active status, not approval)
  const user = await db.user.findUnique({
    where: { 
      id: decoded.id,
      isActive: true,
      isDeleted: false
    }
  })

  if (!user) {
    throw new Error('User not found or inactive')
  }

  return decoded
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
}) {
  try {
    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: userData.email }
    })

    if (existingUser) {
      throw new Error('User already exists')
    }

    // Hash password
    const hashedPassword = await hashPassword(userData.password)

    // Create user
    const user = await db.user.create({
      data: {
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        role: (userData.role as any) || 'USER',
        permissions: userData.permissions || {},
        isActive: true,
        isApproved: false, // All new users require admin approval
        isEmailVerified: false // Email verification required
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
        createdAt: true
      }
    })

    return user
  } catch (error) {
    throw error
  }
}

export async function updateUser(userId: string, updateData: {
  name?: string
  role?: string
  isActive?: boolean
  isApproved?: boolean
  permissions?: any
}) {
  try {
    const user = await db.user.update({
      where: { id: userId },
      data: updateData as any,
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
    const tempPassword = Math.random().toString(36).slice(-8)
    const hashedPassword = await hashPassword(tempPassword)

    // Update password
    await db.user.update({
      where: { id: user.id },
      data: { 
        password: hashedPassword,
        isActive: true // Ensure user is active
      }
    })

    // In a real app, send email with temporary password
    console.log(`Temporary password for ${email}: ${tempPassword}`)

    return { 
      success: true, 
      message: 'Password reset successful',
      tempPassword // Only for development, remove in production
    }
  } catch (error) {
    throw error
  }
}