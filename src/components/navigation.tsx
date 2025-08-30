'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions } from '@/contexts/permissions-context'
import { useSidebar } from '@/contexts/sidebar-context'
import { 
  Home, 
  Truck, 
  Wrench, 
  UserCheck,
  Settings,
  FileText,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Lock,
  TrendingUp,
  Zap,
  User,
  Shield,
  Edit3
} from 'lucide-react'
import { useLanguage } from '@/contexts/language-context'
import { LanguageToggle } from '@/components/language-toggle'
import { TruckLoader } from '@/components/ui/truck-loader'

const getNavigation = (t: (key: string) => string) => [
  { 
    name: t('nav.dashboard'), 
    href: '/', 
    icon: Home,
    resource: 'dashboard',
    action: 'read'
  },
  { 
    name: t('nav.trucks'), 
    href: '/trucks', 
    icon: Truck,
    resource: 'trucks',
    action: 'read'
  },
  { 
    name: t('nav.maintenance'), 
    href: '/maintenance', 
    icon: Wrench,
    resource: 'maintenance',
    action: 'read'
  },
  { 
    name: t('nav.mechanics'), 
    href: '/mechanics', 
    icon: UserCheck,
    resource: 'mechanics',
    action: 'read'
  },
  { 
    name: t('nav.tires'), 
    href: '/tire-management', 
    icon: Zap,
    resource: 'tire-management',
    action: 'read'
  },
  { 
    name: t('nav.analytics'), 
    href: '/advanced-analytics', 
    icon: TrendingUp,
    resource: 'advanced-analytics',
    action: 'read'
  },
  { 
    name: t('nav.reports'), 
    href: '/reports', 
    icon: FileText,
    resource: 'reports',
    action: 'read'
  },
  { 
    name: t('nav.documents'), 
    href: '/editor', 
    icon: Edit3,
    resource: 'documents',
    action: 'read'
  },
  { 
    name: t('nav.users'), 
    href: '/users', 
    icon: Users,
    resource: 'users',
    action: 'read'
  },
  { 
    name: t('nav.profile'), 
    href: '/profile', 
    icon: User,
    resource: 'profile',
    action: 'read'
  },
  { 
    name: t('nav.settings'), 
    href: '/settings', 
    icon: Settings,
    resource: 'settings',
    action: 'read'
  },
  { 
    name: t('nav.admin'), 
    href: '/admin', 
    icon: Shield,
    resource: 'admin',
    action: 'read'
  },
]

interface NavigationProps {
  userRole?: string
}

export function Navigation({ userRole = 'USER' }: NavigationProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { hasPermission, isLoading } = usePermissions()
  const { isSidebarOpen, toggleSidebar } = useSidebar()
  const { t } = useLanguage()
  
  const navigation = getNavigation(t)

  const handleLogout = () => {
    logout()
  }

  if (isLoading) {
    return (
      <nav className={cn(
        'flex flex-col bg-sidebar border-r border-sidebar-border min-h-screen transition-all duration-300',
        isSidebarOpen ? 'w-64' : 'w-16'
      )}>
        <div className="flex-1 flex items-center justify-center">
          <TruckLoader size="sm" />
        </div>
      </nav>
    )
  }

  return (
    <nav className={cn(
      'flex flex-col bg-sidebar border-r border-sidebar-border min-h-screen transition-all duration-300',
      isSidebarOpen ? 'w-64' : 'w-16'
    )}>
      <div className={cn(
        'flex items-center border-b border-sidebar-border',
        isSidebarOpen ? 'px-6 py-4 justify-between' : 'px-4 py-4 justify-center'
      )}>
        {isSidebarOpen && (
          <h1 className="text-xl font-bold text-sidebar-foreground">Fleet Manager</h1>
        )}
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="p-2 h-8 w-8"
          >
            {isSidebarOpen ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            // Admin users have access to everything
            const hasAccess = user?.role === 'ADMIN' || hasPermission(item.resource, item.action)
            const isActive = pathname === item.href
            
            if (!hasAccess) {
              return (
                <div
                  key={item.name}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-not-allowed',
                    'text-muted-foreground bg-muted/50',
                    !isSidebarOpen && 'justify-center'
                  )}
                  title={!isSidebarOpen ? `${item.name} (${t('message.accessDenied')})` : undefined}
                >
                  <item.icon className={cn(
                    'h-5 w-5',
                    isSidebarOpen ? 'mr-3' : ''
                  )} />
                  {isSidebarOpen && (
                    <div className="flex items-center justify-between w-full">
                      <span>{item.name}</span>
                      <Lock className="h-3 w-3" />
                    </div>
                  )}
                </div>
              )
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
                  !isSidebarOpen && 'justify-center'
                )}
                title={!isSidebarOpen ? item.name : undefined}
              >
                <item.icon className={cn(
                  'h-5 w-5',
                  isSidebarOpen ? 'mr-3' : ''
                )} />
                {isSidebarOpen && item.name}
              </Link>
            )
          })}
        </div>
      </div>
      
      {/* User Info */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        {isSidebarOpen ? (
          <>
            <div className="mb-3 px-3">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {user?.name || user?.email || 'User'}
              </p>
              <p className="text-xs text-sidebar-foreground/70">
                {user?.role || 'USER'}
              </p>
            </div>
            <Button 
              variant="ghost" 
              className="w-full justify-start"
              onClick={handleLogout}
            >
              <LogOut className="mr-3 h-5 w-5" />
              {t('nav.logout')}
            </Button>
          </>
        ) : (
          <Button 
            variant="ghost" 
            size="sm"
            className="w-full justify-center p-2"
            onClick={handleLogout}
            title={t('nav.logout')}
          >
            <LogOut className="h-5 w-5" />
          </Button>
        )}
      </div>
    </nav>
  )
}