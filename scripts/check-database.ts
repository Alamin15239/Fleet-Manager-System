import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Checking database contents...')
  
  const truckCount = await prisma.truck.count({ where: { isDeleted: false } })
  const activeTrucks = await prisma.truck.count({ where: { status: 'ACTIVE', isDeleted: false } })
  
  const trailerCount = await prisma.trailer.count({ where: { isDeleted: false } })
  const activeTrailers = await prisma.trailer.count({ where: { status: 'ACTIVE', isDeleted: false } })
  
  console.log(`Total Trucks: ${truckCount}`)
  console.log(`Active Trucks: ${activeTrucks}`)
  console.log(`Total Trailers: ${trailerCount}`)
  console.log(`Active Trailers: ${activeTrailers}`)
  
  if (truckCount > 0) {
    const trucks = await prisma.truck.findMany({
      where: { isDeleted: false },
      select: { licensePlate: true, make: true, model: true, status: true }
    })
    console.log('\nTrucks:')
    trucks.forEach(truck => {
      console.log(`- ${truck.licensePlate}: ${truck.make} ${truck.model} (${truck.status})`)
    })
  }
  
  if (trailerCount > 0) {
    const trailers = await prisma.trailer.findMany({
      where: { isDeleted: false },
      select: { number: true, status: true }
    })
    console.log('\nTrailers:')
    trailers.forEach(trailer => {
      console.log(`- ${trailer.number} (${trailer.status})`)
    })
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