'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Shield, 
  Users, 
  Activity, 
  Search, 
  Filter,
  Download,
  Eye,
  Calendar,
  Clock,
  User,
  Database,
  FileText
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'

interface AuditLog {
  id: string
  action: string
  entityType: string
  entityId: string
  userId: string
  userName?: string
  userEmail?: string
  userRole?: string
  changes?: any
  ipAddress?: string
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface UserActivity {
  id: string
  userId: string
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  oldValues?: any
  newValues?: any
  ipAddress?: string
  createdAt: string
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface LoginHistory {
  id: string
  userId: string
  loginTime: string
  logoutTime?: string
  ipAddress?: string
  sessionDuration?: number
  isActive: boolean
  user?: {
    id: string
    name: string
    email: string
    role: string
  }
}

interface User {
  id: string
  email: string
  name?: string
  role: string
  isActive: boolean
}

export default function AdminMonitoring() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [userActivities, setUserActivities] = useState<UserActivity[]>([])
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [filters, setFilters] = useState({
    userId: 'all',
    action: 'all',
    entityType: 'all',
    startDate: '',
    endDate: '',
    limit: '50'
  })
  const [activeTab, setActiveTab] = useState('audit-logs')
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
      fetchUsers()
      fetchData()
    }
  }, [isMounted, isAuthenticated, isAdmin, activeTab, filters])

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

  const fetchUsers = async () => {
    if (!isMounted || !isAuthenticated || !isAdmin) return
    
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const usersData = await response.json()
        // Handle API response format: { success: true, data: users, pagination: ... }
        const usersArray = Array.isArray(usersData) ? usersData : (usersData.data || [])
        setUsers(usersArray)
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchData = async () => {
    if (!isMounted || !isAuthenticated || !isAdmin) return
    
    setLoading(true)
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        console.log('No auth token available, skipping data fetch')
        setLoading(false)
        return
      }

      const queryParams = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') queryParams.append(key, value)
      })

      if (activeTab === 'audit-logs') {
        const response = await fetch(`/api/admin/audit-logs?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          setAuditLogs(data.logs || [])
        }
      } else if (activeTab === 'user-activities') {
        const response = await fetch(`/api/admin/activities?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          setUserActivities(data.activities || [])
        }
      } else if (activeTab === 'login-history') {
        const response = await fetch(`/api/admin/login-history?${queryParams}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        
        if (response.ok) {
          const data = await response.json()
          setLoginHistory(data.history || [])
        }
      }
    } catch (error) {
      console.error('Error fetching monitoring data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800'
      case 'UPDATE': return 'bg-blue-100 text-blue-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      case 'LOGIN': return 'bg-green-100 text-green-800'
      case 'LOGOUT': return 'bg-orange-100 text-orange-800'
      case 'VIEW': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEntityTypeBadgeColor = (entityType: string) => {
    switch (entityType) {
      case 'TRUCK': return 'bg-blue-100 text-blue-800'
      case 'USER': return 'bg-purple-100 text-purple-800'
      case 'MAINTENANCE_RECORD': return 'bg-green-100 text-green-800'
      case 'MECHANIC': return 'bg-orange-100 text-orange-800'
      case 'SETTINGS': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  const exportData = () => {
    let data: any[] = []
    let filename = ''

    if (activeTab === 'audit-logs') {
      data = auditLogs
      filename = 'audit-logs'
    } else if (activeTab === 'user-activities') {
      data = userActivities
      filename = 'user-activities'
    } else if (activeTab === 'login-history') {
      data = loginHistory
      filename = 'login-history'
    }

    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(item => Object.values(item).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Show loading state while checking authentication
  if (!isMounted) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  // Show access denied if not authenticated or not admin
  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-red-600" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Only administrators can view this page.</p>
          </div>
        </div>
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
            System Monitoring
          </h1>
          <p className="text-muted-foreground">
            Monitor user activities, audit logs, and system access
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin')}>
            <Shield className="h-4 w-4 mr-2" />
            Admin Dashboard
          </Button>
          <Button onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div>
              <label className="text-sm font-medium">User</label>
              <Select value={filters.userId} onValueChange={(value) => setFilters({...filters, userId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Action</label>
              <Select value={filters.action} onValueChange={(value) => setFilters({...filters, action: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="CREATE">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                  <SelectItem value="LOGIN">Login</SelectItem>
                  <SelectItem value="LOGOUT">Logout</SelectItem>
                  <SelectItem value="VIEW">View</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Entity Type</label>
              <Select value={filters.entityType} onValueChange={(value) => setFilters({...filters, entityType: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  <SelectItem value="TRUCK">Truck</SelectItem>
                  <SelectItem value="USER">User</SelectItem>
                  <SelectItem value="MAINTENANCE_RECORD">Maintenance Record</SelectItem>
                  <SelectItem value="MECHANIC">Mechanic</SelectItem>
                  <SelectItem value="SETTINGS">Settings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Start Date</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({...filters, startDate: e.target.value})}
              />
            </div>

            <div>
              <label className="text-sm font-medium">End Date</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({...filters, endDate: e.target.value})}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Limit</label>
              <Select value={filters.limit} onValueChange={(value) => setFilters({...filters, limit: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="audit-logs" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Audit Logs
          </TabsTrigger>
          <TabsTrigger value="user-activities" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            User Activities
          </TabsTrigger>
          <TabsTrigger value="login-history" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Login History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit-logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>
                Track all changes made to system data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Changes</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.userName || log.user?.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground">
                                {log.userEmail || log.user?.email || 'Unknown'}
                              </div>
                              <Badge variant="outline" className="text-xs mt-1">
                                {log.userRole || log.user?.role || 'Unknown'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionBadgeColor(log.action)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getEntityTypeBadgeColor(log.entityType)}>
                              {log.entityType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm max-w-xs">
                              {log.changes ? (
                                <pre className="text-xs bg-gray-50 p-1 rounded overflow-x-auto">
                                  {JSON.stringify(log.changes, null, 2)}
                                </pre>
                              ) : (
                                <span className="text-muted-foreground">No changes</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {log.ipAddress || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{format(new Date(log.createdAt), 'MMM dd, yyyy')}</div>
                              <div className="text-muted-foreground">
                                {format(new Date(log.createdAt), 'HH:mm:ss')}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user-activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Activities</CardTitle>
              <CardDescription>
                Monitor all user actions in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userActivities.map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{activity.user?.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground">
                                {activity.user?.email || 'Unknown'}
                              </div>
                              <Badge variant="outline" className="text-xs mt-1">
                                {activity.user?.role || 'Unknown'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionBadgeColor(activity.action)}>
                              {activity.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getEntityTypeBadgeColor(activity.entityType)}>
                              {activity.entityType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm max-w-xs">
                              {activity.entityName && (
                                <div className="font-medium">{activity.entityName}</div>
                              )}
                              {activity.newValues && (
                                <pre className="text-xs bg-gray-50 p-1 rounded overflow-x-auto mt-1">
                                  {JSON.stringify(activity.newValues, null, 2)}
                                </pre>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {activity.ipAddress || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{format(new Date(activity.createdAt), 'MMM dd, yyyy')}</div>
                              <div className="text-muted-foreground">
                                {format(new Date(activity.createdAt), 'HH:mm:ss')}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="login-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Login History</CardTitle>
              <CardDescription>
                Track user login and logout times
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Login Time</TableHead>
                        <TableHead>Logout Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loginHistory.map((history) => (
                        <TableRow key={history.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{history.user?.name || 'Unknown'}</div>
                              <div className="text-sm text-muted-foreground">
                                {history.user?.email || 'Unknown'}
                              </div>
                              <Badge variant="outline" className="text-xs mt-1">
                                {history.user?.role || 'Unknown'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{format(new Date(history.loginTime), 'MMM dd, yyyy')}</div>
                              <div className="text-muted-foreground">
                                {format(new Date(history.loginTime), 'HH:mm:ss')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {history.logoutTime ? (
                              <div className="text-sm">
                                <div>{format(new Date(history.logoutTime), 'MMM dd, yyyy')}</div>
                                <div className="text-muted-foreground">
                                  {format(new Date(history.logoutTime), 'HH:mm:ss')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Still logged in</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDuration(history.sessionDuration)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {history.ipAddress || 'Unknown'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={history.isActive ? 'default' : 'secondary'}>
                              {history.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}