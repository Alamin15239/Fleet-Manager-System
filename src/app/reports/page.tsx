'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Download, Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'

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
  truck: {
    id: string
    make: string
    model: string
    year: number
    licensePlate: string
  }
  mechanic?: {
    id: string
    name: string
  }
  createdBy?: {
    id: string
    name: string
    email: string
  }
}

export default function ReportsPage() {
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [format, setFormat] = useState<'pdf' | 'excel'>('pdf')
  const [selectedRecords, setSelectedRecords] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchMaintenance()
  }, [])

  const fetchMaintenance = async () => {
    try {
      const token = localStorage.getItem('authToken')
      const response = await fetch('/api/maintenance?limit=10000', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setMaintenance(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching maintenance:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSearchedMaintenance = () => {
    let filtered = [...maintenance]
    
    if (searchTerm) {
      filtered = filtered.filter(record => 
        record.serviceType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.truck?.licensePlate?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.truck?.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.truck?.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.status.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (startDate) {
      filtered = filtered.filter(record => 
        new Date(record.datePerformed) >= new Date(startDate)
      )
    }
    
    if (endDate) {
      filtered = filtered.filter(record => 
        new Date(record.datePerformed) <= new Date(endDate)
      )
    }
    
    return filtered
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

  const generatePDF = (data: MaintenanceRecord[]) => {
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
            <p><strong>Total Cost:</strong> $${totalCost.toFixed(2)}</p>
            <p><strong>Average Cost:</strong> $${data.length > 0 ? (totalCost / data.length).toFixed(2) : '0.00'}</p>
          </div>

          <h2>Maintenance Records</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Vehicle</th>
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
                  <td>${record.truck?.licensePlate || 'N/A'} - ${record.truck?.year || ''} ${record.truck?.make || ''} ${record.truck?.model || ''}</td>
                  <td>${record.serviceType}</td>
                  <td>${record.description || 'N/A'}</td>
                  <td>${record.mechanic?.name || 'N/A'}</td>
                  <td>${record.createdBy?.name || 'N/A'}</td>
                  <td>$${record.partsCost.toFixed(2)}</td>
                  <td>$${record.laborCost.toFixed(2)}</td>
                  <td>$${record.totalCost.toFixed(2)}</td>
                  <td>${record.status}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="6"><strong>TOTAL</strong></td>
                <td><strong>$${totalParts.toFixed(2)}</strong></td>
                <td><strong>$${totalLabor.toFixed(2)}</strong></td>
                <td><strong>$${totalCost.toFixed(2)}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>
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
    csv += `Total Cost: $${totalCost.toFixed(2)}\n\n`
    csv += "Date,Vehicle,Service Type,Description,Mechanic,Creator,Parts Cost,Labor Cost,Total Cost,Status\n"
    
    data.forEach(record => {
      csv += `${new Date(record.datePerformed).toLocaleDateString()},`
      csv += `"${record.truck?.licensePlate || 'N/A'} - ${record.truck?.year || ''} ${record.truck?.make || ''} ${record.truck?.model || ''}",`
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
          <h1 className="text-3xl font-bold">Maintenance Reports</h1>
          <p className="text-muted-foreground">Generate maintenance reports</p>
        </div>
        <Button onClick={generateReport} disabled={generating}>
          <Download className="h-4 w-4 mr-2" />
          {generating ? 'Generating...' : 'Generate Report'}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Report Settings</CardTitle>
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
            <div>
              <Label>Format</Label>
              <Select value={format} onValueChange={(value: 'pdf' | 'excel') => setFormat(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search Records</Label>
              <Input
                placeholder="Search by service, vehicle, status..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Select Records ({selectedRecords.length} selected)</Label>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="outline" size="sm" onClick={selectSearched}>
                  Select Searched
                </Button>
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Records:</span>
                <span className="font-bold">{filteredMaintenance.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Cost:</span>
                <span className="font-bold">
                  ${filteredMaintenance.reduce((sum, record) => sum + record.totalCost, 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Average Cost:</span>
                <span className="font-bold">
                  ${filteredMaintenance.length > 0 
                    ? (filteredMaintenance.reduce((sum, record) => sum + record.totalCost, 0) / filteredMaintenance.length).toFixed(2)
                    : '0.00'
                  }
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Maintenance Records Preview</CardTitle>
          <CardDescription>
            {filteredMaintenance.length} records found
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
                  <th className="border border-gray-300 p-2 text-left">Service</th>
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
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRecord(record.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="border border-gray-300 p-2">
                        {new Date(record.datePerformed).toLocaleDateString()}
                      </td>
                      <td className="border border-gray-300 p-2">
                        {record.truck?.licensePlate || 'N/A'} - {record.truck?.year || ''} {record.truck?.make || ''}
                      </td>
                      <td className="border border-gray-300 p-2">{record.serviceType}</td>
                      <td className="border border-gray-300 p-2">${record.totalCost.toFixed(2)}</td>
                      <td className="border border-gray-300 p-2">{record.status}</td>
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
    </div>
  )
}