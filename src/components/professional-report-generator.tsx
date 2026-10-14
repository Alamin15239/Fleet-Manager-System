'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  FileText, 
  Download, 
  Calendar, 
  Filter, 
  RefreshCw,
  Settings,
  Eye,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Truck,
  User,
  Package,
  TrendingUp,
  BarChart3,
  PieChart
} from 'lucide-react'
import { format } from 'date-fns'
import { apiGet } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'

interface ReportTemplate {
  id: string
  name: string
  description: string
  type: 'summary' | 'detailed' | 'analytical' | 'custom'
  sections: string[]
}

interface ReportConfig {
  template: string
  dateRange: {
    start: string
    end: string
  }
  filters: {
    manufacturer?: string
    origin?: string
    plateNumbers?: string[]
    trailerNumbers?: string[]
    driverName?: string
  }
  includeCharts: boolean
  format: 'pdf' | 'excel' | 'csv'
}

const reportTemplates: ReportTemplate[] = [
  {
    id: 'executive-summary',
    name: 'Executive Summary',
    description: 'High-level overview for management',
    type: 'summary',
    sections: ['overview', 'key-metrics', 'top-performers', 'recommendations']
  },
  {
    id: 'detailed-inventory',
    name: 'Detailed Inventory Report',
    description: 'Complete tire inventory with all details',
    type: 'detailed',
    sections: ['inventory-list', 'vehicle-breakdown', 'cost-analysis', 'maintenance-schedule']
  },
  {
    id: 'trailer-report',
    name: 'Trailer Tire Report',
    description: 'Trailer-specific tire inventory and analysis',
    type: 'detailed',
    sections: ['trailer-inventory', 'trailer-performance', 'maintenance-tracking', 'recommendations']
  },
  {
    id: 'manufacturer-analysis',
    name: 'Manufacturer Analysis',
    description: 'Performance analysis by tire manufacturer',
    type: 'analytical',
    sections: ['manufacturer-stats', 'cost-comparison', 'durability-analysis', 'recommendations']
  },
  {
    id: 'vehicle-performance',
    name: 'Vehicle Performance Report',
    description: 'Tire usage and performance by vehicle',
    type: 'analytical',
    sections: ['vehicle-stats', 'usage-patterns', 'cost-per-vehicle', 'maintenance-needs']
  },
  {
    id: 'custom-report',
    name: 'Custom Report',
    description: 'Build your own custom report',
    type: 'custom',
    sections: []
  }
]

export default function ProfessionalReportGenerator() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    template: '',
    dateRange: {
      start: format(new Date(2024, 0, 1), 'yyyy-MM-dd'), // January 1, 2024
      end: format(new Date(), 'yyyy-MM-dd')
    },
    filters: {},
    includeCharts: true,
    format: 'pdf'
  })
  const [showPreview, setShowPreview] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [selectedTireIds, setSelectedTireIds] = useState<string[]>([])
  const [tireSelectionActive, setTireSelectionActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Available filter options
  const [manufacturers, setManufacturers] = useState<string[]>([])
  const [origins] = useState(['CHINESE', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER'])
  const [plates, setPlates] = useState<string[]>([])
  const [trailerNumbers, setTrailerNumbers] = useState<string[]>([])
  const [drivers, setDrivers] = useState<string[]>([])

  useEffect(() => {
    console.log('ProfessionalReportGenerator mounted')
    console.log('Authentication state:', { isAuthenticated, isLoading, user })
    
    if (isLoading) return
    
    if (!isAuthenticated) {
      console.log('User not authenticated, component should not be visible')
      return
    }
    
    console.log('User is authenticated, fetching filter options')
    fetchFilterOptions()
  }, [isAuthenticated, isLoading, user])

  const fetchFilterOptions = async () => {
    console.log('Fetching filter options...')
    try {
      const response = await apiGet('/api/tires?limit=1000')
      console.log('Filter options response status:', response.status)
      if (response.ok) {
        const data = await response.json()
        console.log('Filter options data received:', data)
        const allTires = data.tires || []

        const nonEmptyUniqueValues = (values: unknown[]): string[] => [...new Set(
          values.filter((value): value is string => typeof value === 'string' && value.trim().length > 0).map(value => value.trim())
        )]
        const uniqueManufacturers = nonEmptyUniqueValues(allTires.map((t: any) => t.manufacturer))
        const uniquePlates = nonEmptyUniqueValues(allTires.map((t: any) => t.plateNumber))
        const uniqueTrailerNumbers = [...new Set(allTires.map((t: any) => t.trailerNumber).filter(Boolean))] as string[]
        const uniqueDrivers = [...new Set(allTires.map((t: any) => t.driverName).filter(Boolean))] as string[]

        console.log('Unique manufacturers:', uniqueManufacturers)
        console.log('Unique plates:', uniquePlates)
        console.log('Unique drivers:', uniqueDrivers)

        setManufacturers(uniqueManufacturers.sort())
        setPlates(uniquePlates.sort())
        setTrailerNumbers(uniqueTrailerNumbers.sort())
        setDrivers(uniqueDrivers.sort())
      } else {
        console.error('Failed to fetch filter options:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Error fetching filter options:', error)
    }
  }

  const generateReport = async () => {
    if (!reportConfig.template) {
      setError('Please select a report template')
      return
    }

    setGenerating(true)
    setError(null)
    setSuccess(null)
    setReportData(null)
    setSelectedTireIds([])
    setTireSelectionActive(false)

    try {
      console.log('Starting report generation...')
      console.log('Report config:', reportConfig)
      
      // Build query parameters
      const params = new URLSearchParams({
        template: reportConfig.template,
        startDate: reportConfig.dateRange.start,
        endDate: reportConfig.dateRange.end,
        includeCharts: reportConfig.includeCharts.toString(),
        format: reportConfig.format
      })

      // Add filters only if they have values
      Object.entries(reportConfig.filters).forEach(([key, value]) => {
        if (Array.isArray(value)) value.forEach(item => params.append(key, item))
        else if (value && value !== 'all' && value.trim() !== '') params.append(key, value)
      })

      const apiUrl = `/api/tires/reports/generate?${params}`
      console.log('Making request to:', apiUrl)

      const response = await apiGet(apiUrl)
      console.log('Response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Report data received:', {
          template: data.template,
          tireCount: data.tires?.length || 0,
          isEmpty: data.isEmpty,
          summary: data.summary
        })
        
        setReportData(data)
        setSelectedTireIds([])
        setTireSelectionActive(false)
        
        if (data.isEmpty || !data.tires || data.tires.length === 0) {
          setSuccess('Report generated - no data found for selected criteria. Try adjusting your date range or filters.')
        } else {
          setSuccess(`Report generated successfully with ${data.tires.length} tire records`)
        }
        
        setShowPreview(true)
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        console.error('Report generation error:', errorData)
        setError(errorData.error || `Failed to generate report (${response.status})`)
      }
    } catch (error) {
      console.error('Report generation exception:', error)
      setError('Failed to generate report. Please check your connection and try again.')
    } finally {
      setGenerating(false)
    }
  }

  const selectedTires = reportData?.tires
    ? (tireSelectionActive ? reportData.tires.filter((tire: any) => selectedTireIds.includes(tire.id)) : reportData.tires)
    : []
  const selectedSummary = (() => {
    const totalTires = selectedTires.reduce((sum: number, tire: any) => sum + (tire.quantity || 1), 0)
    const vehicles = new Set([...selectedTires.map((t: any) => t.plateNumber).filter(Boolean), ...selectedTires.map((t: any) => t.trailerNumber).filter(Boolean)])
    const drivers = new Set(selectedTires.map((t: any) => t.driverName).filter(Boolean))
    return { totalTires, totalVehicles: vehicles.size, totalDrivers: drivers.size, averageTiresPerVehicle: vehicles.size ? (totalTires / vehicles.size).toFixed(1) : 0 }
  })()
  const toggleTireSelection = (id: string) => {
    const currentSelection = tireSelectionActive ? selectedTireIds : (reportData?.tires || []).map((tire: any) => tire.id)
    setTireSelectionActive(true)
    setSelectedTireIds(currentSelection.includes(id) ? currentSelection.filter((item: string) => item !== id) : [...currentSelection, id])
  }
  const selectAllTires = () => {
    setTireSelectionActive(true)
    setSelectedTireIds((reportData?.tires || []).map((tire: any) => tire.id))
  }

  const downloadReport = async () => {
    if (!reportData) return

    // Check if data is empty
    if (reportData.isEmpty) {
      setError('Cannot download report - no data available')
      return
    }
    if (selectedTires.length === 0) {
      setError('Select at least one tire record before downloading the report')
      return
    }

    try {
      // Create report content based on format
      let content: string | Blob
      let filename: string
      let mimeType: string

      if (reportConfig.format === 'csv') {
        content = generateCSVContent()
        filename = `tire-report-${format(new Date(), 'yyyy-MM-dd')}.csv`
        mimeType = 'text/csv'
      } else if (reportConfig.format === 'excel') {
        content = await generateExcelContent()
        filename = `tire-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      } else {
        content = await generatePDFContent()
        if (content instanceof Blob) {
          filename = `tire-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`
          mimeType = 'application/pdf'
        } else {
          filename = `tire-report-${format(new Date(), 'yyyy-MM-dd')}.txt`
          mimeType = 'text/plain'
        }
      }

      // Create and download file
      const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setSuccess('Report downloaded successfully')
    } catch (error) {
      console.error('Download error:', error)
      setError('Failed to download report')
    }
  }

  const generateCSVContent = () => {
    // Report Header Section
    const reportHeader = [
      'FLEET TIRE INVENTORY REPORT',
      `Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`,
      `Template: ${reportTemplates.find(t => t.id === reportConfig.template)?.name || reportConfig.template}`,
      `Date Range: ${format(new Date(reportConfig.dateRange.start), 'MMM dd, yyyy')} to ${format(new Date(reportConfig.dateRange.end), 'MMM dd, yyyy')}`,
      '',
      'EXECUTIVE SUMMARY',
      `Total Tires in Fleet: ${selectedSummary?.totalTires || 0}`,
      `Total Vehicles: ${selectedSummary?.totalVehicles || 0}`,
      `Total Drivers: ${selectedSummary?.totalDrivers || 0}`,
      `Average Tires per Vehicle: ${selectedSummary?.averageTiresPerVehicle || 0}`,
      '',
      'DETAILED TIRE INVENTORY'
    ]

    // Enhanced CSV headers with clearer descriptions
    const detailHeaders = [
      'Tire Size',
      'Brand/Manufacturer', 
      'Country of Origin',
      'Serial Number',
      'Truck Plate Number',
      'Trailer ID Number',
      'Assigned Driver',
      'Tire Quantity',
      'Vehicle Type',
      'Installation Notes',
      'Date Added',
      'Added By'
    ]

    const rows = [...reportHeader, detailHeaders.join(',')]

    if (selectedTires && selectedTires.length > 0) {
      // Sort tires: trailers first if this is a trailer report
      const sortedTires = reportConfig.template === 'trailer-report' 
        ? [...selectedTires].sort((a, b) => {
            if (a.trailerNumber && !b.trailerNumber) return -1
            if (!a.trailerNumber && b.trailerNumber) return 1
            return 0
          })
        : selectedTires
        
      sortedTires.forEach((tire: any) => {
        const vehicleType = tire.trailerNumber ? 'TRAILER UNIT' : 'TRUCK UNIT'
        const createdBy = tire.createdBy?.name || tire.createdBy?.email || 'Unknown User'
        const csvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
        
        rows.push([
          csvCell(tire.tireSize),
          csvCell(tire.manufacturer),
          csvCell(tire.origin ? tire.origin.charAt(0) + tire.origin.slice(1).toLowerCase() : 'N/A'),
          csvCell(tire.serialNumber || 'N/A'),
          csvCell(tire.plateNumber || 'N/A'),
          csvCell(tire.trailerNumber || 'N/A'),
          csvCell(tire.driverName || 'Unassigned'),
          tire.quantity || 1,
          csvCell(vehicleType),
          csvCell(tire.notes || 'Standard Installation'),
          csvCell(format(new Date(tire.createdAt), 'MMM dd, yyyy HH:mm')),
          csvCell(createdBy)
        ].join(','))
      })
      
      // Add summary footer with exact quantities
      rows.push('')
      rows.push('SUMMARY BY VEHICLE TYPE')
      const truckTires = selectedTires.filter((t: any) => !t.trailerNumber)
      const trailerTires = selectedTires.filter((t: any) => t.trailerNumber)
      
      const totalTruckTires = truckTires.reduce((sum: number, t: any) => sum + (t.quantity || 1), 0)
      const totalTrailerTires = trailerTires.reduce((sum: number, t: any) => sum + (t.quantity || 1), 0)
      
      rows.push(`Truck Tires: ${totalTruckTires} tires on ${new Set(truckTires.map((t: any) => t.plateNumber).filter(Boolean)).size} trucks`)
      rows.push(`Trailer Tires: ${totalTrailerTires} tires on ${new Set(trailerTires.map((t: any) => t.trailerNumber)).size} trailers`)
      rows.push(`TOTAL FLEET TIRES: ${totalTruckTires + totalTrailerTires} tires`)
      
      // Add trailer-specific summary if this is a trailer report
      if (reportConfig.template === 'trailer-report' || reportConfig.filters.trailerNumbers?.length) {
        rows.push('')
        rows.push('TRAILER-SPECIFIC ANALYSIS')
        const uniqueTrailers = new Set(trailerTires.map((t: any) => t.trailerNumber))
        rows.push(`Total Trailers with Tires: ${uniqueTrailers.size}`)
        rows.push(`Average Tires per Trailer: ${uniqueTrailers.size > 0 ? (totalTrailerTires / uniqueTrailers.size).toFixed(1) : 0}`)
        
        // Top trailer manufacturers for trailers
        const trailerManufacturers = trailerTires.reduce((acc: any, t: any) => {
          acc[t.manufacturer] = (acc[t.manufacturer] || 0) + (t.quantity || 1)
          return acc
        }, {})
        const topTrailerManufacturer = Object.entries(trailerManufacturers).sort(([,a]: any, [,b]: any) => b - a)[0]
        if (topTrailerManufacturer) {
          rows.push(`Most Used Trailer Tire Brand: ${topTrailerManufacturer[0]} (${topTrailerManufacturer[1]} tires)`)
        }
      }
    } else {
      rows.push('No tire data available for the selected criteria')
    }

    return rows.join('\n')
  }

  const generateExcelContent = async () => {
    // Use exceljs for proper Excel generation
    try {
      const ExcelJS = await import('exceljs')
      const workbook = new ExcelJS.Workbook()
      workbook.creator = 'Fleet Manager'
      workbook.created = new Date()

      const summarySheet = workbook.addWorksheet('Executive Summary')
      summarySheet.columns = [{ width: 32 }, { width: 24 }]
      summarySheet.mergeCells('A1:B1')
      summarySheet.getCell('A1').value = 'FLEET TIRE INVENTORY REPORT'
      summarySheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
      summarySheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F223B' } }
      summarySheet.getRow(1).height = 30
      summarySheet.addRow(['Template', reportTemplates.find(t => t.id === reportConfig.template)?.name || reportConfig.template])
      summarySheet.addRow(['Generated', new Date()])
      summarySheet.addRow(['Report period', `${reportConfig.dateRange.start} to ${reportConfig.dateRange.end}`])
      summarySheet.addRow(['Total tires', selectedSummary?.totalTires || 0])
      summarySheet.addRow(['Vehicles', selectedSummary?.totalVehicles || 0])
      summarySheet.addRow(['Drivers', selectedSummary?.totalDrivers || 0])
      summarySheet.getCell('B3').numFmt = 'dd mmm yyyy hh:mm'
      for (let row = 2; row <= 7; row += 1) {
        summarySheet.getCell(`A${row}`).font = { bold: true, color: { argb: 'FF334155' } }
      }
      for (const row of [5, 6, 7]) summarySheet.getCell(`B${row}`).numFmt = '#,##0'
      summarySheet.views = [{ state: 'frozen', ySplit: 1 }]

      const worksheet = workbook.addWorksheet('Tire Report')

      // Add headers with clearer descriptions
      worksheet.columns = [
        { header: 'Tire Size', key: 'tireSize', width: 15 },
        { header: 'Brand/Manufacturer', key: 'manufacturer', width: 20 },
        { header: 'Country of Origin', key: 'origin', width: 15 },
        { header: 'Serial Number', key: 'serialNumber', width: 18 },
        { header: 'Truck Plate Number', key: 'plateNumber', width: 18 },
        { header: 'Trailer ID Number', key: 'trailerNumber', width: 18 },
        { header: 'Assigned Driver', key: 'driverName', width: 20 },
        { header: 'Tire Quantity', key: 'quantity', width: 12 },
        { header: 'Vehicle Type', key: 'vehicleType', width: 15 },
        { header: 'Added By', key: 'createdBy', width: 18 },
        { header: 'Date Added', key: 'createdAt', width: 15 }
      ]

      // Add data
      if (selectedTires) {
        selectedTires.forEach((tire: any) => {
          const vehicleType = tire.trailerNumber ? 'TRAILER UNIT' : 'TRUCK UNIT'
          const createdBy = tire.createdBy?.name || tire.createdBy?.email || 'Unknown User'
          worksheet.addRow({
            tireSize: tire.tireSize,
            manufacturer: tire.manufacturer,
            origin: tire.origin.charAt(0) + tire.origin.slice(1).toLowerCase(),
            serialNumber: tire.serialNumber || 'N/A',
            plateNumber: tire.plateNumber || 'N/A',
            trailerNumber: tire.trailerNumber ? `TRL-${tire.trailerNumber}` : 'N/A',
            driverName: tire.driverName || 'Unassigned',
            quantity: tire.quantity || 1,
            vehicleType: vehicleType,
            createdBy: createdBy,
            createdAt: new Date(tire.createdAt)
          })
        })
      }

      // Style the header row
      worksheet.getRow(1).height = 26
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1D4E89' }
      }
      worksheet.getRow(1).alignment = { vertical: 'middle', wrapText: true }
      worksheet.views = [{ state: 'frozen', ySplit: 1 }]
      worksheet.autoFilter = { from: 'A1', to: `K${Math.max(1, worksheet.rowCount)}` }
      worksheet.getColumn('createdAt').numFmt = 'dd mmm yyyy'
      worksheet.getColumn('quantity').numFmt = '#,##0'
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1 && rowNumber % 2 === 0) {
          row.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } }
          })
        }
      })

      // Generate buffer
      const buffer = await workbook.xlsx.writeBuffer()
      return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    } catch (error) {
      console.error('Error generating Excel file:', error)
      throw error
    }
  }

  const generatePDFContent = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 12
      const tires = selectedTires || []
      const columns = [
        { title: 'TIRE', width: 49 },
        { title: 'VEHICLE', width: 43 },
        { title: 'DRIVER', width: 36 },
        { title: 'SERIAL NUMBER', width: 43 },
        { title: 'ORIGIN', width: 31 },
        { title: 'QTY', width: 17 },
        { title: 'DATE ADDED', width: 45 },
      ]
      const tableWidth = columns.reduce((sum, column) => sum + column.width, 0)
      const drawHeader = () => {
        doc.setFillColor(15, 34, 59)
        doc.rect(0, 0, pageWidth, 31, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(16)
        doc.text('FLEET TIRE INVENTORY REPORT', margin, 13)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(reportTemplates.find(t => t.id === reportConfig.template)?.name || '', margin, 21)
        doc.text(`Generated ${format(new Date(), 'dd MMM yyyy, HH:mm')}`, pageWidth - margin, 13, { align: 'right' })
        doc.text(`${reportConfig.dateRange.start} to ${reportConfig.dateRange.end}`, pageWidth - margin, 21, { align: 'right' })

        const metrics = [
          ['TOTAL TIRES', String(selectedSummary?.totalTires || 0)],
          ['VEHICLES', String(selectedSummary?.totalVehicles || 0)],
          ['DRIVERS', String(selectedSummary?.totalDrivers || 0)],
          ['RECORDS', String(tires.length)],
        ]
        const gap = 4
        const cardWidth = (tableWidth - gap * 3) / 4
        metrics.forEach(([label, value], index) => {
          const x = margin + index * (cardWidth + gap)
          doc.setFillColor(245, 248, 252)
          doc.setDrawColor(226, 232, 240)
          doc.roundedRect(x, 36, cardWidth, 17, 2, 2, 'FD')
          doc.setTextColor(100, 116, 139)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(6.5)
          doc.text(label, x + 3, 42)
          doc.setTextColor(15, 34, 59)
          doc.setFontSize(9)
          doc.text(value, x + 3, 49)
        })

        doc.setFillColor(29, 78, 137)
        doc.rect(margin, 60, tableWidth, 8, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6.5)
        let x = margin
        columns.forEach(column => {
          doc.text(column.title, x + 2, 65.3)
          x += column.width
        })
        doc.setTextColor(30, 41, 59)
        return 68
      }

      let y = drawHeader()
      if (tires.length === 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(100, 116, 139)
        doc.text('No tire records match the selected criteria.', margin, y + 12)
      }
      tires.forEach((tire: any, index: number) => {
        const vehicle = tire.trailerNumber ? `Trailer ${tire.trailerNumber}` : tire.plateNumber || 'Unassigned'
        const values = [
          `${tire.manufacturer || 'Unknown'} · ${tire.tireSize || '—'}`,
          vehicle,
          tire.driverName || 'Unassigned',
          tire.serialNumber || '—',
          tire.origin || '—',
          String(tire.quantity || 1),
          format(new Date(tire.createdAt), 'dd MMM yyyy'),
        ]
        const wrapped = values.map((value: string, columnIndex: number) =>
          doc.splitTextToSize(value, columns[columnIndex].width - 4) as string[]
        )
        const rowHeight = Math.max(8, ...wrapped.map(lines => lines.length * 3.2 + 3))
        if (y + rowHeight > pageHeight - 15) {
          doc.addPage()
          y = drawHeader()
        }
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252)
          doc.rect(margin, y, tableWidth, rowHeight, 'F')
        }
        doc.setDrawColor(226, 232, 240)
        doc.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6.5)
        doc.setTextColor(51, 65, 85)
        let x = margin
        wrapped.forEach((lines: string[], columnIndex: number) => {
          doc.text(lines.slice(0, 3), x + 2, y + 4.6)
          x += columns[columnIndex].width
        })
        y += rowHeight
      })

      if (reportConfig.includeCharts && tires.length > 0) {
        doc.addPage()
        doc.setFillColor(15, 34, 59)
        doc.rect(0, 0, pageWidth, 27, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(15)
        doc.text('INVENTORY ANALYSIS', margin, 17)

        const groupCount = (key: 'manufacturer' | 'origin') => {
          const counts = new Map<string, number>()
          tires.forEach((tire: any) => {
            const name = String(tire[key] || 'Unspecified')
            counts.set(name, (counts.get(name) || 0) + Number(tire.quantity || 1))
          })
          return Array.from(counts, ([name, quantity]) => ({ name, quantity }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 8)
        }

        const drawChart = (title: string, items: Array<{ name: string; quantity: number }>, x: number, width: number, color: [number, number, number]) => {
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(10)
          doc.setTextColor(15, 34, 59)
          doc.text(title, x, 39)
          const maximum = Math.max(1, ...items.map(item => item.quantity))
          items.forEach((item, index) => {
            const rowY = 49 + index * 19
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(7.5)
            doc.setTextColor(51, 65, 85)
            doc.text(doc.splitTextToSize(item.name, 42).slice(0, 1), x, rowY)
            doc.setFillColor(235, 240, 246)
            doc.roundedRect(x + 45, rowY - 4, width - 61, 6, 2, 2, 'F')
            doc.setFillColor(...color)
            doc.roundedRect(x + 45, rowY - 4, Math.max(2, (width - 61) * item.quantity / maximum), 6, 2, 2, 'F')
            doc.setFont('helvetica', 'bold')
            doc.text(String(item.quantity), x + width - 12, rowY, { align: 'right' })
          })
          if (items.length === 0) {
            doc.setFont('helvetica', 'normal')
            doc.setFontSize(8)
            doc.setTextColor(100, 116, 139)
            doc.text('No data available', x, 51)
          }
        }

        drawChart('TIRES BY MANUFACTURER', groupCount('manufacturer'), margin, 132, [29, 78, 137])
        drawChart('TIRES BY ORIGIN', groupCount('origin'), margin + 140, 132, [14, 116, 100])
      }

      for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
        doc.setPage(page)
        doc.setDrawColor(226, 232, 240)
        doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7)
        doc.setTextColor(100, 116, 139)
        doc.text('Fleet Manager · Tire Inventory', margin, pageHeight - 5)
        doc.text(`Page ${page} of ${doc.getNumberOfPages()}`, pageWidth - margin, pageHeight - 5, { align: 'right' })
      }

      return doc.output('blob')
    } catch (error) {
      console.error('PDF generation failed:', error)
      throw error
    }
  }

  const getTemplateIcon = (type: string) => {
    switch (type) {
      case 'summary': return <BarChart3 className="h-5 w-5" />
      case 'detailed': return <FileText className="h-5 w-5" />
      case 'analytical': return <TrendingUp className="h-5 w-5" />
      case 'custom': return <Settings className="h-5 w-5" />
      default: return <FileText className="h-5 w-5" />
    }
  }

  const resetFilters = () => {
    setReportConfig({
      template: '',
      dateRange: {
        start: format(new Date(2024, 0, 1), 'yyyy-MM-dd'), // January 1, 2024
        end: format(new Date(), 'yyyy-MM-dd')
      },
      filters: {},
      includeCharts: true,
      format: 'pdf'
    })
    setError(null)
    setSuccess(null)
    setReportData(null)
    setSelectedTireIds([])
    setTireSelectionActive(false)
  }

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold mb-2">Authentication Required</h1>
          <p className="text-gray-600 mb-4">
            Please log in to access the report generator.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Report Generator</h1>
          <p className="text-muted-foreground text-sm">Generate professional tire management reports</p>
        </div>
        <Button variant="outline" onClick={() => {
          console.log('Reset button clicked')
          resetFilters()
        }} size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      {/* Error and Success Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Report Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Template Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Report Template</Label>
              {reportConfig.template && (
                <div className="text-sm text-green-600 font-medium">
                  ✓ Selected: {reportTemplates.find(t => t.id === reportConfig.template)?.name}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {reportTemplates.map((template) => (
                <div
                  key={template.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={reportConfig.template === template.id}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setReportConfig({ ...reportConfig, template: template.id })
                      setError(null)
                      setSuccess(`Selected: ${template.name}`)
                    }
                  }}
                  className={`p-3 sm:p-4 border rounded-lg cursor-pointer transition-[border-color,box-shadow,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    reportConfig.template === template.id
                      ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/40 hover:shadow-sm'
                  }`}
                  onClick={() => {
                    console.log('Template clicked:', template.id)
                    setReportConfig({ ...reportConfig, template: template.id })
                    // Add visual feedback
                    setError(null)
                    setSuccess(`Selected: ${template.name}`)
                  }}
                >
                  <div className="flex items-start gap-2 sm:gap-3 mb-2">
                    <div className="flex-shrink-0 mt-1">
                      {getTemplateIcon(template.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base truncate">{template.name}</h3>
                      <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{template.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <Badge variant="outline" className="text-xs">{template.type}</Badge>
                      {reportConfig.template === template.id && (
                        <div className="w-2 h-2 sm:w-3 sm:h-3 bg-green-500 rounded-full animate-pulse"></div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Start Date</Label>
              <Input
                type="date"
                value={reportConfig.dateRange.start}
                onChange={(e) => setReportConfig({
                  ...reportConfig,
                  dateRange: { ...reportConfig.dateRange, start: e.target.value }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">End Date</Label>
              <Input
                type="date"
                value={reportConfig.dateRange.end}
                onChange={(e) => setReportConfig({
                  ...reportConfig,
                  dateRange: { ...reportConfig.dateRange, end: e.target.value }
                })}
              />
            </div>
          </div>

          {/* Filters */}
          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters (Optional)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Manufacturer</Label>
                <Select value={reportConfig.filters.manufacturer || ''} onValueChange={(value) => 
                  setReportConfig({
                    ...reportConfig,
                    filters: { ...reportConfig.filters, manufacturer: value === 'all' ? undefined : value }
                  })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="All manufacturers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All manufacturers</SelectItem>
                    {manufacturers.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Origin</Label>
                <Select value={reportConfig.filters.origin || ''} onValueChange={(value) => 
                  setReportConfig({
                    ...reportConfig,
                    filters: { ...reportConfig.filters, origin: value === 'all' ? undefined : value }
                  })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="All origins" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All origins</SelectItem>
                    {origins.map((o) => (
                      <SelectItem key={o} value={o}>{o}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Truck Plates (select any number)</Label>
                <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border p-2">
                  {plates.map(plate => <label key={plate} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={reportConfig.filters.plateNumbers?.includes(plate) || false} onCheckedChange={checked => setReportConfig(current => ({ ...current, filters: { ...current.filters, plateNumbers: checked ? [...(current.filters.plateNumbers || []), plate] : (current.filters.plateNumbers || []).filter(item => item !== plate) } }))} />
                    <span>{plate}</span>
                  </label>)}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Trailer Numbers (select any number)</Label>
                <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border p-2">
                  {trailerNumbers.map(number => <label key={number} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={reportConfig.filters.trailerNumbers?.includes(number) || false} onCheckedChange={checked => setReportConfig(current => ({ ...current, filters: { ...current.filters, trailerNumbers: checked ? [...(current.filters.trailerNumbers || []), number] : (current.filters.trailerNumbers || []).filter(item => item !== number) } }))} />
                    <span>{number}</span>
                  </label>)}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Driver Name</Label>
                <Select value={reportConfig.filters.driverName || ''} onValueChange={(value) => 
                  setReportConfig({
                    ...reportConfig,
                    filters: { ...reportConfig.filters, driverName: value === 'all' ? undefined : value }
                  })
                }>
                  <SelectTrigger>
                    <SelectValue placeholder="All drivers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All drivers</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Output Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-3">
              <Label className="text-sm">Include Charts</Label>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="includeCharts"
                  checked={reportConfig.includeCharts}
                  onChange={(e) => setReportConfig({ ...reportConfig, includeCharts: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="includeCharts" className="text-sm">Include charts and graphs in report</Label>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm">Output Format</Label>
              <Select value={reportConfig.format} onValueChange={(value: any) => 
                setReportConfig({ ...reportConfig, format: value })
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF Document</SelectItem>
                  <SelectItem value="excel">Excel Spreadsheet</SelectItem>
                  <SelectItem value="csv">CSV Data</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2">
            {reportData && (
              <Button 
                variant="outline" 
                onClick={() => {
                  console.log('Preview button clicked')
                  setShowPreview(true)
                }}
                className="w-full sm:w-auto"
              >
                <Eye className="mr-2 h-4 w-4" />
                Preview Report
              </Button>
            )}
            <Button 
              onClick={generateReport}
              disabled={generating || !reportConfig.template}
              className="w-full sm:w-auto"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  <span className="hidden sm:inline">Generating...</span>
                  <span className="sm:hidden">Generating</span>
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Generate Report</span>
                  <span className="sm:hidden">Generate</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Report Preview</DialogTitle>
            <DialogDescription className="text-sm">
              Preview of your generated report
            </DialogDescription>
          </DialogHeader>
          
          {reportData && (
            <>
              {/* Empty Data Message */}
              {reportData.isEmpty && (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Data Found</h3>
                  <p className="text-gray-600 mb-4">
                    No tire data found for the selected criteria and date range.
                  </p>
                  <p className="text-sm text-gray-500">
                    Try adjusting your filters or date range to include more data.
                  </p>
                </div>
              )}

              {/* Report Content - Only show if not empty */}
              {!reportData.isEmpty && (
                <div className="space-y-6">
                  {/* Report Header */}
                  <div className="text-center space-y-2 border-b pb-4">
                    <h1 className="text-xl sm:text-2xl font-bold">
                      {reportConfig.template === 'trailer-report' ? 'TRAILER TIRE MANAGEMENT REPORT' : 'TIRE MANAGEMENT REPORT'}
                    </h1>
                    <p className="text-gray-600 text-sm sm:text-base">
                      {reportTemplates.find(t => t.id === reportConfig.template)?.name}
                    </p>
                    {reportConfig.filters.trailerNumbers?.length && (
                      <p className="text-orange-600 text-sm font-medium">
                        Filtered for Trailers: {reportConfig.filters.trailerNumbers?.join(', ')}
                      </p>
                    )}
                    <p className="text-xs sm:text-sm text-gray-500">
                      {reportConfig.dateRange.start} to {reportConfig.dateRange.end}
                    </p>
                  </div>

                  {/* Executive Summary */}
                  {selectedSummary && (
                    <div className="space-y-4">
                      <h2 className="text-lg sm:text-xl font-semibold">Executive Summary</h2>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
                          <div className="text-lg sm:text-2xl font-bold text-blue-600">
                            {selectedSummary.totalTires || 0}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Total Tires</div>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
                          <div className="text-lg sm:text-2xl font-bold text-green-600">
                            {selectedSummary.totalVehicles || 0}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Vehicles</div>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
                          <div className="text-lg sm:text-2xl font-bold text-purple-600">
                            {selectedSummary.totalDrivers || 0}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Drivers</div>
                        </div>
                        <div className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
                          <div className="text-lg sm:text-2xl font-bold text-orange-600">
                            {selectedSummary.averageTiresPerVehicle || 0}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600">Avg Tires/Vehicle</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Detailed Data */}
                  {reportData.tires && reportData.tires.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span>{tireSelectionActive ? `${selectedTireIds.length} of ${reportData.tires.length} tires selected for this report` : `All ${reportData.tires.length} matching tires included`}</span>
                        <Button variant="outline" size="sm" onClick={selectAllTires}>Select all</Button>
                        <Button variant="outline" size="sm" onClick={() => { setTireSelectionActive(true); setSelectedTireIds([]) }}>Clear selection</Button>
                      </div>
                      <h2 className="text-lg sm:text-xl font-semibold">
                        {reportConfig.template === 'trailer-report' ? 'Trailer Tire Inventory' : 'Detailed Tire Inventory'}
                      </h2>
                      
                      {/* Show trailer-specific summary if applicable */}
                      {(reportConfig.template === 'trailer-report' || reportConfig.filters.trailerNumbers?.length) && (
                        <div className="bg-orange-50 p-4 rounded-lg">
                          <h3 className="font-semibold text-orange-800 mb-2">Trailer Analysis</h3>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                            <div>
                              <span className="text-orange-600 font-medium">Trailer Tires:</span>
                              <span className="ml-2">{selectedTires.filter((t: any) => t.trailerNumber).reduce((sum: number, t: any) => sum + (t.quantity || 1), 0)}</span>
                            </div>
                            <div>
                              <span className="text-orange-600 font-medium">Unique Trailers:</span>
                              <span className="ml-2">{new Set(selectedTires.filter((t: any) => t.trailerNumber).map((t: any) => t.trailerNumber)).size}</span>
                            </div>
                            <div>
                              <span className="text-orange-600 font-medium">Avg per Trailer:</span>
                              <span className="ml-2">
                                {(() => {
                                  const trailerTires = selectedTires.filter((t: any) => t.trailerNumber)
                                  const uniqueTrailers = new Set(trailerTires.map((t: any) => t.trailerNumber)).size
                                  const totalTires = trailerTires.reduce((sum: number, t: any) => sum + (t.quantity || 1), 0)
                                  return uniqueTrailers > 0 ? (totalTires / uniqueTrailers).toFixed(1) : '0'
                                })()}
                              </span>
                            </div>
                            <div>
                              <span className="text-orange-600 font-medium">Coverage:</span>
                              <span className="ml-2">
                                {Math.round((selectedTires.filter((t: any) => t.trailerNumber).length / selectedTires.length) * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      <div className="max-h-[60vh] overflow-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Select</TableHead>
                              <TableHead>Tire Details</TableHead>
                              <TableHead>Vehicle/Trailer</TableHead>
                              <TableHead>Driver</TableHead>
                              <TableHead>Origin</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Created</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(() => {
                              // Sort to show trailers first if this is a trailer report
                              const sortedTires = reportConfig.template === 'trailer-report' 
                                ? [...reportData.tires].sort((a, b) => {
                                    if (a.trailerNumber && !b.trailerNumber) return -1
                                    if (!a.trailerNumber && b.trailerNumber) return 1
                                    return 0
                                  })
                                : reportData.tires
                              
                              return sortedTires.map((tire: any) => (
                                <TableRow key={tire.id} className={tire.trailerNumber ? 'bg-orange-50' : ''}>
                                  <TableCell><Checkbox checked={tireSelectionActive ? selectedTireIds.includes(tire.id) : true} onCheckedChange={() => toggleTireSelection(tire.id)} /></TableCell>
                                  <TableCell>
                                    <div>
                                      <div className="font-medium">{tire.manufacturer}</div>
                                      <div className="text-sm text-gray-500">{tire.tireSize}</div>
                                      {tire.serialNumber && (
                                        <div className="text-xs text-blue-600">S/N: {tire.serialNumber}</div>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      {tire.trailerNumber ? (
                                        <>
                                          <Package className="h-4 w-4 text-orange-500" />
                                          <div>
                                            <div className="font-medium text-orange-700">TRL-{tire.trailerNumber}</div>
                                            {tire.plateNumber && (
                                              <div className="text-xs text-gray-500">Truck: {tire.plateNumber}</div>
                                            )}
                                          </div>
                                        </>
                                      ) : (
                                        <>
                                          <Truck className="h-4 w-4 text-blue-500" />
                                          <span className="text-blue-700">{tire.plateNumber || 'N/A'}</span>
                                        </>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <User className="h-4 w-4 text-gray-400" />
                                      {tire.driverName || 'N/A'}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{tire.origin}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <Package className="h-4 w-4 text-gray-400" />
                                      {tire.quantity}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(tire.createdAt), 'MMM dd, yyyy')}
                                  </TableCell>
                                </TableRow>
                              ))
                            })()}
                          </TableBody>
                        </Table>
                      </div>
                      {tireSelectionActive && selectedTireIds.length === 0 && <p className="text-sm text-amber-700">No tire records are selected. Choose one or more rows before downloading.</p>}
                    </div>
                  )}

                  {/* Recommendations */}
                  <div className="space-y-4">
                    <h2 className="text-lg sm:text-xl font-semibold">Recommendations</h2>
                    <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                      <ul className="space-y-2 text-xs sm:text-sm">
                        {reportConfig.template === 'trailer-report' ? (
                          <>
                            <li>• Implement dedicated trailer tire rotation schedule</li>
                            <li>• Monitor trailer tire pressure more frequently due to load variations</li>
                            <li>• Consider trailer-specific tire brands for better durability</li>
                            <li>• Track trailer tire mileage separately from truck tires</li>
                            <li>• Establish trailer tire replacement intervals based on usage patterns</li>
                            <li>• Maintain spare trailer tires for emergency replacements</li>
                          </>
                        ) : (
                          <>
                            <li>• Implement regular tire maintenance schedule</li>
                            <li>• Monitor tire wear patterns and replace proactively</li>
                            <li>• Maintain detailed records for warranty claims</li>
                            <li>• Consider bulk purchasing for cost optimization</li>
                            <li>• Train drivers on proper tire inspection procedures</li>
                          </>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPreview(false)} className="w-full sm:w-auto">
              <X className="mr-2 h-4 w-4" />
              Close
            </Button>
            <Button 
              onClick={downloadReport} 
              disabled={!reportData || reportData?.isEmpty || !reportData?.tires || selectedTires.length === 0}
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
