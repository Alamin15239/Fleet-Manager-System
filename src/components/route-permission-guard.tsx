'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { usePermissions } from '@/contexts/permissions-context'
import { useLanguage } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LocalizedText } from '@/components/localized-text'
import { TruckLoader } from '@/components/ui/truck-loader'

type RouteAccess = { path: string; resource: string; action?: string }

// Keep this map aligned with the resources exposed in Settings → Roles.
// More specific routes must precede their parent routes.
const managedRoutes: RouteAccess[] = [
  { path: '/settings/permissions', resource: 'admin' },
  { path: '/organizations', resource: 'admin' },
  { path: '/admin', resource: 'admin' },
  { path: '/advanced-analytics', resource: 'advanced-analytics' },
  { path: '/purchase-invoices', resource: 'purchase-invoices' },
  { path: '/tire-management', resource: 'tire-management' },
  { path: '/excel-imports', resource: 'excel-imports' },
  { path: '/job-cards', resource: 'maintenance' },
  { path: '/oil-changes', resource: 'maintenance' },
  { path: '/maintenance', resource: 'maintenance' },
  { path: '/mechanics', resource: 'mechanics' },
  { path: '/trailers', resource: 'trailers' },
  { path: '/trucks', resource: 'trucks' },
  { path: '/reports', resource: 'reports' },
  { path: '/users', resource: 'users' },
  { path: '/profile', resource: 'profile' },
  { path: '/settings', resource: 'settings' },
  { path: '/dashboard', resource: 'dashboard' },
  { path: '/', resource: 'dashboard' },
]

const availablePages: RouteAccess[] = [
  { path: '/', resource: 'dashboard' },
  { path: '/trucks', resource: 'trucks' },
  { path: '/trailers', resource: 'trailers' },
  { path: '/tire-management', resource: 'tire-management' },
  { path: '/job-cards', resource: 'maintenance' },
  { path: '/purchase-invoices', resource: 'purchase-invoices' },
  { path: '/mechanics', resource: 'mechanics' },
  { path: '/reports', resource: 'reports' },
  { path: '/advanced-analytics', resource: 'advanced-analytics' },
  { path: '/users', resource: 'users' },
  { path: '/profile', resource: 'profile' },
  { path: '/settings', resource: 'settings' },
]

function getRouteAccess(pathname: string | null) {
  if (!pathname) return null
  return managedRoutes.find(({ path }) => path === '/'
    ? pathname === '/'
    : pathname === path || pathname.startsWith(`${path}/`)) || null
}

export function RoutePermissionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { hasPermission, loading, permissionManager, refreshPermissions } = usePermissions()
  const { t } = useLanguage()
  const access = getRouteAccess(pathname)

  if (!access) return <>{children}</>

  if (loading) {
    return <div className="flex min-h-[55vh] items-center justify-center"><TruckLoader size="md" /></div>
  }

  if (!permissionManager) {
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center px-4">
        <Card className="w-full border-amber-500/20 shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-7 text-center">
            <ShieldAlert className="h-9 w-9 text-amber-600" />
            <h1 className="text-lg font-semibold"><LocalizedText>Access permissions could not be loaded</LocalizedText></h1>
            <p className="text-sm text-muted-foreground"><LocalizedText>Refresh your permissions and try again.</LocalizedText></p>
            <Button variant="outline" onClick={() => void refreshPermissions()}>{t('Refresh permissions')}</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!hasPermission(access.resource, access.action || 'read')) {
    const destination = availablePages.find(page => hasPermission(page.resource, page.action || 'read'))
    return (
      <div className="mx-auto flex min-h-[55vh] w-full max-w-xl items-center px-4">
        <Card className="w-full shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-7 text-center">
            <ShieldCheck className="h-9 w-9 text-muted-foreground" />
            <h1 className="text-lg font-semibold"><LocalizedText>Access denied</LocalizedText></h1>
            <p className="text-sm text-muted-foreground"><LocalizedText>Your role does not have access to this section.</LocalizedText></p>
            {destination && <Button asChild variant="outline"><Link href={destination.path}><LocalizedText>Open an available section</LocalizedText></Link></Button>}
          </CardContent>
        </Card>
      </div>
    )
  }

  return <>{children}</>
}
