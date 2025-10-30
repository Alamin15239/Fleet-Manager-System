'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  ChevronDown, 
  ChevronRight, 
  Truck, 
  Package, 
  User,
  Calendar,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react'
import { format } from 'date-fns'
import { apiGet } from '@/lib/api'
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
}

interface GroupedTires {
  [key: string]: {
    vehicleInfo: {
      plateNumber?: string
      trailerNumber?: string
      driverName?: string
      type: 'truck' | 'trailer'
    }
    tires: Tire[]
    totalQuantity: number
  }
}

export default function TireInventoryGrouped() {
  const [groupedTires, setGroupedTires] = useState<GroupedTires>({})
  const [loading, setLoading] = useState(true)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedManufacturer, setSelectedManufacturer] = useState('')
  const [selectedOrigin, setSelectedOrigin] = useState('')
  const [vehicleType, setVehicleType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const { refreshData } = useRealTime()

  useEffect(() => {
    fetchAndGroupTires()
  }, [])

  useEffect(() => {
    fetchAndGroupTires()
  }, [refreshData])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchAndGroupTires()
    }, 500)
    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedManufacturer, selectedOrigin, dateFrom, dateTo])

  const fetchAndGroupTires = async () => {
    try {
      const params = new URLSearchParams({ limit: '1000' })
      if (selectedManufacturer && selectedManufacturer !== 'all') params.append('manufacturer', selectedManufacturer)
      if (selectedOrigin && selectedOrigin !== 'all') params.append('origin', selectedOrigin)
      if (searchTerm) params.append('search', searchTerm)
      if (dateFrom) params.append('dateFrom', dateFrom)
      if (dateTo) params.append('dateTo', dateTo)
      
      const response = await apiGet(`/api/tires?${params}`)
      if (response.ok) {
        const data = await response.json()
        const grouped = groupTiresByVehicle(data.tires)
        setGroupedTires(grouped)
        
        // Extract manufacturers for filter
        const uniqueManufacturers = [...new Set(data.tires.map(t => t.manufacturer))]
        setManufacturers(uniqueManufacturers)
      }
    } catch (error) {
      console.error('Error fetching tires:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupTiresByVehicle = (tires: Tire[]): GroupedTires => {
    const grouped: GroupedTires = {}

    let filteredTires = tires
    if (vehicleType === 'truck') {
      filteredTires = tires.filter(t => t.plateNumber && !t.trailerNumber)
    } else if (vehicleType === 'trailer') {
      filteredTires = tires.filter(t => t.trailerNumber)
    }

    filteredTires.forEach(tire => {
      let key: string
      let vehicleInfo: any

      if (tire.trailerNumber) {
        // Trailer tire
        key = `trailer-${tire.trailerNumber}`
        vehicleInfo = {
          trailerNumber: tire.trailerNumber,
          driverName: tire.driverName,
          type: 'trailer' as const
        }
      } else if (tire.plateNumber) {
        // Truck tire
        key = `truck-${tire.plateNumber}`
        vehicleInfo = {
          plateNumber: tire.plateNumber,
          driverName: tire.driverName,
          type: 'truck' as const
        }
      } else {
        // Unassigned tire
        key = 'unassigned'
        vehicleInfo = {
          type: 'truck' as const
        }
      }

      if (!grouped[key]) {
        grouped[key] = {
          vehicleInfo,
          tires: [],
          totalQuantity: 0
        }
      }

      grouped[key].tires.push(tire)
      grouped[key].totalQuantity += tire.quantity
    })

    return grouped
  }

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(key)) {
      newExpanded.delete(key)
    } else {
      newExpanded.add(key)
    }
    setExpandedGroups(newExpanded)
  }

  const getOriginColor = (origin: string) => {
    switch (origin) {
      case 'JAPANESE': return 'bg-blue-100 text-blue-800'
      case 'CHINESE': return 'bg-red-100 text-red-800'
      case 'EUROPEAN': return 'bg-green-100 text-green-800'
      case 'AMERICAN': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-6">
            <div className="space-y-2 sm:col-span-2 md:col-span-1">
              <Label className="text-sm">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search vehicles, drivers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">Vehicle Type</Label>
              <Select value={vehicleType} onValueChange={setVehicleType}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="truck">Trucks only</SelectItem>
                  <SelectItem value="trailer">Trailers only</SelectItem>
                </SelectContent>
              </Select>
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
                  <SelectItem value="CHINESE">Chinese</SelectItem>
                  <SelectItem value="JAPANESE">Japanese</SelectItem>
                  <SelectItem value="EUROPEAN">European</SelectItem>
                  <SelectItem value="AMERICAN">American</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">Date From</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">Date To</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm">Actions</Label>
              <Button variant="outline" onClick={fetchAndGroupTires} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tires by Vehicle</h2>
          <p className="text-muted-foreground">
            {Object.keys(groupedTires).length} vehicles with tires
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {Object.entries(groupedTires).map(([key, group]) => (
          <Card key={key} className="overflow-hidden">
            <Collapsible 
              open={expandedGroups.has(key)} 
              onOpenChange={() => toggleGroup(key)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {group.vehicleInfo.type === 'trailer' ? (
                        <div className="flex items-center gap-2">
                          <Package className="h-5 w-5 text-orange-600" />
                          <div>
                            <div className="font-semibold text-orange-900">
                              Trailer {group.vehicleInfo.trailerNumber}
                            </div>
                            {group.vehicleInfo.driverName && (
                              <div className="text-sm text-gray-600 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {group.vehicleInfo.driverName}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Truck className="h-5 w-5 text-blue-600" />
                          <div>
                            <div className="font-semibold text-blue-900">
                              {group.vehicleInfo.plateNumber ? 
                                `Truck ${group.vehicleInfo.plateNumber}` : 
                                'Unassigned Tires'
                              }
                            </div>
                            {group.vehicleInfo.driverName && (
                              <div className="text-sm text-gray-600 flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {group.vehicleInfo.driverName}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {group.tires.length} tire{group.tires.length !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="outline">
                          Total Qty: {group.totalQuantity}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {expandedGroups.has(key) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {group.tires.map((tire) => (
                      <div key={tire.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{tire.manufacturer}</span>
                              <Badge className={getOriginColor(tire.origin)}>
                                {tire.origin}
                              </Badge>
                            </div>
                            
                            <div className="text-sm text-gray-600 space-y-1">
                              <div>Size: {tire.tireSize}</div>
                              <div>Quantity: {tire.quantity}</div>
                              {tire.serialNumber && (
                                <div>Serial: {tire.serialNumber}</div>
                              )}
                              {tire.notes && (
                                <div>Notes: {tire.notes}</div>
                              )}
                            </div>
                          </div>
                          
                          <div className="text-right text-xs text-gray-500">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(tire.createdAt), 'MMM dd, yyyy')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
      </div>

      {Object.keys(groupedTires).length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No tires found</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}