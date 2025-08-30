import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import jwt from 'jsonwebtoken'

export async function POST(request: NextRequest) {
  try {
    console.log('=== Profile Upload Debug Test ===')
    
    // Test 1: Check JWT_SECRET
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is missing')
      return NextResponse.json({ error: 'JWT_SECRET missing' }, { status: 500 })
    }
    console.log('✓ JWT_SECRET exists')

    // Test 2: Check Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('No valid authorization header')
      return NextResponse.json({ error: 'No token provided' }, { status: 401 })
    }
    console.log('✓ Authorization header present')

    // Test 3: Verify JWT token
    const token = authHeader.substring(7)
    let decoded: any
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET)
      console.log('✓ JWT token verified, user ID:', decoded.id || decoded.userId)
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    const userId = decoded.userId || decoded.id
    if (!userId) {
      console.error('No user ID in token')
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 })
    }

    // Test 4: Check database connection
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true }
      })
      
      if (!user) {
        console.error('User not found in database')
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      console.log('✓ Database connection successful, user found:', user.email)
    } catch (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 })
    }

    // Test 5: Try to update user (simulate profile image update)
    try {
      const testUpdate = await db.user.update({
        where: { id: userId },
        data: { updatedAt: new Date() }, // Just update timestamp
        select: { id: true, email: true, updatedAt: true }
      })
      
      console.log('✓ Database update successful:', testUpdate.updatedAt)
    } catch (updateError) {
      console.error('Database update failed:', updateError)
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'All tests passed',
      userId,
      userEmail: decoded.email
    })

  } catch (error) {
    console.error('Test endpoint error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}