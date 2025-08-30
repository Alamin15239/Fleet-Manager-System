const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function cleanupUsers() {
  try {
    // Delete all users except the main admin
    await prisma.user.deleteMany({
      where: {
        email: {
          not: 'alamin.kha.saadfreeh@gmail.com'
        }
      }
    })
    
    console.log('✅ All other users deleted')
    
    // Ensure main admin exists with correct settings
    const hashedPassword = await bcrypt.hash('oOck7534#@', 12)
    
    await prisma.user.upsert({
      where: { email: 'alamin.kha.saadfreeh@gmail.com' },
      update: {
        password: hashedPassword,
        name: 'Alamin Admin',
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true,
        isDeleted: false
      },
      create: {
        email: 'alamin.kha.saadfreeh@gmail.com',
        name: 'Alamin Admin',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true,
        isDeleted: false
      }
    })
    
    console.log('✅ Main admin user ensured')
    console.log('Email: alamin.kha.saadfreeh@gmail.com')
    console.log('Password: oOck7534#@')
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

cleanupUsers()