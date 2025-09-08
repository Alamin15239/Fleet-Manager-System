'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Database,
  UserPlus,
  Calendar,
  BarChart3,
  Zap,
  Server,
  HardDrive,
  Wifi,
  RefreshCw
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/currency'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'

interface AdminDashboardData {
  users: {
    total: number
    active: number
    pending: number
    admins: number
    managers: number
    regular: number
    thisMonth: number
  }
  fleet: {
    trucks: {
      total: number
      active: number
      inactive: number
      maintenance: number
    }
    trailers: {
      total: number
      active: number
      inactive: number
      maintenance: number
    }
  }
  maintenance: {
    total: number
    completed: number
    pending: number
    totalCost: number
    thisMonthCost: number
    thisMonthCount: number
    costGrowth: number
  }
  recentUsers: User[]
  recentActivities: Activity[]
  systemHealth: {
    database: string
    authentication: string
    fileStorage: string
    reportGeneration: string
  }
  metrics: {
    averageMaintenanceCost: number
    fleetUtilization: number
    userApprovalRate: number
  }
}

interface User {
  id: string
  email: string
  name: string | null
  role: string
  isActive: boolean
  isApproved: boolean
  createdAt: string
}

interface Activity {
  id: string
  action: string
  entityType: string
  entityName: string
  userName: string
  createdAt: string
}

export default function AdminDashboard() {
  const [dashboardData, setDashboardData] = useState<AdminDashboardData>({
    users: { total: 0, active: 0, pending: 0, admins: 0, managers: 0, regular: 0, thisMonth: 0 },
    fleet: {
      trucks: { total: 0, active: 0, inactive: 0, maintenance: 0 },
      trailers: { total: 0, active: 0, inactive: 0, maintenance: 0 }
    },
    maintenance: { total: 0, completed: 0, pending: 0, totalCost: 0, thisMonthCost: 0, thisMonthCount: 0, costGrowth: 0 },
    recentUsers: [],
    recentActivities: [],
    systemHealth: {
      database: 'Connected',
      authentication: 'Operational',
      fileStorage: 'Available',
      reportGeneration: 'Ready'
    },
    metrics: { averageMaintenanceCost: 0, fleetUtilization: 0, userApprovalRate: 0 }
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
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

  const fetchAdminData = async (showRefreshing = false) => {
    if (!isMounted || !isAuthenticated || !isAdmin) return
    
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    
    try {
      const response = await apiGet('/api/admin/dashboard')
      if (response.ok) {
        const data = await response.json()
        setDashboardData(data.data)
        if (showRefreshing) {
          toast.success('Dashboard data refreshed')
        }
      } else {
        toast.error('Failed to fetch dashboard data')
      }
    } catch (error) {
      console.error('Error fetching admin data:', error)
      toast.error('Failed to fetch dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchAdminData(true)
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
            Welcome back, {currentUser?.name || currentUser?.email}. Manage your fleet system from here.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/users')}>
            <Users className="h-4 w-4 mr-2" />
            Manage Users
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/activity')}>
            <Activity className="h-4 w-4 mr-2" />
            Activity Monitor
          </Button>
          <Button variant="outline" onClick={() => router.push('/settings')}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* System Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.users.total}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.users.active} active • {dashboardData.users.pending} pending
            </p>
            <div className="mt-2">
              <Progress value={dashboardData.metrics.userApprovalRate} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Trucks</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.fleet.trucks.total}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.fleet.trucks.active} active • {dashboardData.fleet.trucks.maintenance} in service
            </p>
            <div className="mt-2">
              <Progress value={dashboardData.metrics.fleetUtilization} className="h-1" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Trailers</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.fleet.trailers.total}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.fleet.trailers.active} active • {dashboardData.fleet.trailers.maintenance} in service
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardData.maintenance.total}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardData.maintenance.pending} pending • {dashboardData.maintenance.completed} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.maintenance.totalCost)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(dashboardData.metrics.averageMaintenanceCost)}
            </p>
            {dashboardData.maintenance.costGrowth !== 0 && (
              <div className={`text-xs flex items-center gap-1 mt-1 ${
                dashboardData.maintenance.costGrowth > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                <TrendingUp className="h-3 w-3" />
                {dashboardData.maintenance.costGrowth > 0 ? '+' : ''}{dashboardData.maintenance.costGrowth.toFixed(1)}% from last month
              </div>
            )}
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

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Monthly Performance */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(dashboardData.maintenance.thisMonthCost)}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboardData.maintenance.thisMonthCount} maintenance records
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Users</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.users.thisMonth}</div>
                <p className="text-xs text-muted-foreground">
                  Registered this month
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fleet Utilization</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboardData.metrics.fleetUtilization.toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">
                  Active vehicles
                </p>
                <div className="mt-2">
                  <Progress value={dashboardData.metrics.fleetUtilization} className="h-2" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          {/* User Statistics */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Admins</CardTitle>
                <Shield className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{dashboardData.users.admins}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Managers</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{dashboardData.users.managers}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Users</CardTitle>
                <Users className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{dashboardData.users.regular}</div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending</CardTitle>
                <Clock className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{dashboardData.users.pending}</div>
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
                  {dashboardData.recentUsers.map((user) => (
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
                          {!user.isApproved && (
                            <Badge variant="outline" className="ml-2 text-orange-600">
                              Pending
                            </Badge>
                          )}
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
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest system activities and user actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dashboardData.recentActivities.length > 0 ? (
                <div className="space-y-4">
                  {dashboardData.recentActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="p-2 rounded-full bg-blue-100">
                        <Activity className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{activity.action}</div>
                        <div className="text-sm text-muted-foreground">
                          {activity.entityType}: {activity.entityName || 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          By {activity.userName} • {new Date(activity.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">No recent activities</p>
                  <p className="text-xs text-gray-400">Activities will appear here as users interact with the system</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-green-600" />
                System Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-green-600" />
                      <span>Database</span>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {dashboardData.systemHealth.database}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span>Authentication</span>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {dashboardData.systemHealth.authentication}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <HardDrive className="h-4 w-4 text-green-600" />
                      <span>File Storage</span>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {dashboardData.systemHealth.fileStorage}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center p-3 rounded-lg border">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span>Report Generation</span>
                    </div>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      {dashboardData.systemHealth.reportGeneration}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


    </div>
  )
}