const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    await prisma.$connect()
    console.log('✅ Database connected')
    
    const hashedPassword = await bcrypt.hash('oOck7534#@', 12)
    
    const admin = await prisma.user.upsert({
      where: { email: 'alamin.kha.saadfreeh@gmail.com' },
      update: {
        password: hashedPassword,
        isActive: true,
        isApproved: true,
        isEmailVerified: true
      },
      create: {
        email: 'alamin.kha.saadfreeh@gmail.com',
        name: 'Admin User',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true
      }
    })
    
    console.log('✅ Admin user created/updated:')
    console.log('Email: alamin.kha.saadfreeh@gmail.com')
    console.log('Password: oOck7534#@')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()