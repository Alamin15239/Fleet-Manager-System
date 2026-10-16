'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Database, 
  Users, 
  Truck, 
  Wrench, 
  Shield, 
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  HardDrive,
  Server
} from 'lucide-react'
import { toast } from '@/lib/localized-toast'
import { useAuth } from '@/contexts/auth-context'

interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalTrucks: number
  activeTrucks: number
  totalMaintenance: number
  pendingMaintenance: number
  systemHealth: 'healthy' | 'warning' | 'critical' | 'unknown'
  databaseSize: string
  uptime: string
  lastBackup: string | null
  responseTime: number
  environment: string
  buildId: string
  lastUpdated: string | null
  memoryUsagePercent: number | null
}

export default function SettingsDashboard() {
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalTrucks: 0,
    activeTrucks: 0,
    totalMaintenance: 0,
    pendingMaintenance: 0,
    systemHealth: 'unknown',
    databaseSize: 'Not available',
    uptime: 'Not available',
    lastBackup: null,
    responseTime: 0,
    environment: 'Not available',
    buildId: 'Not available',
    lastUpdated: null,
    memoryUsagePercent: null,
  })
  const [loading, setLoading] = useState(true)
  const [statsAvailable, setStatsAvailable] = useState(false)
  const [actionBusy, setActionBusy] = useState<string | null>(null)
  const { user } = useAuth()
  const isAdmin = user?.role === 'ADMIN'

  useEffect(() => {
    if (isAdmin) fetchSystemStats()
    else setLoading(false)
  }, [isAdmin])

  const fetchSystemStats = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        setLoading(false)
        return false
      }

      const response = await fetch('/api/admin/system-stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        throw new Error('System statistics are unavailable')
      }

      const result = await response.json()
      const data = result.stats
      setStats({
        totalUsers: data.totalUsers,
        activeUsers: data.activeUsers,
        totalTrucks: data.totalTrucks + data.totalTrailers,
        activeTrucks: data.activeTrucks + data.activeTrailers,
        totalMaintenance: data.totalMaintenance,
        pendingMaintenance: data.pendingMaintenance,
        systemHealth: data.systemHealth || 'unknown',
        databaseSize: data.databaseSize,
        uptime: data.uptime,
        lastBackup: data.lastBackup,
        responseTime: data.responseTime,
        environment: data.environment,
        buildId: data.buildId,
        lastUpdated: data.lastUpdated,
        memoryUsagePercent: data.memoryUsagePercent,
      })
      setStatsAvailable(true)
      return true
    } catch (error) {
      console.error('Error fetching system stats:', error)
      setStatsAvailable(false)
      setStats(current => ({ ...current, systemHealth: 'unknown' }))
      toast.error('System statistics are unavailable')
      return false
    } finally {
      setLoading(false)
    }
  }

  const runSystemAction = async (action: string, endpoint: string, method: 'GET' | 'POST' = 'POST', download = false) => {
    setActionBusy(action)
    try {
      const token = localStorage.getItem('authToken')
      if (!token) throw new Error('Authentication required')
      const response = await fetch(endpoint, { method, headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `${action} failed (${response.status})`)
      }

      if (download) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || `${action.toLowerCase().replace(/\s+/g, '-')}.json`
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
      }

      const payload = download ? null : await response.json().catch(() => null)
      if (action === 'Health Check') {
        toast.success(`Health check completed: ${payload?.status || 'complete'}`)
      } else if (action === 'Optimize Database') {
        toast.success(payload?.message || 'Database statistics refreshed')
      } else {
        toast.success(`${action} completed successfully`)
      }
      await fetchSystemStats()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `${action} failed`)
    } finally {
      setActionBusy(null)
    }
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy': return 'text-green-600 bg-green-100'
      case 'warning': return 'text-yellow-600 bg-yellow-100'
      case 'critical': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'critical': return <AlertTriangle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /><LocalizedText>System Health Overview</LocalizedText></CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3 rounded-b-lg text-sm text-muted-foreground">
          <Shield className="h-4 w-4 shrink-0" />
          <LocalizedText>Administrator access required</LocalizedText>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                {getHealthIcon(stats.systemHealth)}
                <span className="font-medium"><LocalizedText>System Status</LocalizedText></span>
              </div>
              <Badge className={getHealthColor(stats.systemHealth)}>
                {stats.systemHealth?.charAt(0).toUpperCase() + stats.systemHealth?.slice(1) || 'Unknown'}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
              <span className="font-medium"><LocalizedText>Instance Uptime</LocalizedText></span>
              </div>
              <span className="text-sm font-semibold" title="Current server instance uptime">{stats.uptime}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-purple-600" />
                <span className="font-medium"><LocalizedText>Database Size</LocalizedText></span>
              </div>
              <span className="text-sm font-semibold">{stats.databaseSize}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-green-600" />
                <span className="font-medium"><LocalizedText>Last Backup</LocalizedText></span>
              </div>
              <span className="text-sm font-semibold">{stats.lastBackup ? new Date(stats.lastBackup).toLocaleString() : <LocalizedText>Not recorded</LocalizedText>}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Total Users</LocalizedText></CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsAvailable ? stats.totalUsers : '—'}</div>
            <p className="text-xs text-muted-foreground">
              {statsAvailable ? `${stats.activeUsers} logged in during the last 24 hours` : 'Statistics unavailable'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Fleet Vehicles</LocalizedText></CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsAvailable ? stats.totalTrucks : '—'}</div>
            <p className="text-xs text-muted-foreground">
              {statsAvailable ? `${stats.activeTrucks} active vehicles` : 'Statistics unavailable'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Maintenance Records</LocalizedText></CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statsAvailable ? stats.totalMaintenance : '—'}</div>
            <p className="text-xs text-muted-foreground">
              {statsAvailable ? `${stats.pendingMaintenance} pending` : 'Statistics unavailable'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>System Security</LocalizedText></CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold"><LocalizedText>Protected</LocalizedText></div>
            <p className="text-xs text-muted-foreground">
              <LocalizedText>Administrator-only controls are enabled</LocalizedText>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Quick System Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button
              variant="outline"
              onClick={() => runSystemAction('Backup Database', '/api/admin/backup', 'POST', true)}
              disabled={actionBusy !== null}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Backup Database
            </Button>

            <Button
              variant="outline"
              onClick={() => runSystemAction('Optimize Database', '/api/admin/cleanup')}
              disabled={actionBusy !== null}
              className="flex items-center gap-2"
            >
              <HardDrive className="h-4 w-4" />
              <LocalizedText>Optimize Database</LocalizedText>
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                void fetchSystemStats().then((success) => {
                  if (success) toast.success('System stats refreshed')
                })
              }}
              disabled={loading || actionBusy !== null}
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Refresh Stats
            </Button>

            <Button
              variant="outline"
              onClick={() => runSystemAction('Health Check', '/api/admin/health-check')}
              disabled={actionBusy !== null}
              className="flex items-center gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Health Check
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle><LocalizedText>System Information</LocalizedText></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>Application Details</LocalizedText></h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                <span className="text-muted-foreground"><LocalizedText>Build ID:</LocalizedText></span>
                  <span className="font-medium">{stats.buildId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><LocalizedText>Environment:</LocalizedText></span>
                  <Badge variant="outline">{stats.environment}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><LocalizedText>Last Updated:</LocalizedText></span>
                  <span className="font-medium">{stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : <LocalizedText>Not available</LocalizedText>}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>Performance Metrics</LocalizedText></h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><LocalizedText>Response Time:</LocalizedText></span>
                  <span className="font-medium">{stats.responseTime} ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><LocalizedText>Runtime Heap Usage:</LocalizedText></span>
                  <span className="font-medium">{stats.memoryUsagePercent == null ? <LocalizedText>Not available</LocalizedText> : `${stats.memoryUsagePercent}%`}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
