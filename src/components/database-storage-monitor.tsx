'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database, HardDrive, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiGet } from '@/lib/api'
import { useLanguage } from '@/contexts/language-context'

interface StorageData {
  tableCounts: {
    users: number
    trucks: number
    trailers: number
    maintenance: number
    tires: number
    mechanics: number
    notifications: number
    auditLogs: number
    documents: number
    total: number
  }
  storage: {
    estimated: {
      totalKB: number
      totalMB: number
      breakdown: Record<string, number>
    }
    actual: {
      formatted: string
      bytes: number
    } | null
    available: {
      totalGB: number
      usedGB: number
      availableGB: number
      availableKB: number
      usagePercent: number
    } | null
  }
  timestamp: string
}

export function DatabaseStorageMonitor() {
  const { t } = useLanguage()
  const [storageData, setStorageData] = useState<StorageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStorageData = async () => {
    try {
      const response = await apiGet('/api/database/storage')
      if (response.ok) {
        const result = await response.json()
        setStorageData(result.data)
      }
    } catch (error) {
      console.error('Error fetching storage data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchStorageData()
  }

  useEffect(() => {
    fetchStorageData()
    const interval = setInterval(fetchStorageData, 30000) // Update every 30 seconds
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!storageData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <p className="text-muted-foreground"><LocalizedText>Failed to load storage data</LocalizedText></p>
        </CardContent>
      </Card>
    )
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Database className="h-4 w-4" />
          Database Storage
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium"><LocalizedText>Used:</LocalizedText></span>
            </div>
            <Badge variant="secondary">
              {storageData.storage.actual 
                ? storageData.storage.actual.formatted 
                : `~${storageData.storage.estimated.totalMB.toFixed(2)} MB`
              }
            </Badge>
          </div>
          
          {storageData.storage.available && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium"><LocalizedText>Available:</LocalizedText></span>
                <Badge variant="outline">
                  {storageData.storage.available.availableGB?.toFixed(2) || '0'} GB
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium"><LocalizedText>Available (KB):</LocalizedText></span>
                <Badge variant="outline">
                  {storageData.storage.available.availableKB?.toLocaleString() || '0'} KB
                </Badge>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${storageData.storage.available.usagePercent || 0}%` }}
                ></div>
              </div>
              <div className="text-xs text-center text-muted-foreground">
                {storageData.storage.available.usagePercent || 0}% used of {storageData.storage.available.totalGB || 0} GB
              </div>
            </>
          )}
        </div>

        <div className="space-y-2 border-t pt-2">
          <div className="text-sm font-medium"><LocalizedText>Records Count:</LocalizedText></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span><LocalizedText>Users:</LocalizedText></span>
              <span className="font-mono">{storageData.tableCounts.users}</span>
            </div>
            <div className="flex justify-between">
              <span><LocalizedText>Trucks:</LocalizedText></span>
              <span className="font-mono">{storageData.tableCounts.trucks}</span>
            </div>
            <div className="flex justify-between">
              <span><LocalizedText>Trailers:</LocalizedText></span>
              <span className="font-mono">{storageData.tableCounts.trailers}</span>
            </div>
            <div className="flex justify-between">
              <span><LocalizedText>Maintenance:</LocalizedText></span>
              <span className="font-mono">{storageData.tableCounts.maintenance}</span>
            </div>
            <div className="flex justify-between">
              <span><LocalizedText>Tires:</LocalizedText></span>
              <span className="font-mono">{storageData.tableCounts.tires}</span>
            </div>
            <div className="flex justify-between">
              <span><LocalizedText>Mechanics:</LocalizedText></span>
              <span className="font-mono">{storageData.tableCounts.mechanics}</span>
            </div>
            <div className="flex justify-between">
              <span><LocalizedText>Documents:</LocalizedText></span>
              <span className="font-mono">{storageData.tableCounts.documents}</span>
            </div>
          </div>
          <div className="border-t pt-2 flex justify-between font-medium">
            <span><LocalizedText>Total Records:</LocalizedText></span>
            <span className="font-mono">{storageData.tableCounts.total}</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Last updated: {new Date(storageData.timestamp).toLocaleTimeString()}
        </div>
      </CardContent>
    </Card>
  )
}