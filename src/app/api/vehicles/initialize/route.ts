import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Vehicle data mapping
const vehicleData = [
  { driverName: 'Shahadat', plateNumber: '2721 BRA', trailerNumber: '705' },
  { driverName: 'Parbej', plateNumber: '1848 TRA', trailerNumber: '409' },
  { driverName: 'Omprakash', plateNumber: '2377 HDA', trailerNumber: '504' },
  { driverName: 'J Yadav', plateNumber: '2759 KDA', trailerNumber: '905' },
  { driverName: 'C Yadav', plateNumber: '5096 TXA', trailerNumber: '904' },
  { driverName: 'Kamal', plateNumber: '1297 USA', trailerNumber: '909' },
  { driverName: 'Ziaf', plateNumber: '3391 NDA', trailerNumber: '910' },
  { driverName: 'Alamgir', plateNumber: '1298 USA', trailerNumber: '503' },
  { driverName: 'Numan', plateNumber: '2019 VRA', trailerNumber: '907' },
  { driverName: 'Irkan', plateNumber: '9770 XDA', trailerNumber: '505' },
  { driverName: 'Ameer Pasha', plateNumber: '1337 BAA', trailerNumber: '706' },
  { driverName: 'Amir', plateNumber: '1341 BAA', trailerNumber: '701' },
  { driverName: 'Asif', plateNumber: '2831 KDA', trailerNumber: null },
  { driverName: 'Kumar', plateNumber: '9791 XDA', trailerNumber: '508' },
  { driverName: 'Khalid', plateNumber: '2017 VRA', trailerNumber: '913' },
  { driverName: 'Monoj', plateNumber: '1556 RRA', trailerNumber: '903' },
  { driverName: 'NA', plateNumber: '9508 EDA', trailerNumber: '704' },
  { driverName: 'Dawood', plateNumber: '2018 VRA', trailerNumber: null },
  { driverName: 'Khurram', plateNumber: '2378 HDA', trailerNumber: '806' },
  { driverName: 'Jabbar', plateNumber: '3392 NDA', trailerNumber: '412' },
  { driverName: 'Suraj', plateNumber: '3765 EDA', trailerNumber: '408' },
  { driverName: 'Jahoor', plateNumber: '3766 EDA', trailerNumber: '908' },
  { driverName: 'Dawood', plateNumber: '7059 ARA', trailerNumber: '506' },
  { driverName: 'Minto', plateNumber: '7163 ZSA', trailerNumber: 'Lowbed Sata' },
  { driverName: 'Sameer', plateNumber: '8131 TXA', trailerNumber: '912' },
  { driverName: 'Babu', plateNumber: '8132 TXA', trailerNumber: 'Long Sata' },
  { driverName: 'Sageer', plateNumber: '8129 TXA', trailerNumber: '802' },
  { driverName: 'Anoun Abbas', plateNumber: '4905 XRA', trailerNumber: '901' },
  { driverName: 'Shiva', plateNumber: '5165 TXA', trailerNumber: '502' },
  { driverName: 'Fakhar', plateNumber: '9149 KXA', trailerNumber: '805' },
  { driverName: 'Sadaqat', plateNumber: '3390 NDA', trailerNumber: '411' },
  { driverName: 'Hamid', plateNumber: '7156 KXA', trailerNumber: '413' },
  { driverName: 'Basith', plateNumber: '6918 TDA', trailerNumber: '951' },
  { driverName: 'Jawad', plateNumber: '1330 BAA', trailerNumber: '507' },
  { driverName: 'Azad', plateNumber: '8482 ZSA', trailerNumber: null },
  { driverName: 'Abubokor', plateNumber: '4971 BRA', trailerNumber: null },
  { driverName: 'Rashid', plateNumber: '8852 LSA', trailerNumber: null },
  { driverName: 'Usman', plateNumber: '8851 LSA', trailerNumber: null },
  { driverName: 'Showkot', plateNumber: '5552 LXA', trailerNumber: null },
  { driverName: 'Riaz', plateNumber: '5553 LXA', trailerNumber: null },
  { driverName: 'Nadeem', plateNumber: '5554 LXA', trailerNumber: null }
]

// POST /api/vehicles/initialize - Initialize vehicle data
export async function POST(request: NextRequest) {
  try {
    // Check if vehicles already exist
    const existingCount = await db.vehicle.count()
    
    if (existingCount > 0) {
      return NextResponse.json({ 
        message: 'Vehicles already initialized',
        count: existingCount 
      })
    }

    // Create all vehicles
    const vehicles = await Promise.all(
      vehicleData.map(data =>
        db.vehicle.create({
          data: {
            plateNumber: data.plateNumber,
            trailerNumber: data.trailerNumber,
            driverName: data.driverName
          }
        })
      )
    )

    return NextResponse.json({ 
      message: 'Successfully initialized vehicle data',
      count: vehicles.length,
      vehicles 
    })
  } catch (error) {
    console.error('Error initializing vehicles:', error)
    return NextResponse.json(
      { error: 'Failed to initialize vehicles' },
      { status: 500 }
    )
  }
}

// GET /api/vehicles/initialize - Check initialization status
export async function GET() {
  try {
    const count = await db.vehicle.count()
    const vehicles = await db.vehicle.findMany({
      select: {
        plateNumber: true,
        trailerNumber: true,
        driverName: true
      },
      orderBy: { plateNumber: 'asc' }
    })

    return NextResponse.json({
      initialized: count > 0,
      count,
      vehicles
    })
  } catch (error) {
    console.error('Error checking vehicle initialization:', error)
    return NextResponse.json(
      { error: 'Failed to check vehicle initialization' },
      { status: 500 }
    )
  }
}