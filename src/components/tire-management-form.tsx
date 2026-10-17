'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Loader2, Plus, CheckCircle, AlertCircle, Search, Truck, User, Package, Database } from 'lucide-react'
import { apiPost, apiGet } from '@/lib/api'
import { useDebounce } from '@/hooks/use-debounce'
import { toast } from '@/lib/localized-toast'
import { PermissionGuard } from '@/components/permission-guard'

interface Vehicle {
  id: string
  plateNumber: string
  trailerNumber: string | null
  driverName: string | null
  isActive?: boolean
}

interface Tire {
  id: string
  tireSize: string
  manufacturer: string
  origin: string
  plateNumber: string
  trailerNumber: string | null
  driverName: string | null
  quantity: number
  createdAt: string
  notes: string | null
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
  trailerTireSize: string
  trailerManufacturer: string
  trailerOrigin: string
  trailerQuantity: number
  trailerSerialNumber: string
  notes: string
  createdAt: string
}

export default function TireManagementForm() {
  const [formData, setFormData] = useState<TireFormData>({
    tireSize: '',
    manufacturer: '',
    origin: 'SAUDI',
    plateNumber: '',
    trailerNumber: '',
    driverName: '',
    quantity: 1,
    serialNumber: '',
    trailerTireSize: '',
    trailerManufacturer: '',
    trailerOrigin: 'SAUDI',
    trailerQuantity: 0,
    trailerSerialNumber: '',
    notes: '',
    createdAt: new Date().toISOString().slice(0, 16)
  })

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [plateNumbers, setPlateNumbers] = useState<string[]>([])
  const [trailerNumbers, setTrailerNumbers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showPlateDropdown, setShowPlateDropdown] = useState(false)
  const [showTrailerDropdown, setShowTrailerDropdown] = useState(false)
  const [autoFilled, setAutoFilled] = useState({
    driverName: false,
    trailerNumber: false
  })
  const [matchingTires, setMatchingTires] = useState<Tire[]>([])
  const [loadingTires, setLoadingTires] = useState(false)
  const [recentTires, setRecentTires] = useState<Tire[]>([])
  const [loadingRecent, setLoadingRecent] = useState(true)

  useEffect(() => {
    fetchVehicles()
    fetchRecentTires()
  }, [])

  // Debounce search terms to prevent excessive API calls
  const debouncedPlateNumber = useDebounce(formData.plateNumber, 300)
  const debouncedTrailerNumber = useDebounce(formData.trailerNumber, 300)
  const debouncedDriverName = useDebounce(formData.driverName, 300)
  const debouncedTireSize = useDebounce(formData.tireSize, 300)
  const debouncedManufacturer = useDebounce(formData.manufacturer, 300)

  useEffect(() => {
    searchMatchingTires()
  }, [debouncedPlateNumber, debouncedTrailerNumber, debouncedDriverName, debouncedTireSize, debouncedManufacturer])

  const fetchVehicles = async () => {
    try {
      // This is a limited lookup for tire assignment. It must follow the
      // Tire Management permission rather than requiring access to Trucks.
      const [vehiclesResponse, filtersResponse] = await Promise.all([apiGet('/api/tires/vehicles'), apiGet('/api/tires/filters')])
      const vehicleData = vehiclesResponse.ok ? await vehiclesResponse.json() : { vehicles: [] }
      const tireFilters = filtersResponse.ok ? await filtersResponse.json() : {}
      const vehicleList = vehicleData.vehicles || []
      setVehicles(vehicleList)
        
      // Existing tire entries are a source for freeform truck and trailer suggestions.
      const plates = [...new Set([...vehicleList.map((v: any) => v.plateNumber), ...(tireFilters.plates || [])].filter(Boolean))] as string[]
      const trailers = [...new Set([...vehicleList.map((v: any) => v.trailerNumber), ...(tireFilters.trailers || [])].filter(Boolean))] as string[]
        
      setPlateNumbers(plates)
      setTrailerNumbers(trailers)
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    }
  }

  const fetchRecentTires = async () => {
    try {
      const response = await apiGet('/api/tires?limit=10&positiveQuantityOnly=true')
      if (response.ok) {
        const data = await response.json()
        setRecentTires(data.tires || [])
      }
    } catch (error) {
      console.error('Error fetching recent tires:', error)
    } finally {
      setLoadingRecent(false)
    }
  }

  const searchMatchingTires = async () => {
    // Only search if at least one field has value
    const hasSearchCriteria = debouncedPlateNumber || debouncedTrailerNumber || debouncedDriverName || debouncedTireSize || debouncedManufacturer
    
    if (!hasSearchCriteria) {
      setMatchingTires([])
      return
    }

    setLoadingTires(true)
    try {
      const params = new URLSearchParams()
      if (debouncedPlateNumber) params.append('plateNumber', debouncedPlateNumber)
      if (debouncedTrailerNumber) params.append('trailerNumber', debouncedTrailerNumber)
      if (debouncedDriverName) params.append('driverName', debouncedDriverName)
      if (debouncedTireSize) params.append('tireSize', debouncedTireSize)
      if (debouncedManufacturer) params.append('manufacturer', debouncedManufacturer)
      
      const response = await apiGet(`/api/tires?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setMatchingTires(data.tires || [])
      } else {
        console.error('Failed to search tires')
        setMatchingTires([])
      }
    } catch (error) {
      console.error('Error searching tires:', error)
      setMatchingTires([])
    } finally {
      setLoadingTires(false)
    }
  }



  const handlePlateNumberChange = async (plateNumber: string) => {
    setFormData(prev => ({ ...prev, plateNumber }))
    // No auto-fill - all fields remain manual entry
  }

  const handleTrailerNumberChange = async (trailerNumber: string) => {
    const actualTrailerNumber = trailerNumber === 'none' ? '' : trailerNumber
    setFormData(prev => ({ ...prev, trailerNumber: actualTrailerNumber }))
    setAutoFilled(prev => ({ ...prev, driverName: false }))
    
    if (actualTrailerNumber) {
      // Find vehicle and auto-fill ONLY driver name
      const vehicle = vehicles.find(v => v.trailerNumber === actualTrailerNumber)
      if (vehicle) {
        setFormData(prev => ({
          ...prev,
          driverName: vehicle.driverName || ''
        }))
        
        // Track auto-filled fields
        setAutoFilled(prev => ({
          ...prev,
          driverName: !!vehicle.driverName
        }))
        
        // Show visual feedback
        setSuccess(`Trailer found: ${actualTrailerNumber}. Driver information auto-filled.`)
        setTimeout(() => setSuccess(null), 3000)
      } else {
        // Clear driver if trailer not found
        setFormData(prev => ({
          ...prev,
          driverName: ''
        }))
      }
    } else {
      // Clear driver field if trailer is cleared
      setFormData(prev => ({
        ...prev,
        driverName: ''
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await apiPost('/api/tires', formData)

      if (response.ok) {
        const data = await response.json()
        const totalTires = (formData.tireSize && formData.manufacturer ? formData.quantity : 0) + 
                          (formData.trailerTireSize && formData.trailerManufacturer ? formData.trailerQuantity : 0)
        
        toast.success(`Successfully created ${totalTires} tire(s)`)
        setSuccess(`Successfully created ${totalTires} tire(s)`)
        
        // Reset form
        setFormData({
          tireSize: '',
          manufacturer: '',
          origin: 'SAUDI',
          plateNumber: '',
          trailerNumber: '',
          driverName: '',
          quantity: 1,
          serialNumber: '',
          trailerTireSize: '',
          trailerManufacturer: '',
          trailerOrigin: 'SAUDI',
          trailerQuantity: 0,
          trailerSerialNumber: '',
          notes: '',
          createdAt: new Date().toISOString().slice(0, 16)
        })
        
        // Refresh data
        fetchVehicles()
        fetchRecentTires()
        
        // Redirect to list page after 1.5 seconds
        setTimeout(() => {
          window.location.href = '/tire-management?tab=inventory'
        }, 1500)
      } else {
        const errorData = await response.json()
        const errorMessage = errorData.details ? 
          `Validation error: ${errorData.details.map((d: any) => d.message).join(', ')}` : 
          errorData.error || 'Failed to create tires'
        
        setError(errorMessage)
        toast.error(errorMessage)
        
        // If authentication error, redirect to login
        if (response.status === 401) {
          window.location.href = '/login'
        }
      }
    } catch (error) {
      const errorMessage = 'Network error: Failed to create tires'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Recent Tires Preview */}
      <Card className="border-purple-200 shadow-sm">
        <CardHeader className="bg-purple-50 border-b border-purple-200">
          <CardTitle className="flex items-center gap-2 text-purple-800">
            <Database className="h-5 w-5" />
            Recent Tires (Last 10)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {loadingRecent ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              <span className="ml-2 text-purple-700"><LocalizedText>Loading recent tires...</LocalizedText></span>
            </div>
          ) : recentTires.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              <Package className="h-8 w-8 mx-auto text-gray-300 mb-2" />
              <p className="text-sm"><LocalizedText>No tires added yet</LocalizedText></p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
              {recentTires.map((tire) => (
                <div key={tire.id} className="p-3 border border-purple-100 rounded-lg bg-purple-50/50">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-purple-900 text-sm">{tire.tireSize}</span>
                    <Badge variant="outline" className="text-xs">{tire.manufacturer}</Badge>
                  </div>
                  <div className="text-xs text-purple-700 space-y-1">
                    {tire.plateNumber && (
                      <div className="flex items-center gap-1">
                        <Truck className="h-3 w-3" />
                        {tire.plateNumber}
                      </div>
                    )}
                    {tire.trailerNumber && (
                      <div className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {tire.trailerNumber}
                      </div>
                    )}
                    <div className="text-gray-500">
                      Qty: {tire.quantity} • {new Date(tire.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add New Tires
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">


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

            <div className="space-y-6">
              {/* Truck Information Section */}
              <div className="border rounded-lg p-4 bg-blue-50">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  Truck Information
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plateNumber" className="font-medium text-blue-700 text-sm">
                      <LocalizedText>Truck Plate Number</LocalizedText>
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search or enter truck plate number"
                        value={formData.plateNumber}
                        onChange={(e) => {
                          setFormData({ ...formData, plateNumber: e.target.value })
                          setShowPlateDropdown(e.target.value.length > 0)
                        }}
                        onFocus={() => setShowPlateDropdown(formData.plateNumber.length > 0)}
                        onBlur={() => setTimeout(() => setShowPlateDropdown(false), 200)}
                        className="pl-10 border-blue-300 focus:border-blue-500 bg-white"
                      />
                      {showPlateDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-blue-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {plateNumbers
                            .filter(plate => plate.toLowerCase().includes(formData.plateNumber.toLowerCase()))
                            .map((plate) => (
                              <div
                                key={plate}
                                className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                                onClick={() => {
                                  handlePlateNumberChange(plate)
                                  setShowPlateDropdown(false)
                                }}
                              >
                                {plate}
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-blue-600"><LocalizedText>Optional - Search or enter truck plate number</LocalizedText></p>
                  </div>



                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="font-medium text-blue-700 text-sm">
                      <LocalizedText>Quantity</LocalizedText>
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.quantity || 1}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                      className="border-blue-300 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-blue-600"><LocalizedText>Number of tires</LocalizedText></p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="truckTireSize" className="font-medium text-blue-700 text-sm">
                      <LocalizedText>Tire Size</LocalizedText>
                    </Label>
                    <Input
                      id="truckTireSize"
                      placeholder="e.g., 295/80R22.5"
                      value={formData.tireSize}
                      onChange={(e) => setFormData({ ...formData, tireSize: e.target.value })}
                      className="border-blue-300 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-blue-600"><LocalizedText>Tire size for truck</LocalizedText></p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="truckManufacturer" className="font-medium text-blue-700 text-sm">
                      <LocalizedText>Manufacturer</LocalizedText>
                    </Label>
                    <Input
                      id="truckManufacturer"
                      placeholder="e.g., GoodYear, Bridgestone"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      className="border-blue-300 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-blue-600"><LocalizedText>Tire manufacturer for truck</LocalizedText></p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="truckOrigin" className="font-medium text-blue-700 text-sm">
                      <LocalizedText>Origin</LocalizedText>
                    </Label>
                    <Select value={formData.origin} onValueChange={(value) => setFormData({ ...formData, origin: value })}>
                      <SelectTrigger className="border-blue-300 focus:border-blue-500 bg-white">
                        <SelectValue placeholder="Select origin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CHINESE"><LocalizedText>Chinese</LocalizedText></SelectItem>
                        <SelectItem value="SAUDI"><LocalizedText>Saudi</LocalizedText></SelectItem>
                        <SelectItem value="JAPANESE"><LocalizedText>Japanese</LocalizedText></SelectItem>
                        <SelectItem value="EUROPEAN"><LocalizedText>European</LocalizedText></SelectItem>
                        <SelectItem value="AMERICAN"><LocalizedText>American</LocalizedText></SelectItem>
                        <SelectItem value="OTHER"><LocalizedText>Other</LocalizedText></SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-blue-600"><LocalizedText>Country of manufacture</LocalizedText></p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="truckSerialNumber" className="font-medium text-blue-700 text-sm">
                      <LocalizedText>Serial Number</LocalizedText>
                    </Label>
                    <Input
                      id="truckSerialNumber"
                      placeholder="e.g., TRK123456"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="border-blue-300 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-blue-600"><LocalizedText>Tire serial number (optional)</LocalizedText></p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-blue-700" />
                    <Label htmlFor="driverName" className="font-medium text-blue-800">
                      <LocalizedText>Truck Driver</LocalizedText>
                    </Label>
                  </div>
                  <Input
                    id="driverName"
                    placeholder="Enter driver name manually"
                    value={formData.driverName}
                    onChange={(e) => {
                      setFormData({ ...formData, driverName: e.target.value })
                      setAutoFilled(prev => ({ ...prev, driverName: false }))
                    }}
                    className="border-blue-300 focus:border-blue-500 bg-white"
                  />

                  <p className="text-xs text-blue-700 mt-1">
                    <LocalizedText>Enter the truck driver's name</LocalizedText>
                  </p>
                </div>
              </div>

              {/* Trailer Information Section */}
              <div className="border rounded-lg p-4 bg-orange-50">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-orange-600" />
                  Trailer Information (Optional)
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="trailerNumber" className="font-medium text-orange-700 text-sm">
                      <LocalizedText>Trailer Number</LocalizedText>
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search or enter trailer number"
                        value={formData.trailerNumber}
                        onChange={(e) => {
                          setFormData({ ...formData, trailerNumber: e.target.value })
                          setShowTrailerDropdown(e.target.value.length > 0)
                        }}
                        onFocus={() => setShowTrailerDropdown(formData.trailerNumber.length > 0)}
                        onBlur={() => setTimeout(() => setShowTrailerDropdown(false), 200)}
                        className={`pl-10 border-orange-300 focus:border-orange-500 bg-white ${autoFilled.trailerNumber ? 'ring-2 ring-green-300 border-green-400' : ''}`}
                      />
                      {showTrailerDropdown && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-orange-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {trailerNumbers
                            .filter(trailer => trailer.toLowerCase().includes(formData.trailerNumber.toLowerCase()))
                            .map((trailer) => (
                              <div
                                key={trailer}
                                className="px-3 py-2 hover:bg-orange-50 cursor-pointer text-sm"
                                onClick={() => {
                                  handleTrailerNumberChange(trailer)
                                  setShowTrailerDropdown(false)
                                }}
                              >
                                {trailer}
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                    {autoFilled.trailerNumber && (
                      <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                        <CheckCircle className="h-3 w-3" />
                        Auto-filled from vehicle data
                      </div>
                    )}
                    <p className="text-xs text-orange-600"><LocalizedText>Optional - Search or enter trailer number</LocalizedText></p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trailerQuantity" className="font-medium text-orange-700 text-sm">
                      <LocalizedText>Quantity</LocalizedText>
                    </Label>
                    <Input
                      id="trailerQuantity"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.trailerQuantity || ''}
                      onChange={(e) => setFormData({ ...formData, trailerQuantity: parseInt(e.target.value) || 0 })}
                      className="border-orange-300 focus:border-orange-500 bg-white"
                    />
                    <p className="text-xs text-orange-600"><LocalizedText>Number of trailer tires</LocalizedText></p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trailerTireSize" className="font-medium text-orange-700 text-sm">
                      <LocalizedText>Tire Size</LocalizedText>
                    </Label>
                    <Input
                      id="trailerTireSize"
                      placeholder="e.g., 385/65R22.5"
                      value={formData.trailerTireSize}
                      onChange={(e) => setFormData({ ...formData, trailerTireSize: e.target.value })}
                      className="border-orange-300 focus:border-orange-500 bg-white"
                    />
                    <p className="text-xs text-orange-600"><LocalizedText>Tire size for trailer</LocalizedText></p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="trailerManufacturer" className="font-medium text-orange-700 text-sm">
                      <LocalizedText>Manufacturer</LocalizedText>
                    </Label>
                    <Input
                      id="trailerManufacturer"
                      placeholder="e.g., GoodYear, Bridgestone"
                      value={formData.trailerManufacturer}
                      onChange={(e) => setFormData({ ...formData, trailerManufacturer: e.target.value })}
                      className="border-orange-300 focus:border-orange-500 bg-white"
                    />
                    <p className="text-xs text-orange-600"><LocalizedText>Tire manufacturer for trailer</LocalizedText></p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trailerOrigin" className="font-medium text-orange-700 text-sm">
                      <LocalizedText>Origin</LocalizedText>
                    </Label>
                    <Select value={formData.trailerOrigin} onValueChange={(value) => setFormData({ ...formData, trailerOrigin: value })}>
                      <SelectTrigger className="border-orange-300 focus:border-orange-500 bg-white">
                        <SelectValue placeholder="Select origin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CHINESE"><LocalizedText>Chinese</LocalizedText></SelectItem>
                        <SelectItem value="JAPANESE"><LocalizedText>Japanese</LocalizedText></SelectItem>
                        <SelectItem value="EUROPEAN"><LocalizedText>European</LocalizedText></SelectItem>
                        <SelectItem value="AMERICAN"><LocalizedText>American</LocalizedText></SelectItem>
                        <SelectItem value="OTHER"><LocalizedText>Other</LocalizedText></SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-orange-600"><LocalizedText>Country of manufacture</LocalizedText></p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trailerSerialNumber" className="font-medium text-orange-700 text-sm">
                      <LocalizedText>Serial Number</LocalizedText>
                    </Label>
                    <Input
                      id="trailerSerialNumber"
                      placeholder="e.g., TRL789012"
                      value={formData.trailerSerialNumber}
                      onChange={(e) => setFormData({ ...formData, trailerSerialNumber: e.target.value })}
                      className="border-orange-300 focus:border-orange-500 bg-white"
                    />
                    <p className="text-xs text-orange-600"><LocalizedText>Tire serial number (optional)</LocalizedText></p>
                  </div>
                </div>

                <div className="space-y-4 mt-4">

                  <div className="p-3 bg-orange-100 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-800 font-medium mb-1">📋 Important for Reports:</p>
                    <ul className="text-xs text-orange-700 space-y-1">
                      <li>• If tires are for TRUCK only → Leave trailer empty</li>
                      <li>• If tires are for TRAILER only → Select trailer number</li>
                      <li>• This ensures accurate reporting and inventory tracking</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Additional Information Section */}
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  Additional Information
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="createdAt" className="font-medium text-gray-700 text-sm">
                      <LocalizedText>Date & Time</LocalizedText>
                    </Label>
                    <Input
                      id="createdAt"
                      type="datetime-local"
                      value={formData.createdAt}
                      onChange={(e) => setFormData({ ...formData, createdAt: e.target.value })}
                      className="border-gray-200 focus:border-gray-400"
                    />
                    <p className="text-xs text-gray-500"><LocalizedText>When the tires were added</LocalizedText></p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="font-medium text-gray-700 text-sm">
                      <LocalizedText>Additional Notes</LocalizedText>
                    </Label>
                    <Input
                      id="notes"
                      placeholder="Additional notes about the tires..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="border-gray-200 focus:border-gray-400"
                    />
                    <p className="text-xs text-gray-500"><LocalizedText>Optional notes or special instructions</LocalizedText></p>
                  </div>
                </div>
              </div>
            </div>

            <PermissionGuard resource="tire-management" action="create">
              <div className="flex justify-center pt-4">
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full sm:w-auto"
                >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create {(() => {
                      const truckTires = (formData.tireSize && formData.manufacturer) ? formData.quantity : 0
                      const trailerTires = (formData.trailerTireSize && formData.trailerManufacturer) ? formData.trailerQuantity : 0
                      const total = truckTires + trailerTires
                      return `${total} Tire${total !== 1 ? 's' : ''}`
                    })()}
                  </>
                )}
                </Button>
              </div>
            </PermissionGuard>
          </form>
        </CardContent>
      </Card>

      {/* Matching Tires Preview */}
      {(formData.plateNumber || formData.trailerNumber || formData.driverName || formData.tireSize || formData.manufacturer) && (
        <Card className="border-green-200 shadow-sm">
          <CardHeader className="bg-green-50 border-b border-green-200">
            <CardTitle className="flex items-center gap-2 text-green-800">
              <Database className="h-5 w-5" />
              Matching Tires from Database
            </CardTitle>
            <p className="text-green-600 text-sm">
              <LocalizedText>Existing tires that match your search criteria</LocalizedText>
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingTires ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                <span className="ml-2 text-green-700"><LocalizedText>Searching tires...</LocalizedText></span>
              </div>
            ) : matchingTires.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Database className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="font-medium"><LocalizedText>No matching tires found</LocalizedText></p>
                <p className="text-sm"><LocalizedText>No existing tires match your current search criteria</LocalizedText></p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {matchingTires.map((tire) => (
                  <div key={tire.id} className="flex items-center justify-between p-4 border border-green-100 rounded-lg hover:bg-green-50 transition-colors">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <Package className="h-5 w-5 text-green-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-green-900">{tire.tireSize}</span>
                          <Badge variant="outline" className="text-xs">{tire.manufacturer}</Badge>
                          <Badge variant="secondary" className="text-xs">{tire.origin}</Badge>
                        </div>
                        <div className="text-sm text-green-700 space-y-1">
                          <div className="flex items-center gap-4">
                            {tire.plateNumber && (
                              <span className="flex items-center gap-1">
                                <Truck className="h-3 w-3" />
                                {tire.plateNumber}
                              </span>
                            )}
                            {tire.trailerNumber && (
                              <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                Trailer: {tire.trailerNumber}
                              </span>
                            )}
                            {tire.driverName && (
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {tire.driverName}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            Added: {new Date(tire.createdAt).toLocaleDateString()}
                            {tire.notes && ` • ${tire.notes}`}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Badge className="bg-green-100 text-green-800 border-green-200">
                        Qty: {tire.quantity}
                      </Badge>
                    </div>
                  </div>
                ))}
                <div className="text-center pt-3 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Found {matchingTires.length} matching tire{matchingTires.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

    </div>
  )
}
