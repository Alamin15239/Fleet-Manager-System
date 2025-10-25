import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rate limiting store
const rateLimit = new Map()

// Public routes that don't require authentication
const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/verify-otp']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Rate limiting for auth endpoints
  if (pathname.startsWith('/api/auth/')) {
    const ip = request.ip || 'anonymous'
    const now = Date.now()
    const windowMs = 15 * 60 * 1000 // 15 minutes
    const maxRequests = 50 // Increased for production

    const key = `${ip}:${pathname}`
    const requests = rateLimit.get(key) || []
    
    // Clean old requests
    const validRequests = requests.filter((time: number) => now - time < windowMs)
    
    if (validRequests.length >= maxRequests) {
      return new NextResponse('Too many requests', { status: 429 })
    }
    
    validRequests.push(now)
    rateLimit.set(key, validRequests)
  }

  // Skip auth check for public routes, API routes, and static files
  if (
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.') // Static files
  ) {
    return NextResponse.next()
  }

  // For protected routes, let the client-side handle authentication
  // This prevents server-side redirects that can interfere with navigation
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/api/auth/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}