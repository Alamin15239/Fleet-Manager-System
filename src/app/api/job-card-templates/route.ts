import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET all job card templates
export async function GET(request: NextRequest) {
  try {
    const templates = await db.jobCardTemplate.findMany({
      where: { isActive: true },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: templates
    })

  } catch (error) {
    console.error('Error fetching job card templates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// POST create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // If this is set as default, unset other defaults
    if (body.isDefault) {
      await db.jobCardTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      })
    }

    const template = await db.jobCardTemplate.create({
      data: {
        name: body.name,
        content: body.content,
        isDefault: body.isDefault || false,
        isActive: body.isActive !== false,
        createdById: body.createdById
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: template,
      message: 'Template created successfully'
    })

  } catch (error) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    )
  }
}