'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { LocalizedText } from '@/components/localized-text'
import { ProfilePicture } from '@/components/profile-picture'
import { LanguageToggle } from '@/components/language-toggle'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'
import { usePermissions } from '@/contexts/permissions-context'
import { useSidebar } from '@/contexts/sidebar-context'
import { useLanguage } from '@/contexts/language-context'
import { TruckLoader } from '@/components/ui/truck-loader'
import {
  Activity,
  Building2,
  Caravan,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Droplets,
  FileBarChart,
  FileSpreadsheet,
  Gauge,
  CalendarClock,
  LogOut,
  ReceiptText,
  Settings,
  Shield,
  Truck,
  User,
  Users,
  Wrench,
} from 'lucide-react'

type NavItem = {
  name: string
  href: string
  icon: typeof Gauge
  iconColor: string
  iconBackground: string
  resource: string
  action: string
}

const getNavigationGroups = (t: (key: string) => string) => [
  {
    label: 'Workspace',
    items: [
      { name: t('nav.dashboard'), href: '/dashboard', icon: Gauge, iconColor: 'text-violet-600 dark:text-violet-400', iconBackground: 'bg-violet-500/10', resource: 'dashboard', action: 'read' },
    ],
  },
  {
    label: 'Fleet',
    items: [
      { name: t('nav.trucks'), href: '/trucks', icon: Truck, iconColor: 'text-blue-600 dark:text-blue-400', iconBackground: 'bg-blue-500/10', resource: 'trucks', action: 'read' },
      { name: t('Vehicle master & tracking'), href: '/fleet-planning', icon: CalendarClock, iconColor: 'text-teal-600 dark:text-teal-400', iconBackground: 'bg-teal-500/10', resource: 'trucks', action: 'read' },
      { name: t('nav.trailers'), href: '/trailers', icon: Caravan, iconColor: 'text-orange-600 dark:text-orange-400', iconBackground: 'bg-orange-500/10', resource: 'trailers', action: 'read' },
      { name: t('nav.tireManagement'), href: '/tire-management', icon: CircleDot, iconColor: 'text-amber-600 dark:text-amber-400', iconBackground: 'bg-amber-500/10', resource: 'tire-management', action: 'read' },
    ],
  },
  {
    label: 'Workshop',
    items: [
      { name: t('nav.jobCards'), href: '/job-cards', icon: ClipboardCheck, iconColor: 'text-emerald-600 dark:text-emerald-400', iconBackground: 'bg-emerald-500/10', resource: 'maintenance', action: 'read' },
      { name: t('nav.oilChanges'), href: '/oil-changes', icon: Droplets, iconColor: 'text-cyan-600 dark:text-cyan-400', iconBackground: 'bg-cyan-500/10', resource: 'maintenance', action: 'read' },
      { name: t('Purchase invoices & accounts'), href: '/purchase-invoices', icon: ReceiptText, iconColor: 'text-indigo-600 dark:text-indigo-400', iconBackground: 'bg-indigo-500/10', resource: 'purchase-invoices', action: 'read' },
      { name: t('nav.mechanics'), href: '/mechanics', icon: Wrench, iconColor: 'text-rose-600 dark:text-rose-400', iconBackground: 'bg-rose-500/10', resource: 'mechanics', action: 'read' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { name: t('nav.analytics'), href: '/advanced-analytics', icon: ChartNoAxesCombined, iconColor: 'text-fuchsia-600 dark:text-fuchsia-400', iconBackground: 'bg-fuchsia-500/10', resource: 'advanced-analytics', action: 'read' },
      { name: t('nav.reports'), href: '/reports', icon: FileBarChart, iconColor: 'text-indigo-600 dark:text-indigo-400', iconBackground: 'bg-indigo-500/10', resource: 'reports', action: 'read' },
      { name: t('nav.excelImports'), href: '/excel-imports', icon: FileSpreadsheet, iconColor: 'text-green-600 dark:text-green-400', iconBackground: 'bg-green-500/10', resource: 'excel-imports', action: 'read' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { name: t('nav.users'), href: '/users', icon: Users, iconColor: 'text-purple-600 dark:text-purple-400', iconBackground: 'bg-purple-500/10', resource: 'users', action: 'read' },
      { name: t('nav.profile'), href: '/profile', icon: User, iconColor: 'text-sky-600 dark:text-sky-400', iconBackground: 'bg-sky-500/10', resource: 'profile', action: 'read' },
      { name: t('nav.settings'), href: '/settings', icon: Settings, iconColor: 'text-slate-600 dark:text-slate-300', iconBackground: 'bg-slate-500/10', resource: 'settings', action: 'read' },
      { name: t('nav.admin'), href: '/admin', icon: Shield, iconColor: 'text-red-600 dark:text-red-400', iconBackground: 'bg-red-500/10', resource: 'admin', action: 'read' },
      { name: t('nav.organizations'), href: '/organizations', icon: Building2, iconColor: 'text-indigo-600 dark:text-indigo-400', iconBackground: 'bg-indigo-500/10', resource: 'admin', action: 'read' },
    ],
  },
]

export function Navigation() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const { hasPermission, isLoading } = usePermissions()
  const { isSidebarOpen, toggleSidebar, closeSidebar } = useSidebar()
  const { t, language } = useLanguage()
  const isArabic = language === 'ar'
  const navPosition = isArabic ? 'right-0 border-l' : 'left-0 border-r'
  const hiddenTransform = isArabic ? 'translate-x-full' : '-translate-x-full'
  const groups = getNavigationGroups(t)
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        (user?.role === 'ADMIN' || hasPermission(item.resource, item.action)) &&
        (item.href !== '/organizations' || user?.isPrimaryOrganization !== false),
      ),
    }))
    .filter((group) => group.items.length > 0)

  const sidebarClassName = cn(
    'glass-sidebar fixed inset-y-0 z-50 flex w-[min(19rem,86vw)] flex-col border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl shadow-black/10 transition-[width,transform] duration-300 ease-out md:sticky md:inset-x-auto md:top-0 md:z-auto md:h-dvh md:w-64 md:shrink-0 md:translate-x-0 md:shadow-none',
    navPosition,
    isSidebarOpen ? 'translate-x-0 md:w-64' : `${hiddenTransform} md:w-[4.5rem]`,
  )
  const brandClassName = cn('group flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring', !isSidebarOpen && 'md:justify-center')
  const brandContent = (
    <>
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center transition-transform group-hover:scale-[1.03]">
        <Image src="/fleet-manager-mark.svg" alt="" width={44} height={44} priority className="h-11 w-11 rounded-xl shadow-md shadow-blue-900/20" />
      </span>
      {isSidebarOpen && (
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold leading-5 tracking-tight">{user?.organizationName || <LocalizedText>Fleet Manager</LocalizedText>}</span>
          <span className="block truncate text-[11px] font-medium tracking-wide text-sidebar-foreground/55"><LocalizedText>FLEET OPERATIONS</LocalizedText></span>
        </span>
      )}
    </>
  )
  const profileAvatar = (
    <span className="relative block">
      <ProfilePicture size={isSidebarOpen ? 'md' : 'sm'} />
      {isSidebarOpen && <span className="absolute bottom-0 end-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-500" />}
    </span>
  )
  const profileDetails = (
    <>
      <span className="block truncate text-xs font-semibold text-sidebar-foreground">{user?.name || user?.email || t('User')}</span>
      <span className="block truncate text-[11px] text-sidebar-foreground/55">{user?.role ? t(user.role) : t('User')}</span>
    </>
  )

  if (isLoading) {
    return (
      <nav aria-label={t('Main navigation')} className={sidebarClassName}>
        <div className="flex flex-1 items-center justify-center">
          <TruckLoader size="sm" />
        </div>
      </nav>
    )
  }

  return (
    <nav aria-label={t('Main navigation')} className={sidebarClassName}>
      <div className={cn(
        'flex h-[4.75rem] shrink-0 items-center border-b border-sidebar-border/80',
        isSidebarOpen ? 'justify-between px-4' : 'justify-center px-2',
      )}>
        {hasPermission('dashboard', 'read') ? (
        <Link href="/dashboard" onClick={() => window.matchMedia('(max-width: 767px)').matches && closeSidebar()} className={brandClassName} aria-label={t('Fleet Manager home')}>
            {brandContent}
          </Link>
        ) : (
          <div className={brandClassName} aria-label={t('Fleet Manager')}>
            {brandContent}
          </div>
        )}

        {isSidebarOpen && (
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label={t('Collapse sidebar')}
              title={t('Collapse sidebar')}
              className="hidden h-9 w-9 rounded-lg text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground md:inline-flex"
            >
              {isArabic ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        )}
        {!isSidebarOpen && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            aria-label={t('Expand sidebar')}
            title={t('Expand sidebar')}
            className="hidden h-9 w-9 rounded-lg text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground md:inline-flex"
          >
            {isArabic ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 py-4 scrollbar-thin">
        {groups.map((group, groupIndex) => (
          <section key={group.label} className={cn(groupIndex > 0 && 'mt-5')} aria-label={t(group.label)}>
            {isSidebarOpen && (
              <h2 className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-sidebar-foreground/45">
                <LocalizedText>{group.label}</LocalizedText>
              </h2>
            )}
            <div className="space-y-1">
              {group.items.map((item: NavItem) => {
                const isActive = pathname === item.href || (pathname ?? '').startsWith(`${item.href}/`)

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => window.matchMedia('(max-width: 767px)').matches && closeSidebar()}
                    aria-current={isActive ? 'page' : undefined}
                    title={!isSidebarOpen ? item.name : undefined}
                    className={cn(
                      'group relative flex min-h-10 items-center gap-3 overflow-hidden rounded-xl px-3 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                      !isSidebarOpen && 'justify-center px-2',
                      isActive
                        ? 'bg-sky-500/10 text-sidebar-foreground shadow-sm ring-1 ring-sky-500/15 dark:bg-sky-400/10 dark:ring-sky-300/15'
                        : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground',
                    )}
                  >
                    {isActive && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full bg-sky-500" />}
                    <span className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                      item.iconBackground,
                      'group-hover:brightness-95 dark:group-hover:brightness-125',
                    )}>
                      <item.icon className={cn('h-[1.05rem] w-[1.05rem]', item.iconColor)} strokeWidth={isActive ? 2.2 : 1.9} />
                    </span>
                    {isSidebarOpen && <span className="min-w-0 flex-1 truncate">{item.name}</span>}
                    {isSidebarOpen && isActive && <Activity className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="shrink-0 border-t border-sidebar-border/80 p-3">
        {isSidebarOpen ? (
          <div className="rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/50 p-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              {hasPermission('profile', 'read') && <>
                <Link href="/profile" onClick={() => window.matchMedia('(max-width: 767px)').matches && closeSidebar()} className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" aria-label={t('Open profile')}>
                  {profileAvatar}
                </Link>
                <Link href="/profile" onClick={() => window.matchMedia('(max-width: 767px)').matches && closeSidebar()} className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                  {profileDetails}
                </Link>
              </>}
              <Button type="button" variant="ghost" size="icon" onClick={logout} aria-label={t('nav.logout')} title={t('nav.logout')} className="h-8 w-8 shrink-0 rounded-lg text-sidebar-foreground/50 hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {hasPermission('profile', 'read') && <Link href="/profile" onClick={() => window.matchMedia('(max-width: 767px)').matches && closeSidebar()} title={user?.name || t('nav.profile')} aria-label={t('Open profile')} className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"><ProfilePicture size="sm" /></Link>}
            <Button type="button" variant="ghost" size="icon" onClick={logout} title={t('nav.logout')} aria-label={t('nav.logout')} className="h-9 w-9 rounded-lg text-sidebar-foreground/55 hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </nav>
  )
}
