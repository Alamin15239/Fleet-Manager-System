'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Activity, 
  RefreshCw, 
  User, 
  Truck, 
  Settings, 
  FileText,
  Clock,
  MapPin,
  Monitor
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface ActivityItem {
  id: string
  user: {
    name: string
    email: string
    role: string
  }
  action: string
  entityType: string
  entityName?: string
  ipAddress?: string
  location?: string
  deviceInfo?: string
  timestamp: string
  metadata?: any
}

interface RealTimeActivityFeedProps {
  className?: string
  maxItems?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export function RealTimeActivityFeed({ 
  className = '',
  maxItems = 20,
  autoRefresh = true,
  refreshInterval = 10000
}: RealTimeActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  const fetchActivities = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true)
      
      const token = localStorage.getItem('authToken')
      const response = await fetch(`/api/admin/audit-logs?limit=${maxItems}&orderBy=createdAt&order=desc`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        const formattedActivities = data.logs?.map((log: any) => ({
          id: log.id,
          user: {
            name: log.userName || log.user?.name || 'Unknown',
            email: log.userEmail || log.user?.email || 'Unknown',
            role: log.userRole || log.user?.role || 'Unknown'
          },
          action: log.action,
          entityType: log.entityType,
          entityName: log.entityId,
          ipAddress: log.ipAddress,
          timestamp: log.createdAt,
          metadata: log.changes
        })) || []
        
        setActivities(formattedActivities)
        setLastUpdate(new Date())
      }
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchActivities()
    
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchActivities()
      }, refreshInterval)
      
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, maxItems])

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'USER': return <User className="h-4 w-4" />
      case 'TRUCK': return <Truck className="h-4 w-4" />
      case 'MAINTENANCE_RECORD': return <Settings className="h-4 w-4" />
      case 'TIRE': return <FileText className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'bg-green-100 text-green-800 border-green-200'
      case 'UPDATE': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'DELETE': return 'bg-red-100 text-red-800 border-red-200'
      case 'LOGIN': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'LOGOUT': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'VIEW': return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-red-100 text-red-800'
      case 'MANAGER': return 'bg-orange-100 text-orange-800'
      case 'USER': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-Time Activity Feed
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <span className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(lastUpdate, { addSuffix: true })}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchActivities(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              No activities found
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className={`p-4 border-l-4 hover:bg-gray-50 transition-colors ${
                    index === 0 ? 'border-l-blue-500 bg-blue-50/30' : 'border-l-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className={getActionColor(activity.action)}>
                          {activity.action}
                        </Badge>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          {getEntityIcon(activity.entityType)}
                          <span className="text-xs">{activity.entityType}</span>
                        </div>
                        <Badge variant="outline" className={getRoleColor(activity.user.role)}>
                          {activity.user.role}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm font-medium">{activity.user.name}</span>
                          <span className="text-xs text-muted-foreground">({activity.user.email})</span>
                        </div>
                        
                        {activity.ipAddress && (
                          <div className="flex items-center gap-2">
                            <Monitor className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">IP: {activity.ipAddress}</span>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })})
                          </span>
                        </div>
                      </div>
                      
                      {activity.metadata && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-blue-600 hover:text-blue-800">
                            View Details
                          </summary>
                          <div className="mt-1 p-2 bg-gray-50 rounded text-xs">
                            <pre className="whitespace-pre-wrap overflow-x-auto">
                              {JSON.stringify(activity.metadata, null, 2)}
                            </pre>
                          </div>
                        </details>
                      )}
                    </div>
                    
                    {index === 0 && (
                      <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        Latest
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}