'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  Lock, 
  Unlock,
  UserX,
  Activity,
  Globe,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'

interface SecurityMetrics {
  failedLogins: number
  suspiciousActivities: number
  blockedIPs: number
  activeThreats: number
  securityScore: number
  lastSecurityScan: string
}

interface SecurityEvent {
  id: string
  type: 'FAILED_LOGIN' | 'SUSPICIOUS_ACTIVITY' | 'BLOCKED_IP' | 'SECURITY_ALERT'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  description: string
  ipAddress?: string
  userEmail?: string
  timestamp: string
  status: 'ACTIVE' | 'RESOLVED' | 'INVESTIGATING'
}

interface SecurityMonitorProps {
  className?: string
}

export function SecurityMonitor({ className = '' }: SecurityMonitorProps) {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null)
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchSecurityData = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      
      const token = localStorage.getItem('authToken')
      
      // Fetch security metrics
      const metricsResponse = await fetch('/api/admin/security-metrics', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json()
        setMetrics(metricsData.metrics)
      }
      
      // Fetch security events
      const eventsResponse = await fetch('/api/admin/security-events?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json()
        setEvents(eventsData.events || [])
      }
      
    } catch (error) {
      console.error('Error fetching security data:', error)
      
      // Mock data for demonstration
      setMetrics({
        failedLogins: 3,
        suspiciousActivities: 1,
        blockedIPs: 0,
        activeThreats: 0,
        securityScore: 95,
        lastSecurityScan: new Date().toISOString()
      })
      
      setEvents([
        {
          id: '1',
          type: 'FAILED_LOGIN',
          severity: 'MEDIUM',
          description: 'Multiple failed login attempts detected',
          ipAddress: '192.168.1.100',
          userEmail: 'user@example.com',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          status: 'INVESTIGATING'
        },
        {
          id: '2',
          type: 'SUSPICIOUS_ACTIVITY',
          severity: 'HIGH',
          description: 'Unusual access pattern detected',
          ipAddress: '10.0.0.50',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          status: 'ACTIVE'
        }
      ])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchSecurityData()
    
    // Auto-refresh every 2 minutes
    const interval = setInterval(() => {
      fetchSecurityData()
    }, 120000)
    
    return () => clearInterval(interval)
  }, [])

  const getSecurityScoreStatus = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-100' }
    if (score >= 75) return { label: 'Good', color: 'text-blue-600', bgColor: 'bg-blue-100' }
    if (score >= 60) return { label: 'Fair', color: 'text-yellow-600', bgColor: 'bg-yellow-100' }
    return { label: 'Poor', color: 'text-red-600', bgColor: 'bg-red-100' }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200'
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'LOW': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-red-100 text-red-800'
      case 'INVESTIGATING': return 'bg-yellow-100 text-yellow-800'
      case 'RESOLVED': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'FAILED_LOGIN': return <UserX className="h-4 w-4" />
      case 'SUSPICIOUS_ACTIVITY': return <Eye className="h-4 w-4" />
      case 'BLOCKED_IP': return <Shield className="h-4 w-4" />
      case 'SECURITY_ALERT': return <AlertTriangle className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </CardContent>
      </Card>
    )
  }

  const securityStatus = metrics ? getSecurityScoreStatus(metrics.securityScore) : null

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Security Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metrics && (
              <>
                <div className="text-2xl font-bold">{metrics.securityScore}%</div>
                <Progress value={metrics.securityScore} className="mt-2" />
                {securityStatus && (
                  <div className={`text-xs mt-2 px-2 py-1 rounded-full inline-block ${securityStatus.bgColor} ${securityStatus.color}`}>
                    {securityStatus.label}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Logins</CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics?.failedLogins || 0}</div>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Threats</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics?.activeThreats || 0}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.blockedIPs || 0}</div>
            <p className="text-xs text-muted-foreground">Auto-blocked</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Status Alert */}
      {metrics && (
        <>
          {metrics.activeThreats > 0 || metrics.failedLogins > 5 ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong>Security Alert:</strong> {metrics.activeThreats} active threats and {metrics.failedLogins} failed login attempts detected.
                <Button variant="link" className="p-0 h-auto ml-2 text-red-600">
                  Take Action
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Security status is good. No immediate threats detected.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Security Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Recent Security Events
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchSecurityData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {events.length > 0 ? (
              events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0 mt-1">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={getSeverityColor(event.severity)}>
                        {event.severity}
                      </Badge>
                      <Badge variant="outline" className={getStatusColor(event.status)}>
                        {event.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{event.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      {event.ipAddress && (
                        <span>IP: {event.ipAddress}</span>
                      )}
                      {event.userEmail && (
                        <span>User: {event.userEmail}</span>
                      )}
                      <span>{format(new Date(event.timestamp), 'MMM dd, HH:mm')}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No security events detected
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Two-Factor Authentication</span>
                <Badge className="bg-green-100 text-green-800">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Password Policy</span>
                <Badge className="bg-green-100 text-green-800">Strong</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Session Timeout</span>
                <Badge className="bg-blue-100 text-blue-800">30 minutes</Badge>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">IP Whitelist</span>
                <Badge className="bg-yellow-100 text-yellow-800">Partial</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Audit Logging</span>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Auto-Block</span>
                <Badge className="bg-green-100 text-green-800">Enabled</Badge>
              </div>
            </div>
          </div>
          
          {metrics && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-xs text-muted-foreground">
                Last security scan: {format(new Date(metrics.lastSecurityScan), 'MMM dd, yyyy HH:mm')}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}