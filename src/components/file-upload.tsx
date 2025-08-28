'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, File, X, Image, FileText, Download, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { FilePreview } from './file-preview'

interface UploadedFile {
  id: string
  name: string
  originalName: string
  size: number
  type: string
  url: string
  uploadedAt: string
  uploadedBy: string
}

interface FileUploadProps {
  type: 'truck' | 'maintenance'
  entityId: string
  existingFiles?: UploadedFile[]
  onFilesChange?: (files: UploadedFile[]) => void
  multiple?: boolean
  maxFiles?: number
  acceptedTypes?: string[]
  maxSize?: number // in MB
}

export function FileUpload({
  type,
  entityId,
  existingFiles = [],
  onFilesChange,
  multiple = true,
  maxFiles = 10,
  acceptedTypes,
  maxSize = 10
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)

  const defaultAcceptedTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]

  const handleFileUpload = useCallback(async (fileList: FileList) => {
    if (files.length >= maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`)
      return
    }

    const filesToUpload = Array.from(fileList).slice(0, maxFiles - files.length)
    
    for (const file of filesToUpload) {
      // Validate file type
      const types = acceptedTypes || defaultAcceptedTypes
      if (!types.includes(file.type)) {
        toast.error(`File type ${file.type} is not supported`)
        continue
      }

      // Validate file size
      if (file.size > maxSize * 1024 * 1024) {
        toast.error(`File ${file.name} is too large. Maximum size is ${maxSize}MB`)
        continue
      }

      setUploading(true)
      setUploadProgress(0)

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', type)
        formData.append('entityId', entityId)

        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval)
              return 90
            }
            return prev + 10
          })
        }, 100)

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        clearInterval(progressInterval)
        setUploadProgress(100)

        if (response.ok) {
          const uploadedFile = await response.json()
          const newFiles = [...files, uploadedFile]
          setFiles(newFiles)
          onFilesChange?.(newFiles)
          toast.success(`File ${file.name} uploaded successfully`)
        } else {
          const error = await response.json()
          toast.error(error.error || 'Failed to upload file')
        }
      } catch (error) {
        console.error('Error uploading file:', error)
        toast.error('Failed to upload file')
      } finally {
        setUploading(false)
        setTimeout(() => setUploadProgress(0), 1000)
      }
    }
  }, [files, maxFiles, acceptedTypes, defaultAcceptedTypes, maxSize, type, entityId, onFilesChange])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const fileList = e.dataTransfer.files
    if (fileList.length > 0) {
      handleFileUpload(fileList)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files
    if (fileList && fileList.length > 0) {
      handleFileUpload(fileList)
    }
  }

  const removeFile = (fileId: string) => {
    const newFiles = files.filter(f => f.id !== fileId)
    setFiles(newFiles)
    onFilesChange?.(newFiles)
    toast.success('File removed')
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      // eslint-disable-next-line jsx-a11y/alt-text
      return <Image className="h-8 w-8 text-blue-500" />
    } else if (fileType === 'application/pdf') {
      return <FileText className="h-8 w-8 text-red-500" />
    } else {
      return <File className="h-8 w-8 text-gray-500" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : uploading
                ? 'border-gray-300 bg-gray-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            
            {uploading ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Uploading file...</p>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    Drop files here or click to upload
                  </p>
                  <p className="text-sm text-gray-500">
                    Supported formats: Images, PDF, Word, Excel (Max {maxSize}MB)
                  </p>
                </div>
                
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => document.getElementById('file-input')?.click()}
                    disabled={files.length >= maxFiles}
                  >
                    Choose Files
                  </Button>
                </div>
                
                <input
                  id="file-input"
                  type="file"
                  multiple={multiple}
                  accept={acceptedTypes?.join(',') || defaultAcceptedTypes.join(',')}
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={files.length >= maxFiles}
                />
                
                {files.length >= maxFiles && (
                  <p className="text-sm text-orange-600">
                    Maximum number of files ({maxFiles}) reached
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-medium mb-4">Uploaded Files ({files.length}/{maxFiles})</h3>
            <div className="space-y-3">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center space-x-3">
                    {getFileIcon(file.type)}
                    <div>
                      <p className="font-medium text-sm">{file.originalName}</p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {file.type.split('/')[1].toUpperCase()}
                    </Badge>
                    
                    <FilePreview file={file} showTrigger={false} />
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const link = document.createElement('a')
                        link.href = file.url
                        link.download = file.originalName
                        document.body.appendChild(link)
                        link.click()
                        document.body.removeChild(link)
                      }}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(file.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}