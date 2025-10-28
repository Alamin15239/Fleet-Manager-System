'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { FileSpreadsheet, RefreshCw, Download, Filter } from 'lucide-react'
import { toast } from 'sonner'

interface Tire {
  id: string
  tireSize: string
  manufacturer: string
  origin: string
  plateNumber: string | null
  trailerNumber: string | null
  driverName: string | null
  quantity: number
  serialNumber: string | null
  notes: string | null
  createdAt: string
}

export default function TireExcelViewer() {
  const [tires, setTires] = useState<Tire[]>([])
  const [filteredTires, setFilteredTires] = useState<Tire[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [manufacturerFilter, setManufacturerFilter] = useState('')
  const [originFilter, setOriginFilter] = useState('')

  const fetchTires = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/tires?limit=1000', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setTires(data.tires || [])
        setFilteredTires(data.tires || [])
      }
    } catch (error) {
      toast.error('Failed to load tire data')
    } finally {
      setLoading(false)
    }
  }

  const downloadExcel = async () => {
    try {
      const response = await fetch('/api/tires/excel', {
        credentials: 'include'
      })
      if (response.ok) {
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
      }
    } catch (error) {
      toast.error('Download failed')
    }
  }

  useEffect(() => {
    fetchTires()
  }, [])

  useEffect(() => {
    let filtered = tires

    if (searchTerm) {
      filtered = filtered.filter(tire => 
        tire.tireSize.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tire.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tire.plateNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tire.driverName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (manufacturerFilter && manufacturerFilter !== 'all') {
      filtered = filtered.filter(tire => tire.manufacturer === manufacturerFilter)
    }

    if (originFilter && originFilter !== 'all') {
      filtered = filtered.filter(tire => tire.origin === originFilter)
    }

    setFilteredTires(filtered)
  }, [tires, searchTerm, manufacturerFilter, originFilter])

  const uniqueManufacturers = [...new Set(tires.map(t => t.manufacturer))]
  const uniqueOrigins = [...new Set(tires.map(t => t.origin))]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Excel View - Tire Inventory ({filteredTires.length} items)
          </CardTitle>
          <div className="flex gap-2">
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <Input
            placeholder="Search tires..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Manufacturers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Manufacturers</SelectItem>
              {uniqueManufacturers.filter(m => m).map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={originFilter} onValueChange={setOriginFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Origins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Origins</SelectItem>
              {uniqueOrigins.filter(o => o).map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={() => {
              setSearchTerm('')
              setManufacturerFilter('all')
              setOriginFilter('all')
            }}
            variant="outline"
          >
            <Filter className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading...</span>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Tire Size</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Origin</TableHead>
                  <TableHead>Plate Number</TableHead>
                  <TableHead>Trailer Number</TableHead>
                  <TableHead>Driver Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTires.map((tire) => (
                  <TableRow key={tire.id}>
                    <TableCell className="font-medium">{tire.tireSize}</TableCell>
                    <TableCell>{tire.manufacturer}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{tire.origin}</Badge>
                    </TableCell>
                    <TableCell>{tire.plateNumber || '-'}</TableCell>
                    <TableCell>{tire.trailerNumber || '-'}</TableCell>
                    <TableCell>{tire.driverName || '-'}</TableCell>
                    <TableCell>{tire.quantity}</TableCell>
                    <TableCell>{tire.serialNumber || '-'}</TableCell>
                    <TableCell>{tire.notes || '-'}</TableCell>
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
            {tires.length === 0 && (
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