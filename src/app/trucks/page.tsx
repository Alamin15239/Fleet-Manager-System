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
import { Truck, Plus, Edit, Eye, Trash2, Wrench, AlertTriangle, TrendingUp, Search, Filter, RefreshCw, Download, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { usePermissions } from '@/contexts/permissions-context'
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api'
import { useLanguage } from '@/contexts/language-context'

interface Truck {
  id: string
  vin: string
  make: string
  model: string
  year: number
  licensePlate: string
  currentMileage: number
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE'
  driverName?: string
  image?: string
  createdAt: string
  updatedAt: string
}

interface DashboardStats {
  totalTrucks: number
  activeTrucks: number
  upcomingMaintenance: number
  overdueRepairs: number
  totalMaintenanceCost: number
}

export default function TrucksPage() {
  const { canAccess, canCreate, canUpdate, canDelete, loading: permissionsLoading } = usePermissions()
  const { t } = useLanguage()
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [filteredTrucks, setFilteredTrucks] = useState<Truck[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
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
  const [editingTruck, setEditingTruck] = useState<Truck | null>(null)
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null)

  
  const [formData, setFormData] = useState({
    vin: '',
    make: '',
    model: '',
    year: new Date().getFullYear(),
    licensePlate: '',
    currentMileage: 0,
    status: 'ACTIVE' as const,
    driverName: ''
  })
  
  const [validationErrors, setValidationErrors] = useState({
    vin: '',
    licensePlate: ''
  })
  
  const [isCheckingVin, setIsCheckingVin] = useState(false)
  const [isCheckingLicensePlate, setIsCheckingLicensePlate] = useState(false)
  
  // Simple validation state
  const [isFormValid, setIsFormValid] = useState(false)

  // Simple validation checker
  useEffect(() => {
    const hasRequiredFields = formData.vin && formData.make && formData.model && formData.licensePlate
    const hasNoErrors = !validationErrors.vin && !validationErrors.licensePlate
    const isNotChecking = !isCheckingVin && !isCheckingLicensePlate
    const isValid = hasRequiredFields && hasNoErrors && isNotChecking
    setIsFormValid(isValid)
    
    console.log('Validation state:', {
      hasRequiredFields,
      hasNoErrors,
      isNotChecking,
      isValid,
      formData,
      validationErrors
    })
  }, [formData, validationErrors, isCheckingVin, isCheckingLicensePlate])

  useEffect(() => {
    fetchDashboardStats()
    fetchTrucks()
  }, [])

  // Filter and search trucks
  useEffect(() => {
    let filtered = trucks
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(truck => 
        truck.vin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        truck.licensePlate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (truck.driverName && truck.driverName.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    }
    
    // Apply status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(truck => truck.status === statusFilter)
    }
    
    setFilteredTrucks(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [trucks, searchTerm, statusFilter])

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

  const checkVinExists = async (vin: string) => {
    if (!vin || vin.length < 5) {
      setValidationErrors(prev => ({ ...prev, vin: '' }))
      return
    }
    
    setIsCheckingVin(true)
    try {
      const response = await apiGet(`/api/trucks?search=${vin}`)
      if (response.ok) {
        const data = await response.json()
        const existingTruck = data.data?.find((truck: any) => 
          truck.vin.toLowerCase() === vin.toLowerCase()
        )
        
        if (existingTruck && (!editingTruck || existingTruck.id !== editingTruck.id)) {
          console.log('VIN validation failed - already exists:', vin)
          setValidationErrors(prev => ({ ...prev, vin: t('trucks.vinAlreadyExists') }))
        } else {
          console.log('VIN validation passed:', vin)
          setValidationErrors(prev => ({ ...prev, vin: '' }))
        }
      }
    } catch (error) {
      console.error('Error checking VIN:', error)
    } finally {
      setIsCheckingVin(false)
    }
  }

  const checkLicensePlateExists = async (licensePlate: string) => {
    if (!licensePlate || licensePlate.length < 2) {
      setValidationErrors(prev => ({ ...prev, licensePlate: '' }))
      return
    }
    
    setIsCheckingLicensePlate(true)
    try {
      const response = await apiGet(`/api/trucks?search=${licensePlate}`)
      if (response.ok) {
        const data = await response.json()
        const existingTruck = data.data?.find((truck: any) => 
          truck.licensePlate.toLowerCase() === licensePlate.toLowerCase()
        )
        
        if (existingTruck && (!editingTruck || existingTruck.id !== editingTruck.id)) {
          console.log('License plate validation failed - already exists:', licensePlate)
          setValidationErrors(prev => ({ ...prev, licensePlate: t('trucks.licensePlateAlreadyExists') }))
        } else {
          console.log('License plate validation passed:', licensePlate)
          setValidationErrors(prev => ({ ...prev, licensePlate: '' }))
        }
      }
    } catch (error) {
      console.error('Error checking license plate:', error)
    } finally {
      setIsCheckingLicensePlate(false)
    }
  }

  // Debounced check functions
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.vin) {
        checkVinExists(formData.vin)
      }
    }, 500)
    
    return () => clearTimeout(timer)
  }, [formData.vin])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.licensePlate) {
        checkLicensePlateExists(formData.licensePlate)
      }
    }, 500)
    
    return () => clearTimeout(timer)
  }, [formData.licensePlate])

  const fetchTrucks = async () => {
    try {
      const response = await apiGet('/api/trucks?limit=100')
      if (response.ok) {
        const data = await response.json()
        // API returns { success: true, data: trucks, pagination: ... }
        const trucksData = data.data || []
        setTrucks(trucksData)
        setFilteredTrucks(trucksData)
        // Also refresh dashboard stats to ensure consistency
        fetchDashboardStats()
      } else {
        toast.error('Failed to fetch trucks')
      }
    } catch (error) {
      console.error('Error fetching trucks:', error)
      toast.error('Failed to fetch trucks')
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
    
    console.log('Form submission started')
    console.log('Form data:', formData)
    console.log('Validation errors:', validationErrors)
    console.log('Form validation state:', {
      isCheckingVin,
      isCheckingLicensePlate,
      isFormValid
    })
    
    // Simple validation - just check required fields
    if (!formData.vin || !formData.make || !formData.model || !formData.licensePlate) {
      console.log('Required fields missing')
      toast.error(t('message.fillRequiredFields'))
      return
    }
    
    // Check for validation errors
    if (validationErrors.vin || validationErrors.licensePlate) {
      console.log('Validation errors present:', validationErrors)
      toast.error(t('message.fixValidationErrors'))
      return
    }
    
    console.log('Attempting to submit form...')
    try {
      const url = editingTruck ? `/api/trucks/${editingTruck.id}` : '/api/trucks'
      const response = editingTruck ? await apiPut(url, formData) : await apiPost(url, formData)
      console.log('API response status:', response.status)

      if (response.ok) {
        const result = await response.json()
        console.log('API response data:', result)
        toast.success(t('message.success'))
        setIsDialogOpen(false)
        resetForm()
        fetchTrucks() // Refresh the list
      } else {
        // Get error message from response
        let errorMessage = 'Failed to save truck'
        try {
          const responseClone = response.clone()
          const text = await responseClone.text()
          if (text) {
            const errorData = JSON.parse(text)
            errorMessage = errorData.error || errorMessage
          }
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        console.error('API Error:', errorMessage)
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('Error saving truck:', error)
      toast.error('Failed to save truck')
    }
  }

  const handleEdit = (truck: Truck) => {
    setEditingTruck(truck)
    setFormData({
      vin: truck.vin,
      make: truck.make,
      model: truck.model,
      year: truck.year,
      licensePlate: truck.licensePlate,
      currentMileage: truck.currentMileage,
      status: truck.status,
      driverName: truck.driverName || ''
    })
    setIsDialogOpen(true)
  }

  const resetForm = () => {
    setEditingTruck(null)
    setFormData({
      vin: '',
      make: '',
      model: '',
      year: new Date().getFullYear(),
      licensePlate: '',
      currentMileage: 0,
      status: 'ACTIVE',
      driverName: ''
    })
    setValidationErrors({
      vin: '',
      licensePlate: ''
    })
  }

  const handleAddTruck = () => {
    resetForm()
    setIsDialogOpen(true)
  }

  const handleRefresh = () => {
    fetchTrucks()
    fetchDashboardStats()
  }

  const handleExport = () => {
    const csvContent = [
      ['VIN', 'Make', 'Model', 'Year', 'License Plate', 'Driver', 'Mileage', 'Status'],
      ...filteredTrucks.map(truck => [
        truck.vin,
        truck.make,
        truck.model,
        truck.year.toString(),
        truck.licensePlate,
        truck.driverName || '',
        truck.currentMileage.toString(),
        truck.status
      ])
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fleet-data-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  // Pagination
  const totalPages = Math.ceil(filteredTrucks.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTrucks = filteredTrucks.slice(startIndex, endIndex)

  const handleDelete = async (truckId: string) => {
    if (confirm(t('message.deleteConfirm'))) {
      try {
        const response = await apiDelete(`/api/trucks/${truckId}`)

        if (response.ok) {
          toast.success(t('message.success'))
          fetchTrucks() // Refresh the list
        } else {
          const errorData = await response.json()
          toast.error(errorData.error || 'Failed to delete truck')
        }
      } catch (error) {
        console.error('Error deleting truck:', error)
        toast.error('Failed to delete truck')
      }
    }
  }



  const handleViewTruck = (truck: Truck) => {
    setSelectedTruck(truck)
    setIsViewDialogOpen(true)
  }



  if (permissionsLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!canAccess('trucks')) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <Truck className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h2 className="text-xl font-semibold mb-2">{t('message.accessDenied')}</h2>
          <p className="text-gray-600">{t('message.noPermission')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="h-8 w-8 text-blue-600" />
            {t('trucks.title')}
          </h1>
          <p className="text-muted-foreground">{t('trucks.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {canCreate('trucks') && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open)
              if (!open) {
                resetForm()
              }
            }}>
              <DialogTrigger asChild>
                <Button onClick={handleAddTruck}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('trucks.addTruck')}
                </Button>
              </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>
                {editingTruck ? t('trucks.editTruck') : t('trucks.addTruck')}
              </DialogTitle>
              <DialogDescription>
                {editingTruck ? t('trucks.updateDetails') : t('trucks.truckDetails')}
              </DialogDescription>
            </DialogHeader>
            
            {/* Validation Error Summary */}
            {(validationErrors.vin || validationErrors.licensePlate) && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      {t('message.fixErrors')}
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <ul className="list-disc pl-5 space-y-1">
                        {validationErrors.vin && <li>{validationErrors.vin}</li>}
                        {validationErrors.licensePlate && <li>{validationErrors.licensePlate}</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="vin" className="text-right">
                  {t('trucks.vin')}
                </Label>
                <div className="col-span-3 relative">
                  <Input
                    id="vin"
                    value={formData.vin}
                    onChange={(e) => setFormData({...formData, vin: e.target.value})}
                    className={validationErrors.vin ? 'border-red-500' : ''}
                    required
                    placeholder={t('trucks.enterUniqueVin')}
                  />
                  {isCheckingVin && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {!isCheckingVin && formData.vin && !validationErrors.vin && (
                    <div className="absolute right-3 top-3">
                      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  )}
                  {validationErrors.vin && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.vin}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">{t('trucks.vinMustBeUnique')}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="make" className="text-right">
                  {t('trucks.make')}
                </Label>
                <Input
                  id="make"
                  value={formData.make}
                  onChange={(e) => setFormData({...formData, make: e.target.value})}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="model" className="text-right">
                  {t('trucks.model')}
                </Label>
                <Input
                  id="model"
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value})}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="year" className="text-right">
                  {t('trucks.year')}
                </Label>
                <Input
                  id="year"
                  type="number"
                  value={formData.year}
                  onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})}
                  className="col-span-3"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="licensePlate" className="text-right">
                  {t('trucks.licensePlate')}
                </Label>
                <div className="col-span-3 relative">
                  <Input
                    id="licensePlate"
                    value={formData.licensePlate}
                    onChange={(e) => setFormData({...formData, licensePlate: e.target.value})}
                    className={validationErrors.licensePlate ? 'border-red-500' : ''}
                    required
                    placeholder={t('trucks.enterUniqueLicensePlate')}
                  />
                  {isCheckingLicensePlate && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                  {!isCheckingLicensePlate && formData.licensePlate && !validationErrors.licensePlate && (
                    <div className="absolute right-3 top-3">
                      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  )}
                  {validationErrors.licensePlate && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.licensePlate}</p>
                  )}
                  <p className="text-gray-500 text-xs mt-1">{t('trucks.licensePlateMustBeUnique')}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="currentMileage" className="text-right">
                  {t('trucks.mileage')}
                </Label>
                <Input
                  id="currentMileage"
                  type="number"
                  value={formData.currentMileage}
                  onChange={(e) => {
                    const value = e.target.value
                    const mileage = value === '' ? 0 : parseInt(value) || 0
                    setFormData({...formData, currentMileage: mileage})
                  }}
                  className="col-span-3"
                  required
                  min="0"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="driverName" className="text-right">
                  Driver Name
                </Label>
                <Input
                  id="driverName"
                  value={formData.driverName}
                  onChange={(e) => setFormData({...formData, driverName: e.target.value})}
                  className="col-span-3"
                  placeholder="Enter driver name (optional)"
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
                    <SelectItem value="ACTIVE">{t('status.active')}</SelectItem>
                    <SelectItem value="INACTIVE">{t('status.inactive')}</SelectItem>
                    <SelectItem value="MAINTENANCE">{t('common.maintenance')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setIsDialogOpen(false)
                  resetForm()
                }}>
                  {t('common.cancel')}
                </Button>
                <Button 
                  type="submit" 
                  disabled={!isFormValid}
                >
                  {editingTruck ? t('trucks.updateTruck') : t('trucks.addTruck')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
          )}
        </div>
      </div>

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
            <div className="text-2xl font-bold">﷼{((dashboardStats.totalMaintenanceCost || 0) / 6).toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
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
            <div className="text-2xl font-bold">﷼{(dashboardStats.totalMaintenanceCost || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboard.last6Months')}
            </p>
          </CardContent>
        </Card>
      </div>



      {/* View Truck Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {t('trucks.truckDetails')} - {selectedTruck?.licensePlate}
            </DialogTitle>
            <DialogDescription>
              {t('trucks.viewDetailedInformation')}
            </DialogDescription>
          </DialogHeader>
          {selectedTruck && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('trucks.vin')}</Label>
                  <p className="text-lg font-semibold">{selectedTruck.vin}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('trucks.licensePlate')}</Label>
                  <p className="text-lg font-semibold">{selectedTruck.licensePlate}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('trucks.make')}</Label>
                  <p className="text-lg font-semibold">{selectedTruck.make}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('trucks.model')}</Label>
                  <p className="text-lg font-semibold">{selectedTruck.model}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('trucks.year')}</Label>
                  <p className="text-lg font-semibold">{selectedTruck.year}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('trucks.currentMileage')}</Label>
                  <p className="text-lg font-semibold">{(selectedTruck.currentMileage || 0).toLocaleString()} {t('trucks.miles')}</p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-gray-500">{t('table.status')}</Label>
                <Badge className={`mt-1 ${getStatusColor(selectedTruck.status)}`}>
                  {selectedTruck.status}
                </Badge>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-500">Driver Name</Label>
                <p className="text-sm text-gray-600">
                  {selectedTruck.driverName || 'No driver assigned'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('maintenance.created')}</Label>
                  <p className="text-sm">{new Date(selectedTruck.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">{t('maintenance.lastUpdated')}</Label>
                  <p className="text-sm">{new Date(selectedTruck.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              {t('action.close')}
            </Button>
            {canUpdate('trucks') && selectedTruck && (
              <Button onClick={() => {
                setIsViewDialogOpen(false)
                handleEdit(selectedTruck)
              }}>
                {t('trucks.editTruck')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Search & Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by VIN, make, model, license plate, or driver..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Trucks Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>{t('trucks.fleetOverview')}</CardTitle>
              <CardDescription>
                Showing {filteredTrucks.length} trucks
                {searchTerm && ` (filtered from ${trucks.length} total)`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Last updated: {new Date().toLocaleTimeString()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('trucks.vin')}</TableHead>
                  <TableHead>{t('trucks.vehicle')}</TableHead>
                  <TableHead>{t('trucks.licensePlate')}</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>{t('trucks.mileage')}</TableHead>
                  <TableHead>{t('table.status')}</TableHead>
                  <TableHead className="text-right">{t('table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrucks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Truck className="h-12 w-12 text-muted-foreground" />
                        <p className="text-lg font-medium">No trucks found</p>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm || statusFilter !== 'ALL' 
                            ? 'Try adjusting your search or filters'
                            : 'Add your first truck to get started'
                          }
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrucks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((truck) => (
                    <TableRow key={truck.id}>
                      <TableCell className="font-medium">{truck.vin}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{truck.year} {truck.make} {truck.model}</div>
                          <div className="text-sm text-muted-foreground">
                            {t('trucks.added')} {new Date(truck.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{truck.licensePlate}</TableCell>
                      <TableCell>{truck.driverName || 'No driver'}</TableCell>
                      <TableCell>{(truck.currentMileage || 0).toLocaleString()} {t('trucks.miles')}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(truck.status)}>
                          {truck.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleViewTruck(truck)}>
                            <Eye className="h-4 w-4" />
                          </Button>

                          {canUpdate('trucks') && (
                            <Button variant="outline" size="sm" onClick={() => handleEdit(truck)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete('trucks') && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => handleDelete(truck.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {Math.ceil(filteredTrucks.length / itemsPerPage) > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredTrucks.length)} of {filteredTrucks.length} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.ceil(filteredTrucks.length / itemsPerPage) }, (_, i) => i + 1)
                    .filter(page => 
                      page === 1 || 
                      page === Math.ceil(filteredTrucks.length / itemsPerPage) || 
                      Math.abs(page - currentPage) <= 1
                    )
                    .map((page, index, array) => (
                      <div key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-2 text-muted-foreground">...</span>
                        )}
                        <Button
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-8 h-8 p-0"
                        >
                          {page}
                        </Button>
                      </div>
                    ))
                  }
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredTrucks.length / itemsPerPage)))}
                  disabled={currentPage === Math.ceil(filteredTrucks.length / itemsPerPage)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}