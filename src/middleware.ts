import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit } from './lib/rate-limiter'

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

  // Keep internal app screens, authentication pages, and shared records out of search results.
  // The public marketing, help, and legal pages remain crawlable.
  const indexablePaths = new Set(['/', '/help', '/privacy', '/agreement', '/purchase'])
  const response = NextResponse.next()

  if (
    !indexablePaths.has(pathname) &&
    !pathname.startsWith('/_next/') &&
    !pathname.includes('.')
  ) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  // Authentication stays client-side to preserve the current sign-in flow.
  return response
}

export const config = {
  matcher: [
    '/api/auth/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
}
