const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function testApiAndDatabase() {
  try {
    console.log('🔍 Testing database connection...')
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // Check if admin user exists
    const adminUser = await prisma.user.findFirst({
      where: { 
        role: 'ADMIN',
        isDeleted: false 
      }
    })
    
    if (!adminUser) {
      console.log('❌ No admin user found. Creating one...')
      
      const hashedPassword = await bcrypt.hash('admin123', 12)
      
      const newAdmin = await prisma.user.create({
        data: {
          email: 'admin@fleet.com',
          name: 'System Admin',
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          isApproved: true,
          isEmailVerified: true,
          isDeleted: false
        }
      })
      
      console.log('✅ Admin user created:')
      console.log('   Email: admin@fleet.com')
      console.log('   Password: admin123')
      console.log('   Role:', newAdmin.role)
    } else {
      console.log('✅ Admin user found:')
      console.log('   Email:', adminUser.email)
      console.log('   Name:', adminUser.name)
      console.log('   Role:', adminUser.role)
      console.log('   Active:', adminUser.isActive)
      console.log('   Approved:', adminUser.isApproved)
      console.log('   Email Verified:', adminUser.isEmailVerified)
      console.log('   Deleted:', adminUser.isDeleted)
      
      // Test if we can verify the password
      const testPassword = 'admin123'
      const isValidPassword = await bcrypt.compare(testPassword, adminUser.password)
      console.log('   Password "admin123" valid:', isValidPassword)
      
      if (!isValidPassword) {
        console.log('🔧 Updating admin password to "admin123"...')
        const hashedPassword = await bcrypt.hash('admin123', 12)
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { 
            password: hashedPassword,
            isActive: true,
            isApproved: true,
            isEmailVerified: true
          }
        })
        console.log('✅ Admin password updated')
      }
    }
    
    console.log('\n🚀 You can now login with:')
    console.log('   Email: admin@fleet.com')
    console.log('   Password: admin123')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testApiAndDatabase()