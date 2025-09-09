'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Search, Droplets, Calendar, Truck, User, BarChart3, Plus, Filter } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { toast } from 'sonner'

interface OilChangeRecord {
  id: string
  datePerformed: string
  serviceType: string
  description: string
  totalCost: number
  partsCost: number
  laborCost: number
  status: string
  currentMileage?: number
  oilQuantityLiters?: number
  oilChangeInterval?: number
  nextServiceDue?: string
  truck?: {
    id: string
    year: number
    make: string
    model: string
    licensePlate: string
    currentMileage?: number
  }
  mechanic?: {
    id: string
    name: string
  }
  driverName?: string
  mechanicName?: string
  notes?: string
}

interface Truck {
  id: string
  make: string
  model: string
  year: number
  licensePlate: string
  currentMileage: number
}

interface Mechanic {
  id: string
  name: string
  specialty?: string
}

export default function OilChangesPage() {
  const [oilChanges, setOilChanges] = useState<OilChangeRecord[]>([])
  const [filteredRecords, setFilteredRecords] = useState<OilChangeRecord[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState({
    totalRecords: 0,
    totalCost: 0,
    totalOilUsed: 0,
    completedCount: 0,
    inProgressCount: 0,
    recordsWithOilQuantity: 0,
    averageCost: 0,
    averageOilPerChange: 0
  })
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchOilChanges()
    fetchTrucks()
    fetchMechanics()
  }, [])

  useEffect(() => {
    filterRecords()
  }, [oilChanges, searchTerm, statusFilter])

  const fetchOilChanges = async () => {
    try {
      const response = await apiGet('/api/oil-changes?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setOilChanges(data.data || [])
        setSummary(data.summary || {})
      }
    } catch (error) {
      console.error('Error fetching oil changes:', error)
      toast.error('Failed to fetch oil change records')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrucks = async () => {
    try {
      const response = await apiGet('/api/trucks?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setTrucks(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching trucks:', error)
    }
  }

  const fetchMechanics = async () => {
    try {
      const response = await apiGet('/api/mechanics?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setMechanics(data.mechanics || [])
      }
    } catch (error) {
      console.error('Error fetching mechanics:', error)
    }
  }

  const filterRecords = () => {
    let filtered = oilChanges

    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.truck?.licensePlate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.truck?.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.truck?.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.driverName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.mechanic?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.mechanicName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.status?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(record => record.status === statusFilter)
    }

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

  const handleAddOilChange = async (formData: FormData) => {
    setIsSubmitting(true)
    try {
      const data = {
        truckId: formData.get('truckId'),
        serviceType: formData.get('serviceType') || 'Oil Change',
        description: formData.get('description'),
        datePerformed: formData.get('datePerformed'),
        partsCost: formData.get('partsCost'),
        laborCost: formData.get('laborCost'),
        mechanicId: formData.get('mechanicId'),
        mechanicName: formData.get('mechanicName'),
        driverName: formData.get('driverName'),
        currentMileage: formData.get('currentMileage'),
        oilQuantityLiters: formData.get('oilQuantityLiters'),
        oilChangeInterval: formData.get('oilChangeInterval'),
        nextServiceDue: formData.get('nextServiceDue'),
        status: formData.get('status') || 'COMPLETED',
        notes: formData.get('notes')
      }

      const response = await apiPost('/api/oil-changes', data)
      if (response.ok) {
        toast.success('Oil change record added successfully')
        setIsAddDialogOpen(false)
        fetchOilChanges()
      } else {
        toast.error('Failed to add oil change record')
      }
    } catch (error) {
      console.error('Error adding oil change:', error)
      toast.error('Failed to add oil change record')
    } finally {
      setIsSubmitting(false)
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
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Oil Change
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Oil Change Record</DialogTitle>
            </DialogHeader>
            <form action={handleAddOilChange} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="truckId">Vehicle *</Label>
                  <Select name="truckId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select vehicle" />
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
                <div className="space-y-2">
                  <Label htmlFor="datePerformed">Service Date *</Label>
                  <Input
                    name="datePerformed"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().split('T')[0]}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentMileage">Current Mileage</Label>
                  <Input name="currentMileage" type="number" placeholder="e.g., 45000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oilQuantityLiters">Oil Quantity (Liters)</Label>
                  <Input name="oilQuantityLiters" type="number" step="0.1" placeholder="e.g., 5.5" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="partsCost">Parts Cost</Label>
                  <Input name="partsCost" type="number" step="0.01" placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laborCost">Labor Cost</Label>
                  <Input name="laborCost" type="number" step="0.01" placeholder="0.00" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mechanicId">Mechanic</Label>
                  <Select name="mechanicId">
                    <SelectTrigger>
                      <SelectValue placeholder="Select mechanic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No mechanic assigned</SelectItem>
                      {mechanics.map((mechanic) => (
                        <SelectItem key={mechanic.id} value={mechanic.id}>
                          {mechanic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverName">Driver Name</Label>
                  <Input name="driverName" placeholder="Driver name" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="oilChangeInterval">Next Change Interval (km)</Label>
                  <Input name="oilChangeInterval" type="number" placeholder="e.g., 10000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextServiceDue">Next Service Due</Label>
                  <Input name="nextServiceDue" type="date" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input name="description" placeholder="Regular oil change service" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea name="notes" placeholder="Additional notes..." rows={3} />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Adding...' : 'Add Oil Change'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Oil Changes</CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRecords}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary.completedCount}
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
              {summary.inProgressCount}
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
              {summary.totalOilUsed.toFixed(1)}L
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.recordsWithOilQuantity} of {summary.totalRecords} with quantity
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
              {formatCurrency(summary.totalCost)}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(summary.averageCost)}
            </p>
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
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by vehicle, driver, mechanic, or status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              </SelectContent>
            </Select>
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
                    <TableHead>Oil Used</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Mechanic</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-gray-500">
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
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.currentMileage ? (
                            <span className="font-mono">
                              {record.currentMileage.toLocaleString()} km
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.oilQuantityLiters ? (
                            <span className="font-medium text-blue-600">
                              {record.oilQuantityLiters}L
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.driverName || <span className="text-gray-400">-</span>}
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