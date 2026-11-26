import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'

async function ensureInventorySchema() {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inventory_items" (
      "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "partNumber" TEXT,
      "category" TEXT NOT NULL DEFAULT 'GENERAL', "unit" TEXT NOT NULL DEFAULT 'pcs',
      "oilGrade" TEXT, "reorderLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "inventory_items_partNumber_key" ON "inventory_items"("partNumber") WHERE "partNumber" IS NOT NULL`)
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "inventory_transactions" (
      "id" TEXT PRIMARY KEY, "itemId" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
      "type" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL,
      "transactionDate" TIMESTAMP(3) NOT NULL, "reference" TEXT,
      "vehicleType" TEXT, "vehicleId" TEXT, "jobCardId" TEXT,
      "unitCost" DOUBLE PRECISION, "notes" TEXT, "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "inventory_transactions_itemId_date_idx" ON "inventory_transactions"("itemId", "transactionDate" DESC)`)
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "inventory_transactions_vehicle_idx" ON "inventory_transactions"("vehicleType", "vehicleId")`)
  await db.$executeRawUnsafe(`ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "sourceType" TEXT`)
  await db.$executeRawUnsafe(`ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "sourceId" TEXT`)
}

export async function GET(request: NextRequest) {
  try {
    await requireRolePermission(request, 'maintenance', 'read')
    await ensureInventorySchema()
    const items = await db.$queryRawUnsafe<any[]>(`
      SELECT i.*, COALESCE(SUM(CASE
        WHEN t."type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN t."quantity"
        WHEN t."type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -t."quantity"
        ELSE 0 END),0)::float AS "stockQty"
      FROM "inventory_items" i LEFT JOIN "inventory_transactions" t ON t."itemId"=i."id"
      GROUP BY i."id" ORDER BY i."name" ASC`)
    const transactions = await db.$queryRawUnsafe<any[]>(`
      SELECT t.*, i."name" AS "itemName", i."unit"
      FROM "inventory_transactions" t JOIN "inventory_items" i ON i."id"=t."itemId"
      ORDER BY t."transactionDate" DESC, t."createdAt" DESC LIMIT 500`)
    return NextResponse.json({ items, transactions })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Inventory request failed'
    return NextResponse.json({ error: message }, { status: message === 'Insufficient permissions' ? 403 : 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'maintenance', 'create')
    await ensureInventorySchema()
    const body = await request.json()
    const now = new Date()
    if (body.action === 'createItem') {
      const name = String(body.name || '').trim()
      if (!name) return NextResponse.json({ error: 'Part name is required' }, { status: 400 })
      const id = `inv_${crypto.randomUUID()}`
      const rows = await db.$queryRawUnsafe<any[]>(`
        INSERT INTO "inventory_items" ("id","name","partNumber","category","unit","oilGrade","reorderLevel")
        VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        id, name, body.partNumber || null, body.category || 'GENERAL', body.unit || 'pcs',
        body.oilGrade || null, Math.max(0, Number(body.reorderLevel) || 0))
      return NextResponse.json({ item: rows[0] }, { status: 201 })
    }
    if (body.action === 'setReorderLevel') {
      const itemId = String(body.itemId || '')
      const reorderLevel = Number(body.reorderLevel)
      if (!itemId || !Number.isFinite(reorderLevel) || reorderLevel < 0)
        return NextResponse.json({ error: 'Select an item and enter a valid reorder level of zero or more' }, { status: 400 })
      const rows = await db.$queryRawUnsafe<any[]>(`
        UPDATE "inventory_items" SET "reorderLevel"=$2, "updatedAt"=$3
        WHERE "id"=$1 RETURNING "id","reorderLevel"`, itemId, reorderLevel, now)
      if (!rows.length) return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 })
      return NextResponse.json({ item: rows[0] })
    }
    if (body.action === 'setCurrentStock') {
      const itemId = String(body.itemId || '')
      const targetQty = Number(body.quantity)
      if (!itemId || !Number.isFinite(targetQty) || targetQty < 0)
        return NextResponse.json({ error: 'Select an item and enter a valid stock quantity of zero or more' }, { status: 400 })
      const adjusted = await db.$transaction(async tx => {
        const item = await tx.$queryRawUnsafe<any[]>(`SELECT "id" FROM "inventory_items" WHERE "id"=$1 FOR UPDATE`, itemId)
        if (!item.length) throw new Error('Inventory item not found')
        const balance = await tx.$queryRawUnsafe<any[]>(`
          SELECT COALESCE(SUM(CASE WHEN "type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN "quantity" WHEN "type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -"quantity" ELSE 0 END),0)::float AS qty
          FROM "inventory_transactions" WHERE "itemId"=$1`, itemId)
        const currentQty = Number(balance[0]?.qty || 0)
        const delta = targetQty - currentQty
        if (Math.abs(delta) < 0.000001) return { changed: false, quantity: currentQty }
        await tx.$queryRawUnsafe(`
          INSERT INTO "inventory_transactions"
          ("id","itemId","type","quantity","transactionDate","reference","notes","createdById")
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          `itx_${crypto.randomUUID()}`, itemId, delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          Math.abs(delta), now, 'Manual stock correction',
          `Physical stock count correction: changed from ${currentQty} to ${targetQty}`, user.id)
        return { changed: true, quantity: targetQty }
      })
      return NextResponse.json({ adjustment: adjusted })
    }
    const allowed = ['OPENING','PURCHASE','ISSUE','CUSTOMER_RETURN','SUPPLIER_RETURN','ADJUSTMENT_IN','ADJUSTMENT_OUT']
    const type = String(body.type || '')
    const quantity = Number(body.quantity)
    const suppliedUnitCost = body.unitCost == null ? null : Number(body.unitCost)
    if (!body.itemId || !allowed.includes(type) || !Number.isFinite(quantity) || quantity <= 0)
      return NextResponse.json({ error: 'Select a part, valid transaction type, and quantity greater than zero' }, { status: 400 })
    if (suppliedUnitCost !== null && (!Number.isFinite(suppliedUnitCost) || suppliedUnitCost < 0))
      return NextResponse.json({ error: 'Unit cost must be a non-negative number' }, { status: 400 })
    const transactionDate = body.transactionDate ? new Date(body.transactionDate) : now
    if (Number.isNaN(transactionDate.getTime())) return NextResponse.json({ error: 'Invalid transaction date' }, { status: 400 })
    const id = `itx_${crypto.randomUUID()}`
    const created = await db.$transaction(async tx => {
      const normalizedVehicleType = String(body.vehicleType || '').toLowerCase()
      const vehicleId = typeof body.vehicleId === 'string' ? body.vehicleId.trim() : ''
      // Issues retain vehicle attribution, but never create or link a Workshop Job Card.
      if (type === 'ISSUE') {
        if (!vehicleId || !['truck', 'trailer'].includes(normalizedVehicleType))
          throw new Error('Select a valid truck or trailer for this issue')
        const vehicle = normalizedVehicleType === 'truck'
          ? await tx.truck.findFirst({ where: { id: vehicleId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
          : await tx.trailer.findFirst({ where: { id: vehicleId, isDeleted: false }, select: { id: true } })
        if (!vehicle) throw new Error('Selected vehicle not found or inactive')
      }
      // Spare-parts inventory is intentionally independent of Workshop Job Cards.
      const item = await tx.$queryRawUnsafe<any[]>(`SELECT "id","name","unit" FROM "inventory_items" WHERE "id"=$1 FOR UPDATE`, body.itemId)
      if (!item.length) throw new Error('Inventory item not found')
      let resolvedUnitCost = suppliedUnitCost
      if (type === 'ISSUE' && resolvedUnitCost === null) {
        const recentCost = await tx.$queryRawUnsafe<any[]>(`SELECT "unitCost" FROM "inventory_transactions"
          WHERE "itemId"=$1 AND "type" IN ('PURCHASE','OPENING') AND "unitCost" IS NOT NULL
          ORDER BY "transactionDate" DESC,"createdAt" DESC LIMIT 1`, body.itemId)
        resolvedUnitCost = recentCost.length ? Number(recentCost[0].unitCost) : 0
      }
      const balance = await tx.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(SUM(CASE WHEN "type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN "quantity" WHEN "type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -"quantity" ELSE 0 END),0)::float AS qty
        FROM "inventory_transactions" WHERE "itemId"=$1`, body.itemId)
      const delta = ['ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT'].includes(type) ? -quantity : quantity
      if (Number(balance[0]?.qty || 0) + delta < -0.000001) throw new Error('Insufficient stock for this transaction')
      const inserted = await tx.$queryRawUnsafe<any[]>(`
        INSERT INTO "inventory_transactions"
        ("id","itemId","type","quantity","transactionDate","reference","vehicleType","vehicleId","unitCost","notes","createdById")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        id, body.itemId, type, quantity, transactionDate, body.reference || null,
        normalizedVehicleType || (body.vehicleType ? String(body.vehicleType).toLowerCase() : null) || null, vehicleId || body.vehicleId || null,
        resolvedUnitCost, body.notes || null, user.id)
      return inserted
    })
    return NextResponse.json({ transaction: created[0] }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save inventory transaction'
    const status = message === 'Insufficient stock for this transaction' ? 409 : message === 'Inventory item not found' || message === 'Selected vehicle not found or inactive' ? 404 : message === 'Selected job card does not belong to this vehicle' || message === 'Selected job card is not open' || message === 'Select a valid vehicle type for this job-card issue' || message === 'Select a valid truck or trailer for this issue' ? 400 : message === 'Selected job card not found' ? 404 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}


export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRolePermission(request, 'maintenance', 'update')
    await ensureInventorySchema()
    const body = await request.json()
    if (body.action !== 'updateIssue')
      return NextResponse.json({ error: 'Unsupported inventory update' }, { status: 400 })

    const transactionId = String(body.transactionId || '').trim()
    const itemId = String(body.itemId || '').trim()
    const vehicleType = String(body.vehicleType || '').toLowerCase()
    const vehicleId = String(body.vehicleId || '').trim()
    const quantity = Number(body.quantity)
    const unitCost = body.unitCost === '' || body.unitCost == null ? null : Number(body.unitCost)
    const transactionDate = body.transactionDate ? new Date(body.transactionDate) : new Date()
    if (!transactionId || !itemId || !Number.isFinite(quantity) || quantity <= 0 ||
        !['truck', 'trailer'].includes(vehicleType) || !vehicleId ||
        Number.isNaN(transactionDate.getTime()) ||
        (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)))
      return NextResponse.json({ error: 'Enter a part, valid quantity, date, cost and destination vehicle' }, { status: 400 })

    const result = await db.$transaction(async tx => {
      const rows = await tx.$queryRawUnsafe<any[]>(`
        SELECT * FROM "inventory_transactions" WHERE "id"=$1 FOR UPDATE`, transactionId)
      const old = rows[0]
      if (!old) throw new Error('Inventory transaction not found')
      if (old.type !== 'ISSUE') throw new Error('Only issued-part transactions can be edited')

      const [item, vehicle] = await Promise.all([
        tx.$queryRawUnsafe<any[]>(`SELECT "id","name" FROM "inventory_items" WHERE "id"=$1`, itemId),
        vehicleType === 'truck'
          ? tx.truck.findFirst({ where: { id: vehicleId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
          : tx.trailer.findFirst({ where: { id: vehicleId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
      ])
      if (!item.length) throw new Error('Inventory item not found')
      if (!vehicle) throw new Error('Selected vehicle not found or inactive')
      if (old.sourceType && old.sourceType !== 'OIL_CHANGE')
        throw new Error('This issue belongs to a source workflow that does not support direct editing yet')

      // Check the resulting balance while excluding this issue. This permits
      // correcting an issue without temporarily double-counting its old quantity.
      const balance = await tx.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(SUM(CASE WHEN "type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN "quantity"
          WHEN "type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -"quantity" ELSE 0 END),0)::float AS qty
        FROM "inventory_transactions" WHERE "itemId"=$1 AND "id"<>$2`,
        itemId, transactionId)
      if (Number(balance[0]?.qty || 0) + 0.000001 < quantity)
        throw new Error('Insufficient stock for the corrected issue')

      if (old.jobCardId) {
        const card = await tx.workshopJobCard.findUnique({ where: { id: old.jobCardId } })
        if (!card) throw new Error('Linked Workshop Job Card was not found')
        const lines = Array.isArray(card.items) ? [...card.items as any[]] : []
        const matches = lines.map((line, index) => ({ line, index }))
          .filter(({ line }) => line?.type === 'PART' && line?.inventoryItemId === old.itemId)
        if (matches.length !== 1)
          throw new Error('The linked Job Card has multiple or missing lines for this part. Edit the part line in the Job Card instead.')
        const { index } = matches[0]
        lines[index] = { ...lines[index], inventoryItemId: itemId, description: item[0].name, quantity, unitCost }
        await tx.workshopJobCard.update({
          where: { id: card.id },
          data: {
            items: lines,
            serviceDate: transactionDate,
            truckId: vehicleType === 'truck' ? vehicleId : null,
            trailerId: vehicleType === 'trailer' ? vehicleId : null
          }
        })
        // A Job Card is one maintenance visit; keep all of its inventory issue
        // rows aligned with the corrected visit date and assigned vehicle.
        await tx.$executeRawUnsafe(`
          UPDATE "inventory_transactions" SET "transactionDate"=$2,"vehicleType"=$3,"vehicleId"=$4
          WHERE "jobCardId"=$1 AND "type"='ISSUE'`,
          card.id, transactionDate, vehicleType, vehicleId)
      }

      if (old.sourceType === 'OIL_CHANGE') {
        if (vehicleType !== 'truck') throw new Error('Oil-change inventory issues must remain assigned to a truck')
        const source = await tx.maintenanceRecord.findFirst({
          where: { id: String(old.sourceId || ''), isDeleted: false, isOilChange: true },
          select: { id: true }
        })
        if (!source) throw new Error('Linked oil-change record was not found')
        await tx.maintenanceRecord.update({
          where: { id: source.id },
          data: { truckId: vehicleId, datePerformed: transactionDate, oilQuantityLiters: quantity }
        })
      }

      const updated = await tx.$queryRawUnsafe<any[]>(`
        UPDATE "inventory_transactions"
        SET "itemId"=$2,"quantity"=$3,"transactionDate"=$4,"reference"=$5,
            "vehicleType"=$6,"vehicleId"=$7,"unitCost"=$8,"notes"=$9
        WHERE "id"=$1 RETURNING *`,
        transactionId, itemId, quantity, transactionDate,
        body.reference ? String(body.reference).trim() : null,
        vehicleType, vehicleId, unitCost,
        body.notes ? String(body.notes).trim() : null)
      return updated[0]
    }, { timeout: 30000, maxWait: 10000 })
    return NextResponse.json({ transaction: result, updatedBy: user.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update issued part'
    const status = message === 'Insufficient permissions' ? 403
      : message === 'Inventory transaction not found' || message === 'Inventory item not found' ||
        message === 'Selected vehicle not found or inactive' || message.includes('record was not found') ? 404
      : message.includes('Only issued-part') || message.includes('Enter a part') ||
        message.includes('does not support') || message.includes('multiple or missing') ||
        message.includes('must remain assigned') ? 400
      : message.includes('Insufficient stock') ? 409 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
