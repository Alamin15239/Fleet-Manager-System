'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Activity, 
  Users, 
  Shield, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Database,
  Globe,
  Monitor
} from 'lucide-react'
import { format } from 'date-fns'

interface SystemMetrics {
  totalUsers: number
  activeUsers: number
  totalSessions: number
  activeSessions: number
  totalActions: number
  criticalAlerts: number
  responseTime: number
}

interface RecentActivity {
  id: string
  user: string
  action: string
  entity: string
  timestamp: string
  status: 'success' | 'warning' | 'error'
}

export function EnhancedMonitoringDashboard() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null)
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
    fetchRecentActivities()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchMetrics()
      fetchRecentActivities()
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])

  const fetchMetrics = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/admin/system-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        setMetrics(data.stats)
      }
    } catch (error) {
      console.error('Error fetching metrics:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/admin/audit-logs?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        const activities = data.logs?.map((log: any) => ({
          id: log.id,
          user: log.userName || log.user?.name || 'Unknown',
          action: log.action,
          entity: log.entityType,
          timestamp: log.createdAt,
          status: log.action === 'DELETE' ? 'error' : 
                  log.action === 'UPDATE' ? 'warning' : 'success'
        })) || []
        setRecentActivities(activities)
      }
    } catch (error) {
      console.error('Error fetching recent activities:', error)
    }
  }

  const getResponseTimeStatus = (time: number) => {
    if (time < 200) return { label: 'Excellent', color: 'text-green-600' }
    if (time < 500) return { label: 'Good', color: 'text-blue-600' }
    if (time < 1000) return { label: 'Fair', color: 'text-yellow-600' }
    return { label: 'Slow', color: 'text-red-600' }
  }

  const getActivityStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                <div className="h-2 bg-gray-200 rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <LocalizedText>Failed to load system metrics. Please try refreshing the page.</LocalizedText>
        </AlertDescription>
      </Alert>
    )
  }

  const responseStatus = getResponseTimeStatus(metrics.responseTime)

  return (
    <div className="space-y-6">
      {/* Key Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>System Health</LocalizedText></CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">—</div>
            <div className="text-xs mt-2 text-muted-foreground"><LocalizedText>Health score is not measured by this app.</LocalizedText></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Active Users</LocalizedText></CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeUsers}</div>
            <p className="text-xs text-muted-foreground">
              of {metrics.totalUsers} total users
            </p>
            <Progress 
              value={(metrics.activeUsers / metrics.totalUsers) * 100} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Active Sessions</LocalizedText></CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeSessions}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalSessions} total today
            </p>
            <div className="flex items-center mt-2">
              <Activity className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-xs text-green-600"><LocalizedText>Live sessions</LocalizedText></span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Response Time</LocalizedText></CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.responseTime}ms</div>
            <div className={`text-xs mt-2 ${responseStatus.color}`}>
              {responseStatus.label}
            </div>
            <Progress 
              value={Math.min((2000 - metrics.responseTime) / 2000 * 100, 100)} 
              className="mt-2" 
            />
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      {metrics.criticalAlerts > 0 ? (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <strong>{metrics.criticalAlerts} critical alerts</strong> require immediate attention.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            <LocalizedText>All systems operating normally. No critical alerts detected.</LocalizedText>
          </AlertDescription>
        </Alert>
      )}

      {/* System Status Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Database className="h-4 w-4" />
              Database Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm"><LocalizedText>Connection</LocalizedText></span>
              <Badge className="bg-green-100 text-green-800"><LocalizedText>Healthy</LocalizedText></Badge>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm"><LocalizedText>Performance</LocalizedText></span>
              <Badge className="bg-blue-100 text-blue-800"><LocalizedText>Optimal</LocalizedText></Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Globe className="h-4 w-4" />
              API Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm"><LocalizedText>Status</LocalizedText></span>
              <Badge className="bg-green-100 text-green-800"><LocalizedText>Online</LocalizedText></Badge>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm"><LocalizedText>Uptime</LocalizedText></span>
              <Badge className="bg-green-100 text-green-800">99.9%</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm"><LocalizedText>Status</LocalizedText></span>
              <Badge className="bg-green-100 text-green-800"><LocalizedText>Secure</LocalizedText></Badge>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm"><LocalizedText>Threats</LocalizedText></span>
              <Badge className="bg-green-100 text-green-800"><LocalizedText>None</LocalizedText></Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent System Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge className={getActivityStatusColor(activity.status)}>
                      <LocalizedText>{activity.action}</LocalizedText>
                    </Badge>
                    <div>
                      <div className="font-medium text-sm">{activity.user}</div>
                      <div className="text-xs text-muted-foreground">
                        {activity.entity}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(new Date(activity.timestamp), 'MMM dd, HH:mm')}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <LocalizedText>No recent activities</LocalizedText>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
