'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from 'recharts'
import { 
  TrendingUp, 
  Package, 
  Truck, 
  Users, 
  Calendar,
  RefreshCw,
  Download
} from 'lucide-react'
import { apiGet } from '@/lib/api'

interface AnalyticsData {
  summary: {
    totalTires: number
    recentTires: number
    totalVehicles: number
    totalDrivers: number
  }
  byManufacturer: Array<{
    manufacturer: string
    count: number
    quantity: number
  }>
  byOrigin: Array<{
    origin: string
    count: number
    quantity: number
  }>
  byVehicle: Array<{
    plateNumber: string
    count: number
    quantity: number
  }>
  byDriver: Array<{
    driverName: string
    count: number
    quantity: number
  }>
  monthlyData: Array<{
    month: string
    year: number
    count: number
    quantity: number
  }>
  topVehicles: Array<{
    plateNumber: string
    trailerNumber: string | null
    driverName: string | null
    tireCount: number
  }>
  topDrivers: Array<{
    driverName: string
    tireCount: number
    recordCount: number
  }>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

export default function TireReports() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const response = await apiGet('/api/tires/analytics')
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchAnalytics()
  }

  const handleExport = () => {
    if (!analytics) return

    const csvContent = [
      ['Metric', 'Value'].join(','),
      ['Total Tires', analytics.summary.totalTires].join(','),
      ['Recent Tires (30 days)', analytics.summary.recentTires].join(','),
      ['Total Vehicles', analytics.summary.totalVehicles].join(','),
      ['Total Drivers', analytics.summary.totalDrivers].join(','),
      [''],
      ['Manufacturer', 'Tire Count', 'Total Quantity'].join(','),
      ...analytics.byManufacturer.map(item => [item.manufacturer, item.count, item.quantity].join(',')),
      [''],
      ['Origin', 'Tire Count', 'Total Quantity'].join(','),
      ...analytics.byOrigin.map(item => [item.origin, item.count, item.quantity].join(',')),
      [''],
      ['Top Vehicles', 'Tire Count'].join(','),
      ...analytics.topVehicles.map(item => [`${item.plateNumber} (${item.driverName || 'N/A'})`, item.tireCount].join(',')),
      [''],
      ['Top Drivers', 'Tire Count', 'Records'].join(','),
      ...analytics.topDrivers.map(item => [item.driverName, item.tireCount, item.recordCount].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tire-analytics-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">No analytics data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Tire Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive tire management insights and reports
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tires</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalTires.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Across all vehicles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Additions</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.recentTires.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalVehicles}</div>
            <p className="text-xs text-muted-foreground">
              With tire records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalDrivers}</div>
            <p className="text-xs text-muted-foreground">
              Assigned tires
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Monthly Trends */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Monthly Tire Addition Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="quantity" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Tires Added"
                />
                <Line 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#82ca9d" 
                  strokeWidth={2}
                  name="Records Created"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Manufacturer Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tires by Manufacturer</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.byManufacturer.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="manufacturer" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Origin Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Tires by Origin</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analytics.byOrigin}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ origin, quantity }) => `${origin}: ${quantity}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="quantity"
                >
                  {analytics.byOrigin.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Vehicles */}
        <Card>
          <CardHeader>
            <CardTitle>Top Vehicles by Tire Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topVehicles.slice(0, 10).map((vehicle, index) => (
                <div key={vehicle.plateNumber} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                    <div>
                      <div className="font-medium">{vehicle.plateNumber}</div>
                      <div className="text-sm text-muted-foreground">
                        {vehicle.driverName || 'N/A'} {vehicle.trailerNumber ? `• ${vehicle.trailerNumber}` : ''}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {vehicle.tireCount} tires
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Drivers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Drivers by Tire Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.topDrivers.slice(0, 10).map((driver, index) => (
                <div key={driver.driverName} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                    <div>
                      <div className="font-medium">{driver.driverName}</div>
                      <div className="text-sm text-muted-foreground">
                        {driver.recordCount} records
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {driver.tireCount} tires
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Vehicle Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Tires by Vehicle (Top 15)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.byVehicle.slice(0, 15)} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="plateNumber" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="quantity" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Driver Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Tires by Driver (Top 15)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.byDriver.slice(0, 15)} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="driverName" type="category" width={80} />
                <Tooltip />
                <Bar dataKey="quantity" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}