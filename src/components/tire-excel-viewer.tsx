'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileSpreadsheet, RefreshCw, Download } from 'lucide-react'
import { toast } from 'sonner'
import { apiGet } from '@/lib/api'

interface Tire {
  id: string
  tireSize: string
  plateNumber: string | null
  driverName: string | null
  quantity: number
  serialNumber: string | null
  createdAt: string
}

export default function TireExcelViewer() {
  const [tires, setTires] = useState<Tire[]>([])
  const [filteredTires, setFilteredTires] = useState<Tire[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filters, setFilters] = useState({
    tireSize: 'all',
    plateNumber: 'all',
    driverName: 'all',
    quantity: '',
    serialNumber: ''
  })

  const fetchTires = async () => {
    setLoading(true)
    try {
      const response = await apiGet('/api/tires?limit=1000&positiveQuantityOnly=true')
      if (!response.ok) throw new Error(`Request failed (${response.status})`)

      const data = await response.json()
      if (!Array.isArray(data.tires)) throw new Error('Unexpected tire response')
      const records = data.tires
      setTires(records)
      setFilteredTires(records)
      setLoadError(null)
    } catch (error) {
      setLoadError('Could not load tire records. Please refresh or sign in again.')
      toast.error('Failed to load tire data')
    } finally {
      setLoading(false)
    }
  }

  const downloadExcel = async () => {
    try {
      const response = await apiGet('/api/tires/excel')
      if (!response.ok) throw new Error(`Request failed (${response.status})`)

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `tires-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Excel downloaded')
    } catch (error) {
      toast.error('Download failed')
    }
  }

  useEffect(() => {
    fetchTires()
  }, [])

  useEffect(() => {
    let filtered = tires

    Object.entries(filters).forEach(([key, value]) => {
      if (value && value !== 'all') {
        filtered = filtered.filter(tire => {
          const tireValue = tire[key as keyof Tire]
          if (tireValue === null || tireValue === undefined) return false
          return tireValue.toString().toLowerCase().includes(value.toLowerCase())
        })
      }
    })

    setFilteredTires(filtered)
  }, [tires, filters])

  const uniqueValues = {
    tireSize: [...new Set(tires.map(t => t.tireSize).filter(value => value?.trim()))],
    plateNumber: [...new Set(tires.map(t => t.plateNumber).filter((v): v is string => Boolean(v)))],
    driverName: [...new Set(tires.map(t => t.driverName).filter((v): v is string => Boolean(v)))]
  }

  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      tireSize: 'all',
      plateNumber: 'all',
      driverName: 'all',
      quantity: '',
      serialNumber: ''
    })
  }

  const formatTireSize = (size: string) => size === '10' ? '1000-20' : size

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Excel View - Tire Inventory ({filteredTires.length} records)
          </CardTitle>
          <div className="flex shrink-0 gap-2">
            <Button onClick={fetchTires} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <Button onClick={downloadExcel} size="sm">
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading...</span>
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Tire Size</TableHead>
                  <TableHead>Truck Number</TableHead>
                  <TableHead>Driver Name</TableHead>
                  <TableHead>Out Qty</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
                <TableRow className="bg-blue-50">
                  <TableHead className="p-1">
                    <Select value={filters.tireSize} onValueChange={(v) => updateFilter('tireSize', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {uniqueValues.tireSize.map(v => (
                          <SelectItem key={v} value={v}>{formatTireSize(v)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="p-1">
                    <Select value={filters.plateNumber} onValueChange={(v) => updateFilter('plateNumber', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {uniqueValues.plateNumber.map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="p-1">
                    <Select value={filters.driverName} onValueChange={(v) => updateFilter('driverName', v)}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {uniqueValues.driverName.map(v => (
                          <SelectItem key={v} value={v}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableHead>
                  <TableHead className="p-1">
                    <Input
                      placeholder="Qty"
                      value={filters.quantity}
                      onChange={(e) => updateFilter('quantity', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <Input
                      placeholder="Serial"
                      value={filters.serialNumber}
                      onChange={(e) => updateFilter('serialNumber', e.target.value)}
                      className="h-7 text-xs"
                    />
                  </TableHead>
                  <TableHead className="p-1">
                    <Button 
                      onClick={clearFilters}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs px-2"
                    >
                      Clear
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTires.map((tire) => (
                  <TableRow key={tire.id}>
                    <TableCell className="font-medium">{formatTireSize(tire.tireSize)}</TableCell>
                    <TableCell>{tire.plateNumber || '-'}</TableCell>
                    <TableCell>{tire.driverName || '-'}</TableCell>
                    <TableCell>{tire.quantity}</TableCell>
                    <TableCell>{tire.serialNumber || '-'}</TableCell>
                    <TableCell>{new Date(tire.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredTires.length === 0 && tires.length > 0 && (
              <div className="text-center py-8 text-gray-500">
                No tires match the current filters
              </div>
            )}
            {loadError && (
              <div role="alert" className="text-center py-8 text-red-600">
                {loadError}
              </div>
            )}
            {tires.length === 0 && !loadError && (
              <div className="text-center py-8 text-gray-500">
                No tire data available
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
