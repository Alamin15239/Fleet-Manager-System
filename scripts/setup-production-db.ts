import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function setupProductionDatabase() {
  console.log('Setting up production database...')
  
  try {
    // Create default admin user
    const defaultAdmin = {
      email: 'alamin.kha.saadfreeh@gmail.com',
      name: 'System Administrator',
      password: 'oOck7534#@',
      role: 'ADMIN'
    }

    // Check if admin already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: defaultAdmin.email }
    })

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(defaultAdmin.password, 10)
      await prisma.user.create({
        data: {
          email: defaultAdmin.email,
          name: defaultAdmin.name,
          password: hashedPassword,
          role: defaultAdmin.role as 'ADMIN',
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

    console.log('🎉 Production database setup completed!')
    
  } catch (error) {
    console.error('❌ Error setting up production database:', error)
    throw error
  }
}

setupProductionDatabase()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })