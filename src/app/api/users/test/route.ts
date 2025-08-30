import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    // Simple test query
    const users = await db.user.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true
      },
      take: 5
    })

    return NextResponse.json({
      success: true,
      count: users.length,
      users
    })

  } catch (error) {
    console.error('Database test error:', error)
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Database error',
      details: error
    }, { status: 500 })
  }
}