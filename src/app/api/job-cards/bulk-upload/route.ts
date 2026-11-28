import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'
export const runtime = 'nodejs'
export const maxDuration = 300
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const normJob = (s: unknown) => norm(String(s || '').replace(/-DUP-\d+$/i, ''))
const val = (v: ExcelJS.CellValue): string => {
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (v && typeof v === 'object') {
    if ('result' in v && v.result != null) return val(v.result as ExcelJS.CellValue)
    if ('text' in v) return String(v.text || '').trim()
  }
  return String(v ?? '').trim()
}
const parseDate = (v: ExcelJS.CellValue): Date | null => {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v
  if (typeof v === 'number' && v > 0 && v < 300000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000)
  const s = val(v)
  if (!s || /^(na|n\/a|—|-)$/i.test(s)) return null
  const p = s.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/)
  const d = p ? new Date(Date.UTC(+p[3], +p[2] - 1, +p[1])) : new Date(s)
  return isNaN(d.getTime()) ? null : d
}
const parseNum = (v: ExcelJS.CellValue): number | null => {
  const s = val(v)
  if (!s || /^(na|n\/a|—|-)$/i.test(s)) return null
  const n = Number(s.replace(/,/g, ''))
  return Number.isSafeInteger(n) && n >= 0 ? n : null
}
function headers(ws: ExcelJS.Worksheet, required: string[][]) {
  for (let r = 1; r <= Math.min(12, ws.rowCount); r++) {
    const m = new Map<string, number>()
    ws.getRow(r).eachCell((c, i) => m.set(norm(val(c.value)), i))
    if (required.every(a => a.some(x => m.has(x)))) return { r, m }
  }
  return null
}
function find(m: Map<string, number>, ...names: string[]) { return names.map(x => m.get(x)).find(Boolean) }
// Normalised date for identity comparison.
const dateOf = (x: any) => {
  const d = x?.serviceDate instanceof Date ? x.serviceDate : new Date(x?.serviceDate)
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}
// Match an incoming card to an existing one so re-uploading a workbook
// REPLACES the stored details instead of being rejected as duplicate.
// Priority 1: same source job number (ignores the -DUP-n rename suffix so
// renumbered occurrences still find their original card). Priority 2: same
// source job number + vehicle + date + service type. Each existing card is
// consumed at most once per import via the shared `used` set.
function matchCard(c: any, list: any[], used: Set<string>): any | null {
  const src = normJob(c.sourceJobNumber || c.jobNumber)
  const byNumber = list
    .filter(x => normJob(x.jobNumber) === src && !used.has(x.id))
    .sort((a, b) => (a.jobNumber === c.jobNumber ? 0 : 1) - (b.jobNumber === c.jobNumber ? 0 : 1))
  if (byNumber.length) return byNumber[0]
  const vehicleKey = (c.vehicleType || '') + ':' + c.vehicleId
  const identity = list.filter(x => !used.has(x.id) &&
    normJob(x.jobNumber) === src &&
    ((x.truckId ? 'truck:' + x.truckId : x.trailerId ? 'trailer:' + x.trailerId : '') === vehicleKey) &&
    dateOf(x) === dateOf(c) &&
    norm(String(x.serviceType || '')) === norm(String(c.serviceType || '')))
  if (identity.length) return identity[0]
  return null
}
export async function POST(req: NextRequest) {
  try {
    const user = await requireRolePermission(req, 'maintenance', 'create'), form = await req.formData(), file = form.get('file'), action = String(form.get('action') || 'preview')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Select an Excel workbook.' }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Workbook exceeds 4 MB. Split larger workbooks into smaller imports.' }, { status: 400 })
    if (!/\.xlsx$/i.test(file.name)) return NextResponse.json({ error: 'Upload an .xlsx workbook.' }, { status: 400 })
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as any)
    const reg = wb.worksheets.find(x => norm(x.name) === 'register'), its = wb.worksheets.find(x => norm(x.name) === 'items')
    if (!reg || !its) return NextResponse.json({ error: 'Workbook must contain Register and Items sheets.' }, { status: 400 })
    const rh = headers(reg, [['jobno', 'jobnumber'], ['date'], ['truckplateno', 'truckplate', 'vehiclenumber'], ['servicetype'], ['status']]), ih = headers(its, [['jobno', 'jobnumber'], ['type'], ['description', 'descriptionالوصف'], ['qty', 'quantity']])
    if (!rh || !ih) return NextResponse.json({ error: 'Required Register or Items columns are missing.' }, { status: 400 })
    const im = new Map<string, any[]>(), ic = ih.m, regJobCol = find(rh.m, 'jobno', 'jobnumber')!, duplicateTotals = new Map<string, number>(), lineOccurrences = new Map<string, number>()
    for (let r = rh.r + 1; r <= reg.rowCount; r++) { const key = val(reg.getRow(r).getCell(regJobCol).value); if (key) duplicateTotals.set(key, (duplicateTotals.get(key) || 0) + 1) }
    for (let r = ih.r + 1; r <= its.rowCount; r++) {
      const row = its.getRow(r), job = val(row.getCell(find(ic, 'jobno', 'jobnumber')!).value), description = val(row.getCell(find(ic, 'description', 'descriptionالوصف')!).value)
      if (!job) continue
      const raw = val(row.getCell(find(ic, 'type')!).value).toLowerCase(), qraw = val(row.getCell(find(ic, 'qty', 'quantity')!).value), quantity = qraw ? Number(qraw) : 1
      if (!Number.isFinite(quantity) || quantity <= 0) continue
      const a = im.get(job) || [], rc = find(ic, 'remarks', 'remarksملاحظات', 'ملاحظات'), lineCol = find(ic, 'line'), lineNo = lineCol ? val(row.getCell(lineCol).value) || '1' : '1', occKey = job + '|' + lineNo, occurrence = (lineOccurrences.get(occKey) || 0) + 1; lineOccurrences.set(occKey, occurrence)
      a.push({ lineNo, occurrence, type: ['part', 'parts'].includes(raw) ? 'PART' : ['work', 'labour', 'labor'].includes(raw) ? 'LABOUR' : 'OTHER', description: description || 'Description not provided (source row ' + r + ')', quantity, remarks: rc ? val(row.getCell(rc).value) : '' })
      im.set(job, a)
    }
    const cards: any[] = [], errors: string[] = [], seen = new Map<string, number>(), m = rh.m
    const j = find(m, 'jobno', 'jobnumber')!, d = find(m, 'date')!, v = find(m, 'truckplateno', 'truckplate', 'vehiclenumber')!, s = find(m, 'servicetype')!, st = find(m, 'status')!
    for (let r = rh.r + 1; r <= reg.rowCount; r++) {
      const row = reg.getRow(r), job = val(row.getCell(j).value), vehicle = val(row.getCell(v).value), service = val(row.getCell(s).value), date = parseDate(row.getCell(d).value)
      if (!job && !vehicle && !service && !row.getCell(d).value) continue
      const statusRaw = val(row.getCell(st).value).toLowerCase().replace(/[_-]/g, ' ').trim(), status = statusRaw === 'completed' ? 'COMPLETED' : statusRaw === 'in progress' ? 'IN_PROGRESS' : statusRaw === 'cancelled' ? 'CANCELLED' : statusRaw === 'open' ? 'OPEN' : null
      if (!job) errors.push('Row ' + r + ': Job No. missing')
      const occurrence = (seen.get(job) || 0) + 1; if (job) seen.set(job, occurrence)
      if (!date) errors.push('Row ' + r + ': invalid Date')
      if (!vehicle) errors.push('Row ' + r + ': vehicle missing')
      if (!service) errors.push('Row ' + r + ': Service Type missing')
      if (!status) errors.push('Row ' + r + ': unsupported Status ' + statusRaw)
      if (!job || !date || !vehicle || !service || !status) continue
      const get = (...a: string[]) => { const c = find(m, ...a); return c ? row.getCell(c).value : null }
      const duplicateTotal = duplicateTotals.get(job) || 1, uniqueJobNumber = occurrence === 1 ? job : job + '-DUP-' + occurrence, baseNotes = val(get('notes')) || null, notes = duplicateTotal > 1 ? [baseNotes, 'Source Job No. ' + job + ' is duplicated in the workbook; this is occurrence ' + occurrence + ' of ' + duplicateTotal + ' (Register row ' + r + ').'].filter(Boolean).join('\n') : baseNotes, sourceItems = im.get(job) || [], cardItems = sourceItems.filter((item: any) => ((item.occurrence - 1) % duplicateTotal) + 1 === occurrence).map(({ lineNo, occurrence, ...item }: any) => item)
      cards.push({ jobNumber: uniqueJobNumber, sourceJobNumber: job, renumbered: duplicateTotal > 1, vehicle, serviceDate: date, odometerKm: parseNum(get('odometerkm')), serviceType: service, reportedIssue: val(get('reportedissuecomplaint', 'reportedissue', 'complaint')) || null, technicianName: val(get('technician')) || null, status, nextServiceOdometer: parseNum(get('nextservicekm', 'nextserviceodometer')), nextServiceDate: parseDate(get('nextservicedate')), notes, items: cardItems })
    }
    const known = new Set(cards.map(x => x.sourceJobNumber)); for (const key of im.keys()) if (!known.has(key)) errors.push('Items reference missing Register Job No. ' + key)
    if (!cards.length) errors.push('No job cards found.')
    if (errors.length) return NextResponse.json({ error: 'Workbook validation failed.', errors: errors.slice(0, 100), totalErrors: errors.length }, { status: 400 })
    cards.sort((a, b) => b.serviceDate.getTime() - a.serviceDate.getTime() || b.jobNumber.localeCompare(a.jobNumber))
    const [trucks, trailers, existing] = await Promise.all([
      db.truck.findMany({ where: { isDeleted: false }, select: { id: true, licensePlate: true } }),
      db.trailer.findMany({ where: { isDeleted: false }, select: { id: true, number: true } }),
      db.workshopJobCard.findMany({ select: { id: true, jobNumber: true, truckId: true, trailerId: true, status: true, serviceDate: true, serviceType: true, reportedIssue: true, creationSource: true } })
    ])
    const vehicles = new Map<string, any[]>()
    for (const x of trucks) { const k = norm(x.licensePlate); vehicles.set(k, [...(vehicles.get(k) || []), { id: x.id, type: 'truck' }]) }
    for (const x of trailers) { const k = norm(x.number); vehicles.set(k, [...(vehicles.get(k) || []), { id: x.id, type: 'trailer' }]) }
    const numbers = new Set(existing.map(x => x.jobNumber))
    const identity = (x: any) => { const vehicleKey = x.truckId ? 'truck:' + x.truckId : x.trailerId ? 'trailer:' + x.trailerId : ''; const date = dateOf(x); return [norm(String(x.jobNumber || '').replace(/-DUP-\d+$/i, '')), vehicleKey, date, norm(String(x.serviceType || '')), norm(String(x.reportedIssue || ''))].join('|') }
    const previewUsed = new Set<string>()
    const report = cards.map(c => {
      const matches = vehicles.get(norm(c.vehicle)) || []
      if (matches.length !== 1) return { jobNumber: c.jobNumber, outcome: 'INVALID_VEHICLE', detail: matches.length ? 'Ambiguous vehicle number' : 'Vehicle not found' }
      const x = matches[0], key = x.type + ':' + x.id
      c.vehicleType = x.type; c.vehicleId = x.id
      const target = matchCard(c, existing, previewUsed)
      if (target) { previewUsed.add(target.id); c.targetId = target.id; return { jobNumber: c.jobNumber, outcome: 'REPLACE', detail: 'Existing job card ' + target.jobNumber + ' will be updated with the uploaded details (replaces the old data)' } }
      if (numbers.has(c.jobNumber)) return { jobNumber: c.jobNumber, outcome: 'JOB_NUMBER_CONFLICT', detail: 'This job number belongs to a different maintenance record; assign a unique job number before importing' }
      return { jobNumber: c.jobNumber, outcome: c.renumbered ? 'RENAMED_DUPLICATE' : 'READY', detail: x.type + ' matched' + (c.renumbered ? '; duplicate source ID ' + c.sourceJobNumber + ' is preserved in notes' : '') }
    })
    const count = (k: string) => report.filter(x => x.outcome === k).length
    if (action !== 'import') return NextResponse.json({
      preview: true, totalCards: cards.length, totalItemLines: cards.reduce((n, x) => n + x.items.length, 0),
      ready: count('READY') + count('RENAMED_DUPLICATE') + count('REPLACE'),
      newCards: count('READY') + count('RENAMED_DUPLICATE'), replaces: count('REPLACE'),
      renumberedDuplicates: count('RENAMED_DUPLICATE'), duplicates: 0,
      activeConflicts: count('JOB_NUMBER_CONFLICT'), invalidVehicles: count('INVALID_VEHICLE'),
      issues: report.filter(x => !['READY', 'REPLACE', 'RENAMED_DUPLICATE'].includes(x.outcome)).slice(0, 100)
    })
    if (count('INVALID_VEHICLE')) return NextResponse.json({ error: 'Resolve unmatched vehicles before import.', issues: report.filter(x => x.outcome === 'INVALID_VEHICLE') }, { status: 400 })
    const eligible = new Set(report.filter(x => ['READY', 'RENAMED_DUPLICATE', 'REPLACE'].includes(x.outcome)).map(x => x.jobNumber))
    if (!eligible.size) return NextResponse.json({ error: 'No new or updated job cards to import.' }, { status: 409 })
    const result = await db.$transaction(async tx => {
      await tx.$executeRawUnsafe('LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE')
      const fresh = await tx.workshopJobCard.findMany({ select: { id: true, jobNumber: true, truckId: true, trailerId: true, status: true, serviceDate: true, serviceType: true, reportedIssue: true, creationSource: true } })
      const usedFresh = new Set<string>(), plan: { mode: 'update' | 'create'; card: any; target?: any }[] = []
      for (const c of cards) {
        if (!eligible.has(c.jobNumber)) continue
        const target = matchCard(c, fresh, usedFresh)
        if (target) { usedFresh.add(target.id); plan.push({ mode: 'update', card: c, target }) }
        else plan.push({ mode: 'create', card: c })
      }
      // Replace: update every matched card with the uploaded details.
      let updated = 0
      for (const p of plan) {
        if (p.mode !== 'update') continue
        const c = p.card
        const existingItems = Array.isArray(p.target.items) ? p.target.items as any[] : []
        const incomingItems = Array.isArray(c.items) ? c.items as any[] : []
        const incomingSourceIds = new Set(incomingItems.map(item => item?.sourceId).filter(Boolean))
        // Workbook replacement must not erase activities linked from Oil Changes,
        // Tire Management or Spare Parts after the original register import.
        const linkedActivityItems = existingItems.filter(item => item?.sourceId && !incomingSourceIds.has(item.sourceId))
        await tx.workshopJobCard.update({
          where: { id: p.target.id },
          data: {
            truckId: c.vehicleType === 'truck' ? c.vehicleId : null,
            trailerId: c.vehicleType === 'trailer' ? c.vehicleId : null,
            serviceDate: c.serviceDate, odometerKm: c.odometerKm, serviceType: c.serviceType,
            reportedIssue: c.reportedIssue, technicianName: c.technicianName, status: c.status,
            nextServiceOdometer: c.nextServiceOdometer, nextServiceDate: c.nextServiceDate,
            notes: c.notes, items: [...incomingItems, ...linkedActivityItems]
          }
        })
        updated++
      }
      // Create genuinely new cards (renumbered duplicates keep their -DUP suffix).
      const freshNos = new Set(fresh.map(x => x.jobNumber)), freshIdentities = new Set(fresh.map(identity)), data: any[] = []
      for (const p of plan) {
        if (p.mode !== 'create') continue
        const c = p.card
        if (freshNos.has(c.jobNumber)) continue
        const key = c.vehicleType + ':' + c.vehicleId, signature = [norm(c.sourceJobNumber), key, c.serviceDate.toISOString().slice(0, 10), norm(c.serviceType), norm(String(c.reportedIssue || ''))].join('|')
        if (freshIdentities.has(signature)) continue
        freshNos.add(c.jobNumber); freshIdentities.add(signature)
        data.push({ jobNumber: c.jobNumber, truckId: c.vehicleType === 'truck' ? c.vehicleId : null, trailerId: c.vehicleType === 'trailer' ? c.vehicleId : null, serviceDate: c.serviceDate, odometerKm: c.odometerKm, serviceType: c.serviceType, reportedIssue: c.reportedIssue, technicianName: c.technicianName, status: c.status, nextServiceOdometer: c.nextServiceOdometer, nextServiceDate: c.nextServiceDate, notes: c.notes, items: c.items, creationSource: 'WORKBOOK', createdById: user.id })
      }
      let imported = 0
      for (let i = 0; i < data.length; i += 400) imported += (await tx.workshopJobCard.createMany({ data: data.slice(i, i + 400), skipDuplicates: true })).count
      // Clean-up: workbook cards whose source job number no longer appears in
      // the uploaded file and that have no linked work are removed so the
      // register mirrors the uploaded workbook.
      const incomingSrc = new Set(cards.map(c => normJob(c.sourceJobNumber || c.jobNumber)))
      let removed = 0
      const stale = fresh.filter(x => x.creationSource === 'WORKBOOK' && !incomingSrc.has(normJob(x.jobNumber)) && !usedFresh.has(x.id))
      for (const card of stale) {
        const refs = await tx.$queryRawUnsafe<any[]>(`SELECT
          (SELECT COUNT(*) FROM "maintenance_records" WHERE "jobCardId"=$1 AND "isDeleted"=false) +
          (SELECT COUNT(*) FROM "trailer_maintenance_records" WHERE "jobCardId"=$1 AND "isDeleted"=false) +
          (SELECT COUNT(*) FROM "tire_lifecycle_events" WHERE "jobCardId"=$1) +
          (SELECT COUNT(*) FROM "inventory_transactions" WHERE "jobCardId"=$1) AS n`, card.id)
        if (Number(refs[0]?.n || 0) === 0) { await tx.workshopJobCard.delete({ where: { id: card.id } }); removed++ }
      }
      return { imported, updated, removed }
    }, { timeout: 120000 })
    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({ message: 'Job Card workbook imported: ' + result.imported + ' new, ' + result.updated + ' updated (existing data replaced)' + (result.removed ? ', ' + result.removed + ' outdated removed' : '') + '.', imported: result.imported, updated: result.updated, removed: result.removed, totalCards: cards.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Import failed'
    const status = ['No token provided', 'Invalid token'].includes(msg) ? 401 : msg === 'Insufficient permissions' ? 403 : msg.includes('Workbook') || msg.includes('Upload') ? 400 : 500
    console.error('Job Card bulk upload failed', e)
    return NextResponse.json({ error: status === 500 ? 'Job Card import failed. Check server logs.' : msg }, { status })
  }
}
