'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Bell, CheckCircle2, Info, RefreshCw } from 'lucide-react'
import { apiFetch, apiGet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LocalizedText } from '@/components/localized-text'
import { useLanguage } from '@/contexts/language-context'

type Notification = {
  id: string
  type: 'success' | 'warning' | 'info'
  title: string
  message: string
  createdAt: string
  read: boolean
  truckId: string | null
  truck: { id: string; vin: string; make: string; model: string; licensePlate: string } | null
}

export default function NotificationsPage() {
  const { language, t } = useLanguage()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [error, setError] = useState(false)
  const [hasMore, setHasMore] = useState(false)

  const loadNotifications = useCallback(async (refresh = false) => {
    setError(false)
    if (refresh) setRefreshing(true)
    else setLoading(true)

    try {
      const response = await apiGet('/api/notifications?limit=100&offset=0')
      if (!response.ok) throw new Error('Could not load notifications')
      const data = await response.json()
      const records = Array.isArray(data) ? data : []
      setNotifications(records)
      setHasMore(records.length === 100)
    } catch (loadError) {
      console.error('Could not load notifications:', loadError)
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const response = await apiGet(`/api/notifications?limit=100&offset=${notifications.length}`)
      if (!response.ok) throw new Error('Could not load more notifications')
      const data = await response.json()
      const records: Notification[] = Array.isArray(data) ? data : []
      setNotifications(current => [...current, ...records])
      setHasMore(records.length === 100)
    } catch (loadError) {
      console.error('Could not load more notifications:', loadError)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  const visibleNotifications = useMemo(
    () => unreadOnly ? notifications.filter(notification => !notification.read) : notifications,
    [notifications, unreadOnly],
  )
  const unreadCount = notifications.filter(notification => !notification.read).length

  const markAsRead = async (id: string) => {
    try {
      const response = await apiFetch(`/api/notifications?id=${encodeURIComponent(id)}&action=markAsRead`, { method: 'PATCH' })
      if (!response.ok) throw new Error('Could not update notification')
      setNotifications(current => current.map(notification => notification.id === id ? { ...notification, read: true } : notification))
    } catch (updateError) {
      console.error('Could not update notification:', updateError)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await apiFetch('/api/notifications?action=markAllAsRead', { method: 'PATCH' })
      if (!response.ok) throw new Error('Could not update notifications')
      setNotifications(current => current.map(notification => ({ ...notification, read: true })))
    } catch (updateError) {
      console.error('Could not update notifications:', updateError)
    }
  }

  const iconFor = (type: Notification['type']) => {
    if (type === 'success') return <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
    if (type === 'warning') return <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
    return <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
  }

  const formatDate = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '—'
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date)
  }

  return (
    <div className="container mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold sm:text-3xl">
            <Bell className="h-7 w-7 text-sky-600" />
            <LocalizedText>Notifications</LocalizedText>
            {unreadCount > 0 && <Badge variant="secondary">{unreadCount}</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground"><LocalizedText>Review fleet and system updates.</LocalizedText></p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadNotifications(true)} disabled={refreshing}>
            <RefreshCw className={`me-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <LocalizedText>Refresh</LocalizedText>
          </Button>
          <Button onClick={markAllAsRead} disabled={unreadCount === 0 || loading}>
            <LocalizedText>Mark all read</LocalizedText>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg"><LocalizedText>Notification history</LocalizedText></CardTitle>
          <div className="flex gap-2" role="group" aria-label={t('Notification filters')}>
            <Button size="sm" variant={!unreadOnly ? 'default' : 'outline'} onClick={() => setUnreadOnly(false)}>
              <LocalizedText>All</LocalizedText>
              <span className="ms-1">({notifications.length})</span>
            </Button>
            <Button size="sm" variant={unreadOnly ? 'default' : 'outline'} onClick={() => setUnreadOnly(true)}>
              <LocalizedText>Unread</LocalizedText>
              <span className="ms-1">({unreadCount})</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-10 text-center text-sm text-muted-foreground"><LocalizedText>Loading notifications...</LocalizedText></p>
          ) : error ? (
            <div className="py-10 text-center">
              <p className="mb-3 text-sm text-destructive"><LocalizedText>Unable to load notifications.</LocalizedText></p>
              <Button variant="outline" onClick={() => void loadNotifications()}><LocalizedText>Try again</LocalizedText></Button>
            </div>
          ) : visibleNotifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-3 h-8 w-8 opacity-40" />
              <LocalizedText>{unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}</LocalizedText>
            </div>
          ) : (
            <ul className="divide-y">
              {visibleNotifications.map(notification => (
                <li key={notification.id} className={`flex gap-3 py-4 ${notification.read ? 'opacity-75' : ''}`}>
                  {iconFor(notification.type)}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-medium">{t(notification.title)}</h2>
                      {!notification.read && <Badge variant="secondary"><LocalizedText>New</LocalizedText></Badge>}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{t(notification.message)}</p>
                    {notification.truck && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {notification.truck.make} {notification.truck.model} · {notification.truck.licensePlate}
                      </p>
                    )}
                    <time className="mt-2 block text-xs text-muted-foreground" dateTime={notification.createdAt}>
                      {formatDate(notification.createdAt)}
                    </time>
                  </div>
                  {!notification.read && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => void markAsRead(notification.id)}>
                      <LocalizedText>Mark read</LocalizedText>
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!loading && !error && hasMore && (
            <div className="pt-4 text-center">
              <Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                {loadingMore ? <LocalizedText>Loading...</LocalizedText> : <LocalizedText>Load more</LocalizedText>}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
