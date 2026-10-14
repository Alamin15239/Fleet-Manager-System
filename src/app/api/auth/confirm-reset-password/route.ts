import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'This reset endpoint has been retired. Request a reset at /api/auth/forgot-password.' },
    { status: 410 }
  )
}
