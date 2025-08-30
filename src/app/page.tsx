'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Truck, Wrench, AlertTriangle, TrendingUp, Plus, Activity, DollarSign } from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid } from 'recharts'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { DatabaseStorageMonitor } from '@/components/database-storage-monitor'

interface DashboardStats {
  totalTrucks: number
  activeTrucks: number
  upcomingMaintenance: number
  overdueRepairs: number
  totalMaintenanceCost: number
  recentTrucks: any[]
  recentMaintenance: any[]
}

interface Truck {
  id: string
  vin: string
  make: string
  model: string
  year: number
  licensePlate: string
  currentMileage: number
  status: string
}

interface MaintenanceRecord {
  id: string
  truckId: string
  serviceType: string
  datePerformed: string
  totalCost: number
  status: string
  truck: Truck
}

export default function Dashboard() {
  const router = useRouter()
  const { isAuthenticated, isLoading, user } = useAuth()
  const { t } = useLanguage()
  const [stats, setStats] = useState<DashboardStats>({
    totalTrucks: 0,
    activeTrucks: 0,
    upcomingMaintenance: 0,
    overdueRepairs: 0,
    totalMaintenanceCost: 0,
    recentTrucks: [],
    recentMaintenance: []
  })
  
  const [monthlyCostData, setMonthlyCostData] = useState<any[]>([])
  const [maintenanceTypeData, setMaintenanceTypeData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoading) return
    
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    
    // Only fetch data if authenticated
    if (isAuthenticated) {
      fetchDashboardData()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, isLoading, router])

  const fetchDashboardData = async () => {
    try {
      const response = await apiGet('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        
        // Only set stats if there's actual user data
        const hasRealData = data.totalTrucks > 0 || data.totalMaintenanceCost > 0
        
        setStats({
          totalTrucks: hasRealData ? data.totalTrucks : 0,
          activeTrucks: hasRealData ? data.activeTrucks : 0,
          upcomingMaintenance: hasRealData ? data.upcomingMaintenance : 0,
          overdueRepairs: hasRealData ? data.overdueRepairs : 0,
          totalMaintenanceCost: hasRealData ? data.totalMaintenanceCost : 0,
          recentTrucks: hasRealData ? data.recentTrucks : [],
          recentMaintenance: hasRealData ? data.recentMaintenance : []
        })
        
        // Only generate chart data if there are real maintenance records
        if (hasRealData && data.monthlyMaintenanceData && data.monthlyMaintenanceData.length > 0) {
          const monthlyData = generateMonthlyCostData(data.monthlyMaintenanceData)
          setMonthlyCostData(monthlyData)
          
          const typeData = generateMaintenanceTypeData(data.monthlyMaintenanceData)
          setMaintenanceTypeData(typeData)
        } else {
          // Clear chart data if no real data exists
          setMonthlyCostData([])
          setMaintenanceTypeData([])
        }
      } else {
        console.error('Failed to fetch dashboard data')
        // Set empty state on error
        setStats({
          totalTrucks: 0,
          activeTrucks: 0,
          upcomingMaintenance: 0,
          overdueRepairs: 0,
          totalMaintenanceCost: 0,
          recentTrucks: [],
          recentMaintenance: []
        })
        setMonthlyCostData([])
        setMaintenanceTypeData([])
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      // Set empty state on error
      setStats({
        totalTrucks: 0,
        activeTrucks: 0,
        upcomingMaintenance: 0,
        overdueRepairs: 0,
        totalMaintenanceCost: 0,
        recentTrucks: [],
        recentMaintenance: []
      })
      setMonthlyCostData([])
      setMaintenanceTypeData([])
    } finally {
      setLoading(false)
    }
  }

  const generateMonthlyCostData = (maintenanceRecords: any[]) => {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const monthlyTotals = new Array(6).fill(0).map((_, index) => ({
      month: monthNames[index],
      cost: 0
    }))

    // Only process records that have actual costs and valid dates
    const validRecords = maintenanceRecords.filter(record => 
      record && 
      record.datePerformed && 
      record.totalCost > 0 &&
      !isNaN(new Date(record.datePerformed).getTime())
    )

    validRecords.forEach(record => {
      try {
        const recordDate = new Date(record.datePerformed)
        const monthIndex = recordDate.getMonth()
        if (monthIndex >= 0 && monthIndex < 6) {
          monthlyTotals[monthIndex].cost += record.totalCost || 0
        }
      } catch (error) {
        console.warn('Invalid date in maintenance record:', record)
      }
    })

    return monthlyTotals
  }

  const generateMaintenanceTypeData = (maintenanceRecords: any[]) => {
    const typeCounts: Record<string, number> = {}
    
    // Only process valid records with service types
    const validRecords = maintenanceRecords.filter(record => 
      record && 
      record.serviceType &&
      record.serviceType.trim() !== ''
    )
    
    validRecords.forEach(record => {
      const type = record.serviceType || 'Other'
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })

    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count
    }))
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800'
      case 'INACTIVE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getMaintenanceStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
      case 'SCHEDULED': return 'bg-yellow-100 text-yellow-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          {/* Button removed - Simple Tire Management deleted */}
        </div>
      </div>

      {/* Database Storage Monitor */}
      <DatabaseStorageMonitor />
      
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalTrucks')}</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrucks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeTrucks} {t('dashboard.activeTrucks')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.upcomingMaintenance')}</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingMaintenance}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.dueWithin30Days')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.overdueRepairs')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdueRepairs}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.requireAttention')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.monthlyMaintenanceCost')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(stats.totalMaintenanceCost / 6).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.averageMonthlyCost')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalCost6mo')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalMaintenanceCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.last6Months')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Recent Activity */}
      {monthlyCostData.length > 0 && maintenanceTypeData.length > 0 && stats.totalTrucks > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-4">
            <CardHeader>
              <CardTitle>{t('dashboard.monthlyMaintenanceCosts')}</CardTitle>
              <CardDescription>{t('dashboard.costTrends')}</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ChartContainer config={{}} className="h-[300px]">
                <LineChart data={monthlyCostData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="cost" stroke="#8884d8" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="col-span-3">
            <CardHeader>
              <CardTitle>{t('dashboard.maintenanceTypes')}</CardTitle>
              <CardDescription>{t('dashboard.serviceDistribution')}</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              <ChartContainer config={{}} className="h-[300px]">
                <BarChart data={maintenanceTypeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#82ca9d" />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('dashboard.noDataAvailable')}</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Add trucks and maintenance records to see analytics and charts here. 
              Start by adding your first truck to begin tracking your fleet maintenance.
            </p>
            <Button className="mt-4" onClick={() => router.push('/trucks')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('dashboard.addFirstTruck')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {stats.totalTrucks > 0 ? (
        <Tabs defaultValue="trucks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="trucks">{t('dashboard.recentTrucks')}</TabsTrigger>
            <TabsTrigger value="maintenance">{t('dashboard.recentMaintenance')}</TabsTrigger>
          </TabsList>

          <TabsContent value="trucks" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.recentlyAddedTrucks')}</CardTitle>
                <CardDescription>{t('dashboard.latestAdditions')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.recentTrucks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {t('dashboard.noTrucksFound')}
                    </div>
                  ) : (
                    stats.recentTrucks.map((truck: Truck) => (
                      <div key={truck.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Truck className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <h3 className="font-semibold">{truck.year} {truck.make} {truck.model}</h3>
                            <p className="text-sm text-muted-foreground">
                              {truck.licensePlate} • {truck.currentMileage.toLocaleString()} miles
                            </p>
                          </div>
                        </div>
                        <Badge className={getStatusColor(truck.status)}>
                          {truck.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.recentMaintenanceRecords')}</CardTitle>
                <CardDescription>{t('dashboard.latestServiceActivities')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats.recentMaintenance.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {t('dashboard.noMaintenanceFound')}
                    </div>
                  ) : (
                    stats.recentMaintenance.map((record: MaintenanceRecord) => (
                      <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <Wrench className="h-8 w-8 text-muted-foreground" />
                          <div>
                            <h3 className="font-semibold">{record.serviceType}</h3>
                            <p className="text-sm text-muted-foreground">
                              {record.truck.year} {record.truck.make} {record.truck.model} • {record.truck.licensePlate}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(record.datePerformed).toLocaleDateString()} • {typeof record.totalCost === 'number' ? record.totalCost.toLocaleString() : '0'}
                            </p>
                          </div>
                        </div>
                        <Badge className={getMaintenanceStatusColor(record.status)}>
                          {record.status}
                        </Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}