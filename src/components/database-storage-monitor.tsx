'use client'

import { LocalizedText } from '@/components/localized-text'
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Database, HardDrive, RefreshCw, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiGet } from '@/lib/api'

interface OrganizationStorage {
  id: string
  name: string
  slug: string
  status: string
  provider: string
  providerDatabaseId: string | null
  databaseName: string | null
  usedBytes: number | null
  usedFormatted: string | null
  storageStatus: string
}

interface StorageData {
  organization: {
    id: string
    name: string
    slug: string
    isPrimary: boolean
    provider: string
    providerDatabaseId: string | null
    databaseName: string | null
  }
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
    actual: { databaseName: string; bytes: number; formatted: string } | null
    actualStatus: 'available' | 'unavailable'
    quota: number | null
    remainingBytes: number | null
    remainingStatus: string
  }
  organizations?: OrganizationStorage[]
  timestamp: string
}

function formatBytes(bytes: number | null) {
  if (bytes === null || !Number.isFinite(bytes)) return 'Unavailable'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, index)).toFixed(2)} ${units[index]}`
}

export function DatabaseStorageMonitor() {
  const [storageData, setStorageData] = useState<StorageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)

  const fetchStorageData = async () => {
    setLoadFailed(false)
    try {
      const response = await apiGet('/api/database/storage')
      const result = await response.json().catch(() => ({}))
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Could not load storage data')
      }
      setStorageData(result.data)
    } catch (error) {
      console.error('Error fetching storage data:', error)
      setLoadFailed(true)
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
    void fetchStorageData()
  }, [])

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center py-6"><RefreshCw className="h-6 w-6 animate-spin" /></CardContent></Card>
  }

  if (!storageData) {
    return <Card><CardContent className="flex items-center justify-center py-6"><p className="text-muted-foreground"><LocalizedText>{loadFailed ? 'Failed to load storage data' : 'Storage data is unavailable'}</LocalizedText></p><Button variant="outline" size="sm" className="ml-3" onClick={() => { setLoading(true); void fetchStorageData() }}><LocalizedText>Retry</LocalizedText></Button></CardContent></Card>
  }

  const providerName = (provider: string) => {
    switch (provider.toUpperCase()) {
      case 'NEON': return 'Neon PostgreSQL'
      case 'PRISMA': return 'Prisma Postgres'
      default: return 'PostgreSQL'
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium"><Database className="h-4 w-4" /><LocalizedText>Database Storage</LocalizedText></CardTitle>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{storageData.organization.name}</div>
              <div className="text-xs text-muted-foreground">{providerName(storageData.organization.provider)}</div>
              {storageData.organization.databaseName && <div className="text-xs text-muted-foreground">Database: {storageData.organization.databaseName}</div>}
              {storageData.organization.providerDatabaseId && <div className="text-xs text-muted-foreground break-all">Provider ID: {storageData.organization.providerDatabaseId}</div>}
            </div>
            <Badge variant={storageData.storage.actualStatus === 'available' ? 'secondary' : 'outline'}>
              {storageData.storage.actualStatus === 'available' ? 'Live size' : 'Unavailable'}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><HardDrive className="h-4 w-4" /><LocalizedText>Actual database used</LocalizedText></div>
              <div className="mt-1 text-xl font-semibold">{storageData.storage.actual?.formatted || 'Unavailable'}</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="text-sm text-muted-foreground"><LocalizedText>Remaining database quota</LocalizedText></div>
              <div className="mt-1 text-xl font-semibold">{storageData.storage.remainingBytes !== null ? formatBytes(storageData.storage.remainingBytes) : 'Not reported'}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {storageData.storage.remainingBytes !== null
                  ? 'Calculated from the configured database quota.'
                  : 'This provider does not expose a fixed per-database quota here. No remaining amount is guessed.'}
              </div>
            </div>
          </div>
        </div>

        {storageData.organizations && storageData.organization.isPrimary && (
          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2 font-medium"><Building2 className="h-4 w-4" /><LocalizedText>Storage by organization</LocalizedText></div>
            <p className="text-xs text-muted-foreground">Live database size and provider mapping for every organization in the registry. New organizations appear automatically after provisioning.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2 pr-3"><LocalizedText>Organization</LocalizedText></th><th className="py-2 pr-3"><LocalizedText>Database provider</LocalizedText></th><th className="py-2 pr-3"><LocalizedText>Database ID</LocalizedText></th><th className="py-2 text-right"><LocalizedText>Used</LocalizedText></th></tr></thead>
                <tbody>
                  {storageData.organizations.map((org) => (
                    <tr key={org.id} className="border-b last:border-0 align-top">
                      <td className="py-2 pr-3"><div className="font-medium">{org.name}</div><div className="text-xs text-muted-foreground">{org.slug} · {org.status}</div></td>
                      <td className="py-2 pr-3 whitespace-nowrap">{providerName(org.provider)}</td>
                      <td className="py-2 pr-3 text-xs break-all">{org.providerDatabaseId || (org.status === 'ACTIVE' ? 'Primary connection' : 'Not provisioned')}</td>
                      <td className="py-2 text-right whitespace-nowrap">{org.storageStatus === 'available' ? org.usedFormatted : 'Unavailable'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="space-y-2 border-t pt-3">
          <div className="text-sm font-medium"><LocalizedText>Records Count</LocalizedText></div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {([
              ['Users', storageData.tableCounts.users],
              ['Trucks', storageData.tableCounts.trucks],
              ['Trailers', storageData.tableCounts.trailers],
              ['Maintenance', storageData.tableCounts.maintenance],
              ['Tires', storageData.tableCounts.tires],
              ['Mechanics', storageData.tableCounts.mechanics],
              ['Documents', storageData.tableCounts.documents]
            ] as [string, number][]).map(([label, value]) => <div key={label} className="flex justify-between gap-2"><span><LocalizedText>{label}</LocalizedText>:</span><span className="font-mono">{value}</span></div>)}
          </div>
          <div className="flex justify-between border-t pt-2 font-medium"><span><LocalizedText>Total Records</LocalizedText>:</span><span className="font-mono">{storageData.tableCounts.total}</span></div>
        </div>
        <div className="text-xs text-muted-foreground"><LocalizedText>Last updated</LocalizedText>: {new Date(storageData.timestamp).toLocaleTimeString()}</div>
      </CardContent>
    </Card>
  )
}
