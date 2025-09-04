import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Checking all trucks in database...')
    
    // Check all trucks (including deleted)
    const allTrucks = await prisma.truck.findMany({
      select: {
        id: true,
        vin: true,
        make: true,
        model: true,
        licensePlate: true,
        status: true,
        isDeleted: true,
        createdAt: true
      }
    })
    
    console.log(`Total trucks in database: ${allTrucks.length}`)
    
    if (allTrucks.length > 0) {
      console.log('\nAll trucks:')
      allTrucks.forEach(truck => {
        console.log(`- ${truck.licensePlate}: ${truck.make} ${truck.model} (Status: ${truck.status}, Deleted: ${truck.isDeleted})`)
      })
      
      const activeTrucks = allTrucks.filter(t => !t.isDeleted && t.status === 'ACTIVE')
      const nonDeletedTrucks = allTrucks.filter(t => !t.isDeleted)
      
      console.log(`\nNon-deleted trucks: ${nonDeletedTrucks.length}`)
      console.log(`Active trucks: ${activeTrucks.length}`)
    } else {
      console.log('No trucks found in database')
    }
    
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()