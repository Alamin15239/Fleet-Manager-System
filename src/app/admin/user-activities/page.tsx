'use client'

import { UserActivityMonitor } from '@/components/user-activity-monitor'
import { PageHeader } from '@/components/page-header'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function UserActivitiesPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== 'ADMIN')) {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user || user.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="container mx-auto p-6">
      <PageHeader
        title="User Activity Monitor"
        description="Monitor all user activities, logins, and system interactions with location and device tracking"
      />
      
      <UserActivityMonitor className="mt-6" />
    </div>
  )
}