'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Shield, 
  Users, 
  Truck, 
  Wrench, 
  FileText, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Eye,
  Settings,
  Activity,
  Database
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/currency'

interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalTrucks: number
  activeTrucks: number
  totalMaintenance: number
  pendingMaintenance: number
  totalCost: number
  recentActivity: any[]
}

interface User {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  createdAt: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalTrucks: 0,
    activeTrucks: 0,
    totalMaintenance: 0,
    pendingMaintenance: 0,
    totalCost: 0,
    recentActivity: []
  })
  const [recentUsers, setRecentUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isMounted) {
      checkAuth()
    }
  }, [isMounted])

  useEffect(() => {
    if (isMounted && isAuthenticated && isAdmin) {
      fetchAdminData()
    }
  }, [isMounted, isAuthenticated, isAdmin])

  const checkAuth = () => {
    if (!isMounted) return
    
    try {
      const token = localStorage.getItem('authToken')
      const user = localStorage.getItem('user')
      
      if (!token || !user) {
        setIsAuthenticated(false)
        setIsAdmin(false)
        router.push('/login')
        return
      }

      const userData = JSON.parse(user)
      if (userData.role !== 'ADMIN') {
        setIsAuthenticated(true)
        setIsAdmin(false)
        router.push('/')
        return
      }

      setCurrentUser(userData)
      setIsAuthenticated(true)
      setIsAdmin(true)
    } catch (error) {
      console.error('Error parsing user data:', error)
      setIsAuthenticated(false)
      setIsAdmin(false)
      router.push('/login')
    }
  }

  const fetchAdminData = async () => {
    if (!isMounted || !isAuthenticated || !isAdmin) return
    
    setLoading(true)
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      // Fetch users
      const usersResponse = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (usersResponse.ok) {
        const usersResponseData = await usersResponse.json()
        const usersData = usersResponseData.data || []
        setRecentUsers(usersData.slice(0, 5))
        
        // Calculate user stats
        const activeUsers = usersData.filter((u: User) => u.isActive).length
        setStats(prev => ({
          ...prev,
          totalUsers: usersData.length,
          activeUsers
        }))
      }

      // Fetch trucks
      const trucksResponse = await fetch('/api/trucks', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      let totalFleet = 0
      let activeFleet = 0
      
      if (trucksResponse.ok) {
        const trucksResponseData = await trucksResponse.json()
        const trucksData = trucksResponseData.data || []
        const activeTrucks = trucksData.filter((t: any) => t.status === 'ACTIVE').length
        console.log('Trucks:', trucksData.length, 'Active trucks:', activeTrucks)
        totalFleet += trucksData.length
        activeFleet += activeTrucks
      }

      // Fetch trailers
      const trailersResponse = await fetch('/api/trailers', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (trailersResponse.ok) {
        const trailersResponseData = await trailersResponse.json()
        const trailersData = trailersResponseData.data || []
        const activeTrailers = trailersData.filter((t: any) => t.status === 'ACTIVE').length
        console.log('Trailers:', trailersData.length, 'Active trailers:', activeTrailers)
        totalFleet += trailersData.length
        activeFleet += activeTrailers
      }

      console.log('Total fleet:', totalFleet, 'Active fleet:', activeFleet)

      setStats(prev => ({
        ...prev,
        totalTrucks: totalFleet,
        activeTrucks: activeFleet
      }))

      // Fetch maintenance
      const maintenanceResponse = await fetch('/api/maintenance', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (maintenanceResponse.ok) {
        const maintenanceResponseData = await maintenanceResponse.json()
        const maintenanceData = maintenanceResponseData.data || []
        const pendingMaintenance = maintenanceData.filter((m: any) => 
          m.status === 'SCHEDULED' || m.status === 'IN_PROGRESS'
        ).length
        const totalCost = maintenanceData.reduce((sum: number, m: any) => sum + m.totalCost, 0)
        
        setStats(prev => ({
          ...prev,
          totalMaintenance: maintenanceData.length,
          pendingMaintenance,
          totalCost
        }))
      }

    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800'
      case 'MANAGER': return 'bg-blue-100 text-blue-800'
      case 'MECHANIC': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Show loading state while checking authentication
  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  // Show access denied if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            Access denied. Only administrators can view this page.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground">
            Welcome back, {currentUser.name || currentUser.email}. Manage your fleet system from here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/users')}>
            <Users className="h-4 w-4 mr-2" />
            Manage Users
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/activity')}>
            <Activity className="h-4 w-4 mr-2" />
            Activity Monitor
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/monitoring')}>
            <Activity className="h-4 w-4 mr-2" />
            Monitoring
          </Button>
          <Button variant="outline" onClick={() => router.push('/settings')}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsers} active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Size</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrucks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeTrucks} active vehicles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMaintenance}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingMaintenance} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalCost)}</div>
            <p className="text-xs text-muted-foreground">
              Lifetime maintenance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/users')}>
          <CardContent className="p-6 text-center">
            <Plus className="h-12 w-12 mx-auto mb-2 text-blue-600" />
            <h3 className="font-semibold">Add User</h3>
            <p className="text-sm text-muted-foreground">Create new user account</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/trucks')}>
          <CardContent className="p-6 text-center">
            <Plus className="h-12 w-12 mx-auto mb-2 text-green-600" />
            <h3 className="font-semibold">Add Truck</h3>
            <p className="text-sm text-muted-foreground">Add new vehicle to fleet</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/maintenance')}>
          <CardContent className="p-6 text-center">
            <Plus className="h-12 w-12 mx-auto mb-2 text-orange-600" />
            <h3 className="font-semibold">Schedule Maintenance</h3>
            <p className="text-sm text-muted-foreground">Create maintenance record</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/admin/activity')}>
          <CardContent className="p-6 text-center">
            <Activity className="h-12 w-12 mx-auto mb-2 text-purple-600" />
            <h3 className="font-semibold">Activity Monitor</h3>
            <p className="text-sm text-muted-foreground">Track user activities</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/reports')}>
          <CardContent className="p-6 text-center">
            <FileText className="h-12 w-12 mx-auto mb-2 text-indigo-600" />
            <h3 className="font-semibold">Generate Report</h3>
            <p className="text-sm text-muted-foreground">Export system data</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Users</CardTitle>
          <CardDescription>
            Latest user registrations in the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{user.name || 'No name'}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(user.role)}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {user.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                      )}
                      <span className={user.isActive ? 'text-green-600' : 'text-red-600'}>
                        {user.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/users`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span>Authentication</span>
              <Badge variant="default">Operational</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Database</span>
              <Badge variant="default">Connected</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>File Storage</span>
              <Badge variant="default">Available</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span>Report Generation</span>
              <Badge variant="default">Ready</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No recent activities</p>
              <p className="text-xs text-gray-400">Activities will appear here as users interact with the system</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}