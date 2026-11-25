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
type FleetVehicle = {
  id: string
  type: VehicleType
  number: string
  driverName: string | null
  active: boolean
}
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

  const unique = Array.from(new Map(found.map(serial => [serial.toLowerCase(), serial])).values())
  const residue = cleaned.replace(/[A-Z0-9]+(?:[._][A-Z0-9]+)*/gi, ' ').replace(/[^a-z]/gi, ' ').trim()
  const mixedText = Boolean(residue)
  // Quantity is deliberately not used to discard candidates. It is checked
  // separately by the analyzer, which flags rows whose serial count conflicts
  // with OUT QTY while preserving the extracted source identifiers for review.
  void expectedQuantity
  return { serials: unique, mixedText }
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

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function makeImportCode(key: string): string {
  return 'UP-AI-' + fingerprint(key).slice(0, 20).toUpperCase()
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

function normalizeVehicleText(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function vehicleMatches(type: VehicleType, number: string, fleet: FleetVehicle[]): FleetVehicle[] {
  const normalized = normalizeVehicleText(number)
  if (!normalized) return []
  const matches = fleet.filter(vehicle => {
    if (vehicle.type !== type) return false
    const vehicleNumber = normalizeVehicleText(vehicle.number)
    const vehicleWords = vehicle.number.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean)
    // Historical sheets often contain only the fleet number (1234), while
    // the registered truck plate is stored as 1234 BAA.
    return vehicleNumber === normalized || vehicleWords.includes(normalized)
  })
  // If a current and historical record share a fleet number, prefer the
  // current record. Otherwise retain the historical match for old usage rows.
  const activeMatches = matches.filter(vehicle => vehicle.active)
  return activeMatches.length ? activeMatches : matches
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

function resolveVehicle(number: string, preferredType: VehicleType | null, fleet: FleetVehicle[]): FleetVehicle[] {
  const direct = preferredType
    ? vehicleMatches(preferredType, number, fleet)
    : [...vehicleMatches('truck', number, fleet), ...vehicleMatches('trailer', number, fleet)]
  if (direct.length) return direct

  // Historical rows sometimes store a truck/trailer pair in one cell (e.g. 1330-507).
  // The worksheet tire category selects which side to resolve.
  const tokens = number.split(/[\s,;\-–—/|]+/).map(value => value.trim()).filter(value => value.length >= 2)
  if (!tokens.length) return []
  const expanded = tokens.flatMap(token => preferredType
    ? vehicleMatches(preferredType, token, fleet)
    : [...vehicleMatches('truck', token, fleet), ...vehicleMatches('trailer', token, fleet)])
  return Array.from(new Map(expanded.map(vehicle => [vehicle.type + ':' + vehicle.id, vehicle])).values())
}


async function getOrCreateHistoricalJobCard(tx: any, vehicle: {
  vehicleType: VehicleType
  vehicleId: string
}, details: {
  eventAt: Date
  odometerKm: number | null
  driverName: string | null
  userId: string
}) {
  const start = new Date(Date.UTC(details.eventAt.getUTCFullYear(), details.eventAt.getUTCMonth(), details.eventAt.getUTCDate()))
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  const vehicleWhere = vehicle.vehicleType === 'truck'
    ? { truckId: vehicle.vehicleId }
    : { trailerId: vehicle.vehicleId }

  // Historical spreadsheet events belong to their historical workshop visit,
  // not to whichever job card happens to be open today.
  await tx.$executeRawUnsafe('LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE')
  const existing = await tx.workshopJobCard.findFirst({
    where: { ...vehicleWhere, serviceDate: { gte: start, lt: end } },
    orderBy: [{ serviceDate: 'asc' }, { createdAt: 'asc' }],
    select: { id: true }
  })
  if (existing) return existing.id

  const year = details.eventAt.getUTCFullYear()
  const prefix = `JC-${year}-`
  const numbers = await tx.workshopJobCard.findMany({
    where: { jobNumber: { startsWith: prefix } },
    select: { jobNumber: true }
  })
  const highest = numbers.reduce((max: number, item: { jobNumber: string }) => {
    const match = item.jobNumber.match(/^JC-\d{4}-(\d+)$/)
    return match ? Math.max(max, Number(match[1]) || 0) : max
  }, 0)
  // The table lock serializes historical-card creation. The regex above
  // must parse existing numeric suffixes so the next value never restarts at 0001.
  let sequence = highest + 1
  let jobNumber = `${prefix}${String(sequence).padStart(4, '0')}`
  while (await tx.workshopJobCard.findUnique({ where: { jobNumber }, select: { id: true } })) {
    sequence++
    jobNumber = `${prefix}${String(sequence).padStart(4, '0')}`
  }
  const id = `jc_${randomUUID()}`
  await tx.workshopJobCard.create({
    data: {
      id,
      jobNumber,
      ...vehicleWhere,
      serviceDate: details.eventAt,
      odometerKm: details.odometerKm ?? undefined,
      serviceType: 'TIRE USAGE HISTORY',
      creationSource: 'TIRE',
      priority: 'NORMAL',
      driverName: details.driverName || undefined,
      status: 'CLOSED',
      reportedIssue: 'Historical tire usage imported from spreadsheet',
      notes: 'Closed historical visit created by the tire usage-history importer.',
      createdById: details.userId,
      items: [],
      checklist: {}
    }
  })
  return id
}

async function analyzeWorkbook(workbook: ExcelJS.Workbook) {
  const [trucks, trailers] = await Promise.all([
    // Include inactive and soft-deleted records for historical matching only.
    // This does not reactivate them or make them selectable in normal fleet UI.
    db.truck.findMany({
      select: { id: true, licensePlate: true, driverName: true, status: true, isDeleted: true }
    }),
    db.trailer.findMany({
      select: { id: true, number: true, driverName: true, status: true, isDeleted: true }
    })
  ])
  const fleet: FleetVehicle[] = [
    ...trucks.map(item => ({ id: item.id, type: 'truck' as const, number: item.licensePlate, driverName: item.driverName, active: !item.isDeleted && item.status !== 'INACTIVE' })),
    ...trailers.map(item => ({ id: item.id, type: 'trailer' as const, number: item.number, driverName: item.driverName, active: !item.isDeleted && item.status !== 'INACTIVE' }))
  ]

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
      if (truckNumber && trailerNumber && vehicleType) {
        vehicleNumber = vehicleType === 'truck' ? truckNumber : trailerNumber
      }
      const driver = read(columns.driver)
      const qtyText = read(columns.quantity)
      const parsedQty = qtyText ? Number(qtyText.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/)?.[0]) : NaN
      const expectedQuantity = qtyText && Number.isInteger(parsedQty) && parsedQty > 0 && parsedQty <= 100 ? parsedQty : 0
      const serialParts = columns.serials.map(column => read(column)).filter(Boolean)
      const serialText = serialParts.join(', ')
      const history = read(columns.history)
      const parsedSerials = parseSerials(serialText, expectedQuantity)

      // Keep a row with missing/invalid OUT QTY only when it still has enough
      // credible usage context to be reviewed. This excludes notes, opening
      // balance fragments, copied dates/numbers, and broken formula debris.
      const plausibleDate = Boolean(date && date.getUTCFullYear() >= 2000 && date.getUTCFullYear() <= 2100)
      const vehicleText = vehicleNumber.trim()
      const looksLikeDate = /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(vehicleText) ||
        /^\d{4}-\d{1,2}-\d{1,2}$/.test(vehicleText)
      const plausibleVehicle = Boolean(vehicleText && !/^(new|opening balance|total|balance)$/i.test(vehicleText) && !looksLikeDate)
      const hasUsageContext = plausibleDate && plausibleVehicle &&
        Boolean(driver || parsedSerials.serials.length || history)
      const hasReviewContext = (plausibleDate && (expectedQuantity > 0 ||
        (plausibleVehicle && Boolean(driver || parsedSerials.serials.length || history)))) ||
        (plausibleVehicle && Boolean(driver || parsedSerials.serials.length || history))
      // A numeric OUT QTY copied into blank-date rows is commonly a carried-down
      // balance/formula artifact, not an issue transaction. Only dated rows
      // contribute to the source OUT QTY total and create importable tire units.
      if (!hasReviewContext) continue

      // OUT QTY is the sole source of truth for how many physical tire records exist.
      // Serial identifiers describe those records; they must never increase the count.
      const quantity = qtyText ? parsedQty : 0
      const size = read(columns.size) || sheetMetadata.tireSize
      const manufacturer = read(columns.manufacturer)
      const origin = read(columns.origin) || sheetMetadata.origin
      const odometerText = read(columns.odometer)
      const odometerValue = odometerText ? Number(odometerText.replace(/,/g, '').match(/\d+/)?.[0]) : NaN
      const errors: string[] = []
      const warnings: string[] = []

      if (!date) errors.push('A valid usage date was not detected.')
      if (!vehicleNumber) errors.push('A truck or trailer number was not detected.')
      if (truckNumber && trailerNumber && !vehicleType) errors.push('Both truck and trailer are filled in and the sheet does not identify which vehicle owns this tire. Add Vehicle Type or use a dedicated truck or trailer sheet.')
      if (genericNumber && !truckNumber && !trailerNumber && typeText && !vehicleType) errors.push('Vehicle Type must identify Truck or Trailer.')
      if (qtyText && !plausibleDate) errors.push('A valid usage date is required before OUT QTY can be counted.')
      if (qtyText && (!Number.isInteger(quantity) || quantity < 1 || quantity > 100)) errors.push('Quantity must be a whole number from 1 to 100.')
      if (parsedSerials.serials.length > 100) errors.push('More than 100 serial numbers were detected in one row.')
      if (parsedSerials.mixedText) warnings.push('The serial cell contains mixed text; check the extracted tire identifier in the preview.')
      if (!qtyText) errors.push('OUT QTY is required. The importer will not assume a tire quantity.')
      if (parsedSerials.serials.length > quantity && quantity > 0) {
        errors.push('More serial numbers were detected than OUT QTY. Correct the row so serial identifiers do not exceed the stated tire quantity.')
      }
      if (quantity > parsedSerials.serials.length && quantity > 0) {
        warnings.push('OUT QTY is ' + quantity + ' but only ' + parsedSerials.serials.length + ' serial number(s) were identified. The remaining tire record(s) will have no serial number.')
      }
      if (!serialText) warnings.push('No serial number was supplied; tire records will be created only according to OUT QTY and remain without serial identifiers.')
      if (!size) warnings.push('Tire size was not found in the row or worksheet name; the preview will use Unspecified.')
      if (!manufacturer) warnings.push('Manufacturer was not found; the preview will use Unspecified.')
      if (!origin) warnings.push('Origin was not found in the row or worksheet name; the preview will use OTHER.')
      if (!driver) warnings.push('Driver was not found in the sheet; the active fleet driver will be used when available.')
      if (odometerText && (!Number.isInteger(odometerValue) || odometerValue < 0)) warnings.push('Odometer value could not be interpreted and will be left empty.')

      const entry: SourceEntry = {
        sheetName: sheet.name, line, eventAt: date, vehicleType, vehicleNumber, vehicleId: null,
        vehicleLabel: vehicleNumber, driver, serialText, serials: parsedSerials.serials,
        quantity: plausibleDate && Number.isInteger(quantity) && quantity > 0 && quantity <= 100 ? quantity : 0,
        tireSize: size, manufacturer, origin: normalizeOrigin(origin), history,
        odometerKm: Number.isInteger(odometerValue) && odometerValue >= 0 ? odometerValue : null,
        warnings, errors
      }

      if (vehicleNumber && !errors.some(value => value.startsWith('Both truck and trailer'))) {
        const matches = resolveVehicle(vehicleNumber, vehicleType, fleet)
        if (matches.length !== 1) {
          errors.push(matches.length ? 'Vehicle reference is ambiguous. The number matches more than one current or historical fleet record.' : 'Vehicle number does not match any current or retained historical truck/trailer record. If the vehicle was sold and its record was permanently deleted, keep this row for manual review.')
        } else {
          const vehicle = matches[0]
          entry.vehicleType = vehicle.type
          entry.vehicleId = vehicle.id
          entry.vehicleNumber = vehicle.number
          entry.vehicleLabel = (vehicle.type === 'truck' ? 'Truck ' : 'Trailer ') + vehicle.number + (vehicle.active ? '' : ' (historical / inactive)')
          if (!entry.driver) entry.driver = vehicle.driverName || ''
        }
      }
      if (vehicleType && !vehicleNumber) entry.errors.push('A vehicle number is required for the selected vehicle type.')
      sourceEntries.push(entry)
    }
  }

  if (!sheetNames.length) {
    sheetErrors.push('No recognizable usage-history table was found. The sheet needs a date column and a truck/trailer or vehicle column, plus a serial, quantity, or driver column.')
  }
  if (sourceEntries.length > 5000) sheetErrors.push('The workbook contains more than 5,000 data rows. Split it into smaller files before importing.')
  if (sheetErrors.length) throw new Error(sheetErrors.join(' '))

  const unitsByKey = new Map<string, ImportUnit>()
  const exactDuplicateRows = 0

  // OUT QTY controls usage occurrences. Rows without a valid quantity remain
  // review-only rows; they must never inflate the physical tire count.
  for (const source of sourceEntries) {
    if (source.quantity <= 0) continue

    for (let index = 0; index < source.quantity; index++) {
      const serial = source.serials[index] || null
      // A known serial identifies one physical tire across the entire workbook.
      // Unnumbered units cannot be matched safely, so each quantity slot remains
      // a separate candidate tied to its source row.
      const key = serial
        ? 'serial:' + serial.toLowerCase()
        : 'row:' + source.sheetName + ':' + source.line + ':' + String(index + 1)
      let unit = unitsByKey.get(key)
      if (!unit) {
        unit = {
          key, serial, importCode: makeImportCode(key), entries: [], warnings: [], errors: [],
          tireSize: 'Unspecified', manufacturer: 'Unspecified', origin: 'OTHER',
          status: 'READY', duplicateReason: null
        }
        unitsByKey.set(key, unit)
      }

      // Preserve every source OUT QTY occurrence, including identical-looking
      // rows. The workbook is the historical source of truth; do not silently
      // discard usage history. Repeated serials still remain one physical tire.
      unit.entries.push({ source, serial })
      unit.warnings.push(...source.warnings)
      unit.errors.push(...source.errors)
    }
  }

  const units = Array.from(unitsByKey.values())
  const sourceQuantityTotal = sourceEntries.reduce((sum, source) => sum + (source.quantity > 0 ? source.quantity : 0), 0)
  const serialOccurrenceCounts = new Map<string, number>()
  for (const source of sourceEntries) {
    if (source.quantity <= 0) continue
    for (const serial of source.serials.slice(0, source.quantity)) {
      const serialKey = serial.toLowerCase()
      serialOccurrenceCounts.set(serialKey, (serialOccurrenceCounts.get(serialKey) || 0) + 1)
    }
  }
  const serialUsageOccurrences = Array.from(serialOccurrenceCounts.values()).reduce((sum, count) => sum + count, 0)
  const uniqueSerialTires = serialOccurrenceCounts.size
  const unnumberedQuantitySlots = sourceEntries.reduce((sum, source) =>
    sum + Math.max(0, (source.quantity > 0 ? source.quantity : 0) - Math.min(source.serials.length, source.quantity > 0 ? source.quantity : 0)), 0)
  const unnumberedTireCandidates = units.filter(unit => !unit.serial).length
  const repeatedSerialUsageOccurrences = Math.max(0, serialUsageOccurrences - uniqueSerialTires)
  const repeatedSerialGroups = Array.from(serialOccurrenceCounts.values()).filter(count => count > 1).length
  const unquantifiedRows = sourceEntries.filter(source => source.quantity <= 0).length

  for (const unit of units) {
    unit.entries.sort((a, b) => (a.source.eventAt?.getTime() || 0) - (b.source.eventAt?.getTime() || 0) || a.source.line - b.source.line)
    if (unit.entries.length) unit.warnings.push("The final historical usage period has no recorded removal date. It will be saved with an unknown end date and will not be treated as a current installation.")
    const sizes = Array.from(new Set(unit.entries.map(item => item.source.tireSize).filter(Boolean)))
    const manufacturers = Array.from(new Set(unit.entries.map(item => item.source.manufacturer).filter(Boolean)))
    const origins = Array.from(new Set(unit.entries.map(item => item.source.origin).filter(value => value && value !== 'OTHER')))
    unit.tireSize = sizes[0] || 'Unspecified'
    unit.manufacturer = manufacturers[0] || 'Unspecified'
    unit.origin = origins[0] || 'OTHER'
    if (sizes.length > 1) {
      unit.tireSize = 'Unspecified'
      unit.warnings.push('Conflicting tire sizes were found for this serial. The tire is blocked until the correct size is reviewed.')
      unit.errors.push('Conflicting tire sizes require manual review.')
    }
    if (manufacturers.length > 1) {
      unit.manufacturer = 'Unspecified'
      unit.warnings.push('Conflicting manufacturers were found for this serial. The tire is blocked until the correct manufacturer is reviewed.')
      unit.errors.push('Conflicting manufacturers require manual review.')
    }
    if (origins.length > 1) {
      unit.origin = 'OTHER'
      unit.warnings.push('Conflicting origins were found for this serial. The tire is blocked until the correct origin is reviewed.')
      unit.errors.push('Conflicting origins require manual review.')
    }
    if (unit.errors.length) unit.status = 'BLOCKED'
  }

  const serials = Array.from(new Set(units.map(unit => unit.serial).filter((value): value is string => Boolean(value))))
  const importCodes = units.map(unit => unit.importCode)
  const [existingSerials, existingCodes] = await Promise.all([
    serials.length ? db.tire.findMany({
      where: { deletedAt: null, serialNumber: { in: serials, mode: 'insensitive' } },
      select: { serialNumber: true }, take: 5000
    }) : Promise.resolve([]),
    importCodes.length ? db.tire.findMany({
      where: { internalCode: { in: importCodes } },
      select: { internalCode: true }, take: 5000
    }) : Promise.resolve([])
  ])
  const existingSerialSet = new Set(existingSerials.map(item => (item.serialNumber || '').toLowerCase()))
  const existingCodeSet = new Set(existingCodes.map(item => item.internalCode).filter(Boolean))
  for (const unit of units) {
    if (unit.status !== 'BLOCKED' && unit.serial && existingSerialSet.has(unit.serial.toLowerCase())) {
      unit.status = 'DUPLICATE'
      unit.duplicateReason = 'Serial number already exists in Tire Management.'
    } else if (unit.status !== 'BLOCKED' && existingCodeSet.has(unit.importCode)) {
      unit.status = 'DUPLICATE'
      unit.duplicateReason = 'This exact row or serial was already imported.'
    }
  }

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
  // All non-duplicate candidates can be imported. Review flags remain attached
  // to the tire; unresolved vehicle rows are retained as source notes rather
  // than being assigned to a guessed truck or trailer.
  const ready = units.filter(unit => unit.status !== 'DUPLICATE')
  const blocked = units.filter(unit => unit.status === 'BLOCKED')
  const duplicates = units.filter(unit => unit.status === 'DUPLICATE')
  const warningCount = units.reduce((count, unit) => count + new Set(unit.warnings).size, 0)
  return {
    sheetNames, sourceRows: sourceEntries.length, exactDuplicateRows,
    sourceQuantityTotal, serialUsageOccurrences, uniqueSerialTires, repeatedSerialUsageOccurrences,
    unnumberedQuantitySlots, unnumberedTireCandidates, unquantifiedRows,
    totalTires: units.length, historyEntries: units.reduce((count, unit) => count + unit.entries.length, 0),
    repeatedSerials: repeatedSerialGroups,
    importableTires: ready.length, duplicateTires: duplicates.length, blockedTires: blocked.length,
    warningCount, preview, units, ready
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'tire-management', 'read')
    const [trucks, trailers] = await Promise.all([
      db.truck.findMany({
        where: { isDeleted: false, status: { not: 'INACTIVE' } },
        select: { licensePlate: true, driverName: true, make: true, model: true, year: true },
        orderBy: { licensePlate: 'asc' }
      }),
      db.trailer.findMany({
        where: { isDeleted: false, status: { not: 'INACTIVE' } },
        select: { number: true, driverName: true },
        orderBy: { number: 'asc' }
      })
    ])
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
          importableUsageEntries: analysis.ready.reduce((count, unit) => count + unit.entries.length, 0),
          existingDuplicates: analysis.duplicateTires,
          blockedTires: analysis.blockedTires,
          warnings: analysis.warningCount
        },
        preview: analysis.preview,
        previewLimit: 150,
        previewTruncated: analysis.totalTires > 150
      })
    }

    if (!analysis.ready.length) {
      return NextResponse.json({ error: 'There are no non-duplicate tire candidates to import.' }, { status: 400 })
    }

    const result = await db.$transaction(async tx => {
      await ensureTireLifecycleTables(tx)
      const serials = analysis.ready.map(unit => unit.serial).filter((value): value is string => Boolean(value))
      const codes = analysis.ready.map(unit => unit.importCode)
      const [serialConflicts, codeConflicts] = await Promise.all([
        serials.length ? tx.tire.findMany({
          where: { deletedAt: null, serialNumber: { in: serials, mode: 'insensitive' } },
          select: { serialNumber: true }, take: 5000
        }) : Promise.resolve([]),
        codes.length ? tx.tire.findMany({
          where: { internalCode: { in: codes } },
          select: { internalCode: true }, take: 5000
        }) : Promise.resolve([])
      ])
      if (serialConflicts.length || codeConflicts.length) {
        throw new Error('New duplicate records were detected after the preview. Analyze the file again before importing.')
      }

      let tireCount = 0
      let historyCount = 0
      const jobCards = new Set<string>()
      const jobCardCache = new Map<string, string>()
      // Tire.plateNumber is a legacy relation to the separate vehicles table.
      // Fleet imports resolve against trucks/trailers, so only populate this
      // optional legacy FK when that exact plate is registered there.
      const registeredVehiclePlates = new Set(
        (await tx.vehicle.findMany({ select: { plateNumber: true } })).map((vehicle: { plateNumber: string }) => vehicle.plateNumber)
      )

      for (const unit of analysis.ready) {
        const sourceEntries = unit.entries.map(item => item.source)
        const entries = unit.entries.filter(item => item.source.eventAt && item.source.vehicleType && item.source.vehicleId)
        const first = entries[0]?.source || sourceEntries[0]
        if (!first) continue
        const latest = entries[entries.length - 1]?.source || first
        const latestType = latest.vehicleType as VehicleType
        const latestVehicle = latest.vehicleId as string
        const latestTruck = latestType === 'truck'
          ? trucksFromEntry(latest.vehicleNumber, latestType, latestVehicle)
          : null
        const latestTrailer = latestType === 'trailer'
          ? latest.vehicleNumber
          : null
        const combinedNotes = Array.from(new Set(sourceEntries.map(source => source.history).filter(Boolean)))
        const warnings = Array.from(new Set([...unit.warnings, ...unit.errors]))
        const unresolvedSourceRows = sourceEntries.filter(source => !source.eventAt || !source.vehicleType || !source.vehicleId).map(source =>
          `${source.sheetName} row ${source.line}: date=${source.eventAt?.toISOString() || 'missing'}, vehicle=${source.vehicleType || 'unresolved'} ${source.vehicleNumber || 'missing'}, driver=${source.driver || 'unspecified'}, serial=${source.serialText || source.serials.join(', ') || 'unspecified'}, qty=${source.quantity}, history=${source.history || 'none'}`
        )
        const tire = await tx.tire.create({
          data: {
            tireSize: unit.tireSize,
            manufacturer: unit.manufacturer,
            origin: unit.origin,
            plateNumber: latestTruck && registeredVehiclePlates.has(latestTruck) ? latestTruck : null,
            truckId: entries.length && latestType === 'truck' ? latestVehicle : null,
            trailerNumber: entries.length ? latestTrailer : null,
            driverName: latest.driver || null,
            quantity: 1,
            serialNumber: unit.serial,
            internalCode: unit.importCode,
            lifecycleStatus: entries.length ? 'ASSIGNED_UNVERIFIED' : 'STOCK',
            createdById: user.id,
            ...(first.eventAt ? { createdAt: first.eventAt } : {}),
            notes: [
              'Imported from historical tire usage spreadsheet.',
              combinedNotes.length ? 'Source history: ' + combinedNotes.join(' | ') : '',
              unresolvedSourceRows.length ? 'Unlinked source rows (manual vehicle review required): ' + unresolvedSourceRows.join(' || ') : '',
              warnings.length ? 'Import review required: ' + warnings.join(' | ') : ''
            ].filter(Boolean).join(' ')
          },
          select: { id: true }
        })

        let previousVehicle: { type: VehicleType; id: string } | null = null
        for (let index = 0; index < entries.length; index++) {
          const item = entries[index]
          const entry = item.source
          const vehicleType = entry.vehicleType as VehicleType
          const vehicleId = entry.vehicleId as string
          const vehicleKey = vehicleType + ':' + vehicleId
          const eventDateKey = (entry.eventAt as Date).toISOString().slice(0, 10)
          const historicalCardKey = vehicleKey + ':' + eventDateKey
          let jobCardId = jobCardCache.get(historicalCardKey)
          if (!jobCardId) {
            const createdJobCardId = await getOrCreateHistoricalJobCard(tx, {
              vehicleType, vehicleId
            }, {
              eventAt: entry.eventAt as Date,
              odometerKm: entry.odometerKm,
              driverName: entry.driver || null,
              userId: user.id
            })
            if (!createdJobCardId) throw new Error('Could not create or locate a historical Job Card for an imported tire usage row.')
            jobCardId = createdJobCardId
            jobCardCache.set(historicalCardKey, createdJobCardId)
          }
          if (!jobCardId) throw new Error('Could not resolve a Job Card for the imported tire usage row.')
          jobCards.add(jobCardId)
          const notes = [
            'Imported from ' + entry.sheetName + ', row ' + entry.line + '.',
            entry.history ? 'Source history: ' + entry.history : '',
            entry.serialText ? 'Source serial cell: ' + entry.serialText : ''
          ].filter(Boolean).join(' ')
          await tx.tireLifecycleEvent.create({
            data: {
              id: 'tireevt_' + randomUUID(),
              tireId: tire.id,
              eventType: 'ISSUE',
              eventAt: entry.eventAt as Date,
              fromTruckId: previousVehicle?.type === 'truck' ? previousVehicle.id : null,
              fromTrailerId: previousVehicle?.type === 'trailer' ? previousVehicle.id : null,
              toTruckId: vehicleType === 'truck' ? vehicleId : null,
              toTrailerId: vehicleType === 'trailer' ? vehicleId : null,
              driverNameSnapshot: entry.driver || null,
              odometerKm: entry.odometerKm,
              reason: 'Historical tire usage import',
              notes,
              jobCardId,
              createdById: user.id
            }
          })
          const next = entries[index + 1]?.source
          await tx.$executeRawUnsafe(
            'INSERT INTO "tire_usage_periods" ("id","tireId","vehicleType","vehicleId","installedAt","removedAt","historicalEndUnknown","startOdometer","driverNameSnapshot") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
            'tyuse_' + randomUUID(), tire.id, vehicleType, vehicleId, entry.eventAt,
            next?.eventAt || null, !next, entry.odometerKm, entry.driver || null
          )
          previousVehicle = { type: vehicleType, id: vehicleId }
          historyCount++
        }
        tireCount++
      }

      return { tireCount, historyCount, jobCardCount: jobCards.size }
    }, { timeout: 120000 })

    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({
      message: 'Imported ' + result.tireCount + ' individual tire records with ' + result.historyCount + ' linked historical usage entries across ' + result.jobCardCount + ' workshop job card(s). Existing database duplicates were skipped. Review-flagged candidates were retained; source rows without a verified vehicle remain unassigned and are recorded in tire notes.',
      tires: result.tireCount,
      historyEntries: result.historyCount,
      jobCards: result.jobCardCount,
      skippedDuplicates: analysis.duplicateTires,
      blockedTires: analysis.blockedTires,
      reviewRequiredTires: analysis.blockedTires,
      unlinkedSourceRows: analysis.units.reduce((count, unit) => count + unit.entries.filter(item => !item.source.eventAt || !item.source.vehicleType || !item.source.vehicleId).length, 0)
    }, { status: 201 })
  } catch (error) {
    console.error('Bulk tire usage import failed:', error)
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401
      : message === 'Insufficient permissions' ? 403
        : message.startsWith('New duplicate records') ? 409 : 500
    return NextResponse.json({
      error: status === 401 ? 'Authentication required'
        : status === 403 ? 'Access denied'
          : message || 'Could not analyze or import the tire usage sheet.'
    }, { status })
  }
}

function trucksFromEntry(vehicleNumber: string, type: VehicleType, vehicleId: string): string | null {
  return type === 'truck' ? vehicleNumber : null
}
