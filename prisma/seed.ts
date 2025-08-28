import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const defaultAdmin = {
    email: 'alamin.kha.saadfreeh@gmail.com',
    name: 'System Administrator',
    password: 'oOck7534#@',
    role: 'ADMIN'
  }

  // Check if default admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: defaultAdmin.email }
  })

  if (!existingAdmin) {
    // Hash password
    const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10)

    // Create default admin
    const newAdmin = await prisma.user.create({
      data: {
        email: defaultAdmin.email,
        name: defaultAdmin.name,
        password: hashedPassword,
        role: defaultAdmin.role,
        isActive: true,
        isApproved: true, // Admin is pre-approved
        isEmailVerified: true, // Admin email is pre-verified
        phone: '+966 50 123 4567',
        department: 'IT Department',
        title: 'System Administrator',
        bio: 'Responsible for system administration and fleet management oversight.'
      }
    })

    console.log('Default admin created successfully:', newAdmin.email)
  } else {
    console.log('Default admin already exists:', existingAdmin.email)
  }

  // Create sample trucks if none exist
  const truckCount = await prisma.truck.count({ where: { isDeleted: false } })
  if (truckCount === 0) {
    console.log('Creating sample trucks...')
    await Promise.all([
      prisma.truck.create({
        data: {
          vin: '1HGCM82633A123456',
          make: 'Honda',
          model: 'Accord',
          year: 2020,
          licensePlate: 'ABC123',
          currentMileage: 45000,
          status: 'ACTIVE'
        }
      }),
      prisma.truck.create({
        data: {
          vin: '2T1BURHE1JC123456',
          make: 'Toyota',
          model: 'Camry',
          year: 2019,
          licensePlate: 'DEF456',
          currentMileage: 62000,
          status: 'ACTIVE'
        }
      }),
      prisma.truck.create({
        data: {
          vin: '3FA6P0H72HR123456',
          make: 'Ford',
          model: 'Fusion',
          year: 2018,
          licensePlate: 'GHI789',
          currentMileage: 78000,
          status: 'ACTIVE'
        }
      })
    ])
    console.log('Sample trucks created successfully!')
  }

  // Create sample mechanics if none exist
  const mechanicCount = await prisma.mechanic.count({ where: { isDeleted: false } })
  if (mechanicCount === 0) {
    console.log('Creating sample mechanics...')
    const mechanics = await Promise.all([
      prisma.mechanic.create({
        data: {
          name: 'John Smith',
          email: 'john.smith@example.com',
          phone: '+1-555-0123',
          specialty: 'Engine Specialist'
        }
      }),
      prisma.mechanic.create({
        data: {
          name: 'Mike Johnson',
          email: 'mike.johnson@example.com',
          phone: '+1-555-0456',
          specialty: 'General Mechanic'
        }
      })
    ])
    console.log('Sample mechanics created successfully!')

    // Get the trucks we just created
    const trucks = await prisma.truck.findMany({ where: { isDeleted: false } })

    // Create sample maintenance records
    console.log('Creating sample maintenance records...')
    await Promise.all([
      prisma.maintenanceRecord.create({
        data: {
          truckId: trucks[0].id,
          serviceType: 'Oil Change',
          description: 'Regular oil change with synthetic oil',
          datePerformed: new Date('2024-01-15'),
          partsCost: 25,
          laborCost: 50,
          totalCost: 75,
          mechanicId: mechanics[0].id,
          status: 'COMPLETED',
          currentMileage: 45000
        }
      }),
      prisma.maintenanceRecord.create({
        data: {
          truckId: trucks[1].id,
          serviceType: 'Brake Repair',
          description: 'Front brake pad replacement and rotor resurfacing',
          datePerformed: new Date('2024-01-14'),
          partsCost: 150,
          laborCost: 200,
          totalCost: 350,
          mechanicId: mechanics[1].id,
          status: 'COMPLETED',
          currentMileage: 62000
        }
      }),
      prisma.maintenanceRecord.create({
        data: {
          truckId: trucks[2].id,
          serviceType: 'Tire Rotation',
          description: 'Four-wheel tire rotation and balance',
          datePerformed: new Date('2024-01-13'),
          partsCost: 0,
          laborCost: 50,
          totalCost: 50,
          mechanicId: mechanics[0].id,
          status: 'COMPLETED',
          currentMileage: 78000
        }
      }),
      prisma.maintenanceRecord.create({
        data: {
          truckId: trucks[0].id,
          serviceType: 'Air Filter Replacement',
          description: 'Engine air filter and cabin air filter replacement',
          datePerformed: new Date('2024-01-10'),
          partsCost: 30,
          laborCost: 20,
          totalCost: 50,
          mechanicId: mechanics[1].id,
          status: 'COMPLETED',
          currentMileage: 44800
        }
      }),
      prisma.maintenanceRecord.create({
        data: {
          truckId: trucks[1].id,
          serviceType: 'Transmission Service',
          description: 'Transmission fluid change and filter replacement',
          datePerformed: new Date('2024-01-08'),
          partsCost: 80,
          laborCost: 120,
          totalCost: 200,
          mechanicId: mechanics[0].id,
          status: 'COMPLETED',
          currentMileage: 61800
        }
      })
    ])
    console.log('Sample maintenance records created successfully!')
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