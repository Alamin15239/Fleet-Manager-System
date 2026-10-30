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
    const allowed = ['OPENING','PURCHASE','ISSUE','CUSTOMER_RETURN','SUPPLIER_RETURN','ADJUSTMENT_IN','ADJUSTMENT_OUT']
    const type = String(body.type || '')
    const quantity = Number(body.quantity)
    if (!body.itemId || !allowed.includes(type) || !Number.isFinite(quantity) || quantity <= 0)
      return NextResponse.json({ error: 'Select a part, valid transaction type, and quantity greater than zero' }, { status: 400 })
    const transactionDate = body.transactionDate ? new Date(body.transactionDate) : now
    if (Number.isNaN(transactionDate.getTime())) return NextResponse.json({ error: 'Invalid transaction date' }, { status: 400 })
    const id = `itx_${crypto.randomUUID()}`
    const created = await db.$transaction(async tx => {
      const item = await tx.$queryRawUnsafe<any[]>(`SELECT "id" FROM "inventory_items" WHERE "id"=$1 FOR UPDATE`, body.itemId)
      if (!item.length) throw new Error('Inventory item not found')
      const balance = await tx.$queryRawUnsafe<any[]>(`
        SELECT COALESCE(SUM(CASE WHEN "type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN "quantity" WHEN "type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -"quantity" ELSE 0 END),0)::float AS qty
        FROM "inventory_transactions" WHERE "itemId"=$1`, body.itemId)
      const delta = ['ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT'].includes(type) ? -quantity : quantity
      if (Number(balance[0]?.qty || 0) + delta < -0.000001) throw new Error('Insufficient stock for this transaction')
      return tx.$queryRawUnsafe<any[]>(`
        INSERT INTO "inventory_transactions"
        ("id","itemId","type","quantity","transactionDate","reference","vehicleType","vehicleId","jobCardId","unitCost","notes","createdById")
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
        id, body.itemId, type, quantity, transactionDate, body.reference || null,
        body.vehicleType || null, body.vehicleId || null, body.jobCardId || null,
        body.unitCost == null ? null : Number(body.unitCost), body.notes || null, user.id)
    })
    return NextResponse.json({ transaction: created[0] }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save inventory transaction'
    const status = message === 'Insufficient stock for this transaction' ? 409 : message === 'Inventory item not found' ? 404 : message === 'Insufficient permissions' ? 403 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
