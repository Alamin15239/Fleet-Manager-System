import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { ensureTireLifecycleTables, recordTireLifecycleEvent } from '@/lib/tire-lifecycle'
import { syncOneDriveWorkbookAfterChange } from '@/lib/onedrive-excel-sync'

export const runtime = 'nodejs'

type ReceiptRow = {
  date: Date
  tireSize: string
  manufacturer: string
  origin: string
  serial: string
  quantity: number
  supplierName: string
  purchaseReference: string
  purchaseCost: number | null
  notes: string
  line: number
}

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
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  const parts = raw.includes('/') ? raw.split('/') : raw.split(/[. -]/)
  const date = iso
    ? new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])))
    : parts.length === 3 && parts[2].length === 4
      ? new Date(Date.UTC(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])))
      : new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'tire-management', 'create')
    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Select an Excel or CSV file.' }, { status: 400 })
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

    let headerRow = 0
    let columns = new Map<string, number>()
    const aliases: Record<string, string[]> = {
      date: ['date', 'receiveddate', 'receiptdate'],
      tiresize: ['tiresize', 'size'],
      manufacturer: ['manufacturer', 'brand'],
      origin: ['origin', 'countryoforigin'],
      quantity: ['quantity', 'qty', 'receivedqty'],
      serial: ['serialnumber', 'serial', 'serialno'],
      supplier: ['supplier', 'suppliername', 'vendor', 'vendorname'],
      reference: ['purchasereference', 'invoicenumber', 'purchaseinvoice', 'reference', 'ponumber'],
      cost: ['purchasecost', 'unitcost', 'costpertire', 'unitprice'],
      notes: ['notes', 'remarks', 'description']
    }
    for (let rowNo = 1; rowNo <= Math.min(sheet.rowCount, 6); rowNo++) {
      const candidate = new Map<string, number>()
      sheet.getRow(rowNo).eachCell((cell, col) => candidate.set(normalizeHeader(cellText(cell.value)), col))
      if (['date', 'tiresize', 'manufacturer', 'origin', 'quantity'].every(key => aliases[key].some(alias => candidate.has(alias)))) {
        headerRow = rowNo
        columns = candidate
        break
      }
    }
    if (!headerRow) {
      return NextResponse.json({
        error: 'Required columns: Date, Tire Size, Manufacturer, Origin, Quantity. Optional: Serial Number, Supplier, Purchase Reference, Purchase Cost, Notes. A title row above the headers is allowed.'
      }, { status: 400 })
    }

    const find = (key: keyof typeof aliases) => aliases[key].map(alias => columns.get(alias)).find((value): value is number => Boolean(value))
    const dateCol = find('date')!, sizeCol = find('tiresize')!, manufacturerCol = find('manufacturer')!
    const originCol = find('origin')!, quantityCol = find('quantity')!
    const serialCol = find('serial'), supplierCol = find('supplier'), referenceCol = find('reference')
    const costCol = find('cost'), notesCol = find('notes')
    const validOrigins = ['CHINESE', 'SAUDI', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER']
    const rows: ReceiptRow[] = []
    const errors: string[] = []

    for (let line = headerRow + 1; line <= sheet.rowCount; line++) {
      const row = sheet.getRow(line)
      const dateValue = row.getCell(dateCol).value
      const tireSize = cellText(row.getCell(sizeCol).value)
      const manufacturer = cellText(row.getCell(manufacturerCol).value)
      const origin = cellText(row.getCell(originCol).value).toUpperCase()
      const quantityText = cellText(row.getCell(quantityCol).value)
      const serial = serialCol ? cellText(row.getCell(serialCol).value) : ''
      const supplierName = supplierCol ? cellText(row.getCell(supplierCol).value) : ''
      const purchaseReference = referenceCol ? cellText(row.getCell(referenceCol).value) : ''
      const costText = costCol ? cellText(row.getCell(costCol).value) : ''
      const notes = notesCol ? cellText(row.getCell(notesCol).value) : ''
      if (![dateValue, tireSize, manufacturer, origin, quantityText, serial, supplierName, purchaseReference, costText, notes]
        .some(value => value !== null && value !== undefined && String(value).trim() !== '')) continue

      const date = parseDate(dateValue)
      const quantity = Number(quantityText)
      const purchaseCost = costText === '' ? null : Number(costText)
      if (!date) errors.push('Row ' + line + ': valid receipt date is required')
      if (!tireSize) errors.push('Row ' + line + ': tire size is required')
      if (!manufacturer) errors.push('Row ' + line + ': manufacturer is required')
      if (!validOrigins.includes(origin)) errors.push('Row ' + line + ': origin must be Chinese, Saudi, Japanese, European, American, or Other')
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) errors.push('Row ' + line + ': quantity must be a whole number from 1 to 100')
      if (quantity > 1 && serial) errors.push('Row ' + line + ': enter one tire per row when using serial numbers, or leave Serial Number blank for a multi-quantity row')
      if (costText !== '' && (!Number.isFinite(purchaseCost) || (purchaseCost as number) < 0)) errors.push('Row ' + line + ': purchase cost must be a non-negative number')
      if (date && tireSize && manufacturer && validOrigins.includes(origin) && Number.isInteger(quantity) && quantity >= 1 && quantity <= 100 &&
        !(quantity > 1 && serial) && (costText === '' || (Number.isFinite(purchaseCost) && (purchaseCost as number) >= 0))) {
        rows.push({ date, tireSize, manufacturer, origin, serial, quantity, supplierName, purchaseReference, purchaseCost, notes, line })
      }
    }

    if (errors.length) return NextResponse.json({ error: errors.slice(0, 30).join('; '), totalErrors: errors.length }, { status: 400 })
    if (!rows.length) return NextResponse.json({ error: 'No stock receipt rows found.' }, { status: 400 })

    const serials = rows.map(row => row.serial).filter(Boolean)
    if (new Set(serials.map(value => value.toLowerCase())).size !== serials.length) {
      return NextResponse.json({ error: 'The sheet contains duplicate serial numbers. Each serial number must identify one tire.' }, { status: 400 })
    }

    const result = await db.$transaction(async tx => {
      await ensureTireLifecycleTables(tx)
      if (serials.length) {
        const existing = await tx.tire.findFirst({
          where: {
            deletedAt: null,
            OR: serials.map(serial => ({ serialNumber: { equals: serial, mode: 'insensitive' } }))
          },
          select: { serialNumber: true }
        })
        if (existing?.serialNumber) throw new Error('Serial number already exists in Tire Management: ' + existing.serialNumber)
      }

      let tireCount = 0
      const receiptIds: string[] = []
      for (const row of rows) {
        const fingerprint = [
          row.date.toISOString(), row.tireSize.toLowerCase(), row.manufacturer.toLowerCase(),
          row.origin, row.serial.toLowerCase(), row.quantity, row.supplierName.toLowerCase(),
          row.purchaseReference.toLowerCase(), row.purchaseCost ?? '', row.notes.toLowerCase(), row.line
        ].join('|')
        const codePrefix = 'TY-RC-' + createHash('sha256').update(fingerprint).digest('hex').slice(0, 18).toUpperCase()
        const codes = Array.from({ length: row.quantity }, (_, index) => codePrefix + '-' + String(index + 1).padStart(3, '0'))
        const duplicate = await tx.tire.findFirst({ where: { internalCode: { in: codes }, deletedAt: null }, select: { internalCode: true } })
        if (duplicate) throw new Error('This stock receipt sheet appears to have already been uploaded. Duplicate import prevented.')

        for (let index = 0; index < row.quantity; index++) {
          const tire = await tx.tire.create({
            data: {
              tireSize: row.tireSize,
              manufacturer: row.manufacturer,
              origin: row.origin,
              quantity: 1,
              serialNumber: row.quantity === 1 ? row.serial || null : null,
              internalCode: codes[index],
              lifecycleStatus: 'STOCK',
              supplierName: row.supplierName || null,
              purchaseReference: row.purchaseReference || null,
              purchaseCost: row.purchaseCost,
              notes: [row.notes, row.quantity > 1 ? 'Received as part of a multi-quantity stock receipt row; individual serial not supplied.' : null].filter(Boolean).join(' | ') || null,
              createdById: user.id,
              createdAt: row.date
            },
            select: { id: true }
          })
          const receipt = await recordTireLifecycleEvent(tx, {
            tireId: tire.id,
            eventType: 'RECEIVE',
            eventAt: row.date,
            reason: 'Bulk stock receipt import',
            supplierName: row.supplierName || null,
            purchaseReference: row.purchaseReference || null,
            purchaseCost: row.purchaseCost,
            notes: row.notes || 'Imported from stock receipt spreadsheet',
            userId: user.id,
            ensureTables: false
          })
          receiptIds.push(receipt.eventId)
          tireCount++
        }
      }
      return { tireCount, receiptCount: receiptIds.length }
    }, { timeout: 120000 })

    await syncOneDriveWorkbookAfterChange()
    return NextResponse.json({
      message: 'Received ' + result.tireCount + ' individual tire records from ' + rows.length + ' spreadsheet rows. All receipt events were saved to tire lifecycle history; no workshop job cards were created.',
      rows: rows.length,
      tires: result.tireCount,
      receipts: result.receiptCount
    }, { status: 201 })
  } catch (error) {
    console.error('Bulk tire stock receipt failed:', error)
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401
      : message === 'Insufficient permissions' ? 403
        : message.startsWith('Serial number already exists') || message.includes('already been uploaded') ? 409 : 500
    return NextResponse.json({
      error: status === 401 ? 'Authentication required'
        : status === 403 ? 'Access denied'
          : message || 'Could not import stock receipt sheet.'
    }, { status })
  }
}
