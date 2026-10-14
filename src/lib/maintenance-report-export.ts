import { formatCurrency } from '@/lib/currency'

export interface MaintenanceReportRow {
  datePerformed: string
  serviceType: string
  description?: string | null
  partsCost: number
  laborCost: number
  totalCost: number
  status: string
  currentMileage?: number
  driverName?: string
  mechanicName?: string
  truck?: {
    make: string
    model: string
    year: number
    licensePlate: string
    driverName?: string
  }
  trailer?: { number: string; driverName?: string | null }
  mechanic?: { name: string }
  createdBy?: { name: string; email: string }
}

const vehicleName = (record: MaintenanceReportRow) => {
  if (record.truck) return `${record.truck.licensePlate} · ${record.truck.year} ${record.truck.make} ${record.truck.model}`
  if (record.trailer) return `Trailer ${record.trailer.number}`
  return '—'
}

export async function createMaintenancePdf(
  records: MaintenanceReportRow[],
  period: string
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const total = records.reduce((sum, row) => sum + Number(row.totalCost || 0), 0)
  const parts = records.reduce((sum, row) => sum + Number(row.partsCost || 0), 0)
  const labor = records.reduce((sum, row) => sum + Number(row.laborCost || 0), 0)
  const columns = [
    { title: 'DATE', width: 21 },
    { title: 'VEHICLE', width: 43 },
    { title: 'SERVICE', width: 31 },
    { title: 'DRIVER', width: 27 },
    { title: 'MECHANIC', width: 28 },
    { title: 'PARTS', width: 25 },
    { title: 'LABOR', width: 25 },
    { title: 'TOTAL', width: 27 },
    { title: 'STATUS', width: 28 },
  ]
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0)

  const drawPageHeader = () => {
    pdf.setFillColor(15, 34, 59)
    pdf.rect(0, 0, pageWidth, 31, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(17)
    pdf.text('FLEET MAINTENANCE REPORT', margin, 13)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.text(`Period: ${period}`, margin, 21)
    pdf.text(`Generated ${new Date().toLocaleString('en-GB')}`, pageWidth - margin, 13, { align: 'right' })
    pdf.text(`${records.length} maintenance records`, pageWidth - margin, 21, { align: 'right' })

    const cards = [
      ['RECORDS', String(records.length)],
      ['TOTAL COST', formatCurrency(total)],
      ['PARTS', formatCurrency(parts)],
      ['LABOR', formatCurrency(labor)],
    ]
    const gap = 4
    const cardWidth = (tableWidth - gap * 3) / 4
    cards.forEach(([label, value], index) => {
      const x = margin + index * (cardWidth + gap)
      pdf.setFillColor(245, 248, 252)
      pdf.setDrawColor(226, 232, 240)
      pdf.roundedRect(x, 36, cardWidth, 17, 2, 2, 'FD')
      pdf.setTextColor(100, 116, 139)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(6.5)
      pdf.text(label, x + 3, 42)
      pdf.setTextColor(15, 34, 59)
      pdf.setFontSize(9)
      pdf.text(value, x + 3, 49)
    })

    let x = margin
    const y = 60
    pdf.setFillColor(29, 78, 137)
    pdf.rect(margin, y, tableWidth, 8, 'F')
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(6.5)
    pdf.setTextColor(255, 255, 255)
    columns.forEach((column, index) => {
      pdf.text(column.title, x + 2, y + 5.3)
      x += column.width
    })
    pdf.setTextColor(30, 41, 59)
    return y + 8
  }

  let y = drawPageHeader()
  if (records.length === 0) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(100, 116, 139)
    pdf.text('No maintenance records match the selected filters.', margin, y + 12)
  }

  records.forEach((record, index) => {
    const values = [
      new Date(record.datePerformed).toLocaleDateString('en-GB'),
      vehicleName(record),
      record.serviceType || '—',
      record.driverName || record.truck?.driverName || record.trailer?.driverName || '—',
      record.mechanic?.name || record.mechanicName || '—',
      formatCurrency(record.partsCost || 0),
      formatCurrency(record.laborCost || 0),
      formatCurrency(record.totalCost || 0),
      (record.status || '—').replace(/_/g, ' '),
    ]
    const wrapped = values.map((value, columnIndex) =>
      pdf.splitTextToSize(String(value), columns[columnIndex].width - 4) as string[]
    )
    const rowHeight = Math.max(8, ...wrapped.map(lines => lines.length * 3.2 + 3))
    if (y + rowHeight > pageHeight - 15) {
      pdf.addPage()
      y = drawPageHeader()
    }

    if (index % 2 === 1) {
      pdf.setFillColor(248, 250, 252)
      pdf.rect(margin, y, tableWidth, rowHeight, 'F')
    }
    pdf.setDrawColor(226, 232, 240)
    pdf.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(6.3)
    pdf.setTextColor(51, 65, 85)
    let x = margin
    wrapped.forEach((lines, columnIndex) => {
      pdf.text(lines.slice(0, 3), x + 2, y + 4.6)
      x += columns[columnIndex].width
    })
    y += rowHeight
  })

  for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
    pdf.setPage(page)
    pdf.setDrawColor(226, 232, 240)
    pdf.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7)
    pdf.setTextColor(100, 116, 139)
    pdf.text('Fleet Manager · Maintenance', margin, pageHeight - 5)
    pdf.text(`Page ${page} of ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 5, { align: 'right' })
  }

  return pdf.output('blob')
}

export async function createMaintenanceWorkbook(records: MaintenanceReportRow[]): Promise<Blob> {
  const ExcelJS = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Fleet Manager'
  workbook.created = new Date()

  const total = records.reduce((sum, row) => sum + Number(row.totalCost || 0), 0)
  const summary = workbook.addWorksheet('Summary')
  summary.columns = [{ width: 30 }, { width: 24 }]
  summary.mergeCells('A1:B1')
  summary.getCell('A1').value = 'FLEET MAINTENANCE REPORT'
  summary.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  summary.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F223B' } }
  summary.getRow(1).height = 30
  summary.addRow(['Generated', new Date()])
  summary.addRow(['Records', records.length])
  summary.addRow(['Total parts cost', records.reduce((sum, row) => sum + Number(row.partsCost || 0), 0)])
  summary.addRow(['Total labor cost', records.reduce((sum, row) => sum + Number(row.laborCost || 0), 0)])
  summary.addRow(['Total maintenance cost', total])
  summary.getCell('B2').numFmt = 'dd mmm yyyy hh:mm'
  summary.getCell('B3').numFmt = '#,##0'
  for (const row of [4, 5, 6]) summary.getCell(`B${row}`).numFmt = '"SAR "#,##0.00;[Red]-"SAR "#,##0.00'
  summary.getRow(6).font = { bold: true }
  summary.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1F8' } }

  const details = workbook.addWorksheet('Maintenance Details')
  details.columns = [
    { header: 'Date', key: 'date', width: 16 },
    { header: 'Vehicle', key: 'vehicle', width: 38 },
    { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Service', key: 'service', width: 24 },
    { header: 'Description', key: 'description', width: 40 },
    { header: 'Mechanic', key: 'mechanic', width: 22 },
    { header: 'Parts Cost', key: 'parts', width: 16 },
    { header: 'Labor Cost', key: 'labor', width: 16 },
    { header: 'Total Cost', key: 'total', width: 16 },
    { header: 'Status', key: 'status', width: 18 },
  ]
  records.forEach(record => details.addRow({
    date: new Date(record.datePerformed),
    vehicle: vehicleName(record),
    driver: record.driverName || record.truck?.driverName || record.trailer?.driverName || '',
    service: record.serviceType,
    description: record.description || '',
    mechanic: record.mechanic?.name || record.mechanicName || '',
    parts: Number(record.partsCost || 0),
    labor: Number(record.laborCost || 0),
    total: Number(record.totalCost || 0),
    status: record.status,
  }))
  const header = details.getRow(1)
  header.height = 24
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4E89' } }
  details.views = [{ state: 'frozen', ySplit: 1 }]
  details.autoFilter = { from: 'A1', to: `J${Math.max(1, details.rowCount)}` }
  details.getColumn('date').numFmt = 'dd mmm yyyy'
  for (const key of ['parts', 'labor', 'total']) details.getColumn(key).numFmt = '#,##0.00;[Red]-#,##0.00'
  details.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F8FC' } }
      })
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
