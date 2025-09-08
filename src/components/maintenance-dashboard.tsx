'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  Wrench, 
  Clock, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Calendar,
  Truck
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface MaintenanceSummary {
  totalCost: number
  totalDowntime: number
  averageCost: number
  predictedCount: number
  completedCount: number
  inProgressCount: number
  scheduledCount: number
}

interface MaintenanceDashboardProps {
  summary?: MaintenanceSummary
  totalTrucks?: number
  activeTrucks?: number
}

export default function MaintenanceDashboard({ 
  summary, 
  totalTrucks = 43, 
  activeTrucks = 41 
}: MaintenanceDashboardProps) {
  const [stats, setStats] = useState<MaintenanceSummary>({
    totalCost: 0,
    totalDowntime: 0,
    averageCost: 0,
    predictedCount: 0,
    completedCount: 0,
    inProgressCount: 0,
    scheduledCount: 0
  })

  useEffect(() => {
    if (summary) {
      setStats(summary)
    }
  }, [summary])

  // Calculate monthly cost (mock calculation)
  const monthlyCost = stats.totalCost / 6 // Assuming 6 months of data
  const sixMonthCost = stats.totalCost

  // Calculate upcoming and overdue maintenance (mock data)
  const upcomingMaintenance = stats.scheduledCount
  const overdueMaintenance = Math.max(0, stats.inProgressCount - 2) // Mock overdue calculation

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Trucks</CardTitle>
          <Truck className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalTrucks}</div>
          <p className="text-xs text-muted-foreground">
            {activeTrucks} active vehicles
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Upcoming Maintenance</CardTitle>
          <Calendar className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">{upcomingMaintenance}</div>
          <p className="text-xs text-muted-foreground">
            Due within 30 days
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overdue Repairs</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{overdueMaintenance}</div>
          <p className="text-xs text-muted-foreground">
            Require immediate attention
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Monthly Maintenance Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(monthlyCost)}</div>
          <p className="text-xs text-muted-foreground">
            Average monthly cost
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost (6mo)</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(sixMonthCost)}</div>
          <p className="text-xs text-muted-foreground">
            Last 6 months
          </p>
        </CardContent>
      </Card>
    </div>
  )
}