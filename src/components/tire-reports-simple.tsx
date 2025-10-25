'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Download, 
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  Truck,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { apiGet } from '@/lib/api'

interface ReportData {
  totalTires: number
  totalVehicles: number
  totalDrivers: number
  manufacturerStats: { name: string; count: number; percentage: number }[]
  originStats: { name: string; count: number; percentage: number }[]
  vehicleTypeStats: { trucks: number; trailers: number }
  recentTires: any[]
}

export default function TireReportsSimple() {
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start: format(new Date(2024, 0, 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })

  useEffect(() => {
    generateReport()
  }, [])

  const generateReport = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiGet(`/api/tires?limit=1000&startDate=${dateRange.start}&endDate=${dateRange.end}`)
      
      if (response.ok) {
        const data = await response.json()
        const tires = data.tires || []

        // Calculate statistics
        const totalTires = tires.reduce((sum: number, tire: any) => sum + (tire.quantity || 1), 0)
        const uniqueVehicles = new Set([
          ...tires.map((t: any) => t.plateNumber).filter(Boolean),
          ...tires.map((t: any) => t.trailerNumber).filter(Boolean)
        ]).size
        const uniqueDrivers = new Set(tires.map((t: any) => t.driverName).filter(Boolean)).size

        // Manufacturer stats
        const manufacturerCounts = tires.reduce((acc: any, tire: any) => {
          acc[tire.manufacturer] = (acc[tire.manufacturer] || 0) + (tire.quantity || 1)
          return acc
        }, {})
        const manufacturerStats = Object.entries(manufacturerCounts)
          .map(([name, count]: [string, any]) => ({
            name,
            count,
            percentage: Math.round((count / totalTires) * 100)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        // Origin stats
        const originCounts = tires.reduce((acc: any, tire: any) => {
          acc[tire.origin] = (acc[tire.origin] || 0) + (tire.quantity || 1)
          return acc
        }, {})
        const originStats = Object.entries(originCounts)
          .map(([name, count]: [string, any]) => ({
            name,
            count,
            percentage: Math.round((count / totalTires) * 100)
          }))
          .sort((a, b) => b.count - a.count)

        // Vehicle type stats
        const truckTires = tires.filter((t: any) => t.plateNumber && !t.trailerNumber)
          .reduce((sum: number, t: any) => sum + (t.quantity || 1), 0)
        const trailerTires = tires.filter((t: any) => t.trailerNumber)
          .reduce((sum: number, t: any) => sum + (t.quantity || 1), 0)

        setReportData({
          totalTires,
          totalVehicles: uniqueVehicles,
          totalDrivers: uniqueDrivers,
          manufacturerStats,
          originStats,
          vehicleTypeStats: { trucks: truckTires, trailers: trailerTires },
          recentTires: tires.slice(0, 10)
        })
      } else {
        setError('Failed to generate report')
      }
    } catch (error) {
      setError('Error generating report')
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    if (!reportData) return

    const csvContent = [
      'TIRE FLEET SUMMARY REPORT',
      `Generated: ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
      `Date Range: ${dateRange.start} to ${dateRange.end}`,
      '',
      'OVERVIEW',
      `Total Tires,${reportData.totalTires}`,
      `Total Vehicles,${reportData.totalVehicles}`,
      `Total Drivers,${reportData.totalDrivers}`,
      `Truck Tires,${reportData.vehicleTypeStats.trucks}`,
      `Trailer Tires,${reportData.vehicleTypeStats.trailers}`,
      '',
      'TOP MANUFACTURERS',
      'Manufacturer,Count,Percentage',
      ...reportData.manufacturerStats.map(m => `${m.name},${m.count},${m.percentage}%`),
      '',
      'ORIGIN BREAKDOWN',
      'Origin,Count,Percentage',
      ...reportData.originStats.map(o => `${o.name},${o.count},${o.percentage}%`)
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tire-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Tire Analytics & Reports</h2>
          <p className="text-muted-foreground">Fleet tire statistics and insights</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateReport} disabled={loading}>
            <BarChart3 className="mr-2 h-4 w-4" />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          {reportData && (
            <Button onClick={downloadCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Date Range */}
      <Card>
        <CardHeader>
          <CardTitle>Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Start Date</Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div>
              <Label>End Date</Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
          </div>
          <Button onClick={generateReport} className="mt-4" disabled={loading}>
            Update Report
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {reportData && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Total Tires</p>
                    <p className="text-2xl font-bold">{reportData.totalTires}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Truck className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Vehicles</p>
                    <p className="text-2xl font-bold">{reportData.totalVehicles}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Truck Tires</p>
                    <p className="text-2xl font-bold">{reportData.vehicleTypeStats.trucks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <PieChart className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground">Trailer Tires</p>
                    <p className="text-2xl font-bold">{reportData.vehicleTypeStats.trailers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Manufacturers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Tire Manufacturers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.manufacturerStats.map((manufacturer, index) => (
                    <div key={manufacturer.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="font-medium">{manufacturer.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{manufacturer.count} tires</span>
                        <Badge>{manufacturer.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Origin Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>Tire Origins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.originStats.map((origin, index) => (
                    <div key={origin.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="font-medium">{origin.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{origin.count} tires</span>
                        <Badge>{origin.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vehicle Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Fleet Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <Truck className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold">Truck Tires</h3>
                  <p className="text-3xl font-bold text-blue-600">{reportData.vehicleTypeStats.trucks}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((reportData.vehicleTypeStats.trucks / reportData.totalTires) * 100)}% of fleet
                  </p>
                </div>
                <div className="text-center p-6 bg-orange-50 rounded-lg">
                  <Package className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold">Trailer Tires</h3>
                  <p className="text-3xl font-bold text-orange-600">{reportData.vehicleTypeStats.trailers}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((reportData.vehicleTypeStats.trailers / reportData.totalTires) * 100)}% of fleet
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}