import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function POST() {
  try {
    // Delete all users except the main admin
    await db.user.deleteMany({
      where: {
        email: {
          not: 'alamin.kha.saadfreeh@gmail.com'
        }
      }
    })
    
    // Ensure main admin exists with correct settings
    const hashedPassword = await hashPassword('oOck7534#@')
    
    await db.user.upsert({
      where: { email: 'alamin.kha.saadfreeh@gmail.com' },
      update: {
        password: hashedPassword,
        name: 'Alamin Admin',
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true,
        isDeleted: false
      },
      create: {
        email: 'alamin.kha.saadfreeh@gmail.com',
        name: 'Alamin Admin',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true,
        isDeleted: false
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Users cleaned up successfully'
    })
    
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}