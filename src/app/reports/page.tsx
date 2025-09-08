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
  const [mechanics, setMechanics] = useState<Mechanic[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf')
  const [selectedRecords, setSelectedRecords] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all')
  const [truckFilter, setTruckFilter] = useState('all')
  const [mechanicFilter, setMechanicFilter] = useState('all')

  useEffect(() => {
    fetchMaintenance()
    fetchTrucks()
    fetchMechanics()
  }, [])

  useEffect(() => {
    fetchMaintenance()
  }, [startDate, endDate, searchTerm, statusFilter, serviceTypeFilter, truckFilter, mechanicFilter])

  const fetchMaintenance = async () => {
    try {
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      if (searchTerm) params.append('search', searchTerm)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (serviceTypeFilter !== 'all') params.append('serviceType', serviceTypeFilter)
      if (truckFilter !== 'all') params.append('truckId', truckFilter)
      if (mechanicFilter !== 'all') params.append('mechanicId', mechanicFilter)

      const response = await apiGet(`/api/maintenance/reports?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setMaintenance(data.data || [])
        setSummary(data.summary || {})
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
    
    if (selectedRecords.length > 0) {
      return searched.filter(record => selectedRecords.includes(record.id))
    }
    
    return searched
  }

  const toggleRecord = (recordId: string) => {
    setSelectedRecords(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    )
  }

  const selectAll = () => {
    const searched = getSearchedMaintenance()
    setSelectedRecords(searched.map(r => r.id))
  }

  const selectSearched = () => {
    const searched = getSearchedMaintenance()
    const newSelected = [...selectedRecords, ...searched.map(r => r.id).filter(id => !selectedRecords.includes(id))]
    setSelectedRecords(newSelected)
  }

  const clearSelection = () => {
    setSelectedRecords([])
  }

  const generateReport = async () => {
    setGenerating(true)
    try {
      const filteredMaintenance = getFilteredMaintenance()
      
      if (format === 'pdf') {
        generatePDF(filteredMaintenance)
      } else {
        generateExcel(filteredMaintenance)
      }
      
      toast.success('Report generated successfully')
    } catch (error) {
      toast.error('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const downloadReport = async () => {
    setGenerating(true)
    try {
      const filteredMaintenance = getFilteredMaintenance()
      
      if (format === 'pdf') {
        downloadPDF(filteredMaintenance)
      } else {
        generateExcel(filteredMaintenance)
      }
      
      toast.success('Report downloaded successfully')
    } catch (error) {
      toast.error('Failed to download report')
    } finally {
      setGenerating(false)
    }
  }

  const downloadPDF = (data: MaintenanceRecord[]) => {
    const totalCost = data.reduce((sum, record) => sum + record.totalCost, 0)
    const totalParts = data.reduce((sum, record) => sum + record.partsCost, 0)
    const totalLabor = data.reduce((sum, record) => sum + record.laborCost, 0)

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fleet Maintenance Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary { background-color: #f9f9f9; padding: 15px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #333; padding: 8px; text-align: left; font-size: 12px; }
            th { background-color: #e8e8e8; font-weight: bold; }
            .total-row { background-color: #f0f0f0; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Fleet Maintenance Report</h1>
            <p>Generated: ${new Date().toLocaleDateString()}</p>
            <p>Period: ${startDate || 'All Time'} to ${endDate || 'Current'}</p>
          </div>

          <div class="summary">
            <h2>Maintenance Summary</h2>
            <p><strong>Total Records:</strong> ${data.length}</p>
            <p><strong>Total Cost:</strong> ${formatCurrency(totalCost)}</p>
            <p><strong>Average Cost:</strong> ${data.length > 0 ? formatCurrency(totalCost / data.length) : formatCurrency(0)}</p>
          </div>

          <h2>Maintenance Records</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Service Type</th>
                <th>Description</th>
                <th>Mechanic</th>
                <th>Creator</th>
                <th>Parts Cost</th>
                <th>Labor Cost</th>
                <th>Total Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(record => `
                <tr>
                  <td>${new Date(record.datePerformed).toLocaleDateString()}</td>
                  <td>${getVehicleDisplay(record)}</td>
                  <td>${getDriverName(record)}</td>
                  <td>${record.serviceType}</td>
                  <td>${record.description || 'N/A'}</td>
                  <td>${record.mechanic?.name || 'N/A'}</td>
                  <td>${record.createdBy?.name || 'N/A'}</td>
                  <td>${formatCurrency(record.partsCost)}</td>
                  <td>${formatCurrency(record.laborCost)}</td>
                  <td>${formatCurrency(record.totalCost)}</td>
                  <td>${record.status}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="7"><strong>TOTAL</strong></td>
                <td><strong>${formatCurrency(totalParts)}</strong></td>
                <td><strong>${formatCurrency(totalLabor)}</strong></td>
                <td><strong>${formatCurrency(totalCost)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `maintenance-report-${new Date().toISOString().split('T')[0]}.html`
    link.click()
    URL.revokeObjectURL(url)
  }

  const generatePDF = (data: MaintenanceRecord[]) => {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fleet Maintenance Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .summary { background-color: #f8f9fa; padding: 20px; margin-bottom: 30px; border-radius: 8px; }
            .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .summary-item { text-align: center; }
            .summary-value { font-size: 24px; font-weight: bold; color: #2563eb; }
            .summary-label { font-size: 14px; color: #6b7280; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 11px; }
            th { background-color: #f3f4f6; font-weight: bold; }
            .total-row { background-color: #e5e7eb; font-weight: bold; }
            .status-completed { color: #059669; font-weight: bold; }
            .status-progress { color: #2563eb; font-weight: bold; }
            .status-scheduled { color: #d97706; font-weight: bold; }
            .breakdown-section { margin-top: 30px; }
            .breakdown-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .breakdown-card { background-color: #f8f9fa; padding: 15px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Fleet Maintenance Report</h1>
            <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Period:</strong> ${startDate || 'All Time'} to ${endDate || 'Current'}</p>
            ${searchTerm ? `<p><strong>Search:</strong> "${searchTerm}"</p>` : ''}
          </div>

          <div class="summary">
            <h2>Executive Summary</h2>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-value">${summary.totalRecords}</div>
                <div class="summary-label">Total Records</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${formatCurrency(summary.totalCost)}</div>
                <div class="summary-label">Total Cost</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${formatCurrency(summary.averageCost)}</div>
                <div class="summary-label">Average Cost</div>
              </div>
            </div>
          </div>

          <h2>Maintenance Records</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Driver</th>
                <th>Service Type</th>
                <th>Description</th>
                <th>Mechanic</th>
                <th>Mileage</th>
                <th>Parts Cost</th>
                <th>Labor Cost</th>
                <th>Total Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(record => `
                <tr>
                  <td>${new Date(record.datePerformed).toLocaleDateString()}</td>
                  <td>${getVehicleDisplay(record)}</td>
                  <td>${getDriverName(record)}</td>
                  <td>${record.serviceType}</td>
                  <td>${record.description || 'N/A'}</td>
                  <td>${record.mechanic?.name || record.mechanicName || 'N/A'}</td>
                  <td>${record.currentMileage ? record.currentMileage.toLocaleString() + ' km' : 'N/A'}</td>
                  <td>${formatCurrency(record.partsCost)}</td>
                  <td>${formatCurrency(record.laborCost)}</td>
                  <td>${formatCurrency(record.totalCost)}</td>
                  <td class="status-${record.status.toLowerCase()}">${record.status}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="7"><strong>TOTAL</strong></td>
                <td><strong>${formatCurrency(summary.totalPartsCost)}</strong></td>
                <td><strong>${formatCurrency(summary.totalLaborCost)}</strong></td>
                <td><strong>${formatCurrency(summary.totalCost)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div class="breakdown-section">
            <h2>Analysis Breakdown</h2>
            <div class="breakdown-grid">
              <div class="breakdown-card">
                <h3>Service Types</h3>
                ${Object.entries(summary.serviceTypeBreakdown).map(([type, count]) => 
                  `<p><strong>${type}:</strong> ${count} records</p>`
                ).join('')}
              </div>
              <div class="breakdown-card">
                <h3>Status Distribution</h3>
                ${Object.entries(summary.statusBreakdown).map(([status, count]) => 
                  `<p><strong>${status}:</strong> ${count} records</p>`
                ).join('')}
              </div>
            </div>
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.print()
    }
  }

  const generateExcel = (data: MaintenanceRecord[]) => {
    const totalCost = data.reduce((sum, record) => sum + record.totalCost, 0)
    
    let csv = "Fleet Maintenance Report\n"
    csv += `Generated: ${new Date().toLocaleDateString()}\n`
    csv += `Period: ${startDate || 'All Time'} to ${endDate || 'Current'}\n\n`
    csv += `Total Records: ${data.length}\n`
    csv += `Total Cost: ${formatCurrency(totalCost)}\n\n`
    csv += "Date,Vehicle,Driver,Service Type,Description,Mechanic,Creator,Parts Cost,Labor Cost,Total Cost,Status\n"
    
    data.forEach(record => {
      csv += `${new Date(record.datePerformed).toLocaleDateString()},`
      csv += `"${getVehicleDisplay(record)}",`
      csv += `"${getDriverName(record)}",`
      csv += `"${record.serviceType}",`
      csv += `"${record.description || 'N/A'}",`
      csv += `"${record.mechanic?.name || 'N/A'}",`
      csv += `"${record.createdBy?.name || 'N/A'}",`
      csv += `${record.partsCost.toFixed(2)},`
      csv += `${record.laborCost.toFixed(2)},`
      csv += `${record.totalCost.toFixed(2)},`
      csv += `${record.status}\n`
    })

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `maintenance-report-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-8 w-8 text-blue-600" />
            Maintenance Reports
          </h1>
          <p className="text-muted-foreground">Generate comprehensive maintenance reports with analytics</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateReport} disabled={generating || maintenance.length === 0}>
            <FileText className="h-4 w-4 mr-2" />
            {generating ? 'Generating...' : 'Generate Report'}
          </Button>
          <Button onClick={downloadReport} disabled={generating || maintenance.length === 0} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download
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
                  <Label>Select Records ({selectedRecords.length} selected)</Label>
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
                  <Label>Vehicle</Label>
                  <Select value={truckFilter} onValueChange={setTruckFilter}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Vehicles</SelectItem>
                      {trucks.map((truck) => (
                        <SelectItem key={truck.id} value={truck.id}>
                          {truck.licensePlate} - {truck.year} {truck.make} {truck.model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                {selectedRecords.length > 0 && ` (${selectedRecords.length} selected for report)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
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
                    {getSearchedMaintenance().slice(0, 20).map((record) => {
                      const isSelected = selectedRecords.includes(record.id)
                      return (
                        <tr key={record.id} className={isSelected ? 'bg-blue-50' : ''}>
                          <td className="border border-gray-300 p-2">
                            <Checkbox
                              checked={isSelected}
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
                  Showing {Math.min(getSearchedMaintenance().length, 20)} of {getSearchedMaintenance().length} records
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