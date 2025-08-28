import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function setupVercelDatabase() {
  console.log('🚀 Setting up Vercel database...')
  
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Database connection successful')

    // Create default admin user
    const adminEmail = 'alamin.kha.saadfreeh@gmail.com'
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('oOck7534#@', 10)
      await prisma.user.create({
        data: {
          email: adminEmail,
          name: 'System Administrator',
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true
        }
      })
      console.log('✅ Default admin user created')
    } else {
      console.log('ℹ️  Admin user already exists')
    }

    // Create default settings
    const existingSettings = await prisma.settings.findFirst()
    if (!existingSettings) {
      await prisma.settings.create({
        data: {
          currencySymbol: '﷼',
          currencyCode: 'SAR',
          currencyName: 'Saudi Riyal',
          decimalPlaces: 2,
          thousandsSeparator: ',',
          decimalSeparator: '.',
          symbolPosition: 'before',
          timezone: 'Asia/Riyadh',
          dateFormat: 'DD/MM/YYYY'
        }
      })
      console.log('✅ Default settings created')
    } else {
      console.log('ℹ️  Settings already exist')
    }

    // Create sample mechanics
    const mechanicCount = await prisma.mechanic.count()
    if (mechanicCount === 0) {
      await prisma.mechanic.createMany({
        data: [
          { name: 'Sakib', email: 'sakib@fleetmanagement.com', phone: '+966-50-123-4567', specialty: 'Engine Specialist' },
          { name: 'Ahmed', email: 'ahmed@fleetmanagement.com', phone: '+966-50-234-5678', specialty: 'Electrical Systems' },
          { name: 'Mohammed', email: 'mohammed@fleetmanagement.com', phone: '+966-50-345-6789', specialty: 'Brake Systems' }
        ]
      })
      console.log('✅ Sample mechanics created')
    } else {
      console.log('ℹ️  Mechanics already exist')
    }

    // Create sample trucks
    const truckCount = await prisma.truck.count()
    if (truckCount === 0) {
      await prisma.truck.createMany({
        data: [
          { vin: '1HGCM82633A123456', make: 'Mercedes-Benz', model: 'Actros', year: 2025, licensePlate: '2391 NBA', currentMileage: 25000, status: 'ACTIVE' },
          { vin: '1HGBH41JXMN109186', make: 'Toyota', model: 'رأس', year: 2025, licensePlate: 'DEF456', currentMileage: 18000, status: 'ACTIVE' },
          { vin: '1FTFW1ET5DFC12345', make: 'ISUZU', model: 'راس تريلا', year: 2025, licensePlate: '8482 ZSA', currentMileage: 32000, status: 'ACTIVE' }
        ]
      })
      console.log('✅ Sample trucks created')
    } else {
      console.log('ℹ️  Trucks already exist')
    }

    // Create maintenance jobs
    const jobCount = await prisma.maintenanceJob.count()
    if (jobCount === 0) {
      const maintenanceJobs = [
        { name: "Oil & Filter Change", category: "Engine", parts: "Oil, filters", notes: "15–20k km" },
        { name: "Alternator Replacement", category: "Electrical", parts: "Alternator, belt", notes: "3–5 years" },
        { name: "Brake Pad Replacement", category: "Brakes", parts: "Brake pads, hardware", notes: "1–2 years" },
        { name: "Tire Rotation", category: "Tires", parts: "Tires, weights", notes: "6–12 months" },
        { name: "Battery Service", category: "Electrical", parts: "Battery, terminals", notes: "1–2 years" }
      ]
      
      for (const job of maintenanceJobs) {
        await prisma.maintenanceJob.create({ data: job })
      }
      console.log('✅ Sample maintenance jobs created')
    } else {
      console.log('ℹ️  Maintenance jobs already exist')
    }

    console.log('🎉 Vercel database setup completed successfully!')
    
  } catch (error) {
    console.error('❌ Error setting up Vercel database:', error)
    throw error
  }
}

setupVercelDatabase()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })