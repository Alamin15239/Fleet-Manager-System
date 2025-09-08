'use client'

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

interface Vehicle {
  id: string
  plateNumber: string
  trailerNumber: string | null
  driverName: string | null
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
    origin: 'JAPANESE',
    plateNumber: '',
    trailerNumber: '',
    driverName: '',
    quantity: 0,
    serialNumber: '',
    trailerTireSize: '',
    trailerManufacturer: '',
    trailerOrigin: 'JAPANESE',
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
  const [searchTerm, setSearchTerm] = useState('')
  const [showPlateDropdown, setShowPlateDropdown] = useState(false)
  const [showTrailerDropdown, setShowTrailerDropdown] = useState(false)
  const [autoFilled, setAutoFilled] = useState({
    driverName: false,
    trailerNumber: false
  })
  const [matchingTires, setMatchingTires] = useState<Tire[]>([])
  const [loadingTires, setLoadingTires] = useState(false)

  useEffect(() => {
    fetchVehicles()
  }, [])

  useEffect(() => {
    searchMatchingTires()
  }, [formData.plateNumber, formData.trailerNumber, formData.driverName, formData.tireSize, formData.manufacturer])

  const fetchVehicles = async () => {
    try {
      const response = await apiGet('/api/vehicles')
      if (response.ok) {
        const data = await response.json()
        const vehicleList = data.vehicles || []
        setVehicles(vehicleList)
        
        // Extract unique plate numbers and trailer numbers from vehicles
        const plates = [...new Set(vehicleList.map(v => v.plateNumber))]
        const trailers = [...new Set(vehicleList.map(v => v.trailerNumber).filter(Boolean))]
        
        setPlateNumbers(plates)
        setTrailerNumbers(trailers)
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    }
  }

  const searchMatchingTires = async () => {
    // Only search if at least one field has value
    const hasSearchCriteria = formData.plateNumber || formData.trailerNumber || formData.driverName || formData.tireSize || formData.manufacturer
    
    if (!hasSearchCriteria) {
      setMatchingTires([])
      return
    }

    setLoadingTires(true)
    try {
      const params = new URLSearchParams()
      if (formData.plateNumber) params.append('plateNumber', formData.plateNumber)
      if (formData.trailerNumber) params.append('trailerNumber', formData.trailerNumber)
      if (formData.driverName) params.append('driverName', formData.driverName)
      if (formData.tireSize) params.append('tireSize', formData.tireSize)
      if (formData.manufacturer) params.append('manufacturer', formData.manufacturer)
      
      const response = await apiGet(`/api/tires/search?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setMatchingTires(data.tires || [])
      }
    } catch (error) {
      console.error('Error searching tires:', error)
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
      console.log('Submitting tire creation form...')
      const response = await apiPost('/api/tires', formData)

      if (response.ok) {
        const data = await response.json()
        console.log('Tire creation successful:', data)
        const totalTires = (formData.tireSize && formData.manufacturer ? formData.quantity : 0) + 
                          (formData.trailerTireSize && formData.trailerManufacturer ? formData.trailerQuantity : 0)
        setSuccess(`Successfully created ${totalTires} tire(s)`)
        
        // Reset form
        setFormData({
          tireSize: '',
          manufacturer: '',
          origin: 'JAPANESE',
          plateNumber: '',
          trailerNumber: '',
          driverName: '',
          quantity: 0,
          serialNumber: '',
          trailerTireSize: '',
          trailerManufacturer: '',
          trailerOrigin: 'JAPANESE',
          trailerQuantity: 0,
          trailerSerialNumber: '',
          notes: '',
          createdAt: new Date().toISOString().slice(0, 16)
        })
        
        // Refresh data
        fetchVehicles()
        
        // Redirect to list page after 1.5 seconds
        setTimeout(() => {
          window.location.href = '/tire-management?tab=inventory'
        }, 1500)
      } else {
        const errorData = await response.json()
        console.error('Tire creation failed:', errorData)
        setError(errorData.error || 'Failed to create tires')
        
        // If authentication error, redirect to login
        if (response.status === 401) {
          console.log('Authentication error, redirecting to login')
          window.location.href = '/login'
        }
      }
    } catch (error) {
      console.error('Error creating tires:', error)
      setError('Failed to create tires')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredVehicles = vehicles.filter(vehicle =>
    vehicle.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.trailerNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    vehicle.driverName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
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
                      Truck Plate Number
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
                    <p className="text-xs text-blue-600">Optional - Search or enter truck plate number</p>
                  </div>



                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="font-medium text-blue-700 text-sm">
                      Quantity
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.quantity || ''}
                      onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                      className="border-blue-300 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-blue-600">Number of tires</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="truckTireSize" className="font-medium text-blue-700 text-sm">
                      Tire Size
                    </Label>
                    <Input
                      id="truckTireSize"
                      placeholder="e.g., 295/80R22.5"
                      value={formData.tireSize}
                      onChange={(e) => setFormData({ ...formData, tireSize: e.target.value })}
                      className="border-blue-300 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-blue-600">Tire size for truck</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="truckManufacturer" className="font-medium text-blue-700 text-sm">
                      Manufacturer
                    </Label>
                    <Input
                      id="truckManufacturer"
                      placeholder="e.g., GoodYear, Bridgestone"
                      value={formData.manufacturer}
                      onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                      className="border-blue-300 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-blue-600">Tire manufacturer for truck</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="truckOrigin" className="font-medium text-blue-700 text-sm">
                      Origin
                    </Label>
                    <Select value={formData.origin} onValueChange={(value) => setFormData({ ...formData, origin: value })}>
                      <SelectTrigger className="border-blue-300 focus:border-blue-500 bg-white">
                        <SelectValue placeholder="Select origin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JAPANESE">Japanese</SelectItem>
                        <SelectItem value="EUROPEAN">European</SelectItem>
                        <SelectItem value="AMERICAN">American</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-blue-600">Country of manufacture</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="truckSerialNumber" className="font-medium text-blue-700 text-sm">
                      Serial Number
                    </Label>
                    <Input
                      id="truckSerialNumber"
                      placeholder="e.g., TRK123456"
                      value={formData.serialNumber}
                      onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                      className="border-blue-300 focus:border-blue-500 bg-white"
                    />
                    <p className="text-xs text-blue-600">Tire serial number (optional)</p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-100 rounded-lg border border-blue-300">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-blue-700" />
                    <Label htmlFor="driverName" className="font-medium text-blue-800">
                      Truck Driver
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
                    Enter the truck driver's name
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
                      Trailer Number
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
                    <p className="text-xs text-orange-600">Optional - Search or enter trailer number</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trailerQuantity" className="font-medium text-orange-700 text-sm">
                      Quantity
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
                    <p className="text-xs text-orange-600">Number of trailer tires</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trailerTireSize" className="font-medium text-orange-700 text-sm">
                      Tire Size
                    </Label>
                    <Input
                      id="trailerTireSize"
                      placeholder="e.g., 385/65R22.5"
                      value={formData.trailerTireSize}
                      onChange={(e) => setFormData({ ...formData, trailerTireSize: e.target.value })}
                      className="border-orange-300 focus:border-orange-500 bg-white"
                    />
                    <p className="text-xs text-orange-600">Tire size for trailer</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="trailerManufacturer" className="font-medium text-orange-700 text-sm">
                      Manufacturer
                    </Label>
                    <Input
                      id="trailerManufacturer"
                      placeholder="e.g., GoodYear, Bridgestone"
                      value={formData.trailerManufacturer}
                      onChange={(e) => setFormData({ ...formData, trailerManufacturer: e.target.value })}
                      className="border-orange-300 focus:border-orange-500 bg-white"
                    />
                    <p className="text-xs text-orange-600">Tire manufacturer for trailer</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trailerOrigin" className="font-medium text-orange-700 text-sm">
                      Origin
                    </Label>
                    <Select value={formData.trailerOrigin} onValueChange={(value) => setFormData({ ...formData, trailerOrigin: value })}>
                      <SelectTrigger className="border-orange-300 focus:border-orange-500 bg-white">
                        <SelectValue placeholder="Select origin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JAPANESE">Japanese</SelectItem>
                        <SelectItem value="EUROPEAN">European</SelectItem>
                        <SelectItem value="AMERICAN">American</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-orange-600">Country of manufacture</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="trailerSerialNumber" className="font-medium text-orange-700 text-sm">
                      Serial Number
                    </Label>
                    <Input
                      id="trailerSerialNumber"
                      placeholder="e.g., TRL789012"
                      value={formData.trailerSerialNumber}
                      onChange={(e) => setFormData({ ...formData, trailerSerialNumber: e.target.value })}
                      className="border-orange-300 focus:border-orange-500 bg-white"
                    />
                    <p className="text-xs text-orange-600">Tire serial number (optional)</p>
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
                      Date & Time
                    </Label>
                    <Input
                      id="createdAt"
                      type="datetime-local"
                      value={formData.createdAt}
                      onChange={(e) => setFormData({ ...formData, createdAt: e.target.value })}
                      className="border-gray-200 focus:border-gray-400"
                    />
                    <p className="text-xs text-gray-500">When the tires were added</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="font-medium text-gray-700 text-sm">
                      Additional Notes
                    </Label>
                    <Input
                      id="notes"
                      placeholder="Additional notes about the tires..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      className="border-gray-200 focus:border-gray-400"
                    />
                    <p className="text-xs text-gray-500">Optional notes or special instructions</p>
                  </div>
                </div>
              </div>
            </div>

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
              Existing tires that match your search criteria
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            {loadingTires ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                <span className="ml-2 text-green-700">Searching tires...</span>
              </div>
            ) : matchingTires.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Database className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                <p className="font-medium">No matching tires found</p>
                <p className="text-sm">No existing tires match your current search criteria</p>
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

      {/* Enhanced Vehicle Reference Card */}
      <Card className="border-blue-200 shadow-sm">
        <CardHeader className="bg-blue-50 border-b border-blue-200">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Truck className="h-5 w-5" />
            Vehicle & Driver Reference
          </CardTitle>
          <p className="text-blue-600 text-sm">
            Quick reference for available vehicles and their assigned drivers
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search vehicles by plate, trailer, or driver..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-blue-200 focus:border-blue-400"
              />
            </div>
            
            <div className="max-h-96 overflow-y-auto space-y-3">
              {filteredVehicles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Truck className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="font-medium">No vehicles found</p>
                  <p className="text-sm">Try adjusting your search criteria</p>
                </div>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <div key={vehicle.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border border-blue-100 rounded-lg hover:bg-blue-50 transition-colors gap-3 sm:gap-0">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <div className="flex-shrink-0">
                        <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span className="font-semibold text-blue-900 text-sm sm:text-base">{vehicle.plateNumber}</span>
                          <Badge variant="outline" className="text-xs w-fit">
                            {vehicle.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="text-xs sm:text-sm text-blue-700 mt-1">
                          {vehicle.trailerNumber && (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-medium">Trailer:</span> {vehicle.trailerNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-end sm:justify-start">
                      {vehicle.driverName ? (
                        <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800 border-green-200 text-xs">
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-24 sm:max-w-none">{vehicle.driverName}</span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500 border-gray-300 text-xs">
                          <User className="h-3 w-3 mr-1" />
                          Unassigned
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            {filteredVehicles.length > 0 && (
              <div className="text-center pt-3 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  Showing {filteredVehicles.length} vehicle{filteredVehicles.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}