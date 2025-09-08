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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'
import { CalendarIcon, Plus, Edit, Trash2, Search, Filter, Wrench, Clock, DollarSign, AlertTriangle, CheckCircle, XCircle, ClockIcon } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface MaintenanceRecord {
  id: string
  truckId: string
  serviceType: string
  description?: string
  datePerformed: string
  partsCost: number
  laborCost: number
  totalCost: number
  mechanicId?: string
  mechanicName?: string
  nextServiceDue?: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  notes?: string
  attachments?: any[]
  isOilChange: boolean
  oilChangeInterval?: number
  currentMileage?: number
  maintenanceJobId?: string
  wasPredicted: boolean
  predictionId?: string
  downtimeHours?: number
  failureMode?: string
  rootCause?: string
  createdAt: string
  updatedAt: string
  truck?: {
    id: string
    vin: string
    make: string
    model: string
    year: number
    licensePlate: string
    currentMileage: number
  }
}

interface MaintenanceJob {
  id: string
  name: string
  category: string
  parts?: string
  notes?: string
  isActive: boolean
}

interface Truck {
  id: string
  vin: string
  make: string
  model: string
  year: number
  licensePlate: string
  currentMileage: number
  status: string
}

interface Mechanic {
  id: string
  name: string
  specialty?: string
  isActive: boolean
}

interface MaintenanceFormData {
  truckId: string
  serviceType: string
  description?: string
  datePerformed: string
  partsCost: number
  laborCost: number
  mechanicId?: string
  nextServiceDue?: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  notes?: string
  isOilChange: boolean
  oilChangeInterval?: number
  currentMileage?: number
  maintenanceJobId?: string
  downtimeHours?: number
  failureMode?: string
  rootCause?: string
}

export default function MaintenanceTracking() {
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<MaintenanceRecord[]>([])
  const [selectedRecord, setSelectedRecord] = useState<MaintenanceRecord | null>(null)
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [maintenanceJobs, setMaintenanceJobs] = useState<MaintenanceJob[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [truckFilter, setTruckFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState<MaintenanceFormData>({
    truckId: '',
    serviceType: '',
    description: '',
    datePerformed: new Date().toISOString(),
    partsCost: 0,
    laborCost: 0,
    mechanicId: '',
    nextServiceDue: '',
    status: 'SCHEDULED',
    notes: '',
    isOilChange: false,
    oilChangeInterval: undefined,
    currentMileage: undefined,
    maintenanceJobId: '',
    downtimeHours: undefined,
    failureMode: '',
    rootCause: ''
  })

  useEffect(() => {
    fetchMaintenanceRecords()
    fetchTrucks()
    fetchMechanics()
    fetchMaintenanceJobs()
  }, [])

  useEffect(() => {
    filterRecords()
  }, [maintenanceRecords, searchTerm, statusFilter, truckFilter, dateFilter])

  const fetchMaintenanceRecords = async () => {
    try {
      const response = await fetch('/api/maintenance')
      if (response.ok) {
        const data = await response.json()
        setMaintenanceRecords(data.records || [])
      } else {
        // Fallback to mock data if API fails
        const mockRecords: MaintenanceRecord[] = [
        {
          id: '1',
          truckId: '1',
          serviceType: 'Oil Change',
          description: 'Regular oil change and filter replacement',
          datePerformed: '2024-01-15T00:00:00Z',
          partsCost: 30,
          laborCost: 45,
          totalCost: 75,
          mechanicId: '1',
          mechanicName: 'John Doe',
          nextServiceDue: '2024-04-15T00:00:00Z',
          status: 'COMPLETED',
          notes: 'Used synthetic oil 5W-30',
          isOilChange: true,
          oilChangeInterval: 5000,
          currentMileage: 45000,
          wasPredicted: false,
          downtimeHours: 2,
          createdAt: '2024-01-15T00:00:00Z',
          updatedAt: '2024-01-15T00:00:00Z',
          truck: {
            id: '1',
            vin: '1HGCM82633A123456',
            make: 'Honda',
            model: 'Accord',
            year: 2020,
            licensePlate: 'ABC123',
            currentMileage: 45000
          }
        },
        {
          id: '2',
          truckId: '2',
          serviceType: 'Brake Repair',
          description: 'Front brake pad replacement and rotor resurfacing',
          datePerformed: '2024-01-14T00:00:00Z',
          partsCost: 180,
          laborCost: 170,
          totalCost: 350,
          mechanicId: '2',
          mechanicName: 'Jane Smith',
          status: 'COMPLETED',
          notes: 'Replaced with ceramic brake pads',
          isOilChange: false,
          currentMileage: 62000,
          wasPredicted: true,
          predictionId: 'alert-1',
          downtimeHours: 4,
          failureMode: 'Brake Pad Wear',
          rootCause: 'Normal Wear and Tear',
          createdAt: '2024-01-14T00:00:00Z',
          updatedAt: '2024-01-14T00:00:00Z',
          truck: {
            id: '2',
            vin: '2T1BURHE1JC123456',
            make: 'Toyota',
            model: 'Camry',
            year: 2019,
            licensePlate: 'DEF456',
            currentMileage: 62000
          }
        },
        {
          id: '3',
          truckId: '3',
          serviceType: 'Tire Rotation',
          description: 'Regular tire rotation and balance',
          datePerformed: '2024-01-13T00:00:00Z',
          partsCost: 0,
          laborCost: 50,
          totalCost: 50,
          mechanicId: '1',
          mechanicName: 'John Doe',
          status: 'IN_PROGRESS',
          notes: 'All tires rotated and balanced',
          isOilChange: false,
          currentMileage: 78000,
          wasPredicted: false,
          downtimeHours: 1,
          createdAt: '2024-01-13T00:00:00Z',
          updatedAt: '2024-01-13T00:00:00Z',
          truck: {
            id: '3',
            vin: '3FA6P0H72HR123456',
            make: 'Ford',
            model: 'Fusion',
            year: 2018,
            licensePlate: 'GHI789',
            currentMileage: 78000
          }
        },
        {
          id: '4',
          truckId: '1',
          serviceType: 'Engine Tune-up',
          description: 'Scheduled engine tune-up and spark plug replacement',
          datePerformed: '2024-01-20T00:00:00Z',
          partsCost: 120,
          laborCost: 200,
          totalCost: 320,
          status: 'SCHEDULED',
          notes: 'Replace spark plugs and inspect ignition system',
          isOilChange: false,
          currentMileage: 45000,
          wasPredicted: true,
          predictionId: 'alert-2',
          downtimeHours: 3,
          createdAt: '2024-01-10T00:00:00Z',
          updatedAt: '2024-01-10T00:00:00Z',
          truck: {
            id: '1',
            vin: '1HGCM82633A123456',
            make: 'Honda',
            model: 'Accord',
            year: 2020,
            licensePlate: 'ABC123',
            currentMileage: 45000
          }
        }
      ]
      
        setMaintenanceRecords(mockRecords)
      }
      setLoading(false)
    } catch (error) {
      console.error('Error fetching maintenance records:', error)
      setLoading(false)
    }
  }

  const fetchTrucks = async () => {
    try {
      const response = await fetch('/api/trucks')
      if (response.ok) {
        const data = await response.json()
        setTrucks(data.trucks || [])
      } else {
        // Fallback to mock data
        const mockTrucks: Truck[] = [
          { id: '1', vin: '1HGCM82633A123456', make: 'Honda', model: 'Accord', year: 2020, licensePlate: 'ABC123', currentMileage: 45000, status: 'ACTIVE' },
          { id: '2', vin: '2T1BURHE1JC123456', make: 'Toyota', model: 'Camry', year: 2019, licensePlate: 'DEF456', currentMileage: 62000, status: 'MAINTENANCE' },
          { id: '3', vin: '3FA6P0H72HR123456', make: 'Ford', model: 'Fusion', year: 2018, licensePlate: 'GHI789', currentMileage: 78000, status: 'ACTIVE' }
        ]
        setTrucks(mockTrucks)
      }
    } catch (error) {
      console.error('Error fetching trucks:', error)
    }
  }

  const fetchMechanics = async () => {
    try {
      // Mock data
      const mockMechanics: Mechanic[] = [
        { id: '1', name: 'John Doe', specialty: 'Engine Specialist', isActive: true },
        { id: '2', name: 'Jane Smith', specialty: 'Brake Systems', isActive: true },
        { id: '3', name: 'Mike Johnson', specialty: 'General Mechanic', isActive: true }
      ]
      setMechanics(mockMechanics)
    } catch (error) {
      console.error('Error fetching mechanics:', error)
    }
  }

  const fetchMaintenanceJobs = async () => {
    try {
      // Mock data
      const mockJobs: MaintenanceJob[] = [
        { id: '1', name: 'Oil Change', category: 'Preventive', parts: 'Oil filter, engine oil', notes: 'Every 5000 miles', isActive: true },
        { id: '2', name: 'Brake Inspection', category: 'Safety', parts: 'Brake pads, rotors if needed', notes: 'Every 10000 miles', isActive: true },
        { id: '3', name: 'Tire Service', category: 'Preventive', parts: 'Tires if needed', notes: 'Every 6000 miles', isActive: true },
        { id: '4', name: 'Engine Tune-up', category: 'Performance', parts: 'Spark plugs, filters', notes: 'Every 30000 miles', isActive: true }
      ]
      setMaintenanceJobs(mockJobs)
    } catch (error) {
      console.error('Error fetching maintenance jobs:', error)
    }
  }

  const filterRecords = () => {
    let filtered = maintenanceRecords

    if (searchTerm) {
      filtered = filtered.filter(record =>
        record.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.truck?.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.mechanicName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.status === statusFilter)
    }

    if (truckFilter !== 'all') {
      filtered = filtered.filter(record => record.truckId === truckFilter)
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      const filterDate = new Date()
      
      switch (dateFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0)
          filtered = filtered.filter(record => new Date(record.datePerformed) >= filterDate)
          break
        case 'week':
          filterDate.setDate(now.getDate() - 7)
          filtered = filtered.filter(record => new Date(record.datePerformed) >= filterDate)
          break
        case 'month':
          filterDate.setMonth(now.getMonth() - 1)
          filtered = filtered.filter(record => new Date(record.datePerformed) >= filterDate)
          break
      }
    }

    setFilteredRecords(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
      case 'SCHEDULED': return 'bg-yellow-100 text-yellow-800'
      case 'CANCELLED': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4" />
      case 'IN_PROGRESS': return <ClockIcon className="h-4 w-4" />
      case 'SCHEDULED': return <Clock className="h-4 w-4" />
      case 'CANCELLED': return <XCircle className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const handleInputChange = (field: keyof MaintenanceFormData, value: string | number | boolean) => {
    setFormData(prev => {
      // Handle numeric fields
      const numericFields = ['partsCost', 'laborCost', 'downtimeHours', 'currentMileage', 'oilChangeInterval'];
      
      if (numericFields.includes(field)) {
        // Handle different input types
        let numericValue: number | undefined;
        
        if (typeof value === 'string') {
          // Remove any non-numeric characters except decimal point
          const cleanValue = value.replace(/[^\d.-]/g, '');
          if (cleanValue === '') {
            numericValue = undefined;
          } else {
            numericValue = parseFloat(cleanValue);
          }
        } else {
          numericValue = typeof value === 'number' ? value : undefined;
        }
        
        // Ensure it's a valid number if not undefined
        if (numericValue !== undefined && (isNaN(numericValue) || !isFinite(numericValue))) {
          numericValue = undefined;
        }
        
        // Ensure it's not negative
        if (numericValue !== undefined) {
          numericValue = Math.max(0, numericValue);
        }
        
        return {
          ...prev,
          [field]: numericValue
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  }

  const resetForm = () => {
    setFormData({
      truckId: '',
      serviceType: '',
      description: '',
      datePerformed: new Date().toISOString(),
      partsCost: 0,
      laborCost: 0,
      mechanicId: '',
      nextServiceDue: '',
      status: 'SCHEDULED',
      notes: '',
      isOilChange: false,
      oilChangeInterval: undefined,
      currentMileage: undefined,
      maintenanceJobId: '',
      downtimeHours: undefined,
      failureMode: '',
      rootCause: ''
    });
    setIsEditing(false);
    setSelectedRecord(null);
  }

  const handleAddNew = () => {
    resetForm();
    setIsDialogOpen(true);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Calculate total cost
      const totalCost = (formData.partsCost || 0) + (formData.laborCost || 0)
      
      const recordData = {
        ...formData,
        totalCost,
        partsCost: formData.partsCost || 0,
        laborCost: formData.laborCost || 0
      }

      if (isEditing && selectedRecord) {
        // Update record via API
        const response = await fetch(`/api/maintenance/${selectedRecord.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(recordData)
        })
        
        if (response.ok) {
          const updatedRecord = await response.json()
          setMaintenanceRecords(prev => prev.map(r => r.id === selectedRecord.id ? updatedRecord : r))
        } else {
          throw new Error('Failed to update record')
        }
      } else {
        // Create new record via API
        const response = await fetch('/api/maintenance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(recordData)
        })
        
        if (response.ok) {
          const newRecord = await response.json()
          setMaintenanceRecords(prev => [...prev, newRecord])
        } else {
          throw new Error('Failed to create record')
        }
      }
      
      setIsDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Error saving maintenance record:', error)
    }
  }

  const handleEdit = (record: MaintenanceRecord) => {
    setSelectedRecord(record)
    const newFormData = {
      truckId: record.truckId,
      serviceType: record.serviceType,
      description: record.description || '',
      datePerformed: record.datePerformed,
      partsCost: record.partsCost,
      laborCost: record.laborCost,
      mechanicId: record.mechanicId || '',
      nextServiceDue: record.nextServiceDue || '',
      status: record.status,
      notes: record.notes || '',
      isOilChange: record.isOilChange,
      oilChangeInterval: record.oilChangeInterval,
      currentMileage: record.currentMileage,
      maintenanceJobId: record.maintenanceJobId || '',
      downtimeHours: record.downtimeHours,
      failureMode: record.failureMode || '',
      rootCause: record.rootCause || ''
    };
    setFormData(newFormData)
    setIsEditing(true)
    setIsDialogOpen(true)
  }

  const handleDelete = async (recordId: string) => {
    if (confirm('Are you sure you want to delete this maintenance record?')) {
      try {
        const response = await fetch(`/api/maintenance/${recordId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
        
        if (response.ok) {
          setMaintenanceRecords(prev => prev.filter(r => r.id !== recordId))
        } else {
          throw new Error('Failed to delete record')
        }
      } catch (error) {
        console.error('Error deleting maintenance record:', error)
      }
    }
  }

  const calculateTotalCost = () => {
    return maintenanceRecords.reduce((sum, record) => sum + (record.totalCost || 0), 0)
  }

  const calculateAverageCost = () => {
    return maintenanceRecords.length > 0 ? calculateTotalCost() / maintenanceRecords.length : 0
  }

  const calculateMonthlyCost = () => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    return maintenanceRecords
      .filter(record => {
        const recordDate = new Date(record.datePerformed)
        return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear
      })
      .reduce((sum, record) => sum + (record.totalCost || 0), 0)
  }

  const calculateSixMonthCost = () => {
    const now = new Date()
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
    
    return maintenanceRecords
      .filter(record => new Date(record.datePerformed) >= sixMonthsAgo)
      .reduce((sum, record) => sum + (record.totalCost || 0), 0)
  }

  const getUpcomingMaintenance = () => {
    const now = new Date()
    const thirtyDaysFromNow = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000))
    
    return maintenanceRecords.filter(record => {
      if (!record.nextServiceDue) return false
      const dueDate = new Date(record.nextServiceDue)
      return dueDate >= now && dueDate <= thirtyDaysFromNow && record.status !== 'COMPLETED'
    }).length
  }

  const getOverdueMaintenance = () => {
    const now = new Date()
    
    return maintenanceRecords.filter(record => {
      if (!record.nextServiceDue) return false
      const dueDate = new Date(record.nextServiceDue)
      return dueDate < now && record.status !== 'COMPLETED'
    }).length
  }

  const getMaintenanceStats = () => {
    const completed = maintenanceRecords.filter(r => r.status === 'COMPLETED').length
    const inProgress = maintenanceRecords.filter(r => r.status === 'IN_PROGRESS').length
    const scheduled = maintenanceRecords.filter(r => r.status === 'SCHEDULED').length
    const cancelled = maintenanceRecords.filter(r => r.status === 'CANCELLED').length
    const predicted = maintenanceRecords.filter(r => r.wasPredicted).length

    return {
      completed,
      inProgress,
      scheduled,
      cancelled,
      predicted,
      total: maintenanceRecords.length
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const stats = getMaintenanceStats()

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maintenance Tracking</h1>
          <p className="text-muted-foreground">Track and manage all maintenance activities</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (open) {
            // When opening, check if we're adding a new record
            if (!isEditing) {
              resetForm();
            }
          } else {
            setIsDialogOpen(false);
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={(e) => {
              e.preventDefault();
              handleAddNew();
            }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Maintenance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditing ? 'Edit Maintenance Record' : 'Add Maintenance Record'}</DialogTitle>
              <DialogDescription>
                {isEditing ? 'Update maintenance record information' : 'Add a new maintenance record'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="truckId">Truck</Label>
                  <Select value={formData.truckId} onValueChange={(value) => handleInputChange('truckId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select truck" />
                    </SelectTrigger>
                    <SelectContent>
                      {trucks.map((truck) => (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.year} {truck.make} {truck.model} - {truck.licensePlate}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="serviceType">Service Type</Label>
                  <Select value={formData.serviceType} onValueChange={(value) => handleInputChange('serviceType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service type" />
                    </SelectTrigger>
                    <SelectContent>
                      {maintenanceJobs.map((job) => (
                        <SelectItem key={job.id} value={job.name}>
                          {job.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe the maintenance work performed..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="datePerformed">Date Performed</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.datePerformed ? format(new Date(formData.datePerformed), 'PPP') : 'Pick a date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={new Date(formData.datePerformed)}
                        onSelect={(date) => {
                          if (date) {
                            handleInputChange('datePerformed', date.toISOString())
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="partsCost">Parts Cost</Label>
                  <Input
                    id="partsCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.partsCost || 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleInputChange('partsCost', value === '' ? 0 : parseFloat(value));
                    }}
                    onBlur={(e) => {
                      // Ensure the value is a valid number when the user leaves the field
                      const value = parseFloat(e.target.value);
                      if (isNaN(value)) {
                        handleInputChange('partsCost', 0);
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="laborCost">Labor Cost</Label>
                  <Input
                    id="laborCost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.laborCost || 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleInputChange('laborCost', value === '' ? 0 : parseFloat(value));
                    }}
                    onBlur={(e) => {
                      // Ensure the value is a valid number when the user leaves the field
                      const value = parseFloat(e.target.value);
                      if (isNaN(value)) {
                        handleInputChange('laborCost', 0);
                      }
                    }}
                  />
                </div>
                <div>
                  <Label htmlFor="downtimeHours">Downtime (hours)</Label>
                  <Input
                    id="downtimeHours"
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.downtimeHours || 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleInputChange('downtimeHours', value === '' ? undefined : parseFloat(value));
                    }}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value);
                      if (isNaN(value)) {
                        handleInputChange('downtimeHours', undefined);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="mechanicId">Mechanic</Label>
                  <Select value={formData.mechanicId} onValueChange={(value) => handleInputChange('mechanicId', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select mechanic" />
                    </SelectTrigger>
                    <SelectContent>
                      {mechanics.map((mechanic) => (
                        <SelectItem key={mechanic.id} value={mechanic.id}>
                          {mechanic.name} {mechanic.specialty && `(${mechanic.specialty})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="currentMileage">Current Mileage</Label>
                  <Input
                    id="currentMileage"
                    type="number"
                    min="0"
                    value={formData.currentMileage || 0}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleInputChange('currentMileage', value === '' ? undefined : parseInt(value));
                    }}
                    onBlur={(e) => {
                      const value = parseInt(e.target.value);
                      if (isNaN(value)) {
                        handleInputChange('currentMileage', undefined);
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isOilChange"
                    checked={formData.isOilChange}
                    onChange={(e) => handleInputChange('isOilChange', e.target.checked)}
                  />
                  <Label htmlFor="isOilChange">Oil Change</Label>
                </div>
                {formData.isOilChange && (
                  <div>
                    <Label htmlFor="oilChangeInterval">Oil Change Interval (miles)</Label>
                    <Input
                      id="oilChangeInterval"
                      type="number"
                      min="0"
                      value={formData.oilChangeInterval || 0}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleInputChange('oilChangeInterval', value === '' ? undefined : parseInt(value));
                      }}
                      onBlur={(e) => {
                        const value = parseInt(e.target.value);
                        if (isNaN(value)) {
                          handleInputChange('oilChangeInterval', undefined);
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="nextServiceDue">Next Service Due</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.nextServiceDue ? format(new Date(formData.nextServiceDue), 'PPP') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={formData.nextServiceDue ? new Date(formData.nextServiceDue) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          handleInputChange('nextServiceDue', date.toISOString())
                        }
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="failureMode">Failure Mode (if applicable)</Label>
                  <Input
                    id="failureMode"
                    value={formData.failureMode}
                    onChange={(e) => handleInputChange('failureMode', e.target.value)}
                    placeholder="e.g., Brake Pad Wear, Engine Overheating"
                  />
                </div>
                <div>
                  <Label htmlFor="rootCause">Root Cause (if applicable)</Label>
                  <Input
                    id="rootCause"
                    value={formData.rootCause}
                    onChange={(e) => handleInputChange('rootCause', e.target.value)}
                    placeholder="e.g., Normal Wear and Tear, Manufacturing Defect"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Additional notes about the maintenance..."
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? 'Update' : 'Add'} Record
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Enhanced Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trucks</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{trucks.length}</div>
            <p className="text-xs text-muted-foreground">
              {trucks.filter(t => t.status === 'ACTIVE').length} active vehicles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Maintenance</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{getUpcomingMaintenance()}</div>
            <p className="text-xs text-muted-foreground">
              Due within 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Repairs</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{getOverdueMaintenance()}</div>
            <p className="text-xs text-muted-foreground">
              Require immediate attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Maintenance Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(calculateMonthlyCost())}</div>
            <p className="text-xs text-muted-foreground">
              Average monthly cost
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost (6mo)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(calculateSixMonthCost())}</div>
            <p className="text-xs text-muted-foreground">
              Last 6 months
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Original Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Records</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              Maintenance records
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <ClockIcon className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.inProgress}</div>
            <p className="text-xs text-muted-foreground">
              Currently being serviced
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predictive</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.predicted}</div>
            <p className="text-xs text-muted-foreground">
              AI-predicted maintenance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(calculateTotalCost())}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(calculateAverageCost())} per record
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex space-x-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search by service type, description, truck, or mechanic..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={truckFilter} onValueChange={setTruckFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Truck" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trucks</SelectItem>
                {trucks.map((truck) => (
                  <SelectItem key={truck.id} value={truck.id}>
                    {truck.licensePlate}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-40">
                <Calendar className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Dates</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Records</CardTitle>
          <CardDescription>
            Showing {filteredRecords.length} maintenance record{filteredRecords.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Mechanic</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <div className="font-medium">{format(new Date(record.datePerformed), 'MMM dd')}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(record.datePerformed), 'yyyy')}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs">
                        <div className="flex items-center space-x-2">
                          {record.isOilChange && <span className="text-lg">🛢️</span>}
                          <span className="font-medium truncate">{record.serviceType}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {record.description ? (
                            <div className="truncate max-w-xs" title={record.description}>
                              {record.description.split(',').slice(0, 2).join(', ')}
                              {record.description.split(',').length > 2 && '...'}
                            </div>
                          ) : (
                            <span className="text-gray-400">No description</span>
                          )}
                        </div>
                        {record.wasPredicted && (
                          <Badge variant="outline" className="text-xs mt-1">
                            AI Predicted
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {record.truck?.year} {record.truck?.make}
                        </div>
                        <div className="text-sm font-mono text-muted-foreground">
                          {record.truck?.licensePlate}
                        </div>
                        {record.currentMileage && (
                          <div className="text-xs text-muted-foreground">
                            {record.currentMileage?.toLocaleString() || '0'} mi
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{record.mechanicName || 'None'}</div>
                        {record.downtimeHours && (
                          <div className="text-sm text-muted-foreground flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {record.downtimeHours}h
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatCurrency(record.totalCost || 0)}</div>
                      {(record.partsCost > 0 || record.laborCost > 0) && (
                        <div className="text-xs text-muted-foreground">
                          P: {formatCurrency(record.partsCost || 0)} + L: {formatCurrency(record.laborCost || 0)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(record.status)}
                        <Badge className={getStatusColor(record.status)} variant="secondary">
                          {record.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(record)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(record.id)} title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {filteredRecords.length === 0 && (
            <div className="text-center py-8">
              <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No maintenance records found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || statusFilter !== 'all' || truckFilter !== 'all' || dateFilter !== 'all'
                  ? 'Try adjusting your filters to see more records.'
                  : 'Get started by adding your first maintenance record.'}
              </p>
              <Button onClick={handleAddNew}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Record
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Maintenance Detail View */}
      {selectedRecord && (
        <Card>
          <CardHeader>
            <CardTitle>Maintenance Record Details</CardTitle>
            <CardDescription>
              {selectedRecord.serviceType} - {selectedRecord.truck?.licensePlate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="analysis">Analysis</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Service Type:</span>
                        <span className="text-sm font-medium">{selectedRecord.serviceType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        <Badge className={getStatusColor(selectedRecord.status)}>
                          {selectedRecord.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Date Performed:</span>
                        <span className="text-sm font-medium">
                          {format(new Date(selectedRecord.datePerformed), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Mechanic:</span>
                        <span className="text-sm font-medium">{selectedRecord.mechanicName || 'Unassigned'}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Cost Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Parts Cost:</span>
                        <span className="text-sm font-medium">{formatCurrency(selectedRecord.partsCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Labor Cost:</span>
                        <span className="text-sm font-medium">{formatCurrency(selectedRecord.laborCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Total Cost:</span>
                        <span className="text-sm font-medium">{formatCurrency(selectedRecord.totalCost)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Downtime:</span>
                        <span className="text-sm font-medium">{selectedRecord.downtimeHours || 0} hours</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium">Vehicle Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">License Plate:</span>
                        <span className="text-sm font-medium">{selectedRecord.truck?.licensePlate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Vehicle:</span>
                        <span className="text-sm font-medium">
                          {selectedRecord.truck?.year} {selectedRecord.truck?.make} {selectedRecord.truck?.model}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Mileage:</span>
                        <span className="text-sm font-medium">
                          {selectedRecord.currentMileage?.toLocaleString() || 'N/A'} mi
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Next Service:</span>
                        <span className="text-sm font-medium">
                          {selectedRecord.nextServiceDue ? 
                            format(new Date(selectedRecord.nextServiceDue), 'MMM dd, yyyy') : 
                            'Not scheduled'
                          }
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedRecord.description && (
                      <div>
                        <h4 className="font-medium mb-2">Description</h4>
                        <p className="text-sm text-muted-foreground">{selectedRecord.description}</p>
                      </div>
                    )}
                    
                    {selectedRecord.notes && (
                      <div>
                        <h4 className="font-medium mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground">{selectedRecord.notes}</p>
                      </div>
                    )}

                    {selectedRecord.isOilChange && (
                      <div>
                        <h4 className="font-medium mb-2">Oil Change Details</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Oil Change Interval:</span>
                            <span className="ml-2 font-medium">
                              {selectedRecord.oilChangeInterval?.toLocaleString() || 'N/A'} miles
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRecord.failureMode && (
                      <div>
                        <h4 className="font-medium mb-2">Failure Analysis</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Failure Mode:</span>
                            <span className="ml-2 font-medium">{selectedRecord.failureMode}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Root Cause:</span>
                            <span className="ml-2 font-medium">{selectedRecord.rootCause || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-medium mb-2">Predictive Information</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Was Predicted:</span>
                          <span className="ml-2 font-medium">{selectedRecord.wasPredicted ? 'Yes' : 'No'}</span>
                        </div>
                        {selectedRecord.wasPredicted && (
                          <div>
                            <span className="text-muted-foreground">Prediction ID:</span>
                            <span className="ml-2 font-medium">{selectedRecord.predictionId || 'N/A'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Maintenance Analysis</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium mb-2">Cost Analysis</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Parts Cost Percentage:</span>
                            <span className="font-medium">
                              {((selectedRecord.partsCost / selectedRecord.totalCost) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Labor Cost Percentage:</span>
                            <span className="font-medium">
                              {((selectedRecord.laborCost / selectedRecord.totalCost) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Cost per Hour:</span>
                            <span className="font-medium">
                              {selectedRecord.downtimeHours ? formatCurrency(selectedRecord.totalCost / selectedRecord.downtimeHours) : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Efficiency Metrics</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Downtime Impact:</span>
                            <span className="font-medium">
                              {selectedRecord.downtimeHours ? `${selectedRecord.downtimeHours} hours` : 'N/A'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Predictive Success:</span>
                            <span className="font-medium">
                              {selectedRecord.wasPredicted ? 'Successful' : 'Not Applicable'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Maintenance Type:</span>
                            <span className="font-medium">
                              {selectedRecord.isOilChange ? 'Preventive' : 
                               selectedRecord.failureMode ? 'Corrective' : 'Scheduled'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedRecord.wasPredicted && (
                      <div>
                        <h4 className="font-medium mb-2">Predictive Maintenance Insights</h4>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm text-blue-800">
                            This maintenance was predicted by the AI system, demonstrating the effectiveness of 
                            predictive maintenance in preventing failures and optimizing maintenance schedules.
                          </p>
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-medium mb-2">Recommendations</h4>
                      <div className="space-y-2">
                        {selectedRecord.status === 'COMPLETED' && (
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-sm text-green-800">
                              ✓ Maintenance completed successfully. Consider scheduling the next service 
                              based on the recommended interval.
                            </p>
                          </div>
                        )}
                        {selectedRecord.status === 'IN_PROGRESS' && (
                          <div className="bg-yellow-50 p-3 rounded-lg">
                            <p className="text-sm text-yellow-800">
                              ⚠ Maintenance in progress. Monitor completion and update records when finished.
                            </p>
                          </div>
                        )}
                        {selectedRecord.status === 'SCHEDULED' && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-sm text-blue-800">
                              📅 Maintenance scheduled. Ensure all required parts and resources are available.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
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