'use client'

import { ReactNode } from 'react'
import { Navigation } from './navigation'
import { Header } from './header'
import { useAuth } from '@/contexts/auth-context'
import { useSidebar } from '@/contexts/sidebar-context'
import { PageTransition } from './ui/page-transition'
import { useLanguage } from '@/contexts/language-context'
import { RoutePermissionGuard } from './route-permission-guard'


interface LayoutProps {
  children: ReactNode
  isAuthenticated?: boolean
}

export function Layout({ children, isAuthenticated: forceAuthenticated = false }: LayoutProps) {
  const { isAuthenticated } = useAuth()
  const { isSidebarOpen, closeSidebar } = useSidebar()
  const { t } = useLanguage()

  // If forceAuthenticated is true, bypass authentication check
  const effectiveIsAuthenticated = forceAuthenticated || isAuthenticated
  
  // Only show navigation and header if user is authenticated
  if (!effectiveIsAuthenticated) {
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
