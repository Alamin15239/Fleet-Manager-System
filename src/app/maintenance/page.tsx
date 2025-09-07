'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { format } from 'date-fns'
import { Wrench, Plus, Edit, Eye, Calendar as CalendarIcon, Truck, Trash2, BookOpen, AlertTriangle, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, type CurrencySettings } from '@/lib/currency'
import { CurrencyInput } from '@/components/ui/currency-input'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { MaintenanceJobSelector } from '@/components/maintenance-job-selector'
import { useLanguage } from '@/contexts/language-context'
import { PageHeader } from '@/components/page-header'

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
}

interface Trailer {
  id: string
  number: string
  status: string
  driverName?: string
}

interface Vehicle {
  id: string
  type: 'truck' | 'trailer'
  displayName: string
  identifier: string
}

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
  mechanic?: {
    id: string
    name: string
    email: string
  }
  nextServiceDue?: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  notes?: string
  isOilChange?: boolean
  oilChangeInterval?: number
  currentMileage?: number
  maintenanceJobId?: string
  maintenanceJob?: MaintenanceJob
  createdAt: string
  updatedAt: string
  truck: Truck
}

interface Mechanic {
  id: string
  name: string
  email: string
}

interface DashboardStats {
  totalTrucks: number
  activeTrucks: number
  upcomingMaintenance: number
  overdueRepairs: number
  totalMaintenanceCost: number
}

export default function MaintenancePage() {
  const { t } = useLanguage()
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([])
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [trailers, setTrailers] = useState<Trailer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [currencySettings, setCurrencySettings] = useState<CurrencySettings | null>(null)
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({
    totalTrucks: 0,
    activeTrucks: 0,
    upcomingMaintenance: 0,
    overdueRepairs: 0,
    totalMaintenanceCost: 0
  })
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [editingRecord, setEditingRecord] = useState<MaintenanceRecord | null>(null)
  const [viewingRecord, setViewingRecord] = useState<MaintenanceRecord | null>(null)
  const [selectedJob, setSelectedJob] = useState<MaintenanceJob | null>(null)
  
  const [formData, setFormData] = useState({
    truckId: '',
    serviceType: '',
    description: '',
    datePerformed: new Date().toISOString().split('T')[0],
    partsCost: 0,
    laborCost: 0,
    mechanicId: 'none',
    nextServiceDue: '',
    status: 'SCHEDULED' as const,
    notes: '',
    isOilChange: false,
    oilChangeInterval: 5000, // Default 5000 km
    currentMileage: 0,
    maintenanceJobId: '',
    driverName: ''
  })

  const [vehicleSearch, setVehicleSearch] = useState('')
  const [mechanicSearch, setMechanicSearch] = useState('')
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const [showMechanicDropdown, setShowMechanicDropdown] = useState(false)
  
  const vehicleDropdownRef = useRef<HTMLDivElement>(null)
  const mechanicDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchDashboardStats()
    fetchMaintenanceRecords()
    fetchTrucks()
    fetchTrailers()
    fetchMechanics()
    fetchCurrencySettings()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (vehicleDropdownRef.current && !vehicleDropdownRef.current.contains(event.target as Node)) {
        setShowVehicleDropdown(false)
      }
      if (mechanicDropdownRef.current && !mechanicDropdownRef.current.contains(event.target as Node)) {
        setShowMechanicDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const combinedVehicles: Vehicle[] = [
      ...trucks.filter(truck => truck && truck.id).map(truck => ({
        id: truck.id,
        type: 'truck' as const,
        displayName: `${truck.year} ${truck.make} ${truck.model}`,
        identifier: truck.licensePlate
      })),
      ...trailers.filter(trailer => trailer && trailer.id).map(trailer => ({
        id: trailer.id,
        type: 'trailer' as const,
        displayName: `Trailer ${trailer.number}`,
        identifier: trailer.driverName || 'No driver'
      }))
    ]
    console.log('Vehicles loaded:', { trucks: trucks.length, trailers: trailers.length, total: combinedVehicles.length })
    setVehicles(combinedVehicles)
  }, [trucks, trailers])

  const fetchDashboardStats = async () => {
    try {
      const response = await apiGet('/api/dashboard/stats')
      if (response.ok) {
        const data = await response.json()
        setDashboardStats({
          totalTrucks: data.totalTrucks || 0,
          activeTrucks: data.activeTrucks || 0,
          upcomingMaintenance: data.upcomingMaintenance || 0,
          overdueRepairs: data.overdueRepairs || 0,
          totalMaintenanceCost: data.totalMaintenanceCost || 0
        })
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    }
  }

  const fetchCurrencySettings = async () => {
    try {
      const response = await fetch('/api/settings/public')
      if (response.ok) {
        const data = await response.json()
        const settings: CurrencySettings = {
          currencySymbol: data.currencySymbol,
          currencyCode: data.currencyCode,
          currencyName: data.currencyName,
          decimalPlaces: data.decimalPlaces,
          thousandsSeparator: data.thousandsSeparator,
          decimalSeparator: data.decimalSeparator,
          symbolPosition: data.symbolPosition
        }
        setCurrencySettings(settings)
      }
    } catch (error) {
      console.error('Error fetching currency settings:', error)
    }
  }

  const fetchMaintenanceRecords = async () => {
    try {
      const response = await apiGet('/api/maintenance')
      if (response.ok) {
        const data = await response.json()
        // API returns { success: true, data: records, pagination: ... }
        setMaintenanceRecords(data.data || [])
        // Also refresh dashboard stats to ensure consistency
        fetchDashboardStats()
      } else {
        toast.error('Failed to fetch maintenance records')
      }
    } catch (error) {
      console.error('Error fetching maintenance records:', error)
      toast.error('Failed to fetch maintenance records')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrucks = async () => {
    try {
      const response = await apiGet('/api/trucks?limit=10000')
      if (response.ok) {
        const data = await response.json()
        setTrucks(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching trucks:', error)
    }
  }

  const fetchTrailers = async () => {
    try {
      const response = await apiGet('/api/trailers?limit=10000')
      if (response.ok) {
        const data = await response.json()
        setTrailers(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching trailers:', error)
    }
  }

  const fetchMechanics = async () => {
    try {
      const response = await apiGet('/api/mechanics')
      if (response.ok) {
        const data = await response.json()
        setMechanics(data)
      } else {
        // If no mechanics endpoint or no mechanics, set empty array
        setMechanics([])
      }
    } catch (error) {
      console.error('Error fetching mechanics:', error)
      setMechanics([]) // Don't show error for mechanics as it's optional
    }
  }

  const formatCurrencyWithSettings = (amount: number): string => {
    if (!currencySettings) return amount.toString()
    return formatCurrency(amount, currencySettings)
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

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'Brakes': 'bg-red-100 text-red-800',
      'Electrical': 'bg-yellow-100 text-yellow-800',
      'Suspension': 'bg-blue-100 text-blue-800',
      'Engine': 'bg-green-100 text-green-800',
      'Drivetrain': 'bg-purple-100 text-purple-800',
      'Transmission': 'bg-indigo-100 text-indigo-800',
      'Tires': 'bg-orange-100 text-orange-800',
      'Exhaust': 'bg-gray-100 text-gray-800',
      'HVAC': 'bg-cyan-100 text-cyan-800',
      'Fuel System': 'bg-amber-100 text-amber-800',
      'Body': 'bg-teal-100 text-teal-800',
      'Interior': 'bg-pink-100 text-pink-800',
      'Steering': 'bg-lime-100 text-lime-800',
      'Trailer': 'bg-emerald-100 text-emerald-800',
      'Cooling': 'bg-sky-100 text-sky-800',
      'Preventive': 'bg-lavender-100 text-lavender-800',
      'Welding': 'bg-rose-100 text-rose-800',
      'Hydraulics': 'bg-fuchsia-100 text-fuchsia-800',
      'General': 'bg-slate-100 text-slate-800',
      'Tanker Trailer': 'bg-violet-100 text-violet-800',
      'Trailer Body': 'bg-purple-100 text-purple-800',
      'Trailer Coupling': 'bg-fuchsia-100 text-fuchsia-800',
      'Cooling/Heating': 'bg-sky-100 text-sky-800',
      'Recovery/Equipment': 'bg-rose-100 text-rose-800',
      'Tires/Suspension': 'bg-mint-100 text-mint-800',
      'Welding/Coupling': 'bg-salmon-100 text-salmon-800'
    }
    return colors[category] || 'bg-gray-100 text-gray-800'
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const totalCost = (formData.partsCost || 0) + (formData.laborCost || 0)
      
      // Calculate next service due date for oil changes
      let nextServiceDue = formData.nextServiceDue
      if (formData.isOilChange && formData.currentMileage && formData.oilChangeInterval) {
        const nextOilChangeMileage = formData.currentMileage + formData.oilChangeInterval
        const nextOilChangeDate = new Date()
        nextOilChangeDate.setDate(nextOilChangeDate.getDate() + 90) // Estimate 90 days for oil change interval
        nextServiceDue = nextOilChangeDate.toISOString().split('T')[0]
      }
      
      // Get current user ID from API
      let currentUserId = null
      try {
        const userResponse = await apiGet('/api/auth/me')
        if (userResponse.ok) {
          const userData = await userResponse.json()
          currentUserId = userData.user?.id || userData.id
        }
      } catch (e) {
        console.error('Error getting current user:', e)
      }
      
      const payload = {
        ...formData,
        mechanicId: formData.mechanicId === "none" ? null : formData.mechanicId,
        createdById: currentUserId,
        totalCost,
        nextServiceDue
      }
      
      const url = editingRecord ? `/api/maintenance/${editingRecord.id}` : '/api/maintenance'
      const method = editingRecord ? apiPut : apiPost
      
      const response = await method(url, payload)

      if (response.ok) {
        if (editingRecord) {
          toast.success(t('message.success'))
        } else {
          toast.success(t('message.success'))
          if (formData.isOilChange) {
            toast.info('Next oil change date has been calculated and set')
          }
        }
        setIsDialogOpen(false)
        resetForm()
        fetchMaintenanceRecords() // Refresh the list
      } else {
        let errorMessage = 'Failed to save maintenance record'
        try {
          const responseClone = response.clone()
          const text = await responseClone.text()
          if (text && !text.startsWith('<!DOCTYPE')) {
            const errorData = JSON.parse(text)
            errorMessage = errorData.error || errorMessage
          }
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error saving maintenance record:', error)
      toast.error('Failed to save maintenance record')
    }
  }

  const handleEdit = (record: MaintenanceRecord) => {
    if (!record || !record.id) return;
    
    setEditingRecord(record)
    setSelectedJob(record.maintenanceJob || null)
    
    const selectedVehicle = Array.isArray(vehicles) ? vehicles.find(v => v && v.id && v.id === record.truckId) : null
    const selectedMechanic = Array.isArray(mechanics) ? mechanics.find(m => m && m.id && m.id === record.mechanicId) : null
    
    setVehicleSearch(selectedVehicle ? `${selectedVehicle.displayName || ''} - ${selectedVehicle.identifier || ''}` : '')
    setMechanicSearch(selectedMechanic ? `${selectedMechanic.name || ''} - ${selectedMechanic.email || ''}` : record.mechanicId === 'none' ? 'No mechanic' : '')
    
    const driverName = selectedVehicle?.type === 'truck' 
      ? (Array.isArray(trucks) ? trucks.find(t => t && t.id && t.id === selectedVehicle.id)?.driverName || '' : '')
      : (Array.isArray(trailers) ? trailers.find(t => t && t.id && t.id === selectedVehicle.id)?.driverName || '' : '')
    
    setFormData({
      truckId: record.truckId || '',
      serviceType: record.serviceType || '',
      description: record.description || '',
      datePerformed: record.datePerformed || new Date().toISOString().split('T')[0],
      partsCost: typeof record.partsCost === 'number' ? record.partsCost : 0,
      laborCost: typeof record.laborCost === 'number' ? record.laborCost : 0,
      mechanicId: record.mechanicId || 'none',
      nextServiceDue: record.nextServiceDue || '',
      status: record.status || 'SCHEDULED',
      notes: record.notes || '',
      isOilChange: record.isOilChange || false,
      oilChangeInterval: record.oilChangeInterval || 5000,
      currentMileage: record.currentMileage || 0,
      maintenanceJobId: record.maintenanceJobId || '',
      driverName
    })
    setIsDialogOpen(true)
  }

  const handleJobSelect = (job: MaintenanceJob) => {
    setSelectedJob(job)
    setFormData({
      ...formData,
      serviceType: job.name,
      description: job.parts || '',
      maintenanceJobId: job.id
    })
  }

  const handleView = (record: MaintenanceRecord) => {
    setViewingRecord(record)
    setIsViewDialogOpen(true)
  }

  const resetForm = () => {
    setEditingRecord(null)
    setViewingRecord(null)
    setSelectedJob(null)
    setVehicleSearch('')
    setMechanicSearch('')
    setShowVehicleDropdown(false)
    setShowMechanicDropdown(false)
    setFormData({
      truckId: '',
      serviceType: '',
      description: '',
      datePerformed: new Date().toISOString().split('T')[0],
      partsCost: 0,
      laborCost: 0,
      mechanicId: 'none',
      nextServiceDue: '',
      status: 'SCHEDULED',
      notes: '',
      isOilChange: false,
      oilChangeInterval: 5000,
      currentMileage: 0,
      maintenanceJobId: '',
      driverName: ''
    })
  }

  const handleDelete = async (recordId: string) => {
    if (confirm(t('message.deleteConfirm'))) {
      try {
        const response = await apiDelete(`/api/maintenance/${recordId}`)

        if (response.ok) {
          toast.success(t('message.success'))
          fetchMaintenanceRecords() // Refresh the list
        } else {
          const errorData = await response.json()
          toast.error(errorData.error || 'Failed to delete maintenance record')
        }
      } catch (error) {
        console.error('Error deleting maintenance record:', error)
        toast.error('Failed to delete maintenance record')
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
      <PageHeader 
        titleKey="maintenance.title" 
        subtitleKey="maintenance.subtitle"
      >
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              {t('maintenance.addRecord')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingRecord ? t('maintenance.editMaintenance') : t('maintenance.addMaintenance')}
              </DialogTitle>
              <DialogDescription>
                {editingRecord ? t('maintenance.updateDetails') : t('maintenance.mechanicDetails')}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vehicleId" className="text-right">
                  Vehicle
                </Label>
                <div className="col-span-3 relative" ref={vehicleDropdownRef}>
                  <Input
                    placeholder="Search vehicles..."
                    value={vehicleSearch}
                    onChange={(e) => setVehicleSearch(e.target.value)}
                    onFocus={() => setShowVehicleDropdown(true)}
                    className="w-full"
                  />
                  {showVehicleDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {vehicleSearch === '' ? (
                        vehicles.map((vehicle) => {
                          if (!vehicle || !vehicle.id) return null;
                          const driverInfo = vehicle.type === 'truck' 
                            ? trucks.find(t => t && t.id === vehicle.id)?.driverName
                            : trailers.find(t => t && t.id === vehicle.id)?.driverName
                          return (
                            <div
                              key={vehicle.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                setFormData({...formData, truckId: vehicle.id, driverName: driverInfo || ''})
                                setVehicleSearch(`${vehicle.displayName} - ${vehicle.identifier}${driverInfo ? ` (${driverInfo})` : ''}`)
                                setShowVehicleDropdown(false)
                              }}
                            >
                              {vehicle.type === 'truck' ? '🚛' : '🚚'} {vehicle.displayName} - {vehicle.identifier}
                              {driverInfo && <span className="text-gray-500 ml-2">({driverInfo})</span>}
                            </div>
                          )
                        }).filter(Boolean)
                      ) : (
                        vehicles
                          .filter(vehicle => 
                            vehicle && vehicle.id &&
                            (vehicle.displayName?.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
                            vehicle.identifier?.toLowerCase().includes(vehicleSearch.toLowerCase()))
                          )
                          .map((vehicle) => {
                            if (!vehicle || !vehicle.id) return null;
                            const driverInfo = vehicle.type === 'truck' 
                              ? trucks.find(t => t && t.id === vehicle.id)?.driverName
                              : trailers.find(t => t && t.id === vehicle.id)?.driverName
                            return (
                              <div
                                key={vehicle.id}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() => {
                                  setFormData({...formData, truckId: vehicle.id, driverName: driverInfo || ''})
                                  setVehicleSearch(`${vehicle.displayName} - ${vehicle.identifier}${driverInfo ? ` (${driverInfo})` : ''}`)
                                  setShowVehicleDropdown(false)
                                }}
                              >
                                {vehicle.type === 'truck' ? '🚛' : '🚚'} {vehicle.displayName} - {vehicle.identifier}
                                {driverInfo && <span className="text-gray-500 ml-2">({driverInfo})</span>}
                              </div>
                            )
                          }).filter(Boolean)
                      )}
                      {vehicleSearch !== '' && vehicles.filter(vehicle => 
                        vehicle.displayName.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
                        vehicle.identifier.toLowerCase().includes(vehicleSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="px-3 py-2 text-gray-500">No vehicles found</div>
                      )}
                      {vehicles.length === 0 && (
                        <div className="px-3 py-2 text-gray-500">No vehicles available</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">
                  {t('maintenance.serviceType')}
                </Label>
                <div className="col-span-3 space-y-2">
                  <MaintenanceJobSelector
                    onSelectJob={handleJobSelect}
                    selectedJob={selectedJob}
                  >
                    <Button variant="outline" className="w-full justify-start">
                      <BookOpen className="h-4 w-4 mr-2" />
                      {selectedJob ? selectedJob.name : t('maintenance.selectJob')}
                    </Button>
                  </MaintenanceJobSelector>
                  <Input
                    id="serviceType"
                    value={formData.serviceType}
                    onChange={(e) => setFormData({...formData, serviceType: e.target.value})}
                    placeholder={t('maintenance.customServiceType')}
                    className="w-full"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="isOilChange" className="text-right">
                  {t('maintenance.oilChangeService')}
                </Label>
                <div className="flex items-center space-x-2 col-span-3">
                  <input
                    type="checkbox"
                    id="isOilChange"
                    checked={formData.isOilChange}
                    onChange={(e) => setFormData({...formData, isOilChange: e.target.checked})}
                    className="rounded"
                  />
                  <Label htmlFor="isOilChange">{t('maintenance.isOilChange')}</Label>
                </div>
              </div>
              
              {formData.isOilChange && (
                <>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="oilChangeInterval" className="text-right">
                      {t('maintenance.oilChangeInterval')}
                    </Label>
                    <Input
                      id="oilChangeInterval"
                      type="number"
                      value={formData.oilChangeInterval}
                      onChange={(e) => setFormData({...formData, oilChangeInterval: parseInt(e.target.value) || 5000})}
                      className="col-span-3"
                      step="1000"
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="currentMileage" className="text-right">
                      {t('maintenance.currentMileage')}
                    </Label>
                    <Input
                      id="currentMileage"
                      type="number"
                      value={formData.currentMileage}
                      onChange={(e) => setFormData({...formData, currentMileage: parseInt(e.target.value) || 0})}
                      className="col-span-3"
                    />
                  </div>
                </>
              )}
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  {t('form.description')}
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="col-span-3"
                  rows={2}
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="datePerformed" className="text-right">
                  {t('maintenance.datePerformed')}
                </Label>
                <Input
                  id="datePerformed"
                  type="date"
                  value={formData.datePerformed}
                  onChange={(e) => setFormData({...formData, datePerformed: e.target.value})}
                  className="col-span-3"
                  required
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="mechanicId" className="text-right">
                  {t('maintenance.mechanic')}
                </Label>
                <div className="col-span-3 relative" ref={mechanicDropdownRef}>
                  <Input
                    placeholder="Search mechanics..."
                    value={mechanicSearch}
                    onChange={(e) => setMechanicSearch(e.target.value)}
                    onFocus={() => setShowMechanicDropdown(true)}
                    className="w-full"
                  />
                  {showMechanicDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      <div
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => {
                          setFormData({...formData, mechanicId: 'none'})
                          setMechanicSearch('No mechanic')
                          setShowMechanicDropdown(false)
                        }}
                      >
                        {t('maintenance.noMechanic')}
                      </div>
                      {mechanics
                        .filter(mechanic => 
                          mechanic && mechanic.id &&
                          (mechanic.name?.toLowerCase().includes(mechanicSearch.toLowerCase()) ||
                          mechanic.email?.toLowerCase().includes(mechanicSearch.toLowerCase()))
                        )
                        .map((mechanic) => {
                          if (!mechanic || !mechanic.id) return null;
                          return (
                            <div
                              key={mechanic.id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => {
                                setFormData({...formData, mechanicId: mechanic.id})
                                setMechanicSearch(`${mechanic.name} - ${mechanic.email}`)
                                setShowMechanicDropdown(false)
                              }}
                            >
                              {mechanic.name} - {mechanic.email}
                            </div>
                          )
                        }).filter(Boolean)
                      }
                      {mechanics.filter(mechanic => 
                        mechanic.name.toLowerCase().includes(mechanicSearch.toLowerCase()) ||
                        mechanic.email.toLowerCase().includes(mechanicSearch.toLowerCase())
                      ).length === 0 && mechanicSearch !== '' && (
                        <div className="px-3 py-2 text-gray-500">No mechanics found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="partsCost" className="text-right">
                  {t('maintenance.partsCost')}
                </Label>
                <div className="col-span-3">
                  <CurrencyInput
                    id="partsCost"
                    value={formData.partsCost}
                    onChange={(value) => {
                      console.log('Parts cost changed:', { value, formData: formData.partsCost })
                      setFormData({...formData, partsCost: value})
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="laborCost" className="text-right">
                  {t('maintenance.laborCost')}
                </Label>
                <div className="col-span-3">
                  <CurrencyInput
                    id="laborCost"
                    value={formData.laborCost}
                    onChange={(value) => {
                      console.log('Labor cost changed:', { value, formData: formData.laborCost })
                      setFormData({...formData, laborCost: value})
                    }}
                    placeholder="0.00"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="nextServiceDue" className="text-right">
                  {t('maintenance.nextServiceDue')}
                </Label>
                <Input
                  id="nextServiceDue"
                  type="date"
                  value={formData.nextServiceDue}
                  onChange={(e) => setFormData({...formData, nextServiceDue: e.target.value})}
                  className="col-span-3"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="status" className="text-right">
                  {t('table.status')}
                </Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value as any})}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder={t('placeholder.selectStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">{t('status.scheduled')}</SelectItem>
                    <SelectItem value="IN_PROGRESS">{t('status.inProgress')}</SelectItem>
                    <SelectItem value="COMPLETED">{t('status.completed')}</SelectItem>
                    <SelectItem value="CANCELLED">{t('status.cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="driverName" className="text-right">
                  Driver Name
                </Label>
                <Input
                  id="driverName"
                  value={formData.driverName}
                  onChange={(e) => setFormData({...formData, driverName: e.target.value})}
                  placeholder="Driver name (auto-filled from vehicle)"
                  className="col-span-3"
                  readOnly
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="notes" className="text-right">
                  {t('form.notes')}
                </Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  className="col-span-3"
                  rows={3}
                />
              </div>
              
              <DialogFooter>
                <Button type="submit">
                  {editingRecord ? t('maintenance.updateMaintenance') : t('maintenance.addRecord')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalTrucks')}</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.totalTrucks}</div>
            <p className="text-xs text-muted-foreground">
              {dashboardStats.activeTrucks} {t('dashboard.activeTrucks')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.upcomingMaintenance')}</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboardStats.upcomingMaintenance}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.dueWithin30Days')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.overdueRepairs')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{dashboardStats.overdueRepairs}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.requireAttention')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.monthlyMaintenanceCost')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${(dashboardStats.totalMaintenanceCost / 6).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.averageMonthlyCost')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboard.totalCost6mo')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${dashboardStats.totalMaintenanceCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.last6Months')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('maintenance.maintenanceDetails')}</DialogTitle>
            <DialogDescription>
              {t('maintenance.completeInformation')}
            </DialogDescription>
          </DialogHeader>
          {viewingRecord && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('maintenance.truck')}</Label>
                  <p className="text-lg font-semibold">
                    {viewingRecord.truck?.year} {viewingRecord.truck?.make} {viewingRecord.truck?.model}
                  </p>
                  <p className="text-sm text-gray-600">{viewingRecord.truck?.licensePlate}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('maintenance.serviceType')}</Label>
                  <p className="text-lg font-semibold">{viewingRecord.serviceType}</p>
                  {viewingRecord.isOilChange && (
                    <Badge variant="secondary" className="mt-1">
                      {t('maintenance.oilChange')}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('maintenance.datePerformed')}</Label>
                  <p className="text-lg">{new Date(viewingRecord.datePerformed).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('table.status')}</Label>
                  <Badge className={getStatusColor(viewingRecord.status)}>
                    {viewingRecord.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {viewingRecord.mechanic && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('maintenance.mechanic')}</Label>
                  <p className="text-lg">{viewingRecord.mechanic.name}</p>
                  <p className="text-sm text-gray-600">{viewingRecord.mechanic.email}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('maintenance.partsCost')}</Label>
                  <p className="text-lg font-semibold">{formatCurrencyWithSettings(viewingRecord.partsCost)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('maintenance.laborCost')}</Label>
                  <p className="text-lg font-semibold">{formatCurrencyWithSettings(viewingRecord.laborCost)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('table.cost')}</Label>
                  <p className="text-lg font-semibold text-green-600">{formatCurrencyWithSettings(viewingRecord.totalCost)}</p>
                </div>
              </div>

              {viewingRecord.isOilChange && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{t('maintenance.oilChangeInterval')}</Label>
                    <p className="text-lg">{viewingRecord.oilChangeInterval || 5000} km</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">{t('maintenance.currentMileage')}</Label>
                    <p className="text-lg">{viewingRecord.currentMileage || 0} km</p>
                  </div>
                </div>
              )}

              {viewingRecord.nextServiceDue && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('maintenance.nextServiceDue')}</Label>
                  <p className="text-lg">{new Date(viewingRecord.nextServiceDue).toLocaleDateString()}</p>
                </div>
              )}

              {viewingRecord.description && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('form.description')}</Label>
                  <p className="text-sm mt-1">{viewingRecord.description}</p>
                </div>
              )}

              {viewingRecord.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('form.notes')}</Label>
                  <p className="text-sm mt-1">{viewingRecord.notes}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-500">
                <div>
                  <Label>{t('maintenance.created')}</Label>
                  <p>{new Date(viewingRecord.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label>{t('maintenance.lastUpdated')}</Label>
                  <p>{new Date(viewingRecord.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              {t('action.close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance Records Table */}
      <Card>
        <CardHeader>
          <CardTitle>Maintenance Records</CardTitle>
          <CardDescription>
            Showing {maintenanceRecords.length} maintenance records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-48">Service</TableHead>
                  <TableHead className="w-32">Vehicle</TableHead>
                  <TableHead className="w-24">Mechanic</TableHead>
                  <TableHead className="w-20">Cost</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenanceRecords.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="text-sm">
                      {format(new Date(record.datePerformed), 'MMM dd')}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-48">
                        <div className="font-medium text-sm truncate">{record.serviceType}</div>
                        {record.isOilChange && (
                          <span className="text-xs text-blue-600">🛢️ Oil Change</span>
                        )}
                        {record.maintenanceJob && (
                          <div className="text-xs text-gray-500 truncate">{record.maintenanceJob.category}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium truncate">
                          {record.truck ? `${record.truck.year} ${record.truck.make}` : 'Trailer'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {record.truck?.licensePlate || 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.mechanic?.name || 'None'}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatCurrencyWithSettings(record.totalCost)}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${getStatusColor(record.status)}`}>
                        {record.status === 'IN_PROGRESS' ? 'IN PROGRESS' : record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleView(record)}>
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(record.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
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