'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Eye, MapPin, Monitor, Clock, User, Activity, Filter, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'

interface UserActivity {
  id: string
  user: {
    id: string
    email: string
    name: string
    role: string
  }
  action: string
  entityType: string
  entityId?: string
  entityName?: string
  ipAddress?: string
  deviceInfo: string
  locationInfo: string
  rawLocation?: any
  timestamp: string
  timeAgo: string
  metadata?: any
}

interface UserActivityMonitorProps {
  className?: string
}

export function UserActivityMonitor({ className }: UserActivityMonitorProps) {
  const [activities, setActivities] = useState<UserActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    entityType: '',
    startDate: '',
    endDate: ''
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })

  const fetchActivities = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))
      })

      const response = await fetch(`/api/admin/user-activities?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch activities')
      }

      const data = await response.json()
      setActivities(data.data.activities)
      setPagination(data.data.pagination)
    } catch (error) {
      console.error('Error fetching activities:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [pagination.page, filters])

  const getActionColor = (action: string) => {
    const colors: { [key: string]: string } = {
      LOGIN: 'bg-green-100 text-green-800',
      LOGOUT: 'bg-gray-100 text-gray-800',
      REGISTER: 'bg-blue-100 text-blue-800',
      CREATE: 'bg-purple-100 text-purple-800',
      UPDATE: 'bg-yellow-100 text-yellow-800',
      DELETE: 'bg-red-100 text-red-800',
      VIEW: 'bg-indigo-100 text-indigo-800'
    }
    
    for (const [key, color] of Object.entries(colors)) {
      if (action.includes(key)) {
        return color
      }
    }
    
    return 'bg-gray-100 text-gray-800'
  }

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: string } = {
      ADMIN: 'bg-red-100 text-red-800',
      MANAGER: 'bg-orange-100 text-orange-800',
      USER: 'bg-blue-100 text-blue-800'
    }
    return colors[role] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            User Activity Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Input
              placeholder="User ID or Email"
              value={filters.userId}
              onChange={(e) => setFilters(prev => ({ ...prev, userId: e.target.value }))}
            />
            <Select value={filters.action} onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Actions</SelectItem>
                <SelectItem value="LOGIN">Login</SelectItem>
                <SelectItem value="LOGOUT">Logout</SelectItem>
                <SelectItem value="REGISTER">Register</SelectItem>
                <SelectItem value="CREATE">Create</SelectItem>
                <SelectItem value="UPDATE">Update</SelectItem>
                <SelectItem value="DELETE">Delete</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.entityType} onValueChange={(value) => setFilters(prev => ({ ...prev, entityType: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Types</SelectItem>
                <SelectItem value="USER">User</SelectItem>
                <SelectItem value="TRUCK">Truck</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="TIRE">Tire</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              placeholder="Start Date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
            />
            <Button onClick={fetchActivities} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {/* Activities List */}
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Loading activities...</div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No activities found</div>
            ) : (
              activities.map((activity) => (
                <Card key={activity.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getActionColor(activity.action)}>
                            {activity.action}
                          </Badge>
                          <Badge variant="outline">
                            {activity.entityType}
                          </Badge>
                          <Badge className={getRoleColor(activity.user.role)}>
                            {activity.user.role}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <div>
                              <div className="font-medium">{activity.user.name || activity.user.email}</div>
                              <div className="text-gray-500">{activity.user.email}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-gray-500" />
                            <div>
                              <div className="font-medium">Device</div>
                              <div className="text-gray-500">{activity.deviceInfo}</div>
                              <div className="text-xs text-gray-400">IP: {activity.ipAddress}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <div>
                              <div className="font-medium">Location</div>
                              <div className="text-gray-500">{activity.locationInfo}</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <div>
                              <div className="font-medium">Time</div>
                              <div className="text-gray-500">
                                {format(new Date(activity.timestamp), 'MMM dd, yyyy HH:mm')}
                              </div>
                              <div className="text-xs text-gray-400">{activity.timeAgo}</div>
                            </div>
                          </div>
                        </div>
                        
                        {activity.entityName && (
                          <div className="mt-2 text-sm">
                            <span className="font-medium">Target:</span> {activity.entityName}
                          </div>
                        )}
                        
                        {activity.metadata && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-sm font-medium text-gray-600">
                              Additional Details
                            </summary>
                            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto">
                              {JSON.stringify(activity.metadata, null, 2)}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-500">
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} activities
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}