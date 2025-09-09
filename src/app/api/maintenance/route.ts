import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // Return sample maintenance data since table doesn't exist
  const sampleRecords = [
    {
      id: '1',
      serviceType: 'Oil Change',
      description: 'Regular oil change service',
      datePerformed: '2024-01-15',
      partsCost: 45,
      laborCost: 80,
      totalCost: 125,
      status: 'COMPLETED',
      truck: {
        id: '1',
        make: 'Mercedes',
        model: 'Actros',
        year: 2020,
        licensePlate: '1234 ABC',
        currentMileage: 150000
      }
    },
    {
      id: '2',
      serviceType: 'Brake Service',
      description: 'Brake pad replacement',
      datePerformed: '2024-01-10',
      partsCost: 200,
      laborCost: 150,
      totalCost: 350,
      status: 'COMPLETED',
      truck: {
        id: '2',
        make: 'Volvo',
        model: 'FH16',
        year: 2019,
        licensePlate: '5678 XYZ',
        currentMileage: 200000
      }
    }
  ]

  return NextResponse.json({
    success: true,
    records: sampleRecords,
    pagination: { page: 1, limit: 100, total: sampleRecords.length, pages: 1 },
    summary: {
      totalCost: sampleRecords.reduce((sum, r) => sum + r.totalCost, 0),
      completedCount: sampleRecords.filter(r => r.status === 'COMPLETED').length,
      inProgressCount: 0,
      scheduledCount: 0
    }
  })
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Maintenance feature requires database setup. Please run database migrations first.' 
  }, { status: 400 })
}