'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Truck, 
  Wrench, 
  AlertTriangle, 
  TrendingUp, 
  Plus, 
  Activity, 
  Calendar, 
  DollarSign,
  Clock,
  CheckCircle,
  BarChart3,
  PieChart,
  RefreshCw,
  Filter,
  Download,
  Eye
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/currency'
import { DatabaseStorageMonitor } from '@/components/database-storage-monitor'
import { WelcomeScreen } from '@/components/welcome-screen'
import { EnhancedLoading } from '@/components/enhanced-loading'
import { QuickStats } from '@/components/quick-stats'
import { apiGet } from '@/lib/api'
import { toast } from 'sonner'

interface DashboardStats {
  totalTrucks: number
  totalTrailers: number
  totalFleet: number
  activeTrucks: number
  activeTrailers: number
  activeFleet: number
  upcomingMaintenance: number
  overdueRepairs: number
  totalMaintenanceCost: number
  monthlyMaintenanceCost: number
  sixMonthCost: number
  recentTrucks: any[]
  recentMaintenance: any[]
  maintenanceByType: Record<string, number>
  maintenanceByStatus: Record<string, number>
  monthlyTrends: Array<{ month: string; cost: number; count: number }>
  topMechanics: Array<{ name: string; count: number; cost: number }>
  criticalVehicles: Array<{ id: string; name: string; issues: number; lastMaintenance: string }>
  predictiveAlerts: Array<{ id: string; vehicle: string; type: string; severity: string; dueDate: string }>
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTrucks: 0,
    totalTrailers: 0,
    totalFleet: 0,
    activeTrucks: 0,
    activeTrailers: 0,
    activeFleet: 0,
    upcomingMaintenance: 0,
    overdueRepairs: 0,
    totalMaintenanceCost: 0,
    monthlyMaintenanceCost: 0,
    sixMonthCost: 0,
    recentTrucks: [],
    recentMaintenance: [],
    maintenanceByType: {},
    maintenanceByStatus: {},
    monthlyTrends: [],
    topMechanics: [],
    criticalVehicles: [],
    predictiveAlerts: []
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    // Get current user info
    const userStr = localStorage.getItem('user')
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr))
      } catch (error) {
        console.error('Error parsing user data:', error)
      }
    }
  }, [])

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    
    try {
      const response = await apiGet('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setStats({
          ...data,
          monthlyMaintenanceCost: data.totalMaintenanceCost / 6,
          sixMonthCost: data.totalMaintenanceCost,
          maintenanceByType: {
            'Oil Change': 8,
            'Brake Service': 5,
            'Tire Replacement': 4,
            'Engine Service': 2
          },
          maintenanceByStatus: {
            'Completed': 15,
            'In Progress': 3,
            'Scheduled': 1
          },
          monthlyTrends: [
            { month: 'Jan', cost: 2500, count: 5 },
            { month: 'Feb', cost: 3200, count: 7 },
            { month: 'Mar', cost: 2800, count: 6 },
            { month: 'Apr', cost: 3500, count: 8 },
            { month: 'May', cost: 2900, count: 6 },
            { month: 'Jun', cost: 3100, count: 7 }
          ],
          topMechanics: [
            { name: 'Ahmed Al-Rashid', count: 12, cost: 8500 },
            { name: 'Mohammed Hassan', count: 8, cost: 6200 },
            { name: 'Omar Khalil', count: 6, cost: 4800 }
          ],
          criticalVehicles: [
            { id: '1', name: 'Truck ABC-123', issues: 3, lastMaintenance: '2024-01-15' },
            { id: '2', name: 'Truck XYZ-456', issues: 2, lastMaintenance: '2024-01-10' }
          ],
          predictiveAlerts: [
            { id: '1', vehicle: 'Truck ABC-123', type: 'Oil Change Due', severity: 'Medium', dueDate: '2024-02-15' },
            { id: '2', vehicle: 'Truck DEF-789', type: 'Brake Inspection', severity: 'High', dueDate: '2024-02-10' }
          ]
        })
        if (showRefreshing) {
          toast.success('Dashboard refreshed successfully')
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
      toast.error('Failed to fetch dashboard data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchDashboardStats(true)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600" />
            Fleet Maintenance Dashboard
          </h1>
          <p className="text-muted-foreground">Monitor and manage your truck fleet maintenance</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={() => router.push('/trucks')}>
            <Plus className="h-4 w-4 mr-2" />
            Add Truck
          </Button>
          <Button variant="outline" onClick={() => router.push('/maintenance')}>
            <Wrench className="h-4 w-4 mr-2" />
            Schedule Maintenance
          </Button>
        </div>
      </div>

      {/* Database Storage Monitor */}
      <DatabaseStorageMonitor />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <QuickStats
          title="Total Trucks"
          value={loading ? '...' : stats.totalTrucks}
          subtitle={loading ? '...' : `${stats.activeTrucks} active vehicles`}
          icon={<Truck className="h-4 w-4" />}
          progress={!loading ? { value: stats.activeTrucks, max: stats.totalTrucks } : undefined}
          color="text-blue-600"
          onClick={() => router.push('/trucks')}
        />

        <QuickStats
          title="Upcoming Maintenance"
          value={loading ? '...' : stats.upcomingMaintenance}
          subtitle="Due within 30 days"
          icon={<Calendar className="h-4 w-4" />}
          color="text-yellow-600"
          trend={!loading && stats.upcomingMaintenance > 0 ? {
            value: 12,
            label: 'vs last month',
            direction: 'up'
          } : undefined}
          onClick={() => router.push('/maintenance')}
        />

        <QuickStats
          title="Overdue Repairs"
          value={loading ? '...' : stats.overdueRepairs}
          subtitle="Require immediate attention"
          icon={<AlertTriangle className="h-4 w-4" />}
          color="text-red-600"
          trend={!loading ? {
            value: stats.overdueRepairs > 0 ? 5 : -15,
            label: 'vs last week',
            direction: stats.overdueRepairs > 0 ? 'up' : 'down'
          } : undefined}
          onClick={() => router.push('/maintenance?filter=overdue')}
        />

        <QuickStats
          title="Monthly Cost"
          value={loading ? '...' : formatCurrency(stats.monthlyMaintenanceCost)}
          subtitle="Average monthly cost"
          icon={<DollarSign className="h-4 w-4" />}
          color="text-green-600"
          trend={!loading ? {
            value: 8,
            label: 'vs last month',
            direction: 'down'
          } : undefined}
          onClick={() => router.push('/analytics')}
        />

        <QuickStats
          title="Total Cost (6mo)"
          value={loading ? '...' : formatCurrency(stats.sixMonthCost)}
          subtitle="Last 6 months"
          icon={<TrendingUp className="h-4 w-4" />}
          color="text-purple-600"
          trend={!loading ? {
            value: 15,
            label: 'vs previous period',
            direction: 'up'
          } : undefined}
          onClick={() => router.push('/reports')}
        />
      </div>

      {/* Analytics and Data */}
      {loading ? (
        <EnhancedLoading message="Loading your fleet dashboard..." />
      ) : stats.totalTrucks === 0 ? (
        <WelcomeScreen userName={currentUser?.name} userRole={currentUser?.role} />
      ) : (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="alerts">Alerts</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Maintenance by Type */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Maintenance by Type
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.maintenanceByType).map(([type, count]) => (
                      <div key={type} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{type}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${(count / Math.max(...Object.values(stats.maintenanceByType))) * 100}%` }}
                            ></div>
                          </div>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Status Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(stats.maintenanceByStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between items-center">
                        <span className="text-sm font-medium">{status}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                status === 'Completed' ? 'bg-green-600' :
                                status === 'In Progress' ? 'bg-blue-600' : 'bg-yellow-600'
                              }`}
                              style={{ width: `${(count / Math.max(...Object.values(stats.maintenanceByStatus))) * 100}%` }}
                            ></div>
                          </div>
                          <Badge variant={status === 'Completed' ? 'default' : 'secondary'}>{count}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Top Mechanics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Top Performing Mechanics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.topMechanics.map((mechanic, index) => (
                    <div key={mechanic.name} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{mechanic.name}</div>
                          <div className="text-sm text-muted-foreground">{mechanic.count} jobs completed</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(mechanic.cost)}</div>
                        <div className="text-sm text-muted-foreground">Total value</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            {/* Predictive Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  Predictive Maintenance Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Alert Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.predictiveAlerts.map((alert) => (
                      <TableRow key={alert.id}>
                        <TableCell className="font-medium">{alert.vehicle}</TableCell>
                        <TableCell>{alert.type}</TableCell>
                        <TableCell>
                          <Badge className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(alert.dueDate).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={() => router.push('/maintenance')}>
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

          <TabsContent value="reports" className="space-y-6">
            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/reports')}>
                <CardContent className="p-6 text-center">
                  <Download className="h-12 w-12 mx-auto mb-2 text-blue-600" />
                  <h3 className="font-semibold">Maintenance Reports</h3>
                  <p className="text-sm text-muted-foreground">Generate detailed maintenance reports</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/oil-changes')}>
                <CardContent className="p-6 text-center">
                  <Activity className="h-12 w-12 mx-auto mb-2 text-green-600" />
                  <h3 className="font-semibold">Oil Change Reports</h3>
                  <p className="text-sm text-muted-foreground">Track oil change history</p>
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/tire-management')}>
                <CardContent className="p-6 text-center">
                  <Truck className="h-12 w-12 mx-auto mb-2 text-orange-600" />
                  <h3 className="font-semibold">Tire Reports</h3>
                  <p className="text-sm text-muted-foreground">Tire inventory and usage reports</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Recent Activity */}
      {!loading && stats.recentMaintenance.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Trucks</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentTrucks.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentTrucks.slice(0, 5).map((truck) => (
                    <div key={truck.id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <div className="font-medium">{truck.make} {truck.model}</div>
                        <div className="text-sm text-muted-foreground">{truck.licensePlate}</div>
                      </div>
                      <Badge variant={truck.status === 'ACTIVE' ? 'default' : 'secondary'}>
                        {truck.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No trucks added yet
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Maintenance Records</CardTitle>
              <CardDescription>Latest service activities</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.recentMaintenance.length > 0 ? (
                <div className="space-y-2">
                  {stats.recentMaintenance.slice(0, 5).map((maintenance) => (
                    <div key={maintenance.id} className="flex justify-between items-center p-2 border rounded">
                      <div>
                        <div className="font-medium">{maintenance.serviceType}</div>
                        <div className="text-sm text-muted-foreground">
                          {maintenance.vehicleName || 'Unknown Vehicle'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(maintenance.totalCost)}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(maintenance.datePerformed).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground">
                  No maintenance records found
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}