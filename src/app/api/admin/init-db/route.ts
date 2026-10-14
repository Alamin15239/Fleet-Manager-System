import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
    // Test database connection
    await db.$queryRaw`SELECT 1`
    
    // Check if admin user exists
    const adminExists = await db.user.findFirst({
      where: { role: 'ADMIN' }
    })
    
    if (!adminExists) {
      return NextResponse.json({ error: 'No administrator exists. Run the trusted database setup process.' }, { status: 409 })
    }
    
    // Initialize settings if not exists
    const settingsExists = await db.settings.findFirst()
    if (!settingsExists) {
      await db.settings.create({
        data: {
          currencySymbol: '﷼',
          currencyCode: 'SAR',
          currencyName: 'Saudi Riyal',
          companyName: 'Fleet Manager System'
        }
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Database initialized successfully',
      adminExists: !!adminExists,
      settingsExists: !!settingsExists
    })
    
  } catch (error) {
    console.error('Database initialization failed:', error)
    return NextResponse.json(
      { 
        error: 'Database initialization failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}
