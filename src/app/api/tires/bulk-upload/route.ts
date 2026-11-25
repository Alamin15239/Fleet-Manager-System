import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { ensureTireLifecycleTables } from '@/lib/tire-lifecycle'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'

export const runtime = 'nodejs'

type VehicleType = 'truck' | 'trailer'

type SourceEntry = {
  sheetName: string
  line: number
  eventAt: Date | null
  vehicleType: VehicleType | null
  vehicleNumber: string
  vehicleId: string | null
  vehicleLabel: string
  driver: string
  serialText: string
  serials: string[]
  quantity: number
  tireSize: string
  manufacturer: string
  origin: string
  originText: string
  history: string
  odometerKm: number | null
  warnings: string[]
  errors: string[]
}
type ImportEntry = { source: SourceEntry; serial: string | null }
type ImportUnit = {
  key: string
  serial: string | null
  importCode: string
  entries: ImportEntry[]
  warnings: string[]
  errors: string[]
  tireSize: string
  manufacturer: string
  origin: string
  status: 'READY' | 'DUPLICATE' | 'BLOCKED'
  duplicateReason: string | null
}

const cellText = (value: ExcelJS.CellValue): string => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (value && typeof value === 'object') {
    if ('text' in value) return String(value.text || '').trim()
    if ('richText' in value && Array.isArray(value.richText)) return value.richText.map((part: any) => String(part.text || '')).join('').trim()
    if ('result' in value) return cellText(value.result as ExcelJS.CellValue)
  }
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
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const parts = raw.includes('/') ? raw.split('/') : raw.split(/[. -]/)
  const date = iso
    ? new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    : parts.length === 3 && parts[2].length === 4
      ? new Date(Date.UTC(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])))
      : new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

const normalizeHeader = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
const headerAliases: Record<string, string[]> = {
  date: ['date', 'issuedate', 'dateissued', 'dateofissue', 'issuedon', 'outdate', 'transactiondate', 'eventdate', 'installationdate', 'fitmentdate', 'mounteddate', 'startdate', 'usagedate'],
  vehicleType: ['vehicletype', 'assettype', 'type'],
  truck: ['truck', 'trucknumber', 'truckno', 'truckplate', 'truckplatenumber', 'truckregistration', 'truckregistrationnumber'],
  trailer: ['trailer', 'trailernumber', 'trailerno', 'trailerplate', 'trailerregistration'],
  vehicle: ['vehicle', 'vehiclenumber', 'vehicleid', 'registration', 'registrationnumber', 'registrationno', 'regno', 'unitnumber', 'fleetnumber', 'trucktrailer', 'plate', 'plateno', 'platenumber', 'licenseplate', 'licenseplatenumber'],
  driver: ['namedriver', 'drivername', 'driver', 'operator'],
  serial: ['serialnumber', 'serialnumbers', 'serialno', 'serialnos', 'serial', 'tireserial', 'tyreserial', 'tireserialnumber', 'tyreserialnumber', 'serialhistory', 'serialandhistory', 'serialnumberhistory', 'serialnousagehistory', 'serialnumberandhistory'],
  quantity: ['outqty', 'qtyout', 'quantityout', 'qty', 'quantity', 'numberoftires', 'tireqty', 'tyreqty', 'outquantity'],
  tireSize: ['tiresize', 'tyresize', 'size', 'tirespecification', 'tyrespecification'],
  manufacturer: ['manufacturer', 'brand', 'tirebrand', 'tyrebrand', 'make'],
  origin: ['origin', 'countryoforigin', 'manufacturingcountry', 'madein', 'country'],
  history: ['history', 'usagehistory', 'tirehistory', 'tyrehistory', 'usage', 'movementhistory', 'details', 'description', 'remarks', 'notes', 'comments'],
  odometer: ['odometer', 'odometerkm', 'mileage', 'kilometers', 'kilometres', 'km']
}

function parseSerials(rawValue: string, expectedQuantity: number): { serials: string[]; mixedText: boolean } {
  const raw = rawValue.trim()
  if (!raw) return { serials: [], mixedText: false }

  // Tire dimensions and dates can appear in the same cell as serials. Remove
  // those annotations first, but do not require the entire cell to be a serial.
  const cleaned = raw
    .replace(/\b\d{3}\s*[/-]\s*\d{2,3}(?:\s*[/-]\s*\d{2}(?:\.\d+)?)?(?:\s*R\s*\d{2})?\b/gi, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi, ' ')
    .replace(/\b\d{1,2}[\s-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s-]+\d{2,4}\b/gi, ' ')
    .replace(/\b(?:serial(?:\s*(?:no\.?|number))?|s\/n|sn)\b/gi, ' ')

  // In these workbooks comma, slash, pipe, spaces and hyphens commonly
  // separate serials. Extract identifier-like tokens from the whole cell so
  // notes such as "damage date", "end 69", or "given to truck 908" do not
  // cause valid serials elsewhere in the same cell to be discarded.
  const tokens = cleaned.match(/[A-Z0-9]+(?:[._][A-Z0-9]+)*/gi) || []
  const found: string[] = []
  for (const token of tokens) {
    let candidate = token.replace(/^[._]+|[._]+$/g, '')
    // Source notes frequently append "end" directly to the serial.
    candidate = candidate.replace(/end\d*$/i, '')
    if (candidate.length < 6 || (candidate.match(/\d/g) || []).length < 2) continue
    // Ignore compact calendar dates, not numeric tire serials.
    if (/^(?:19|20)\d{6}$/.test(candidate)) continue
    found.push(candidate)
  }

  const residue = cleaned.replace(/[A-Z0-9]+(?:[._][A-Z0-9]+)*/gi, ' ').replace(/[^a-z]/gi, ' ').trim()
  const mixedText = Boolean(residue)
  // Quantity is deliberately not used to discard candidates. It is checked
  // separately by the analyzer, which flags rows whose serial count conflicts
  // with OUT QTY while preserving the extracted source identifiers for review.
  void expectedQuantity
  return { serials: found, mixedText }
}

function normalizeOrigin(raw: string): string {
  const value = raw.trim().toLowerCase()
  if (!value) return 'OTHER'
  if (/china|chinese/.test(value)) return 'CHINESE'
  if (/saudi/.test(value)) return 'SAUDI'
  if (/japan|japanese/.test(value)) return 'JAPANESE'
  if (/europe|european/.test(value)) return 'EUROPEAN'
  if (/america|american|usa|united states/.test(value)) return 'AMERICAN'
  if (/other|unknown|not known/.test(value)) return 'OTHER'
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 40) || 'OTHER'
}


function headerMap(sheet: ExcelJS.Worksheet): { row: number; columns: Map<string, number> } | null {
  for (let rowNo = 1; rowNo <= Math.min(sheet.rowCount, 12); rowNo++) {
    const columns = new Map<string, number>()
    sheet.getRow(rowNo).eachCell((cell, col) => columns.set(normalizeHeader(cellText(cell.value)), col))
    const find = (key: string) => headerAliases[key].some(alias => columns.has(alias)) ||
      (key === 'serial' && Array.from(columns.keys()).some(name => name.includes('serial') || name === 'sn'))
    const hasVehicle = find('truck') || find('trailer') || find('vehicle')
    const hasEventIdentifier = find('serial') || find('quantity') || find('driver')
    if (find('date') && hasVehicle && hasEventIdentifier) return { row: rowNo, columns }
  }
  return null
}

function getColumn(columns: Map<string, number>, key: string): number | null {
  for (const alias of headerAliases[key] || []) {
    const value = columns.get(alias)
    if (value) return value
  }
  return null
}


function inferSheetMetadata(sheetName: string): {
  tireSize: string
  origin: string
  vehicleType: VehicleType | null
} {
  const name = sheetName.trim()
  const lower = name.toLowerCase()
  const origin = /china|chinese/.test(lower) ? 'CHINESE'
    : /japan|japanese/.test(lower) ? 'JAPANESE'
      : /saudi/.test(lower) ? 'SAUDI'
        : /europe/.test(lower) ? 'EUROPEAN'
          : /america|usa|united states/.test(lower) ? 'AMERICAN'
            : 'OTHER'
  const dimension = name.match(/(\d{3})\s*[-/]+\s*(\d{2,3})/)
  const tireSize = dimension ? dimension[1] + '-' + dimension[2] : ''
  const vehicleType: VehicleType | null = /385\s*[-/]+\s*65|trailer/i.test(name) ? 'trailer'
    : /315\s*[-/]+\s*80|truck/i.test(name) ? 'truck'
      : null
  return { tireSize, origin, vehicleType }
}



async function analyzeWorkbook(workbook: ExcelJS.Workbook) {
  const sourceEntries: SourceEntry[] = []
  const sheetNames: string[] = []
  const sheetErrors: string[] = []

  for (const sheet of workbook.worksheets) {
    const header = headerMap(sheet)
    if (!header) continue
    sheetNames.push(sheet.name)
    const col = (key: string) => getColumn(header.columns, key)
    const columns = {
      date: col('date'), type: col('vehicleType'), truck: col('truck'), trailer: col('trailer'),
      vehicle: col('vehicle'), driver: col('driver'),
      serials: Array.from(header.columns.entries()).filter(([name]) => name.includes('serial') || name === 'sn').map(([, column]) => column),
      quantity: col('quantity'),
      size: col('tireSize'), manufacturer: col('manufacturer'), origin: col('origin'),
      history: col('history'), odometer: col('odometer')
    }
    const sheetMetadata = inferSheetMetadata(sheet.name)


    for (let line = header.row + 1; line <= sheet.rowCount; line++) {
      const row = sheet.getRow(line)
      const read = (column: number | null) => column ? cellText(row.getCell(column).value) : ''

      // Only inspect columns that describe a tire usage record. Some source
      // workbooks contain broken formula-only balance columns (#REF!) copied
      // down hundreds of otherwise empty rows; those are not transactions.
      const sourceColumns = Array.from(new Set([
        columns.date, columns.type, columns.truck, columns.trailer, columns.vehicle,
        columns.driver, ...columns.serials, columns.quantity, columns.size,
        columns.manufacturer, columns.origin, columns.history, columns.odometer
      ].filter((column): column is number => column !== null)))
      if (!sourceColumns.some(column => read(column))) continue

      // Ignore repeated in-sheet header rows and opening-balance labels.
      if (normalizeHeader(read(columns.date)) === 'date' &&
          normalizeHeader(read(columns.quantity)) === 'outqty') continue
      const rowVehicleLabel = read(columns.truck) || read(columns.trailer) || read(columns.vehicle)
      // Opening Balance starts a separate stock/balance block, not more usage
      // history. Ignore the marker and every row after it on this worksheet.
      // Some sheets put quantities (for example 1, 2, 9) in OUT QTY below this
      // marker; counting those values inflated the historical issue total.
      if (/^opening balance$/i.test(rowVehicleLabel) &&
          !read(columns.date) && !read(columns.quantity)) break

      const dateCell = columns.date ? row.getCell(columns.date).value : null
      const date = dateCell == null || cellText(dateCell) === '' ? null : parseDate(dateCell)
      const truckNumber = read(columns.truck)
      const trailerNumber = read(columns.trailer)
      let genericNumber = read(columns.vehicle)
      const typeText = read(columns.type).toLowerCase()
      // Explicit source columns are authoritative. Tire size is not a reliable
      // vehicle-type signal: this workbook has 385-65 tires recorded against
      // trucks, so sheet-name inference must only be a fallback.
      let vehicleType: VehicleType | null = /trailer/.test(typeText) ? 'trailer'
        : /truck/.test(typeText) ? 'truck'
          : truckNumber && !trailerNumber ? 'truck'
            : trailerNumber && !truckNumber ? 'trailer'
              : sheetMetadata.vehicleType
      if (genericNumber && !vehicleType) {
        const typedNumber = genericNumber.match(/^\s*(truck|trailer)\s*[:#-]?\s*(.+)$/i)
        if (typedNumber) {
          vehicleType = typedNumber[1].toLowerCase() as VehicleType
          genericNumber = typedNumber[2].trim()
        }
      }
      let vehicleNumber = truckNumber || trailerNumber || genericNumber
      if (truckNumber && trailerNumber) {
        vehicleNumber = vehicleType ? (vehicleType === 'truck' ? truckNumber : trailerNumber) : `${truckNumber} / ${trailerNumber}`
      }
      const driver = read(columns.driver)
      const qtyText = read(columns.quantity)
      const parsedQty = qtyText ? Number(qtyText.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]) : NaN
      const expectedQuantity = qtyText && Number.isInteger(parsedQty) && parsedQty > 0 && parsedQty <= 100 ? parsedQty : 0
      const serialParts = columns.serials.map(column => read(column)).filter(Boolean)
      const serialText = serialParts.join(', ')
      const history = read(columns.history)
      const parsedSerials = parseSerials(serialText, expectedQuantity)

      const plausibleDate = Boolean(date && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100)
      // Source rows are retained even when date, vehicle, or quantity is missing.
      // OUT QTY creates that many individual tire records; extra serial identifiers
      // are also retained rather than discarded when they exceed OUT QTY.
      // Every non-empty source row is retained; no fleet or database lookup is used.

      // Preserve both OUT QTY slots and any additional serial identifiers from the source row.
      const quantity = qtyText ? parsedQty : 0
      const size = read(columns.size) || sheetMetadata.tireSize
      const manufacturer = read(columns.manufacturer)
      const origin = read(columns.origin) || sheetMetadata.origin
      const odometerText = read(columns.odometer)
      const odometerValue = odometerText ? Number(odometerText.replace(/,/g, '').match(/\d+/)?.[0]) : NaN
      const warnings: string[] = []

      if (!date) warnings.push('A valid usage date was not detected.')
      if (!vehicleNumber) warnings.push('A truck or trailer number was not detected.')
      if (truckNumber && trailerNumber && !vehicleType) warnings.push('Both truck and trailer are filled in and the sheet does not identify which vehicle owns this tire. Add Vehicle Type or use a dedicated truck or trailer sheet.')
      if (genericNumber && !truckNumber && !trailerNumber && typeText && !vehicleType) warnings.push('Vehicle Type must identify Truck or Trailer.')
      if (qtyText && !plausibleDate) warnings.push('Usage date is missing or invalid; the tire record will be saved without a dated history event.')
      if (qtyText && (!Number.isInteger(quantity) || quantity < 1 || quantity > 100)) warnings.push('Quantity must be a whole number from 1 to 100.')
      if (parsedSerials.serials.length > 100) warnings.push('More than 100 serial numbers were detected in one row.')
      if (parsedSerials.mixedText) warnings.push('The serial cell contains mixed text; check the extracted tire identifier in the preview.')
      if (!qtyText) warnings.push('OUT QTY is required. The importer will not assume a tire quantity.')
      if (parsedSerials.serials.length > quantity && quantity > 0) {
        warnings.push('More serial numbers were detected than OUT QTY. Correct the row so serial identifiers do not exceed the stated tire quantity.')
      }
      if (quantity > parsedSerials.serials.length && quantity > 0) {
        warnings.push('OUT QTY is ' + quantity + ' but only ' + parsedSerials.serials.length + ' serial number(s) were identified. The remaining tire record(s) will have no serial number.')
      }
      if (!serialText) warnings.push('No serial number was supplied; imported tire records will remain without serial identifiers.')
      if (!size) warnings.push('Tire size was not found in the row or worksheet name; the preview will use Unspecified.')
      if (!manufacturer) warnings.push('Manufacturer was not found; the preview will use Unspecified.')
      if (!origin) warnings.push('Origin was not found in the row or worksheet name; the preview will use OTHER.')
      if (!driver) warnings.push('Driver was not supplied in the sheet; the driver field will remain blank.')
      if (odometerText && (!Number.isInteger(odometerValue) || odometerValue < 0)) warnings.push('Odometer value could not be interpreted and will be left empty.')

      const entry: SourceEntry = {
        sheetName: sheet.name, line, eventAt: date, vehicleType, vehicleNumber, vehicleId: null,
        vehicleLabel: vehicleNumber, driver, serialText, serials: parsedSerials.serials,
        quantity: Number.isInteger(quantity) && quantity > 0 && quantity <= 100 ? quantity : 0,
        tireSize: size, manufacturer, origin: normalizeOrigin(origin), originText: origin, history,
        odometerKm: Number.isInteger(odometerValue) && odometerValue >= 0 ? odometerValue : null,
        warnings, errors: []
      }

      if (vehicleType && !vehicleNumber)      if (vehicleType && !vehicleNumber) entry.warnings.push('A vehicle number is required for the selected vehicle type.')
      sourceEntries.push(entry)
    }
  }

  if (!sheetNames.length) {
    sheetErrors.push('No recognizable usage-history table was found. The sheet needs a date column and a truck/trailer or vehicle column, plus a serial, quantity, or driver column.')
  }
  if (sourceEntries.length > 5000) sheetErrors.push('The workbook contains more than 5,000 data rows. Split it into smaller files before importing.')
  if (sheetErrors.length) throw new Error(sheetErrors.join(' '))

  const exactDuplicateRows = 0
  const units: ImportUnit[] = []
  for (const source of sourceEntries) {
    const sourceSlots = Math.max(1, source.quantity, source.serials.length)
    for (let index = 0; index < sourceSlots; index++) {
      const serial = source.serials[index] || null
      const key = 'source:' + source.sheetName + ':' + source.line + ':' + String(index + 1)
      units.push({
        key, serial,
        importCode: 'UP-XLS-' + randomUUID().toUpperCase(),
        entries: [{ source, serial }],
        warnings: [...source.warnings],
        errors: [],
        tireSize: source.tireSize || 'Unspecified',
        manufacturer: source.manufacturer || 'Unspecified',
        origin: source.origin || 'OTHER',
        status: 'READY',
        duplicateReason: null
      })
    }
  }
  const sourceQuantityTotal = sourceEntries.reduce((sum, source) => sum + Math.max(0, source.quantity), 0)
  const serialOccurrenceCounts = new Map<string, number>()
  for (const source of sourceEntries) {
    for (const serial of source.serials) {
      const key = serial.toLowerCase()
      serialOccurrenceCounts.set(key, (serialOccurrenceCounts.get(key) || 0) + 1)
    }
  }
  const serialUsageOccurrences = Array.from(serialOccurrenceCounts.values()).reduce((sum, count) => sum + count, 0)
  const uniqueSerialTires = serialOccurrenceCounts.size
  const unnumberedQuantitySlots = units.filter(unit => !unit.serial).length
  const unnumberedTireCandidates = unnumberedQuantitySlots
  const repeatedSerialUsageOccurrences = Math.max(0, serialUsageOccurrences - uniqueSerialTires)
  const repeatedSerialGroups = Array.from(serialOccurrenceCounts.values()).filter(count => count > 1).length
  const unquantifiedRows = sourceEntries.filter(source => source.quantity <= 0).length
  const warningCount = units.reduce((count, unit) => count + new Set(unit.warnings).size, 0)
  const ready = units
  const duplicates: ImportUnit[] = []
  const blocked: ImportUnit[] = []
  const reconcilable = units
  const preview = units.slice(0, 150).map(unit => ({
    serial: unit.serial,
    tireSize: unit.tireSize,
    manufacturer: unit.manufacturer,
    origin: unit.origin,
    historyEntries: unit.entries.length,
    firstDate: unit.entries[0]?.source.eventAt?.toISOString() || null,
    lastDate: unit.entries[unit.entries.length - 1]?.source.eventAt?.toISOString() || null,
    vehicles: Array.from(new Set(unit.entries.map(item => item.source.vehicleLabel).filter(Boolean))).slice(0, 5),
    status: unit.status,
    duplicateReason: unit.duplicateReason,
    warnings: Array.from(new Set(unit.warnings)).slice(0, 4),
    errors: Array.from(new Set(unit.errors)).slice(0, 4)
  }))
  return {
    sheetNames, sourceRows: sourceEntries.length, exactDuplicateRows,
    sourceQuantityTotal, serialUsageOccurrences, uniqueSerialTires, repeatedSerialUsageOccurrences,
    unnumberedQuantitySlots, unnumberedTireCandidates, unquantifiedRows,
    totalTires: units.length, historyEntries: units.reduce((count, unit) => count + unit.entries.length, 0),
    repeatedSerials: repeatedSerialGroups,
    importableTires: ready.length, duplicateTires: duplicates.length, blockedTires: blocked.length,
    importableUsageEntries: reconcilable.reduce((count, unit) => count + unit.entries.filter(item => item.source.eventAt).length, 0),
    blockedUsageEntries: blocked.reduce((count, unit) => count + unit.entries.filter(item => item.source.eventAt).length, 0),
    warningCount, preview, units, ready, reconcilable
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'tire-management', 'create')
    const form = await request.formData()
    const file = form.get('file')
    const mode = String(form.get('mode') || 'preview')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Select an Excel or CSV file.' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: 'File must be 10 MB or smaller.' }, { status: 400 })
    if (!/\.(xlsx|csv)$/i.test(file.name)) return NextResponse.json({ error: 'Use an .xlsx or .csv file.' }, { status: 400 })

    const bytes = Buffer.from(await file.arrayBuffer())
    const workbook = new ExcelJS.Workbook()
    if (file.name.toLowerCase().endsWith('.csv')) {
      await workbook.csv.read(Readable.from([bytes]))
    } else {
      await workbook.xlsx.load(bytes as any)
    }
    const analysis = await analyzeWorkbook(workbook)

    if (mode !== 'import') {
      return NextResponse.json({
        message: 'Analysis complete. No tire records or history have been saved.',
        fileName: file.name,
        sheets: analysis.sheetNames,
        summary: {
          sourceRows: analysis.sourceRows,
          sourceQuantityTotal: analysis.sourceQuantityTotal,
          tiresDetected: analysis.totalTires,
          historyEntries: analysis.historyEntries,
          serialUsageOccurrences: analysis.serialUsageOccurrences,
          uniqueSerialTires: analysis.uniqueSerialTires,
          repeatedSerialUsageOccurrences: analysis.repeatedSerialUsageOccurrences,
          unnumberedQuantitySlots: analysis.unnumberedQuantitySlots,
          unnumberedTireCandidates: analysis.unnumberedTireCandidates,
          unquantifiedRows: analysis.unquantifiedRows,
          repeatedSerialsGrouped: analysis.repeatedSerials,
          exactDuplicateRowsSkipped: analysis.exactDuplicateRows,
          importableTires: analysis.importableTires,
          importableUsageEntries: analysis.importableUsageEntries,
          blockedUsageEntries: analysis.blockedUsageEntries,
          existingDuplicates: analysis.duplicateTires,
          blockedTires: analysis.blockedTires,
          warnings: analysis.warningCount
        },
        preview: analysis.preview,
        previewLimit: 150,
        previewTruncated: analysis.totalTires > 150
      })
    }

    if (!analysis.units.length) {
      return NextResponse.json({ error: 'There are no valid tire usage entries to import or reconcile.' }, { status: 400 })
    }

    const result = await db.$transaction(async tx => {
      await ensureTireLifecycleTables(tx)
      let tireCount = 0
      let historyCount = 0
      for (const unit of analysis.units) {
        const source = unit.entries[0]?.source
        if (!source) continue
        const sourceReference = [
          source.vehicleType ? source.vehicleType.toUpperCase() : 'VEHICLE TYPE NOT SPECIFIED',
          source.vehicleNumber || 'VEHICLE NUMBER NOT SUPPLIED'
        ].join(': ')
        const notes = [
          'Imported directly from workbook; no fleet or existing-tire matching performed.',
          'Source worksheet: ' + source.sheetName + ', row ' + source.line + '.',
          'Source vehicle: ' + sourceReference,
          source.serialText ? 'Source serial cell: ' + source.serialText : 'No serial supplied in source.',
          'Source tire size: ' + (source.tireSize || 'not supplied') + '; manufacturer: ' + (source.manufacturer || 'not supplied') + '; origin: ' + (source.originText || 'not supplied') + '.',
          source.history ? 'Source history: ' + source.history : '',
          source.warnings.length ? 'Source notes: ' + source.warnings.join(' | ') : ''
        ].filter(Boolean).join(' ')
        const tire = await tx.tire.create({
          data: {
            tireSize: source.tireSize || 'Unspecified',
            manufacturer: source.manufacturer || 'Unspecified',
            origin: source.origin || 'OTHER',
            plateNumber: null,
            truckId: null,
            trailerNumber: source.vehicleType === 'trailer' ? source.vehicleNumber || null : null,
            driverName: source.driver || null,
            quantity: source.quantity > 0 ? 1 : 0,
            serialNumber: unit.serial,
            internalCode: unit.importCode,
            lifecycleStatus: 'ASSIGNED_UNVERIFIED',
            createdById: user.id,
            createdAt: source.eventAt || undefined,
            notes
          },
          select: { id: true }
        })
        tireCount++
        if (source.eventAt) {
          await tx.tireLifecycleEvent.create({
            data: {
              id: 'tireevt_' + randomUUID(),
              tireId: tire.id,
              eventType: 'ISSUE',
              eventAt: source.eventAt,
              fromTruckId: null,
              fromTrailerId: null,
              toTruckId: null,
              toTrailerId: null,
              driverNameSnapshot: source.driver || null,
              odometerKm: source.odometerKm,
              reason: 'Tire usage workbook import',
              notes,
              jobCardId: null,
              createdById: user.id
            }
          })
          historyCount++
        }
      }
      return { tireCount, historyCount }
    }, { timeout: 120000 })

    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({
      message: 'Imported ' + result.tireCount + ' tire records directly from the workbook and saved ' + result.historyCount + ' dated usage-history entries. Source vehicle references were preserved as text; no fleet matching, duplicate matching, or Workshop Job Card linking was performed. No stock receipt events are created.',
      tires: result.tireCount,
      historyEntries: result.historyCount,
      skippedDuplicates: 0,
      blockedTires: 0,
      reviewRequiredTires: 0,
      unlinkedSourceRows: 0
    }, { status: 201 })
  } catch (error) {
    console.error('Bulk tire usage import failed:', error)
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401
      : message === 'Insufficient permissions' ? 403
        : 500
    return NextResponse.json({
      error: status === 401 ? 'Authentication required'
        : status === 403 ? 'Access denied'
          : message || 'Could not analyze or import the tire usage sheet.'
    }, { status })
  }
}
