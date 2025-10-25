'use client'

import { UserActivityMonitor } from '@/components/user-activity-monitor'
import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function UserActivitiesPage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/dashboard')
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  if (!user || user.role !== 'ADMIN') {
    return null
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">User Activity Monitor</h1>
        <p className="text-muted-foreground">Monitor all user activities, logins, and system interactions with location and device tracking</p>
      </div>
      
      <UserActivityMonitor className="mt-6" />
    </div>
  )
}