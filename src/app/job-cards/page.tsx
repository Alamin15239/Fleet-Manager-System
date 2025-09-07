'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Printer, Eye, QrCode, Download, Search, Filter } from 'lucide-react'
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
    id: string
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
    id: string
    printedAt: string
    printCount: number
    user: {
      name: string
      email: string
    }
  }>
}

export default function JobCardsPage() {
  const router = useRouter()
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [filteredJobCards, setFilteredJobCards] = useState<JobCard[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJobCard, setSelectedJobCard] = useState<JobCard | null>(null)
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchJobCards()
  }, [])

  useEffect(() => {
    filterJobCards()
  }, [jobCards, searchTerm, statusFilter])

  const fetchJobCards = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('Fetching job cards...')
      const response = await apiGet('/api/job-cards?limit=100')
      if (response.ok) {
        const data = await response.json()
        setJobCards(data.data || [])
        console.log('Job cards fetched:', data.data?.length || 0)
      } else {
        const errorText = await response.text()
        console.error('API Error:', response.status, errorText)
        setError(`Failed to fetch job cards: ${response.status}`)
        toast.error('Failed to fetch job cards')
      }
    } catch (error) {
      console.error('Error fetching job cards:', error)
      setError('Network error while fetching job cards')
      toast.error('Failed to fetch job cards')
    } finally {
      setLoading(false)
    }
  }

  const filterJobCards = () => {
    let filtered = jobCards

    if (searchTerm) {
      filtered = filtered.filter(jobCard =>
        jobCard.jobCardNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        jobCard.maintenanceRecord.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        jobCard.maintenanceRecord.truck.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${jobCard.maintenanceRecord.truck.make} ${jobCard.maintenanceRecord.truck.model}`.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(jobCard => jobCard.status === statusFilter)
    }

    setFilteredJobCards(filtered)
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

  const getTotalPrintCount = (printLogs: JobCard['printLogs']) => {
    return printLogs.reduce((sum, log) => sum + log.printCount, 0)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Job Cards</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
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
              {jobCards.reduce((sum, jc) => sum + getTotalPrintCount(jc.printLogs), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search job cards..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job Card #</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mechanic</TableHead>
                    <TableHead>Print Count</TableHead>
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
                        {jobCard.maintenanceRecord.mechanic?.name || 'Not assigned'}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{getTotalPrintCount(jobCard.printLogs)}</span>
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
                            title="View Details"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => printJobCard(jobCard.id)}
                            title="Print Job Card"
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
                              title="Download QR Code"
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Card Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Card Details</DialogTitle>
          </DialogHeader>
          {selectedJobCard && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">Job Card Information</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Job Card Number</label>
                        <p className="font-mono">{selectedJobCard.jobCardNumber}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <div>
                          <Badge className={getStatusColor(selectedJobCard.status)}>
                            {selectedJobCard.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Created</label>
                        <p>{new Date(selectedJobCard.createdAt).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Vehicle Information</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Vehicle</label>
                        <p>
                          {selectedJobCard.maintenanceRecord.truck.year} {selectedJobCard.maintenanceRecord.truck.make} {selectedJobCard.maintenanceRecord.truck.model}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">License Plate</label>
                        <p>{selectedJobCard.maintenanceRecord.truck.licensePlate}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Service Information</h3>
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Service Type</label>
                        <p>{selectedJobCard.maintenanceRecord.serviceType}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Date Performed</label>
                        <p>{new Date(selectedJobCard.maintenanceRecord.datePerformed).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Total Cost</label>
                        <p className="font-medium">${selectedJobCard.maintenanceRecord.totalCost.toFixed(2)}</p>
                      </div>
                      {selectedJobCard.maintenanceRecord.mechanic && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Mechanic</label>
                          <p>{selectedJobCard.maintenanceRecord.mechanic.name}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedJobCard.qrCode && (
                    <div>
                      <h3 className="font-semibold mb-2">QR Code</h3>
                      <div className="text-center">
                        <img 
                          src={selectedJobCard.qrCode} 
                          alt="QR Code" 
                          className="w-32 h-32 mx-auto border"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2"
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
                      </div>
                    </div>
                  )}

                  {selectedJobCard.printLogs.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2">Print History</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {selectedJobCard.printLogs.map((log) => (
                          <div key={log.id} className="bg-gray-50 p-3 rounded text-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-medium">{log.user.name}</p>
                                <p className="text-gray-500 text-xs">{log.user.email}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">
                                  {new Date(log.printedAt).toLocaleString()}
                                </p>
                                <p className="text-xs">
                                  Print count: {log.printCount}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        Total prints: {getTotalPrintCount(selectedJobCard.printLogs)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={() => printJobCard(selectedJobCard.id)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print Job Card
                </Button>
                <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}