'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  TrendingUp, 
  Activity, 
  Users, 
  Database, 
  RefreshCw,
  Calendar
} from 'lucide-react'
import { format, subDays } from 'date-fns'

interface PerformanceData {
  timestamp: string
  responseTime: number
  activeUsers: number
  systemLoad: number
  memoryUsage: number
  cpuUsage: number
}

interface ActivityData {
  date: string
  logins: number
  actions: number
  errors: number
}

interface EntityDistribution {
  name: string
  value: number
  color: string
}

export function SystemPerformanceCharts() {
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([])
  const [activityData, setActivityData] = useState<ActivityData[]>([])
  const [entityData, setEntityData] = useState<EntityDistribution[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [refreshing, setRefreshing] = useState(false)

  const fetchChartData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      
      // Generate mock performance data
      const mockPerformanceData: PerformanceData[] = []
      const now = new Date()
      
      for (let i = 23; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000)
        mockPerformanceData.push({
          timestamp: timestamp.toISOString(),
          responseTime: Math.floor(Math.random() * 200) + 50,
          activeUsers: Math.floor(Math.random() * 50) + 10,
          systemLoad: Math.floor(Math.random() * 80) + 20,
          memoryUsage: Math.floor(Math.random() * 70) + 30,
          cpuUsage: Math.floor(Math.random() * 60) + 20
        })
      }
      
      // Generate mock activity data
      const mockActivityData: ActivityData[] = []
      for (let i = 6; i >= 0; i--) {
        const date = subDays(now, i)
        mockActivityData.push({
          date: format(date, 'MMM dd'),
          logins: Math.floor(Math.random() * 100) + 20,
          actions: Math.floor(Math.random() * 500) + 100,
          errors: Math.floor(Math.random() * 10) + 1
        })
      }
      
      // Generate mock entity distribution
      const mockEntityData: EntityDistribution[] = [
        { name: 'Trucks', value: 45, color: '#3b82f6' },
        { name: 'Users', value: 25, color: '#10b981' },
        { name: 'Maintenance', value: 20, color: '#f59e0b' },
        { name: 'Tires', value: 10, color: '#ef4444' }
      ]
      
      setPerformanceData(mockPerformanceData)
      setActivityData(mockActivityData)
      setEntityData(mockEntityData)
      
    } catch (error) {
      console.error('Error fetching chart data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchChartData()
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchChartData()
    }, 300000)
    
    return () => clearInterval(interval)
  }, [timeRange])

  const formatTooltipValue = (value: number, name: string) => {
    switch (name) {
      case 'responseTime':
        return [`${value}ms`, 'Response Time']
      case 'activeUsers':
        return [value, 'Active Users']
      case 'systemLoad':
      case 'memoryUsage':
      case 'cpuUsage':
        return [`${value}%`, name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')]
      default:
        return [value, name]
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-48 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Auto-refresh: 5min
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchChartData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Performance Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Response Time Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Response Time Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm')}
                  formatter={formatTooltipValue}
                />
                <Line 
                  type="monotone" 
                  dataKey="responseTime" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* System Resources */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => format(new Date(value), 'MMM dd, HH:mm')}
                  formatter={formatTooltipValue}
                />
                <Area 
                  type="monotone" 
                  dataKey="cpuUsage" 
                  stackId="1"
                  stroke="#ef4444" 
                  fill="#ef4444"
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="memoryUsage" 
                  stackId="1"
                  stroke="#f59e0b" 
                  fill="#f59e0b"
                  fillOpacity={0.6}
                />
                <Area 
                  type="monotone" 
                  dataKey="systemLoad" 
                  stackId="1"
                  stroke="#10b981" 
                  fill="#10b981"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* User Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Daily User Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="logins" fill="#3b82f6" name="Logins" />
                <Bar dataKey="actions" fill="#10b981" name="Actions" />
                <Bar dataKey="errors" fill="#ef4444" name="Errors" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Entity Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Entity Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={entityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {entityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {entityData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: entry.color }}
                  ></div>
                  <span className="text-sm">{entry.name}: {entry.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {performanceData.length > 0 ? 
                  Math.round(performanceData.reduce((acc, curr) => acc + curr.responseTime, 0) / performanceData.length) 
                  : 0}ms
              </div>
              <div className="text-sm text-muted-foreground">Avg Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {performanceData.length > 0 ? 
                  Math.round(performanceData.reduce((acc, curr) => acc + curr.activeUsers, 0) / performanceData.length) 
                  : 0}
              </div>
              <div className="text-sm text-muted-foreground">Avg Active Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {performanceData.length > 0 ? 
                  Math.round(performanceData.reduce((acc, curr) => acc + curr.cpuUsage, 0) / performanceData.length) 
                  : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Avg CPU Usage</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {performanceData.length > 0 ? 
                  Math.round(performanceData.reduce((acc, curr) => acc + curr.memoryUsage, 0) / performanceData.length) 
                  : 0}%
              </div>
              <div className="text-sm text-muted-foreground">Avg Memory Usage</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}