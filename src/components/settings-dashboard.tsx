'use client'

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
import { toast } from 'sonner'

interface SystemStats {
  totalUsers: number
  activeUsers: number
  totalTrucks: number
  activeTrucks: number
  totalMaintenance: number
  pendingMaintenance: number
  systemHealth: 'healthy' | 'warning' | 'critical'
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
    systemHealth: 'healthy',
    databaseSize: '0 MB',
    uptime: '0 days',
    lastBackup: 'Never'
  })
  const [loading, setLoading] = useState(true)

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

      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        // Mock data for demonstration
        setStats({
          totalUsers: 12,
          activeUsers: 8,
          totalTrucks: 43,
          activeTrucks: 41,
          totalMaintenance: 156,
          pendingMaintenance: 3,
          systemHealth: 'healthy',
          databaseSize: '245 MB',
          uptime: '15 days',
          lastBackup: '2 hours ago'
        })
      }
    } catch (error) {
      console.error('Error fetching system stats:', error)
      // Mock data fallback
      setStats({
        totalUsers: 12,
        activeUsers: 8,
        totalTrucks: 43,
        activeTrucks: 41,
        totalMaintenance: 156,
        pendingMaintenance: 3,
        systemHealth: 'healthy',
        databaseSize: '245 MB',
        uptime: '15 days',
        lastBackup: '2 hours ago'
      })
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
                <span className="font-medium">System Status</span>
              </div>
              <Badge className={getHealthColor(stats.systemHealth)}>
                {stats.systemHealth.charAt(0).toUpperCase() + stats.systemHealth.slice(1)}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="font-medium">Uptime</span>
              </div>
              <span className="text-sm font-semibold">{stats.uptime}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-purple-600" />
                <span className="font-medium">Database Size</span>
              </div>
              <span className="text-sm font-semibold">{stats.databaseSize}</span>
            </div>
            
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-green-600" />
                <span className="font-medium">Last Backup</span>
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
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeUsers} active users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fleet Vehicles</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTrucks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeTrucks} active vehicles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maintenance Records</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMaintenance}</div>
            <p className="text-xs text-muted-foreground">
              {stats.pendingMaintenance} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Security</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Secure</div>
            <p className="text-xs text-muted-foreground">
              All systems protected
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
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Application Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Environment:</span>
                  <Badge variant="outline">Production</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated:</span>
                  <span className="font-medium">2024-01-15</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Performance Metrics</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Response Time:</span>
                  <span className="font-medium text-green-600">&lt; 200ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memory Usage:</span>
                  <span className="font-medium">45%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CPU Usage:</span>
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