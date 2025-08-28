import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    console.log('Database health check started...')
    
    // Test basic database connection
    const result = await db.$queryRaw`SELECT 1 as test`
    console.log('Database connection successful:', result)
    
    // Test if we can query the users table
    const userCount = await db.user.count()
    console.log('User count:', userCount)
    
    // Test if we can query the settings table
    const settingsCount = await db.settings.count()
    console.log('Settings count:', settingsCount)
    
    // Check environment variables
    const envCheck = {
      databaseUrl: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      jwtSecret: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
      nodeEnv: process.env.NODE_ENV || 'development'
    }
    
    console.log('Environment check:', envCheck)
    
    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      userCount,
      settingsCount,
      environment: envCheck,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database health check failed:', error)
    return NextResponse.json({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}