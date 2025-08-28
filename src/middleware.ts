import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Store active sessions in memory (in production, use Redis or similar)
const activeSessions = new Map<string, { userId: string; loginHistoryId: string }>();

export async function middleware(request: NextRequest) {
  // Allow all requests to pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
  ],
};