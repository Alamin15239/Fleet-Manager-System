'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Printer, Eye, QrCode, Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet, apiPost } from '@/lib/api'
import { PageHeader } from '@/components/page-header'

interface JobCard {
  id: string
  jobCardNumber: string
  status: string
  qrCode?: string
  createdAt: string
  maintenanceRecord: {
    serviceType: string
    datePerformed: string
    totalCost: number
    truck: {
      make: string
      model: string
      year: number
      licensePlate: string
    }
    mechanic?: {
      name: string
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

export default function JobCardsPage() {
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJobCard, setSelectedJobCard] = useState<JobCard | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchJobCards()
  }, [])

  const fetchJobCards = async () => {
    try {
      setLoading(true)
      const response = await apiGet('/api/job-cards?limit=100')
      if (response.ok) {
        const data = await response.json()
        setJobCards(data.data || [])
      } else {
        toast.error('Failed to fetch job cards')
      }
    } catch (error) {
      console.error('Error fetching job cards:', error)
      toast.error('Failed to fetch job cards')
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
        fetchJobCards()
      } else {
        toast.error('Failed to print job card')
      }
    } catch (error) {
      console.error('Error printing job card:', error)
      toast.error('Failed to print job card')
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

  const filteredJobCards = jobCards.filter(jobCard =>
    jobCard.jobCardNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    jobCard.maintenanceRecord.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    jobCard.maintenanceRecord.truck.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader 
        titleKey="Job Cards Management" 
        subtitleKey="Manage and track maintenance job cards"
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Job Cards</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobCards.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <FileText className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {jobCards.filter(jc => jc.status === 'COMPLETED').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <FileText className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {jobCards.filter(jc => jc.status === 'PENDING_APPROVAL').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prints</CardTitle>
            <Printer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {jobCards.reduce((sum, jc) => sum + jc.printLogs.reduce((s, log) => s + log.printCount, 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search job cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Job Cards Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job Cards ({filteredJobCards.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredJobCards.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500">No job cards found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Card #</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobCards.map((jobCard) => (
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
                      {new Date(jobCard.maintenanceRecord.datePerformed).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(jobCard.status)}>
                        {jobCard.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedJobCard(jobCard)
                            setIsDetailDialogOpen(true)
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
          )}
        </CardContent>
      </Card>

      {/* Job Card Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
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
    </div>
  )
}