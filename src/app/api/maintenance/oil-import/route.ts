import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'crypto'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
import { ensureMaintenanceJobCardColumns, getOrCreateOpenJobCard } from '@/lib/tire-lifecycle'

export const runtime = 'nodejs'
const MAX_BYTES = 10 * 1024 * 1024
const MAX_ROWS = 5000
const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
const value = (row: Record<string, unknown>, names: string[]) => {
  const entry = Object.entries(row).find(([key]) => names.includes(norm(key)))
  return entry?.[1] ?? ''
}
function dateValue(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10)
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v)
    return d ? `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}` : null
  }
  const s = String(v ?? '').trim().replace(/N0v/ig, 'Nov').replace(/-+/g, '-')
  if (!s) return null
  const monthNames = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
  const named = s.match(/^(\d{1,2})-([a-z]{3})-(\d{4})$/i)
  if (named) {
    const month = monthNames.indexOf(named[2].toLowerCase())
    const day = Number(named[1])
    const year = Number(named[3])
    if (month >= 0 && day >= 1 && day <= 31) {
      const d = new Date(Date.UTC(year, month, day))
      if (d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day) return d.toISOString().slice(0, 10)
    }
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}
const plateKey = (v: unknown) => String(v ?? '').trim().toUpperCase().replace(/[\s-]+/g, '')
function parseFile(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  if (!wb.SheetNames[0]) throw new Error('No worksheet found in this file')
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: true })
  if (!rows.length) throw new Error('The file contains no data rows')
  if (rows.length > MAX_ROWS) throw new Error(`Maximum ${MAX_ROWS} rows per import`)
  return rows.map((r, i) => {
    const date = dateValue(value(r, ['date','dateperformed','servicedate']))
    const driver = String(value(r, ['drivernm','drivername','driver']) ?? '').trim()
    const kmText = String(value(r, ['km','mileage','odometer']) ?? '').trim()
    const km = kmText ? Number(kmText.replace(/,/g,'')) : Number.NaN
    const mileage = Number.isFinite(km) && km >= 0 ? Math.floor(km) : null
    const make = String(value(r, ['make','manufacturer']) ?? '').trim()
    const rawPlate = String(value(r, ['plateno','platenumber','licenseplate','trucknumber']) ?? '').trim()
    const oilText = String(value(r, ['litterandoiltype','literandoiltype','oiltype','oilused','oilquantity','oil']) ?? '').trim()
    const plate = rawPlate || 'Missing'
    const quantityMatch = oilText.replace(/,/g,'.').match(/^\s*(\d+(?:\.\d+)?)/)
    const quantity = quantityMatch ? Number(quantityMatch[0]) : null
    // Stable row identity: the same date + plate always maps to the same
    // record, so re-uploading an updated workbook REPLACES the previously
    // imported details instead of being rejected as a duplicate. Details that
    // may change between uploads (oil text, mileage, driver) are deliberately
    // excluded from the key.
    const importKey = 'oil-upload-v2:' + createHash('sha256').update(`${date || ''}|${plateKey(plate)}`).digest('hex')
    return { rowNumber: i + 2, date, driver: driver || null, mileage, make: make || null, plate, plateKey: plateKey(plate),
      oilText, quantity: quantity !== null && Number.isFinite(quantity) ? quantity : null, importKey, sourceData: { rowNumber: i + 2, original: r } }
  })
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireRolePermission(req, 'maintenance', 'create')
    const form = await req.formData()
    const file = form.get('file')
    const mode = String(form.get('mode') || 'preview')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a file first' }, { status: 400 })
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) return NextResponse.json({ error: 'Use an .xlsx, .xls, or .csv file' }, { status: 400 })
    if (!file.size || file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be smaller than 10 MB' }, { status: 400 })
    if (!['preview','import'].includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })

    const parsed = parseFile(Buffer.from(await file.arrayBuffer()))
    const valid = parsed.filter(r => r.date)
    const plates = [...new Set(valid.map(r => r.plateKey).filter(p => p && p !== 'MISSING'))]
    const activeTrucks = plates.length ? await db.truck.findMany({ where: { isDeleted: false, status: 'ACTIVE' }, select: { id: true, licensePlate: true } }) : []
    const byPlate = new Map<string, typeof activeTrucks>()
    for (const truck of activeTrucks) {
      const key = plateKey(String(truck.licensePlate).trim().split(/\s+/)[0])
      if (plates.includes(key)) byPlate.set(key, [...(byPlate.get(key) || []), truck])
    }
    const rows = valid.map(r => {
      const matches = r.plateKey === 'MISSING' ? [] : byPlate.get(r.plateKey) || []
      const matchStatus = r.plateKey === 'MISSING' ? 'Missing' : matches.length === 1 ? 'Matched' : matches.length > 1 ? 'Ambiguous' : 'Unmatched'
      return { ...r, truckId: matches.length === 1 ? matches[0].id : null, matchStatus }
    })
    // Re-upload = replace. Rows are matched to previously imported records by
    // a stable identity (date + plate). Matched rows UPDATE the existing
    // record with the new workbook details; rows absent from the file (for
    // plates present in the file) are removed. Legacy v1 keys (hash of the
    // full row, so any edited detail looked "new") are migrated via
    // datePerformed + vehiclePlateNumber.
    const rowKeySet = new Set(rows.map(r => r.importKey))
    const filePlates = new Set(rows.map(r => r.plateKey).filter(p => p && p !== 'MISSING'))
    const existing = await db.maintenanceRecord.findMany({
      where: { OR: [{ sourceImportKey: { in: [...rowKeySet] } }, { sourceImportKey: { startsWith: 'oil-upload-v1:' } }, { sourceImportKey: { startsWith: 'oil-upload-v2:' } }] },
      select: { id: true, sourceImportKey: true, truckId: true, jobCardId: true, vehiclePlateNumber: true, datePerformed: true }
    })
    type MatchedRecord = (typeof existing)[number]
    const matched = new Map<string, MatchedRecord>()
    const staleRecords: MatchedRecord[] = []
    for (const rec of existing) {
      let key: string | null = null
      if (rec.sourceImportKey && rowKeySet.has(rec.sourceImportKey)) key = rec.sourceImportKey
      else if (rec.sourceImportKey?.startsWith('oil-upload-v1:') && rec.datePerformed) {
        const identity = `${rec.datePerformed.toISOString().slice(0, 10)}|${plateKey(rec.vehiclePlateNumber)}`
        const candidate = 'oil-upload-v2:' + createHash('sha256').update(identity).digest('hex')
        if (rowKeySet.has(candidate) && !matched.has(candidate)) key = candidate
      }
      if (key) matched.set(key, rec)
      else if (filePlates.has(plateKey(rec.vehiclePlateNumber))) staleRecords.push(rec)
    }
    // Collapse repeated rows sharing one identity (same date + plate): the
    // last occurrence carries the newest details.
    const rowsByKey = new Map<string, typeof rows[number]>()
    for (const row of rows) rowsByKey.set(row.importKey, row)
    const freshRows = rows.filter(r => !matched.has(r.importKey))
    const updateRows = [...matched.entries()].map(([key, rec]) => ({ row: rowsByKey.get(key)!, rec })).filter(x => x.row)
    const staleIds = staleRecords.map(rec => rec.id)

    if (mode === 'preview') return NextResponse.json({
      total: parsed.length, valid: freshRows.length + updateRows.length, matched: rows.filter(r => r.matchStatus === 'Matched').length,
      unmatched: rows.filter(r => ['Unmatched','Ambiguous'].includes(r.matchStatus)).length,
      missing: rows.filter(r => r.matchStatus === 'Missing').length,
      existing: updateRows.length, removed: staleIds.length, duplicates: 0, invalid: parsed.length - valid.length,
      rows: rows.slice(0,50).map(r => ({ rowNumber: r.rowNumber, date: r.date, plate: r.plate, matchStatus: r.matchStatus, oilText: r.oilText }))
    })

    const result = await db.$transaction(async tx => {
      await ensureMaintenanceJobCardColumns(tx)
      // 1) Remove rows that were previously imported from this same workbook
      // but are no longer present in the uploaded file (scoped to plates that
      // appear in the file, so partial uploads never wipe other trucks).
      let removed = 0
      for (const rec of staleRecords) {
        await tx.maintenanceRecord.delete({ where: { id: rec.id } })
        removed++
      }
      // Unassigned oil job cards carry a per-row marker; drop the ones whose
      // record was removed so the workshop board is not left with orphans.
      for (const rec of staleRecords) {
        if (!rec.sourceImportKey || rec.truckId) continue
        const marker = `[OIL-IMPORT:${rec.sourceImportKey}]`
        const card = await tx.workshopJobCard.findFirst({ where: { truckId: null, trailerId: null, notes: { contains: marker } }, select: { id: true } })
        if (card && !(await tx.maintenanceRecord.findFirst({ where: { jobCardId: card.id }, select: { id: true } }))) {
          await tx.workshopJobCard.delete({ where: { id: card.id } })
        }
      }
      const inserted = await tx.maintenanceRecord.createMany({
        data: freshRows.map(r => ({
          truckId: r.truckId, vehiclePlateNumber: r.plate, sourceData: JSON.parse(JSON.stringify(r.sourceData)), sourceImportKey: r.importKey,
          serviceType: 'Oil Change', description: r.oilText || 'Historical oil change (oil details not provided)',
          datePerformed: new Date(`${r.date}T00:00:00.000Z`), partsCost: 0, laborCost: 0, totalCost: 0,
          status: 'COMPLETED', isOilChange: true, oilQuantityLiters: r.quantity, currentMileage: r.mileage,
          driverName: r.driver, createdById: user.id
        })),
        skipDuplicates: true
      })

      // 2) Matched rows are replaced in place with the new workbook details.
      for (const { row, rec } of updateRows) {
        const truckChanged = (rec.truckId || null) !== (row.truckId || null)
        await tx.maintenanceRecord.update({
          where: { id: rec.id },
          data: {
            truckId: row.truckId,
            vehiclePlateNumber: row.plate,
            sourceData: JSON.parse(JSON.stringify(row.sourceData)),
            sourceImportKey: row.importKey,
            description: row.oilText || 'Historical oil change (oil details not provided)',
            datePerformed: new Date(`${row.date}T00:00:00.000Z`),
            oilQuantityLiters: row.quantity,
            currentMileage: row.mileage,
            driverName: row.driver
          }
        })
        // Vehicle resolution changed: move the record onto the matching open
        // job card so the workshop board stays in sync.
        if (truckChanged && row.truckId) {
          const jobCardId = await getOrCreateOpenJobCard(tx, { vehicleType: 'truck', vehicleId: row.truckId }, {
            eventAt: new Date(`${row.date}T00:00:00.000Z`), odometerKm: row.mileage, driverName: row.driver,
            userId: user.id, creationSource: 'OIL', serviceType: 'OIL CHANGE',
            reportedIssue: row.oilText || 'Oil change imported from workbook'
          })
          await tx.maintenanceRecord.update({ where: { id: rec.id }, data: { jobCardId } })
        }
      }

      const importedRecords = await tx.maintenanceRecord.findMany({
        where: { sourceImportKey: { in: freshRows.map(r => r.importKey) } },
        select: { id: true, sourceImportKey: true, truckId: true, vehiclePlateNumber: true, datePerformed: true, driverName: true, currentMileage: true }
      })
      const freshByKey = new Map(freshRows.map(row => [row.importKey, row]))
      const unassignedCards = new Map<string, string>()
      for (const record of importedRecords) {
        if (!record.sourceImportKey) continue
        const source = freshByKey.get(record.sourceImportKey)
        if (!source) continue
        let jobCardId: string
        if (record.truckId) {
          jobCardId = await getOrCreateOpenJobCard(tx, { vehicleType: 'truck', vehicleId: record.truckId }, {
            eventAt: record.datePerformed, odometerKm: record.currentMileage, driverName: record.driverName,
            userId: user.id, creationSource: 'OIL', serviceType: 'OIL CHANGE',
            reportedIssue: source.oilText || 'Oil change imported from workbook'
          })
        } else {
          const marker = `[OIL-IMPORT:${record.sourceImportKey}]`
          const cached = unassignedCards.get(marker)
          if (cached) jobCardId = cached
          else {
            await tx.$executeRawUnsafe('LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE')
            const existing = await tx.workshopJobCard.findFirst({ where: { truckId: null, trailerId: null, notes: { contains: marker } }, select: { id: true } })
            if (existing) jobCardId = existing.id
            else {
              const year = record.datePerformed.getFullYear()
              const prefix = `JC-${year}-`
              const numbers = await tx.workshopJobCard.findMany({ where: { jobNumber: { startsWith: prefix } }, select: { jobNumber: true } })
              const highest = numbers.reduce((max: number, item: { jobNumber: string }) => {
                const found = item.jobNumber.match(/^JC-\d{4}-(\d+)$/)
                return found ? Math.max(max, Number(found[1]) || 0) : max
              }, 0)
              let sequence = highest + 1
              let jobNumber = `${prefix}${String(sequence).padStart(4, '0')}`
              while (await tx.workshopJobCard.findUnique({ where: { jobNumber }, select: { id: true } })) {
                sequence++
                jobNumber = `${prefix}${String(sequence).padStart(4, '0')}`
              }
              jobCardId = `jc_${randomUUID()}`
              await tx.workshopJobCard.create({
                data: {
                  id: jobCardId, jobNumber, serviceDate: record.datePerformed, serviceType: 'OIL CHANGE',
                  creationSource: 'OIL', priority: 'NORMAL', status: 'OPEN', driverName: record.driverName || undefined,
                  reportedIssue: source.oilText || 'Oil change imported; vehicle could not be matched',
                  notes: `${marker} Original workbook vehicle number: ${record.vehiclePlateNumber || 'not supplied'}. Vehicle assignment pending review.`,
                  createdById: user.id, items: [], checklist: {}
                }
              })
            }
            unassignedCards.set(marker, jobCardId)
          }
        }
        await tx.$executeRawUnsafe('UPDATE "maintenance_records" SET "jobCardId"=$2 WHERE "id"=$1 AND "jobCardId" IS NULL', record.id, jobCardId)
      }

      // Keep the canonical truck odometer and last-oil-change fields aligned
      // with imported history, but never move either value backwards.
      const truckIds = [...new Set([...freshRows, ...updateRows.map(x => x.row)].map(row => row.truckId).filter((id): id is string => Boolean(id)))]
      for (const truckId of truckIds) {
        const truckRows = [...freshRows, ...updateRows.map(x => x.row)].filter(row => row.truckId === truckId)
        const mileages = truckRows.map(row => row.mileage).filter((value): value is number => value !== null)
        const maxMileage = mileages.length ? Math.max(...mileages) : null
        const latestDate = new Date(`${truckRows.reduce((latest, row) => row.date && row.date > latest ? row.date : latest, '1900-01-01')}T00:00:00.000Z`)
        await tx.$executeRawUnsafe(
          `UPDATE "trucks"
           SET "currentMileage" = CASE WHEN $2::integer IS NULL THEN "currentMileage" ELSE GREATEST("currentMileage", $2::integer) END,
               "lastOilChange" = CASE WHEN "lastOilChange" IS NULL OR "lastOilChange" < $3 THEN $3 ELSE "lastOilChange" END,
               "updatedAt" = NOW()
           WHERE "id" = $1 AND "isDeleted" = false`,
          truckId, maxMileage, latestDate
        )
      }
      return { inserted, removed }
    })
    try { await syncOneDriveWorkbookAfterChange() } catch (e) { console.warn('Oil import OneDrive sync failed', e) }
    return NextResponse.json({ imported: result.inserted.count, replaced: updateRows.length, removed: result.removed,
      duplicates: 0,
      invalid: parsed.length - valid.length, unmatched: rows.filter(r => ['Unmatched','Ambiguous'].includes(r.matchStatus)).length,
      missing: rows.filter(r => r.matchStatus === 'Missing').length })
  } catch (error) {
    console.error('Oil import error:', error)
    const msg = error instanceof Error ? error.message : 'Unable to import file'
    const status = ['No token provided','Invalid token'].includes(msg) ? 401 : msg === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : msg }, { status })
  }
}
