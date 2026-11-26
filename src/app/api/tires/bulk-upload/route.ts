import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'
import { createHash, randomUUID } from 'node:crypto'
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
  dateText: string
  vehicleType: VehicleType | null
  vehicleTypeText: string
  vehicleNumber: string
  truckNumber: string
  trailerNumber: string
  vehicleText: string
  vehicleId: string | null
  vehicleLabel: string
  driver: string
  serialText: string
  serials: string[]
  quantity: number
  quantityText: string
  tireSize: string
  tireSizeText: string
  manufacturer: string
  origin: string
  originText: string
  history: string
  odometerKm: number | null
  odometerText: string
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

const normalizeVehicleKey = (value: string) => value.normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]/g, '')
const normalizeSerialKey = (value: string) => value.normalize('NFKC').trim().toUpperCase().replace(/\s+/g, '')
const stableHash = (value: string) => createHash('sha256').update(value).digest('hex').toUpperCase()

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
    const hasEventIdentifier = find('serial') || find('quantity')
    const hasContextColumn = find('date') || hasVehicle || find('driver')
    // Vehicle/date values may be absent in source workbooks. Recognize a
    // history table from its tire identifier/quantity column plus any
    // contextual column, then preserve missing values as null/blank.
    if (hasEventIdentifier && hasContextColumn) return { row: rowNo, columns }
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

      // The "Opening Balance" marker may be placed in any worksheet column,
      // not necessarily one of the mapped transaction columns. Detect it
      // across the entire row BEFORE filtering empty transaction rows.
      let openingBalanceMarker = false
      let summaryRow = false
      row.eachCell({ includeEmpty: false }, cell => {
        const normalized = normalizeHeader(cellText(cell.value))
        // Opening stock is not a usage event. Match annotated variants too,
        // then stop reading this worksheet so its balance rows cannot inflate
        // the physical tire/history count.
        if (normalized.startsWith('openingbalance')) openingBalanceMarker = true
        // Spreadsheet grand totals are not source transactions. Detect labels
        // anywhere in the row, including columns that are not mapped as fields.
        if (/^(?:grand)?total(?:qty|quantity|outqty|tires|tyres)?$/.test(normalized) || /^subtotal(?:qty|quantity)?$/.test(normalized)) {
          summaryRow = true
        }
      })
      if (openingBalanceMarker) break
      if (summaryRow) continue

      // Only inspect columns that describe a tire usage record. Some source
      // workbooks contain broken formula-only balance columns (#REF!) copied
      // down hundreds of otherwise empty rows; those are not transactions.
      const sourceColumns = Array.from(new Set([
        columns.date, columns.type, columns.truck, columns.trailer, columns.vehicle,
        columns.driver, ...columns.serials, columns.quantity, columns.size,
        columns.manufacturer, columns.origin, columns.history, columns.odometer
      ].filter((column): column is number => column !== null)))
      if (!sourceColumns.some(column => read(column))) continue

      // Ignore repeated in-sheet header rows.
      if (normalizeHeader(read(columns.date)) === 'date' &&
          normalizeHeader(read(columns.quantity)) === 'outqty') continue

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
          : truckNumber && !trailerNumber
            ? (/^\s*\d{3,5}\s*[-/]\s*\d{3,5}\s*$/.test(truckNumber) && sheetMetadata.vehicleType
              ? sheetMetadata.vehicleType
              : 'truck')
            : trailerNumber && !truckNumber ? 'trailer'
              : sheetMetadata.vehicleType
      if (genericNumber && !vehicleType) {
        const typedNumber = genericNumber.match(/^\s*(truck|trailer)\s*[:#-]?\s*(.+)$/i)
        if (typedNumber) {
          vehicleType = typedNumber[1].toLowerCase() as VehicleType
          genericNumber = typedNumber[2].trim()
        }
      }
      const vehicleText = truckNumber && trailerNumber
        ? 'Truck: ' + truckNumber + '; Trailer: ' + trailerNumber
        : truckNumber || trailerNumber || genericNumber
      let vehicleNumber = truckNumber || trailerNumber || genericNumber
      if (truckNumber && trailerNumber) {
        vehicleNumber = vehicleType ? (vehicleType === 'truck' ? truckNumber : trailerNumber) : `${truckNumber} / ${trailerNumber}`
      }
      const driver = read(columns.driver)
      const qtyText = read(columns.quantity)
      // Accept only a cell whose complete value is a numeric quantity.
      // Do not extract incidental numbers from notes, formulas, or mixed text.
      const normalizedQtyText = qtyText.replace(/,/g, '').trim()
      const parsedQty = /^\d+(?:\.0+)?$/.test(normalizedQtyText) ? Number(normalizedQtyText) : NaN
      const expectedQuantity = Number.isSafeInteger(parsedQty) && parsedQty > 0 ? parsedQty : 0
      const serialParts = columns.serials.map(column => read(column)).filter(Boolean)
      const serialText = serialParts.join(', ')
      const history = read(columns.history)
      const parsedSerials = parseSerials(serialText, expectedQuantity)
      const quantityIsValid = Number.isSafeInteger(parsedQty) && parsedQty > 0
      const hasSourceContext = Boolean(
        cellText(dateCell as ExcelJS.CellValue) || truckNumber || trailerNumber || genericNumber ||
        driver || serialText || history || read(columns.size) || read(columns.manufacturer) ||
        read(columns.origin) || read(columns.odometer)
      )
      // A quantity cell by itself is not a usage transaction: it commonly
      // represents a worksheet grand-total row. Require at least one source
      // context field (date, vehicle, driver, serial, or usage detail) so
      // summary totals cannot be imported as additional tire units.
      if (!hasSourceContext) continue

      const plausibleDate = Boolean(date && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100)
      // Source rows are retained in the analysis even when date, vehicle, or
      // quantity is missing. Only a valid OUT QTY creates tire records. Serial
      // identifiers are assigned to those quantity slots and never add units.

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
      if (qtyText && (!Number.isSafeInteger(quantity) || quantity < 1)) warnings.push('OUT QTY must be a positive whole number.')
      if (parsedSerials.serials.length > 100) warnings.push('More than 100 serial numbers were detected in one row.')
      if (parsedSerials.mixedText) warnings.push('The serial cell contains mixed text; check the extracted tire identifier in the preview.')
      const rowSerialKeys = parsedSerials.serials.slice(0, quantity).map(normalizeSerialKey)
      if (new Set(rowSerialKeys).size < rowSerialKeys.length) {
        warnings.push('The same serial number appears more than once in this row. Each OUT QTY slot will remain a separate tire record; verify the repeated identifier.')
      }
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
        sheetName: sheet.name, line, eventAt: date, dateText: cellText(dateCell as ExcelJS.CellValue), vehicleType, vehicleTypeText: typeText, vehicleNumber, truckNumber, trailerNumber, vehicleText, vehicleId: null,
        vehicleLabel: vehicleText, driver, serialText, serials: parsedSerials.serials,
        quantity: Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 0,
        quantityText: qtyText, tireSize: size, tireSizeText: read(columns.size), manufacturer, origin: normalizeOrigin(origin), originText: origin, history,
        odometerKm: Number.isInteger(odometerValue) && odometerValue >= 0 ? odometerValue : null, odometerText,
        warnings, errors: []
      }

      if (vehicleType && !vehicleNumber) entry.warnings.push('A vehicle number is required for the selected vehicle type.')
      sourceEntries.push(entry)
    }
  }

  if (!sheetNames.length) {
    sheetErrors.push('No recognizable usage-history table was found. The sheet needs a date column and a truck/trailer or vehicle column, plus a serial, quantity, or driver column.')
  }
  if (sourceEntries.length > 5000) sheetErrors.push('The workbook contains more than 5,000 data rows. Split it into smaller files before importing.')
  if (sheetErrors.length) throw new Error(sheetErrors.join(' '))

  const exactDuplicateRows = 0
  const sheetQuantityTotals = Array.from(sourceEntries.reduce((totals, source) => {
    const current = totals.get(source.sheetName) || { sheetName: source.sheetName, usageRows: 0, tireQuantity: 0 }
    if (source.quantity > 0) {
      current.usageRows += 1
      current.tireQuantity += source.quantity
    }
    totals.set(source.sheetName, current)
    return totals
  }, new Map<string, { sheetName: string; usageRows: number; tireQuantity: number }>()).values())
  const requestedUnitCount = sourceEntries.reduce((sum, source) => sum + Math.max(0, source.quantity), 0)
  if (requestedUnitCount > 10000) throw new Error('This workbook contains more than 10,000 tire quantity slots. Split the workbook into smaller files; no records were imported.')
  // OUT QTY is authoritative. Every quantity slot gets its own tire row,
  // even when a serial repeats in this or another source row. Serial numbers
  // label slots; they never merge rows or increase the number of tires.
  const units: ImportUnit[] = []
  for (const source of sourceEntries) {
    for (let index = 0; index < source.quantity; index++) {
      const serial = source.serials[index] || null
      const key = 'source:' + source.sheetName + ':' + source.line + ':' + String(index + 1)
      units.push({
        key,
        serial,
        importCode: 'UP-XLS-' + stableHash(key).slice(0, 24),
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
    // Only serials assigned to an OUT QTY slot count as imported occurrences.
    for (const serial of source.serials.slice(0, source.quantity)) {
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
  return {
    sheetNames, sourceRows: sourceEntries.length, exactDuplicateRows, sheetQuantityTotals,
    sourceQuantityTotal, serialUsageOccurrences, uniqueSerialTires, repeatedSerialUsageOccurrences,
    unnumberedQuantitySlots, unnumberedTireCandidates, unquantifiedRows,
    totalTires: units.length, historyEntries: units.reduce((count, unit) => count + unit.entries.filter(item => item.source.eventAt).length, 0),
    repeatedSerials: repeatedSerialGroups,
    importableTires: ready.length, duplicateTires: duplicates.length, blockedTires: blocked.length,
    importableUsageEntries: reconcilable.reduce((count, unit) => count + unit.entries.filter(item => item.source.eventAt).length, 0),
    blockedUsageEntries: blocked.reduce((count, unit) => count + unit.entries.filter(item => item.source.eventAt).length, 0),
    warningCount,
    unquantifiedPreview: sourceEntries.filter(source => source.quantity <= 0).slice(0, 100).map(source => ({
      sourceSheet: source.sheetName,
      sourceRow: source.line,
      quantityText: source.quantityText,
      serialText: source.serialText,
      vehicleText: source.vehicleText,
      driver: source.driver,
      warnings: source.warnings
    })),
    units, ready, reconcilable
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
    const sourceHash = createHash('sha256').update(bytes).digest('hex').slice(0, 20).toUpperCase()

    // Fail closed for the known 10-sheet historical workbook. The source
    // workbook has exactly 794 usage tires; 36 opening-balance units are stock.
    // Use the workbook structure as well as the content hash because Excel
    // editors can rewrite XLSX package metadata without changing worksheet data.
    const expectedHistoricalSheetTotals: Record<string, number> = {
      '315-80 China': 384,
      '315-80 Japan': 56,
      '385-65 China': 193,
      '385-65Japan': 89,
      'Small car': 4,
      '215------17': 34,
      '215-----17': 1,
      '215----17': 2,
      '215-17': 29,
      '215--17': 2
    }
    const actualSheetNames = analysis.sheetNames.map(name => name.trim())
    const matchesHistoricalWorkbook = Object.keys(expectedHistoricalSheetTotals)
      .every(name => actualSheetNames.includes(name)) && actualSheetNames.length === 10
    const sheetReconciliationFailures = matchesHistoricalWorkbook
      ? Object.entries(expectedHistoricalSheetTotals).flatMap(([sheetName, expected]) => {
          const actual = analysis.sheetQuantityTotals.find(item => item.sheetName.trim() === sheetName)?.tireQuantity ?? 0
          return actual === expected ? [] : [{ sheetName, expected, detected: actual }]
        })
      : []
    if ((sourceHash === 'B1411BE22C06ED31E7BB' || matchesHistoricalWorkbook) &&
        (analysis.sourceQuantityTotal !== 794 || sheetReconciliationFailures.length > 0)) {
      return NextResponse.json({
        error: 'Import blocked: this historical workbook must reconcile to exactly 794 usage tires, with the expected quantity on every worksheet. The current analysis does not match. No records were imported.',
        expectedTires: 794,
        detectedTires: analysis.sourceQuantityTotal,
        sheetTotals: analysis.sheetQuantityTotals,
        sheetReconciliationFailures,
        // Diagnostic-only row trace. This response is returned before any
        // database transaction and never changes import eligibility.
        rowDiagnostics: analysis.sheetQuantityTotals.map(sheet => ({
          sheetName: sheet.sheetName,
          rows: analysis.units
            .filter(unit => unit.entries[0]?.source.sheetName === sheet.sheetName)
            .reduce((rows, unit) => {
              const source = unit.entries[0]?.source
              if (source && !rows.some(row => row.sourceRow === source.line)) {
                rows.push({
                  sourceRow: source.line,
                  quantityText: source.quantityText,
                  parsedQuantity: source.quantity
                })
              }
              return rows
            }, [] as Array<{ sourceRow: number; quantityText: string; parsedQuantity: number }>)
        })),
        sourceHash
      }, { status: 422 })
    }

    if (mode !== 'import') {
      const incomingSourceCodes = analysis.units.map(unit => unit.importCode)
      const existingSourceRows = incomingSourceCodes.length ? await db.tire.findMany({
        where: { internalCode: { in: incomingSourceCodes } },
        select: { internalCode: true }
      }) : []
      const existingSourceCodes = new Set(existingSourceRows.map(item => item.internalCode).filter(Boolean))
      for (const unit of analysis.units) {
        if (existingSourceCodes.has(unit.importCode)) {
          unit.status = 'DUPLICATE'
          unit.duplicateReason = 'This exact source worksheet row and OUT QTY slot were already imported. No duplicate record will be created.'
        }
      }
      const requestedPage = Math.max(1, Number.parseInt(String(form.get('page') || '1'), 10) || 1)
      const pageSize = Math.min(100, Math.max(10, Number.parseInt(String(form.get('pageSize') || '50'), 10) || 50))
      const search = String(form.get('search') || '').trim().toLocaleLowerCase()
      const selectedSheet = String(form.get('sheet') || 'all')
      const filteredUnits = analysis.units.filter(unit => {
        const source = unit.entries[0]?.source
        if (!source) return false
        if (selectedSheet !== 'all' && source.sheetName !== selectedSheet) return false
        if (!search) return true
        const haystack = [source.sheetName, source.serialText, unit.serial || '', source.vehicleText,
          source.vehicleNumber, source.driver, source.tireSize, source.manufacturer, source.originText]
          .join(' ').toLocaleLowerCase()
        return haystack.includes(search)
      })
      const totalPages = Math.max(1, Math.ceil(filteredUnits.length / pageSize))
      const page = Math.min(requestedPage, totalPages)
      const preview = filteredUnits.slice((page - 1) * pageSize, page * pageSize).map(unit => ({
        sourceSheet: unit.entries[0]?.source.sheetName || '',
        sourceRow: unit.entries[0]?.source.line || 0,
        sourceOutQty: unit.entries[0]?.source.quantity || 0,
        serial: unit.serial,
        tireSize: unit.tireSize,
        manufacturer: unit.manufacturer,
        origin: unit.origin,
        historyEntries: unit.entries.filter(item => Boolean(item.source.eventAt)).length,
        firstDate: unit.entries[0]?.source.eventAt?.toISOString() || null,
        lastDate: unit.entries[unit.entries.length - 1]?.source.eventAt?.toISOString() || null,
        vehicles: Array.from(new Set(unit.entries.map(item => item.source.vehicleLabel).filter(Boolean))).slice(0, 5),
        status: unit.status,
        duplicateReason: unit.duplicateReason,
        warnings: Array.from(new Set(unit.warnings)).slice(0, 4),
        errors: Array.from(new Set(unit.errors)).slice(0, 4)
      }))
      return NextResponse.json({
        message: 'Analysis complete. No tire records or history have been saved.',
        fileName: file.name,
        sourceHash,
        sheets: analysis.sheetNames,
        pageInfo: { page, pageSize, total: filteredUnits.length, totalPages },
        unquantifiedPreview: analysis.unquantifiedPreview,
        summary: {
          sourceRows: analysis.sourceRows,
          sourceQuantityTotal: analysis.sourceQuantityTotal,
          sheetQuantityTotals: analysis.sheetQuantityTotals,
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
          existingDuplicates: analysis.units.filter(unit => unit.status === 'DUPLICATE').length,
          blockedTires: analysis.blockedTires,
          warnings: analysis.warningCount
        },
        preview,
        previewLimit: pageSize,
        previewTruncated: filteredUnits.length > pageSize
      })
    }

    if (!analysis.units.length) {
      return NextResponse.json({ error: 'There are no valid tire usage entries to import or reconcile.' }, { status: 400 })
    }

    const result = await db.$transaction(async tx => {
      await ensureTireLifecycleTables(tx)
      const importCodes = analysis.units.map(unit => unit.importCode)
      const existingByCodeRows = importCodes.length
        ? await tx.tire.findMany({ where: { internalCode: { in: importCodes } }, select: { id: true, internalCode: true, deletedAt: true, tireSize: true, manufacturer: true, origin: true } })
        : []
      const existingByCode = new Map(existingByCodeRows.filter(item => item.internalCode).map(item => [item.internalCode as string, item]))
      // Older manual imports may already contain the exact source row but lack
      // the stable UP-XLS code and have a combined serial cell copied to each
      // tire. Reconcile only an exact date/size/origin/serial/vehicle group.
      const legacyTireRows = await tx.tire.findMany({
        where: { deletedAt: null, internalCode: { startsWith: 'TY-' } },
        select: {
          id: true, internalCode: true, serialNumber: true, plateNumber: true,
          truckId: true, trailerNumber: true, tireSize: true, manufacturer: true,
          origin: true, createdAt: true, notes: true, driverName: true
        }
      })

      const trucks = await tx.truck.findMany({ where: { isDeleted: false }, select: { id: true, licensePlate: true } })
      const trailers = await tx.trailer.findMany({ where: { isDeleted: false }, select: { id: true, number: true } })
      const addUniqueAlias = (map: Map<string, string | null>, alias: string, id: string) => {
        const key = normalizeVehicleKey(alias)
        if (!key) return
        if (map.has(key) && map.get(key) !== id) map.set(key, null)
        else map.set(key, id)
      }
      const truckMap = new Map<string, string | null>()
      const truckNumberById = new Map<string, string>()
      for (const item of trucks) {
        truckNumberById.set(item.id, item.licensePlate)
        addUniqueAlias(truckMap, item.licensePlate, item.id)
        const numericPlatePrefix = item.licensePlate.match(/^\s*(\d{3,5})\b/)
        if (numericPlatePrefix) addUniqueAlias(truckMap, numericPlatePrefix[1], item.id)
      }
      const trailerMap = new Map<string, string | null>()
      const trailerNumberById = new Map<string, string>()
      for (const item of trailers) {
        trailerNumberById.set(item.id, item.number)
        addUniqueAlias(trailerMap, item.number, item.id)
        const numericTrailerSuffix = item.number.match(/(\d{3,5})\s*$/)
        if (numericTrailerSuffix) addUniqueAlias(trailerMap, numericTrailerSuffix[1], item.id)
        if (/lowbed/i.test(item.number)) addUniqueAlias(trailerMap, 'lowbed', item.id)
        if (/long\s*sata/i.test(item.number)) addUniqueAlias(trailerMap, 'long sata', item.id)
      }
      const resolveVehicle = (source: SourceEntry) => {
        const truckKey = normalizeVehicleKey(source.truckNumber)
        const trailerKey = normalizeVehicleKey(source.trailerNumber)
        const explicitTruckId = truckKey ? truckMap.get(truckKey) || null : null
        const explicitTrailerId = trailerKey ? trailerMap.get(trailerKey) || null : null
        if (explicitTruckId && explicitTrailerId) {
          return source.vehicleType === 'trailer'
            ? { type: 'trailer' as const, id: explicitTrailerId, number: trailerNumberById.get(explicitTrailerId) || source.trailerNumber }
            : { type: 'truck' as const, id: explicitTruckId, number: truckNumberById.get(explicitTruckId) || source.truckNumber }
        }
        if (explicitTruckId) return { type: 'truck' as const, id: explicitTruckId, number: truckNumberById.get(explicitTruckId) || source.truckNumber }
        if (explicitTrailerId) return { type: 'trailer' as const, id: explicitTrailerId, number: trailerNumberById.get(explicitTrailerId) || source.trailerNumber }

        const rawVehicle = source.vehicleNumber || source.truckNumber || source.trailerNumber
        if (!rawVehicle) return null
        const pairedNumbers = rawVehicle.match(/^\s*(\d{3,5})\s*[-/]\s*(\d{3,5})\s*$/)
        if (pairedNumbers) {
          const candidates = [pairedNumbers[1], pairedNumbers[2]]
          const truckId = candidates.map(value => truckMap.get(normalizeVehicleKey(value)) || null).find(Boolean) || null
          const trailerId = candidates.map(value => trailerMap.get(normalizeVehicleKey(value)) || null).find(Boolean) || null
          if (truckId && trailerId) {
            return source.vehicleType === 'trailer'
              ? { type: 'trailer' as const, id: trailerId, number: trailerNumberById.get(trailerId) || pairedNumbers[1] }
              : { type: 'truck' as const, id: truckId, number: truckNumberById.get(truckId) || pairedNumbers[1] }
          }
          if (truckId) return { type: 'truck' as const, id: truckId, number: truckNumberById.get(truckId) || pairedNumbers[1] }
          if (trailerId) return { type: 'trailer' as const, id: trailerId, number: trailerNumberById.get(trailerId) || pairedNumbers[1] }
        }

        const firstNumericIdentifier = rawVehicle.match(/\d{3,5}/)?.[0]
        const candidateKey = normalizeVehicleKey(firstNumericIdentifier || rawVehicle)
        const candidateTruckId = candidateKey ? truckMap.get(candidateKey) || null : null
        const candidateTrailerId = candidateKey ? trailerMap.get(candidateKey) || null : null
        if (candidateTruckId && candidateTrailerId) {
          return source.vehicleType === 'trailer'
            ? { type: 'trailer' as const, id: candidateTrailerId, number: trailerNumberById.get(candidateTrailerId) || rawVehicle }
            : { type: 'truck' as const, id: candidateTruckId, number: truckNumberById.get(candidateTruckId) || rawVehicle }
        }
        if (candidateTruckId) return { type: 'truck' as const, id: candidateTruckId, number: truckNumberById.get(candidateTruckId) || rawVehicle }
        if (candidateTrailerId) return { type: 'trailer' as const, id: candidateTrailerId, number: trailerNumberById.get(candidateTrailerId) || rawVehicle }
        const namedKey = normalizeVehicleKey(rawVehicle)
        if (namedKey && trailerMap.has(namedKey)) {
          const namedTrailerId = trailerMap.get(namedKey)
          if (namedTrailerId) return { type: 'trailer' as const, id: namedTrailerId, number: trailerNumberById.get(namedTrailerId) || rawVehicle }
        }
        return null
      }

      const legacySignature = (at: Date, tireSize: string, origin: string, serialText: string) =>
        [at.toISOString().slice(0, 10), normalizeVehicleKey(tireSize), normalizeVehicleKey(origin), normalizeVehicleKey(serialText)].join('|')
      const legacyRowsBySignature = new Map<string, typeof legacyTireRows>()
      for (const tire of legacyTireRows) {
        if (!tire.serialNumber) continue
        const key = legacySignature(tire.createdAt, tire.tireSize, tire.origin, tire.serialNumber)
        const group = legacyRowsBySignature.get(key) || []
        group.push(tire)
        legacyRowsBySignature.set(key, group)
      }
      const unitsBySourceRow = new Map<string, ImportUnit[]>()
      for (const unit of analysis.units) {
        const source = unit.entries[0]?.source
        if (!source) continue
        const key = source.sheetName + ':' + source.line
        const group = unitsBySourceRow.get(key) || []
        group.push(unit)
        unitsBySourceRow.set(key, group)
      }
      const legacyMatchesByCode = new Map<string, typeof legacyTireRows[number]>()
      const claimedLegacyTireIds = new Set<string>()
      for (const rowUnits of unitsBySourceRow.values()) {
        const source = rowUnits[0]?.entries[0]?.source
        if (!source?.eventAt || !source.serialText || rowUnits.some(unit => existingByCode.has(unit.importCode))) continue
        const signature = legacySignature(source.eventAt, source.tireSize, source.origin, source.serialText)
        const candidates = (legacyRowsBySignature.get(signature) || []).filter(tire => !claimedLegacyTireIds.has(tire.id))
        const vehicleKeys = (source.vehicleNumber.match(/\d{3,5}/g) || []).map(normalizeVehicleKey)
        const matched = candidates.filter(tire => {
          const plateKey = normalizeVehicleKey(tire.plateNumber || '')
          const trailerKey = normalizeVehicleKey(tire.trailerNumber || '')
          return vehicleKeys.some(key => plateKey.startsWith(key) || trailerKey === key)
        })
        if (matched.length !== rowUnits.length) continue
        const orderedUnits = [...rowUnits].sort((a, b) => a.key.localeCompare(b.key))
        const orderedTires = [...matched].sort((a, b) => a.id.localeCompare(b.id))
        orderedUnits.forEach((unit, index) => {
          legacyMatchesByCode.set(unit.importCode, orderedTires[index])
          claimedLegacyTireIds.add(orderedTires[index].id)
        })
      }
      const existingTireIds = Array.from(new Set([
        ...existingByCodeRows.filter(item => !item.deletedAt).map(item => item.id),
        ...Array.from(legacyMatchesByCode.values()).map(item => item.id)
      ]))
      const existingPeriods = existingTireIds.length ? await tx.tireUsagePeriod.findMany({
        where: { tireId: { in: existingTireIds } },
        select: { tireId: true, vehicleType: true, vehicleId: true, installedAt: true, driverNameSnapshot: true }
      }) : []
      const existingEvents = existingTireIds.length ? await tx.tireLifecycleEvent.findMany({
        where: { tireId: { in: existingTireIds } },
        select: { tireId: true, eventType: true, eventAt: true, toTruckId: true, toTrailerId: true, driverNameSnapshot: true, odometerKm: true, notes: true }
      }) : []
      const periodSignature = (tireId: string, at: Date, vehicleType: string, vehicleId: string, driver: string) =>
        [tireId, at.toISOString(), vehicleType, vehicleId, driver.trim().toUpperCase()].join('|')
      const eventSignature = (tireId: string, eventType: string, at: Date, truckId: string | null, trailerId: string | null, driver: string, odometer: number | null, sourceVehicle: string) =>
        [tireId, eventType, at.toISOString(), truckId || '', trailerId || '', driver.trim().toUpperCase(), odometer ?? '', normalizeVehicleKey(sourceVehicle)].join('|')
      const periodKeys = new Set(existingPeriods.map(item => periodSignature(item.tireId, item.installedAt, item.vehicleType, item.vehicleId, item.driverNameSnapshot || '')))
      const eventKeys = new Set(existingEvents.map(item => {
        const sourceVehicle = item.notes?.match(/Source vehicle columns: (.*?)(?:\. Source date cell:|\. No source)/)?.[1] || ''
        return eventSignature(item.tireId, item.eventType, item.eventAt, item.toTruckId, item.toTrailerId, item.driverNameSnapshot || '', item.odometerKm, sourceVehicle)
      }))
      const sourceNotesFor = (source: SourceEntry) => [
        'Source worksheet: ' + source.sheetName + ', row ' + source.line + '.',
        'Source vehicle columns: ' + (source.vehicleText || 'Vehicle not supplied') + '.',
        'Source date cell: ' + (source.dateText || 'not supplied') + '; source OUT QTY cell: ' + (source.quantityText || 'not supplied') + '; source vehicle type cell: ' + (source.vehicleTypeText || 'not supplied') + '; source odometer cell: ' + (source.odometerText || 'not supplied') + '.',
        source.serialText ? 'Source serial cell: ' + source.serialText : 'No serial supplied in source.',
        'Source tire size cell: ' + (source.tireSizeText || 'not supplied') + '; imported tire size: ' + (source.tireSize || 'Unspecified') + '; manufacturer: ' + (source.manufacturer || 'not supplied') + '; origin: ' + (source.originText || 'not supplied') + '.',
        source.history ? 'Source history: ' + source.history : '',
        source.warnings.length ? 'Source notes: ' + source.warnings.join(' | ') : ''
      ].filter(Boolean).join(' ')
      const tiresToCreate: any[] = []
      const eventsToCreate: any[] = []
      const periodsToCreate: any[] = []
      let updatedExisting = 0
      let reconciledVehicles = 0
      let reusedSourceRows = 0

      for (let index = 0; index < analysis.units.length; index++) {
        const unit = analysis.units[index]
        const code = importCodes[index]
        const codeMatch = existingByCode.get(code)
        const legacyMatch = legacyMatchesByCode.get(code)
        const existingTire = codeMatch && !codeMatch.deletedAt ? codeMatch : legacyMatch
        const orderedEntries = [...unit.entries].sort((a, b) =>
          (a.source.eventAt?.getTime() ?? 0) - (b.source.eventAt?.getTime() ?? 0))
        const firstSource = orderedEntries[0]?.source
        const latestSource = orderedEntries[orderedEntries.length - 1]?.source
        if (!firstSource || !latestSource) continue

        let tireId = existingTire?.id || 'tire_' + randomUUID()
        if (existingTire) {
          reusedSourceRows++
          const latestVehicle = resolveVehicle(latestSource)
          if (legacyMatch) {
            const updateData: any = {
              internalCode: code,
              serialNumber: unit.serial,
              quantity: 1,
              lifecycleStatus: 'ASSIGNED_UNVERIFIED',
              driverName: latestSource.driver || legacyMatch.driverName || null,
              notes: [legacyMatch.notes, sourceNotesFor(latestSource)].filter(Boolean).join(' ')
            }
            if (latestVehicle?.type === 'truck') {
              updateData.truckId = latestVehicle.id
              updateData.trailerNumber = null
            } else if (latestVehicle?.type === 'trailer') {
              updateData.truckId = null
              updateData.plateNumber = null
              updateData.trailerNumber = latestVehicle.number
            }
            await tx.tire.update({ where: { id: tireId }, data: updateData })
            updatedExisting++
          } else {
            const updateData: any = {}
            if ((codeMatch?.tireSize === 'Unspecified' || !codeMatch?.tireSize) && latestSource.tireSize) updateData.tireSize = latestSource.tireSize
            if ((codeMatch?.manufacturer === 'Unspecified' || !codeMatch?.manufacturer) && latestSource.manufacturer) updateData.manufacturer = latestSource.manufacturer
            if ((codeMatch?.origin === 'OTHER' || !codeMatch?.origin) && latestSource.origin) updateData.origin = latestSource.origin
            if (Object.keys(updateData).length) {
              await tx.tire.update({ where: { id: tireId }, data: updateData })
              updatedExisting++
            }
          }
          if (latestVehicle) reconciledVehicles++
        } else {
          const latestVehicle = resolveVehicle(latestSource)
          const sourceNotes = orderedEntries.map(({ source }) => sourceNotesFor(source))
          tiresToCreate.push({
            id: tireId,
            tireSize: latestSource.tireSize || unit.tireSize || 'Unspecified',
            manufacturer: latestSource.manufacturer || unit.manufacturer || 'Unspecified',
            origin: latestSource.origin || unit.origin || 'OTHER',
            plateNumber: null,
            truckId: latestVehicle?.type === 'truck' ? latestVehicle.id : null,
            trailerNumber: latestVehicle?.type === 'trailer'
              ? latestVehicle.number
              : (!latestVehicle && latestSource.vehicleType === 'trailer' && !/^\s*\d{3,5}\s*[-/]\s*\d{3,5}\s*$/.test(latestSource.vehicleNumber)
                ? (latestSource.trailerNumber || latestSource.vehicleNumber)
                : null),
            driverName: latestSource.driver || null,
            quantity: 1,
            serialNumber: unit.serial,
            internalCode: code,
            lifecycleStatus: 'ASSIGNED_UNVERIFIED',
            createdById: user.id,
            createdAt: firstSource.eventAt || undefined,
            notes: sourceNotes.join(' ')
          })
          if (latestVehicle) reconciledVehicles++
        }

        for (const { source } of orderedEntries) {
          if (!source.eventAt) continue
          const vehicleMatch = resolveVehicle(source)
          const eventVehicleText = source.vehicleText || source.vehicleNumber || 'Unassigned / vehicle not recorded'
          const vehicleType = vehicleMatch?.type || source.vehicleType || (/\d{3,5}/.test(source.vehicleNumber) ? 'truck' : 'unknown')
          const vehicleId = vehicleMatch?.id || eventVehicleText
          const periodKey = periodSignature(tireId, source.eventAt, vehicleType, vehicleId, source.driver)
          const eventKey = eventSignature(tireId, 'ISSUE', source.eventAt, vehicleMatch?.type === 'truck' ? vehicleMatch.id : null,
            vehicleMatch?.type === 'trailer' ? vehicleMatch.id : null, source.driver, source.odometerKm, eventVehicleText)
          const periodExists = periodKeys.has(periodKey)
          const eventExists = eventKeys.has(eventKey)
          if (!eventExists) {
            const notes = [
              'Imported from workbook; each OUT QTY slot is a separate tire record.',
              'Source worksheet: ' + source.sheetName + ', row ' + source.line + '.',
              'Source vehicle columns: ' + (eventVehicleText || 'Vehicle not supplied') + '.',
              'Source date cell: ' + (source.dateText || 'not supplied') + '; source OUT QTY cell: ' + (source.quantityText || 'not supplied') + '; source odometer cell: ' + (source.odometerText || 'not supplied') + '.',
              source.serialText ? 'Source serial cell: ' + source.serialText : 'No serial supplied in source.',
              source.history ? 'Source history: ' + source.history : ''
            ].filter(Boolean).join(' ')
            eventsToCreate.push({
              id: 'tireevt_' + stableHash(tireId + '|' + eventKey).slice(0, 32).toLowerCase(),
              tireId,
              eventType: 'ISSUE',
              eventAt: source.eventAt,
              fromTruckId: null,
              fromTrailerId: null,
              toTruckId: vehicleMatch?.type === 'truck' ? vehicleMatch.id : null,
              toTrailerId: vehicleMatch?.type === 'trailer' ? vehicleMatch.id : null,
              driverNameSnapshot: source.driver || null,
              odometerKm: source.odometerKm,
              reason: 'Tire usage workbook import',
              notes,
              jobCardId: null,
              createdById: user.id
            })
          }
          // Preserve every dated OUT QTY slot in the consumption report,
          // including source rows where the workbook did not record a vehicle.
          if (!periodExists) {
            periodsToCreate.push({
              id: 'tyuse_' + stableHash(tireId + '|' + periodKey).slice(0, 32).toLowerCase(),
              tireId,
              vehicleType,
              vehicleId,
              installedAt: source.eventAt,
              removedAt: null,
              historicalEndUnknown: true,
              startOdometer: source.odometerKm,
              driverNameSnapshot: source.driver || null
            })
          }
          periodKeys.add(periodKey)
          eventKeys.add(eventKey)
        }
      }
      if (tiresToCreate.length) await tx.tire.createMany({ data: tiresToCreate, skipDuplicates: true })
      if (eventsToCreate.length) await tx.tireLifecycleEvent.createMany({ data: eventsToCreate, skipDuplicates: true })
      if (periodsToCreate.length) await tx.tireUsagePeriod.createMany({ data: periodsToCreate, skipDuplicates: true })
      return {
        tireCount: tiresToCreate.length,
        historyCount: eventsToCreate.length,
        periodCount: periodsToCreate.length,
        alreadyImported: !tiresToCreate.length && !eventsToCreate.length && !periodsToCreate.length && !updatedExisting,
        reconciledVehicles,
        reusedSourceRows,
        updatedExisting
      }    }, { timeout: 120000 })

    if (result.alreadyImported) {
      return NextResponse.json({
        message: 'All source worksheet rows and OUT QTY slots were already imported. No duplicate tire or history rows were created. Reconciled ' + result.reconciledVehicles + ' vehicle references.' ,
        tires: 0, historyEntries: 0, reconciledVehicles: result.reconciledVehicles, alreadyImported: true
      }, { status: 200 })
    }
    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({
      message: 'Created ' + result.tireCount + ' separate tire records from OUT QTY slots; serial numbers were retained without merging repeated identifiers. ' + result.reusedSourceRows + ' source slots were already imported and reused. Saved ' + result.historyCount + ' dated usage-history entries and ' + result.periodCount + ' usage periods. ' + result.reconciledVehicles + ' entries matched active truck/trailer records using normalized fleet identifiers. Workshop Job Card linking and stock receipt events were not performed.',
      tires: result.tireCount,
      historyEntries: result.historyCount,
      reconciledVehicles: result.reconciledVehicles,
      skippedDuplicates: 0,
      reusedSourceRows: result.reusedSourceRows,
      updatedExisting: result.updatedExisting,
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
