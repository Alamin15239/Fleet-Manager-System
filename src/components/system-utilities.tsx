'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Database, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  Clock,
  HardDrive,
  FileText,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'

export default function SystemUtilities() {
  const [backupProgress, setBackupProgress] = useState(0)
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)

  const handleBackup = async () => {
    setIsBackingUp(true)
    setBackupProgress(0)
    
    try {
      // Simulate backup progress
      const interval = setInterval(() => {
        setBackupProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval)
            return 100
          }
          return prev + 10
        })
      }, 200)

      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `fleet-backup-${new Date().toISOString().split('T')[0]}.sql`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        
        toast.success('Database backup completed and downloaded')
      } else {
        toast.error('Backup failed')
      }
    } catch (error) {
      toast.error('Backup failed')
    } finally {
      setIsBackingUp(false)
      setBackupProgress(0)
    }
  }

  const handleCleanup = async () => {
    setIsCleaning(true)
    
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(`Cleanup completed: ${data.message || 'System cleaned'}`)
      } else {
        toast.error('Cleanup failed')
      }
    } catch (error) {
      toast.error('Cleanup failed')
    } finally {
      setIsCleaning(false)
    }
  }

  const handleExportSettings = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/settings/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `fleet-settings-${new Date().toISOString().split('T')[0]}.json`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        
        toast.success('Settings exported successfully')
      } else {
        toast.error('Export failed')
      }
    } catch (error) {
      toast.error('Export failed')
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
              <h4 className="font-semibold text-sm">Backup Database</h4>
              <p className="text-sm text-muted-foreground">
                Create a complete backup of your fleet management data
              </p>
              {isBackingUp && (
                <div className="space-y-2">
                  <Progress value={backupProgress} className="w-full" />
                  <p className="text-xs text-muted-foreground">
                    Backing up... {backupProgress}%
                  </p>
                </div>
              )}
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
              <h4 className="font-semibold text-sm">Restore Database</h4>
              <p className="text-sm text-muted-foreground">
                Restore your database from a backup file
              </p>
              <div className="space-y-2">
                <input
                  type="file"
                  accept=".sql,.json"
                  className="hidden"
                  id="restore-file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return

                    setIsRestoring(true)
                    try {
                      const formData = new FormData()
                      formData.append('backup', file)
                      
                      const token = localStorage.getItem('authToken')
                      const response = await fetch('/api/admin/restore', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                      })

                      if (response.ok) {
                        toast.success('Database restored successfully')
                      } else {
                        toast.error('Restore failed')
                      }
                    } catch (error) {
                      toast.error('Restore failed')
                    } finally {
                      setIsRestoring(false)
                    }
                  }}
                />
                <Button 
                  variant="outline"
                  onClick={() => document.getElementById('restore-file')?.click()}
                  disabled={isRestoring}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isRestoring ? 'Restoring...' : 'Upload & Restore'}
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
              <h4 className="font-semibold text-sm">Clean System</h4>
              <p className="text-sm text-muted-foreground">
                Remove temporary files and optimize database
              </p>
              <Button 
                variant="outline"
                onClick={handleCleanup}
                disabled={isCleaning}
                className="w-full"
              >
                <HardDrive className="h-4 w-4 mr-2" />
                {isCleaning ? 'Cleaning...' : 'Clean System'}
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Export Settings</h4>
              <p className="text-sm text-muted-foreground">
                Download current system configuration
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
              <h4 className="font-semibold text-sm">System Check</h4>
              <p className="text-sm text-muted-foreground">
                Run comprehensive system diagnostics
              </p>
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken')
                    const response = await fetch('/api/admin/health-check', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    })
                    
                    if (response.ok) {
                      const data = await response.json()
                      toast.success(`System check completed: ${data.status}`)
                    } else {
                      toast.error('System check failed')
                    }
                  } catch (error) {
                    toast.error('System check failed')
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
              <h4 className="font-semibold text-sm">Security Scan</h4>
              <p className="text-sm text-muted-foreground">
                Check for security vulnerabilities and issues
              </p>
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken')
                    const response = await fetch('/api/admin/security-scan', {
                      method: 'POST',
                      headers: { 'Authorization': `Bearer ${token}` }
                    })
                    
                    if (response.ok) {
                      const data = await response.json()
                      toast.success(`Security scan completed: ${data.issues || 0} issues found`)
                    } else {
                      toast.error('Security scan failed')
                    }
                  } catch (error) {
                    toast.error('Security scan failed')
                  }
                }}
                className="w-full"
              >
                <Shield className="h-4 w-4 mr-2" />
                Run Security Scan
              </Button>
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Export Logs</h4>
              <p className="text-sm text-muted-foreground">
                Download system logs for analysis
              </p>
              <Button 
                variant="outline"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken')
                    const response = await fetch('/api/admin/export-logs', {
                      headers: { 'Authorization': `Bearer ${token}` }
                    })
                    
                    if (response.ok) {
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `system-logs-${new Date().toISOString().split('T')[0]}.txt`
                      document.body.appendChild(a)
                      a.click()
                      document.body.removeChild(a)
                      window.URL.revokeObjectURL(url)
                      
                      toast.success('Logs exported successfully')
                    } else {
                      toast.error('Log export failed')
                    }
                  } catch (error) {
                    toast.error('Log export failed')
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
            <p>• Database restoration will overwrite all current data</p>
            <p>• System utilities should only be used by administrators</p>
            <p>• Contact support if you encounter any issues</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}