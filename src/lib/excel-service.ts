import * as XLSX from 'xlsx'

export interface TireExcelData {
  id?: string
  tireSize: string
  manufacturer: string
  origin: string
  plateNumber?: string
  trailerNumber?: string
  driverName?: string
  quantity: number
  serialNumber?: string
  notes?: string
  createdAt: string
}

export class ExcelService {
  static async exportTiresToExcel(tires: TireExcelData[]): Promise<Buffer> {
    const worksheet = XLSX.utils.json_to_sheet(tires.map(tire => ({
      'Tire Size': tire.tireSize,
      'Manufacturer': tire.manufacturer,
      'Origin': tire.origin,
      'Plate Number': tire.plateNumber || '',
      'Trailer Number': tire.trailerNumber || '',
      'Driver Name': tire.driverName || '',
      'Quantity': tire.quantity,
      'Serial Number': tire.serialNumber || '',
      'Notes': tire.notes || '',
      'Created At': new Date(tire.createdAt).toLocaleString()
    })))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tires')

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  }

  static async importTiresFromExcel(buffer: Buffer): Promise<TireExcelData[]> {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet)

    return data.map((row: any) => ({
      tireSize: row['Tire Size'] || '',
      manufacturer: row['Manufacturer'] || '',
      origin: row['Origin'] || 'SAUDI',
      plateNumber: row['Plate Number'] || null,
      trailerNumber: row['Trailer Number'] || null,
      driverName: row['Driver Name'] || null,
      quantity: parseInt(row['Quantity']) || 1,
      serialNumber: row['Serial Number'] || null,
      notes: row['Notes'] || null,
      createdAt: new Date().toISOString()
    }))
  }

  static async appendTireToExcel(filePath: string, tire: TireExcelData): Promise<void> {
    let workbook: XLSX.WorkBook
    let worksheet: XLSX.WorkSheet

    try {
      // Try to read existing file
      const existingBuffer = await import('fs').then(fs => fs.promises.readFile(filePath))
      workbook = XLSX.read(existingBuffer, { type: 'buffer' })
      worksheet = workbook.Sheets['Tires']
    } catch {
      // Create new workbook if file doesn't exist
      workbook = XLSX.utils.book_new()
      worksheet = XLSX.utils.json_to_sheet([])
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tires')
    }

    // Convert tire data to row format
    const newRow = {
      'Tire Size': tire.tireSize,
      'Manufacturer': tire.manufacturer,
      'Origin': tire.origin,
      'Plate Number': tire.plateNumber || '',
      'Trailer Number': tire.trailerNumber || '',
      'Driver Name': tire.driverName || '',
      'Quantity': tire.quantity,
      'Serial Number': tire.serialNumber || '',
      'Notes': tire.notes || '',
      'Created At': new Date(tire.createdAt).toLocaleString()
    }

    // Append new row
    XLSX.utils.sheet_add_json(worksheet, [newRow], { skipHeader: true, origin: -1 })

    // Write back to file
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    await import('fs').then(fs => fs.promises.writeFile(filePath, buffer))
  }
}