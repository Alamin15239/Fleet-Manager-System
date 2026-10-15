'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Calendar, 
  TrendingUp, 
  BarChart3, 
  PieChart, 
  Download, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  Info,
  Activity,
  Zap,
  Target,
  Clock
} from 'lucide-react'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Pie, PieChart as RechartsPieChart, Cell, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { apiGet } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { toast } from '@/lib/localized-toast'
import { usePermissions } from '@/contexts/permissions-context'

interface AnalyticsData {
  maintenanceTrends: any[]
  costAnalysis: any[]
  truckPerformance: any[]
  mechanicProductivity: any[]
  predictiveInsights: any[]
  fleetMetrics: {
    uptime: number | null
    totalCost: number
    efficiency: number | null
    utilization: number | null
  }
  kpiTrends: {
    uptimeChange: number | null
    costChange: number | null
    efficiencyChange: number | null
  }
}

export default function AdvancedAnalytics() {
  const { canAccess, loading: permissionsLoading } = usePermissions()
  const canViewAnalytics = canAccess('advanced-analytics')
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    maintenanceTrends: [],
    costAnalysis: [],
    truckPerformance: [],
    mechanicProductivity: [],
    predictiveInsights: [],
    fleetMetrics: {
      uptime: null,
      totalCost: 0,
      efficiency: null,
      utilization: null
    },
    kpiTrends: {
      uptimeChange: null,
      costChange: null,
      efficiencyChange: null
    }
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState('6months')
  const [selectedTruck, setSelectedTruck] = useState('all')
  const [trucks, setTrucks] = useState<any[]>([])

  useEffect(() => {
    if (!permissionsLoading && canViewAnalytics) fetchAnalyticsData()
  }, [selectedPeriod, selectedTruck, permissionsLoading, canViewAnalytics])

  const fetchAnalyticsData = async (showRefreshing = false) => {
    if (showRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    
    try {
      // Fetch trucks for dropdown
      const trucksResponse = await apiGet('/api/trucks?limit=1000')
      if (trucksResponse.ok) {
        const trucksData = await trucksResponse.json()
        setTrucks(trucksData.trucks || [])
      }
      
      // Fetch analytics data
      const response = await apiGet(`/api/analytics?period=${selectedPeriod}&truckId=${selectedTruck}`)
      
      if (response.ok) {
        const data = await response.json()
        
        const fleetMetrics = {
          uptime: null,
          totalCost: data.costAnalysis.reduce((sum: number, cost: any) => sum + cost.cost, 0),
          efficiency: null,
          utilization: null
        }
        const kpiTrends = {
          uptimeChange: null,
          costChange: null,
          efficiencyChange: null
        }
        
        setAnalyticsData({
          ...data,
          fleetMetrics,
          kpiTrends
        })
        
        if (showRefreshing) {
          toast.success('Analytics data refreshed successfully')
        }
      } else {
        setAnalyticsData({
          maintenanceTrends: [],
          costAnalysis: [],
          truckPerformance: [],
          mechanicProductivity: [],
          predictiveInsights: [],
          fleetMetrics: { uptime: null, totalCost: 0, efficiency: null, utilization: null },
          kpiTrends: { uptimeChange: null, costChange: null, efficiencyChange: null }
        })
        toast.error('Failed to fetch analytics data')
      }
    } catch (error) {
      console.error('Error fetching analytics data:', error)
      setAnalyticsData({
        maintenanceTrends: [], costAnalysis: [], truckPerformance: [], mechanicProductivity: [], predictiveInsights: [],
        fleetMetrics: { uptime: null, totalCost: 0, efficiency: null, utilization: null },
        kpiTrends: { uptimeChange: null, costChange: null, efficiencyChange: null }
      })
      toast.error('Failed to fetch analytics data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    fetchAnalyticsData(true)
  }

  const exportData = () => {
    const csvData = [
      ['Metric', 'Value', 'Change'],
      ['Fleet Uptime', 'Not collected', 'Not available'],
      ['Maintenance Costs', formatCurrency(analyticsData.fleetMetrics.totalCost), 'No comparison data'],
      ['Mechanic Efficiency', 'Not measured', 'No labor-hour data']
    ]
    
    const csvContent = csvData.map(row => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fleet-analytics-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Analytics data exported successfully')
  }



  const getInsightColor = (type: string) => {
    switch (type) {
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'info': return 'bg-blue-100 text-blue-800'
      case 'success': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (permissionsLoading) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900" /></div>
  }

  if (!canViewAnalytics) {
    return <div className="container mx-auto p-6"><Card><CardContent className="p-6 text-muted-foreground"><LocalizedText>You do not have permission to view advanced analytics.</LocalizedText></CardContent></Card></div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            Advanced Analytics
          </h1>
          <p className="text-muted-foreground"><LocalizedText>Fleet performance insights and trends</LocalizedText></p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month"><LocalizedText>Last Month</LocalizedText></SelectItem>
              <SelectItem value="3months"><LocalizedText>Last 3 Months</LocalizedText></SelectItem>
              <SelectItem value="6months"><LocalizedText>Last 6 Months</LocalizedText></SelectItem>
              <SelectItem value="1year"><LocalizedText>Last Year</LocalizedText></SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedTruck} onValueChange={setSelectedTruck}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Trucks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all"><LocalizedText>All Trucks</LocalizedText></SelectItem>
              {trucks.map(truck => (
                <SelectItem key={truck.id} value={truck.id}>
                  {truck.licensePlate}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button onClick={exportData}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Fleet Uptime</LocalizedText></CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground"><LocalizedText>Uptime telemetry is not collected.</LocalizedText></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Maintenance Costs</LocalizedText></CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analyticsData.fleetMetrics.totalCost)}</div>
            <p className="text-xs text-muted-foreground"><LocalizedText>Selected period · no prior-period comparison</LocalizedText></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Mechanic Efficiency</LocalizedText></CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground"><LocalizedText>Labor hours are not recorded for efficiency analysis.</LocalizedText></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Fleet Utilization</LocalizedText></CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <p className="text-xs text-muted-foreground"><LocalizedText>Vehicle usage data is not collected.</LocalizedText></p>
          </CardContent>
        </Card>
      </div>

      {/* Predictive Insights */}
      {analyticsData.predictiveInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-600" />
              Recorded Vehicle Alerts
            </CardTitle>
            <CardDescription><LocalizedText>Alerts saved for vehicles in the selected fleet.</LocalizedText></CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {analyticsData.predictiveInsights.map((insight, index) => (
                <div key={index} className="p-4 rounded-lg border">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${
                      insight.type === 'warning' ? 'bg-yellow-100' :
                      insight.type === 'info' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      {insight.type === 'warning' ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      ) : insight.type === 'info' ? (
                        <Info className="h-4 w-4 text-blue-600" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                      <Badge 
                        variant="outline" 
                        className={`mt-2 ${getImpactColor(insight.impact)}`}
                      >
                        {insight.impact} impact
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analytics Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends"><LocalizedText>Maintenance Trends</LocalizedText></TabsTrigger>
          <TabsTrigger value="costs"><LocalizedText>Cost Analysis</LocalizedText></TabsTrigger>
          <TabsTrigger value="performance"><LocalizedText>Truck Performance</LocalizedText></TabsTrigger>
          <TabsTrigger value="productivity"><LocalizedText>Mechanic Productivity</LocalizedText></TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle><LocalizedText>Maintenance Trends</LocalizedText></CardTitle>
              <CardDescription><LocalizedText>Maintenance activities over time</LocalizedText></CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={analyticsData.maintenanceTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip />
                  <Legend />
                  <Area type="monotone" dataKey="completed" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} name="Completed" />
                  <Area type="monotone" dataKey="inProgress" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} name="In Progress" />
                  <Area type="monotone" dataKey="scheduled" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.6} name="Scheduled" />
                  <Area type="monotone" dataKey="overdue" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.6} name="Overdue" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle><LocalizedText>Cost Analysis</LocalizedText></CardTitle>
                <CardDescription><LocalizedText>Cost breakdown by category</LocalizedText></CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={analyticsData.costAnalysis}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ category, percentage }) => `${percentage}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="cost"
                    >
                      {analyticsData.costAnalysis.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][index % 4]} />
                      ))}
                    </Pie>
                    <ChartTooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle><LocalizedText>Cost Breakdown</LocalizedText></CardTitle>
                <CardDescription><LocalizedText>Detailed cost analysis</LocalizedText></CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.costAnalysis.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ backgroundColor: ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444'][index % 4] }}
                        ></div>
                        <span className="font-medium">{item.category}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{formatCurrency(item.cost)}</div>
                        <div className="text-sm text-muted-foreground">{item.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle><LocalizedText>Truck Performance</LocalizedText></CardTitle>
              <CardDescription><LocalizedText>Individual vehicle performance metrics</LocalizedText></CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><LocalizedText>Vehicle</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Uptime</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Maintenance Cost</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Downtime (Hours)</LocalizedText></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyticsData.truckPerformance.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground"><LocalizedText>No vehicle maintenance data for this period.</LocalizedText></TableCell></TableRow> : analyticsData.truckPerformance.map((truck, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{truck.name}</TableCell>
                      <TableCell><LocalizedText>Not tracked</LocalizedText></TableCell>
                      <TableCell>{formatCurrency(truck.maintenanceCost)}</TableCell>
                      <TableCell>{truck.downtime} h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="productivity" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle><LocalizedText>Mechanic Productivity</LocalizedText></CardTitle>
                <CardDescription><LocalizedText>Completed job counts from maintenance records.</LocalizedText></CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.mechanicProductivity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <ChartTooltip />
                    <Legend />
                    <Bar dataKey="completedJobs" fill="#3b82f6" name="Completed Jobs" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle><LocalizedText>Mechanic Rankings</LocalizedText></CardTitle>
                <CardDescription><LocalizedText>Top performing mechanics</LocalizedText></CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.mechanicProductivity.length === 0 ? <p className="text-sm text-muted-foreground"><LocalizedText>No completed job data for this period.</LocalizedText></p> : [...analyticsData.mechanicProductivity]
                    .sort((a, b) => b.completedJobs - a.completedJobs)
                    .map((mechanic, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{mechanic.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {mechanic.completedJobs} completed jobs
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{formatCurrency(mechanic.totalCost)}</div>
                        <div className="text-sm text-muted-foreground"><LocalizedText>Recorded cost</LocalizedText></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

      </Tabs>
    </div>
  )
}
