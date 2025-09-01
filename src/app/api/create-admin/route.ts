import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export async function POST() {
  try {
    const hashedPassword = await bcrypt.hash('oOck7534#@', 12)
    
    const admin = await db.user.upsert({
      where: { email: 'alamin.kha.saadfreeh@gmail.com' },
      update: {
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true
      },
      create: {
        email: 'alamin.kha.saadfreeh@gmail.com',
        name: 'Alamin Khan',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true
      }
    })
    
    return NextResponse.json({
      success: true,
      message: 'Admin created',
      email: 'alamin.kha.saadfreeh@gmail.com',
      password: 'oOck7534#@'
    })
    
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}