import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { ensureTireLifecycleTables, recordTireLifecycleEvent } from '@/lib/tire-lifecycle'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'

export const runtime = 'nodejs'
type ImportRow = { date: Date; vehicleType: 'truck' | 'trailer'; vehicleNumber: string; driver: string; serial: string; qty: number; line: number }
const cellText = (value: ExcelJS.CellValue): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (value && typeof value === 'object' && 'text' in value) return String(value.text || '').trim()
  return String(value ?? '').trim()
}
function parseDate(value: ExcelJS.CellValue): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number' && value > 0 && value < 100000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
    return Number.isNaN(date.getTime()) ? null : date
  }
  const raw = cellText(value)
  if (!raw) return null
  let date: Date
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const parts = raw.includes('/') ? raw.split('/') : raw.split(/[. -]/)
  if (iso) date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
  else if (parts.length === 3 && parts[2].length === 4) date = new Date(Date.UTC(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])))
  else date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}
const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'tire-management', 'read')
    const trucks = await db.truck.findMany({
      where: { isDeleted: false, status: { not: 'INACTIVE' } },
      select: { licensePlate: true, driverName: true, make: true, model: true, year: true },
      orderBy: { licensePlate: 'asc' }
    })
    const trailers = await db.trailer.findMany({
      where: { isDeleted: false, status: { not: 'INACTIVE' } },
      select: { number: true, driverName: true },
      orderBy: { number: 'asc' }
    })
    return NextResponse.json({ trucks, trailers })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load active trucks.'
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'tire-management', 'create')
    const form = await request.formData()
    const file = form.get('file')
    const tireSize = String(form.get('tireSize') || '').trim()
    const origin = String(form.get('origin') || '').trim().toUpperCase()
    if (!(file instanceof File)) return NextResponse.json({ error: 'Select an Excel or CSV file.' }, { status: 400 })
    if (!tireSize) return NextResponse.json({ error: 'Tire size is required.' }, { status: 400 })
    if (!['CHINESE', 'SAUDI', 'JAPANESE'].includes(origin)) return NextResponse.json({ error: 'Select a valid tire origin.' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File must be 10 MB or smaller.' }, { status: 400 })
    const bytes = Buffer.from(await file.arrayBuffer())
    const workbook = new ExcelJS.Workbook()
    if (file.name.toLowerCase().endsWith('.csv')) {
      await workbook.csv.read(Readable.from([bytes]))
    } else if (/\.xlsx?$/i.test(file.name)) {
      await workbook.xlsx.load(bytes as any)
    } else {
      return NextResponse.json({ error: 'Use an .xlsx or .csv file.' }, { status: 400 })
    }
    const sheet = workbook.worksheets[0]
    if (!sheet || sheet.rowCount < 2) return NextResponse.json({ error: 'The sheet is empty.' }, { status: 400 })

    // Accept a merged title row such as "CHINA" above the actual column headings.
    let headerRow = 0
    let columns = new Map<string, number>()
    const hasAny = (candidate: Map<string, number>, names: string[]) => names.some(name => candidate.has(name))
    for (let rowNo = 1; rowNo <= Math.min(sheet.rowCount, 6); rowNo++) {
      const candidate = new Map<string, number>()
      sheet.getRow(rowNo).eachCell((cell, col) => candidate.set(normalizeHeader(cellText(cell.value)), col))
      const hasVehicle = hasAny(candidate, ['truck', 'trucknumber', 'truckno', 'trailer', 'trailernumber', 'trailerno', 'vehiclenumber', 'vehicle'])
      const hasRequired = ['date', 'namedriver', 'serialnumber', 'outqty'].every(key =>
        [...candidate.keys()].some(header => key === 'namedriver' ? ['namedriver', 'drivername', 'driver'].includes(header) : key === 'serialnumber' ? ['serialnumber', 'serial'].includes(header) : key === 'outqty' ? ['outqty', 'qty', 'quantity'].includes(header) : header === key)
      ) && hasVehicle
      if (hasRequired) { headerRow = rowNo; columns = candidate; break }
    }
    if (!headerRow) return NextResponse.json({ error: 'Required columns: Date, Vehicle Type (optional for legacy sheets), Truck # or Trailer # (or Vehicle #), Name Driver, Serial Number, OUT QTY. A title row above the headers is allowed.' }, { status: 400 })
    const find = (...names: string[]) => names.map(name => columns.get(name)).find(Boolean)
    const dateCol = find('date'), typeCol = find('vehicletype', 'type')
    const truckCol = find('truck', 'trucknumber', 'truckno')
    const trailerCol = find('trailer', 'trailernumber', 'trailerno')
    const vehicleCol = find('vehiclenumber', 'vehicle')
    const driverCol = find('namedriver', 'drivername', 'driver'), serialCol = find('serialnumber', 'serial')
    const qtyCol = find('outqty', 'qty', 'quantity')
    if (!dateCol || (!truckCol && !trailerCol && !vehicleCol) || !driverCol || !serialCol || !qtyCol)
      return NextResponse.json({ error: 'Spreadsheet columns are incomplete.' }, { status: 400 })

    const rows: ImportRow[] = []
    const errors: string[] = []
    for (let line = headerRow + 1; line <= sheet.rowCount; line++) {
      const row = sheet.getRow(line)
      const dateValue = row.getCell(dateCol).value
      const truck = truckCol ? cellText(row.getCell(truckCol).value) : ''
      const trailer = trailerCol ? cellText(row.getCell(trailerCol).value) : ''
      const genericVehicle = vehicleCol ? cellText(row.getCell(vehicleCol).value) : ''
      const typeText = typeCol ? cellText(row.getCell(typeCol).value).toLowerCase() : ''
      const driver = cellText(row.getCell(driverCol).value)
      const serial = cellText(row.getCell(serialCol).value)
      const qtyText = cellText(row.getCell(qtyCol).value)
      if (![dateValue, truck, trailer, genericVehicle, typeText, driver, serial, qtyText].some(value => value !== null && value !== undefined && String(value).trim() !== '')) continue
      let vehicleType: 'truck' | 'trailer' | null = null
      let vehicleNumber = ''
      if (truck && trailer) errors.push('Row ' + line + ': fill either Truck # or Trailer #, not both')
      else if (truck) vehicleType = 'truck', vehicleNumber = truck
      else if (trailer) vehicleType = 'trailer', vehicleNumber = trailer
      else if (genericVehicle) {
        vehicleNumber = genericVehicle
        if (['truck', 'trucks'].includes(typeText)) vehicleType = 'truck'
        else if (['trailer', 'trailers'].includes(typeText)) vehicleType = 'trailer'
      }
      if (!vehicleType && !genericVehicle && !truck && !trailer) errors.push('Row ' + line + ': enter a Truck # or Trailer #')
      if (genericVehicle && !vehicleType) errors.push('Row ' + line + ': Vehicle Type must be Truck or Trailer')
      if (!dateValue) errors.push('Row ' + line + ': date is required')
      const date = parseDate(dateValue)
      const qty = Number(qtyText)
      if (dateValue && !date) errors.push('Row ' + line + ': invalid date')
      if (!driver) errors.push('Row ' + line + ': Name Driver is required')
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) errors.push('Row ' + line + ': OUT QTY must be a whole number from 1 to 100')
      if (date && vehicleType && vehicleNumber && driver && Number.isInteger(qty) && qty >= 1 && qty <= 100)
        rows.push({ date, vehicleType, vehicleNumber, driver, serial, qty, line })
    }
    if (errors.length) return NextResponse.json({ error: errors.slice(0, 25).join('; '), totalErrors: errors.length }, { status: 400 })
    if (!rows.length) return NextResponse.json({ error: 'No data rows found.' }, { status: 400 })

    const serials = rows.filter(row => row.qty === 1 && row.serial).map(row => row.serial)
    if (new Set(serials.map(value => value.trim().toLowerCase())).size !== serials.length) return NextResponse.json({ error: 'The sheet contains duplicate serial numbers. Correct them before uploading.' }, { status: 400 })
    if (serials.length) {
      const existingSerial = await db.tire.findFirst({
        where: {
          deletedAt: null,
          OR: serials.map(serial => ({ serialNumber: { equals: serial.trim(), mode: 'insensitive' } }))
        },
        select: { serialNumber: true }
      })
      if (existingSerial?.serialNumber) return NextResponse.json({ error: 'Serial number already exists in Tire Management: ' + existingSerial.serialNumber }, { status: 409 })
    }

    const importCodes = rows.flatMap(row => Array.from({ length: row.qty }, (_, index) => {
      const fingerprint = [row.date.toISOString().slice(0, 10), row.vehicleType, row.vehicleNumber, row.driver.toLowerCase(), row.serial, row.qty, row.line, tireSize, origin].join('|')
      return 'UP-' + createHash('sha256').update(fingerprint).digest('hex').slice(0, 16).toUpperCase() + '-' + String(index + 1).padStart(3, '0')
    }))
    const duplicateImport = await db.tire.findFirst({ where: { internalCode: { in: importCodes }, deletedAt: null }, select: { internalCode: true } })
    if (duplicateImport) return NextResponse.json({ error: 'This sheet appears to have already been uploaded. Duplicate import prevented.' }, { status: 409 })

    const truckNumbers = [...new Set(rows.filter(row => row.vehicleType === 'truck').map(row => row.vehicleNumber))]
    const trailerNumbers = [...new Set(rows.filter(row => row.vehicleType === 'trailer').map(row => row.vehicleNumber))]
    const [trucks, trailers] = await Promise.all([
      truckNumbers.length ? db.truck.findMany({ where: { isDeleted: false, status: { not: 'INACTIVE' }, OR: truckNumbers.flatMap(number => [{ licensePlate: number }, { licensePlate: { startsWith: number + ' ' } }]) }, select: { id: true, licensePlate: true } }) : Promise.resolve([]),
      trailerNumbers.length ? db.trailer.findMany({ where: { isDeleted: false, status: { not: 'INACTIVE' }, OR: trailerNumbers.flatMap(number => [{ number }, { number: { startsWith: number + ' ' } }]) }, select: { id: true, number: true } }) : Promise.resolve([])
    ])
    const resolveVehicle = (type: 'truck' | 'trailer', number: string) => {
      const matches = type === 'truck'
        ? trucks.filter(item => item.licensePlate === number || item.licensePlate.startsWith(number + ' '))
        : trailers.filter(item => item.number === number || item.number.startsWith(number + ' '))
      return matches.length === 1 ? matches[0] : null
    }
    const unresolved = [...new Set(rows.filter(row => !resolveVehicle(row.vehicleType, row.vehicleNumber)).map(row => (row.vehicleType === 'truck' ? 'Truck # ' : 'Trailer # ') + row.vehicleNumber))]
    if (unresolved.length) return NextResponse.json({ error: 'Vehicle number must match exactly one active fleet record: ' + unresolved.join(', '), unresolvedVehicles: unresolved }, { status: 400 })

    const result = await db.$transaction(async tx => {
      await ensureTireLifecycleTables(tx)
      let tireCount = 0
      const jobCards = new Set<string>()
      for (const row of rows) {
        const vehicle = resolveVehicle(row.vehicleType, row.vehicleNumber)!
        const fingerprint = [row.date.toISOString().slice(0, 10), row.vehicleType, row.vehicleNumber, row.driver.toLowerCase(), row.serial, row.qty, row.line, tireSize, origin].join('|')
        const codePrefix = 'UP-' + createHash('sha256').update(fingerprint).digest('hex').slice(0, 16).toUpperCase()
        if (row.vehicleType === 'truck') {
          const truck = vehicle as { id: string; licensePlate: string }
          await tx.vehicle.upsert({
            where: { plateNumber: truck.licensePlate },
            create: { plateNumber: truck.licensePlate, driverName: row.driver },
            update: { driverName: row.driver }
          })
        }
        for (let index = 0; index < row.qty; index++) {
          const tire = await tx.tire.create({
            data: {
              tireSize, manufacturer: 'Unspecified', origin,
              internalCode: codePrefix + '-' + String(index + 1).padStart(3, '0'),
              plateNumber: null, truckId: null, trailerNumber: null,
              driverName: row.driver, quantity: 1,
              serialNumber: row.qty === 1 ? (row.serial || null) : null,
              lifecycleStatus: 'STOCK',
              createdById: user.id, createdAt: row.date,
              notes: row.qty > 1 && row.serial
                ? 'Outgoing sheet serial reference for OUT QTY ' + row.qty + ': ' + row.serial + '; individual serial mapping is not provided.'
                : 'Imported from outgoing tire sheet; assigned to ' + row.vehicleType + ', wheel position not provided.'
            },
            select: { id: true }
          })
          const event = await recordTireLifecycleEvent(tx, {
            tireId: tire.id, eventType: 'ISSUE', eventAt: row.date,
            vehicle: { vehicleType: row.vehicleType, vehicleId: vehicle.id },
            driverName: row.driver, reason: 'Outgoing tire issue sheet import',
            notes: 'Source row ' + row.line + '; ' + (row.vehicleType === 'truck' ? 'Truck #: ' : 'Trailer #: ') + row.vehicleNumber + '; OUT QTY: ' + row.qty + (row.serial ? '; source serial: ' + row.serial : ''),
            userId: user.id, ensureTables: false
          })
          if (event.jobCardId) jobCards.add(event.jobCardId)
          tireCount++
        }
      }
      return { tireCount, jobCardCount: jobCards.size }
    }, { timeout: 120000 })
    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({
      message: 'Imported ' + rows.length + ' sheet rows for trucks and trailers, created ' + result.tireCount + ' tire records, and linked the issue activity to ' + result.jobCardCount + ' workshop job card(s).',
      rows: rows.length, tires: result.tireCount, jobCards: result.jobCardCount
    }, { status: 201 })
  } catch (error) {
    console.error('Bulk tire upload failed:', error)
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : message || 'Could not import tire sheet.' }, { status })
  }
}
