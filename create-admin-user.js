const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 12)
    
    await prisma.user.upsert({
      where: { email: 'admin@fleet.com' },
      update: {
        password: hashedPassword,
        isActive: true,
        isApproved: true,
        isEmailVerified: true
      },
      create: {
        email: 'admin@fleet.com',
        name: 'System Admin',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true
      }
    })
    
    console.log('✅ Admin user created/updated')
    console.log('Email: admin@fleet.com')
    console.log('Password: admin123')
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()