import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const envCheck = {
      databaseUrl: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      jwtSecret: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
      blobToken: process.env.BLOB_READ_WRITE_TOKEN ? '✅ Set' : '❌ Missing',
      nodeEnv: process.env.NODE_ENV || 'development',
      vercelEnv: process.env.VERCEL_ENV || 'unknown'
    }
    
    // Don't expose sensitive values, just show if they're set
    return NextResponse.json({
      environment: envCheck,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}