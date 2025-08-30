'use client'

import { ReactNode } from 'react'
import { Navigation } from './navigation'
import { Header } from './header'
import { useAuth } from '@/contexts/auth-context'
import { useSidebar } from '@/contexts/sidebar-context'
import { ThemeToggle } from './theme-toggle'
import { PageTransition } from './ui/page-transition'


interface LayoutProps {
  children: ReactNode
  userRole?: string
  isAuthenticated?: boolean
}

export function Layout({ children, userRole = 'MECHANIC', isAuthenticated: forceAuthenticated = false }: LayoutProps) {
  const { user, isAuthenticated, logout } = useAuth()
  const { isSidebarOpen } = useSidebar()

  // If forceAuthenticated is true, bypass authentication check
  const effectiveIsAuthenticated = forceAuthenticated || isAuthenticated
  
  // If user is authenticated, use their role, otherwise use the default
  const effectiveUserRole = user?.role || userRole

  // Only show navigation and header if user is authenticated
  if (!effectiveIsAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        <main className="flex-1">
          {children}
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <Navigation userRole={effectiveUserRole} />
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${isSidebarOpen ? 'ml-0' : 'ml-0'}`}>
        <Header />
        <main className="flex-1 overflow-auto bg-background">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  )
}