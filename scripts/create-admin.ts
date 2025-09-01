import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    console.log('Creating default admin user...')
    
    const hashedPassword = await bcrypt.hash('oOck7534#@', 12)
    
    const admin = await prisma.user.upsert({
      where: { email: 'alamin.kha.saadfreeh@gmail.com' },
      update: {
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true
      },
      create: {
        email: 'alamin.kha.saadfreeh@gmail.com',
        name: 'Alamin Khan',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
        isApproved: true,
        isEmailVerified: true
      }
    })
    
    console.log('✅ Admin user created/updated:', admin.email)
    console.log('📧 Email:', admin.email)
    console.log('🔑 Password: oOck7534#@')
    console.log('👤 Role:', admin.role)
    
  } catch (error) {
    console.error('❌ Error creating admin:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()