const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testConnection() {
  try {
    console.log('Testing database connection...')
    await prisma.$connect()
    console.log('✅ Database connected successfully!')
    
    const userCount = await prisma.user.count()
    console.log(`✅ Found ${userCount} users in database`)
    
    const adminUser = await prisma.user.findUnique({
      where: { email: 'alamin.kha.saadfreeh@gmail.com' }
    })
    
    if (adminUser) {
      console.log('✅ Admin user exists and is ready for login')
    } else {
      console.log('❌ Admin user not found')
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
    console.log('\n🔧 Possible solutions:')
    console.log('1. Check your internet connection')
    console.log('2. Verify Neon database is not suspended')
    console.log('3. Check DATABASE_URL in .env file')
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()