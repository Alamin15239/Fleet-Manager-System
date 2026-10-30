'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Search, Droplets, Calendar, Truck, User, BarChart3, Plus, Filter, Check, ChevronsUpDown, Pencil, FileDown, Printer, X } from 'lucide-react'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { formatCurrency } from '@/lib/currency'
import { toast } from '@/lib/localized-toast'
import { usePermissions } from '@/contexts/permissions-context'

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
  oilInventoryItemId?: string | null
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

interface OilInventoryItem { id: string; name: string; unit: string; oilGrade?: string | null; stockQty: number }

interface Mechanic {
  id: string
  name: string
  specialty?: string
}

export default function OilChangesPage() {
  const { canCreate, canUpdate, canExport } = usePermissions()
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
  const [oilInventoryItems, setOilInventoryItems] = useState<OilInventoryItem[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reportStartDate, setReportStartDate] = useState('')
  const [reportEndDate, setReportEndDate] = useState('')
  const [reportTruckId, setReportTruckId] = useState('all')
  const [selectedTruck, setSelectedTruck] = useState<string>('')
  const [truckSearchOpen, setTruckSearchOpen] = useState(false)
  const [selectedMechanic, setSelectedMechanic] = useState<string>('none')
  const [formData, setFormData] = useState({
    datePerformed: new Date().toISOString().split('T')[0],
    currentMileage: '',
    oilQuantityLiters: '',
    partsCost: '',
    laborCost: '',
    driverName: '',
    oilChangeInterval: '',
    nextServiceDue: '',
    description: '',
    notes: '',
    oilInventoryItemId: ''
  })

  useEffect(() => {
    fetchOilChanges()
    fetchTrucks()
    fetchMechanics()
    fetchOilInventory()
  }, [])

  useEffect(() => {
    filterRecords()
  }, [oilChanges, searchTerm, statusFilter])

  const fetchOilChanges = async () => {
    try {
      const response = await apiGet('/api/maintenance?limit=1000')
      if (response.ok) {
        const data = await response.json()
        // Filter only oil change records
        const oilChangeRecords = (data.records || []).filter((record: any) => 
          record.serviceType?.toLowerCase().includes('oil') || 
          record.isOilChange === true
        )
        setOilChanges(oilChangeRecords)
        
        // Calculate oil change specific summary
        const oilSummary = {
          totalRecords: oilChangeRecords.length,
          totalCost: oilChangeRecords.reduce((sum: number, r: any) => sum + (r.totalCost || 0), 0),
          totalOilUsed: oilChangeRecords.reduce((sum: number, r: any) => sum + (parseFloat(r.oilQuantityLiters) || 0), 0),
          completedCount: oilChangeRecords.filter((r: any) => r.status === 'COMPLETED').length,
          inProgressCount: oilChangeRecords.filter((r: any) => r.status === 'IN_PROGRESS').length,
          recordsWithOilQuantity: oilChangeRecords.filter((r: any) => parseFloat(r.oilQuantityLiters) > 0).length,
          averageCost: oilChangeRecords.length > 0 ? oilChangeRecords.reduce((sum: number, r: any) => sum + (r.totalCost || 0), 0) / oilChangeRecords.length : 0,
          averageOilPerChange: 0
        }
        setSummary(oilSummary)
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

  const fetchOilInventory = async () => {
    try {
      const response = await apiGet('/api/inventory')
      if (response.ok) {
        const data = await response.json()
        setOilInventoryItems((data.items || []).filter((item: OilInventoryItem) =>
          ['l', 'liter', 'litre', 'liters', 'litres'].includes(String(item.unit || '').trim().toLowerCase())
        ))
      }
    } catch (error) {
      console.error('Error fetching oil inventory:', error)
      toast.error('Unable to load oil inventory items')
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

  const handleAddOilChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTruck) {
      toast.error('Please select a vehicle')
      return
    }
    
    setIsSubmitting(true)
    try {
      const maintenanceData = {
        truckId: selectedTruck,
        serviceType: 'Oil Change',
        description: formData.description || 'Regular oil change service',
        datePerformed: formData.datePerformed,
        partsCost: parseFloat(formData.partsCost) || 0,
        laborCost: parseFloat(formData.laborCost) || 0,
        mechanicId: selectedMechanic !== 'none' ? selectedMechanic : null,
        mechanicName: selectedMechanic !== 'none' ? mechanics.find(m => m.id === selectedMechanic)?.name : null,
        driverName: formData.driverName,
        currentMileage: formData.currentMileage ? parseInt(formData.currentMileage) : null,
        oilQuantityLiters: formData.oilQuantityLiters ? parseFloat(formData.oilQuantityLiters) : null,
        oilChangeInterval: formData.oilChangeInterval ? parseInt(formData.oilChangeInterval) : null,
        nextServiceDue: formData.nextServiceDue || null,
        status: 'COMPLETED',
        notes: formData.notes,
        isOilChange: true,
        oilInventoryItemId: formData.oilInventoryItemId || null
      }
      
      const response = editingRecordId ? await apiPut(`/api/maintenance/${editingRecordId}`, maintenanceData) : await apiPost('/api/maintenance', maintenanceData)
      if (response.ok) {
        toast.success(editingRecordId ? 'Oil change record updated successfully' : 'Oil change record added successfully')
        setIsAddDialogOpen(false)
        setEditingRecordId(null)
        setSelectedTruck('')
        setSelectedMechanic('none')
        setTruckSearchOpen(false)
        setFormData({
          datePerformed: new Date().toISOString().split('T')[0],
          currentMileage: '',
          oilQuantityLiters: '',
          partsCost: '',
          laborCost: '',
          driverName: '',
          oilChangeInterval: '',
          nextServiceDue: '',
          description: '',
          notes: '',
          oilInventoryItemId: ''
        })
        fetchOilChanges()
      } else {
        toast.error(editingRecordId ? 'Failed to update oil change record' : 'Failed to add oil change record')
      }
    } catch (error) {
      console.error('Error saving oil change:', error)
      toast.error(editingRecordId ? 'Failed to update oil change record' : 'Failed to add oil change record')
    } finally {
      setIsSubmitting(false)
    }
  }



  const openEditDialog = (record: OilChangeRecord) => {
    setEditingRecordId(record.id)
    setSelectedTruck(record.truck?.id || '')
    setSelectedMechanic(record.mechanic?.id || 'none')
    setFormData({
      datePerformed: record.datePerformed ? new Date(record.datePerformed).toISOString().slice(0, 10) : '',
      currentMileage: record.currentMileage != null ? String(record.currentMileage) : '',
      oilQuantityLiters: record.oilQuantityLiters != null ? String(record.oilQuantityLiters) : '',
      partsCost: record.partsCost != null ? String(record.partsCost) : '',
      laborCost: record.laborCost != null ? String(record.laborCost) : '',
      driverName: record.driverName || '',
      oilChangeInterval: record.oilChangeInterval != null ? String(record.oilChangeInterval) : '',
      nextServiceDue: record.nextServiceDue ? new Date(record.nextServiceDue).toISOString().slice(0, 10) : '',
      description: record.description || '',
      notes: record.notes || '',
      oilInventoryItemId: record.oilInventoryItemId || ''
    })
    setIsAddDialogOpen(true)
  }

  const reportRecords = oilChanges.filter((record) => {
    const date = new Date(record.datePerformed).toISOString().slice(0, 10)
    if (reportStartDate && date < reportStartDate) return false
    if (reportEndDate && date > reportEndDate) return false
    if (reportTruckId !== 'all' && record.truck?.id !== reportTruckId) return false
    return true
  })
  const reportOilTotal = reportRecords.reduce((sum, record) => sum + (Number(record.oilQuantityLiters) || 0), 0)
  const oilTotalsByTruck = reportRecords.reduce((totals, record) => {
    const id = record.truck?.id || 'unknown'
    const label = record.truck?.licensePlate || 'Vehicle not recorded'
    if (!totals[id]) totals[id] = { truckLabel: label, records: 0, liters: 0 }
    totals[id].records += 1
    totals[id].liters += Number(record.oilQuantityLiters) || 0
    return totals
  }, {} as Record<string, { truckLabel: string; records: number; liters: number }>)

  const generateOilReport = () => {
    const headers = ['Date', 'Truck Number', 'Make', 'Model', 'Year', 'Odometer (km)', 'Oil Used (liters)', 'Driver', 'Mechanic', 'Cost (SAR)', 'Status', 'Notes']
    const rows = reportRecords.map((record) => [
      new Date(record.datePerformed).toISOString().slice(0, 10), record.truck?.licensePlate || '',
      record.truck?.make || '', record.truck?.model || '', record.truck?.year ?? '',
      record.currentMileage ?? '', record.oilQuantityLiters ?? '', record.driverName || '',
      record.mechanic?.name || record.mechanicName || '', record.totalCost ?? 0, record.status || '', record.notes || ''
    ])
    const escapeCsv = (value: string | number) => {
      const valueText = String(value ?? '')
      return /[",\n\r]/.test(valueText) ? '"' + valueText.replace(/"/g, '""') + '"' : valueText
    }
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `oil-change-report-${reportStartDate || 'all-dates'}-to-${reportEndDate || 'all-dates'}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
    toast.success('Oil change report exported')
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
          <p className="text-muted-foreground"><LocalizedText>Track and manage all oil change maintenance records</LocalizedText></p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) {
            setSelectedTruck('')
            setEditingRecordId(null)
            setSelectedMechanic('none')
            setTruckSearchOpen(false)
          }
        }}>
          {canCreate('maintenance') && <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Oil Change
            </Button>
          </DialogTrigger>}
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle><LocalizedText>{editingRecordId ? 'Edit Oil Change Record' : 'Add New Oil Change Record'}</LocalizedText></DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddOilChange} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="truckId"><LocalizedText>Vehicle *</LocalizedText></Label>
                  <Popover open={truckSearchOpen} onOpenChange={setTruckSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={truckSearchOpen}
                        className="w-full justify-between"
                      >
                        {selectedTruck
                          ? trucks.find((truck) => truck.id === selectedTruck)?.licensePlate + ' - ' + 
                            trucks.find((truck) => truck.id === selectedTruck)?.year + ' ' +
                            trucks.find((truck) => truck.id === selectedTruck)?.make + ' ' +
                            trucks.find((truck) => truck.id === selectedTruck)?.model
                          : "Search by plate number..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search by plate number..." />
                        <CommandList>
                          <CommandEmpty><LocalizedText>No vehicle found.</LocalizedText></CommandEmpty>
                          <CommandGroup>
                            {trucks.map((truck) => (
                              <CommandItem
                                key={truck.id}
                                value={`${truck.licensePlate} ${truck.year} ${truck.make} ${truck.model}`}
                                onSelect={() => {
                                  setSelectedTruck(truck.id)
                                  setTruckSearchOpen(false)
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedTruck === truck.id ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{truck.licensePlate}</span>
                                  <span className="text-sm text-gray-500">
                                    {truck.year} {truck.make} {truck.model}
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="datePerformed"><LocalizedText>Service Date *</LocalizedText></Label>
                  <Input
                    id="datePerformed"
                    type="date"
                    required
                    value={formData.datePerformed}
                    onChange={(e) => setFormData({...formData, datePerformed: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="currentMileage"><LocalizedText>Current Mileage</LocalizedText></Label>
                  <Input 
                    id="currentMileage"
                    type="number" 
                    placeholder="e.g., 45000"
                    value={formData.currentMileage}
                    onChange={(e) => setFormData({...formData, currentMileage: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="oilQuantityLiters"><LocalizedText>Oil Quantity (Liters)</LocalizedText></Label>
                  <Input 
                    id="oilQuantityLiters"
                    type="number" 
                    step="0.1" 
                    placeholder="e.g., 5.5"
                    value={formData.oilQuantityLiters}
                    onChange={(e) => setFormData({...formData, oilQuantityLiters: e.target.value})}
                  />
                  <Label htmlFor="oilInventoryItemId">Deduct from oil inventory (optional)</Label>
                  <Select value={formData.oilInventoryItemId || 'manual'} onValueChange={(value) => setFormData({...formData, oilInventoryItemId: value === 'manual' ? '' : value})}>
                    <SelectTrigger id="oilInventoryItemId"><SelectValue placeholder="Manual entry — no stock deduction" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual entry — no stock deduction</SelectItem>
                      {oilInventoryItems.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}{item.oilGrade ? ` (${item.oilGrade})` : ''} — {Number(item.stockQty || 0).toFixed(1)} {item.unit} available</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">When selected, the recorded litres are deducted from inventory. Insufficient stock prevents saving.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="partsCost"><LocalizedText>Parts Cost</LocalizedText></Label>
                  <Input 
                    id="partsCost"
                    type="number" 
                    step="0.01" 
                    placeholder="0.00"
                    value={formData.partsCost}
                    onChange={(e) => setFormData({...formData, partsCost: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="laborCost"><LocalizedText>Labor Cost</LocalizedText></Label>
                  <Input 
                    id="laborCost"
                    type="number" 
                    step="0.01" 
                    placeholder="0.00"
                    value={formData.laborCost}
                    onChange={(e) => setFormData({...formData, laborCost: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mechanicId"><LocalizedText>Mechanic</LocalizedText></Label>
                  <Select value={selectedMechanic} onValueChange={setSelectedMechanic}>
                    <SelectTrigger id="mechanicId">
                      <SelectValue placeholder="Select mechanic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none"><LocalizedText>No mechanic assigned</LocalizedText></SelectItem>
                      {mechanics.map((mechanic) => (
                        <SelectItem key={mechanic.id} value={mechanic.id}>
                          {mechanic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverName"><LocalizedText>Driver Name</LocalizedText></Label>
                  <Input 
                    id="driverName"
                    placeholder="Driver name"
                    value={formData.driverName}
                    onChange={(e) => setFormData({...formData, driverName: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="oilChangeInterval"><LocalizedText>Next Change Interval (km)</LocalizedText></Label>
                  <Input 
                    id="oilChangeInterval"
                    type="number" 
                    placeholder="e.g., 10000"
                    value={formData.oilChangeInterval}
                    onChange={(e) => setFormData({...formData, oilChangeInterval: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nextServiceDue"><LocalizedText>Next Service Due</LocalizedText></Label>
                  <Input 
                    id="nextServiceDue"
                    type="date"
                    value={formData.nextServiceDue}
                    onChange={(e) => setFormData({...formData, nextServiceDue: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description"><LocalizedText>Description</LocalizedText></Label>
                <Input 
                  id="description"
                  placeholder="Regular oil change service"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes"><LocalizedText>Notes</LocalizedText></Label>
                <Textarea 
                  id="notes"
                  placeholder="Additional notes..." 
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsAddDialogOpen(false)
                    setSelectedTruck('')
                    setSelectedMechanic('none')
                    setFormData({
                      datePerformed: new Date().toISOString().split('T')[0],
                      currentMileage: '',
                      oilQuantityLiters: '',
                      partsCost: '',
                      laborCost: '',
                      driverName: '',
                      oilChangeInterval: '',
                      nextServiceDue: '',
                      description: '',
                      notes: ''
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!(editingRecordId ? canUpdate('maintenance') : canCreate('maintenance')) || isSubmitting || !selectedTruck}>
                  {isSubmitting ? 'Saving...' : editingRecordId ? 'Save Changes' : 'Add Oil Change'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Total Oil Changes</LocalizedText></CardTitle>
            <Droplets className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalRecords}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium"><LocalizedText>Completed</LocalizedText></CardTitle>
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
            <CardTitle className="text-sm font-medium"><LocalizedText>In Progress</LocalizedText></CardTitle>
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
            <CardTitle className="text-sm font-medium"><LocalizedText>Total Oil Used</LocalizedText></CardTitle>
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
            <CardTitle className="text-sm font-medium"><LocalizedText>Total Cost</LocalizedText></CardTitle>
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
                <SelectItem value="all"><LocalizedText>All Status</LocalizedText></SelectItem>
                <SelectItem value="COMPLETED"><LocalizedText>Completed</LocalizedText></SelectItem>
                <SelectItem value="IN_PROGRESS"><LocalizedText>In Progress</LocalizedText></SelectItem>
                <SelectItem value="SCHEDULED"><LocalizedText>Scheduled</LocalizedText></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Oil Change Reports</CardTitle>
          <p className="text-sm text-muted-foreground">Filter by date range and truck number. Older records remain available for previous-year reports.</p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2"><Label htmlFor="reportStartDate">From date</Label><Input id="reportStartDate" type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="reportEndDate">To date</Label><Input id="reportEndDate" type="date" min={reportStartDate || undefined} value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="reportTruck">Truck number</Label><Select value={reportTruckId} onValueChange={setReportTruckId}><SelectTrigger id="reportTruck"><SelectValue placeholder="All trucks" /></SelectTrigger><SelectContent><SelectItem value="all">All trucks</SelectItem>{trucks.map((truck) => <SelectItem key={truck.id} value={truck.id}>{truck.licensePlate}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-end gap-2"><Button type="button" variant="outline" onClick={() => { setReportStartDate(''); setReportEndDate(''); setReportTruckId('all') }}><X className="mr-2 h-4 w-4" />Clear</Button><Button type="button" onClick={generateOilReport} disabled={reportRecords.length === 0 || !canExport('maintenance')}><FileDown className="mr-2 h-4 w-4" />Export CSV</Button></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Matching oil changes</p><p className="mt-1 text-2xl font-bold">{reportRecords.length}</p></div>
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Total oil used</p><p className="mt-1 text-2xl font-bold text-blue-600">{reportOilTotal.toFixed(1)} L</p></div>
            <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Total recorded cost</p><p className="mt-1 text-2xl font-bold">{formatCurrency(reportRecords.reduce((sum, record) => sum + (record.totalCost || 0), 0))}</p></div>
          </div>
          <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Oil used by truck</h3><Button type="button" variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print report</Button></div>
          <div className="rounded-md border overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Truck number</TableHead><TableHead>Oil changes</TableHead><TableHead>Total oil used</TableHead></TableRow></TableHeader><TableBody>
            {Object.values(oilTotalsByTruck).sort((a, b) => a.truckLabel.localeCompare(b.truckLabel)).map((item) => <TableRow key={item.truckLabel}><TableCell className="font-medium">{item.truckLabel}</TableCell><TableCell>{item.records}</TableCell><TableCell className="font-semibold text-blue-600">{item.liters.toFixed(1)} L</TableCell></TableRow>)}
            {Object.keys(oilTotalsByTruck).length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No oil change records match these filters.</TableCell></TableRow>}
          </TableBody></Table></div>
          <p className="text-xs text-muted-foreground">CSV includes each matching record's date, truck number, odometer, liters used, driver, mechanic, cost, status, and notes. Print opens your browser's print dialog.</p>
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
            <div className="text-center py-8"><LocalizedText>Loading oil change records...</LocalizedText></div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><LocalizedText>Date</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Service</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Vehicle</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Odometer</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Oil Used</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Driver</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Mechanic</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Cost</LocalizedText></TableHead>
                    <TableHead><LocalizedText>Status</LocalizedText></TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                        <LocalizedText>No oil change records found</LocalizedText>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          {new Date(record.datePerformed).toLocaleDateString('en-US', {
                            month: 'short',
                            day: '2-digit',
                            year: 'numeric'
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
                        <TableCell>{canUpdate('maintenance') && <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(record)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>}</TableCell>
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
