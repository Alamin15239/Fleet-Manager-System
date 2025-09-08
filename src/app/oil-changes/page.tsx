'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Droplets, Calendar, Truck, User, BarChart3 } from 'lucide-react'
import { apiGet } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'

interface OilChangeRecord {
  id: string
  datePerformed: string
  serviceType: string
  description: string
  totalCost: number
  status: string
  currentMileage?: number
  truck?: {
    year: number
    make: string
    model: string
    licensePlate: string
    currentMileage?: number
  }
  trailer?: {
    number: string
    driverName?: string
  }
  mechanic?: {
    name: string
  }
  driverName?: string
  mechanicName?: string
  vehicleName?: string
}

export default function OilChangesPage() {
  const [oilChanges, setOilChanges] = useState<OilChangeRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<OilChangeRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOilChanges()
  }, [])

  useEffect(() => {
    filterRecords()
  }, [oilChanges, searchTerm])

  const fetchOilChanges = async () => {
    try {
      const response = await apiGet('/api/maintenance?limit=1000')
      if (response.ok) {
        const data = await response.json()
        const oilChangeRecords = data.data.filter((record: OilChangeRecord) => 
          record.serviceType?.toLowerCase().includes('oil change') ||
          record.description?.toLowerCase().includes('oil') ||
          record.description?.toLowerCase().includes('engine oil')
        )
        setOilChanges(oilChangeRecords)
      }
    } catch (error) {
      console.error('Error fetching oil changes:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterRecords = () => {
    if (!searchTerm) {
      setFilteredRecords(oilChanges)
      return
    }

    const filtered = oilChanges.filter(record => 
      record.truck?.licensePlate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.truck?.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.trailer?.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.trailer?.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.mechanic?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.mechanicName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.status?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredRecords(filtered)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
      case 'SCHEDULED': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  // Calculate mechanic statistics
  const mechanicStats = oilChanges.reduce((acc, record) => {
    const mechanicName = record.mechanic?.name || record.mechanicName || 'Unknown'
    acc[mechanicName] = (acc[mechanicName] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Calculate monthly statistics
  const monthlyStats = oilChanges.reduce((acc, record) => {
    const month = new Date(record.datePerformed).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    acc[month] = (acc[month] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // Calculate yearly statistics
  const yearlyStats = oilChanges.reduce((acc, record) => {
    const year = new Date(record.datePerformed).getFullYear().toString()
    acc[year] = (acc[year] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Droplets className="h-8 w-8 text-blue-600" />
            Oil Changes
          </h1>
          <p className="text-muted-foreground">Track and manage all oil change maintenance records</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Oil Changes</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{oilChanges.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {oilChanges.filter(r => r.status === 'COMPLETED').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {oilChanges.filter(r => r.status === 'IN_PROGRESS').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Oil Used</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {oilChanges.reduce((sum, r) => sum + (r.oilQuantityLiters || 0), 0).toFixed(1)}L
            </div>
            <p className="text-xs text-muted-foreground">
              {oilChanges.filter(r => r.oilQuantityLiters && r.oilQuantityLiters > 0).length} of {oilChanges.length} with quantity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(oilChanges.reduce((sum, r) => sum + r.totalCost, 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Section */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Mechanic Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Mechanic Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(mechanicStats)
                .sort(([,a], [,b]) => b - a)
                .map(([mechanic, count]) => (
                <div key={mechanic} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{mechanic}</span>
                  <Badge variant="secondary">{count} oil changes</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Monthly Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(monthlyStats)
                .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
                .map(([month, count]) => (
                <div key={month} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{month}</span>
                  <Badge variant="outline">{count} changes</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Yearly Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Yearly Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(yearlyStats)
                .sort(([a], [b]) => parseInt(b) - parseInt(a))
                .map(([year, count]) => (
                <div key={year} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{year}</span>
                  <Badge variant="default">{count} changes</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by vehicle, driver, mechanic, or status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Oil Change Records
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Showing {filteredRecords.length} oil change records
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading oil change records...</div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Odometer</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Mechanic</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        No oil change records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {new Date(record.datePerformed).toLocaleDateString('en-US', {
                            month: 'short',
                            day: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Droplets className="h-4 w-4 text-blue-600" />
                            <div>
                              <div className="font-medium">{record.serviceType}</div>
                              {record.description && (
                                <div className="text-sm text-gray-500 truncate max-w-48">
                                  {record.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {record.truck ? (
                            <div>
                              <div className="font-medium">
                                {record.truck.year} {record.truck.make} {record.truck.model}
                              </div>
                              <div className="text-sm text-gray-500">
                                {record.truck.licensePlate}
                              </div>
                            </div>
                          ) : record.trailer ? (
                            <div>
                              <div className="font-medium">Trailer {record.trailer.number}</div>
                            </div>
                          ) : record.vehicleName ? (
                            <div className="font-medium">{record.vehicleName}</div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.currentMileage || record.truck?.currentMileage ? (
                            <span className="font-mono">
                              {(record.currentMileage || record.truck?.currentMileage)?.toLocaleString()} km
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.driverName || record.trailer?.driverName || <span className="text-gray-400">-</span>}
                        </TableCell>
                        <TableCell>
                          {record.mechanic?.name || record.mechanicName || <span className="text-gray-400">-</span>}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(record.totalCost)}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(record.status)}>
                            {record.status.replace('_', ' ')}
                          </Badge>
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