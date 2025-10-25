import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit } from './lib/rate-limiter'

const publicRoutes = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/verify-otp']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Rate limiting for auth endpoints
  if (pathname.startsWith('/api/auth/')) {
    const { success } = rateLimit(request, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 50,
    });
    
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }
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