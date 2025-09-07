'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'
import { FileText, Plus, Eye, Edit, Printer, Search, Filter } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet } from '@/lib/api'
import { JobCardPreviewModal } from '@/components/job-card-preview-modal'
import { PageHeader } from '@/components/page-header'

interface JobCard {
  id: string
  jobCardNo: string
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  vehicleType: string
  vehicleName: string
  vehicleIdentifier: string
  driverName?: string
  mechanicName?: string
  totalCost: number
  printCount: number
  printedAt?: string
  createdAt: string
  updatedAt: string
}

interface Mechanic {
  id: string
  name: string
}

export default function JobCardsPage() {
  const [jobCards, setJobCards] = useState<JobCard[]>([])
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [loading, setLoading] = useState(true)
  const [isJobCardModalOpen, setIsJobCardModalOpen] = useState(false)
  const [editingJobCard, setEditingJobCard] = useState<JobCard | null>(null)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('all')
  const [mechanicFilter, setMechanicFilter] = useState('all')
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const itemsPerPage = 10

  useEffect(() => {
    fetchJobCards()
    fetchMechanics()
  }, [currentPage, searchTerm, statusFilter, vehicleTypeFilter, mechanicFilter])

  const fetchJobCards = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(vehicleTypeFilter !== 'all' && { vehicleType: vehicleTypeFilter }),
        ...(mechanicFilter !== 'all' && { mechanicId: mechanicFilter })
      })

      const response = await apiGet(`/api/job-cards?${params}`)
      if (response.ok) {
        const data = await response.json()
        setJobCards(data.data || [])
        setTotalPages(data.pagination?.pages || 1)
        setTotalCount(data.pagination?.total || 0)
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

  const fetchMechanics = async () => {
    try {
      const response = await apiGet('/api/mechanics')
      if (response.ok) {
        const data = await response.json()
        setMechanics(data || [])
      }
    } catch (error) {
      console.error('Error fetching mechanics:', error)
    }
  }

  const handlePrint = async (jobCard: JobCard) => {
    try {
      // Get current user ID
      let currentUserId = null
      try {
        const userResponse = await fetch('/api/auth/me')
        if (userResponse.ok) {
          const userData = await userResponse.json()
          currentUserId = userData.user?.id || userData.id
        }
      } catch (e) {
        console.error('Error getting current user:', e)
      }

      const response = await fetch('/api/job-cards/print', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobCardId: jobCard.id,
          userId: currentUserId
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `job-card-${jobCard.jobCardNo}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        toast.success('Job card printed successfully')
        
        // Refresh the list to update print count
        fetchJobCards()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to print job card')
      }
    } catch (error) {
      console.error('Error printing job card:', error)
      toast.error('Failed to print job card')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'ACTIVE': return 'bg-blue-100 text-blue-800'
      case 'DRAFT': return 'bg-yellow-100 text-yellow-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const resetFilters = () => {
    setSearchTerm('')
    setStatusFilter('all')
    setVehicleTypeFilter('all')
    setMechanicFilter('all')
    setCurrentPage(1)
  }

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
        titleKey="Job Cards" 
        subtitleKey="Manage and print job cards for maintenance work"
      >
        <Button onClick={() => setIsJobCardModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Job Card
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search job cards..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={vehicleTypeFilter} onValueChange={setVehicleTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Vehicle Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="truck">Trucks</SelectItem>
                <SelectItem value="trailer">Trailers</SelectItem>
              </SelectContent>
            </Select>
            <Select value={mechanicFilter} onValueChange={setMechanicFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Mechanic" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Mechanics</SelectItem>
                {mechanics.map((mechanic) => (
                  <SelectItem key={mechanic.id} value={mechanic.id}>
                    {mechanic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={resetFilters}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Job Cards Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job Cards</CardTitle>
          <CardDescription>
            Showing {jobCards.length} of {totalCount} job cards
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job Card No.</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Mechanic</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Print Count</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobCards.map((jobCard) => (
                  <TableRow key={jobCard.id}>
                    <TableCell className="font-medium">
                      {jobCard.jobCardNo}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{jobCard.vehicleName}</div>
                        <div className="text-sm text-gray-500">
                          {jobCard.vehicleType === 'truck' ? '🚛' : '🚚'} {jobCard.vehicleIdentifier}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{jobCard.driverName || 'N/A'}</TableCell>
                    <TableCell>{jobCard.mechanicName || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getStatusColor(jobCard.status)}`}>
                        {jobCard.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      ${jobCard.totalCost.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <div className="text-center">
                        <div className="font-medium">{jobCard.printCount}</div>
                        {jobCard.printedAt && (
                          <div className="text-xs text-gray-500">
                            Last: {format(new Date(jobCard.printedAt), 'MMM dd')}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(jobCard.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setEditingJobCard(jobCard)
                            setIsJobCardModalOpen(true)
                          }}
                          title="Edit Job Card"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handlePrint(jobCard)}
                          title="Print Job Card"
                          className="text-green-600 hover:text-green-700"
                        >
                          <Printer className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Job Card Modal */}
      <JobCardPreviewModal
        isOpen={isJobCardModalOpen}
        onClose={() => {
          setIsJobCardModalOpen(false)
          setEditingJobCard(null)
        }}
        initialData={editingJobCard || undefined}
        onSave={(jobCard) => {
          toast.success(editingJobCard ? 'Job card updated successfully' : 'Job card created successfully')
          fetchJobCards()
        }}
      />
    </div>
  )
}