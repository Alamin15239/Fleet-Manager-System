'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Search, Download, Filter, User, Activity, Clock } from 'lucide-react';
import { format } from 'date-fns';

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
  const [isMounted, setIsMounted] = useState(false);
  const [filters, setFilters] = useState({
    userId: 'all',
    action: 'all',
    entityType: 'all',
    startDate: '',
    endDate: '',
    isActive: 'all',
  });
  const [activeTab, setActiveTab] = useState('activities');

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

  const fetchActivities = async () => {
    if (!isMounted) return;
    
    setLoading(true);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.log('No auth token available, skipping activities fetch');
        setLoading(false);
        return;
      }
      
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') params.append(key, value);
      });
      params.append('limit', '25'); // Add default limit

      const response = await fetch(`/api/admin/activities?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Handle API response format: { success: true, activities: [...] }
        setActivities(data.activities || []);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoginHistory = async () => {
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
      params.append('limit', '25'); // Add default limit

      const response = await fetch(`/api/admin/login-history?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        // Handle API response format: { success: true, history: [...] }
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
          <h1 className="text-3xl font-bold">Activity Monitoring</h1>
          <p className="text-gray-600">Track user activities, login history, and generate reports</p>
        </div>
        <div className="flex gap-2">
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="activities" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            User Activities
          </TabsTrigger>
          <TabsTrigger value="login-history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Login History
          </TabsTrigger>
        </TabsList>

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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Loading activities...
                        </TableCell>
                      </TableRow>
                    ) : activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          No activities found
                        </TableCell>
                      </TableRow>
                    ) : (
                      activities.map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <div>
                                <div className="font-medium">{activity.user.name || activity.user.email}</div>
                                <div className="text-sm text-gray-500">{activity.user.role}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionColor(activity.action)}>
                              {activity.action}
                            </Badge>
                          </TableCell>
                          <TableCell>{activity.entityType}</TableCell>
                          <TableCell className="max-w-xs truncate">{activity.entityName || '-'}</TableCell>
                          <TableCell>{activity.ipAddress || '-'}</TableCell>
                          <TableCell>
                            {format(new Date(activity.createdAt), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
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
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          Loading login history...
                        </TableCell>
                      </TableRow>
                    ) : loginHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          No login history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      loginHistory.map((history) => (
                        <TableRow key={history.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              <div>
                                <div className="font-medium">{history.user.name || history.user.email}</div>
                                <div className="text-sm text-gray-500">{history.user.role}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(history.loginTime), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            {history.logoutTime 
                              ? format(new Date(history.logoutTime), 'MMM dd, yyyy HH:mm')
                              : '-'
                            }
                          </TableCell>
                          <TableCell>{formatDuration(history.sessionDuration)}</TableCell>
                          <TableCell>{history.ipAddress || '-'}</TableCell>
                          <TableCell>
                            <Badge variant={history.isActive ? 'default' : 'secondary'}>
                              {history.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}