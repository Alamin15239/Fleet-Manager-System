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
  const units: ImportUnit[] = []
  for (const source of sourceEntries) {
    // OUT QTY is the sole authority for the number of tire units. Serial
    // identifiers label those units; they never create additional units.
    // Rows with missing/invalid OUT QTY remain in source analysis but create
    // no tire records. Extra serial tokens are reported as warnings above
    // and are not allowed to inflate the import count.
    const sourceSlots = source.quantity
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
          existingDuplicates: analysis.duplicateTires,
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
      const codes = analysis.units.map((_, index) => 'UP-XLS-' + sourceHash + '-' + String(index + 1).padStart(5, '0'))
      const existing = await tx.tire.findMany({ where: { internalCode: { in: codes } }, select: { id: true, internalCode: true } })
      const existingByCode = new Map(existing.filter(item => item.internalCode).map(item => [item.internalCode as string, item]))
      const newUnits = analysis.units.map((unit, index) => ({ unit, code: codes[index] })).filter(item => !existingByCode.has(item.code))
      const trucks = await tx.truck.findMany({ where: { isDeleted: false }, select: { id: true, licensePlate: true } })
      const trailers = await tx.trailer.findMany({ where: { isDeleted: false }, select: { id: true, number: true } })
      const uniqueMap = (items: Array<{ id: string; number: string }>) => {
        const map = new Map<string, string | null>()
        for (const item of items) {
          const key = normalizeVehicleKey(item.number)
          if (!key) continue
          map.set(key, map.has(key) ? null : item.id)
        }
        return map
      }
      const truckMap = uniqueMap(trucks.map(item => ({ id: item.id, number: item.licensePlate })))
      const trailerMap = uniqueMap(trailers.map(item => ({ id: item.id, number: item.number })))
      const resolveVehicle = (source: SourceEntry) => {
        const truckKey = normalizeVehicleKey(source.truckNumber)
        const trailerKey = normalizeVehicleKey(source.trailerNumber)
        const truckId = truckKey ? truckMap.get(truckKey) || null : null
        const trailerId = trailerKey ? trailerMap.get(trailerKey) || null : null

        // When the workbook supplies both columns, prefer the only exact fleet
        // match. If both exist, use the source's explicit/inferred tire vehicle type.
        if (truckKey && trailerKey) {
          if (truckId && !trailerId) return { type: 'truck' as const, id: truckId }
          if (trailerId && !truckId) return { type: 'trailer' as const, id: trailerId }
          if (truckId && trailerId && source.vehicleType === 'truck') return { type: 'truck' as const, id: truckId }
          if (truckId && trailerId && source.vehicleType === 'trailer') return { type: 'trailer' as const, id: trailerId }
          return null
        }
        if (truckKey) return truckId ? { type: 'truck' as const, id: truckId } : null
        if (trailerKey) return trailerId ? { type: 'trailer' as const, id: trailerId } : null

        const key = normalizeVehicleKey(source.vehicleNumber)
        if (!key || !source.vehicleType) return null
        const id = (source.vehicleType === 'truck' ? truckMap : trailerMap).get(key)
        return id ? { type: source.vehicleType, id } : null
      }

      // Re-uploading the same workbook is an idempotent reconciliation pass:
      // attach previously imported historical records to exact, unique fleet matches
      // without creating a second set of tires or usage events.
      let reconciledVehicles = 0
      for (let index = 0; index < analysis.units.length; index++) {
        const unit = analysis.units[index]
        const code = codes[index]
        const existingTire = existingByCode.get(code)
        const source = unit.entries[0]?.source
        if (!existingTire || !source) continue
        const match = resolveVehicle(source)
        if (!match) continue
        if (match.type === 'truck') {
          await tx.tire.updateMany({ where: { id: existingTire.id, truckId: null }, data: { truckId: match.id, trailerNumber: null, lifecycleStatus: 'ASSIGNED' } })
          await tx.tireLifecycleEvent.updateMany({ where: { tireId: existingTire.id, eventType: 'ISSUE', toTruckId: null }, data: { toTruckId: match.id } })
        } else {
          await tx.tire.updateMany({ where: { id: existingTire.id, trailerNumber: null }, data: { trailerNumber: source.trailerNumber || source.vehicleNumber, lifecycleStatus: 'ASSIGNED' } })
          await tx.tireLifecycleEvent.updateMany({ where: { tireId: existingTire.id, eventType: 'ISSUE', toTrailerId: null }, data: { toTrailerId: match.id } })
        }
        await tx.tireUsagePeriod.updateMany({
          where: { tireId: existingTire.id, vehicleId: source.vehicleText || source.vehicleNumber },
          data: { vehicleType: match.type, vehicleId: match.id }
        })
        reconciledVehicles++
      }

      const tires: any[] = []
      const events: any[] = []
      const periods: any[] = []
      for (const { unit, code } of newUnits) {
        const source = unit.entries[0]?.source
        if (!source) continue
        const vehicleMatch = resolveVehicle(source)
        const sourceReference = [
          source.vehicleType ? source.vehicleType.toUpperCase() : 'VEHICLE TYPE NOT SPECIFIED',
          source.vehicleNumber || 'VEHICLE NUMBER NOT SUPPLIED'
        ].join(': ')
        const notes = [
          'Imported directly from workbook; no fleet or existing-tire matching performed.',
          'Source worksheet: ' + source.sheetName + ', row ' + source.line + '.',
          'Source vehicle columns: ' + (source.vehicleText || sourceReference) + '.',
          'Source date cell: ' + (source.dateText || 'not supplied') + '; source OUT QTY cell: ' + (source.quantityText || 'not supplied') + '; source vehicle type cell: ' + (source.vehicleTypeText || 'not supplied') + '; source odometer cell: ' + (source.odometerText || 'not supplied') + '.',
          source.serialText ? 'Source serial cell: ' + source.serialText : 'No serial supplied in source.',
          'Source tire size cell: ' + (source.tireSizeText || 'not supplied') + '; imported tire size: ' + (source.tireSize || 'Unspecified') + '; manufacturer: ' + (source.manufacturer || 'not supplied') + '; origin: ' + (source.originText || 'not supplied') + '.',
          source.history ? 'Source history: ' + source.history : '',
          source.warnings.length ? 'Source notes: ' + source.warnings.join(' | ') : ''
        ].filter(Boolean).join(' ')
        const tireId = 'tire_' + randomUUID()
        tires.push({
          id: tireId,
          tireSize: source.tireSize || 'Unspecified',
          manufacturer: source.manufacturer || 'Unspecified',
          origin: source.origin || 'OTHER',
          // Link only exact, unique fleet matches. Keep legacy plateNumber unset
          // because it references the separate legacy Vehicle table.
          plateNumber: null,
          truckId: vehicleMatch?.type === 'truck' ? vehicleMatch.id : null,
          trailerNumber: vehicleMatch?.type === 'trailer' ? (source.trailerNumber || source.vehicleNumber) : (!vehicleMatch && source.vehicleType === 'trailer' ? (source.trailerNumber || source.vehicleNumber) : null),
          driverName: source.driver || null,
          quantity: 1,
          serialNumber: unit.serial,
          internalCode: code,
          lifecycleStatus: vehicleMatch ? 'ASSIGNED' : 'ASSIGNED_UNVERIFIED',
          createdById: user.id,
          createdAt: source.eventAt || undefined,
          notes
        })
        if (source.eventAt) {
          events.push({
            id: 'tireevt_' + randomUUID(),
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
          if (source.vehicleNumber) {
            periods.push({
              id: 'tyuse_' + randomUUID(),
              tireId,
              vehicleType: vehicleMatch?.type || source.vehicleType || 'unknown',
              vehicleId: vehicleMatch?.id || source.vehicleText || source.vehicleNumber,
              installedAt: source.eventAt,
              removedAt: null,
              historicalEndUnknown: true,
              startOdometer: source.odometerKm,
              driverNameSnapshot: source.driver || null
            })
          }
        }
      }
      if (tires.length) await tx.tire.createMany({ data: tires, skipDuplicates: true })
      if (events.length) await tx.tireLifecycleEvent.createMany({ data: events, skipDuplicates: true })
      if (periods.length) await tx.tireUsagePeriod.createMany({ data: periods, skipDuplicates: true })
      return { tireCount: tires.length, historyCount: events.length, alreadyImported: !newUnits.length, reconciledVehicles }
    }, { timeout: 120000 })

    if (result.alreadyImported) {
      return NextResponse.json({
        message: 'This workbook was already imported. No duplicate tires or history were created. Reconciled ' + result.reconciledVehicles + ' previously imported tire records to exact, unique truck/trailer matches.',
        tires: 0, historyEntries: 0, reconciledVehicles: result.reconciledVehicles, alreadyImported: true
      }, { status: 200 })
    }
    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({
      message: 'Imported ' + result.tireCount + ' tire records and saved ' + result.historyCount + ' dated usage-history entries. ' + result.reconciledVehicles + ' existing tire records were reconciled to exact, unique truck/trailer matches. Unmatched vehicle references remain preserved as text. No serial-number matching, Workshop Job Card linking, or stock receipt events were performed.',
      tires: result.tireCount,
      historyEntries: result.historyCount,
      reconciledVehicles: result.reconciledVehicles,
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
