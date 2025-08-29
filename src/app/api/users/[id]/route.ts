import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { updateUser, resetPassword } from '@/lib/auth'

// GET single user by ID (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdmin(request)

    const user = await db.user.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isApproved: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        maintenanceRecords: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            serviceType: true,
            datePerformed: true,
            totalCost: true,
            status: true
          }
        },
        auditLogs: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            entityType: true,
            createdAt: true
          }
        },
        userActivities: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            action: true,
            entityType: true,
            createdAt: true
          }
        },
        loginHistory: {
          take: 5,
          orderBy: { loginTime: 'desc' },
          select: {
            id: true,
            loginTime: true,
            logoutTime: true,
            ipAddress: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user
    })

  } catch (error) {
    console.error('Error fetching user:', error)
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}

// PUT update user (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdmin(request)

    const body = await request.json()

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent self-deactivation
    if (body.isActive === false && id === (await requireAdmin(request)).id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['ADMIN', 'MANAGER', 'USER']
    if (body.role && !validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    const updatedUser = await updateUser(id, {
      name: body.name,
      role: body.role,
      isActive: body.isActive,
      isApproved: body.isApproved,
      permissions: body.permissions
    })

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully'
    })

  } catch (error) {
    console.error('Error updating user:', error)
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}

// DELETE user (soft delete, admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const adminUser = await requireAdmin(request)

    // Prevent self-deletion
    if (id === adminUser.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Check if user exists
    const user = await db.user.findUnique({
      where: { 
        id: id,
        isDeleted: false 
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Soft delete user
    await db.user.update({
      where: { id: id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: adminUser.id,
        isActive: false
      }
    })

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    })

  } catch (error) {
    console.error('Error deleting user:', error)
    
    if (error instanceof Error && error.message === 'Insufficient permissions') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
}