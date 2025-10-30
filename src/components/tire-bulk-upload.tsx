'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function TireBulkUpload() {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/tires/bulk-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        toast.success(data.message)
        setSuccess(data.message)
        
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to upload file'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Bulk Upload Tires
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

        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Upload Excel File</h3>
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleUpload}
              disabled={uploading}
              className="cursor-pointer"
            />
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">Supported Formats:</h4>
            <div className="text-sm text-blue-800 space-y-2">
              <div className="font-mono text-xs bg-white p-2 rounded border">
                Date,Truck #,Name Driver,Serial Number,OUT QTY<br/>
                2024-01-01,ABC123,John Doe,SN001,4<br/>
                2024-01-02,XYZ789,Jane Smith,SN002,6
              </div>
              <div className="mt-2 text-xs">
                • <strong>CSV files:</strong> Direct upload<br/>
                • <strong>Excel files:</strong> Will be parsed automatically<br/>
                • Column order: Date, Truck #, Driver Name, Serial, Quantity<br/>
                • Truck # becomes the plate number
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}