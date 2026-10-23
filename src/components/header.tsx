'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useSidebar } from '@/contexts/sidebar-context'
import { useAuth } from '@/contexts/auth-context'
import { ProfilePicture } from '@/components/profile-picture'
import {
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  Settings,
  LogOut,
  User,
  BookOpen,
  ShieldCheck,
  FileText,
  Search,
  ArrowRight,
  Gauge,
  Truck,
  Caravan,
  CircleDot,
  ClipboardCheck,
  Droplets,
  ReceiptText,
  Wrench,
  ChartNoAxesCombined,
  FileBarChart,
  FileSpreadsheet,
  Users,
  Shield,
  Building2,
  CreditCard,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/theme-toggle'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useLanguage } from '@/contexts/language-context'
import { usePermissions } from '@/contexts/permissions-context'

interface Notification {
  id: string
  type: 'success' | 'warning' | 'info'
  title: string
  message: string
  time: string
  read: boolean
}

const quickNavigationPages: Array<{
  label: string
  href: string
  resource: string
  icon: LucideIcon
  iconColor: string
  iconBackground: string
  keywords: string
}> = [
  { label: 'nav.dashboard', href: '/', resource: 'dashboard', icon: Gauge, iconColor: 'text-violet-600 dark:text-violet-400', iconBackground: 'bg-violet-500/10', keywords: 'home overview' },
  { label: 'nav.trucks', href: '/trucks', resource: 'trucks', icon: Truck, iconColor: 'text-blue-600 dark:text-blue-400', iconBackground: 'bg-blue-500/10', keywords: 'vehicle fleet lorry' },
  { label: 'nav.trailers', href: '/trailers', resource: 'trailers', icon: Caravan, iconColor: 'text-orange-600 dark:text-orange-400', iconBackground: 'bg-orange-500/10', keywords: 'trailer fleet' },
  { label: 'nav.tireManagement', href: '/tire-management', resource: 'tire-management', icon: CircleDot, iconColor: 'text-amber-600 dark:text-amber-400', iconBackground: 'bg-amber-500/10', keywords: 'tyres inventory tire management' },
  { label: 'nav.jobCards', href: '/job-cards', resource: 'maintenance', icon: ClipboardCheck, iconColor: 'text-emerald-600 dark:text-emerald-400', iconBackground: 'bg-emerald-500/10', keywords: 'workshop maintenance repair' },
  { label: 'nav.oilChanges', href: '/oil-changes', resource: 'maintenance', icon: Droplets, iconColor: 'text-cyan-600 dark:text-cyan-400', iconBackground: 'bg-cyan-500/10', keywords: 'oil filter service' },
  { label: 'Purchase invoices & accounts', href: '/purchase-invoices', resource: 'purchase-invoices', icon: ReceiptText, iconColor: 'text-indigo-600 dark:text-indigo-400', iconBackground: 'bg-indigo-500/10', keywords: 'invoice vendor expenses vat' },
  { label: 'nav.mechanics', href: '/mechanics', resource: 'mechanics', icon: Wrench, iconColor: 'text-rose-600 dark:text-rose-400', iconBackground: 'bg-rose-500/10', keywords: 'technician workshop' },
  { label: 'nav.analytics', href: '/advanced-analytics', resource: 'advanced-analytics', icon: ChartNoAxesCombined, iconColor: 'text-fuchsia-600 dark:text-fuchsia-400', iconBackground: 'bg-fuchsia-500/10', keywords: 'insights charts' },
  { label: 'nav.reports', href: '/reports', resource: 'reports', icon: FileBarChart, iconColor: 'text-indigo-600 dark:text-indigo-400', iconBackground: 'bg-indigo-500/10', keywords: 'export pdf' },
  { label: 'nav.excelImports', href: '/excel-imports', resource: 'excel-imports', icon: FileSpreadsheet, iconColor: 'text-green-600 dark:text-green-400', iconBackground: 'bg-green-500/10', keywords: 'workbook sync changes excel' },
  { label: 'nav.users', href: '/users', resource: 'users', icon: Users, iconColor: 'text-purple-600 dark:text-purple-400', iconBackground: 'bg-purple-500/10', keywords: 'accounts people' },
  { label: 'nav.profile', href: '/profile', resource: 'profile', icon: User, iconColor: 'text-sky-600 dark:text-sky-400', iconBackground: 'bg-sky-500/10', keywords: 'account' },
  { label: 'nav.settings', href: '/settings', resource: 'settings', icon: Settings, iconColor: 'text-slate-600 dark:text-slate-300', iconBackground: 'bg-slate-500/10', keywords: 'preferences configuration' },
  { label: 'nav.admin', href: '/admin', resource: 'admin', icon: Shield, iconColor: 'text-red-600 dark:text-red-400', iconBackground: 'bg-red-500/10', keywords: 'administration system' },
  { label: 'nav.organizations', href: '/organizations', resource: 'admin', icon: Building2, iconColor: 'text-indigo-600 dark:text-indigo-400', iconBackground: 'bg-indigo-500/10', keywords: 'workspace company' },
]

export function Header() {
  const router = useRouter()
  const { toggleSidebar, isSidebarOpen } = useSidebar()
  const { user, logout } = useAuth()
  const { hasPermission, isLoading: permissionsLoading } = usePermissions()
  const canViewProfile = hasPermission('profile', 'read')
  const { t, language } = useLanguage()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [quickNavigationOpen, setQuickNavigationOpen] = useState(false)

  const availableQuickLinks = quickNavigationPages.filter((page) =>
    (user?.role === 'ADMIN' || hasPermission(page.resource, 'read')) &&
    (page.href !== '/organizations' || user?.isPrimaryOrganization !== false),
  )

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setQuickNavigationOpen(true)
      }
    }

    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    // Fetch real notifications from API
    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('authToken')
        if (!token) {
          setNotifications([])
          setLoading(false)
          return
        }

        const response = await fetch('/api/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
        if (response.ok) {
          const data = await response.json()
          setNotifications(data || [])
        } else {
          setNotifications([])
        }
      } catch (error) {
        console.error('Error fetching notifications:', error)
        setNotifications([])
      } finally {
        setLoading(false)
      }
    }

    fetchNotifications()
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch(`/api/notifications?id=${id}&action=markAsRead`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        setNotifications(notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        ))
      }
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) return

      const response = await fetch('/api/notifications?action=markAllAsRead', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      if (response.ok) {
        setNotifications(notifications.map(n => ({ ...n, read: true })))
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error)
    }
  }

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />
      default:
        return <Info className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <header className="sticky top-0 z-30 flex shrink-0 items-center justify-between gap-2 border-b border-border/70 bg-background/90 px-3 py-2.5 shadow-sm shadow-slate-950/[0.025] backdrop-blur-md sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-1 sm:gap-3">
        {/* Sidebar Toggle Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          aria-label={t(isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu')}
          title={t(isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu')}
          className="h-11 w-11 p-2 sm:h-9 sm:w-9"
        >
          {isSidebarOpen ? (
            <>
              <X className="h-4 w-4 md:hidden" />
              <PanelLeftClose className="hidden h-4 w-4 md:block" />
            </>
          ) : (
            <>
              <Menu className="h-4 w-4 md:hidden" />
              <PanelLeftOpen className="hidden h-4 w-4 md:block" />
            </>
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setQuickNavigationOpen(true)}
          aria-label={t('nav.quickSearch')}
          title={t('nav.quickSearch')}
          className="hidden h-9 min-w-52 justify-between rounded-xl border-white/70 bg-white/50 px-3 text-muted-foreground shadow-sm backdrop-blur-md hover:bg-white/75 sm:flex dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          <span className="flex items-center gap-2 text-sm"><Search className="h-4 w-4" />{t('nav.quickSearch')}</span>
          <kbd dir="ltr" className="rounded-md border border-border/70 bg-background/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Ctrl / ⌘ K</kbd>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setQuickNavigationOpen(true)}
          aria-label={t('nav.quickSearch')}
          title={t('nav.quickSearch')}
          className="h-11 w-11 rounded-xl sm:hidden"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
  

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={t('Notifications')} title={t('Notifications')} className="relative h-11 w-11 rounded-xl p-2 sm:h-9 sm:w-9">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-1rem)]">
            <DropdownMenuLabel className="flex items-center justify-between">
              <span>{t('Notifications')}</span>
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="text-xs h-6"
                >
                  {t('Mark all read')}
                </Button>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <ScrollArea className="h-80">
                {loading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {t('Loading notifications...')}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {t('No notifications')}
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="flex-col items-start p-4 cursor-pointer"
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex items-start space-x-3 w-full">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between">
                            <p className={`text-sm font-medium ${!notification.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {t(notification.title)}
                            </p>
                            {!notification.read && (
                              <div className="h-2 w-2 bg-primary rounded-full" />
                            )}
                          </div>
                          <p className={`text-xs ${!notification.read ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
                            {t(notification.message)}
                          </p>
                          <p className="text-xs text-muted-foreground/50">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </ScrollArea>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-center justify-center text-sm text-primary"
              onSelect={() => router.push('/notifications')}
            >
              {t('View all notifications')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" aria-label={canViewProfile ? t('Open profile') : t('Account menu')} title={canViewProfile ? t('Open profile') : t('Account menu')} className="relative h-11 w-11 rounded-xl p-0 sm:h-9 sm:w-9">
              {canViewProfile ? <ProfilePicture size="md" /> : <User className="h-5 w-5 text-muted-foreground" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                {canViewProfile ? <>
                  <p className="text-sm font-medium leading-none">
                    {user?.name || t('User')}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                  {user?.title && <p className="text-xs leading-none text-muted-foreground">{user.title}</p>}
                  {user?.department && <p className="text-xs leading-none text-muted-foreground">{user.department}</p>}
                </> : <p className="text-sm font-medium leading-none">{t('Account')}</p>}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {hasPermission('profile', 'read') && <DropdownMenuItem onClick={() => router.push('/profile')}>
                <User className="me-2 h-4 w-4" />
                <span>{t('Profile')}</span>
              </DropdownMenuItem>}
              {hasPermission('settings', 'read') && <DropdownMenuItem onClick={() => router.push('/settings')}>
                <Settings className="me-2 h-4 w-4" />
                <span>{t('Settings')}</span>
              </DropdownMenuItem>}
              {user?.role === 'ADMIN' && user.isPrimaryOrganization === false && <DropdownMenuItem onClick={() => router.push('/billing')}>
                <CreditCard className="me-2 h-4 w-4" />
                <span>{t('Billing & subscription')}</span>
              </DropdownMenuItem>}
              <DropdownMenuItem onClick={() => router.push('/help')}>
                <BookOpen className="me-2 h-4 w-4" />
                <span>{t('User Guide')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/privacy')}>
                <ShieldCheck className="me-2 h-4 w-4" />
                <span>{t('Privacy Policy')}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/agreement')}>
                <FileText className="me-2 h-4 w-4" />
                <span>{t('User Agreement')}</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOut className="me-2 h-4 w-4" />
              <span>{t('Log out')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandDialog
        open={quickNavigationOpen}
        onOpenChange={setQuickNavigationOpen}
        title="nav.quickNavigation"
        description="nav.searchPages"
        className="rounded-2xl border-white/70 shadow-2xl sm:max-w-xl dark:border-white/10"
      >
        <CommandInput placeholder="nav.searchPages" />
        <CommandList className="max-h-[60vh] p-2 sm:max-h-[26rem]">
          <CommandEmpty>{t('nav.noMatchingPages')}</CommandEmpty>
          <CommandGroup heading={t('nav.quickNavigation')}>
            {!permissionsLoading && availableQuickLinks.map((page) => {
              const PageIcon = page.icon
              return (
                <CommandItem
                  key={page.href}
                  value={`${t(page.label)} ${page.keywords}`}
                  onSelect={() => {
                    setQuickNavigationOpen(false)
                    router.push(page.href)
                  }}
                  className="min-h-12 rounded-xl px-3"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${page.iconBackground}`}>
                    <PageIcon className={`h-4 w-4 ${page.iconColor}`} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t(page.label)}</span>
                  <ArrowRight className={`h-4 w-4 text-muted-foreground/60 ${language === 'ar' ? 'rotate-180' : ''}`} />
                </CommandItem>
              )
            })}
          </CommandGroup>
        </CommandList>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-[11px] text-muted-foreground">
          <span>{t('nav.keyboardHint')}</span>
          <kbd className="rounded border border-border/70 bg-background/70 px-1.5 py-0.5">Esc</kbd>
        </div>
      </CommandDialog>
    </header>
  )
}
