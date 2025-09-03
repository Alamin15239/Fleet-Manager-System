'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Truck, Plus, Edit, Eye, Paperclip, Trash2, Wrench, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { FileUpload } from '@/components/file-upload'
import { usePermissions } from '@/contexts/permissions-context'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'

interface Trailer {
  id: string
  number: string
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  documents?: any[]
  healthScore?: number
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  lastInspection?: string
  nextInspection?: string
  createdAt: string
  updatedAt: string
  _count: {
    trailerMaintenanceRecords: number
  }
}

export default function TrailersPage() {
  const { canAccess, canCreate, canUpdate, canDelete, loading: permissionsLoading } = usePermissions()
  const [trailers, setTrailers] = useState<Trailer[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isFilesDialogOpen, setIsFilesDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [editingTrailer, setEditingTrailer] = useState<Trailer | null>(null)
  const [selectedTrailer, setSelectedTrailer] = useState<Trailer | null>(null)
  const [trailerDocuments, setTrailerDocuments] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    number: '',
    status: 'ACTIVE' as const
  })

  useEffect(() => {
    fetchTrailers()
  }, [])

  const fetchTrailers = async () => {
    try {
      const response = await apiGet('/api/trailers?limit=100')
      if (response.ok) {
        const data = await response.json()
        setTrailers(data.data || [])
      } else {
        toast.error('Failed to fetch trailers')
      }
    } catch (error) {
      console.error('Error fetching trailers:', error)
      toast.error('Failed to fetch trailers')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800'
      case 'INACTIVE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.number) {
      toast.error('Trailer number is required')
      return
    }
    
    try {
      const url = editingTrailer ? `/api/trailers/${editingTrailer.id}` : '/api/trailers'
      const response = editingTrailer ? await apiPut(url, formData) : await apiPost(url, formData)

      if (response.ok) {
        toast.success('Trailer saved successfully')
        setIsDialogOpen(false)
        resetForm()
        fetchTrailers()
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to save trailer')
      }
    } catch (error) {
      console.error('Error saving trailer:', error)
      toast.error('Failed to save trailer')
    }
  }

  const handleEdit = (trailer: Trailer) => {
    setEditingTrailer(trailer)
    setFormData({
      number: trailer.number,
      status: trailer.status
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setEditingTrailer(null)
    setFormData({
      number: '',
      status: 'ACTIVE'
    })
  }

  const handleAddTrailer = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleDelete = async (trailerId: string) => {
    if (confirm('Are you sure you want to delete this trailer?')) {
      try {
        const response = await apiDelete(`/api/trailers/${trailerId}`)

        if (response.ok) {
          toast.success('Trailer deleted successfully')
          fetchTrailers()
        } else {
          const errorData = await response.json()
          toast.error(errorData.error || 'Failed to delete trailer')
        }
      } catch (error) {
        console.error('Error deleting trailer:', error)
        toast.error('Failed to delete trailer')
      }
    }
  }

  const handleManageFiles = (trailer: Trailer) => {
    setSelectedTrailer(trailer)
    setTrailerDocuments(trailer.documents || [])
    setIsFilesDialogOpen(true)
  }

  const handleViewTrailer = (trailer: Trailer) => {
    setSelectedTrailer(trailer)
    setIsViewDialogOpen(true)
  }

  const handleFilesChange = (files: any[]) => {
    setTrailerDocuments(files)
    if (selectedTrailer) {
      const updatedTrailers = trailers.map(trailer =>
        trailer.id === selectedTrailer.id
          ? { ...trailer, documents: files }
          : trailer
      )
      setTrailers(updatedTrailers)
    }
  }

  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!canAccess('trailers')) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to access trailers.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trailer Management</h1>
          <p className="text-muted-foreground">Manage your trailer fleet</p>
        </div>
        {canCreate('trailers') && (
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              resetForm()
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={handleAddTrailer}>
                <Plus className="h-4 w-4 mr-2" />
                Add Trailer
              </Button>
            </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingTrailer ? 'Edit Trailer' : 'Add Trailer'}
              </DialogTitle>
              <DialogDescription>
                {editingTrailer ? 'Update trailer details' : 'Enter trailer details'}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="number" className="text-right">
                  Number
                </Label>
                <Input
                  id="number"
                  value={formData.number}
                  onChange={(e) => setFormData({...formData, number: e.target.value})}
                  className="col-span-3"
                  required
                  placeholder="Enter trailer number (e.g., 1, 2, 3...)"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  Status
                </Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value as any})}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false)
                  resetForm()
                }}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingTrailer ? 'Update Trailer' : 'Add Trailer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trailers</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trailers.length}</div>
            <p className="text-xs text-muted-foreground">
              {trailers.filter(t => t.status === 'ACTIVE').length} active trailers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trailers.filter(t => t.status === 'MAINTENANCE').length}</div>
            <p className="text-xs text-muted-foreground">
              Currently being serviced
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {trailers.filter(t => t.riskLevel === 'HIGH' || t.riskLevel === 'CRITICAL').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Maintenance</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {trailers.reduce((sum, t) => sum + t._count.trailerMaintenanceRecords, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              All time records
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Files Management Dialog */}
      <Dialog open={isFilesDialogOpen} onOpenChange={setIsFilesDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Files - Trailer {selectedTrailer?.number}
            </DialogTitle>
            <DialogDescription>
              Upload and manage documents for this trailer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTrailer && (
              <FileUpload
                type="trailer"
                entityId={selectedTrailer.id}
                existingFiles={trailerDocuments}
                onFilesChange={handleFilesChange}
                multiple={true}
                maxFiles={20}
              />
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setIsFilesDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Trailer Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              Trailer Details - {selectedTrailer?.number}
            </DialogTitle>
            <DialogDescription>
              View detailed information about this trailer
            </DialogDescription>
          </DialogHeader>
          {selectedTrailer && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Number</Label>
                  <p className="text-lg font-semibold">{selectedTrailer.number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <Badge className={getStatusColor(selectedTrailer.status)}>
                    {selectedTrailer.status}
                  </Badge>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">Documents</Label>
                <p className="text-sm text-gray-600">
                  {selectedTrailer.documents && selectedTrailer.documents.length > 0 
                    ? `${selectedTrailer.documents.length} documents attached`
                    : 'No documents attached'
                  }
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Created</Label>
                  <p className="text-sm">{new Date(selectedTrailer.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Last Updated</Label>
                  <p className="text-sm">{new Date(selectedTrailer.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
            {canUpdate('trailers') && selectedTrailer && (
              <Button onClick={() => {
                setIsViewDialogOpen(false)
                handleEdit(selectedTrailer)
              }}>
                Edit Trailer
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trailers Table */}
      <Card>
        <CardHeader>
          <CardTitle>Trailer Fleet Overview</CardTitle>
          <CardDescription>
            Showing {trailers.length} trailers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Maintenance Records</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trailers.map((trailer) => (
                  <TableRow key={trailer.id}>
                    <TableCell className="font-medium">Trailer {trailer.number}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(trailer.status)}>
                        {trailer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={trailer.riskLevel === 'HIGH' || trailer.riskLevel === 'CRITICAL' ? 'destructive' : 'secondary'}>
                        {trailer.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell>{trailer._count.trailerMaintenanceRecords}</TableCell>
                    <TableCell>{new Date(trailer.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewTrailer(trailer)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleManageFiles(trailer)}
                          className="relative"
                        >
                          <Paperclip className="h-4 w-4" />
                          {trailer.documents && trailer.documents.length > 0 && (
                            <span className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {trailer.documents.length}
                            </span>
                          )}
                        </Button>
                        {canUpdate('trailers') && (
                          <Button variant="outline" size="sm" onClick={() => handleEdit(trailer)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete('trailers') && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDelete(trailer.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}