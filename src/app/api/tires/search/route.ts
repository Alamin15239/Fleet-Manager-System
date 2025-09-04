import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const plateNumber = searchParams.get('plateNumber')
    const trailerNumber = searchParams.get('trailerNumber')
    const driverName = searchParams.get('driverName')
    const tireSize = searchParams.get('tireSize')
    const manufacturer = searchParams.get('manufacturer')

    const where: any = {}

    if (plateNumber) {
      where.plateNumber = {
        contains: plateNumber,
        mode: 'insensitive'
      }
    }

    if (trailerNumber) {
      where.trailerNumber = {
        contains: trailerNumber,
        mode: 'insensitive'
      }
    }

    if (driverName) {
      where.driverName = {
        contains: driverName,
        mode: 'insensitive'
      }
    }

    if (tireSize) {
      where.tireSize = {
        contains: tireSize,
        mode: 'insensitive'
      }
    }

    if (manufacturer) {
      where.manufacturer = {
        contains: manufacturer,
        mode: 'insensitive'
      }
    }

    const tires = await prisma.tire.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: 20
    })

    return NextResponse.json({ tires })
  } catch (error) {
    console.error('Error searching tires:', error)
    return NextResponse.json(
      { error: 'Failed to search tires' },
      { status: 500 }
    )
  }
}