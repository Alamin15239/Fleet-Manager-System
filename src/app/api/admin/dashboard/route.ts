import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    // Get comprehensive admin dashboard data
    const [
      users,
      trucks,
      trailers,
      truckMaintenanceRecords,
      trailerMaintenanceRecords,
      workshopJobCards,
      recentUsers,
      recentActivities
    ] = await Promise.all([
      // Users statistics
      db.user.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          isApproved: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      }),
      
      // Trucks statistics
      db.truck.findMany({
        select: {
          id: true,
          status: true,
          isDeleted: true,
          createdAt: true
        },
        where: { isDeleted: false }
      }),
      
      // Trailers statistics
      db.trailer.findMany({
        select: {
          id: true,
          status: true,
          isDeleted: true,
          createdAt: true
        },
        where: { isDeleted: false }
      }),
      
      // Maintenance statistics
      db.maintenanceRecord.findMany({
        select: {
          id: true,
          status: true,
          totalCost: true,
          datePerformed: true,
          isDeleted: true
        },
        where: { isDeleted: false }
      }),

      db.trailerMaintenanceRecord.findMany({
        select: { id: true, status: true, totalCost: true, datePerformed: true, isDeleted: true },
        where: { isDeleted: false }
      }),

      db.workshopJobCard.findMany({
        select: { id: true, status: true, totalCost: true, serviceDate: true }
      }),
      
      // Recent users (last 10)
      db.user.findMany({
        where: { isDeleted: false },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          isApproved: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      }),
      
      // Recent activities (last 20)
      db.userActivity.findMany({
        select: {
          id: true,
          action: true,
          entityType: true,
          entityName: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
      })
    ])

    // Calculate user statistics
    const totalUsers = users.length
    const activeUsers = users.filter(u => u.isActive).length
    const pendingUsers = users.filter(u => !u.isApproved).length
    const adminUsers = users.filter(u => u.role === 'ADMIN').length
    const managerUsers = users.filter(u => u.role === 'MANAGER').length
    const regularUsers = users.filter(u => u.role === 'USER').length

    // Calculate truck statistics
    const totalTrucks = trucks.length
    const activeTrucks = trucks.filter(t => t.status === 'ACTIVE').length
    const inactiveTrucks = trucks.filter(t => t.status === 'INACTIVE').length
    const maintenanceTrucks = trucks.filter(t => t.status === 'MAINTENANCE').length

    // Calculate trailer statistics
    const totalTrailers = trailers.length
    const activeTrailers = trailers.filter(t => t.status === 'ACTIVE').length
    const inactiveTrailers = trailers.filter(t => t.status === 'INACTIVE').length
    const maintenanceTrailers = trailers.filter(t => t.status === 'MAINTENANCE').length

    // Calculate maintenance statistics
    const maintenanceRecords = [
      ...truckMaintenanceRecords,
      ...trailerMaintenanceRecords,
      ...workshopJobCards.map(card => ({
        id: card.id,
        status: card.status,
        totalCost: card.totalCost,
        datePerformed: card.serviceDate
      }))
    ]
    const totalMaintenance = maintenanceRecords.length
    const completedMaintenance = maintenanceRecords.filter(m => m.status === 'COMPLETED').length
    const pendingMaintenance = maintenanceRecords.filter(m => 
      m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS'
    ).length
    const totalMaintenanceCost = maintenanceRecords.reduce((sum, m) => sum + (m.totalCost || 0), 0)

    // Calculate monthly statistics
    const currentMonth = new Date().getMonth()
    const currentYear = new Date().getFullYear()
    
    const thisMonthMaintenance = maintenanceRecords.filter(m => {
      const date = new Date(m.datePerformed)
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
    })
    
    const thisMonthCost = thisMonthMaintenance.reduce((sum, m) => sum + (m.totalCost || 0), 0)
    const thisMonthUsers = users.filter(u => {
      const date = new Date(u.createdAt)
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear
    }).length

    // Calculate growth rates (comparing to last month)
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear
    
    const lastMonthMaintenance = maintenanceRecords.filter(m => {
      const date = new Date(m.datePerformed)
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear
    })
    
    const lastMonthCost = lastMonthMaintenance.reduce((sum, m) => sum + (m.totalCost || 0), 0)
    const costGrowth = lastMonthCost > 0 ? ((thisMonthCost - lastMonthCost) / lastMonthCost) * 100 : 0

    return NextResponse.json({
      success: true,
      data: {
        // User statistics
        users: {
          total: totalUsers,
          active: activeUsers,
          pending: pendingUsers,
          admins: adminUsers,
          managers: managerUsers,
          regular: regularUsers,
          thisMonth: thisMonthUsers
        },
        
        // Fleet statistics
        fleet: {
          trucks: {
            total: totalTrucks,
            active: activeTrucks,
            inactive: inactiveTrucks,
            maintenance: maintenanceTrucks
          },
          trailers: {
            total: totalTrailers,
            active: activeTrailers,
            inactive: inactiveTrailers,
            maintenance: maintenanceTrailers
          }
        },
        
        // Maintenance statistics
        maintenance: {
          total: totalMaintenance,
          completed: completedMaintenance,
          pending: pendingMaintenance,
          totalCost: totalMaintenanceCost,
          thisMonthCost: thisMonthCost,
          thisMonthCount: thisMonthMaintenance.length,
          costGrowth: costGrowth
        },
        
        // Recent data
        recentUsers: recentUsers.map(user => ({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          isApproved: user.isApproved,
          createdAt: user.createdAt
        })),
        
        recentActivities: recentActivities.map(activity => ({
          id: activity.id,
          action: activity.action,
          entityType: activity.entityType,
          entityName: activity.entityName,
          userName: activity.user?.name || activity.user?.email || 'Unknown',
          createdAt: activity.createdAt
        })),
        
        // System health
        systemHealth: {
          database: 'Connected',
          authentication: 'Operational',
          fileStorage: 'Not persistent',
          reportGeneration: 'Available'
        },
        
        // Additional metrics
        metrics: {
          averageMaintenanceCost: totalMaintenance > 0 ? totalMaintenanceCost / totalMaintenance : 0,
          fleetUtilization: totalTrucks > 0 ? (activeTrucks / totalTrucks) * 100 : 0,
          userApprovalRate: totalUsers > 0 ? ((totalUsers - pendingUsers) / totalUsers) * 100 : 0
        }
      }
    })

  } catch (error) {
    console.error('Error fetching admin dashboard data:', error)
    const status = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
      ? 401
      : error instanceof Error && error.message === 'Insufficient permissions' ? 403 : 503
    return NextResponse.json({ success: false, error: status === 401 ? 'Authentication required' : status === 403 ? 'Administrator access required' : 'Unable to load admin dashboard data' }, { status })
  }
}
