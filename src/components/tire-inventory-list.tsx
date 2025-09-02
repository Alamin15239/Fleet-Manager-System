'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Textarea } from '@/components/ui/textarea'
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Circle, 
  Truck, 
  User,
  Calendar,
  Package,
  Edit,
  Trash2,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'
import { apiGet, apiPut, apiDelete } from '@/lib/api'
import { useRealTime } from '../../components/real-time-provider'

interface Tire {
  id: string
  tireSize: string
  manufacturer: string
  origin: string
  plateNumber: string
  trailerNumber: string | null
  driverName: string | null
  quantity: number
  notes: string | null
  createdAt: string
  createdBy: {
    id: string
    name: string | null
    email: string
  }
}

interface TireFormData {
  tireSize: string
  manufacturer: string
  origin: string
  plateNumber: string
  trailerNumber: string
  driverName: string
  quantity: number
  notes: string
}

interface TireListResponse {
  tires: Tire[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function TireInventoryList() {
  const [tires, setTires] = useState<Tire[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  })

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedManufacturer, setSelectedManufacturer] = useState('')
  const [selectedOrigin, setSelectedOrigin] = useState('')
  const [selectedPlate, setSelectedPlate] = useState('')
  const [selectedDriver, setSelectedDriver] = useState('')

  // Available options for filters
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const [origins] = useState(['CHINESE', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER'])
  const [plates, setPlates] = useState<string[]>([])
  const [drivers, setDrivers] = useState<string[]>([])

  // Edit/Delete states
  const [editingTire, setEditingTire] = useState<Tire | null>(null)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [tireForm, setTireForm] = useState<TireFormData>({
    tireSize: '',
    manufacturer: '',
    origin: 'CHINESE',
    plateNumber: '',
    trailerNumber: '',
    driverName: '',
    quantity: 1,
    notes: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { refreshData } = useRealTime()

  useEffect(() => {
    fetchTires()
    fetchFilterOptions()
  }, [pagination.page, pagination.limit])

  useEffect(() => {
    fetchTires()
    fetchFilterOptions()
  }, [refreshData])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTires()
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedManufacturer, selectedOrigin, selectedPlate, selectedDriver])

  const fetchTires = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      })

      if (searchTerm) params.append('search', searchTerm)
      if (selectedManufacturer && selectedManufacturer !== 'all') params.append('manufacturer', selectedManufacturer)
      if (selectedOrigin && selectedOrigin !== 'all') params.append('origin', selectedOrigin)
      if (selectedPlate && selectedPlate !== 'all') params.append('plateNumber', selectedPlate)
      if (selectedDriver && selectedDriver !== 'all') params.append('driverName', selectedDriver)

      const response = await apiGet(`/api/tires?${params}`)
      if (response.ok) {
        const data: TireListResponse = await response.json()
        setTires(data.tires)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Error fetching tires:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchFilterOptions = async () => {
    try {
      const response = await apiGet('/api/tires/filters')
      if (response.ok) {
        const data = await response.json()
        setManufacturers(data.manufacturers)
        setPlates(data.plates)
        setDrivers(data.drivers)
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  const handleEditTire = (tire: Tire) => {
    setEditingTire(tire)
    setTireForm({
      tireSize: tire.tireSize,
      manufacturer: tire.manufacturer,
      origin: tire.origin,
      plateNumber: tire.plateNumber,
      trailerNumber: tire.trailerNumber || '',
      driverName: tire.driverName || '',
      quantity: tire.quantity,
      notes: tire.notes || ''
    })
    setShowEditDialog(true)
    setError(null)
    setSuccess(null)
  }

  const handleUpdateTire = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTire) return

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiPut(`/api/tires/${editingTire.id}`, tireForm)

      if (response.ok) {
        const data = await response.json()
        setSuccess('Tire updated successfully')
        setShowEditDialog(false)
        fetchTires()
        fetchFilterOptions()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to update tire')
      }
    } catch (error) {
      setError('Failed to update tire')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteTire = async (tireId: string) => {
    if (!confirm('Are you sure you want to delete this tire record?')) return

    try {
      const response = await apiDelete(`/api/tires/${tireId}`)

      if (response.ok) {
        setSuccess('Tire deleted successfully')
        fetchTires()
        fetchFilterOptions()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to delete tire')
      }
    } catch (error) {
      setError('Failed to delete tire')
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchTires()
    fetchFilterOptions()
  }

  const handleExport = () => {
    // Create CSV content
    const headers = ['Tire Size', 'Manufacturer', 'Origin', 'Plate Number', 'Trailer Number', 'Driver Name', 'Quantity', 'Notes', 'Created Date', 'Created By', 'Vehicle Type']
    const csvContent = [
      headers.join(','),
      ...tires.map(tire => [
        tire.tireSize,
        tire.manufacturer,
        tire.origin,
        tire.plateNumber || '',
        tire.trailerNumber || '',
        tire.driverName || '',
        tire.quantity,
        tire.notes || '',
        format(new Date(tire.createdAt), 'yyyy-MM-dd HH:mm'),
        tire.createdBy?.name || tire.createdBy?.email || 'System',
        tire.trailerNumber ? 'Trailer' : 'Truck'
      ].join(','))
    ].join('\n')

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tire-inventory-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const getOriginColor = (origin: string) => {
    switch (origin) {
      case 'CHINESE': return 'bg-red-100 text-red-800'
      case 'JAPANESE': return 'bg-blue-100 text-blue-800'
      case 'EUROPEAN': return 'bg-green-100 text-green-800'
      case 'AMERICAN': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label className="text-sm">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search all fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Manufacturer</Label>
              <Select value={selectedManufacturer} onValueChange={setSelectedManufacturer}>
                <SelectTrigger>
                  <SelectValue placeholder="All manufacturers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All manufacturers</SelectItem>
                  {manufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer} value={manufacturer}>
                      {manufacturer}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Origin</Label>
              <Select value={selectedOrigin} onValueChange={setSelectedOrigin}>
                <SelectTrigger>
                  <SelectValue placeholder="All origins" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All origins</SelectItem>
                  {origins.map((origin) => (
                    <SelectItem key={origin} value={origin}>
                      {origin}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Plate Number</Label>
              <Select value={selectedPlate} onValueChange={setSelectedPlate}>
                <SelectTrigger>
                  <SelectValue placeholder="All plates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All plates</SelectItem>
                  {plates.map((plate) => (
                    <SelectItem key={plate} value={plate}>
                      {plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Driver</Label>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger>
                  <SelectValue placeholder="All drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All drivers</SelectItem>
                  {drivers.map((driver) => (
                    <SelectItem key={driver} value={driver}>
                      {driver}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Tire Inventory</h2>
          <p className="text-muted-foreground text-sm">
            Showing {tires.length} of {pagination.total} tires
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} size="sm">
            <RefreshCw className={`mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="outline" onClick={handleExport} size="sm">
            <Download className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
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

      {/* Tire Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">
                    <div className="text-xs sm:text-sm">Tire Details</div>
                  </TableHead>
                  <TableHead className="min-w-[180px]">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Truck className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                      <span className="text-xs sm:text-sm">Vehicle Info</span>
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[140px]">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <User className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                      <span className="text-xs sm:text-sm">Driver</span>
                    </div>
                  </TableHead>
                  <TableHead className="min-w-[80px]">
                    <div className="text-xs sm:text-sm">Qty</div>
                  </TableHead>
                  <TableHead className="min-w-[90px]">
                    <div className="text-xs sm:text-sm">Origin</div>
                  </TableHead>
                  <TableHead className="min-w-[100px] hidden sm:table-cell">
                    <div className="text-xs sm:text-sm">Created</div>
                  </TableHead>
                  <TableHead className="min-w-[120px] hidden lg:table-cell">
                    <div className="text-xs sm:text-sm">Created By</div>
                  </TableHead>
                  <TableHead className="text-right min-w-[100px]">
                    <div className="text-xs sm:text-sm">Actions</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tires.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Circle className="h-8 w-8 text-gray-400" />
                        <p className="text-gray-500">No tires found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  tires.map((tire) => (
                    <TableRow key={tire.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{tire.manufacturer}</div>
                          <div className="text-xs text-gray-500">{tire.tireSize}</div>
                          {tire.notes && (
                            <div className="text-xs text-gray-400 truncate max-w-32">{tire.notes}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {tire.trailerNumber ? (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                            <div className="flex items-center gap-1 mb-1">
                              <Package className="h-3 w-3 text-orange-600" />
                              <span className="font-semibold text-orange-900 text-xs">Trailer</span>
                            </div>
                            <div className="text-xs text-orange-700 font-semibold">{tire.trailerNumber}</div>
                          </div>
                        ) : (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                            <div className="flex items-center gap-1 mb-1">
                              <Truck className="h-3 w-3 text-blue-600" />
                              <span className="font-semibold text-blue-900 text-xs">Truck</span>
                            </div>
                            {tire.plateNumber && (
                              <div className="text-xs font-semibold">{tire.plateNumber}</div>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                          {tire.driverName ? (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-300 text-xs">
                              <User className="h-3 w-3 mr-1" />
                              <span className="truncate max-w-16">{tire.driverName}</span>
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-500 italic">Unassigned</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="h-3 w-3 text-gray-400" />
                          <span className="font-medium text-sm">{tire.quantity}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getOriginColor(tire.origin)} text-xs`}>
                          {tire.origin.slice(0, 3)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-gray-400" />
                          <span className="text-xs">
                            {format(new Date(tire.createdAt), 'MMM dd')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="text-xs truncate max-w-24">
                          {tire.createdBy?.name || tire.createdBy?.email || 'System'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingTire(tire)
                              setShowEditDialog(true)
                            }}
                            className="h-8 w-8 p-0"
                            title="View/Edit tire details"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTire(tire)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTire(tire.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </Button>
          <span className="flex items-center px-2 sm:px-4 text-sm">
            <span className="hidden sm:inline">Page {pagination.page} of {pagination.pages}</span>
            <span className="sm:hidden">{pagination.page}/{pagination.pages}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.pages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Edit Tire Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Edit Tire</DialogTitle>
            <DialogDescription className="text-sm">
              Update tire information
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateTire} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tireSize">Tire Size</Label>
                <Input
                  id="tireSize"
                  value={tireForm.tireSize}
                  onChange={(e) => setTireForm({ ...tireForm, tireSize: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="manufacturer">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={tireForm.manufacturer}
                  onChange={(e) => setTireForm({ ...tireForm, manufacturer: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="origin">Origin</Label>
              <Select value={tireForm.origin} onValueChange={(value) => setTireForm({ ...tireForm, origin: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHINESE">Chinese</SelectItem>
                  <SelectItem value="JAPANESE">Japanese</SelectItem>
                  <SelectItem value="EUROPEAN">European</SelectItem>
                  <SelectItem value="AMERICAN">American</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plateNumber" className="text-sm">Plate Number</Label>
                <Input
                  id="plateNumber"
                  value={tireForm.plateNumber}
                  onChange={(e) => setTireForm({ ...tireForm, plateNumber: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trailerNumber" className="text-sm">Trailer Number</Label>
                <Input
                  id="trailerNumber"
                  value={tireForm.trailerNumber}
                  onChange={(e) => setTireForm({ ...tireForm, trailerNumber: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="driverName" className="text-sm">Driver Name</Label>
                <Input
                  id="driverName"
                  value={tireForm.driverName}
                  onChange={(e) => setTireForm({ ...tireForm, driverName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-sm">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={tireForm.quantity}
                  onChange={(e) => setTireForm({ ...tireForm, quantity: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm">Notes</Label>
              <Textarea
                id="notes"
                value={tireForm.notes}
                onChange={(e) => setTireForm({ ...tireForm, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

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

            <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowEditDialog(false)}
                className="w-full sm:w-auto"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}