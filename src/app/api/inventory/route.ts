import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireRolePermission } from '@/lib/permission-middleware'
import { getOrCreateOpenJobCard } from '@/lib/tire-lifecycle'

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
      let jobCardId = typeof body.jobCardId === 'string' && body.jobCardId.trim() ? body.jobCardId.trim() : null
      if (type === 'ISSUE' && vehicleId && ['truck','trailer'].includes(normalizedVehicleType)) {
        const vehicleType = normalizedVehicleType as 'truck' | 'trailer'
        const vehicle = vehicleType === 'truck'
          ? await tx.truck.findFirst({ where: { id: vehicleId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true, driverName: true } })
          : await tx.trailer.findFirst({ where: { id: vehicleId, isDeleted: false }, select: { id: true, driverName: true } })
        if (!vehicle) throw new Error('Selected vehicle not found or inactive')
        if (jobCardId) {
          await tx.$executeRaw`LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE`
          const where = vehicleType === 'truck'
            ? { id: jobCardId, truckId: vehicleId, status: { in: ['OPEN', 'IN_PROGRESS'] }, creationSource: { not: 'WORKBOOK' } }
            : { id: jobCardId, trailerId: vehicleId, status: { in: ['OPEN', 'IN_PROGRESS'] }, creationSource: { not: 'WORKBOOK' } }
          const linkedCard = await tx.workshopJobCard.findFirst({ where, select: { id: true } })
          if (!linkedCard) throw new Error('Selected job card does not belong to this vehicle')
        } else {
          jobCardId = await getOrCreateOpenJobCard(tx, { vehicleType, vehicleId }, {
            eventAt: transactionDate, driverName: vehicle.driverName, userId: user.id,
            creationSource: 'SPARE_PARTS', serviceType: 'SPARE PARTS', reportedIssue: 'Automatically created from spare-parts issue'
          })
        }
      } else if (type === 'ISSUE' && jobCardId) {
        await tx.$executeRaw`LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE`
        if (vehicleId && !['truck','trailer'].includes(normalizedVehicleType)) throw new Error('Select a valid vehicle type for this job-card issue')
        const linkedCard = await tx.workshopJobCard.findFirst({
          where: { id: jobCardId, status: { in: ['OPEN', 'IN_PROGRESS'] }, creationSource: { not: 'WORKBOOK' } },
          select: { id: true, truckId: true, trailerId: true }
        })
        if (!linkedCard) throw new Error('Selected job card is not open')
        if (!vehicleId) {
          if (linkedCard.truckId) {
            const active = await tx.truck.findFirst({ where: { id: linkedCard.truckId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
            if (!active) throw new Error('Selected vehicle not found or inactive')
            body.vehicleType = 'truck'; body.vehicleId = linkedCard.truckId
          } else if (linkedCard.trailerId) {
            const active = await tx.trailer.findFirst({ where: { id: linkedCard.trailerId, isDeleted: false, status: { not: 'INACTIVE' } }, select: { id: true } })
            if (!active) throw new Error('Selected vehicle not found or inactive')
            body.vehicleType = 'trailer'; body.vehicleId = linkedCard.trailerId
          }
        }
      }
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
        ("id","itemId","type","quantity","transactionDate","reference","vehicleType","vehicleId","jobCardId","unitCost","notes","createdById")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        id, body.itemId, type, quantity, transactionDate, body.reference || null,
        normalizedVehicleType || (body.vehicleType ? String(body.vehicleType).toLowerCase() : null) || null, vehicleId || body.vehicleId || null, jobCardId,
        resolvedUnitCost, body.notes || null, user.id)
      if (type === 'ISSUE' && jobCardId) {
        const card = await tx.workshopJobCard.findUnique({
          where: { id: jobCardId }, select: { id: true, items: true, partsCost: true, totalCost: true }
        })
        if (!card) throw new Error('Selected job card not found')
        const currentItems = Array.isArray(card.items) ? card.items as any[] : []
        const lineCost = quantity * Number(resolvedUnitCost || 0)
        const line = {
          type: 'PART', description: item[0].name, quantity, inventoryItemId: body.itemId,
          unitCost: Number(resolvedUnitCost || 0), remarks: String(body.notes || 'Issued from spare-parts inventory')
        }
        await tx.workshopJobCard.update({
          where: { id: jobCardId },
          data: {
            items: [...currentItems, line],
            partsCost: Number(card.partsCost || 0) + lineCost,
            totalCost: Number(card.totalCost || 0) + lineCost
          }
        })
      }
      return inserted
    })
    return NextResponse.json({ transaction: created[0] }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save inventory transaction'
    const status = message === 'Insufficient stock for this transaction' ? 409 : message === 'Inventory item not found' || message === 'Selected vehicle not found or inactive' ? 404 : message === 'Selected job card does not belong to this vehicle' || message === 'Selected job card is not open' || message === 'Select a valid vehicle type for this job-card issue' ? 400 : message === 'Selected job card not found' ? 404 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
