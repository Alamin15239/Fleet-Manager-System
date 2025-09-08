'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Truck, Activity, Database, BarChart3 } from 'lucide-react'

interface EnhancedLoadingProps {
  message?: string
  showIcons?: boolean
}

export function EnhancedLoading({ 
  message = "Loading dashboard data...", 
  showIcons = true 
}: EnhancedLoadingProps) {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        {showIcons && (
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="animate-bounce">
              <Truck className="h-8 w-8 text-blue-600" />
            </div>
            <div className="animate-bounce" style={{ animationDelay: '0.1s' }}>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
            <div className="animate-bounce" style={{ animationDelay: '0.2s' }}>
              <Database className="h-8 w-8 text-purple-600" />
            </div>
            <div className="animate-bounce" style={{ animationDelay: '0.3s' }}>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        )}
        
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        
        <h3 className="text-lg font-semibold mb-2">Fleet Manager</h3>
        <p className="text-muted-foreground">{message}</p>
        
        <div className="mt-6 flex justify-center">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}