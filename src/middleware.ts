import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rate limiting store
const rateLimit = new Map()

export function middleware(request: NextRequest) {
  // Rate limiting for auth endpoints
  if (request.nextUrl.pathname.startsWith('/api/auth/')) {
    const ip = request.ip || 'anonymous'
    const now = Date.now()
    const windowMs = 15 * 60 * 1000 // 15 minutes
    const maxRequests = 10

    const key = `${ip}:${request.nextUrl.pathname}`
    const requests = rateLimit.get(key) || []
    
    // Clean old requests
    const validRequests = requests.filter((time: number) => now - time < windowMs)
    
    if (validRequests.length >= maxRequests) {
      return new NextResponse('Too many requests', { status: 429 })
    }
    
    validRequests.push(now)
    rateLimit.set(key, validRequests)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/auth/:path*']
}