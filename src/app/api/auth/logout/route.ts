import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await requireAuth(request)

    // Update login history
    try {
      await prisma.loginHistory.updateMany({
        where: {
          userId: user.id,
          isActive: true
        },
        data: {
          logoutTime: new Date(),
          isActive: false,
          sessionDuration: Math.floor((Date.now() - new Date().getTime()) / 1000) // This would need actual login time
        }
      })
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