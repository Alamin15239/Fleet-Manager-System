'use client';
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, Clock, LockKeyhole } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';

interface SystemCheck {
  status: 'operational' | 'warning' | 'error';
  message: string;
}

interface SystemStatus {
  status: string;
  timestamp: string;
  checks: {
    authentication: SystemCheck;
    database: SystemCheck;
    fileStorage: SystemCheck;
    reportGeneration: SystemCheck;
  };
}

interface Activity {
  id: string;
  description: string;
  timestamp: string;
  user: string;
}

export default function SystemStatus() {
  const { token, user } = useAuth();
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role === 'ADMIN') fetchSystemStatus();
    else {
      setStatusMessage('Administrator access required');
      setLoading(false);
    }
    if (token) fetchRecentActivity();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      if (user?.role === 'ADMIN') fetchSystemStatus();
      if (token) fetchRecentActivity();
    }, 30000);

    return () => clearInterval(interval);
  }, [token, user?.role]);

  const fetchSystemStatus = async () => {
    if (!token) {
      setStatusMessage('Authentication required');
      setLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/system/status', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
        setStatusMessage(null);
      } else {
        const data = await response.json().catch(() => ({}));
        setStatusMessage(data.error || `System status request failed (${response.status})`);
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
      setStatusMessage('Unable to load system status');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    if (!token) {
      setActivities([]);
      return;
    }
    try {
      const response = await fetch(`/api/system/activity?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities);
      }
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return <Badge className="bg-green-100 text-green-800"><LocalizedText>Operational</LocalizedText></Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800"><LocalizedText>Warning</LocalizedText></Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><LocalizedText>Error</LocalizedText></Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800"><LocalizedText>Unknown</LocalizedText></Badge>;
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  };

  const checks = systemStatus ? [
    { label: 'Authentication', check: systemStatus.checks.authentication },
    { label: 'Database', check: systemStatus.checks.database },
    { label: 'File Storage', check: systemStatus.checks.fileStorage },
    { label: 'Report Generation', check: systemStatus.checks.reportGeneration },
  ] : [];
  const overallStatus = systemStatus?.status === 'healthy'
    ? 'operational'
    : systemStatus?.status === 'degraded' ? 'warning' : 'error';

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle><LocalizedText>System Status</LocalizedText></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle><LocalizedText>System Status</LocalizedText></CardTitle>
        </CardHeader>
        <CardContent>
          {user?.role !== 'ADMIN' ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              <LockKeyhole className="h-4 w-4 shrink-0" />
              <LocalizedText>Administrator access required</LocalizedText>
            </div>
          ) : systemStatus ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground"><LocalizedText>Overall System Health</LocalizedText></p>
                  <p className="mt-1 text-sm font-semibold"><LocalizedText>{systemStatus.status === 'degraded' ? 'Degraded' : systemStatus.status === 'unhealthy' ? 'Unhealthy' : 'Healthy'}</LocalizedText></p>
                </div>
                {getStatusBadge(overallStatus)}
                <p className="text-xs text-muted-foreground"><LocalizedText>Last checked</LocalizedText> {new Date(systemStatus.timestamp).toLocaleTimeString()}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {checks.map(({ label, check }) => (
                  <div key={label} className="flex min-w-0 items-start justify-between gap-3 rounded-xl border p-3.5">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="mt-0.5">{getStatusIcon(check.status)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold"><LocalizedText>{label}</LocalizedText></p>
                        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground"><LocalizedText>{check.message}</LocalizedText></p>
                      </div>
                    </div>
                    <div className="shrink-0">{getStatusBadge(check.status)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-500">{statusMessage || <LocalizedText>Unable to load system status</LocalizedText>}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle><LocalizedText>Recent Activity</LocalizedText></CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{activity.description}</div>
                    <div className="text-sm text-gray-500">by {activity.user}</div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatTimeAgo(activity.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm"><LocalizedText>No recent activities</LocalizedText></p>
              <p className="text-xs text-gray-400"><LocalizedText>Activities will appear here as users interact with the system</LocalizedText></p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
