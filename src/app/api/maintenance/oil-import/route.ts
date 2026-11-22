import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'
import * as XLSX from 'xlsx'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'

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
  const s = String(v ?? '').trim().replace(/N0v/ig, 'Nov')
  if (!s) return null
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
    const km = Number(String(value(r, ['km','mileage','odometer'])).replace(/,/g,''))
    const mileage = Number.isFinite(km) && km >= 0 ? Math.floor(km) : null
    const make = String(value(r, ['make','manufacturer']) ?? '').trim()
    const rawPlate = String(value(r, ['plateno','platenumber','licenseplate','trucknumber']) ?? '').trim()
    const oilText = String(value(r, ['litterandoiltype','literandoiltype','oiltype','oilused','oilquantity','oil']) ?? '').trim()
    const plate = rawPlate || 'Missing'
    const quantityMatch = oilText.replace(/,/g,'.').match(/^\s*(\d+(?:\.\d+)?)/)
    const quantity = quantityMatch ? Number(quantityMatch[0]) : null
    const keyData = [date || '', plateKey(plate), mileage ?? '', driver.toLowerCase(), oilText.toLowerCase()]
    const importKey = 'oil-upload-v1:' + createHash('sha256').update(JSON.stringify(keyData)).digest('hex')
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
      const key = plateKey(truck.licensePlate)
      if (plates.includes(key)) byPlate.set(key, [...(byPlate.get(key) || []), truck])
    }
    const rows = valid.map(r => {
      const matches = r.plateKey === 'MISSING' ? [] : byPlate.get(r.plateKey) || []
      const matchStatus = r.plateKey === 'MISSING' ? 'Missing' : matches.length === 1 ? 'Matched' : matches.length > 1 ? 'Ambiguous' : 'Unmatched'
      return { ...r, truckId: matches.length === 1 ? matches[0].id : null, matchStatus }
    })
    const keys = rows.map(r => r.importKey)
    const existing = keys.length ? await db.maintenanceRecord.findMany({ where: { sourceImportKey: { in: keys } }, select: { sourceImportKey: true } }) : []
    const known = new Set(existing.map(r => r.sourceImportKey))
    const fresh = rows.filter(r => !known.has(r.importKey))
    const duplicates = rows.length - fresh.length

    if (mode === 'preview') return NextResponse.json({
      total: parsed.length, valid: fresh.length, matched: rows.filter(r => r.matchStatus === 'Matched').length,
      unmatched: rows.filter(r => ['Unmatched','Ambiguous'].includes(r.matchStatus)).length,
      missing: rows.filter(r => r.matchStatus === 'Missing').length, duplicates, invalid: parsed.length - valid.length,
      rows: rows.slice(0,50).map(r => ({ rowNumber: r.rowNumber, date: r.date, plate: r.plate, matchStatus: r.matchStatus, oilText: r.oilText }))
    })
    if (!fresh.length) return NextResponse.json({ imported: 0, duplicates, invalid: parsed.length - valid.length })

    const result = await db.$transaction(tx => tx.maintenanceRecord.createMany({
      data: fresh.map(r => ({
        truckId: r.truckId, vehiclePlateNumber: r.plate, sourceData: JSON.parse(JSON.stringify(r.sourceData)), sourceImportKey: r.importKey,
        serviceType: 'Oil Change', description: r.oilText || 'Historical oil change (oil details not provided)',
        datePerformed: new Date(`${r.date}T00:00:00.000Z`), partsCost: 0, laborCost: 0, totalCost: 0,
        status: 'COMPLETED', isOilChange: true, oilQuantityLiters: r.quantity, currentMileage: r.mileage,
        driverName: r.driver, createdById: user.id
      })),
      skipDuplicates: true
    }))
    try { await syncOneDriveWorkbookAfterChange() } catch (e) { console.warn('Oil import OneDrive sync failed', e) }
    return NextResponse.json({ imported: result.count, duplicates: duplicates + fresh.length - result.count,
      invalid: parsed.length - valid.length, unmatched: rows.filter(r => ['Unmatched','Ambiguous'].includes(r.matchStatus)).length,
      missing: rows.filter(r => r.matchStatus === 'Missing').length })
  } catch (error) {
    console.error('Oil import error:', error)
    const msg = error instanceof Error ? error.message : 'Unable to import file'
    const status = ['No token provided','Invalid token'].includes(msg) ? 401 : msg === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : msg }, { status })
  }
}
