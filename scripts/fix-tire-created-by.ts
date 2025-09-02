import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixTireCreatedBy() {
  try {
    console.log('Checking for tires with null createdById...')
    
    // Find tires with null createdById
    const tiresWithoutCreator = await prisma.tire.findMany({
      where: {
        createdById: null
      },
      select: {
        id: true,
        manufacturer: true,
        plateNumber: true,
        createdAt: true
      }
    })

    console.log(`Found ${tiresWithoutCreator.length} tires without creator`)

    if (tiresWithoutCreator.length === 0) {
      console.log('All tires have valid creators!')
      return
    }

    // Find the first admin user to assign as creator
    const adminUser = await prisma.user.findFirst({
      where: {
        role: 'ADMIN',
        isActive: true
      }
    })

    if (!adminUser) {
      console.log('No admin user found. Creating system user...')
      
      // Create a system user if no admin exists
      const systemUser = await prisma.user.create({
        data: {
          email: 'system@fleet-manager.com',
          name: 'System User',
          password: 'system-generated',
          role: 'ADMIN',
          isActive: true,
          isApproved: true
        }
      })

      console.log('System user created:', systemUser.email)
      
      // Update tires to use system user
      const result = await prisma.tire.updateMany({
        where: {
          createdById: null
        },
        data: {
          createdById: systemUser.id
        }
      })

      console.log(`Updated ${result.count} tires with system user as creator`)
    } else {
      console.log('Using admin user:', adminUser.email)
      
      // Update tires to use admin user
      const result = await prisma.tire.updateMany({
        where: {
          createdById: null
        },
        data: {
          createdById: adminUser.id
        }
      })

      console.log(`Updated ${result.count} tires with admin user as creator`)
    }

    console.log('Fix completed successfully!')
  } catch (error) {
    console.error('Error fixing tire creators:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixTireCreatedBy()