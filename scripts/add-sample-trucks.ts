import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Adding sample trucks...')
  
  const sampleTrucks = [
    {
      vin: '1HGCM82633A123456',
      make: 'Volvo',
      model: 'VNL 860',
      year: 2022,
      licensePlate: 'TRK001',
      currentMileage: 45000,
      status: 'ACTIVE',
      driverName: 'John Smith'
    },
    {
      vin: '1HGCM82633A123457',
      make: 'Freightliner',
      model: 'Cascadia',
      year: 2021,
      licensePlate: 'TRK002',
      currentMileage: 67000,
      status: 'ACTIVE',
      driverName: 'Mike Johnson'
    },
    {
      vin: '1HGCM82633A123458',
      make: 'Peterbilt',
      model: '579',
      year: 2023,
      licensePlate: 'TRK003',
      currentMileage: 23000,
      status: 'MAINTENANCE',
      driverName: 'Sarah Wilson'
    }
  ]

  for (const truck of sampleTrucks) {
    try {
      const existing = await prisma.truck.findFirst({
        where: { vin: truck.vin }
      })
      
      if (!existing) {
        await prisma.truck.create({ data: truck })
        console.log(`Created truck: ${truck.make} ${truck.model} (${truck.licensePlate})`)
      } else {
        console.log(`Truck already exists: ${truck.licensePlate}`)
      }
    } catch (error) {
      console.error(`Error creating truck ${truck.licensePlate}:`, error)
    }
  }
  
  console.log('Sample trucks added successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })