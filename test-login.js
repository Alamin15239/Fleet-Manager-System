const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function testLogin() {
  try {
    await prisma.$connect()
    console.log('✅ Database connected')
    
    // Find the admin user
    const user = await prisma.user.findUnique({
      where: { email: 'alamin.kha.saadfreeh@gmail.com' }
    })
    
    if (!user) {
      console.log('❌ User not found')
      return
    }
    
    console.log('✅ User found:')
    console.log('- Email:', user.email)
    console.log('- Name:', user.name)
    console.log('- Role:', user.role)
    console.log('- isActive:', user.isActive)
    console.log('- isApproved:', user.isApproved)
    console.log('- isEmailVerified:', user.isEmailVerified)
    console.log('- isDeleted:', user.isDeleted)
    
    // Test password
    const testPassword = 'oOck7534#@'
    const isValidPassword = await bcrypt.compare(testPassword, user.password)
    console.log('- Password valid:', isValidPassword)
    
    if (!user.isActive) {
      console.log('❌ User is not active')
    }
    
    if (!user.isApproved) {
      console.log('❌ User is not approved')
    }
    
    if (!user.isEmailVerified) {
      console.log('❌ User email is not verified')
    }
    
    if (user.isDeleted) {
      console.log('❌ User is deleted')
    }
    
    if (user.isActive && user.isApproved && user.isEmailVerified && !user.isDeleted && isValidPassword) {
      console.log('✅ User should be able to login successfully!')
    } else {
      console.log('❌ User cannot login due to the issues above')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testLogin()