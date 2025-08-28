import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const result = await authenticateUser(email, password)

    // Create response with token in cookie
    const response = NextResponse.json({
      success: true,
      user: result.user,
      token: result.token,
      message: 'Login successful'
    })

    // Set HTTP-only cookie with token
    response.cookies.set('auth-token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    return response

  } catch (error) {
    console.error('Login error:', error)
    
    let errorMessage = 'Login failed'
    let statusCode = 500

    if (error instanceof Error) {
      if (error.message === 'Invalid credentials') {
        errorMessage = 'Invalid email or password'
        statusCode = 401
      } else if (error.message === 'Please verify your email address before logging in') {
        errorMessage = 'Please verify your email address before logging in'
        statusCode = 403
      } else if (error.message === 'Your account is pending admin approval') {
        errorMessage = 'Your account is pending admin approval'
        statusCode = 403
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    )
  }
}