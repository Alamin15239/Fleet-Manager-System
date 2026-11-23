import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'

export const runtime = 'nodejs'
const text = (v: ExcelJS.CellValue): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (v && typeof v === 'object' && 'text' in v) return String(v.text || '').trim()
  return String(v ?? '').trim()
}
const parseDate = (v: string): Date | null => {
  if (!v) return null
  const d = /^\\d{4}-\\d{2}-\\d{2}$/.test(v) ? new Date(v + 'T00:00:00.000Z') : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
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
    if (!['CHINESE','JAPANESE','EUROPEAN','AMERICAN','OTHER'].includes(origin)) return NextResponse.json({ error: 'Select a valid origin.' }, { status: 400 })
    if (file.size > 10485760) return NextResponse.json({ error: 'File must be 10 MB or smaller.' }, { status: 400 })
    const workbook = new ExcelJS.Workbook()
    const bytes = Buffer.from(await file.arrayBuffer())
    if (file.name.toLowerCase().endsWith('.csv')) {
      const sheet = workbook.addWorksheet('Upload')
      const lines = bytes.toString('utf8').split(/\\r?\\n/).filter(Boolean)
      lines.forEach((line, i) => line.split(',').forEach((value, j) => { sheet.getCell(i + 1, j + 1).value = value.trim().replace(/^"|"$/g, '') }))
    } else await workbook.xlsx.load(bytes as any)
    const sheet = workbook.worksheets[0]
    if (!sheet || sheet.rowCount < 2) return NextResponse.json({ error: 'The sheet is empty.' }, { status: 400 })
    const headers = new Map<string, number>()
    sheet.getRow(1).eachCell((cell, col) => headers.set(text(cell.value).toLowerCase().replace(/[^a-z0-9]/g, ''), col))
    const find = (...keys: string[]) => keys.map(k => headers.get(k)).find(Boolean)
    const dc = find('date'), tc = find('truck','trucknumber','truckno'), nc = find('namedriver','drivername','driver'), sc = find('serialnumber','serial'), qc = find('outqty','qty','quantity')
    if (!dc || !tc || !nc || !sc || !qc) return NextResponse.json({ error: 'Required headers: Date, Truck #, Name Driver, Serial Number, OUT QTY.' }, { status: 400 })
    const rows: Array<{date:Date;truck:string;driver:string;serial:string;qty:number;line:number}> = []
    const errors: string[] = []
    for (let n = 2; n <= sheet.rowCount; n++) {
      const r = sheet.getRow(n)
      const dateText = text(r.getCell(dc).value), truck = text(r.getCell(tc).value), driver = text(r.getCell(nc).value), serial = text(r.getCell(sc).value), qty = Number(text(r.getCell(qc).value))
      if (![dateText,truck,driver,serial,String(qty)].some(Boolean)) continue
      const date = parseDate(dateText)
      if (!date) errors.push('Row ' + n + ': invalid date')
      if (!truck) errors.push('Row ' + n + ': truck number required')
      if (!driver) errors.push('Row ' + n + ': driver name required')
      if (!Number.isInteger(qty) || qty < 1 || qty > 100) errors.push('Row ' + n + ': OUT QTY must be 1–100')
      if (date && truck && driver && Number.isInteger(qty) && qty > 0 && qty <= 100) rows.push({date,truck,driver,serial,qty,line:n})
    }
    if (errors.length) return NextResponse.json({ error: errors.slice(0,20).join('; '), totalErrors: errors.length }, { status: 400 })
    if (!rows.length) return NextResponse.json({ error: 'No data rows found.' }, { status: 400 })
    const numbers = [...new Set(rows.map(r => r.truck))]
    const trucks = await db.truck.findMany({ where: { isDeleted: false, OR: numbers.flatMap(n => [{licensePlate:n},{licensePlate:{startsWith:n + ' '}}]) }, select: {id:true,licensePlate:true} })
    const resolve = (n:string) => { const matches = trucks.filter(t => t.licensePlate === n || t.licensePlate.startsWith(n + ' ')); return matches.length === 1 ? matches[0] : null }
    const missing = [...new Set(rows.filter(r => !resolve(r.truck)).map(r => r.truck))]
    if (missing.length) return NextResponse.json({ error: 'Truck number must match exactly one active truck: ' + missing.join(', ') }, { status: 400 })
    const count = await db.$transaction(async tx => {
      let total = 0
      for (const row of rows) {
        const truck = resolve(row.truck)!
        await tx.vehicle.upsert({ where: {plateNumber:truck.licensePlate}, create: {plateNumber:truck.licensePlate,driverName:row.driver}, update: {driverName:row.driver} })
        const records = Array.from({length:row.qty}, () => ({
          tireSize, manufacturer:'Unspecified', origin, plateNumber:truck.licensePlate, truckId:truck.id,
          trailerNumber:null, driverName:row.driver, quantity:1,
          serialNumber:row.qty === 1 ? (row.serial || null) : null,
          notes:row.qty > 1 && row.serial ? 'Source serial reference for OUT QTY ' + row.qty + ': ' + row.serial + '; verify individual serial mapping.' : 'Imported from outgoing tire sheet; wheel position not provided.',
          lifecycleStatus:'ASSIGNED_UNVERIFIED', createdById:user.id, createdAt:row.date
        }))
        await tx.tire.createMany({data:records})
        total += records.length
      }
      return total
    })
    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({message:'Uploaded ' + rows.length + ' sheet rows and created ' + count + ' individual tire records.',rows:rows.length,tires:count},{status:201})
  } catch (error) {
    console.error('Bulk tire upload failed:',error)
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided','Invalid token'].includes(message) ? 401 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({error:status === 401 ? 'Authentication required' : status === 403 ? 'Access denied' : 'Could not import tire sheet.'},{status})
  }
}
