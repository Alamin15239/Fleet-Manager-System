import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Sample maintenance data is disabled to protect production records.' },
    { status: 410 }
  )
}
