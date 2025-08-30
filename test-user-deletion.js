const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function testUserDeletion() {
  try {
    console.log('Testing user deletion functionality...')
    
    // Get all users (including deleted ones)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isDeleted: true,
        deletedAt: true,
        isActive: true
      }
    })
    
    console.log('\nAll users in database:')
    allUsers.forEach(user => {
      console.log(`- ${user.email} (ID: ${user.id}) - Deleted: ${user.isDeleted}, Active: ${user.isActive}`)
    })
    
    // Get only active users (not deleted)
    const activeUsers = await prisma.user.findMany({
      where: {
        isDeleted: false
      },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true
      }
    })
    
    console.log('\nActive users (not deleted):')
    activeUsers.forEach(user => {
      console.log(`- ${user.email} (ID: ${user.id}) - Active: ${user.isActive}`)
    })
    
    // Get deleted users
    const deletedUsers = await prisma.user.findMany({
      where: {
        isDeleted: true
      },
      select: {
        id: true,
        email: true,
        name: true,
        deletedAt: true,
        deletedBy: true
      }
    })
    
    console.log('\nDeleted users:')
    if (deletedUsers.length === 0) {
      console.log('- No deleted users found')
    } else {
      deletedUsers.forEach(user => {
        console.log(`- ${user.email} (ID: ${user.id}) - Deleted at: ${user.deletedAt}`)
      })
    }
    
  } catch (error) {
    console.error('Error testing user deletion:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testUserDeletion()