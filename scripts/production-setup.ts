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
      const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase() || '';
      const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
      if (!adminEmail || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(adminEmail) || adminPassword.length < 16) {
        throw new Error('Set BOOTSTRAP_ADMIN_EMAIL and a BOOTSTRAP_ADMIN_PASSWORD of at least 16 characters before bootstrapping an administrator');
      }
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      await prisma.user.create({
        data: {
          email: adminEmail,
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