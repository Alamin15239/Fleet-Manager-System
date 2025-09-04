'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FileText, Download, Calendar as CalendarIcon, Filter, RotateCcw, Search, Truck, Wrench } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

interface ReportFilters {
  startDate: Date | undefined
  endDate: Date | undefined
  reportType: 'trucks' | 'maintenance' | 'costs' | 'overview'
  format: 'pdf' | 'excel'
  includeCharts: boolean
  includeDetails: boolean
  selectedTrucks: string[]
  selectedMaintenance: string[]
  selectedUsers: string[]
}

interface User {
  id: string
  email: string
  name?: string
  role: string
  isActive: boolean
}

interface Truck {
  id: string
  vin: string
  make: string
  model: string
  year: number
  licensePlate: string
  currentMileage: number
  status: string
  createdAt: string
}

interface MaintenanceRecord {
  id: string
  truckId: string
  serviceType: string
  description: string | null
  datePerformed: string
  partsCost: number
  laborCost: number
  totalCost: number
  status: string
  createdById?: string
  createdBy?: {
    id: string
    name?: string
    email: string
    role: string
  }
  truck: Truck
}

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: undefined,
    endDate: undefined,
    reportType: 'overview',
    format: 'pdf',
    includeCharts: true,
    includeDetails: true,
    selectedTrucks: [],
    selectedMaintenance: [],
    selectedUsers: []
  })
  const [trucks, setTrucks] = useState<Truck[]>([])
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [showCalendar, setShowCalendar] = useState<'start' | 'end' | null>(null)
  const [truckSearchOpen, setTruckSearchOpen] = useState(false)
  const [maintenanceSearchOpen, setMaintenanceSearchOpen] = useState(false)
  const [userSearchOpen, setUserSearchOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Get auth token from localStorage
      const token = localStorage.getItem('authToken')
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const [trucksRes, maintenanceRes, usersRes] = await Promise.all([
        fetch('/api/trucks?limit=10000', { headers }),
        fetch('/api/maintenance?limit=10000', { headers }),
        fetch('/api/users?limit=10000', { headers })
      ])

      if (trucksRes.ok) {
        const trucksData = await trucksRes.json()
        setTrucks(trucksData.data || [])
      }

      if (maintenanceRes.ok) {
        const maintenanceData = await maintenanceRes.json()
        setMaintenance(maintenanceData.data || [])
      }

      if (usersRes.ok) {
        const usersData = await usersRes.json()
        setUsers(usersData.data || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data for reports')
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async () => {
    setGenerating(true)
    try {
      const filteredData = getFilteredData()
      
      if (filters.format === 'pdf') {
        await generatePDFReport(filteredData)
      } else {
        await generateExcelReport(filteredData)
      }
      
      toast.success(`Report generated successfully as ${filters.format.toUpperCase()}`)
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  const getFilteredData = () => {
    let filteredMaintenance = [...maintenance]
    let filteredTrucks = [...trucks]
    
    // Filter by selected trucks
    if (filters.selectedTrucks.length > 0) {
      filteredTrucks = filteredTrucks.filter(truck => filters.selectedTrucks.includes(truck.id))
      filteredMaintenance = filteredMaintenance.filter(record => filters.selectedTrucks.includes(record.truckId))
    }
    
    // Filter by selected maintenance records
    if (filters.selectedMaintenance.length > 0) {
      filteredMaintenance = filteredMaintenance.filter(record => filters.selectedMaintenance.includes(record.id))
    }
    
    // Filter by selected users (filter maintenance records created by selected users)
    if (filters.selectedUsers.length > 0) {
      filteredMaintenance = filteredMaintenance.filter(record => 
        record.createdById && filters.selectedUsers.includes(record.createdById)
      )
    }
    
    // Filter by date range
    if (filters.startDate) {
      filteredMaintenance = filteredMaintenance.filter(record => 
        new Date(record.datePerformed) >= filters.startDate!
      )
    }
    
    if (filters.endDate) {
      filteredMaintenance = filteredMaintenance.filter(record => 
        new Date(record.datePerformed) <= filters.endDate!
      )
    }

    return {
      trucks: filteredTrucks,
      maintenance: filteredMaintenance,
      users: users.filter(user => filters.selectedUsers.length === 0 || filters.selectedUsers.includes(user.id)),
      filters
    }
  }

  const generatePDFReport = async (data: any) => {
    try {
      // Simple PDF generation using browser's print functionality
      const printContent = generateReportHTML(data)
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.print()
        
        // Generate filename
        const filename = `fleet-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`
        
        // Show success message with filename
        toast.success(`Report generated: ${filename}`)
      }
    } catch (error) {
      console.error('Error generating PDF report:', error)
      throw new Error('Failed to generate PDF report')
    }
  }

  const generateReportHTML = (data: any) => {
    const { trucks, maintenance, filters } = data
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Fleet Maintenance Report</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 25px; }
            .section-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #333; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; font-weight: bold; }
            .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Fleet Maintenance Report</h1>
            <p>Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}</p>
            <p>Period: ${filters.startDate && filters.endDate ? 
              `${format(filters.startDate, 'MMM dd, yyyy')} - ${format(filters.endDate, 'MMM dd, yyyy')}` : 
              'All Time'}</p>
          </div>

          <div class="section">
            <div class="summary">
              <h2>Fleet Overview</h2>
              <p><strong>Total Trucks:</strong> ${trucks.length}</p>
              <p><strong>Active Trucks:</strong> ${trucks.filter(t => t.status === 'ACTIVE').length}</p>
              <p><strong>Trucks in Maintenance:</strong> ${trucks.filter(t => t.status === 'MAINTENANCE').length}</p>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Maintenance Summary</h2>
            <div class="summary">
              <p><strong>Total Maintenance Records:</strong> ${maintenance.length}</p>
              <p><strong>Total Maintenance Cost:</strong> ${maintenance.reduce((sum: number, record: any) => sum + (typeof record.totalCost === 'number' ? record.totalCost : 0), 0).toFixed(2)}</p>
              <p><strong>Average Cost per Maintenance:</strong> ${maintenance.length > 0 ? (maintenance.reduce((sum: number, record: any) => sum + (typeof record.totalCost === 'number' ? record.totalCost : 0), 0) / maintenance.length).toFixed(2) : 0}</p>
            </div>
          </div>

          ${filters.includeDetails ? `
          <div class="section">
            <h2 class="section-title">Truck Details</h2>
            <table>
              <thead>
                <tr>
                  <th>License Plate</th>
                  <th>Make</th>
                  <th>Model</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Current Mileage</th>
                </tr>
              </thead>
              <tbody>
                ${trucks.map(truck => `
                  <tr>
                    <td>${truck.licensePlate}</td>
                    <td>${truck.make}</td>
                    <td>${truck.model}</td>
                    <td>${truck.year}</td>
                    <td>${truck.status}</td>
                    <td>${truck.currentMileage.toLocaleString()}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section">
            <h2 class="section-title">Maintenance Records</h2>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Truck</th>
                  <th>Service Type</th>
                  <th>Description</th>
                  <th>Total Cost</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${maintenance.slice(0, 50).map(record => `
                  <tr>
                    <td>${format(new Date(record.datePerformed), 'MMM dd, yyyy')}</td>
                    <td>${record.truck.licensePlate}</td>
                    <td>${record.serviceType}</td>
                    <td>${record.description || 'N/A'}</td>
                    <td>${(typeof record.totalCost === 'number' ? record.totalCost : 0).toFixed(2)}</td>
                    <td>${record.status}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${maintenance.length > 50 ? `<p><em>Showing first 50 of ${maintenance.length} records</em></p>` : ''}
          </div>
          ` : ''}
        </body>
      </html>
    `
  }

  const generateExcelReport = async (data: any) => {
    try {
      // Simple CSV generation for Excel compatibility
      const { trucks, maintenance, filters } = data
      
      let csvContent = "Fleet Maintenance Report\n"
      csvContent += `Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}\n`
      csvContent += `Period: ${filters.startDate && filters.endDate ? 
        `${format(filters.startDate, 'MMM dd, yyyy')} - ${format(filters.endDate, 'MMM dd, yyyy')}` : 
        'All Time'}\n\n`
      
      // Fleet Overview
      csvContent += "Fleet Overview\n"
      csvContent += "Total Trucks,Active Trucks,Trucks in Maintenance\n"
      csvContent += `${trucks.length},${trucks.filter(t => t.status === 'ACTIVE').length},${trucks.filter(t => t.status === 'MAINTENANCE').length}\n\n`
      
      // Maintenance Summary
      csvContent += "Maintenance Summary\n"
      csvContent += "Total Maintenance Records,Total Maintenance Cost,Average Cost per Maintenance\n"
      const totalCost = maintenance.reduce((sum: number, record: any) => sum + (typeof record.totalCost === 'number' ? record.totalCost : 0), 0)
      const avgCost = maintenance.length > 0 ? totalCost / maintenance.length : 0
      csvContent += `${maintenance.length},${totalCost.toFixed(2)},${avgCost.toFixed(2)}\n\n`
      
      // Truck Details
      if (filters.includeDetails) {
        csvContent += "Truck Details\n"
        csvContent += "License Plate,Make,Model,Year,Status,Current Mileage\n"
        trucks.forEach(truck => {
          csvContent += `${truck.licensePlate},${truck.make},${truck.model},${truck.year},${truck.status},${truck.currentMileage}\n`
        })
        csvContent += "\n"
        
        // Maintenance Records
        csvContent += "Maintenance Records\n"
        csvContent += "Date,Truck,Service Type,Description,Total Cost,Status\n"
        maintenance.slice(0, 1000).forEach(record => {
          csvContent += `${format(new Date(record.datePerformed), 'MMM dd, yyyy')},${record.truck.licensePlate},${record.serviceType},"${record.description || 'N/A'}",${typeof record.totalCost === 'number' ? record.totalCost : 0},${record.status}\n`
        })
      }
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `fleet-maintenance-report-${format(new Date(), 'yyyy-MM-dd')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success('Excel report generated successfully')
    } catch (error) {
      console.error('Error generating Excel report:', error)
      throw new Error('Failed to generate Excel report')
    }
  }

  const resetFilters = () => {
    setFilters({
      startDate: undefined,
      endDate: undefined,
      reportType: 'overview',
      format: 'pdf',
      includeCharts: true,
      includeDetails: true,
      selectedTrucks: [],
      selectedMaintenance: [],
      selectedUsers: []
    })
  }

  const toggleTruckSelection = (truckId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedTrucks: prev.selectedTrucks.includes(truckId)
        ? prev.selectedTrucks.filter(id => id !== truckId)
        : [...prev.selectedTrucks, truckId]
    }))
  }

  const toggleMaintenanceSelection = (maintenanceId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedMaintenance: prev.selectedMaintenance.includes(maintenanceId)
        ? prev.selectedMaintenance.filter(id => id !== maintenanceId)
        : [...prev.selectedMaintenance, maintenanceId]
    }))
  }

  const toggleUserSelection = (userId: string) => {
    setFilters(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }))
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">Generate and export fleet maintenance reports</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Filters
          </Button>
          <Button onClick={generateReport} disabled={generating}>
            <Download className="h-4 w-4 mr-2" />
            {generating ? 'Generating...' : 'Generate Report'}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Report Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>Configure your report settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reportType">Report Type</Label>
              <Select 
                value={filters.reportType} 
                onValueChange={(value: any) => setFilters({ ...filters, reportType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Fleet Overview</SelectItem>
                  <SelectItem value="trucks">Trucks Only</SelectItem>
                  <SelectItem value="maintenance">Maintenance Only</SelectItem>
                  <SelectItem value="costs">Cost Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="format">Export Format</Label>
              <Select 
                value={filters.format} 
                onValueChange={(value: any) => setFilters({ ...filters, format: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Options</Label>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeCharts"
                  checked={filters.includeCharts}
                  onCheckedChange={(checked) => setFilters({ ...filters, includeCharts: !!checked })}
                />
                <Label htmlFor="includeCharts">Include Charts</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeDetails"
                  checked={filters.includeDetails}
                  onCheckedChange={(checked) => setFilters({ ...filters, includeDetails: !!checked })}
                />
                <Label htmlFor="includeDetails">Include Detailed Records</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Date Range */}
        <Card>
          <CardHeader>
            <CardTitle>Date Range</CardTitle>
            <CardDescription>Filter reports by date range</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                onClick={() => setShowCalendar('start')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.startDate ? format(filters.startDate, 'PPP') : 'Select start date'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                onClick={() => setShowCalendar('end')}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.endDate ? format(filters.endDate, 'PPP') : 'Select end date'}
              </Button>
            </div>

            {showCalendar && (
              <div className="absolute z-10 mt-2 bg-white border rounded-lg shadow-lg">
                <Calendar
                  mode="single"
                  selected={showCalendar === 'start' ? filters.startDate : filters.endDate}
                  onSelect={(date) => {
                    if (showCalendar === 'start') {
                      setFilters({ ...filters, startDate: date })
                    } else {
                      setFilters({ ...filters, endDate: date })
                    }
                    setShowCalendar(null)
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Truck & Maintenance Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Data Selection</CardTitle>
            <CardDescription>Select specific trucks and maintenance records</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Truck Selection */}
            <div className="space-y-2">
              <Label>Selected Trucks ({filters.selectedTrucks.length})</Label>
              <Dialog open={truckSearchOpen} onOpenChange={setTruckSearchOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Truck className="mr-2 h-4 w-4" />
                    {filters.selectedTrucks.length > 0 
                      ? `${filters.selectedTrucks.length} truck${filters.selectedTrucks.length > 1 ? 's' : ''} selected`
                      : 'Select trucks...'
                    }
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Select Trucks</DialogTitle>
                    <DialogDescription>
                      Choose specific trucks to include in the report
                    </DialogDescription>
                  </DialogHeader>
                  <Command>
                    <CommandInput placeholder="Search trucks..." />
                    <CommandList>
                      <CommandEmpty>No trucks found.</CommandEmpty>
                      <CommandGroup>
                        {trucks.map((truck) => (
                          <CommandItem
                            key={truck.id}
                            onSelect={() => toggleTruckSelection(truck.id)}
                          >
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={filters.selectedTrucks.includes(truck.id)}
                                disabled
                              />
                              <div>
                                <p className="font-medium">{truck.licensePlate}</p>
                                <p className="text-sm text-muted-foreground">
                                  {truck.year} {truck.make} {truck.model}
                                </p>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={() => setFilters(prev => ({ ...prev, selectedTrucks: [] }))}>
                      Clear All
                    </Button>
                    <Button onClick={() => setTruckSearchOpen(false)}>
                      Done ({filters.selectedTrucks.length} selected)
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Maintenance Selection */}
            <div className="space-y-2">
              <Label>Selected Maintenance ({filters.selectedMaintenance.length})</Label>
              <Dialog open={maintenanceSearchOpen} onOpenChange={setMaintenanceSearchOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Wrench className="mr-2 h-4 w-4" />
                    {filters.selectedMaintenance.length > 0 
                      ? `${filters.selectedMaintenance.length} record${filters.selectedMaintenance.length > 1 ? 's' : ''} selected`
                      : 'Select maintenance records...'
                    }
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Select Maintenance Records</DialogTitle>
                    <DialogDescription>
                      Choose specific maintenance records to include in the report
                    </DialogDescription>
                  </DialogHeader>
                  <Command>
                    <CommandInput placeholder="Search maintenance records..." />
                    <CommandList>
                      <CommandEmpty>No maintenance records found.</CommandEmpty>
                      <CommandGroup>
                        {maintenance.slice(0, 50).map((record) => (
                          <CommandItem
                            key={record.id}
                            onSelect={() => toggleMaintenanceSelection(record.id)}
                          >
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={filters.selectedMaintenance.includes(record.id)}
                                disabled
                              />
                              <div className="flex-1">
                                <p className="font-medium">{record.serviceType}</p>
                                <p className="text-sm text-muted-foreground">
                                  {record.truck.licensePlate} • {format(new Date(record.datePerformed), 'MMM dd, yyyy')} • {(typeof record.totalCost === 'number' ? record.totalCost : 0).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={() => setFilters(prev => ({ ...prev, selectedMaintenance: [] }))}>
                      Clear All
                    </Button>
                    <Button onClick={() => setMaintenanceSearchOpen(false)}>
                      Done ({filters.selectedMaintenance.length} selected)
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* User Selection */}
            <div className="space-y-2">
              <Label>Selected Users ({filters.selectedUsers.length})</Label>
              <Dialog open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <Search className="mr-2 h-4 w-4" />
                    {filters.selectedUsers.length > 0 
                      ? `${filters.selectedUsers.length} user${filters.selectedUsers.length > 1 ? 's' : ''} selected`
                      : 'Select users...'
                    }
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>Select Users</DialogTitle>
                    <DialogDescription>
                      Choose specific users to include in the report
                    </DialogDescription>
                  </DialogHeader>
                  <Command>
                    <CommandInput placeholder="Search users..." />
                    <CommandList>
                      <CommandEmpty>No users found.</CommandEmpty>
                      <CommandGroup>
                        {users.map((user) => (
                          <CommandItem
                            key={user.id}
                            onSelect={() => toggleUserSelection(user.id)}
                          >
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                checked={filters.selectedUsers.includes(user.id)}
                                disabled
                              />
                              <div>
                                <p className="font-medium">{user.name || user.email}</p>
                                <p className="text-sm text-muted-foreground">
                                  {user.role} {user.isActive ? '• Active' : '• Inactive'}
                                </p>
                              </div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                  <div className="flex justify-between mt-4">
                    <Button variant="outline" onClick={() => setFilters(prev => ({ ...prev, selectedUsers: [] }))}>
                      Clear All
                    </Button>
                    <Button onClick={() => setUserSearchOpen(false)}>
                      Done ({filters.selectedUsers.length} selected)
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Data Summary</CardTitle>
          <CardDescription>Current data available for reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Trucks</span>
              <Badge variant="secondary">{trucks.length}</Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Active Trucks</span>
              <Badge variant="default">{trucks.filter(t => t.status === 'ACTIVE').length}</Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Maintenance Records</span>
              <Badge variant="secondary">{maintenance.length}</Badge>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Filtered Records</span>
              <Badge variant="outline">{getFilteredData().maintenance.length}</Badge>
            </div>
          </div>
          
          {filters.selectedTrucks.length > 0 && (
            <Alert>
              <AlertDescription>
                <strong>Selected Trucks:</strong> {filters.selectedTrucks.length} truck{filters.selectedTrucks.length > 1 ? 's' : ''} selected
              </AlertDescription>
            </Alert>
          )}
          
          {filters.selectedMaintenance.length > 0 && (
            <Alert>
              <AlertDescription>
                <strong>Selected Maintenance Records:</strong> {filters.selectedMaintenance.length} record{filters.selectedMaintenance.length > 1 ? 's' : ''} selected
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}