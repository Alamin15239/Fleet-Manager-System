'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  ChevronDown, 
  ChevronRight, 
  Truck, 
  Package, 
  User,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { format } from 'date-fns'
import { apiGet } from '@/lib/api'

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

  useEffect(() => {
    fetchAndGroupTires()
  }, [])

  const fetchAndGroupTires = async () => {
    try {
      const response = await apiGet('/api/tires?limit=1000') // Get all tires
      if (response.ok) {
        const data = await response.json()
        const grouped = groupTiresByVehicle(data.tires)
        setGroupedTires(grouped)
      }
    } catch (error) {
      console.error('Error fetching tires:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupTiresByVehicle = (tires: Tire[]): GroupedTires => {
    const grouped: GroupedTires = {}

    tires.forEach(tire => {
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
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tires by Vehicle</h2>
          <p className="text-muted-foreground">
            {Object.keys(groupedTires).length} vehicles with tires
          </p>
        </div>
        <Button variant="outline" onClick={fetchAndGroupTires}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
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