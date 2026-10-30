import { randomUUID } from 'crypto'

type InventoryLine = { type?: string; inventoryItemId?: string | null; description?: string; quantity?: number; unitCost?: number | null }

async function ensureInventoryTables(tx: any) {
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "inventory_items" (
    "id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "partNumber" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL', "unit" TEXT NOT NULL DEFAULT 'pcs',
    "oilGrade" TEXT, "reorderLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
  await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "inventory_transactions" (
    "id" TEXT PRIMARY KEY, "itemId" TEXT NOT NULL REFERENCES "inventory_items"("id") ON DELETE RESTRICT,
    "type" TEXT NOT NULL, "quantity" DOUBLE PRECISION NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL, "reference" TEXT,
    "vehicleType" TEXT, "vehicleId" TEXT, "jobCardId" TEXT,
    "unitCost" DOUBLE PRECISION, "notes" TEXT, "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`)
}

export async function reconcileJobCardInventory(tx: any, args: {
  jobCardId: string; lines: InventoryLine[]; vehicleType: 'truck' | 'trailer';
  vehicleId: string; transactionDate: Date; userId: string
}) {
  await ensureInventoryTables(tx)
  const previous = await tx.$queryRawUnsafe<any[]>(
    `SELECT "itemId", SUM(CASE WHEN "type"='ISSUE' THEN "quantity" WHEN "type"='CUSTOMER_RETURN' THEN -"quantity" ELSE 0 END)::float AS qty
     FROM "inventory_transactions" WHERE "jobCardId"=$1 GROUP BY "itemId" HAVING SUM(CASE WHEN "type"='ISSUE' THEN "quantity" WHEN "type"='CUSTOMER_RETURN' THEN -"quantity" ELSE 0 END)>0`,
    args.jobCardId
  )
  for (const row of previous) {
    const qty = Number(row.qty)
    if (qty > 0) await tx.$queryRawUnsafe(
      `INSERT INTO "inventory_transactions" ("id","itemId","type","quantity","transactionDate","reference","jobCardId","notes","createdById")
       VALUES ($1,$2,'CUSTOMER_RETURN',$3,$4,$5,$6,$7,$8)`,
      `itx_${randomUUID()}`, row.itemId, qty, args.transactionDate, `Job card ${args.jobCardId}`,
      args.jobCardId, 'Automatic reversal of previous job-card issue', args.userId
    )
  }

  if (args.lines.some(line => line.type === 'PART' && line.inventoryItemId)) {
    for (const line of args.lines.filter(line => line.type === 'PART' && line.inventoryItemId)) {
      const qty = Number(line.quantity)
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('Enter a valid quantity for each inventory part')
      const item = await tx.$queryRawUnsafe<any[]>(
        `SELECT "id" FROM "inventory_items" WHERE "id"=$1 FOR UPDATE`, line.inventoryItemId
      )
      if (!item.length) throw new Error(`Inventory item not found: ${line.description || line.inventoryItemId}`)
      const balance = await tx.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(SUM(CASE WHEN "type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN "quantity" WHEN "type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -"quantity" ELSE 0 END),0)::float AS qty FROM "inventory_transactions" WHERE "itemId"=$1`,
        line.inventoryItemId
      )
      if (Number(balance[0]?.qty || 0) + 0.000001 < qty) throw new Error(`Insufficient stock for ${line.description || 'selected part'}`)
      await tx.$queryRawUnsafe(
        `INSERT INTO "inventory_transactions" ("id","itemId","type","quantity","transactionDate","reference","vehicleType","vehicleId","jobCardId","unitCost","notes","createdById")
         VALUES ($1,$2,'ISSUE',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        `itx_${randomUUID()}`, line.inventoryItemId, qty, args.transactionDate,
        `Job card ${args.jobCardId}`, args.vehicleType, args.vehicleId, args.jobCardId,
        line.unitCost == null ? null : Number(line.unitCost), line.description || 'Job card part issue', args.userId
      )
    }
  }
}


type OilChangeInventoryArgs = {
  maintenanceId: string
  inventoryItemId?: string | null
  quantityLiters?: number | null
  transactionDate: Date
  vehicleId: string
  userId: string
}

/** Reconciles oil consumption against the tenant's inventory ledger.
 * Reversals are append-only, preserving a complete audit trail on edits/deletes.
 */
export async function reconcileOilChangeInventory(tx: any, args: OilChangeInventoryArgs) {
  await ensureInventoryTables(tx)
  await tx.$executeRawUnsafe(`ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "sourceType" TEXT`)
  await tx.$executeRawUnsafe(`ALTER TABLE "inventory_transactions" ADD COLUMN IF NOT EXISTS "sourceId" TEXT`)

  const previous = await tx.$queryRawUnsafe<any[]>(
    `SELECT "itemId", SUM(CASE WHEN "type"='ISSUE' THEN "quantity" WHEN "type"='CUSTOMER_RETURN' THEN -"quantity" ELSE 0 END)::float AS qty
     FROM "inventory_transactions" WHERE "sourceType"='OIL_CHANGE' AND "sourceId"=$1
     GROUP BY "itemId"
     HAVING SUM(CASE WHEN "type"='ISSUE' THEN "quantity" WHEN "type"='CUSTOMER_RETURN' THEN -"quantity" ELSE 0 END)>0`,
    args.maintenanceId
  )

  for (const row of previous) {
    const qty = Number(row.qty)
    if (qty <= 0) continue
    await tx.$queryRawUnsafe(
      `INSERT INTO "inventory_transactions" ("id","itemId","type","quantity","transactionDate","reference","vehicleType","vehicleId","notes","createdById","sourceType","sourceId")
       VALUES ($1,$2,'CUSTOMER_RETURN',$3,$4,$5,'truck',$6,$7,$8,'OIL_CHANGE',$9)`,
      `itx_${randomUUID()}`, row.itemId, qty, args.transactionDate,
      `Oil change ${args.maintenanceId}`, args.vehicleId,
      'Automatic reversal of previous oil issue', args.userId, args.maintenanceId
    )
  }

  const qty = Number(args.quantityLiters || 0)
  if (!args.inventoryItemId || qty <= 0) return
  if (!Number.isFinite(qty)) throw new Error('Enter a valid oil quantity in litres')

  const item = await tx.$queryRawUnsafe<any[]>(
    `SELECT "id","unit" FROM "inventory_items" WHERE "id"=$1 FOR UPDATE`, args.inventoryItemId
  )
  if (!item.length) throw new Error('Selected oil inventory item was not found')
  if (!['l','liter','litre','liters','litres'].includes(String(item[0].unit || '').trim().toLowerCase()))
    throw new Error('Selected inventory item must use litres as its unit')

  const balance = await tx.$queryRawUnsafe<any[]>(
    `SELECT COALESCE(SUM(CASE WHEN "type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN "quantity" WHEN "type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -"quantity" ELSE 0 END),0)::float AS qty FROM "inventory_transactions" WHERE "itemId"=$1`,
    args.inventoryItemId
  )
  if (Number(balance[0]?.qty || 0) + 0.000001 < qty) throw new Error('Insufficient oil stock for this oil change')

  await tx.$queryRawUnsafe(
    `INSERT INTO "inventory_transactions" ("id","itemId","type","quantity","transactionDate","reference","vehicleType","vehicleId","notes","createdById","sourceType","sourceId")
     VALUES ($1,$2,'ISSUE',$3,$4,$5,'truck',$6,$7,$8,'OIL_CHANGE',$9)`,
    `itx_${randomUUID()}`, args.inventoryItemId, qty, args.transactionDate,
    `Oil change ${args.maintenanceId}`, args.vehicleId,
    'Oil consumed during oil change', args.userId, args.maintenanceId
  )
}
