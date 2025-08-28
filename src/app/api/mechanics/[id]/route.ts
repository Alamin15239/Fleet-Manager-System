import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireManager } from '@/lib/auth'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    requireManager(request)
    const body = await request.json()
    const { name, email, phone, specialty, isActive } = body

    // Check if mechanic exists
    const mechanic = await db.mechanic.findUnique({
      where: { id, isDeleted: false }
    })

    if (!mechanic) {
      return NextResponse.json(
        { error: 'Mechanic not found' },
        { status: 404 }
      )
    }

    // Update mechanic
    const updatedMechanic = await db.mechanic.update({
      where: { id },
      data: {
        name: name || mechanic.name,
        email: email !== undefined ? email : mechanic.email,
        phone: phone !== undefined ? phone : mechanic.phone,
        specialty: specialty !== undefined ? specialty : mechanic.specialty,
        isActive: isActive !== undefined ? isActive : mechanic.isActive
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        specialty: true,
        isActive: true
      }
    })

    return NextResponse.json({
      message: 'Mechanic updated successfully',
      data: updatedMechanic
    })
  } catch (error) {
    console.error('Error updating mechanic:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to update mechanic' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    requireManager(request)
    // Check if mechanic exists
    const mechanic = await db.mechanic.findUnique({
      where: { id, isDeleted: false }
    })

    if (!mechanic) {
      return NextResponse.json(
        { error: 'Mechanic not found' },
        { status: 404 }
      )
    }

    // Check if mechanic has maintenance records
    const maintenanceCount = await db.maintenanceRecord.count({
      where: { mechanicId: id }
    })

    if (maintenanceCount > 0) {
      // Instead of blocking deletion, unassign mechanic from maintenance records
      await db.maintenanceRecord.updateMany({
        where: { mechanicId: id },
        data: { mechanicId: null }
      })
    }

    // Soft delete mechanic
    await db.mechanic.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedBy: 'system'
      }
    })

    return NextResponse.json({ message: 'Mechanic moved to trash successfully' })
  } catch (error) {
    console.error('Error deleting mechanic:', error)
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
    }
    return NextResponse.json(
      { error: 'Failed to delete mechanic' },
      { status: 500 }
    )
  }
}