const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createTestUser() {
  try {
    console.log('Creating test user...')
    
    // Check if test user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: 'test@test.com' }
    })
    
    if (existingUser) {
      console.log('Test user already exists, updating...')
      const hashedPassword = await bcrypt.hash('test123', 12)
      
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          isActive: true,
          isApproved: true,
          isEmailVerified: true,
          isDeleted: false
        }
      })
      
      console.log('✅ Test user updated successfully')
    } else {
      const hashedPassword = await bcrypt.hash('test123', 12)
      
      await prisma.user.create({
        data: {
          email: 'test@test.com',
          name: 'Test User',
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          isApproved: true,
          isEmailVerified: true,
          isDeleted: false
        }
      })
      
      console.log('✅ Test user created successfully')
    }
    
    console.log('\nLogin credentials:')
    console.log('Email: test@test.com')
    console.log('Password: test123')
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUser()