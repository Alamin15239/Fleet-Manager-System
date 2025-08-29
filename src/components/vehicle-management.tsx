'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Truck, 
  User, 
  AlertCircle, 
  CheckCircle,
  Search,
  Filter
} from 'lucide-react'
import { apiPost, apiPut, apiDelete, apiGet } from '@/lib/api'

interface Vehicle {
  id: string
  plateNumber: string
  trailerNumber: string | null
  driverName: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface VehicleFormData {
  plateNumber: string
  trailerNumber: string
  driverName: string
  isActive: boolean
}

interface DriverFormData {
  name: string
  phone?: string
  license?: string
  notes?: string
}

export default function VehicleManagement() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [filteredVehicles, setFilteredVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  
  // Vehicle form state
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null)
  const [vehicleForm, setVehicleForm] = useState<VehicleFormData>({
    plateNumber: '',
    trailerNumber: '',
    driverName: '',
    isActive: true
  })

  // Driver form state
  const [showDriverForm, setShowDriverForm] = useState(false)
  const [driverForm, setDriverForm] = useState<DriverFormData>({
    name: '',
    phone: '',
    license: '',
    notes: ''
  })

  useEffect(() => {
    fetchVehicles()
  }, [])

  useEffect(() => {
    filterVehicles()
  }, [vehicles, searchTerm, filterStatus])

  const fetchVehicles = async () => {
    setLoading(true)
    try {
      const response = await apiGet('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        setVehicles(data.vehicles || [])
      }
    } catch (error) {
      setError('Failed to fetch vehicles')
    } finally {
      setLoading(false)
    }
  }

  const filterVehicles = () => {
    let filtered = vehicles

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(vehicle =>
        vehicle.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.trailerNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vehicle.driverName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Apply status filter
    if (filterStatus === 'active') {
      filtered = filtered.filter(vehicle => vehicle.isActive)
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(vehicle => !vehicle.isActive)
    }

    setFilteredVehicles(filtered)
  }

  const handleVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const url = editingVehicle ? `/api/vehicles/${editingVehicle.id}` : '/api/vehicles'
      const method = editingVehicle ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify(vehicleForm)
      })

      if (response.ok) {
        const message = editingVehicle ? 'Vehicle updated successfully' : 'Vehicle created successfully'
        setSuccess(message)
        setShowVehicleForm(false)
        setEditingVehicle(null)
        resetVehicleForm()
        fetchVehicles()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to save vehicle')
      }
    } catch (error) {
      setError('Failed to save vehicle')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return

    setLoading(true)
    try {
      const response = await apiDelete(`/api/vehicles/${vehicleId}`)
      
      if (response.ok) {
        setSuccess('Vehicle deleted successfully')
        fetchVehicles()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to delete vehicle')
      }
    } catch (error) {
      setError('Failed to delete vehicle')
    } finally {
      setLoading(false)
    }
  }

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle)
    setVehicleForm({
      plateNumber: vehicle.plateNumber,
      trailerNumber: vehicle.trailerNumber || '',
      driverName: vehicle.driverName || '',
      isActive: vehicle.isActive
    })
    setShowVehicleForm(true)
  }

  const resetVehicleForm = () => {
    setVehicleForm({
      plateNumber: '',
      trailerNumber: '',
      driverName: '',
      isActive: true
    })
  }

  const handleDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      // Create a vehicle record with just the driver name for now
      // This allows the driver to appear in the system
      const plateNumber = `DRIVER-${Date.now()}`
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          plateNumber,
          driverName: driverForm.name,
          trailerNumber: '',
          isActive: true
        })
      })

      if (response.ok) {
        setSuccess(`Driver ${driverForm.name} added successfully`)
        setShowDriverForm(false)
        setDriverForm({
          name: '',
          phone: '',
          license: '',
          notes: ''
        })
        fetchVehicles() // Refresh the vehicle list
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to add driver')
      }
    } catch (error) {
      setError('Failed to save driver information')
    } finally {
      setLoading(false)
    }
  }

  const toggleVehicleStatus = async (vehicleId: string, currentStatus: boolean) => {
    setLoading(true)
    try {
      const response = await apiPut(`/api/vehicles/${vehicleId}`, {
        isActive: !currentStatus
      })
      
      if (response.ok) {
        setSuccess(`Vehicle ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
        fetchVehicles()
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to update vehicle status')
      }
    } catch (error) {
      setError('Failed to update vehicle status')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Vehicle Management</h2>
          <p className="text-muted-foreground text-sm">
            Manage trucks, trailers, and driver assignments
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Dialog open={showVehicleForm} onOpenChange={setShowVehicleForm}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setEditingVehicle(null)
                resetVehicleForm()
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add Vehicle
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mx-4 sm:mx-auto">
              <DialogHeader>
                <DialogTitle className="text-lg">
                  {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  {editingVehicle ? 'Update vehicle information' : 'Add a new truck or trailer to the system'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleVehicleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="plateNumber" className="text-sm">Plate Number *</Label>
                  <Input
                    id="plateNumber"
                    value={vehicleForm.plateNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, plateNumber: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="trailerNumber" className="text-sm">Trailer Number</Label>
                  <Input
                    id="trailerNumber"
                    value={vehicleForm.trailerNumber}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, trailerNumber: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="driverName" className="text-sm">Driver Name</Label>
                  <Input
                    id="driverName"
                    value={vehicleForm.driverName}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, driverName: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={vehicleForm.isActive}
                    onChange={(e) => setVehicleForm({ ...vehicleForm, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <Label htmlFor="isActive" className="text-sm">Active</Label>
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
                    onClick={() => setShowVehicleForm(false)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showDriverForm} onOpenChange={setShowDriverForm}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <User className="mr-2 h-4 w-4" />
                Add Driver
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mx-4 sm:mx-auto">
              <DialogHeader>
                <DialogTitle className="text-lg">Add New Driver</DialogTitle>
                <DialogDescription className="text-sm">
                  Add driver information to the system
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleDriverSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="driverName" className="text-sm">Driver Name *</Label>
                  <Input
                    id="driverName"
                    value={driverForm.name}
                    onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm">Phone Number</Label>
                  <Input
                    id="phone"
                    value={driverForm.phone}
                    onChange={(e) => setDriverForm({ ...driverForm, phone: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="license" className="text-sm">License Number</Label>
                  <Input
                    id="license"
                    value={driverForm.license}
                    onChange={(e) => setDriverForm({ ...driverForm, license: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes" className="text-sm">Notes</Label>
                  <Textarea
                    id="notes"
                    value={driverForm.notes}
                    onChange={(e) => setDriverForm({ ...driverForm, notes: e.target.value })}
                    placeholder="Additional notes..."
                    rows={3}
                  />
                </div>

                <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowDriverForm(false)}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                    {loading ? 'Saving...' : 'Save Driver'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search vehicles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vehicles</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="inactive">Inactive Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vehicle List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Vehicle List ({filteredVehicles.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">
                      <span className="text-xs sm:text-sm">Plate Number</span>
                    </TableHead>
                    <TableHead className="min-w-[120px] hidden sm:table-cell">
                      <span className="text-xs sm:text-sm">Trailer Number</span>
                    </TableHead>
                    <TableHead className="min-w-[140px]">
                      <span className="text-xs sm:text-sm">Driver Name</span>
                    </TableHead>
                    <TableHead className="min-w-[80px]">
                      <span className="text-xs sm:text-sm">Status</span>
                    </TableHead>
                    <TableHead className="min-w-[100px] hidden lg:table-cell">
                      <span className="text-xs sm:text-sm">Created</span>
                    </TableHead>
                    <TableHead className="text-right min-w-[100px]">
                      <span className="text-xs sm:text-sm">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No vehicles found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredVehicles.map((vehicle) => (
                      <TableRow key={vehicle.id}>
                        <TableCell className="font-medium text-sm">
                          <div>
                            {vehicle.plateNumber}
                            <div className="sm:hidden text-xs text-gray-500 mt-1">
                              {vehicle.trailerNumber && `Trailer: ${vehicle.trailerNumber}`}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-sm">{vehicle.trailerNumber || '-'}</TableCell>
                        <TableCell>
                          {vehicle.driverName ? (
                            <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                              <User className="h-3 w-3" />
                              <span className="truncate max-w-20 sm:max-w-none">{vehicle.driverName}</span>
                            </Badge>
                          ) : (
                            <span className="text-gray-400 text-xs">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={vehicle.isActive ? "default" : "secondary"}
                            className="cursor-pointer text-xs"
                            onClick={() => toggleVehicleStatus(vehicle.id, vehicle.isActive)}
                          >
                            {vehicle.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs">
                          {new Date(vehicle.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditVehicle(vehicle)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteVehicle(vehicle.id)}
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}