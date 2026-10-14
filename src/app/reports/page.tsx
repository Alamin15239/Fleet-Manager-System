'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Download, FileText, BarChart3, Filter, Search, Calendar, Truck, User, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/currency'
import { apiGet } from '@/lib/api'
import { createMaintenancePdf, createMaintenanceWorkbook } from '@/lib/maintenance-report-export'

interface MaintenanceRecord {
  id: string
  truckId?: string
  serviceType: string
  description: string | null
  datePerformed: string
  partsCost: number
  laborCost: number
  totalCost: number
  status: string
  currentMileage?: number
  oilQuantityLiters?: number
  isOilChange?: boolean
  driverName?: string
  mechanicName?: string
  notes?: string
  truck?: {
    id: string
    make: string
    model: string
    year: number
    licensePlate: string
    currentMileage?: number
    driverName?: string
  }
  trailer?: {
    id: string
    number: string
    driverName?: string | null
  }
  mechanic?: {
    id: string
    name: string
    specialty?: string
  }
  maintenanceJob?: {
    id: string
    name: string
    category: string
  }
  createdBy?: {
    id: string
    name: string
    email: string
  }
}

interface ReportSummary {
  totalRecords: number
  totalCost: number
  totalPartsCost: number
  totalLaborCost: number
  averageCost: number
  completedCount: number
  inProgressCount: number
  scheduledCount: number
  serviceTypeBreakdown: Record<string, number>
  statusBreakdown: Record<string, number>
  monthlyBreakdown: Record<string, { count: number; cost: number }>
  mechanicBreakdown: Record<string, { count: number; cost: number }>
  vehicleBreakdown: Record<string, { count: number; cost: number }>
}

interface Truck {
  id: string
  make: string
  model: string
  year: number
  licensePlate: string
}

interface Trailer { id: string; number: string; driverName?: string | null }

interface Mechanic {
  id: string
  name: string
  specialty?: string
}

export default function ReportsPage() {
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [summary, setSummary] = useState<ReportSummary>({
    totalRecords: 0,
    totalCost: 0,
    totalPartsCost: 0,
    totalLaborCost: 0,
    averageCost: 0,
    completedCount: 0,
    inProgressCount: 0,
    scheduledCount: 0,
    serviceTypeBreakdown: {},
    statusBreakdown: {},
    monthlyBreakdown: {},
    mechanicBreakdown: {},
    vehicleBreakdown: {}
  })
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [trailers, setTrailers] = useState<Trailer[]>([])
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf')
  const [selectedRecords, setSelectedRecords] = useState<string[]>([])
  const [selectionActive, setSelectionActive] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all')
  const [truckFilter, setTruckFilter] = useState<string[]>([])
  const [trailerFilter, setTrailerFilter] = useState<string[]>([])
  const [mechanicFilter, setMechanicFilter] = useState('all')

  useEffect(() => {
    fetchMaintenance()
    fetchTrucks()
    fetchTrailers()
    fetchMechanics()
  }, [])

  useEffect(() => {
    fetchMaintenance()
  }, [startDate, endDate, searchTerm, statusFilter, serviceTypeFilter, truckFilter, trailerFilter, mechanicFilter])

  const fetchMaintenance = async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (serviceTypeFilter !== 'all') params.append('serviceType', serviceTypeFilter)
      truckFilter.forEach(id => params.append('truckIds', id))
      trailerFilter.forEach(id => params.append('trailerIds', id))
      if (mechanicFilter !== 'all') params.append('mechanicId', mechanicFilter)

      const response = await apiGet(`/api/maintenance/reports?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setMaintenance(data.data || [])
        setSummary(data.summary || {})
        setSelectedRecords([])
        setSelectionActive(false)
      }
    } catch (error) {
      console.error('Error fetching maintenance:', error)
      toast.error('Failed to fetch maintenance data')
    } finally {
      setLoading(false)
    }
  }

  const fetchTrucks = async () => {
    try {
      const response = await apiGet('/api/trucks?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setTrucks(data.trucks || [])
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

  const fetchTrailers = async () => {
    try {
      const response = await apiGet('/api/trailers?limit=1000')
      if (response.ok) {
        const data = await response.json()
        setTrailers(data.data || [])
      }
    } catch (error) { console.error('Error fetching trailers:', error) }
  }

  const getVehicleDisplay = (record: MaintenanceRecord) => {
    if (record.truck) {
      return `${record.truck.licensePlate} - ${record.truck.year} ${record.truck.make} ${record.truck.model}`
    }
    if (record.trailer) {
      return `Trailer ${record.trailer.number}`
    }
    return 'N/A'
  }

  const getDriverName = (record: MaintenanceRecord) => {
    // First check if maintenance record has driverName stored
    if (record.driverName) {
      return record.driverName
    }
    // Fallback to vehicle data
    if (record.truck?.driverName) {
      return record.truck.driverName
    }
    if (record.trailer?.driverName) {
      return record.trailer.driverName
    }
    return 'N/A'
  }

  const getSearchedMaintenance = () => {
    return maintenance // Already filtered by API
  }

  const getFilteredMaintenance = () => {
    const searched = getSearchedMaintenance()
    
    if (selectionActive) {
      return searched.filter(record => selectedRecords.includes(record.id))
    }
    
    return searched
  }

  const toggleRecord = (recordId: string) => {
    const currentSelection = selectionActive ? selectedRecords : getSearchedMaintenance().map(record => record.id)
    setSelectionActive(true)
    setSelectedRecords(currentSelection.includes(recordId)
      ? currentSelection.filter(id => id !== recordId)
      : [...currentSelection, recordId])
  }

  const selectAll = () => {
    const searched = getSearchedMaintenance()
    setSelectedRecords(searched.map(r => r.id))
    setSelectionActive(true)
  }

  const selectSearched = () => {
    const searched = getSearchedMaintenance()
    const newSelected = [...selectedRecords, ...searched.map(r => r.id).filter(id => !selectedRecords.includes(id))]
    setSelectedRecords(newSelected)
    setSelectionActive(true)
  }

  const clearSelection = () => {
    setSelectedRecords([])
    setSelectionActive(true)
  }

  const generateReport = async () => {
    setGenerating(true)
    let previewWindow: Window | null = null
    try {
      const filteredMaintenance = getFilteredMaintenance()
      
      if (format === 'pdf') {
        previewWindow = window.open('', '_blank')
        if (!previewWindow) throw new Error('Allow pop-ups to preview the PDF report.')
        previewWindow.document.write('<title>Preparing report</title><p style="font-family:Arial;padding:24px">Preparing your report…</p>')
        const blob = await createMaintenancePdf(filteredMaintenance, `${startDate || 'All time'} to ${endDate || 'Current'}`)
        const url = URL.createObjectURL(blob)
        previewWindow.location.href = url
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      } else {
        await exportMaintenanceExcel(filteredMaintenance)
      }
      
      toast.success('Report generated successfully')
    } catch (error) {
      previewWindow?.close()
      toast.error(error instanceof Error ? error.message : 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const downloadReport = async () => {
    setGenerating(true)
    try {
      const filteredMaintenance = getFilteredMaintenance()
      
      if (format === 'pdf') {
        const blob = await createMaintenancePdf(filteredMaintenance, `${startDate || 'All time'} to ${endDate || 'Current'}`)
        downloadBlob(blob, `maintenance-report-${new Date().toISOString().slice(0, 10)}.pdf`)
      } else {
        await exportMaintenanceExcel(filteredMaintenance)
      }
      
      toast.success('Report downloaded successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download report')
    } finally {
      setGenerating(false)
    }
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const exportMaintenanceExcel = async (data: MaintenanceRecord[]) => {
    const workbook = await createMaintenanceWorkbook(data)
    downloadBlob(workbook, `maintenance-report-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  const filteredMaintenance = getFilteredMaintenance()

  return (
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
            <FileText className="h-7 w-7 text-blue-600 sm:h-8 sm:w-8" />
            Maintenance Reports
          </h1>
          <p className="text-muted-foreground">Generate comprehensive maintenance reports with analytics</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{filteredMaintenance.length} matching records</Badge>
            <span>{selectionActive ? `${filteredMaintenance.length} selected for export` : 'All matching records included'}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={generateReport} disabled={generating || filteredMaintenance.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            {generating ? 'Preparing...' : format === 'pdf' ? 'Preview PDF' : 'Generate Excel'}
          </Button>
          <Button onClick={downloadReport} disabled={generating || filteredMaintenance.length === 0} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            {format === 'pdf' ? 'Download PDF' : 'Download Excel'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="filters" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="filters" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters & Settings
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Summary & Analytics
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Data Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="filters" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Date Range
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Report Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Format</Label>
                  <Select value={format} onValueChange={(value: 'pdf' | 'excel') => setFormat(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Report</SelectItem>
                      <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Select Records ({selectionActive ? selectedRecords.length : 'all'} selected)</Label>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={selectAll}>
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={selectSearched}>
                      Select Filtered
                    </Button>
                    <Button variant="outline" size="sm" onClick={clearSelection}>
                      Clear
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Advanced Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Search</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search records..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Service Type</Label>
                  <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Services</SelectItem>
                      <SelectItem value="oil">Oil Changes</SelectItem>
                      <SelectItem value="brake">Brake Service</SelectItem>
                      <SelectItem value="tire">Tire Service</SelectItem>
                      <SelectItem value="engine">Engine Service</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trucks (select any number)</Label>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                    {trucks.map(truck => <label key={truck.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={truckFilter.includes(truck.id)} onCheckedChange={checked => setTruckFilter(prev => checked ? [...prev, truck.id] : prev.filter(id => id !== truck.id))} />
                      <span>{truck.licensePlate} - {truck.year} {truck.make} {truck.model}</span>
                    </label>)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Trailers (select any number)</Label>
                  <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-2">
                    {trailers.map(trailer => <label key={trailer.id} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={trailerFilter.includes(trailer.id)} onCheckedChange={checked => setTrailerFilter(prev => checked ? [...prev, trailer.id] : prev.filter(id => id !== trailer.id))} />
                      <span>Trailer {trailer.number}</span>
                    </label>)}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mechanic</Label>
                  <Select value={mechanicFilter} onValueChange={setMechanicFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Mechanics</SelectItem>
                      {mechanics.map((mechanic) => (
                        <SelectItem key={mechanic.id} value={mechanic.id}>
                          {mechanic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalRecords}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</div>
                <p className="text-xs text-muted-foreground">
                  Parts: {formatCurrency(summary.totalPartsCost)} | Labor: {formatCurrency(summary.totalLaborCost)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Average Cost</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(summary.averageCost)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{summary.completedCount}</div>
                <p className="text-xs text-muted-foreground">
                  In Progress: {summary.inProgressCount} | Scheduled: {summary.scheduledCount}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Service Type Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(summary.serviceTypeBreakdown)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 8)
                    .map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center">
                      <span className="text-sm font-medium">{type}</span>
                      <Badge variant="secondary">{count} records</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Mechanics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(summary.mechanicBreakdown)
                    .sort(([,a], [,b]) => b.count - a.count)
                    .slice(0, 8)
                    .map(([mechanic, stats]) => (
                    <div key={mechanic} className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-medium">{mechanic}</span>
                        <p className="text-xs text-muted-foreground">{formatCurrency(stats.cost)} total</p>
                      </div>
                      <Badge variant="outline">{stats.count} jobs</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Records Preview</CardTitle>
              <CardDescription>
                {filteredMaintenance.length} records found
                {selectionActive && ` (${selectedRecords.length} selected for report)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[65vh] overflow-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 p-2 text-left">Select</th>
                      <th className="border border-gray-300 p-2 text-left">Date</th>
                      <th className="border border-gray-300 p-2 text-left">Vehicle</th>
                      <th className="border border-gray-300 p-2 text-left">Driver</th>
                      <th className="border border-gray-300 p-2 text-left">Service</th>
                      <th className="border border-gray-300 p-2 text-left">Mechanic</th>
                      <th className="border border-gray-300 p-2 text-left">Cost</th>
                      <th className="border border-gray-300 p-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSearchedMaintenance().map((record) => {
                      const isSelected = selectedRecords.includes(record.id)
                      return (
                        <tr key={record.id} className={isSelected ? 'bg-blue-50' : ''}>
                          <td className="border border-gray-300 p-2">
                            <Checkbox
                              checked={selectionActive ? isSelected : true}
                              onCheckedChange={() => toggleRecord(record.id)}
                            />
                          </td>
                          <td className="border border-gray-300 p-2">
                            {new Date(record.datePerformed).toLocaleDateString()}
                          </td>
                          <td className="border border-gray-300 p-2">
                            {getVehicleDisplay(record)}
                          </td>
                          <td className="border border-gray-300 p-2">{getDriverName(record)}</td>
                          <td className="border border-gray-300 p-2">
                            <div>
                              <div className="font-medium">{record.serviceType}</div>
                              {record.description && (
                                <div className="text-xs text-gray-500 truncate max-w-32">
                                  {record.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="border border-gray-300 p-2">
                            {record.mechanic?.name || record.mechanicName || 'N/A'}
                          </td>
                          <td className="border border-gray-300 p-2 font-medium">
                            {formatCurrency(record.totalCost)}
                          </td>
                          <td className="border border-gray-300 p-2">
                            <Badge 
                              variant={record.status === 'COMPLETED' ? 'default' : 
                                      record.status === 'IN_PROGRESS' ? 'secondary' : 'outline'}
                            >
                              {record.status}
                            </Badge>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <p className="text-sm text-gray-500 mt-2">
                  Showing all {getSearchedMaintenance().length} records
                  {searchTerm && ` (filtered from ${maintenance.length} total)`}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>


    </div>
  )
}
