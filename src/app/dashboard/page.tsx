'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Database } from 'lucide-react'
import { DatabaseStorageMonitor } from '@/components/database-storage-monitor'

export default function DashboardPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Fleet management overview</p>
      </div>

      {/* Database Storage Monitor */}
      <DatabaseStorageMonitor />
      
      {/* Test Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Storage Test
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-bold">Storage Monitor is Working!</div>
          <div className="text-sm text-muted-foreground">You can see the database storage information above</div>
        </CardContent>
      </Card>
    </div>
  )
}