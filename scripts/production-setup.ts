import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setupProduction() {
  try {
    console.log('🚀 Setting up production database...');
    
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Create admin user if not exists
    const adminExists = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });
    
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await prisma.user.create({
        data: {
          email: 'alamin.kha.saadfreeh@gmail.com',
          name: 'Admin User',
          password: hashedPassword,
          role: 'ADMIN',
          isActive: true,
          isApproved: true,
          isEmailVerified: true
        }
      });
      console.log('✅ Admin user created');
    }
    
    // Create default settings
    const settingsExists = await prisma.settings.findFirst();
    if (!settingsExists) {
      await prisma.settings.create({
        data: {
          currencySymbol: '$',
          currencyCode: 'USD',
          currencyName: 'US Dollar',
          companyName: 'Fleet Manager System',
          companyEmail: 'alamin.kha.saadfreeh@gmail.com'
        }
      });
      console.log('✅ Default settings created');
    }
    
    console.log('🎉 Production setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Production setup failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupProduction();