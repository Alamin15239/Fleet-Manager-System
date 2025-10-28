'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Download, Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function TireExcelIntegration() {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleExport = async () => {
    setExporting(true)
    setError(null)
    
    try {
      const response = await fetch('/api/tires/excel', {
        method: 'GET',
        credentials: 'include'
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tires-${new Date().toISOString().split('T')[0]}.xlsx`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success('Excel file exported successfully')
        setSuccess('Excel file downloaded successfully')
      } else {
        throw new Error('Failed to export')
      }
    } catch (error) {
      const errorMsg = 'Failed to export tires to Excel'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setExporting(false)
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImporting(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/tires/excel', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setSuccess(data.message)
        
        // Refresh the page to show new data
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to import')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to import tires from Excel'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setImporting(false)
      // Reset file input
      event.target.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Excel Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium">Excel File Access</h3>
            <p className="text-sm text-muted-foreground">
              Download current Excel file (auto-updated)
            </p>
            <div className="space-y-2">
              <Button 
                onClick={async () => {
                  try {
                    const response = await fetch('/api/tires/excel-file')
                    if (response.ok) {
                      const blob = await response.blob()
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = 'tires-current.xlsx'
                      document.body.appendChild(a)
                      a.click()
                      window.URL.revokeObjectURL(url)
                      document.body.removeChild(a)
                      toast.success('Excel file downloaded')
                    } else {
                      toast.error('Excel file not available')
                    }
                  } catch (error) {
                    toast.error('Failed to download Excel file')
                  }
                }}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Get Current Excel
              </Button>
              <Button 
                onClick={handleExport}
                disabled={exporting}
                variant="outline"
                className="w-full"
              >
                {exporting ? (
                  <>
                    <Download className="mr-2 h-4 w-4 animate-pulse" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Fresh Export
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Import from Excel</h3>
            <p className="text-sm text-muted-foreground">
              Upload Excel file to add tires
            </p>
            <div className="relative">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                disabled={importing}
                className="cursor-pointer"
              />
              {importing && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                  <Upload className="h-4 w-4 animate-pulse" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-medium text-blue-900 mb-2">Excel Format Requirements:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Tire Size (required)</li>
            <li>• Manufacturer (required)</li>
            <li>• Origin (SAUDI, CHINESE, etc.)</li>
            <li>• Plate Number (optional)</li>
            <li>• Trailer Number (optional)</li>
            <li>• Driver Name (optional)</li>
            <li>• Quantity (number)</li>
            <li>• Serial Number (optional)</li>
            <li>• Notes (optional)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}