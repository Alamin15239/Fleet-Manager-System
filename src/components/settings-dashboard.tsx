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
  Wifi,
  Server
} from 'lucide-react'
import { toast } from '@/lib/localized-toast'

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
  lastBackup: string
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
    lastBackup: 'Not recorded'
  })
  const [loading, setLoading] = useState(true)
  const [statsAvailable, setStatsAvailable] = useState(false)

  useEffect(() => {
    fetchSystemStats()
  }, [])

  const fetchSystemStats = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        setLoading(false)
        return
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
        systemHealth: 'unknown',
        databaseSize: data.databaseSize,
        uptime: data.uptime,
        lastBackup: data.lastBackup
      })
      setStatsAvailable(true)
    } catch (error) {
      console.error('Error fetching system stats:', error)
      setStatsAvailable(false)
      setStats(current => ({ ...current, systemHealth: 'unknown' }))
      toast.error('System statistics are unavailable')
    } finally {
      setLoading(false)
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
                <span className="font-medium"><LocalizedText>Uptime</LocalizedText></span>
              </div>
              <span className="text-sm font-semibold">{stats.uptime}</span>
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
              <span className="text-sm font-semibold">{stats.lastBackup}</span>
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
            <div className="text-2xl font-bold"><LocalizedText>Restricted</LocalizedText></div>
            <p className="text-xs text-muted-foreground">
              <LocalizedText>Administrator access required</LocalizedText>
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
              onClick={async () => {
                try {
                  const token = localStorage.getItem('authToken')
                  const response = await fetch('/api/admin/backup', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                  if (response.ok) {
                    toast.success('Backup initiated successfully')
                    fetchSystemStats()
                  } else {
                    toast.error('Failed to initiate backup')
                  }
                } catch (error) {
                  toast.error('Failed to initiate backup')
                }
              }}
              className="flex items-center gap-2"
            >
              <Database className="h-4 w-4" />
              Backup Database
            </Button>

            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('authToken')
                  const response = await fetch('/api/admin/cleanup', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                  if (response.ok) {
                    toast.success('System cleanup completed')
                    fetchSystemStats()
                  } else {
                    toast.error('Failed to run cleanup')
                  }
                } catch (error) {
                  toast.error('Failed to run cleanup')
                }
              }}
              className="flex items-center gap-2"
            >
              <HardDrive className="h-4 w-4" />
              Clean System
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                fetchSystemStats()
                toast.success('System stats refreshed')
              }}
              className="flex items-center gap-2"
            >
              <Activity className="h-4 w-4" />
              Refresh Stats
            </Button>

            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const token = localStorage.getItem('authToken')
                  const response = await fetch('/api/admin/health-check', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                  if (response.ok) {
                    const data = await response.json()
                    toast.success(`Health check completed: ${data.status}`)
                  } else {
                    toast.error('Health check failed')
                  }
                } catch (error) {
                  toast.error('Health check failed')
                }
              }}
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
                  <span className="text-muted-foreground"><LocalizedText>Version:</LocalizedText></span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><LocalizedText>Environment:</LocalizedText></span>
                  <Badge variant="outline"><LocalizedText>Production</LocalizedText></Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><LocalizedText>Last Updated:</LocalizedText></span>
                  <span className="font-medium">2024-01-15</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>Performance Metrics</LocalizedText></h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><LocalizedText>Response Time:</LocalizedText></span>
                  <span className="font-medium text-green-600">&lt; 200ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><LocalizedText>Memory Usage:</LocalizedText></span>
                  <span className="font-medium">45%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground"><LocalizedText>CPU Usage:</LocalizedText></span>
                  <span className="font-medium">12%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
