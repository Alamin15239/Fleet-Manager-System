const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testConnection() {
  try {
    console.log('Testing database connection...')
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Database connected successfully:', result)
    
    // Test user table
    const userCount = await prisma.user.count()
    console.log(`✅ Users in database: ${userCount}`)
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()