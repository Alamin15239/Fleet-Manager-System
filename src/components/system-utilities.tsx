'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Database,
  Download,
  Upload,
  Shield,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  FileText,
  Settings
} from 'lucide-react'
import { toast } from '@/lib/localized-toast'

export default function SystemUtilities() {
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)

  const getErrorMessage = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => ({}))
    return data.error || `${fallback} (${response.status})`
  }

  const downloadResponse = (response: Response, blob: Blob, fallbackName: string) => {
    const fileName = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1] || fallbackName
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const handleBackup = async () => {
    setIsBackingUp(true)
    try {
      const token = localStorage.getItem('authToken')
      if (!token) throw new Error('Authentication required')
      const response = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error(await getErrorMessage(response, 'Backup failed'))
      downloadResponse(response, await response.blob(), `fleet-database-backup-${new Date().toISOString().slice(0, 10)}.json`)
      toast.success('Database backup completed and downloaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Backup failed')
    } finally {
      setIsBackingUp(false)
    }
  }

  const handleCleanup = async () => {
    setIsCleaning(true)
    
    try {
      const token = localStorage.getItem('authToken')
      if (!token) throw new Error('Authentication required')
      const response = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error(await getErrorMessage(response, 'Cleanup failed'))
      const data = await response.json()
      toast.success(data.message || 'Database statistics refreshed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Cleanup failed')
    } finally {
      setIsCleaning(false)
    }
  }

  const handleExportSettings = async () => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) throw new Error('Authentication required')
      const response = await fetch('/api/settings/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) throw new Error(await getErrorMessage(response, 'Export failed'))
      downloadResponse(response, await response.blob(), `fleet-settings-${new Date().toISOString().slice(0, 10)}.json`)
      toast.success('Settings exported successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed')
    }
  }

  return (
    <div className="space-y-6">
      {/* Backup & Restore */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>Backup Database</LocalizedText></h4>
              <p className="text-sm text-muted-foreground">
                <LocalizedText>Create a complete backup of your fleet management data</LocalizedText>
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300"><LocalizedText>This backup contains private account and fleet data. Store it securely.</LocalizedText></p>
              {isBackingUp && <p className="text-xs text-muted-foreground"><LocalizedText>Preparing a database snapshot...</LocalizedText></p>}
              <Button 
                onClick={handleBackup}
                disabled={isBackingUp}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {isBackingUp ? 'Creating Backup...' : 'Download Backup'}
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>Restore Database</LocalizedText></h4>
              <p className="text-sm text-muted-foreground">
                <LocalizedText>This JSON export cannot be imported as a database snapshot. Use Neon point-in-time recovery to restore production.</LocalizedText>
              </p>
              <div className="space-y-2">
                <Button variant="outline" disabled className="w-full">
                  <Upload className="h-4 w-4 mr-2" />
                  <LocalizedText>Neon point-in-time recovery</LocalizedText>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Maintenance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Maintenance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>Clean System</LocalizedText></h4>
              <p className="text-sm text-muted-foreground">
                <LocalizedText>Refresh PostgreSQL query-planning statistics without deleting fleet data.</LocalizedText>
              </p>
              <Button 
                variant="outline"
                onClick={handleCleanup}
                disabled={isCleaning}
                className="w-full"
              >
                <HardDrive className="h-4 w-4 mr-2" />
                {isCleaning ? 'Optimizing...' : 'Optimize Database'}
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>Export Settings</LocalizedText></h4>
              <p className="text-sm text-muted-foreground">
                <LocalizedText>Download current system configuration</LocalizedText>
              </p>
              <Button 
                variant="outline"
                onClick={handleExportSettings}
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export Config
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>System Check</LocalizedText></h4>
              <p className="text-sm text-muted-foreground">
                <LocalizedText>Run comprehensive system diagnostics</LocalizedText>
              </p>
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken')
                    if (!token) throw new Error('Authentication required')
                    const response = await fetch('/api/admin/health-check', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    })
                    if (!response.ok) throw new Error(await getErrorMessage(response, 'System check failed'))
                    const data = await response.json()
                    toast.success(`System check completed: ${data.status}`)
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'System check failed')
                  }
                }}
                className="w-full"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Run Check
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security & Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security & Monitoring
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>Security Posture Review</LocalizedText></h4>
              <p className="text-sm text-muted-foreground">
                <LocalizedText>Review approval status, email verification, JWT configuration, and individual permission overrides.</LocalizedText>
              </p>
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken')
                    if (!token) throw new Error('Authentication required')
                    const response = await fetch('/api/admin/security-scan', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    })
                    if (!response.ok) throw new Error(await getErrorMessage(response, 'Security scan failed'))
                    const data = await response.json()
                    toast.success(`Security review completed: ${data.issues || 0} findings`)
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Security scan failed')
                  }
                }}
                className="w-full"
              >
                <Shield className="h-4 w-4 mr-2" />
                <LocalizedText>Review Access</LocalizedText>
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm"><LocalizedText>Export Logs</LocalizedText></h4>
              <p className="text-sm text-muted-foreground">
                <LocalizedText>Download system logs for analysis</LocalizedText>
              </p>
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken')
                    if (!token) throw new Error('Authentication required')
                    const response = await fetch('/api/admin/export-logs', {
                      headers: { 'Authorization': `Bearer ${token}` }
                    })
                    if (!response.ok) throw new Error(await getErrorMessage(response, 'Log export failed'))
                    downloadResponse(response, await response.blob(), `fleet-system-logs-${new Date().toISOString().slice(0, 10)}.json`)
                    toast.success('Logs exported successfully')
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Log export failed')
                  }
                }}
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                Export Logs
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warning Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-5 w-5" />
            Important Notice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-amber-700">
            <p>• Always create a backup before performing system maintenance</p>
            <p>• Database restoration must be performed through Neon recovery tools</p>
            <p>• System utilities should only be used by administrators</p>
            <p>• Contact support if you encounter any issues</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
