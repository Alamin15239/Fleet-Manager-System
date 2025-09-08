'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  Search, 
  Download, 
  Filter, 
  User, 
  Activity, 
  Clock, 
  BarChart3,
  TrendingUp,
  Shield,
  Globe,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Eye,
  FileText,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, Line, LineChart, XAxis, YAxis, CartesianGrid, Pie, PieChart as RechartsPieChart, Cell, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { toast } from 'sonner';

interface UserActivity {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  ipAddress?: string;
  createdAt: string;
  user: {
    id: string;
    name?: string;
    email: string;
    role: string;
  };
}

interface LoginHistory {
  id: string;
  userId: string;
  loginTime: string;
  logoutTime?: string;
  sessionDuration?: number;
  ipAddress?: string;
  isActive: boolean;
  user: {
    id: string;
    name?: string;
    email: string;
    role: string;
  };
}

interface User {
  id: string;
  name?: string;
  email: string;
  role: string;
  isActive: boolean;
}

export default function AdminActivityPage() {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalActivities: 0,
    uniqueUsers: 0,
    activeSessions: 0,
    topActions: [] as Array<{ action: string; count: number }>,
    activityTrends: [] as Array<{ date: string; count: number }>,
    userActivityBreakdown: [] as Array<{ user: string; count: number }>,
    ipAddresses: [] as Array<{ ip: string; count: number; location?: string }>,
    riskScore: 0
  });
  const [filters, setFilters] = useState({
    userId: 'all',
    action: 'all',
    entityType: 'all',
    startDate: '',
    endDate: '',
    isActive: 'all',
  });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isMounted) {
      const token = localStorage.getItem('authToken');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        try {
          const userData = JSON.parse(user);
          if (userData.role === 'ADMIN') {
            fetchUsers();
            fetchActivities();
            fetchLoginHistory();
          }
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
    }
  }, [isMounted]);

  useEffect(() => {
    if (isMounted) {
      const token = localStorage.getItem('authToken');
      const user = localStorage.getItem('user');
      
      if (token && user) {
        try {
          const userData = JSON.parse(user);
          if (userData.role === 'ADMIN') {
            fetchActivities();
            fetchLoginHistory();
          }
        } catch (error) {
          console.error('Error parsing user data:', error);
        }
      }
    }
  }, [filters, activeTab, isMounted]);

  const fetchUsers = async () => {
    if (!isMounted) return;
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('No auth token available, skipping users fetch');
        return;
      }
      
      const response = await fetch('/api/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Handle API response format: { success: true, data: users, pagination: ... }
        const usersArray = Array.isArray(data) ? data : (data.data || []);
        setUsers(usersArray);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchActivities = async (showRefreshing = false) => {
    if (!isMounted) return;
    
    if (showRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('No auth token available, skipping activities fetch');
        setLoading(false);
        setRefreshing(false);
        return;
      }
      
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.append(key, value);
      });
      params.append('limit', '100'); // Increased limit for better analytics

      const response = await fetch(`/api/admin/activities?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const activitiesData = data.activities || [];
        setActivities(activitiesData);
        
        // Calculate analytics
        calculateAnalytics(activitiesData);
        
        if (showRefreshing) {
          toast.success('Activity data refreshed successfully');
        }
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      toast.error('Failed to fetch activity data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateAnalytics = (activitiesData: UserActivity[]) => {
    const uniqueUsers = new Set(activitiesData.map(a => a.userId)).size;
    const actionCounts = activitiesData.reduce((acc, activity) => {
      acc[activity.action] = (acc[activity.action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topActions = Object.entries(actionCounts)
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Group activities by date for trends
    const dateGroups = activitiesData.reduce((acc, activity) => {
      const date = format(new Date(activity.createdAt), 'MMM dd');
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const activityTrends = Object.entries(dateGroups)
      .map(([date, count]) => ({ date, count }))
      .slice(-7); // Last 7 days
    
    // User activity breakdown
    const userCounts = activitiesData.reduce((acc, activity) => {
      const userName = activity.user.name || activity.user.email;
      acc[userName] = (acc[userName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const userActivityBreakdown = Object.entries(userCounts)
      .map(([user, count]) => ({ user, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // IP address analysis
    const ipCounts = activitiesData.reduce((acc, activity) => {
      if (activity.ipAddress) {
        acc[activity.ipAddress] = (acc[activity.ipAddress] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    
    const ipAddresses = Object.entries(ipCounts)
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Calculate risk score based on suspicious activities
    const suspiciousActions = activitiesData.filter(a => 
      ['DELETE', 'UPDATE'].includes(a.action) && 
      ['USER', 'SETTINGS'].includes(a.entityType)
    ).length;
    const riskScore = Math.min(100, (suspiciousActions / activitiesData.length) * 100);
    
    setAnalytics({
      totalActivities: activitiesData.length,
      uniqueUsers,
      activeSessions: Math.floor(uniqueUsers * 0.7), // Estimate active sessions
      topActions,
      activityTrends,
      userActivityBreakdown,
      ipAddresses,
      riskScore
    });
  };

  const handleRefresh = () => {
    fetchActivities(true);
    fetchLoginHistory(true);
  };

  const fetchLoginHistory = async (showRefreshing = false) => {
    if (!isMounted) return;
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('No auth token available, skipping login history fetch');
        return;
      }
      
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all' && key !== 'action' && key !== 'entityType') {
          params.append(key, value);
        }
      });
      params.append('limit', '50'); // Increased limit

      const response = await fetch(`/api/admin/login-history?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setLoginHistory(data.history || []);
      }
    } catch (error) {
      console.error('Error fetching login history:', error);
    }
  };

  const generateReport = async (type: 'activities' | 'login-history' | 'user-summary', format: 'json' | 'csv') => {
    try {
      const token = localStorage.getItem('authToken');
      const userIds = filters.userId ? [filters.userId] : undefined;
      const response = await fetch('/api/admin/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type,
          userIds,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          format,
        }),
      });

      if (response.ok) {
        if (format === 'csv') {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${type}-report.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        } else {
          const data = await response.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${type}-report.json`;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      }
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  const getActionColor = (action: string) => {
    const colors = {
      CREATE: 'bg-green-100 text-green-800',
      UPDATE: 'bg-blue-100 text-blue-800',
      DELETE: 'bg-red-100 text-red-800',
      LOGIN: 'bg-emerald-100 text-emerald-800',
      LOGOUT: 'bg-orange-100 text-orange-800',
      VIEW: 'bg-gray-100 text-gray-800',
      EXPORT: 'bg-purple-100 text-purple-800',
      IMPORT: 'bg-indigo-100 text-indigo-800',
    };
    return colors[action as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Show loading state while component is mounting
  if (!isMounted) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600" />
            Activity Monitoring
          </h1>
          <p className="text-muted-foreground">Track user activities, login history, and generate reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
          <Button
            variant="outline"
            onClick={() => generateReport('activities', 'csv')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Activities
          </Button>
          <Button
            variant="outline"
            onClick={() => generateReport('login-history', 'csv')}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Login History
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">User</label>
              <Select value={filters.userId} onValueChange={(value) => setFilters(prev => ({ ...prev, userId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {activeTab === 'activities' && (
              <>
                <div>
                  <label className="text-sm font-medium mb-2 block">Action</label>
                  <Select value={filters.action} onValueChange={(value) => setFilters(prev => ({ ...prev, action: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All actions</SelectItem>
                      <SelectItem value="CREATE">Create</SelectItem>
                      <SelectItem value="UPDATE">Update</SelectItem>
                      <SelectItem value="DELETE">Delete</SelectItem>
                      <SelectItem value="LOGIN">Login</SelectItem>
                      <SelectItem value="LOGOUT">Logout</SelectItem>
                      <SelectItem value="VIEW">View</SelectItem>
                      <SelectItem value="EXPORT">Export</SelectItem>
                      <SelectItem value="IMPORT">Import</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Entity Type</label>
                  <Select value={filters.entityType} onValueChange={(value) => setFilters(prev => ({ ...prev, entityType: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="All entities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All entities</SelectItem>
                      <SelectItem value="TRUCK">Truck</SelectItem>
                      <SelectItem value="MAINTENANCE_RECORD">Maintenance Record</SelectItem>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="SETTINGS">Settings</SelectItem>
                      <SelectItem value="USER_SESSION">User Session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {activeTab === 'login-history' && (
              <div>
                <label className="text-sm font-medium mb-2 block">Session Status</label>
                <Select value={filters.isActive} onValueChange={(value) => setFilters(prev => ({ ...prev, isActive: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sessions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sessions</SelectItem>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium mb-2 block">Start Date</label>
              <Input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">End Date</label>
              <Input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setFilters({ userId: '', action: '', entityType: '', startDate: '', endDate: '', isActive: '' })}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalActivities}</div>
            <p className="text-xs text-muted-foreground">
              Last {filters.startDate ? 'filtered period' : '30 days'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.uniqueUsers}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.activeSessions} active sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(100 - analytics.riskScore)}%</div>
            <div className="mt-2">
              <Progress value={100 - analytics.riskScore} className="h-2" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.riskScore < 20 ? 'Low risk' : analytics.riskScore < 50 ? 'Medium risk' : 'High risk'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Action</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics.topActions[0]?.action || 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {analytics.topActions[0]?.count || 0} occurrences
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            User Activities
          </TabsTrigger>
          <TabsTrigger value="login-history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Login History
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Activity Trends</CardTitle>
                <CardDescription>Daily activity over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={analytics.activityTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip />
                    <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Actions</CardTitle>
                <CardDescription>Most frequent user actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.topActions.map((action, index) => (
                    <div key={action.action} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={getActionColor(action.action)}>
                          {action.action}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(action.count / Math.max(...analytics.topActions.map(a => a.count))) * 100}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium w-8">{action.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Most Active Users</CardTitle>
                <CardDescription>Users with highest activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analytics.userActivityBreakdown.map((user, index) => (
                    <div key={user.user} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">{user.user}</div>
                          <div className="text-sm text-muted-foreground">{user.count} activities</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>IP Address Analysis</CardTitle>
                <CardDescription>Most frequent IP addresses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.ipAddresses.slice(0, 5).map((ip, index) => (
                    <div key={ip.ip} className="flex items-center justify-between p-2 rounded border">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-sm">{ip.ip}</span>
                      </div>
                      <Badge variant="outline">{ip.count} requests</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Activities</CardTitle>
              <CardDescription>
                Track all user actions including create, update, delete operations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Entity Type</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Risk</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Loading activities...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Activity className="h-8 w-8 text-gray-300" />
                            <p className="text-muted-foreground">No activities found</p>
                            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      activities.slice(0, 25).map((activity) => {
                        const isHighRisk = ['DELETE', 'UPDATE'].includes(activity.action) && 
                                         ['USER', 'SETTINGS'].includes(activity.entityType);
                        return (
                          <TableRow key={activity.id} className={isHighRisk ? 'bg-red-50' : ''}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  activity.user.role === 'ADMIN' ? 'bg-red-500' :
                                  activity.user.role === 'MANAGER' ? 'bg-blue-500' : 'bg-green-500'
                                }`}></div>
                                <div>
                                  <div className="font-medium">{activity.user.name || activity.user.email}</div>
                                  <div className="text-sm text-muted-foreground">{activity.user.role}</div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getActionColor(activity.action)}>
                                {activity.action}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{activity.entityType}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {activity.entityName || '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Globe className="h-3 w-3 text-muted-foreground" />
                                <span className="font-mono text-xs">{activity.ipAddress || '-'}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {format(new Date(activity.createdAt), 'MMM dd, yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(activity.createdAt), 'HH:mm:ss')}
                              </div>
                            </TableCell>
                            <TableCell>
                              {isHighRisk ? (
                                <Badge variant="destructive" className="text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  High
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Low
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
                {activities.length > 25 && (
                  <div className="p-4 text-center text-sm text-muted-foreground border-t">
                    Showing first 25 of {activities.length} activities. Use filters to narrow results.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="login-history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Login History</CardTitle>
              <CardDescription>
                Track user login/logout times and session durations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Login Time</TableHead>
                      <TableHead>Logout Time</TableHead>
                      <TableHead>Session Duration</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Device Info</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex items-center justify-center gap-2">
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Loading login history...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : loginHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <div className="flex flex-col items-center gap-2">
                            <Clock className="h-8 w-8 text-gray-300" />
                            <p className="text-muted-foreground">No login history found</p>
                            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      loginHistory.slice(0, 25).map((history) => (
                        <TableRow key={history.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                history.user.role === 'ADMIN' ? 'bg-red-500' :
                                history.user.role === 'MANAGER' ? 'bg-blue-500' : 'bg-green-500'
                              }`}></div>
                              <div>
                                <div className="font-medium">{history.user.name || history.user.email}</div>
                                <div className="text-sm text-muted-foreground">{history.user.role}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {format(new Date(history.loginTime), 'MMM dd, yyyy')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(history.loginTime), 'HH:mm:ss')}
                            </div>
                          </TableCell>
                          <TableCell>
                            {history.logoutTime ? (
                              <div>
                                <div className="text-sm">
                                  {format(new Date(history.logoutTime), 'MMM dd, yyyy')}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {format(new Date(history.logoutTime), 'HH:mm:ss')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {formatDuration(history.sessionDuration)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono text-xs">{history.ipAddress || '-'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground">
                              Browser info not available
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={history.isActive ? 'default' : 'secondary'}>
                              <div className={`w-2 h-2 rounded-full mr-1 ${
                                history.isActive ? 'bg-green-400' : 'bg-gray-400'
                              }`}></div>
                              {history.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {loginHistory.length > 25 && (
                  <div className="p-4 text-center text-sm text-muted-foreground border-t">
                    Showing first 25 of {loginHistory.length} login sessions. Use filters to narrow results.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Activity Distribution</CardTitle>
                <CardDescription>Actions performed by users</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={analytics.topActions}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ action, count }) => `${action}: ${count}`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="count"
                    >
                      {analytics.topActions.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Activity Comparison</CardTitle>
                <CardDescription>Activity levels by user</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.userActivityBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="user" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <ChartTooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}