import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'This destructive user cleanup endpoint has been disabled.' },
    { status: 410 }
  )
}
