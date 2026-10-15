import { createHash } from 'crypto'
import { Workbook } from 'exceljs'
import { db } from '@/lib/db'
import { createFleetWorkbook, downloadOneDriveWorkbook, getFleetRecordVersion } from '@/lib/onedrive-excel-sync'

type WorkbookEntity = 'TRUCK' | 'TRAILER' | 'MAINTENANCE' | 'OIL_CHANGE' | 'TIRE' | 'JOBCARD'
type SheetSpec = { sheet: string; entityType: WorkbookEntity; naturalKeys: string[][] }
type WorkbookRow = Record<string, unknown>
const IGNORED_COLUMNS = new Set(['Record ID', 'Maintenance ID', 'Last Updated', 'App Baseline'])

const SHEETS: SheetSpec[] = [
  { sheet: 'Trucks', entityType: 'TRUCK', naturalKeys: [['VIN'], ['Truck Number']] },
  { sheet: 'Trailers', entityType: 'TRAILER', naturalKeys: [['Trailer Number']] },
  { sheet: 'Maintenance', entityType: 'MAINTENANCE', naturalKeys: [['Asset Type', 'Truck / Trailer', 'Service Date', 'Service Type'], ['Asset Type', 'Truck / Trailer', 'Service Date']] },
  { sheet: 'Oil Changes', entityType: 'OIL_CHANGE', naturalKeys: [['Truck Number', 'Service Date', 'Mileage (km)'], ['Truck Number', 'Service Date']] },
  { sheet: 'Tires', entityType: 'TIRE', naturalKeys: [['Serial Number', 'Tire Size'], ['Tire Size', 'Truck Number', 'Trailer Number', 'Date']] },
  { sheet: 'Job Cards', entityType: 'JOBCARD', naturalKeys: [['Job Number']] }
]

function normalizeCell(value: unknown): unknown {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object') {
    const cell = value as { text?: string; result?: unknown; richText?: { text: string }[]; formula?: string }
    if (Array.isArray(cell.richText)) return cell.richText.map(part => part.text).join('')
    if ('result' in cell) return normalizeCell(cell.result)
    if (typeof cell.text === 'string') return cell.text
    if ('formula' in cell) return ''
    return JSON.stringify(value)
  }
  return typeof value === 'string' ? value : value
}

function readSheetRows(workbook: Workbook, sheetName: string) {
  const sheet = workbook.getWorksheet(sheetName)
  if (!sheet) return []
  const rawHeaders = sheet.getRow(1).values as unknown[]
  const headers: string[] = (Array.isArray(rawHeaders) ? rawHeaders.slice(1) : [])
    .map((value: unknown) => String(normalizeCell(value) || '').trim())
  if (!headers.some(Boolean)) return []
  const rows: { values: WorkbookRow; index: number }[] = []
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const values: WorkbookRow = {}
    headers.forEach((header: string, index: number) => {
      if (header) values[header] = normalizeCell(row.getCell(index + 1).value)
    })
    if (Object.entries(values).some(([key, value]) => !IGNORED_COLUMNS.has(key) && value !== '')) {
      rows.push({ values, index: rowNumber })
    }
  }
  return rows
}

function stableKey(row: WorkbookRow, headers: string[]) {
  return headers.map(header => {
    const value = normalizeCell(row[header])
    return typeof value === 'string' ? value.trim().toLowerCase() : String(value ?? '')
  }).join('\u001f')
}

function jsonStringify(value: unknown) {
  return JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item)
}

function isMeaningfulChange(value: unknown) {
  return value != null && (typeof value !== 'string' || Boolean(value.trim()))
}

function readBaseline(value: unknown): WorkbookRow | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('The saved row baseline is not valid JSON.')
  return parsed as WorkbookRow
}

/** Compare workbook rows to their last synced snapshots and stage edits/additions. */
export async function captureOneDriveWorkbookChanges() {
  const integration = await db.oneDriveIntegration.findUnique({ where: { id: 'primary' } })
  if (!integration?.driveItemId) throw new Error('Connect OneDrive and create the live workbook first.')

  const sourceBytes = await downloadOneDriveWorkbook()
  const sourceHash = createHash('sha256').update(sourceBytes.toString('base64')).digest('hex')
  if (sourceHash === integration.lastWorkbookHash) return { scanned: 0, queued: 0, unchanged: true }

  const currentSnapshot = await createFleetWorkbook()
  const canonicalWorkbook = new Workbook()
  const incomingWorkbook = new Workbook()
  await canonicalWorkbook.xlsx.load(currentSnapshot.bytes as any)
  await incomingWorkbook.xlsx.load(sourceBytes as any)

  const baselineReady = SHEETS.every(spec => {
    const sheet = incomingWorkbook.getWorksheet(spec.sheet)
    const headers = sheet?.getRow(1).values as unknown[] | undefined
    return Array.isArray(headers) && headers.slice(1).some(value => String(normalizeCell(value) || '').trim() === 'App Baseline')
  })
  if (!baselineReady) {
    return { scanned: 0, queued: 0, unchanged: false, baselineInitializationNeeded: true }
  }

  let scanned = 0
  let queued = 0
  for (const spec of SHEETS) {
    const canonicalRows = readSheetRows(canonicalWorkbook, spec.sheet)
    const canonicalById = new Map<string, WorkbookRow>()
    for (const row of canonicalRows) {
      const id = String(row.values['Record ID'] || '').trim()
      if (id) canonicalById.set(id, row.values)
    }

    const canonicalByNaturalKey = new Map<string, WorkbookRow[]>()
    for (const keyFields of spec.naturalKeys) {
      for (const row of canonicalRows) {
        if (keyFields.some(field => !isMeaningfulChange(row.values[field]))) continue
        const key = `${keyFields.join('|')}:${stableKey(row.values, keyFields)}`
        canonicalByNaturalKey.set(key, [...(canonicalByNaturalKey.get(key) || []), row.values])
      }
    }

    const incomingRows = readSheetRows(incomingWorkbook, spec.sheet)
    const incomingIdCounts = new Map<string, number>()
    for (const incoming of incomingRows) {
      let id = String(incoming.values['Record ID'] || '').trim()
      if (!id) {
        try { id = String(readBaseline(incoming.values['App Baseline'])?.['Record ID'] || '').trim() }
        catch { /* The row will be marked as a conflict during its own review. */ }
      }
      if (id) incomingIdCounts.set(id, (incomingIdCounts.get(id) || 0) + 1)
    }

    for (const incoming of incomingRows) {
      scanned++
      let rowData = { ...incoming.values }
      let baseline: WorkbookRow | null = null
      let ambiguousMatch = false
      let conflictReason: string | null = null

      try {
        baseline = readBaseline(rowData['App Baseline'])
      } catch {
        conflictReason = 'This row has an invalid saved baseline. Restore the app-generated workbook metadata before importing it.'
      }

      let recordId = String(rowData['Record ID'] || baseline?.['Record ID'] || '').trim() || null
      if (recordId && !rowData['Record ID']) rowData['Record ID'] = recordId
      if (recordId && (incomingIdCounts.get(recordId) || 0) > 1) {
        conflictReason = 'This Record ID appears more than once in the worksheet. Clear the copied row ID or remove the duplicate row.'
      }
      if (recordId && baseline && String(baseline['Record ID'] || '').trim() !== recordId) {
        conflictReason = 'The row ID does not match its saved baseline. Restore the app-generated workbook metadata before importing it.'
      }
      if (recordId && Object.prototype.hasOwnProperty.call(rowData, 'App Baseline') && !baseline) {
        conflictReason = 'This row is missing its saved baseline. Sync the workbook from the app before importing it.'
      }

      let current = recordId ? canonicalById.get(recordId) : undefined
      if (recordId && !current) {
        conflictReason = 'The record ID in this workbook no longer exists in the app. Review the row before importing it.'
      }
      let canonical = baseline || current

      if (!canonical && !recordId) {
        const candidates = new Map<string, WorkbookRow>()
        for (const keyFields of spec.naturalKeys) {
          if (keyFields.some(field => !isMeaningfulChange(rowData[field]))) continue
          const key = `${keyFields.join('|')}:${stableKey(rowData, keyFields)}`
          for (const candidate of canonicalByNaturalKey.get(key) || []) {
            const candidateId = String(candidate['Record ID'] || '').trim()
            if (candidateId) candidates.set(candidateId, candidate)
          }
        }
        if (candidates.size === 1) {
          current = [...candidates.values()][0]
          canonical = current
          recordId = String(canonical['Record ID'])
          rowData = { ...rowData, 'Record ID': recordId }
        } else if (candidates.size > 1) {
          const exactCandidates = [...candidates.values()].filter(candidate => {
            const headers = new Set([...Object.keys(candidate), ...Object.keys(rowData)])
            return [...headers].every(header =>
              !header || IGNORED_COLUMNS.has(header) ||
              jsonStringify(normalizeCell(candidate[header])) === jsonStringify(normalizeCell(rowData[header]))
            )
          })
          if (exactCandidates.length) continue
          ambiguousMatch = true
          conflictReason = 'More than one existing row could match this edit. Add a Record ID or resolve the duplicate in the app.'
        }
      }

      const changes: Record<string, { from: unknown; to: unknown }> = {}
      const conflictingFields: string[] = []
      if (canonical) {
        const headers = new Set([...Object.keys(canonical), ...Object.keys(rowData)])
        for (const header of headers) {
          if (!header || IGNORED_COLUMNS.has(header)) continue
          const before = normalizeCell(canonical[header])
          const after = normalizeCell(rowData[header])
          if (jsonStringify(before) === jsonStringify(after)) continue
          const currentValue = normalizeCell(current?.[header])
          if (current && jsonStringify(currentValue) === jsonStringify(after)) continue
          if (current && jsonStringify(currentValue) !== jsonStringify(before)) conflictingFields.push(header)
          changes[header] = { from: before, to: after }
        }
        if (!Object.keys(changes).length) continue
      } else {
        if (!Object.entries(rowData).some(([header, value]) => !IGNORED_COLUMNS.has(header) && isMeaningfulChange(value))) continue
        for (const [header, value] of Object.entries(rowData)) {
          if (header && !IGNORED_COLUMNS.has(header) && isMeaningfulChange(value)) changes[header] = { from: null, to: value }
        }
      }

      if (conflictingFields.length) {
        conflictReason = `The app and workbook changed these fields after the last sync: ${conflictingFields.join(', ')}.`
      }

      const importData = Object.fromEntries(Object.entries(rowData).filter(([header]) => !IGNORED_COLUMNS.has(header)))

      const operation = recordId ? 'UPDATE' : 'CREATE'
      const fingerprint = createHash('sha256')
        .update(`${spec.sheet}\u001f${recordId || `new:${incoming.index}`}\u001f${jsonStringify(importData)}`)
        .digest('hex')
      const baseUpdatedAt = recordId ? await getFleetRecordVersion(spec.entityType, recordId, importData) : null
      if (recordId) {
        await db.excelWorkbookChange.updateMany({
          where: { sheetName: spec.sheet, recordId, status: { in: ['PENDING', 'CONFLICT'] } },
          data: { status: 'SUPERSEDED' }
        })
      }
      await db.excelWorkbookChange.upsert({
        where: { fingerprint },
        create: {
          fingerprint,
          sheetName: spec.sheet,
          entityType: spec.entityType,
          operation,
          recordId,
          rowData: importData as any,
          changes: changes as any,
          baseUpdatedAt,
          ...(conflictReason || ambiguousMatch ? { status: 'CONFLICT', error: conflictReason || 'This workbook row needs conflict review.' } : {})
        },
        update: {
          rowData: importData as any,
          changes: changes as any,
          baseUpdatedAt,
          status: conflictReason || ambiguousMatch ? 'CONFLICT' : 'PENDING',
          error: conflictReason || (ambiguousMatch ? 'This workbook row needs conflict review.' : null),
          detectedAt: new Date(),
          appliedAt: null,
          appliedById: null
        }
      })
      queued++
    }
  }

  await db.oneDriveIntegration.update({ where: { id: 'primary' }, data: { lastWorkbookHash: sourceHash } })
  return { scanned, queued, unchanged: false }
}
