import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await requireAuth(request)

    // Close active sessions and calculate their actual duration.
    try {
      const activeSessions = await db.loginHistory.findMany({
        where: {
          userId: user.id,
          isActive: true
        }
      })
      const logoutTime = new Date()
      await Promise.all(activeSessions.map(session => db.loginHistory.update({
        where: { id: session.id },
        data: {
          logoutTime,
          isActive: false,
          sessionDuration: Math.max(0, Math.floor((logoutTime.getTime() - session.loginTime.getTime()) / 1000))
        }
      })))
    } catch (error) {
      console.error('Error updating login history:', error)
      // Don't fail the logout if this fails
    }

    // Create response and clear cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful'
    })

    response.cookies.delete('auth-token')

    return response

  } catch (error) {
    console.error('Logout error:', error)
    
    // Even if auth fails, clear the cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful'
    })

    response.cookies.delete('auth-token')

    return response
  }
}
