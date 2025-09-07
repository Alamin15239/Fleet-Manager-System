import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { verifyToken } from '@/lib/auth'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const templates = await prisma.jobCardTemplate.findMany({
      where: { isActive: true },
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({ success: true, data: templates })
  } catch (error) {
    console.error('Error fetching job card templates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyToken(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin permissions
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, layout, isDefault } = body

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.jobCardTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    const template = await prisma.jobCardTemplate.create({
      data: {
        name,
        description,
        layout,
        isDefault: isDefault || false
      }
    })

    return NextResponse.json({ success: true, data: template }, { status: 201 })
  } catch (error) {
    console.error('Error creating job card template:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}