import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...')
    
    // Test basic database connection
    const userCount = await db.user.count()
    console.log('User count:', userCount)
    
    // Test if we can fetch users
    const users = await db.user.findMany({
      take: 1,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isDeleted: true,
        createdAt: true
      }
    })
    console.log('Sample user:', users[0])
    
    return NextResponse.json({
      success: true,
      userCount,
      sampleUser: users[0] || null,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Database test failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : null,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}