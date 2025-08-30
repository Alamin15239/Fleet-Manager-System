import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Test database connection
    await db.$queryRaw`SELECT 1`
    
    // Check if admin user exists
    const adminExists = await db.user.findFirst({
      where: { role: 'ADMIN' }
    })
    
    if (!adminExists) {
      // Create default admin user
      const hashedPassword = await hashPassword('admin123')
      
      await db.user.create({
        data: {
          email: 'admin@fleetmanager.com',
          password: hashedPassword,
          name: 'System Administrator',
          role: 'ADMIN',
          isActive: true,
          isApproved: true,
          isEmailVerified: true,
          permissions: {}
        }
      })
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