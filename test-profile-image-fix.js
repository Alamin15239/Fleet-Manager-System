const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testProfileImageFix() {
  try {
    console.log('Testing profile image functionality...')
    
    // Find a user with a profile image
    const userWithImage = await prisma.user.findFirst({
      where: {
        profileImage: {
          not: null
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        profileImage: true
      }
    })
    
    if (userWithImage) {
      console.log('Found user with profile image:')
      console.log('- ID:', userWithImage.id)
      console.log('- Email:', userWithImage.email)
      console.log('- Name:', userWithImage.name)
      console.log('- Profile Image Type:', userWithImage.profileImage?.startsWith('data:') ? 'Base64 Data URL' : 'Regular URL')
      console.log('- Profile Image Length:', userWithImage.profileImage?.length || 0)
      console.log('- Profile Image Preview:', userWithImage.profileImage?.substring(0, 100) + '...')
    } else {
      console.log('No users found with profile images')
    }
    
    // Count total users
    const totalUsers = await prisma.user.count()
    console.log(`\nTotal users in database: ${totalUsers}`)
    
    // Count users with profile images
    const usersWithImages = await prisma.user.count({
      where: {
        profileImage: {
          not: null
        }
      }
    })
    console.log(`Users with profile images: ${usersWithImages}`)
    
  } catch (error) {
    console.error('Error testing profile image functionality:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testProfileImageFix()