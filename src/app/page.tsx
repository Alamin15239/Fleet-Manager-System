'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Truck, Wrench, AlertTriangle, Plus, Activity, DollarSign } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions } from '@/contexts/permissions-context'
import { useLanguage } from '@/contexts/language-context'
import { DatabaseStorageMonitor } from '@/components/database-storage-monitor'
import { TruckLoader } from '@/components/ui/truck-loader'

const DashboardCharts = dynamic(() => import('@/components/dashboard-charts'), {
  loading: () => <div aria-hidden="true" className="grid grid-cols-1 gap-4 xl:grid-cols-7"><div className="h-[390px] animate-pulse rounded-2xl border bg-muted/30 xl:col-span-4" /><div className="h-[390px] animate-pulse rounded-2xl border bg-muted/30 xl:col-span-3" /></div>,
})

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
  serviceType: string
  datePerformed: string
  totalCost: number
  status: string
  vehicleName?: string | null
}

export default function Dashboard() {
  const router = useRouter()
  const { isAuthenticated, isLoading, user } = useAuth()
  const { canAccess, canCreate, loading: permissionsLoading } = usePermissions()
  const canViewDashboard = canAccess('dashboard')
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
    if (isLoading || permissionsLoading) return
    
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }

    if (canViewDashboard) fetchDashboardData()
    else setLoading(false)
  }, [isAuthenticated, isLoading, permissionsLoading, canViewDashboard, router])

  const fetchDashboardData = async () => {
    try {
      const response = await apiGet('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        
        // Only set stats if there's actual user data
        const hasRealData = data.totalTrucks > 0
          || data.totalMaintenanceCost > 0
          || (Array.isArray(data.recentMaintenance) && data.recentMaintenance.length > 0)
          || (Array.isArray(data.monthlyTrends) && data.monthlyTrends.length > 0)
        
        setStats({
          totalTrucks: hasRealData ? data.totalTrucks : 0,
          activeTrucks: hasRealData ? data.activeTrucks : 0,
          upcomingMaintenance: hasRealData ? data.upcomingMaintenance : 0,
          overdueRepairs: hasRealData ? data.overdueRepairs : 0,
          totalMaintenanceCost: hasRealData ? data.totalMaintenanceCost : 0,
          recentTrucks: hasRealData ? data.recentTrucks : [],
          recentMaintenance: hasRealData ? data.recentMaintenance : []
        })
        
        const monthlyTrends = Array.isArray(data.monthlyTrends) ? data.monthlyTrends : []
        setMonthlyCostData(monthlyTrends.map((point: { month: string; cost: number }) => ({
          month: point.month,
          cost: Number(point.cost) || 0,
        })))

        const maintenanceByType = data.maintenanceByType && typeof data.maintenanceByType === 'object'
          ? data.maintenanceByType as Record<string, number>
          : {}
        setMaintenanceTypeData(Object.entries(maintenanceByType).map(([type, count]) => ({
          type,
          count: Number(count) || 0,
        })))
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

  if (isLoading || permissionsLoading || (isAuthenticated && loading)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <TruckLoader size="lg" className="mx-auto" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Will redirect to login
  }

  if (!canViewDashboard) {
    return <div className="container mx-auto p-6"><Card><CardContent className="p-6 text-muted-foreground"><LocalizedText>You do not have permission to view the dashboard.</LocalizedText></CardContent></Card></div>
  }

  return (
    <div className="container mx-auto space-y-6 px-4 py-5 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('dashboard.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">{t('dashboard.subtitle')}</p>
        </div>
        {canAccess('trucks') && (
          <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => router.push('/trucks')}>
            <Truck className="me-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
            {t('dashboard.viewFleet')}
          </Button>
        )}
      </div>

      {/* Database Storage Monitor */}
      <DatabaseStorageMonitor />
      
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="min-w-0 text-xs font-medium leading-snug sm:text-sm">{t('dashboard.totalTrucks')}</CardTitle>
            <Truck className="h-9 w-9 shrink-0 rounded-xl bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{stats.totalTrucks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeTrucks} {t('dashboard.activeTrucks')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="min-w-0 text-xs font-medium leading-snug sm:text-sm">{t('dashboard.upcomingMaintenance')}</CardTitle>
            <Wrench className="h-9 w-9 shrink-0 rounded-xl bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tracking-tight tabular-nums sm:text-2xl">{stats.upcomingMaintenance}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.dueWithin30Days')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="min-w-0 text-xs font-medium leading-snug sm:text-sm">{t('dashboard.overdueRepairs')}</CardTitle>
            <AlertTriangle className="h-9 w-9 shrink-0 rounded-xl bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold tracking-tight tabular-nums text-destructive sm:text-2xl">{stats.overdueRepairs}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.requireAttention')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="min-w-0 text-xs font-medium leading-snug sm:text-sm">{t('dashboard.monthlyMaintenanceCost')}</CardTitle>
            <DollarSign className="h-9 w-9 shrink-0 rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">﷼{((stats.totalMaintenanceCost || 0) / 6).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.averageMonthlyCost')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="min-w-0 text-xs font-medium leading-snug sm:text-sm">{t('dashboard.totalCost6mo')}</CardTitle>
            <Activity className="h-9 w-9 shrink-0 rounded-xl bg-violet-500/10 p-2 text-violet-600 dark:text-violet-400" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold tracking-tight tabular-nums sm:text-2xl">﷼{(stats.totalMaintenanceCost || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.last6Months')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Recent Activity */}
      {monthlyCostData.length > 0 && maintenanceTypeData.length > 0 && stats.totalTrucks > 0 ? (
        <DashboardCharts
          monthlyCostData={monthlyCostData}
          maintenanceTypeData={maintenanceTypeData}
          monthlyTitle={t('dashboard.monthlyMaintenanceCosts')}
          monthlyDescription={t('dashboard.costTrends')}
          typesTitle={t('dashboard.maintenanceTypes')}
          typesDescription={t('dashboard.serviceDistribution')}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t('dashboard.noDataAvailable')}</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {t('dashboard.noChartDataDescription')}
            </p>
            {stats.totalTrucks === 0 && canAccess('trucks') && canCreate('trucks') && (
              <Button className="mt-4" onClick={() => router.push('/trucks')}>
                <Plus className="h-4 w-4 mr-2" />
                {t('dashboard.addFirstTruck')}
              </Button>
            )}
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
                      <div key={truck.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <Truck className="h-9 w-9 shrink-0 rounded-xl bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400" />
                          <div className="min-w-0">
                            <h3 className="font-semibold">{truck.year} {truck.make} {truck.model}</h3>
                            <p className="text-sm text-muted-foreground">
                              {truck.licensePlate} • {(truck.currentMileage || 0).toLocaleString()} km
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
                      <div key={record.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3 sm:p-4">
                        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                          <Wrench className="h-9 w-9 shrink-0 rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400" />
                          <div className="min-w-0">
                            <h3 className="font-semibold">{record.serviceType}</h3>
                            <p className="text-sm text-muted-foreground">
                              {record.vehicleName || 'Unknown vehicle'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(record.datePerformed).toLocaleDateString()} • {typeof record.totalCost === 'number' ? (record.totalCost || 0).toLocaleString() : '0'}
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
