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
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Eye
} from 'lucide-react'
import { format } from 'date-fns'
import { apiGet, apiPut } from '@/lib/api'
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
  serialNumber: string | null
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
  serialNumber: string
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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Available options for filters
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const [origins] = useState(['CHINESE', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER'])
  const [plates, setPlates] = useState<string[]>([])
  const [drivers, setDrivers] = useState<string[]>([])

  // View/Edit states
  const [editingTire, setEditingTire] = useState<Tire | null>(null)
  const [showViewDialog, setShowViewDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [tireForm, setTireForm] = useState<TireFormData>({
    tireSize: '',
    manufacturer: '',
    origin: 'OTHER',
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
  }, [searchTerm, selectedManufacturer, selectedOrigin, selectedPlate, selectedDriver, dateFrom, dateTo])

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
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)

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
      serialNumber: tire.serialNumber || '',
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
      // Prepare data with proper validation
      const updateData = {
        tireSize: (tireForm.tireSize || '').trim(),
        manufacturer: (tireForm.manufacturer || '').trim(),
        origin: tireForm.origin,
        plateNumber: (tireForm.plateNumber || '').trim(),
        trailerNumber: (tireForm.trailerNumber || '').trim() || null,
        driverName: (tireForm.driverName || '').trim() || null,
        quantity: tireForm.quantity,
        serialNumber: (tireForm.serialNumber || '').trim() || null,
        notes: (tireForm.notes || '').trim() || null
      }

      const response = await apiPut(`/api/tires/${editingTire.id}`, updateData)

      if (response.ok) {
        setSuccess('Tire updated successfully')
        setTimeout(() => {
          setShowEditDialog(false)
          setSuccess(null)
        }, 1500)
        fetchTires()
        fetchFilterOptions()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to update tire')
      }
    } catch (error) {
      console.error('Update error:', error)
      setError('Failed to update tire')
    } finally {
      setSubmitting(false)
    }
  }



  const handleRefresh = () => {
    setRefreshing(true)
    fetchTires()
    fetchFilterOptions()
  }

  const handleExport = () => {
    // Create CSV content
    const headers = ['Tire Size', 'Manufacturer', 'Origin', 'Serial Number', 'Plate Number', 'Trailer Number', 'Driver Name', 'Quantity', 'Notes', 'Created Date', 'Created By', 'Vehicle Type']
    const csvContent = [
      headers.join(','),
      ...tires.map(tire => [
        tire.tireSize,
        tire.manufacturer,
        tire.origin,
        tire.serialNumber || '',
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
      case 'JAPANESE': return 'bg-blue-100 text-blue-800'
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
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

            <div className="space-y-2">
              <Label className="text-sm">Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm"
              />
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
                              setShowViewDialog(true)
                            }}
                            className="h-8 w-8 p-0"
                            title="View tire details"
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditTire(tire)}
                            className="h-8 w-8 p-0"
                            title="Edit tire"
                          >
                            <Edit className="h-3 w-3" />
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

      {/* View Tire Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Tire Details
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingTire?.trailerNumber ? 'Trailer Tire Information' : 'Truck Tire Information'}
            </DialogDescription>
          </DialogHeader>
          
          {editingTire && (
            <div className="space-y-4">
              {/* Tire Type Indicator */}
              <div className={`p-3 rounded-lg border ${
                editingTire.trailerNumber 
                  ? 'bg-orange-50 border-orange-200' 
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {editingTire.trailerNumber ? (
                    <>
                      <Package className="h-4 w-4 text-orange-600" />
                      <span className="font-semibold text-orange-900">Trailer Tire</span>
                    </>
                  ) : (
                    <>
                      <Truck className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-blue-900">Truck Tire</span>
                    </>
                  )}
                </div>
                <div className="text-sm space-y-1">
                  {editingTire.trailerNumber && (
                    <div><strong>Trailer:</strong> {editingTire.trailerNumber}</div>
                  )}
                  {editingTire.plateNumber && (
                    <div><strong>Plate:</strong> {editingTire.plateNumber}</div>
                  )}
                  {editingTire.driverName && (
                    <div><strong>Driver:</strong> {editingTire.driverName}</div>
                  )}
                </div>
              </div>

              {/* Tire Specifications */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Tire Size</Label>
                  <div className="text-sm p-2 bg-gray-50 rounded border">{editingTire.tireSize}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Manufacturer</Label>
                  <div className="text-sm p-2 bg-gray-50 rounded border">{editingTire.manufacturer}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Origin</Label>
                  <div className="text-sm p-2 bg-gray-50 rounded border">
                    <Badge className={`${getOriginColor(editingTire.origin)}`}>
                      {editingTire.origin}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Quantity</Label>
                  <div className="text-sm p-2 bg-gray-50 rounded border flex items-center gap-1">
                    <Package className="h-3 w-3" />
                    {editingTire.quantity}
                  </div>
                </div>
              </div>

              {editingTire.serialNumber && (
                <div>
                  <Label className="text-sm font-medium">Serial Number</Label>
                  <div className="text-sm p-2 bg-gray-50 rounded border font-mono">{editingTire.serialNumber}</div>
                </div>
              )}

              {editingTire.notes && (
                <div>
                  <Label className="text-sm font-medium">Notes</Label>
                  <div className="text-sm p-2 bg-gray-50 rounded border">{editingTire.notes}</div>
                </div>
              )}

              {/* Creation Info */}
              <div className="border-t pt-4">
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created: {format(new Date(editingTire.createdAt), 'MMM dd, yyyy HH:mm')}
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    By: {editingTire.createdBy?.name || editingTire.createdBy?.email || 'System'}
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={() => setShowViewDialog(false)}
                  className="w-full sm:w-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Context-Specific Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-sm mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit {editingTire?.trailerNumber ? 'Trailer' : 'Truck'} Tire
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingTire?.trailerNumber 
                ? 'Update trailer tire information' 
                : 'Update truck tire information'
              }
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleUpdateTire} className="space-y-4">
            {/* Tire Specifications */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="tireSize" className="text-sm">Tire Size</Label>
                <Input
                  id="tireSize"
                  value={tireForm.tireSize}
                  onChange={(e) => setTireForm({ ...tireForm, tireSize: e.target.value })}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manufacturer" className="text-sm">Manufacturer</Label>
                <Input
                  id="manufacturer"
                  value={tireForm.manufacturer}
                  onChange={(e) => setTireForm({ ...tireForm, manufacturer: e.target.value })}
                  required
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="origin" className="text-sm">Origin</Label>
                <Select value={tireForm.origin} onValueChange={(value) => setTireForm({ ...tireForm, origin: value })}>
                  <SelectTrigger className="text-sm">
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
            </div>

            {/* Context-Specific Fields */}
            <div className="space-y-3">
              {editingTire?.trailerNumber ? (
                <div className="space-y-2">
                  <Label htmlFor="trailerNumber" className="text-sm">Trailer Number</Label>
                  <Input
                    id="trailerNumber"
                    value={tireForm.trailerNumber}
                    onChange={(e) => setTireForm({ ...tireForm, trailerNumber: e.target.value })}
                    className="text-sm"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="plateNumber" className="text-sm">Plate Number</Label>
                  <Input
                    id="plateNumber"
                    value={tireForm.plateNumber}
                    onChange={(e) => setTireForm({ ...tireForm, plateNumber: e.target.value })}
                    className="text-sm"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="driverName" className="text-sm">Driver Name</Label>
                <Input
                  id="driverName"
                  value={tireForm.driverName}
                  onChange={(e) => setTireForm({ ...tireForm, driverName: e.target.value })}
                  className="text-sm"
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
                  className="text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="serialNumber" className="text-sm">Serial Number</Label>
                <Input
                  id="serialNumber"
                  placeholder="e.g., TRK123456"
                  value={tireForm.serialNumber}
                  onChange={(e) => setTireForm({ ...tireForm, serialNumber: e.target.value })}
                  className="text-sm"
                />
              </div>
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

            <div className="flex justify-end space-x-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowEditDialog(false)}
                size="sm"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} size="sm">
                {submitting ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}