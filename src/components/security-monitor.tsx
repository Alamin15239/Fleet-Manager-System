'use client'
import { LocalizedText } from '@/components/localized-text'

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
      } else setMetrics(null)
      
      // Fetch security events
      const eventsResponse = await fetch('/api/admin/security-events?limit=10', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json()
        setEvents(eventsData.events || [])
      } else setEvents([])
      
    } catch (error) {
      console.error('Error fetching security data:', error)
      setMetrics(null)
      setEvents([])
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
            <CardTitle className="text-sm font-medium"><LocalizedText>Security Score</LocalizedText></CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metrics ? (
              <>
                <div className="text-2xl font-bold">{metrics.securityScore}%</div>
                <Progress value={metrics.securityScore} className="mt-2" />
                {securityStatus && (
                  <div className={`text-xs mt-2 px-2 py-1 rounded-full inline-block ${securityStatus.bgColor} ${securityStatus.color}`}>
                    {securityStatus.label}
                  </div>
                )}
              </>
            ) : <p className="text-sm text-muted-foreground"><LocalizedText>Not available</LocalizedText></p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Failed Logins</LocalizedText></CardTitle>
            <UserX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics?.failedLogins ?? '—'}</div>
            <p className="text-xs text-muted-foreground">{metrics ? 'Last 24 hours' : 'Not tracked yet'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Active Threats</LocalizedText></CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{metrics?.activeThreats ?? '—'}</div>
            <p className="text-xs text-muted-foreground">{metrics ? 'Requires attention' : 'Not tracked yet'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Blocked IPs</LocalizedText></CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.blockedIPs ?? '—'}</div>
            <p className="text-xs text-muted-foreground">{metrics ? 'Blocked addresses' : 'Blocking is not configured'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Security Status Alert */}
      {metrics ? (
        <>
          {metrics.activeThreats > 0 || metrics.failedLogins > 5 ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <strong><LocalizedText>Security Alert:</LocalizedText></strong> {metrics.activeThreats} active threats and {metrics.failedLogins} failed login attempts detected.
                <Button variant="link" className="p-0 h-auto ml-2 text-red-600">
                  <LocalizedText>Take Action</LocalizedText>
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <LocalizedText>Security status is good. No immediate threats detected.</LocalizedText>
              </AlertDescription>
            </Alert>
          )}
        </>
      ) : (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription><LocalizedText>Security event collection is not configured, so this page cannot report failed logins, active threats, or blocked addresses.</LocalizedText></AlertDescription>
        </Alert>
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
                <LocalizedText>Security event history is unavailable.</LocalizedText>
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
                <span className="text-sm font-medium"><LocalizedText>Two-Factor Authentication</LocalizedText></span>
                <Badge variant="outline"><LocalizedText>Email OTP</LocalizedText></Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium"><LocalizedText>Password Policy</LocalizedText></span>
                <Badge variant="outline"><LocalizedText>8+ characters</LocalizedText></Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium"><LocalizedText>Session Timeout</LocalizedText></span>
                <Badge variant="outline"><LocalizedText>7 days</LocalizedText></Badge>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium"><LocalizedText>IP Whitelist</LocalizedText></span>
                <Badge variant="outline"><LocalizedText>Not configured</LocalizedText></Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium"><LocalizedText>Audit Logging</LocalizedText></span>
                <Badge variant="outline"><LocalizedText>Partial</LocalizedText></Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium"><LocalizedText>Auto-Block</LocalizedText></span>
                <Badge variant="outline"><LocalizedText>Not configured</LocalizedText></Badge>
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
