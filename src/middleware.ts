import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { rateLimit } from './lib/rate-limiter'

const indexablePaths = new Set([
  '/',
  '/help',
  '/privacy',
  '/agreement',
  '/truck-fleet-maintenance-software',
  '/tire-inventory-management',
  '/workshop-job-card-software',
])

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rate limiting for auth endpoints
  if (pathname.startsWith('/api/auth/')) {
    const { success } = rateLimit(request, {
      windowMs: 15 * 60 * 1000,
      maxRequests: 50,
    })

    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }
  }

  const response = NextResponse.next()

  // Keep private app screens, authentication flows, and shared records out of search results.
  // Explicitly allow the public marketing, help, and legal pages to be indexed.
  if (
    !indexablePaths.has(pathname) &&
    !pathname.startsWith('/_next/') &&
    !pathname.includes('.')
  ) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  return response
}

export const config = {
  matcher: [
    '/api/auth/:path*',
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
