'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileText, Printer, Eye, QrCode, Download, PenTool } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { SignaturePad } from '@/components/signature-pad'

interface JobCard {
  id: string
  jobCardNumber: string
  status: string
  qrCode?: string
  customerSignature?: string
  mechanicSignature?: string
  supervisorSignature?: string
  createdAt: string
  maintenanceRecord: {
    serviceType: string
    truck: {
      make: string
      model: string
      year: number
      licensePlate: string
    }
  }
  printLogs: Array<{
    printedAt: string
    printCount: number
    user: {
      name: string
    }
  }>
}

interface JobCardManagerProps {
  maintenanceRecordId?: string
  onJobCardCreated?: (jobCard: JobCard) => void
}

export function JobCardManager({ maintenanceRecordId, onJobCardCreated }: JobCardManagerProps) {
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [loading, setLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedJobCard, setSelectedJobCard] = useState<JobCard | null>(null)
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false)
  const [signatureType, setSignatureType] = useState<'customer' | 'mechanic' | 'supervisor'>('customer')

  useEffect(() => {
    fetchJobCards()
  }, [])

  const fetchJobCards = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/job-cards')
      if (response.ok) {
        const data = await response.json()
        setJobCards(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching job cards:', error)
      toast.error('Failed to fetch job cards')
    } finally {
      setLoading(false)
    }
  }

  const createJobCard = async () => {
    if (!maintenanceRecordId) {
      toast.error('No maintenance record selected')
      return
    }

    try {
      setLoading(true)
      const response = await apiPost('/api/job-cards', {
        maintenanceRecordId
      })

      if (response.ok) {
        const data = await response.json()
        toast.success('Job card created successfully')
        setJobCards(prev => [data.data, ...prev])
        onJobCardCreated?.(data.data)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create job card')
      }
    } catch (error) {
      console.error('Error creating job card:', error)
      toast.error('Failed to create job card')
    } finally {
      setLoading(false)
    }
  }

  const printJobCard = async (jobCardId: string) => {
    try {
      const response = await apiPost('/api/job-cards/print', { jobCardId })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `job-card-${jobCardId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success('Job card printed successfully')
        fetchJobCards() // Refresh to update print logs
      } else {
        toast.error('Failed to print job card')
      }
    } catch (error) {
      console.error('Error printing job card:', error)
      toast.error('Failed to print job card')
    }
  }

  const openSignaturePad = (jobCard: JobCard, type: 'customer' | 'mechanic' | 'supervisor') => {
    setSelectedJobCard(jobCard)
    setSignatureType(type)
    setIsSignaturePadOpen(true)
  }

  const saveSignature = async (signature: string) => {
    if (!selectedJobCard) return

    try {
      const updateData = {
        [`${signatureType}Signature`]: signature
      }

      const response = await apiPut(`/api/job-cards/${selectedJobCard.id}`, updateData)
      
      if (response.ok) {
        toast.success(`${signatureType} signature saved successfully`)
        fetchJobCards()
      } else {
        toast.error('Failed to save signature')
      }
    } catch (error) {
      console.error('Error saving signature:', error)
      toast.error('Failed to save signature')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'APPROVED': return 'bg-blue-100 text-blue-800'
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-800'
      case 'DRAFT': return 'bg-gray-100 text-gray-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Job Cards</h3>
        {maintenanceRecordId && (
          <Button onClick={createJobCard} disabled={loading} size="sm">
            <FileText className="h-4 w-4 mr-2" />
            Generate Job Card
          </Button>
        )}
      </div>

      {jobCards.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No job cards found</p>
            {maintenanceRecordId && (
              <Button onClick={createJobCard} className="mt-4" disabled={loading}>
                Create First Job Card
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Job Cards ({jobCards.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Card #</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Print Count</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobCards.map((jobCard) => (
                  <TableRow key={jobCard.id}>
                    <TableCell className="font-mono text-sm">
                      {jobCard.jobCardNumber}
                    </TableCell>
                    <TableCell>{jobCard.maintenanceRecord.serviceType}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">
                          {jobCard.maintenanceRecord.truck.year} {jobCard.maintenanceRecord.truck.make} {jobCard.maintenanceRecord.truck.model}
                        </div>
                        <div className="text-gray-500">
                          {jobCard.maintenanceRecord.truck.licensePlate}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(jobCard.status)}>
                        {jobCard.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {jobCard.printLogs.reduce((sum, log) => sum + log.printCount, 0)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedJobCard(jobCard)
                            setIsDialogOpen(true)
                          }}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => printJobCard(jobCard.id)}
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openSignaturePad(jobCard, 'customer')}
                          title="Customer Signature"
                        >
                          <PenTool className="h-3 w-3" />
                        </Button>
                        {jobCard.qrCode && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement('a')
                              link.href = jobCard.qrCode!
                              link.download = `qr-${jobCard.jobCardNumber}.png`
                              link.click()
                            }}
                          >
                            <QrCode className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Job Card Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Job Card Details</DialogTitle>
          </DialogHeader>
          {selectedJobCard && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Job Card Number</label>
                  <p className="font-mono">{selectedJobCard.jobCardNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <Badge className={getStatusColor(selectedJobCard.status)}>
                    {selectedJobCard.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Service Type</label>
                <p>{selectedJobCard.maintenanceRecord.serviceType}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-500">Vehicle</label>
                <p>
                  {selectedJobCard.maintenanceRecord.truck.year} {selectedJobCard.maintenanceRecord.truck.make} {selectedJobCard.maintenanceRecord.truck.model}
                  <span className="text-gray-500 ml-2">({selectedJobCard.maintenanceRecord.truck.licensePlate})</span>
                </p>
              </div>

              {selectedJobCard.printLogs.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Print History</label>
                  <div className="mt-2 space-y-2">
                    {selectedJobCard.printLogs.map((log, index) => (
                      <div key={index} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                        <span>Printed by {log.user.name}</span>
                        <span>{new Date(log.printedAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <Button onClick={() => printJobCard(selectedJobCard.id)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Job Card
                </Button>
                {selectedJobCard.qrCode && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      const link = document.createElement('a')
                      link.href = selectedJobCard.qrCode!
                      link.download = `qr-${selectedJobCard.jobCardNumber}.png`
                      link.click()
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download QR Code
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SignaturePad
        isOpen={isSignaturePadOpen}
        onClose={() => setIsSignaturePadOpen(false)}
        onSave={saveSignature}
        title={`${signatureType.charAt(0).toUpperCase() + signatureType.slice(1)} Signature`}
      />
    </div>
  )
}