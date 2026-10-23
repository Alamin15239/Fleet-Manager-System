'use client'
import { LocalizedText } from '@/components/localized-text'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { 
  FileText, 
  Download, 
  Eye,
  BarChart3,
  PieChart,
  TrendingUp,
  Package,
  Truck,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { format } from 'date-fns'
import { apiGet } from '@/lib/api'
import { isTireIncludedInAnalytics } from '@/lib/tire-analytics'
import { rowsToCsv } from '@/lib/csv-export'
import { PdfPreviewDialog } from '@/components/pdf-preview-dialog'

interface ReportData {
  totalTires: number
  totalVehicles: number
  totalDrivers: number
  manufacturerStats: { name: string; count: number; percentage: number }[]
  originStats: { name: string; count: number; percentage: number }[]
  vehicleTypeStats: { trucks: number; trailers: number }
  recentTires: any[]
  tireRows: any[]
}

async function createTireReportPdf(data: ReportData, dateRange: { start: string; end: string }) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
  const pageWidth = 210
  const margin = 8
  const right = pageWidth - margin
  const colors = { ink: [31, 48, 40] as const, muted: [103, 120, 111] as const, green: [32, 76, 58] as const, line: [216, 226, 220] as const }
  const pageTitle = (page: number) => {
    pdf.setFillColor(...colors.green)
    pdf.rect(0, 0, pageWidth, page === 1 ? 34 : 20, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(page === 1 ? 17 : 11)
    pdf.text('TIRE MANAGEMENT REPORT', margin, page === 1 ? 14 : 13)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(page === 1 ? 8 : 7)
    pdf.text(page === 1 ? `Report period: ${dateRange.start} to ${dateRange.end}  |  Generated: ${format(new Date(), 'dd MMM yyyy, HH:mm')}` : `Detailed tire inventory  |  ${dateRange.start} to ${dateRange.end}`, margin, page === 1 ? 24 : 17)
    pdf.setTextColor(...colors.ink)
  }

  pageTitle(1)
  const metrics = [
    ['Total tires', data.totalTires],
    ['Vehicles', data.totalVehicles],
    ['Truck tires', data.vehicleTypeStats.trucks],
    ['Trailer tires', data.vehicleTypeStats.trailers],
  ] as const
  const gap = 3
  const cardWidth = (right - margin - gap * 3) / 4
  metrics.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + gap)
    pdf.setDrawColor(...colors.line)
    pdf.setFillColor(247, 250, 248)
    pdf.roundedRect(x, 40, cardWidth, 19, 2, 2, 'FD')
    pdf.setTextColor(...colors.muted)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.text(label.toUpperCase(), x + 3, 47)
    pdf.setTextColor(...colors.ink)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(12)
    pdf.text(Number(value || 0).toLocaleString(), x + 3, 55)
  })

  const summaryBlock = (title: string, rows: Array<{ name: string; count: number; percentage: number }>, x: number) => {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...colors.green)
    pdf.text(title, x, 69)
    pdf.setDrawColor(...colors.line)
    pdf.line(x, 72, x + 90, 72)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...colors.ink)
    rows.slice(0, 5).forEach((row, index) => {
      const y = 78 + index * 6
      pdf.text(String(row.name || 'Unspecified').slice(0, 28), x, y)
      pdf.text(`${Number(row.count || 0).toLocaleString()} (${row.percentage}%)`, x + 89, y, { align: 'right' })
    })
  }
  summaryBlock('TOP MANUFACTURERS', data.manufacturerStats, margin)
  summaryBlock('TIRE ORIGINS', data.originStats, margin + 100)

  const columns = [
    { label: 'Size', x: 8, width: 18 },
    { label: 'Truck No.', x: 26, width: 24 },
    { label: 'Trailer No.', x: 50, width: 24 },
    { label: 'Manufacturer', x: 74, width: 22 },
    { label: 'Origin', x: 96, width: 18 },
    { label: 'Driver', x: 114, width: 22 },
    { label: 'Qty', x: 136, width: 9 },
    { label: 'Serial number', x: 145, width: 43 },
    { label: 'Date', x: 188, width: 14 },
  ]
  const drawTableHeader = (y: number) => {
    pdf.setFillColor(235, 242, 237)
    pdf.rect(margin, y - 4, right - margin, 7, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.2)
    pdf.setTextColor(...colors.ink)
    columns.forEach(column => pdf.text(column.label, column.x + 1, y))
    pdf.setDrawColor(...colors.line)
    pdf.line(margin, y + 3, right, y + 3)
    return y + 7
  }

  let y = drawTableHeader(106)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6)
  const tires = [...(data.tireRows || [])].sort((a, b) =>
    String(a.tireSize || '').localeCompare(String(b.tireSize || ''), undefined, { numeric: true }) ||
    String(a.plateNumber || '').localeCompare(String(b.plateNumber || ''), undefined, { numeric: true }) ||
    String(a.trailerNumber || '').localeCompare(String(b.trailerNumber || ''), undefined, { numeric: true })
  )
  tires.forEach((tire, index) => {
    const values = [
      tire.tireSize || '—',
      tire.plateNumber || '—',
      tire.trailerNumber || '—',
      tire.manufacturer || '—',
      tire.origin || '—',
      tire.driverName || '—',
      String(tire.quantity ?? 0),
      String(tire.serialNumber || '—'),
      tire.createdAt ? format(new Date(tire.createdAt), 'dd/MM/yy') : '—',
    ]
    const cellLines = values.map((value, i) => pdf.splitTextToSize(String(value), columns[i].width - 2).slice(0, 4) as string[])
    const rowHeight = Math.max(6, ...cellLines.map(lines => lines.length * 2.8 + 2))
    if (y + rowHeight > 285) {
      pdf.addPage('a4', 'portrait')
      pageTitle(pdf.getNumberOfPages())
      y = drawTableHeader(28)
    }
    if (index % 2 === 1) {
      pdf.setFillColor(249, 251, 249)
      pdf.rect(margin, y - 3.5, right - margin, rowHeight, 'F')
    }
    pdf.setTextColor(...colors.ink)
    cellLines.forEach((lines, i) => pdf.text(lines, columns[i].x + 1, y + 0.5, { lineHeightFactor: 1.05 }))
    pdf.setDrawColor(...colors.line)
    pdf.line(margin, y + rowHeight - 1, right, y + rowHeight - 1)
    y += rowHeight
  })

  const totalPages = pdf.getNumberOfPages()
  for (let page = 1; page <= totalPages; page++) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(...colors.muted)
    pdf.text(`${tires.length.toLocaleString()} tire records`, margin, 292)
    pdf.text(`Page ${page} of ${totalPages}`, right, 292, { align: 'right' })
  }
  pdf.setProperties({ title: 'Tire Management Report', subject: `Fleet tire report from ${dateRange.start} to ${dateRange.end}` })
  return pdf.output('blob')
}

export default function TireReportsSimple() {
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null)
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false)
  const [pdfPreviewError, setPdfPreviewError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState({
    start: format(new Date(2024, 0, 1), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd')
  })
  const [pdfFilters, setPdfFilters] = useState({ size: 'all', truck: 'all', trailer: 'all' })

  useEffect(() => () => { if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl) }, [pdfPreviewUrl])

  useEffect(() => {
    generateReport()
  }, [])

  const generateReport = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await apiGet(`/api/tires?limit=1000&startDate=${dateRange.start}&endDate=${dateRange.end}`)
      
      if (response.ok) {
        const data = await response.json()
        // Keep unclassified source rows in inventory; analytics counts only
        // positive OUT QTY with one of the recognized origins.
        const tires = (data.tires || []).filter(isTireIncludedInAnalytics)
        const quantityOf = (tire: any) => Number(tire.quantity ?? 0)

        // Calculate statistics
        const totalTires = tires.reduce((sum: number, tire: any) => sum + quantityOf(tire), 0)
        const uniqueVehicles = new Set([
          ...tires.map((t: any) => t.plateNumber).filter(Boolean),
          ...tires.map((t: any) => t.trailerNumber).filter(Boolean)
        ]).size
        const uniqueDrivers = new Set(tires.map((t: any) => t.driverName).filter(Boolean)).size

        // Manufacturer stats
        const manufacturerCounts = tires.reduce((acc: any, tire: any) => {
          acc[tire.manufacturer] = (acc[tire.manufacturer] || 0) + quantityOf(tire)
          return acc
        }, {})
        const manufacturerStats = Object.entries(manufacturerCounts)
          .map(([name, count]: [string, any]) => ({
            name,
            count,
            percentage: Math.round((count / totalTires) * 100)
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        // Origin stats
        const originCounts = tires.reduce((acc: any, tire: any) => {
          acc[tire.origin] = (acc[tire.origin] || 0) + quantityOf(tire)
          return acc
        }, {})
        const originStats = Object.entries(originCounts)
          .map(([name, count]: [string, any]) => ({
            name,
            count,
            percentage: Math.round((count / totalTires) * 100)
          }))
          .sort((a, b) => b.count - a.count)

        // Vehicle type stats
        const truckTires = tires.filter((t: any) => t.plateNumber && !t.trailerNumber)
          .reduce((sum: number, t: any) => sum + quantityOf(t), 0)
        const trailerTires = tires.filter((t: any) => t.trailerNumber)
          .reduce((sum: number, t: any) => sum + quantityOf(t), 0)

        setReportData({
          totalTires,
          totalVehicles: uniqueVehicles,
          totalDrivers: uniqueDrivers,
          manufacturerStats,
          originStats,
          vehicleTypeStats: { trucks: truckTires, trailers: trailerTires },
          recentTires: tires.slice(0, 10),
          tireRows: tires
        })
        setPdfFilters({ size: 'all', truck: 'all', trailer: 'all' })
      } else {
        setError('Failed to generate report')
      }
    } catch (error) {
      setError('Error generating report')
    } finally {
      setLoading(false)
    }
  }

  const downloadCSV = () => {
    if (!reportData) return

    const csvContent = rowsToCsv([
      ['TIRE FLEET SUMMARY REPORT'],
      ['Generated', format(new Date(), 'yyyy-MM-dd HH:mm')],
      ['Date Range', `${dateRange.start} to ${dateRange.end}`],
      [],
      ['OVERVIEW'],
      ['Metric', 'Value'],
      ['Total Tires', reportData.totalTires],
      ['Total Vehicles', reportData.totalVehicles],
      ['Total Drivers', reportData.totalDrivers],
      ['Truck Tires', reportData.vehicleTypeStats.trucks],
      ['Trailer Tires', reportData.vehicleTypeStats.trailers],
      [],
      ['TOP MANUFACTURERS'],
      ['Manufacturer', 'Count', 'Percentage'],
      ...reportData.manufacturerStats.map(item => [item.name, item.count, `${item.percentage}%`]),
      [],
      ['ORIGIN BREAKDOWN'],
      ['Origin', 'Count', 'Percentage'],
      ...reportData.originStats.map(item => [item.name, item.count, `${item.percentage}%`]),
    ])

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tire-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const getPdfReportData = () => {
    if (!reportData) return null
    const tires = reportData.tireRows.filter(tire =>
      (pdfFilters.size === 'all' || tire.tireSize === pdfFilters.size) &&
      (pdfFilters.truck === 'all' || tire.plateNumber === pdfFilters.truck) &&
      (pdfFilters.trailer === 'all' || tire.trailerNumber === pdfFilters.trailer)
    )
    const quantity = (tire: any) => Number(tire.quantity ?? 0)
    const totalTires = tires.reduce((sum, tire) => sum + quantity(tire), 0)
    const statsFor = (field: 'manufacturer' | 'origin') => {
      const counts = tires.reduce<Record<string, number>>((result, tire) => {
        const key = String(tire[field] || 'Unspecified')
        result[key] = (result[key] || 0) + quantity(tire)
        return result
      }, {})
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count, percentage: totalTires ? Math.round((count / totalTires) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
    }
    return {
      ...reportData,
      totalTires,
      totalVehicles: new Set(tires.flatMap(tire => [tire.plateNumber, tire.trailerNumber]).filter(Boolean)).size,
      totalDrivers: new Set(tires.map(tire => tire.driverName).filter(Boolean)).size,
      manufacturerStats: statsFor('manufacturer'),
      originStats: statsFor('origin'),
      vehicleTypeStats: {
        trucks: tires.filter(tire => tire.plateNumber && !tire.trailerNumber).reduce((sum, tire) => sum + quantity(tire), 0),
        trailers: tires.filter(tire => tire.trailerNumber).reduce((sum, tire) => sum + quantity(tire), 0),
      },
      tireRows: tires,
    }
  }

  const openPdf = async (download = false) => {
    if (!reportData) return
    const pdfData = getPdfReportData()
    if (!pdfData?.tireRows.length) {
      setError('No tire records match the selected PDF filters')
      return
    }
    setError(null)
    setPdfPreviewError(null)
    if (!download) {
      setPdfPreviewLoading(true)
      setPdfPreviewOpen(true)
    }
    try {
      const blob = await createTireReportPdf(pdfData, dateRange)
      const url = URL.createObjectURL(blob)
      if (download) {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `tire-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        window.setTimeout(() => URL.revokeObjectURL(url), 60000)
      } else {
        setPdfPreviewUrl(url)
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to prepare the tire report PDF'
      if (download) setError(message)
      else setPdfPreviewError(message)
    } finally {
      if (!download) setPdfPreviewLoading(false)
    }
  }

  const pdfTireRows = (reportData?.tireRows || []).filter(tire =>
    (pdfFilters.size === 'all' || tire.tireSize === pdfFilters.size) &&
    (pdfFilters.truck === 'all' || tire.plateNumber === pdfFilters.truck) &&
    (pdfFilters.trailer === 'all' || tire.trailerNumber === pdfFilters.trailer)
  )
  const uniqueValues = (field: 'tireSize' | 'plateNumber' | 'trailerNumber') => Array.from(new Set(
    (reportData?.tireRows || []).map(tire => String(tire[field] || '').trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold"><LocalizedText>Tire Analytics & Reports</LocalizedText></h2>
          <p className="text-muted-foreground"><LocalizedText>Fleet tire statistics and insights</LocalizedText></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateReport} disabled={loading}>
            <BarChart3 className="mr-2 h-4 w-4" />
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
          {reportData && (
            <>
              <Button variant="outline" onClick={() => void openPdf()} disabled={!pdfTireRows.length || pdfPreviewLoading}>
                <Eye className="mr-2 h-4 w-4" />
                <LocalizedText>View PDF</LocalizedText>
              </Button>
              <Button variant="outline" onClick={() => void openPdf(true)} disabled={!pdfTireRows.length}>
                <FileText className="mr-2 h-4 w-4" />
                <LocalizedText>Download PDF</LocalizedText>
              </Button>
              <Button onClick={downloadCSV}>
                <Download className="mr-2 h-4 w-4" />
                <LocalizedText>Export CSV</LocalizedText>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Date Range */}
      <Card>
        <CardHeader>
          <CardTitle><LocalizedText>Report Period</LocalizedText></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label><LocalizedText>Start Date</LocalizedText></Label>
              <Input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
            </div>
            <div>
              <Label><LocalizedText>End Date</LocalizedText></Label>
              <Input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-5 space-y-3 border-t pt-4">
            <div>
              <p className="font-medium"><LocalizedText>PDF report filters</LocalizedText></p>
              <p className="text-sm text-muted-foreground"><LocalizedText>Filter the PDF by tire size, truck number, or trailer number.</LocalizedText></p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label><LocalizedText>Tire Size</LocalizedText></Label>
                <Select value={pdfFilters.size} onValueChange={size => setPdfFilters(current => ({ ...current, size }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><LocalizedText>All sizes</LocalizedText></SelectItem>
                    {uniqueValues('tireSize').map(size => <SelectItem key={size} value={size}>{size}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label><LocalizedText>Truck Number</LocalizedText></Label>
                <Select value={pdfFilters.truck} onValueChange={truck => setPdfFilters(current => ({ ...current, truck }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><LocalizedText>All trucks</LocalizedText></SelectItem>
                    {uniqueValues('plateNumber').map(truck => <SelectItem key={truck} value={truck}>{truck}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label><LocalizedText>Trailer Number</LocalizedText></Label>
                <Select value={pdfFilters.trailer} onValueChange={trailer => setPdfFilters(current => ({ ...current, trailer }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all"><LocalizedText>All trailers</LocalizedText></SelectItem>
                    {uniqueValues('trailerNumber').map(trailer => <SelectItem key={trailer} value={trailer}>{trailer}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground"><LocalizedText>{pdfTireRows.length} tire records will be included in the PDF. Overview cards continue to show all records in the selected date range.</LocalizedText></p>
          </div>
          <Button onClick={generateReport} className="mt-4" disabled={loading}>
            <LocalizedText>Update Report</LocalizedText>
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {reportData && (
        <>
          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Package className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground"><LocalizedText>Total Tires</LocalizedText></p>
                    <p className="text-2xl font-bold">{reportData.totalTires}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Truck className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground"><LocalizedText>Vehicles</LocalizedText></p>
                    <p className="text-2xl font-bold">{reportData.totalVehicles}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-orange-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground"><LocalizedText>Truck Tires</LocalizedText></p>
                    <p className="text-2xl font-bold">{reportData.vehicleTypeStats.trucks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <PieChart className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-muted-foreground"><LocalizedText>Trailer Tires</LocalizedText></p>
                    <p className="text-2xl font-bold">{reportData.vehicleTypeStats.trailers}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Manufacturers */}
            <Card>
              <CardHeader>
                <CardTitle><LocalizedText>Top Tire Manufacturers</LocalizedText></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.manufacturerStats.map((manufacturer, index) => (
                    <div key={manufacturer.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="font-medium">{manufacturer.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{manufacturer.count} tires</span>
                        <Badge>{manufacturer.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Origin Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle><LocalizedText>Tire Origins</LocalizedText></CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {reportData.originStats.map((origin, index) => (
                    <div key={origin.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="font-medium">{origin.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{origin.count} tires</span>
                        <Badge>{origin.percentage}%</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Vehicle Type Distribution */}
          <Card>
            <CardHeader>
              <CardTitle><LocalizedText>Fleet Distribution</LocalizedText></CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <Truck className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold"><LocalizedText>Truck Tires</LocalizedText></h3>
                  <p className="text-3xl font-bold text-blue-600">{reportData.vehicleTypeStats.trucks}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((reportData.vehicleTypeStats.trucks / reportData.totalTires) * 100)}% of fleet
                  </p>
                </div>
                <div className="text-center p-6 bg-orange-50 rounded-lg">
                  <Package className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold"><LocalizedText>Trailer Tires</LocalizedText></h3>
                  <p className="text-3xl font-bold text-orange-600">{reportData.vehicleTypeStats.trailers}</p>
                  <p className="text-sm text-muted-foreground">
                    {Math.round((reportData.vehicleTypeStats.trailers / reportData.totalTires) * 100)}% of fleet
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
      <PdfPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        title="Tire Management Report"
        url={pdfPreviewUrl}
        loading={pdfPreviewLoading}
        error={pdfPreviewError}
        downloadName={`tire-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`}
      />
    </div>
  )
}
