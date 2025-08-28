import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface VehicleData {
  plateNumber: string
  trailerNumber?: string | null
  driverName?: string | null
  isActive?: boolean
}

const vehicleData: VehicleData[] = [
  // Main vehicles with drivers
  { plateNumber: '2721 BRA', trailerNumber: '705', driverName: 'shahadat' },
  { plateNumber: '1848 TRA', trailerNumber: '409', driverName: 'Parbej' },
  { plateNumber: '2377 HDA', trailerNumber: '504', driverName: 'omprakash' },
  { plateNumber: '2759 KDA', trailerNumber: '905', driverName: 'J yadav' },
  { plateNumber: '5096 TXA', trailerNumber: '904', driverName: 'C yadav' },
  { plateNumber: '1297 USA', trailerNumber: '909', driverName: 'Kamal' },
  { plateNumber: '3391 NDA', trailerNumber: '910', driverName: 'Ziaf' },
  { plateNumber: '1298 USA', trailerNumber: '503', driverName: 'Alamgir' },
  { plateNumber: '2019 VRA', trailerNumber: '907', driverName: 'Numan' },
  { plateNumber: '9770 XDA', trailerNumber: '505', driverName: 'Irkan' },
  { plateNumber: '1337 BAA', trailerNumber: '706', driverName: 'Ameer pasha' },
  { plateNumber: '1341 BAA', trailerNumber: '701', driverName: 'amir' },
  { plateNumber: '2831 KDA', trailerNumber: null, driverName: 'asif' },
  { plateNumber: '9791 XDA', trailerNumber: '508', driverName: 'Kumar' },
  { plateNumber: '2017 VRA', trailerNumber: '913', driverName: 'Khalid' },
  { plateNumber: '1556 RRA', trailerNumber: '903', driverName: 'Monoj' },
  { plateNumber: '9508 EDA', trailerNumber: '704', driverName: 'NA' },
  { plateNumber: '2018 VRA', trailerNumber: null, driverName: 'dawood' },
  { plateNumber: '2378 HDA', trailerNumber: '806', driverName: 'Khurram' },
  { plateNumber: '3392 NDA', trailerNumber: '412', driverName: 'jabbar' },
  { plateNumber: '3765 EDA', trailerNumber: '408', driverName: 'Suraj' },
  { plateNumber: '3766 EDA', trailerNumber: '410', driverName: 'Jahoor' },
  { plateNumber: '7059 ARA', trailerNumber: '506', driverName: 'dawood' },
  { plateNumber: '7163 ZSA', trailerNumber: 'Lowbed saatah', driverName: 'Minto' },
  { plateNumber: '8131 TXA', trailerNumber: '912', driverName: 'Sameer' },
  { plateNumber: '8132 TXA', trailerNumber: 'long sata', driverName: 'babu' },
  { plateNumber: '8129 TXA', trailerNumber: '802', driverName: 'Sageer' },
  { plateNumber: '4905 XRA', trailerNumber: '901', driverName: 'Anoun abbas' },
  { plateNumber: '5165 TXA', trailerNumber: '502', driverName: 'Shiva' },
  { plateNumber: '9149 KXA', trailerNumber: '805', driverName: 'Fakhar' },
  { plateNumber: '3390 NDA', trailerNumber: '411', driverName: 'Sadaqat' },
  { plateNumber: '7156 KXA', trailerNumber: '413', driverName: 'Hamid' },
  { plateNumber: '6918 TDA', trailerNumber: '951', driverName: 'Basith' },
  { plateNumber: '1330 BAA', trailerNumber: '507', driverName: 'Jawad' },
  
  // Special vehicles
  { plateNumber: '400 for sold', trailerNumber: null, driverName: null, isActive: false },
  { plateNumber: '911', trailerNumber: null, driverName: null },
  { plateNumber: '501', trailerNumber: null, driverName: null },
  { plateNumber: '707', trailerNumber: null, driverName: null },
  { plateNumber: '801', trailerNumber: null, driverName: null },
  { plateNumber: '410', trailerNumber: null, driverName: null }
]

async function main() {
  console.log('Populating vehicles...')

  try {
    // Clear existing data in correct order to avoid foreign key constraints
    console.log('Clearing existing tires...')
    await prisma.tire.deleteMany()
    console.log('Clearing existing vehicles...')
    await prisma.vehicle.deleteMany()
    console.log('Existing data cleared.')

    // Insert new vehicles
    console.log('Inserting vehicles...')
    const createdVehicles = await Promise.all(
      vehicleData.map(async (data) => {
        return await prisma.vehicle.upsert({
          where: { plateNumber: data.plateNumber },
          update: {
            trailerNumber: data.trailerNumber || null,
            driverName: data.driverName || null,
            isActive: data.isActive !== undefined ? data.isActive : true
          },
          create: {
            plateNumber: data.plateNumber,
            trailerNumber: data.trailerNumber || null,
            driverName: data.driverName || null,
            isActive: data.isActive !== undefined ? data.isActive : true
          }
        })
      })
    )

    console.log(`Successfully created ${createdVehicles.length} vehicles!`)

    // Log vehicle statistics
    const activeVehicles = createdVehicles.filter(v => v.isActive).length
    const inactiveVehicles = createdVehicles.filter(v => !v.isActive).length
    const vehiclesWithTrailers = createdVehicles.filter(v => v.trailerNumber).length
    const vehiclesWithDrivers = createdVehicles.filter(v => v.driverName).length

    console.log('\nVehicle Statistics:')
    console.log(`  - Total vehicles: ${createdVehicles.length}`)
    console.log(`  - Active vehicles: ${activeVehicles}`)
    console.log(`  - Inactive vehicles: ${inactiveVehicles}`)
    console.log(`  - Vehicles with trailers: ${vehiclesWithTrailers}`)
    console.log(`  - Vehicles with drivers: ${vehiclesWithDrivers}`)

    // Log some sample vehicles
    console.log('\nSample vehicles created:')
    createdVehicles.slice(0, 10).forEach(vehicle => {
      console.log(`  - ${vehicle.plateNumber} | Trailer: ${vehicle.trailerNumber || 'N/A'} | Driver: ${vehicle.driverName || 'N/A'} | Active: ${vehicle.isActive}`)
    })

    // Log special vehicles
    console.log('\nSpecial vehicles:')
    const specialVehicles = createdVehicles.filter(v => 
      v.plateNumber.includes('for sold') || 
      v.plateNumber.match(/^\d+$/) || 
      !v.driverName
    )
    specialVehicles.forEach(vehicle => {
      console.log(`  - ${vehicle.plateNumber} | Status: ${vehicle.isActive ? 'Active' : 'Inactive'}`)
    })

    console.log('\nVehicle population completed successfully!')

  } catch (error) {
    console.error('Error populating vehicles:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })