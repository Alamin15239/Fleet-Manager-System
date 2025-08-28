'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Eye, 
  Download, 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Image as ImageIcon,
  File,
  FileSpreadsheet
} from 'lucide-react'

interface FilePreviewProps {
  file: {
    id: string
    name: string
    originalName: string
    size: number
    type: string
    url: string
    uploadedAt: string
    uploadedBy: string
  }
  trigger?: React.ReactNode
  showTrigger?: boolean
}

export function FilePreview({ file, trigger, showTrigger = true }: FilePreviewProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)

  const isImage = file.type.startsWith('image/')
  const isPDF = file.type === 'application/pdf'
  const isWord = file.type.includes('word') || file.type.includes('document')
  const isExcel = file.type.includes('excel') || file.type.includes('spreadsheet')

  const getFileIcon = () => {
    if (isImage) return <ImageIcon className="h-8 w-8 text-blue-500" />
    if (isPDF) return <FileText className="h-8 w-8 text-red-500" />
    if (isWord) return <File className="h-8 w-8 text-blue-600" />
    if (isExcel) return <FileSpreadsheet className="h-8 w-8 text-green-600" />
    return <File className="h-8 w-8 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)
  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = file.url
    link.download = file.originalName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const resetView = () => {
    setZoom(1)
    setRotation(0)
  }

  const defaultTrigger = (
    <Button variant="ghost" size="sm">
      <Eye className="h-4 w-4" />
    </Button>
  )

  const renderPreview = () => {
    if (isImage) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden">
          <img
            src={file.url}
            alt={file.originalName}
            className="max-w-full max-h-[60vh] object-contain transition-transform duration-200"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`
            }}
          />
        </div>
      )
    }

    if (isPDF) {
      return (
        <div className="flex items-center justify-center bg-gray-100 rounded-lg h-[60vh]">
          <div className="text-center">
            <FileText className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <p className="text-lg font-medium">PDF Document</p>
            <p className="text-sm text-gray-600 mb-4">{file.originalName}</p>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      )
    }

    // For other file types
    return (
      <div className="flex items-center justify-center bg-gray-100 rounded-lg h-[60vh]">
        <div className="text-center">
          {getFileIcon()}
          <p className="text-lg font-medium mt-4">Document Preview</p>
          <p className="text-sm text-gray-600 mb-4">{file.originalName}</p>
          <div className="space-y-2">
            <Badge variant="outline">
              {file.type.split('/')[1]?.toUpperCase() || 'DOCUMENT'}
            </Badge>
            <p className="text-sm text-gray-500">
              {formatFileSize(file.size)}
            </p>
          </div>
          <Button onClick={handleDownload} className="mt-4">
            <Download className="h-4 w-4 mr-2" />
            Download File
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {showTrigger && (
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {getFileIcon()}
              <span className="truncate">{file.originalName}</span>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isImage && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomOut}
                    disabled={zoom <= 0.5}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleZoomIn}
                    disabled={zoom >= 3}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRotate}
                  >
                    <RotateCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetView}
                  >
                    Reset
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-auto">
          {renderPreview()}
        </div>
        
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Size:</span>
              <p className="text-gray-600">{formatFileSize(file.size)}</p>
            </div>
            <div>
              <span className="font-medium">Type:</span>
              <p className="text-gray-600">{file.type}</p>
            </div>
            <div>
              <span className="font-medium">Uploaded:</span>
              <p className="text-gray-600">
                {new Date(file.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <span className="font-medium">Status:</span>
              <p className="text-gray-600">Available</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}