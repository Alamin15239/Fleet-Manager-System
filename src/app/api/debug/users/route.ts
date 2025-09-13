import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const allUsers = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    })

    const mechanics = allUsers.filter(u => u.role === 'MECHANIC')

    return NextResponse.json({
      totalUsers: allUsers.length,
      mechanics: mechanics.length,
      allUsers,
      mechanicUsers: mechanics
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Create sample mechanics
    const mechanicNames = ['Farhan', 'Sakeer', 'Usman', 'Zamdad', 'Azhar']
    
    for (const name of mechanicNames) {
      await db.user.upsert({
        where: { email: `${name.toLowerCase()}@fleetmanager.space` },
        update: { role: 'MECHANIC' },
        create: {
          name,
          email: `${name.toLowerCase()}@fleetmanager.space`,
          role: 'MECHANIC',
          isActive: true,
          isApproved: true,
          isEmailVerified: true
        }
      })
    }

    return NextResponse.json({ message: 'Mechanics created successfully' })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}