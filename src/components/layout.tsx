'use client'

import { ReactNode, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Navigation } from './navigation'
import { Header } from './header'
import { useAuth } from '@/contexts/auth-context'
import { useSidebar } from '@/contexts/sidebar-context'
import { PageTransition } from './ui/page-transition'
import { useLanguage } from '@/contexts/language-context'
import { RoutePermissionGuard } from './route-permission-guard'
import { TruckLoader } from '@/components/ui/truck-loader'


interface LayoutProps {
  children: ReactNode
}

const publicRoutes = new Set([
  '/',
  '/login',
  '/signup',
  '/pricing',
  '/purchase',
  '/purchase/complete',
  '/register',
  '/verify-email',
  '/verify-otp',
  '/forgot-password',
  '/reset-password',
  '/privacy',
  '/agreement',
  '/help',
])

function isPublicRoute(pathname: string | null) {
  return !!pathname && (publicRoutes.has(pathname) || pathname.startsWith('/share/'))
}

function loginUrl() {
  if (typeof window === 'undefined') return '/login'
  const organizationSlug = new URLSearchParams(window.location.search).get('org')
  return organizationSlug ? `/login?org=${encodeURIComponent(organizationSlug)}` : '/login'
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const { isSidebarOpen, closeSidebar } = useSidebar()
  const { t } = useLanguage()
  const isPublic = isPublicRoute(pathname)

  useEffect(() => {
    if (!isPublic && !isLoading && !isAuthenticated) {
      router.replace(loginUrl())
    }
  }, [isAuthenticated, isLoading, isPublic, router])

  // Back/forward cache can restore a previously rendered page without a new
  // React mount. Recheck the local session before allowing a protected screen
  // restored that way to remain visible.
  useEffect(() => {
    const handlePageShow = () => {
      if (!isPublicRoute(window.location.pathname) && !localStorage.getItem('authToken')) {
        window.location.replace(loginUrl())
      }
    }
    window.addEventListener('pageshow', handlePageShow)
    return () => window.removeEventListener('pageshow', handlePageShow)
  }, [])

  useEffect(() => {
    const preventBrowserFileOpen = (event: DragEvent) => {
      const transfer = event.dataTransfer
      const containsFiles = !!transfer && (
        Array.from(transfer.types).includes('Files') ||
        Array.from(transfer.items).some(item => item.kind === 'file')
      )
      if (containsFiles) event.preventDefault()
    }

    window.addEventListener('dragover', preventBrowserFileOpen, true)
    window.addEventListener('drop', preventBrowserFileOpen, true)
    return () => {
      window.removeEventListener('dragover', preventBrowserFileOpen, true)
      window.removeEventListener('drop', preventBrowserFileOpen, true)
    }
  }, [])

  // Never render a private page while the saved session is being checked, or
  // after it has been cleared. This also prevents browser Back from exposing
  // stale client-side page content after logout.
  if (!isPublic && (isLoading || !isAuthenticated)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background" role="status" aria-label={t('Checking your session')}>
        <TruckLoader size="lg" className="mx-auto" />
      </div>
    )
  }

  // Public pages (marketing, sign-in, legal, help, and shared records) do not
  // use the authenticated application shell.
  if (isPublic && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-transparent">
        <main className="flex-1">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh bg-transparent">
      <Navigation />
      {isSidebarOpen && (
        <button
          type="button"
          aria-label={t('Close navigation menu')}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeSidebar}
        />
      )}
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="min-h-0 min-w-0 flex-1 overflow-auto bg-transparent">
          <PageTransition>
            <RoutePermissionGuard>{children}</RoutePermissionGuard>
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
