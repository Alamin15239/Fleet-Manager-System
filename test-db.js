const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Test if UserActivity table exists
    try {
      const activityCount = await prisma.userActivity.count();
      console.log(`✅ UserActivity table exists with ${activityCount} records`);
    } catch (error) {
      console.log('❌ UserActivity table error:', error.message);
    }
    
    // Test if LoginHistory table exists
    try {
      const loginCount = await prisma.loginHistory.count();
      console.log(`✅ LoginHistory table exists with ${loginCount} records`);
    } catch (error) {
      console.log('❌ LoginHistory table error:', error.message);
    }
    
    // Test if User table exists
    try {
      const userCount = await prisma.user.count();
      console.log(`✅ User table exists with ${userCount} records`);
    } catch (error) {
      console.log('❌ User table error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();