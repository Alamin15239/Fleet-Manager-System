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
import { Wrench, Plus, Edit, Eye, Calendar as CalendarIcon, Truck, Trash2, BookOpen, AlertTriangle, TrendingUp, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency, type CurrencySettings } from '@/lib/currency'
import { CurrencyInput } from '@/components/ui/currency-input'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { MaintenanceJobSelector } from '@/components/maintenance-job-selector'
import { useLanguage } from '@/contexts/language-context'
import { PageHeader } from '@/components/page-header'
import '@/styles/draggable.css'



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
  const [selectedJobs, setSelectedJobs] = useState<MaintenanceJob[]>([])
  
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
    oilQuantityLiters: 0,
    currentMileage: 0,
    maintenanceJobId: '',
    driverName: '',
    mechanicName: ''
  })

  const [vehicleSearch, setVehicleSearch] = useState('')
  const [mechanicSearch, setMechanicSearch] = useState('')
  const [selectedMechanics, setSelectedMechanics] = useState<Mechanic[]>([])
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false)
  const [showMechanicDropdown, setShowMechanicDropdown] = useState(false)
  
  const vehicleDropdownRef = useRef<HTMLDivElement>(null)
  const mechanicDropdownRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [scrollPosition, setScrollPosition] = useState(0)

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

  // Save scroll position before edit
  const handleEditWithScroll = (record: MaintenanceRecord) => {
    setScrollPosition(window.scrollY)
    handleEdit(record)
  }

  // Restore scroll position after edit
  useEffect(() => {
    if (!isDialogOpen && scrollPosition > 0) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: scrollPosition, behavior: 'instant' })
        setScrollPosition(0)
      })
    }
  }, [isDialogOpen, scrollPosition])

  // Add drag functionality
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !isDialogOpen) return

    let isDragging = false
    let startX = 0
    let startY = 0
    let initialX = 0
    let initialY = 0

    const handleMouseDown = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.drag-handle')) return
      isDragging = true
      startX = e.clientX
      startY = e.clientY
      const rect = dialog.getBoundingClientRect()
      initialX = rect.left
      initialY = rect.top
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      const deltaX = e.clientX - startX
      const deltaY = e.clientY - startY
      dialog.style.left = `${initialX + deltaX}px`
      dialog.style.top = `${initialY + deltaY}px`
      dialog.style.transform = 'none'
    }

    const handleMouseUp = () => {
      isDragging = false
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    dialog.addEventListener('mousedown', handleMouseDown)
    return () => {
      dialog.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDialogOpen])

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
      const response = await apiGet('/api/maintenance?limit=1000')
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
          toast.success('Maintenance record updated successfully')
        } else {
          toast.success('Maintenance record created successfully')
          if (formData.isOilChange) {
            toast.info('Next oil change date has been calculated and set')
          }
        }
        setIsDialogOpen(false)
        resetForm()
        // Refresh the list immediately to show new record at top
        await fetchMaintenanceRecords()
        // Restore scroll position after refresh
        if (scrollPosition > 0) {
          setTimeout(() => window.scrollTo({ top: scrollPosition, behavior: 'instant' }), 50)
        }
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
    try {
      if (!record || !record.id) return;
      
      setEditingRecord(record)
      setSelectedJobs(record.maintenanceJob ? [record.maintenanceJob] : [])
      
      let selectedVehicle = null
      let selectedMechanic = null
      let driverName = ''
      
      try {
        selectedVehicle = vehicles?.find?.(v => v?.id === record.truckId) || null
      } catch (e) {
        console.error('Error finding vehicle:', e)
      }
      
      try {
        selectedMechanic = mechanics?.find?.(m => m?.id === record.mechanicId) || null
      } catch (e) {
        console.error('Error finding mechanic:', e)
      }
      
      try {
        if (selectedVehicle?.type === 'truck') {
          driverName = trucks?.find?.(t => t?.id === selectedVehicle?.id)?.driverName || ''
        } else {
          driverName = trailers?.find?.(t => t?.id === selectedVehicle?.id)?.driverName || ''
        }
      } catch (e) {
        console.error('Error finding driver:', e)
        driverName = ''
      }
      
      setVehicleSearch(selectedVehicle ? `${selectedVehicle.displayName || ''} - ${selectedVehicle.identifier || ''}` : '')
      setSelectedMechanics(selectedMechanic ? [selectedMechanic] : [])
      setMechanicSearch('')
      
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
        oilQuantityLiters: record.oilQuantityLiters || 0,
        currentMileage: record.currentMileage || 0,
        maintenanceJobId: record.maintenanceJobId || '',
        driverName
      })
      setIsDialogOpen(true)
    } catch (error) {
      console.error('Error in handleEdit:', error)
      toast.error('Error opening edit dialog')
    }
  }

  const handleJobsSelect = (jobs: MaintenanceJob[]) => {
    setSelectedJobs(jobs)
    if (jobs.length > 0) {
      const combinedNames = jobs.map(j => j.name).join(', ')
      const combinedParts = jobs.map(j => j.parts).filter(Boolean).join(', ')
      setFormData({
        ...formData,
        serviceType: combinedNames,
        description: combinedParts,
        maintenanceJobId: jobs[0].id // Store first job ID for compatibility
      })
    }
  }

  const handleView = (record: MaintenanceRecord) => {
    setViewingRecord(record)
    setIsViewDialogOpen(true)
  }

  const resetForm = () => {
    setEditingRecord(null)
    setViewingRecord(null)
    setSelectedJobs([])
    setVehicleSearch('')
    setMechanicSearch('')
    setSelectedMechanics([])
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
      oilQuantityLiters: 0,
      currentMileage: 0,
      maintenanceJobId: '',
      driverName: '',
      mechanicName: ''
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
          <DialogContent ref={dialogRef} className="sm:max-w-[500px] max-h-[90vh] draggable-dialog">
            <DialogHeader className="cursor-move drag-handle">
              <DialogTitle className="text-lg">
                {editingRecord ? 'Edit Maintenance' : 'Add Maintenance'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto px-1">
              <div className="space-y-2">
                <Label htmlFor="vehicleId" className="text-sm font-medium">
                  Vehicle
                </Label>
                <div className="relative" ref={vehicleDropdownRef}>
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
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Service Type
                </Label>
                <div className="space-y-2">
                  <MaintenanceJobSelector
                    onSelectJobs={handleJobsSelect}
                    selectedJobs={selectedJobs}
                    multiple={true}
                  >
                    <Button variant="outline" className="w-full justify-start">
                      <BookOpen className="h-4 w-4 mr-2" />
                      {selectedJobs.length > 0 
                        ? `${selectedJobs.length} job${selectedJobs.length > 1 ? 's' : ''} selected`
                        : t('maintenance.selectJob')}
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
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isOilChange"
                  checked={formData.isOilChange}
                  onChange={(e) => setFormData({...formData, isOilChange: e.target.checked})}
                  className="w-4 h-4"
                />
                <Label htmlFor="isOilChange" className="text-sm">Oil Change Service</Label>
              </div>
              
              {formData.isOilChange && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-sm font-medium">Interval (km)</Label>
                    <Input
                      type="number"
                      value={formData.oilChangeInterval}
                      onChange={(e) => setFormData({...formData, oilChangeInterval: parseInt(e.target.value) || 5000})}
                      step="1000"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Oil Quantity (Liters)</Label>
                    <Input
                      type="number"
                      value={formData.oilQuantityLiters}
                      onChange={(e) => setFormData({...formData, oilQuantityLiters: parseFloat(e.target.value) || 0})}
                      step="0.5"
                      min="0"
                      placeholder="e.g. 15"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Current Mileage</Label>
                    <Input
                      type="number"
                      value={formData.currentMileage}
                      onChange={(e) => setFormData({...formData, currentMileage: parseInt(e.target.value) || 0})}
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={2}
                  className="resize-none"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Date Performed</Label>
                  <Input
                    type="date"
                    value={formData.datePerformed}
                    onChange={(e) => setFormData({...formData, datePerformed: e.target.value})}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Next Service Due</Label>
                  <Input
                    type="date"
                    value={formData.nextServiceDue}
                    onChange={(e) => setFormData({...formData, nextServiceDue: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mechanic</Label>
                <div className="space-y-2">
                  <div className="relative" ref={mechanicDropdownRef}>

                    <Input
                      placeholder="Search mechanics..."
                      value={mechanicSearch}
                      onChange={(e) => setMechanicSearch(e.target.value)}
                      onFocus={() => setShowMechanicDropdown(true)}
                      className="w-full"
                    />
                    {showMechanicDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                        <div className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedMechanics.length === 0}
                            onChange={() => {
                              setSelectedMechanics([])
                              setFormData({...formData, mechanicId: 'none'})
                            }}
                            className="w-4 h-4"
                          />
                          <span>No mechanic</span>
                        </div>
                        {mechanics
                          .filter(mechanic => 
                            mechanic && mechanic.id &&
                            (mechanic.name?.toLowerCase().includes(mechanicSearch.toLowerCase()) ||
                            mechanic.email?.toLowerCase().includes(mechanicSearch.toLowerCase()))
                          )
                          .map((mechanic) => {
                            if (!mechanic || !mechanic.id) return null;
                            const isSelected = selectedMechanics.some(m => m.id === mechanic.id)
                            return (
                              <div
                                key={mechanic.id}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer flex items-center gap-2"
                                onClick={() => {
                                  const newSelection = isSelected
                                    ? selectedMechanics.filter(m => m.id !== mechanic.id)
                                    : [...selectedMechanics, mechanic]
                                  setSelectedMechanics(newSelection)
                                  const mechanicNames = newSelection.map(m => m.name).join(', ')
                                  setFormData({...formData, mechanicId: newSelection.length > 0 ? newSelection[0].id : 'none', mechanicName: mechanicNames})
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="w-4 h-4"
                                />
                                <span>{mechanic.name}</span>
                              </div>
                            )
                          }).filter(Boolean)
                        }
                      </div>
                    )}
                  </div>
                  {selectedMechanics.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedMechanics.map(mechanic => (
                        <div key={mechanic.id} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs flex items-center gap-1">
                          <span>{mechanic.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const newSelection = selectedMechanics.filter(m => m.id !== mechanic.id)
                              setSelectedMechanics(newSelection)
                              const mechanicNames = newSelection.map(m => m.name).join(', ')
                              setFormData({...formData, mechanicId: newSelection.length > 0 ? newSelection[0].id : 'none', mechanicName: mechanicNames})
                            }}
                            className="text-green-600 hover:text-green-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-medium">Parts Cost</Label>
                  <CurrencyInput
                    value={formData.partsCost}
                    onChange={(value) => setFormData({...formData, partsCost: value})}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Labor Cost</Label>
                  <CurrencyInput
                    value={formData.laborCost}
                    onChange={(value) => setFormData({...formData, laborCost: value})}
                    placeholder="0.00"
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value as any})}>
                  <SelectTrigger className="mt-1">
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
              
              <div>
                <Label className="text-sm font-medium">Driver Name</Label>
                <Input
                  value={formData.driverName}
                  placeholder="Auto-filled from vehicle"
                  readOnly
                  className="mt-1 bg-gray-50"
                />
              </div>
              
              <div>
                <Label className="text-sm font-medium">Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={2}
                  className="mt-1 resize-none"
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
            <div className="text-2xl font-bold">SAR {(dashboardStats.totalMaintenanceCost / 6).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
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
            <div className="text-2xl font-bold">SAR {dashboardStats.totalMaintenanceCost.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.last6Months')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[400px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-lg">Maintenance Details</DialogTitle>
          </DialogHeader>
          {viewingRecord && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="bg-gray-50 p-3 rounded">
                <div className="font-medium text-sm">
                  {viewingRecord.truck 
                    ? `${viewingRecord.truck.year} ${viewingRecord.truck.make} ${viewingRecord.truck.model}`
                    : 'Trailer'}
                </div>
                <div className="text-xs text-gray-600">
                  {viewingRecord.truck?.licensePlate || 'N/A'}
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-500">Service</Label>
                <p className="text-sm font-medium truncate" title={viewingRecord.serviceType}>
                  {viewingRecord.serviceType}
                </p>
                {viewingRecord.isOilChange && (
                  <Badge variant="secondary" className="text-xs mt-1">🛢️ Oil Change</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">Date</Label>
                  <p>{new Date(viewingRecord.datePerformed).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <Badge className={`text-xs ${getStatusColor(viewingRecord.status)}`}>
                    {viewingRecord.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {viewingRecord.mechanic && (
                <div>
                  <Label className="text-xs text-gray-500">Mechanic</Label>
                  <p className="text-sm font-medium">{viewingRecord.mechanic.name}</p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <Label className="text-xs text-gray-500">Parts</Label>
                  <p className="font-medium">{formatCurrencyWithSettings(viewingRecord.partsCost)}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Labor</Label>
                  <p className="font-medium">{formatCurrencyWithSettings(viewingRecord.laborCost)}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Total</Label>
                  <p className="font-medium text-green-600">{formatCurrencyWithSettings(viewingRecord.totalCost)}</p>
                </div>
              </div>

              {viewingRecord.description && (
                <div>
                  <Label className="text-xs text-gray-500">Description</Label>
                  <p className="text-sm bg-gray-50 p-2 rounded text-wrap break-words">{viewingRecord.description}</p>
                </div>
              )}

              {viewingRecord.notes && (
                <div>
                  <Label className="text-xs text-gray-500">Notes</Label>
                  <p className="text-sm bg-gray-50 p-2 rounded">{viewingRecord.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} className="w-full">
              Close
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
                          {record.truck 
                            ? `${record.truck.year} ${record.truck.make}` 
                            : record.trailer 
                              ? `Trailer ${record.trailer.number}` 
                              : 'Vehicle'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {record.truck 
                            ? `${record.truck.licensePlate}${record.driverName ? ` - ${record.driverName}` : ''}` 
                            : record.trailer?.driverName || 'N/A'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.mechanicName || record.mechanic?.name || 'None'}
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
                        <Button variant="ghost" size="sm" onClick={() => handleView(record)} title="View Details">
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditWithScroll(record)} title="Edit Record">
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={async () => {
                            const { jsPDF } = await import('jspdf')
                            const doc = new jsPDF()
                            
                            // Header
                            doc.setFontSize(24)
                            doc.setFont('helvetica', 'bold')
                            doc.text('FLEET MAINTENANCE JOB CARD', 105, 25, { align: 'center' })
                            
                            // Job Card Number
                            doc.setFontSize(12)
                            doc.setFont('helvetica', 'normal')
                            doc.text(`Job Card #: ${record.id.slice(-8).toUpperCase()}`, 150, 40)
                            doc.text(`Date: ${new Date(record.datePerformed).toLocaleDateString()}`, 150, 50)
                            
                            // Vehicle Information Box
                            doc.rect(20, 60, 170, 40)
                            doc.setFont('helvetica', 'bold')
                            doc.text('VEHICLE INFORMATION', 25, 70)
                            doc.setFont('helvetica', 'normal')
                            doc.text(`Vehicle: ${record.truck ? `${record.truck.year} ${record.truck.make} ${record.truck.model}` : `Trailer ${record.trailer?.number || ''}`}`, 25, 80)
                            doc.text(`License Plate: ${record.truck?.licensePlate || record.trailer?.number || 'N/A'}`, 25, 90)
                            doc.text(`Driver: ${record.driverName || 'Not Assigned'}`, 120, 80)
                            const odometerValue = record.truck ? (record.currentMileage || record.truck.currentMileage) : null
                            doc.text(`Odometer: ${odometerValue ? `${odometerValue.toLocaleString()} km` : (record.truck ? '___________ km' : 'N/A (Trailer)')}`, 120, 90)
                            
                            // Work Order Box
                            doc.rect(20, 110, 170, 50)
                            doc.setFont('helvetica', 'bold')
                            doc.text('WORK ORDER', 25, 120)
                            doc.setFont('helvetica', 'normal')
                            doc.text(`Service Type: ${record.serviceType}`, 25, 130)
                            const description = record.description || 'No description provided'
                            const splitDescription = doc.splitTextToSize(description, 160)
                            doc.text('Description:', 25, 140)
                            doc.text(splitDescription, 25, 150)
                            
                            // Technician Assignment Box
                            doc.rect(20, 170, 80, 30)
                            doc.setFont('helvetica', 'bold')
                            doc.text('ASSIGNED TECHNICIAN', 25, 180)
                            doc.setFont('helvetica', 'normal')
                            doc.text(`Name: ${record.mechanic?.name || 'Not Assigned'}`, 25, 190)
                            
                            // Status Box
                            doc.rect(110, 170, 80, 30)
                            doc.setFont('helvetica', 'bold')
                            doc.text('STATUS', 115, 180)
                            doc.setFont('helvetica', 'normal')
                            doc.text(`Current: ${record.status.replace('_', ' ')}`, 115, 190)
                            
                            // Cost Information Box
                            doc.rect(20, 210, 170, 30)
                            doc.setFont('helvetica', 'bold')
                            doc.text('COST BREAKDOWN', 25, 220)
                            doc.setFont('helvetica', 'normal')
                            doc.text(`Parts Cost: SAR ${record.partsCost.toFixed(2)}`, 25, 230)
                            doc.text(`Labor Cost: SAR ${record.laborCost.toFixed(2)}`, 80, 230)
                            doc.text(`Total Cost: SAR ${record.totalCost.toFixed(2)}`, 135, 230)
                            
                            // Signature Section
                            doc.rect(20, 250, 80, 25)
                            doc.text('TECHNICIAN SIGNATURE', 25, 260)
                            doc.text('Date: _______________', 25, 270)
                            
                            doc.rect(110, 250, 80, 25)
                            doc.text('SUPERVISOR APPROVAL', 115, 260)
                            doc.text('Date: _______________', 115, 270)
                            
                            // Footer
                            doc.setFontSize(8)
                            doc.text(`Generated: ${new Date().toLocaleString()}`, 20, 285)
                            doc.text('Fleet Management System', 105, 285, { align: 'center' })
                            
                            doc.save(`job-card-${record.truck?.licensePlate || record.trailer?.number || record.id}-${Date.now()}.pdf`)
                            toast.success('Professional job card generated successfully')
                          }}
                          title="Generate Professional Job Card"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <FileText className="h-3 w-3" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDelete(record.id)}
                          className="text-red-600 hover:text-red-700"
                          title="Delete Record"
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