'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Truck, Plus, Edit, Trash2, Search, Filter, MapPin, Activity, AlertTriangle, TrendingUp, Calendar, Wrench, Gauge, Battery, Thermometer } from 'lucide-react'
import { format } from 'date-fns'

interface Truck {
  id: string
  vin: string
  make: string
  model: string
  year: number
  licensePlate: string
  currentMileage: number
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  image?: string
  documents?: any[]
  healthScore?: number
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  fuelEfficiency?: number
  engineHours?: number
  lastOilChange?: string
  nextOilChange?: string
  isOnline: boolean
  lastPing?: string
  locationLat?: number
  locationLng?: number
  createdAt: string
  updatedAt: string
  maintenanceRecords?: MaintenanceRecord[]
  predictiveAlerts?: PredictiveAlert[]

}

interface MaintenanceRecord {
  id: string
  serviceType: string
  description?: string
  datePerformed: string
  partsCost: number
  laborCost: number
  totalCost: number
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  mechanic?: string
  notes?: string
  downtimeHours?: number
}

interface PredictiveAlert {
  id: string
  alertType: string
  title: string
  description: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  confidence: number
  predictedFailureDate?: string
  recommendedAction?: string
  costImpact?: number
  probability: number
  isResolved: boolean
  createdAt: string
}



interface TruckFormData {
  vin: string
  make: string
  model: string
  year: number
  licensePlate: string
  currentMileage: number
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  fuelEfficiency?: number
  engineHours?: number
}

export default function TruckManagement() {
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [filteredTrucks, setFilteredTrucks] = useState<Truck[]>([])
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<TruckFormData>({
    vin: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    currentMileage: 0,
    status: 'ACTIVE',
    fuelEfficiency: undefined,
    engineHours: undefined
  })

  useEffect(() => {
    fetchTrucks()
  }, [])

  useEffect(() => {
    filterTrucks()
  }, [trucks, searchTerm, statusFilter])

  const fetchTrucks = async () => {
    try {
      // Mock data - in real app, this would be an API call
      const mockTrucks: Truck[] = [
        {
          id: '1',
          vin: '1HGCM82633A123456',
          make: 'Honda',
          model: 'Accord',
          year: 2020,
          licensePlate: 'ABC123',
          currentMileage: 45000,
          status: 'ACTIVE',
          healthScore: 92,
          riskLevel: 'LOW',
          fuelEfficiency: 8.5,
          engineHours: 1250,
          isOnline: true,
          lastPing: '2024-01-20T10:30:00Z',
          locationLat: 24.7136,
          locationLng: 46.6753,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-20T10:30:00Z',
          maintenanceRecords: [
            {
              id: '1',
              serviceType: 'Oil Change',
              datePerformed: '2024-01-15T00:00:00Z',
              partsCost: 30,
              laborCost: 45,
              totalCost: 75,
              status: 'COMPLETED',
              mechanic: 'John Doe',
              downtimeHours: 2
            }
          ],
          predictiveAlerts: [
            {
              id: '1',
              alertType: 'OIL_CHANGE_DUE',
              title: 'Oil Change Due Soon',
              description: 'Vehicle is due for oil change within 500 miles',
              severity: 'MEDIUM',
              confidence: 0.85,
              predictedFailureDate: '2024-02-15T00:00:00Z',
              recommendedAction: 'Schedule oil change service',
              costImpact: 150,
              probability: 0.75,
              isResolved: false,
              createdAt: '2024-01-18T08:00:00Z'
            }
          ],

        },
        {
          id: '2',
          vin: '2T1BURHE1JC123456',
          make: 'Toyota',
          model: 'Camry',
          year: 2019,
          licensePlate: 'DEF456',
          currentMileage: 62000,
          status: 'MAINTENANCE',
          healthScore: 78,
          riskLevel: 'MEDIUM',
          fuelEfficiency: 7.8,
          engineHours: 1890,
          isOnline: false,
          lastPing: '2024-01-19T15:45:00Z',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-19T15:45:00Z'
        },
        {
          id: '3',
          vin: '3FA6P0H72HR123456',
          make: 'Ford',
          model: 'Fusion',
          year: 2018,
          licensePlate: 'GHI789',
          currentMileage: 78000,
          status: 'ACTIVE',
          healthScore: 85,
          riskLevel: 'LOW',
          fuelEfficiency: 8.2,
          engineHours: 2100,
          isOnline: true,
          lastPing: '2024-01-20T09:15:00Z',
          locationLat: 24.6877,
          locationLng: 46.7218,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-20T09:15:00Z'
        }
      ]
      
      setTrucks(mockTrucks)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching trucks:', error)
      setLoading(false)
    }
  }

  const filterTrucks = () => {
    let filtered = trucks

    if (searchTerm) {
      filtered = filtered.filter(truck =>
        truck.vin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.licensePlate.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(truck => truck.status === statusFilter)
    }

    setFilteredTrucks(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'MAINTENANCE': return 'bg-yellow-100 text-yellow-800'
      case 'INACTIVE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'bg-green-100 text-green-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'HIGH': return 'bg-orange-100 text-orange-800'
      case 'CRITICAL': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW': return 'bg-blue-100 text-blue-800'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800'
      case 'HIGH': return 'bg-orange-100 text-orange-800'
      case 'CRITICAL': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleInputChange = (field: keyof TruckFormData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Mock API call
      if (isEditing && selectedTruck) {
        // Update truck
        const updatedTruck = { ...selectedTruck, ...formData }
        setTrucks(prev => prev.map(t => t.id === selectedTruck.id ? updatedTruck : t))
      } else {
        // Create new truck
        const newTruck: Truck = {
          id: Date.now().toString(),
          ...formData,
          isOnline: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        setTrucks(prev => [...prev, newTruck])
      }
      
      setIsDialogOpen(false)
      setIsEditing(false)
      setFormData({
        vin: '',
        make: '',
        model: '',
        year: new Date().getFullYear(),
        licensePlate: '',
        currentMileage: 0,
        status: 'ACTIVE',
        fuelEfficiency: undefined,
        engineHours: undefined
      })
    } catch (error) {
      console.error('Error saving truck:', error)
    }
  }

  const handleEdit = (truck: Truck) => {
    setSelectedTruck(truck)
    setFormData({
      vin: truck.vin,
      make: truck.make,
      model: truck.model,
      year: truck.year,
      licensePlate: truck.licensePlate,
      currentMileage: truck.currentMileage,
      status: truck.status,
      fuelEfficiency: truck.fuelEfficiency,
      engineHours: truck.engineHours
    })
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleDelete = async (truckId: string) => {
    if (confirm('Are you sure you want to delete this truck?')) {
      try {
        // Mock API call
        setTrucks(prev => prev.filter(t => t.id !== truckId))
      } catch (error) {
        console.error('Error deleting truck:', error)
      }
    }
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Truck Management</h1>
          <p className="text-muted-foreground">Manage your fleet vehicles and monitor their status</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Truck
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Truck' : 'Add New Truck'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update truck information' : 'Add a new truck to your fleet'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="vin">VIN</Label>
                <Input
                  id="vin"
                  value={formData.vin}
                  onChange={(e) => handleInputChange('vin', e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="make">Make</Label>
                  <Input
                    id="make"
                    value={formData.make}
                    onChange={(e) => handleInputChange('make', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => handleInputChange('model', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="year">Year</Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => handleInputChange('year', parseInt(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="licensePlate">License Plate</Label>
                  <Input
                    id="licensePlate"
                    value={formData.licensePlate}
                    onChange={(e) => handleInputChange('licensePlate', e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="currentMileage">Current Mileage</Label>
                  <Input
                    id="currentMileage"
                    type="number"
                    value={formData.currentMileage}
                    onChange={(e) => handleInputChange('currentMileage', parseInt(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Active</SelectItem>
                      <SelectItem value="INACTIVE">Inactive</SelectItem>
                      <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="fuelEfficiency">Fuel Efficiency (MPG)</Label>
                  <Input
                    id="fuelEfficiency"
                    type="number"
                    step="0.1"
                    value={formData.fuelEfficiency || ''}
                    onChange={(e) => handleInputChange('fuelEfficiency', parseFloat(e.target.value) || undefined)}
                  />
                </div>
                <div>
                  <Label htmlFor="engineHours">Engine Hours</Label>
                  <Input
                    id="engineHours"
                    type="number"
                    value={formData.engineHours || ''}
                    onChange={(e) => handleInputChange('engineHours', parseInt(e.target.value) || undefined)}
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? 'Update' : 'Add'} Truck
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by VIN, make, model, or license plate..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Truck List */}
      <Card>
        <CardHeader>
          <CardTitle>Fleet Overview</CardTitle>
          <CardDescription>
            {filteredTrucks.length} truck{filteredTrucks.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mileage</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Efficiency</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrucks.map((truck) => (
                <TableRow key={truck.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{truck.year} {truck.make} {truck.model}</div>
                      <div className="text-sm text-muted-foreground">{truck.licensePlate}</div>
                      <div className="text-xs text-muted-foreground">{truck.vin}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(truck.status)}>
                        {truck.status}
                      </Badge>
                      <div className={`w-2 h-2 rounded-full ${truck.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{truck.currentMileage.toLocaleString()} mi</div>
                      <div className="text-sm text-muted-foreground">{truck.engineHours}h</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            (truck.healthScore || 0) >= 90 ? 'bg-green-500' :
                            (truck.healthScore || 0) >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${truck.healthScore || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-sm">{truck.healthScore || 0}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRiskColor(truck.riskLevel || 'LOW')}>
                      {truck.riskLevel || 'LOW'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      <Gauge className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{truck.fuelEfficiency || 'N/A'} MPG</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {truck.locationLat && truck.locationLng ? (
                      <div className="flex items-center space-x-1">
                        <MapPin className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Tracked</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(truck)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(truck.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Truck Detail View */}
      {selectedTruck && (
        <Card>
          <CardHeader>
            <CardTitle>Truck Details - {selectedTruck.licensePlate}</CardTitle>
            <CardDescription>
              {selectedTruck.year} {selectedTruck.make} {selectedTruck.model}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="alerts">Alerts</TabsTrigger>

              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Vehicle Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">VIN:</span>
                        <span className="text-sm font-medium">{selectedTruck.vin}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Year:</span>
                        <span className="text-sm font-medium">{selectedTruck.year}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">License Plate:</span>
                        <span className="text-sm font-medium">{selectedTruck.licensePlate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge className={getStatusColor(selectedTruck.status)}>
                          {selectedTruck.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Performance Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Current Mileage:</span>
                        <span className="text-sm font-medium">{selectedTruck.currentMileage.toLocaleString()} mi</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Engine Hours:</span>
                        <span className="text-sm font-medium">{selectedTruck.engineHours}h</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Fuel Efficiency:</span>
                        <span className="text-sm font-medium">{selectedTruck.fuelEfficiency || 'N/A'} MPG</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Health Score:</span>
                        <span className="text-sm font-medium">{selectedTruck.healthScore || 0}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Status & Location</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Online Status:</span>
                        <div className="flex items-center space-x-1">
                          <div className={`w-2 h-2 rounded-full ${selectedTruck.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span className="text-sm font-medium">{selectedTruck.isOnline ? 'Online' : 'Offline'}</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Risk Level:</span>
                        <Badge className={getRiskColor(selectedTruck.riskLevel || 'LOW')}>
                          {selectedTruck.riskLevel || 'LOW'}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Last Ping:</span>
                        <span className="text-sm font-medium">
                          {selectedTruck.lastPing ? format(new Date(selectedTruck.lastPing), 'MMM dd, yyyy HH:mm') : 'Never'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Location:</span>
                        <span className="text-sm font-medium">
                          {selectedTruck.locationLat && selectedTruck.locationLng ? 'Available' : 'Unknown'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="maintenance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Maintenance History</CardTitle>
                    <CardDescription>Recent maintenance records for this vehicle</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedTruck.maintenanceRecords && selectedTruck.maintenanceRecords.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Service Type</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Cost</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Downtime</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedTruck.maintenanceRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">{record.serviceType}</TableCell>
                              <TableCell>{format(new Date(record.datePerformed), 'MMM dd, yyyy')}</TableCell>
                              <TableCell>${record.totalCost.toFixed(2)}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(record.status)}>
                                  {record.status}
                                </Badge>
                              </TableCell>
                              <TableCell>{record.downtimeHours || 0}h</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground">No maintenance records found.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="alerts" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Active Alerts</CardTitle>
                    <CardDescription>Predictive maintenance alerts and notifications</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedTruck.predictiveAlerts && selectedTruck.predictiveAlerts.length > 0 ? (
                      <div className="space-y-4">
                        {selectedTruck.predictiveAlerts.map((alert) => (
                          <Alert key={alert.id} className={
                            alert.severity === 'CRITICAL' ? 'border-red-200 bg-red-50' :
                            alert.severity === 'HIGH' ? 'border-orange-200 bg-orange-50' :
                            alert.severity === 'MEDIUM' ? 'border-yellow-200 bg-yellow-50' :
                            'border-blue-200 bg-blue-50'
                          }>
                            <AlertTriangle className={`h-4 w-4 ${
                              alert.severity === 'CRITICAL' ? 'text-red-600' :
                              alert.severity === 'HIGH' ? 'text-orange-600' :
                              alert.severity === 'MEDIUM' ? 'text-yellow-600' : 'text-blue-600'
                            }`} />
                            <AlertDescription>
                              <div className="space-y-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <strong>{alert.title}</strong>
                                    <p className="text-sm mt-1">{alert.description}</p>
                                  </div>
                                  <Badge className={getSeverityColor(alert.severity)}>
                                    {alert.severity}
                                  </Badge>
                                </div>
                                <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                                  <span>Confidence: {(alert.confidence * 100).toFixed(0)}%</span>
                                  <span>Probability: {(alert.probability * 100).toFixed(0)}%</span>
                                  {alert.costImpact && (
                                    <span>Cost Impact: ${alert.costImpact.toLocaleString()}</span>
                                  )}
                                </div>
                                {alert.recommendedAction && (
                                  <div className="text-sm">
                                    <strong>Recommended Action:</strong> {alert.recommendedAction}
                                  </div>
                                )}
                              </div>
                            </AlertDescription>
                          </Alert>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No active alerts found.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>


            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  )
}