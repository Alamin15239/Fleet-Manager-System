'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, Wrench, AlertTriangle, TrendingUp, Plus, Activity } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/currency'
import { DatabaseStorageMonitor } from '@/components/database-storage-monitor'

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
  recentTrucks: any[]
  recentMaintenance: any[]
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
    recentTrucks: [],
    recentMaintenance: []
  })
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      const response = await fetch('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Fleet management overview</p>
        </div>
        <div className="flex gap-2">
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

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trucks</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.totalTrucks}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? '...' : stats.activeTrucks} active trucks
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trailers</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.totalTrailers}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? '...' : stats.activeTrailers} active trailers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.upcomingMaintenance}</div>
            <p className="text-xs text-muted-foreground">
              {loading ? '...' : stats.overdueRepairs} overdue repairs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Costs</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : formatCurrency(stats.totalMaintenanceCost)}
            </div>
            <p className="text-xs text-muted-foreground">
              Lifetime maintenance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/trucks')}>
          <CardContent className="p-6 text-center">
            <Truck className="h-12 w-12 mx-auto mb-2 text-blue-600" />
            <h3 className="font-semibold">Manage Trucks</h3>
            <p className="text-sm text-muted-foreground">View and manage your fleet</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/maintenance')}>
          <CardContent className="p-6 text-center">
            <Wrench className="h-12 w-12 mx-auto mb-2 text-green-600" />
            <h3 className="font-semibold">Maintenance</h3>
            <p className="text-sm text-muted-foreground">Schedule and track maintenance</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/tire-management')}>
          <CardContent className="p-6 text-center">
            <Activity className="h-12 w-12 mx-auto mb-2 text-orange-600" />
            <h3 className="font-semibold">Tire Management</h3>
            <p className="text-sm text-muted-foreground">Manage tire inventory</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Trucks</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Loading...</div>
            ) : stats.recentTrucks.length > 0 ? (
              <div className="space-y-2">
                {stats.recentTrucks.slice(0, 5).map((truck) => (
                  <div key={truck.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <div className="font-medium">{truck.make} {truck.model}</div>
                      <div className="text-sm text-muted-foreground">{truck.licensePlate}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {truck.status}
                    </div>
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
            <CardTitle>Recent Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">Loading...</div>
            ) : stats.recentMaintenance.length > 0 ? (
              <div className="space-y-2">
                {stats.recentMaintenance.slice(0, 5).map((maintenance) => (
                  <div key={maintenance.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <div className="font-medium">{maintenance.serviceType}</div>
                      <div className="text-sm text-muted-foreground">
                        {maintenance.vehicleName || 'Unknown Vehicle'}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(maintenance.totalCost)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No maintenance records yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Database Storage Monitor */}
      <DatabaseStorageMonitor />
    </div>
  )
}