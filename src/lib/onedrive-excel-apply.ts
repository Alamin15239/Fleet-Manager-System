import { cleanJobCardPayload } from '@/lib/job-card-validation'

type Row = Record<string, unknown>
type Change = { entityType: string; operation: string; recordId: string | null; rowData: unknown; changes?: unknown }

function text(row: Row, key: string, required = false) {
  const value = String(row[key] ?? '').trim()
  if (required && !value) throw new Error(`${key} is required.`)
  return value || null
}

function numberValue(row: Row, key: string, options: { required?: boolean; integer?: boolean; minimum?: number } = {}) {
  const raw = row[key]
  if (raw === '' || raw == null) {
    if (options.required) throw new Error(`${key} is required.`)
    return null
  }
  const value = Number(raw)
  if (!Number.isFinite(value) || (options.integer && !Number.isInteger(value)) || (options.minimum != null && value < options.minimum)) {
    throw new Error(`${key} is invalid.`)
  }
  return value
}

function dateValue(row: Row, key: string, required = false) {
  const raw = row[key]
  if (raw === '' || raw == null) {
    if (required) throw new Error(`${key} is required.`)
    return null
  }
  const value = raw instanceof Date
    ? raw
    : typeof raw === 'number'
      ? new Date(Math.round((raw - 25569) * 24 * 60 * 60 * 1000))
      : new Date(String(raw))
  if (Number.isNaN(value.getTime())) throw new Error(`${key} is invalid.`)
  return value
}

function jsonValue(value: unknown, fallback: unknown) {
  if (value && typeof value === 'object') return value
  if (typeof value !== 'string' || !value.trim()) return fallback
  try { return JSON.parse(value) } catch { throw new Error('A JSON column contains invalid data.') }
}

function enumValue(value: unknown, values: string[], label: string, fallback?: string) {
  const normalized = String(value || fallback || '').trim().toUpperCase()
  if (!values.includes(normalized)) throw new Error(`${label} must be one of: ${values.join(', ')}.`)
  return normalized
}

function tireOrigin(value: unknown) {
  const normalized = String(value || 'OTHER').trim().toUpperCase()
  const aliases: Record<string, string> = { CHINA: 'CHINESE', JAPAN: 'JAPANESE', 'SAUDI ARABIA': 'SAUDI' }
  return enumValue(aliases[normalized] || normalized, ['CHINESE', 'SAUDI', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER'], 'Origin', 'OTHER')
}

function changedHeaders(change: Change) {
  const value = change.changes
  return new Set(value && typeof value === 'object' ? Object.keys(value as Record<string, unknown>) : [])
}

function updateFields(data: Record<string, unknown>, change: Change, headerMap: Record<string, string[]>) {
  if (change.operation === 'CREATE') return data
  const changed = changedHeaders(change)
  const result: Record<string, any> = {}
  for (const [header, fields] of Object.entries(headerMap)) {
    if (!changed.has(header)) continue
    for (const field of fields) if (field in data) result[field] = data[field]
  }
  return result
}

async function resolveVehicle(tx: any, row: Row, assetType: string) {
  const number = text(row, 'Truck / Trailer', true)!
  if (assetType.toLowerCase() === 'trailer') {
    const trailer = await tx.trailer.findFirst({ where: { number, isDeleted: false }, select: { id: true } })
    if (!trailer) throw new Error(`Trailer ${number} was not found.`)
    return { truckId: null, trailerId: trailer.id }
  }
  const truck = await tx.truck.findFirst({ where: { licensePlate: number, isDeleted: false }, select: { id: true } })
  if (!truck) throw new Error(`Truck ${number} was not found.`)
  return { truckId: truck.id, trailerId: null }
}

export async function applyWorkbookChange(tx: any, change: Change, userId: string) {
  const row = change.rowData as Row
  const isCreate = change.operation === 'CREATE'
  const recordId = change.recordId || String(row['Record ID'] || '').trim()

  if (change.entityType === 'TRUCK') {
    const year = numberValue(row, 'Year', { required: true, integer: true, minimum: 1900 })!
    if (year > new Date().getFullYear() + 1) throw new Error('Year is outside the supported range.')
    const data = {
      vin: text(row, 'VIN', true)!, make: text(row, 'Make', true)!, model: text(row, 'Model', true)!,
      year,
      licensePlate: text(row, 'Truck Number', true)!,
      currentMileage: numberValue(row, 'Mileage (km)', { integer: true, minimum: 0 }) ?? 0,
      driverName: text(row, 'Driver'),
      status: enumValue(row.Status, ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], 'Status', 'ACTIVE'),
      healthScore: numberValue(row, 'Health Score', { minimum: 0 }),
      riskLevel: enumValue(row['Risk Level'], ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 'Risk Level', 'LOW'),
      lastOilChange: dateValue(row, 'Last Oil Change'),
      nextOilChange: dateValue(row, 'Next Oil Change')
    }
    const duplicatePlate = await tx.truck.findFirst({
      where: { licensePlate: data.licensePlate, isDeleted: false, ...(recordId ? { id: { not: recordId } } : {}) },
      select: { id: true }
    })
    if (duplicatePlate) throw new Error('A truck with this truck number already exists.')
    const update = updateFields(data, change, {
      'VIN': ['vin'], 'Make': ['make'], 'Model': ['model'], 'Year': ['year'], 'Truck Number': ['licensePlate'],
      'Mileage (km)': ['currentMileage'], 'Driver': ['driverName'], 'Status': ['status'], 'Health Score': ['healthScore'],
      'Risk Level': ['riskLevel'], 'Last Oil Change': ['lastOilChange'], 'Next Oil Change': ['nextOilChange']
    })
    return isCreate ? tx.truck.create({ data }) : tx.truck.update({ where: { id: recordId }, data: update })
  }

  if (change.entityType === 'TRAILER') {
    const data = {
      number: text(row, 'Trailer Number', true)!,
      driverName: text(row, 'Driver'),
      status: enumValue(row.Status, ['ACTIVE', 'INACTIVE', 'MAINTENANCE'], 'Status', 'ACTIVE'),
      healthScore: numberValue(row, 'Health Score', { minimum: 0 }),
      riskLevel: enumValue(row['Risk Level'], ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], 'Risk Level', 'LOW'),
      lastInspection: dateValue(row, 'Last Inspection'),
      nextInspection: dateValue(row, 'Next Inspection')
    }
    const update = updateFields(data, change, {
      'Trailer Number': ['number'], 'Driver': ['driverName'], 'Status': ['status'], 'Health Score': ['healthScore'],
      'Risk Level': ['riskLevel'], 'Last Inspection': ['lastInspection'], 'Next Inspection': ['nextInspection']
    })
    return isCreate ? tx.trailer.create({ data }) : tx.trailer.update({ where: { id: recordId }, data: update })
  }

  if (change.entityType === 'TIRE') {
    const plateNumber = text(row, 'Truck Number')
    const trailerNumber = text(row, 'Trailer Number')
    if (!isCreate && changedHeaders(change).has('Date') && !dateValue(row, 'Date')) {
      throw new Error('Tire Date cannot be blank.')
    }
    const data = {
      tireSize: text(row, 'Tire Size', true)!,
      plateNumber,
      trailerNumber,
      driverName: text(row, 'Driver'),
      quantity: numberValue(row, 'Quantity', { required: true, integer: true, minimum: 0 })!,
      serialNumber: text(row, 'Serial Number'),
      // Older/source tire rows may not include a manufacturer. Keep that field
      // blank rather than rejecting the row or inventing a manufacturer value.
      manufacturer: String(row.Manufacturer ?? '').trim(),
      origin: tireOrigin(row.Origin),
      notes: text(row, 'Notes'),
      ...(dateValue(row, 'Date') ? { createdAt: dateValue(row, 'Date')! } : {})
    }
    const update = updateFields(data, change, {
      'Tire Size': ['tireSize'], 'Truck Number': ['plateNumber'], 'Trailer Number': ['trailerNumber'], 'Driver': ['driverName'],
      'Quantity': ['quantity'], 'Serial Number': ['serialNumber'], 'Manufacturer': ['manufacturer'], 'Origin': ['origin'],
      'Date': ['createdAt'], 'Notes': ['notes']
    })
    const changed = changedHeaders(change)
    if ((isCreate || changed.has('Truck Number') || changed.has('Trailer Number') || changed.has('Driver')) && plateNumber) {
      await tx.vehicle.upsert({
        where: { plateNumber },
        create: { plateNumber, trailerNumber, driverName: text(row, 'Driver') },
        update: { ...(trailerNumber ? { trailerNumber } : {}), driverName: text(row, 'Driver') }
      })
    }
    return isCreate ? tx.tire.create({ data: { ...data, createdById: userId } }) : tx.tire.update({ where: { id: recordId }, data: update })
  }

  if (change.entityType === 'MAINTENANCE' || change.entityType === 'OIL_CHANGE') {
    const oilChange = change.entityType === 'OIL_CHANGE'
    const assetType = oilChange ? 'Truck' : String(row['Asset Type'] || 'Truck')
    const vehicleRow = oilChange ? { ...row, 'Truck / Trailer': row['Truck Number'] } : row
    const { truckId, trailerId } = await resolveVehicle(tx, vehicleRow, assetType)
    const datePerformed = dateValue(row, oilChange ? 'Service Date' : 'Service Date', true)!
    const partsCost = numberValue(row, 'Parts Cost', { minimum: 0 }) ?? 0
    const laborCost = numberValue(row, 'Labor Cost', { minimum: 0 }) ?? 0
    const totalCost = numberValue(row, 'Total Cost', { minimum: 0 }) ?? partsCost + laborCost
    const common: Record<string, any> = {
      serviceType: (oilChange ? text(row, 'Service Type') : text(row, 'Service Type', true)) || 'Oil Change',
      description: text(row, oilChange ? 'Notes' : 'Description'),
      datePerformed,
      partsCost,
      laborCost,
      totalCost,
      mechanicName: text(row, 'Mechanic'),
      driverName: text(row, 'Driver'),
      nextServiceDue: dateValue(row, oilChange ? 'Next Service Due' : 'Next Service Due'),
      notes: text(row, 'Notes'),
      status: enumValue(row.Status, ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], 'Status', 'COMPLETED')
    }
    const mechanicName = text(row, 'Mechanic')
    const mechanic = mechanicName
      ? await tx.mechanic.findFirst({ where: { name: mechanicName }, select: { id: true } })
      : null
    if (mechanic) common.mechanicId = mechanic.id

    const relationFields = !isCreate && !changedHeaders(change).has('Asset Type') && !changedHeaders(change).has('Truck / Trailer') && !(oilChange && changedHeaders(change).has('Truck Number'))
      ? {}
      : trailerId ? { trailerId } : { truckId }
    const commonUpdate: Record<string, any> = updateFields(common, change, {
      'Service Type': ['serviceType'], 'Description': ['description'], 'Service Date': ['datePerformed'],
      'Parts Cost': ['partsCost'], 'Labor Cost': ['laborCost'], 'Total Cost': ['totalCost'], 'Mechanic': ['mechanicName'],
      'Driver': ['driverName'], 'Next Service Due': ['nextServiceDue'], 'Notes': oilChange ? ['notes', 'description'] : ['notes'],
      'Status': ['status'], 'Mileage (km)': ['currentMileage'], 'Oil Quantity (L)': ['oilQuantityLiters'],
      'Interval (km)': ['oilChangeInterval']
    })
    if (!isCreate && (changedHeaders(change).has('Parts Cost') || changedHeaders(change).has('Labor Cost')) && !changedHeaders(change).has('Total Cost')) {
      commonUpdate.totalCost = partsCost + laborCost
    }
    if (changedHeaders(change).has('Mechanic')) commonUpdate.mechanicId = mechanic?.id || null

    if (trailerId) {
      if (!isCreate && !(await tx.trailerMaintenanceRecord.findUnique({ where: { id: recordId }, select: { id: true } }))) {
        throw new Error('Maintenance asset type cannot be changed in Excel. Add a separate row for the other asset type.')
      }
      return isCreate
        ? tx.trailerMaintenanceRecord.create({ data: { ...common, trailerId, createdById: userId } })
        : tx.trailerMaintenanceRecord.update({ where: { id: recordId }, data: { ...commonUpdate, ...relationFields } })
    }
    const truckFields = {
      ...common,
      truckId: truckId!,
      ...(isCreate ? { isOilChange: oilChange } : {}),
      currentMileage: numberValue(row, 'Mileage (km)', { integer: true, minimum: 0 }),
      oilQuantityLiters: numberValue(row, 'Oil Quantity (L)', { minimum: 0 }),
      oilChangeInterval: numberValue(row, 'Interval (km)', { integer: true, minimum: 0 })
    }
    if (!isCreate && !(await tx.maintenanceRecord.findUnique({ where: { id: recordId }, select: { id: true } }))) {
      throw new Error('Maintenance asset type cannot be changed in Excel. Add a separate row for the other asset type.')
    }
    return isCreate
      ? tx.maintenanceRecord.create({ data: { ...truckFields, createdById: userId } })
      : tx.maintenanceRecord.update({ where: { id: recordId }, data: { ...commonUpdate, ...updateFields(truckFields, change, { 'Mileage (km)': ['currentMileage'], 'Oil Quantity (L)': ['oilQuantityLiters'], 'Interval (km)': ['oilChangeInterval'] }), ...relationFields } })
  }

  if (change.entityType === 'JOBCARD') {
    const truckNumber = text(row, 'Truck Number')
    const trailerNumber = text(row, 'Trailer Number')
    let truckId: string | null = null
    let trailerId: string | null = null
    if (truckNumber) truckId = (await tx.truck.findFirst({ where: { licensePlate: truckNumber, isDeleted: false }, select: { id: true } }))?.id || null
    if (trailerNumber) trailerId = (await tx.trailer.findFirst({ where: { number: trailerNumber, isDeleted: false }, select: { id: true } }))?.id || null
    if ((!truckId && !trailerId) || (truckId && trailerId)) throw new Error('Select exactly one valid truck or trailer.')
    const payload = cleanJobCardPayload({
      truckId: truckId || '', trailerId: trailerId || '', serviceDate: dateValue(row, 'Service Date', true),
      odometerKm: row['Odometer (km)'], serviceType: row['Service Type'], priority: row.Priority, status: row.Status,
      reportedIssue: row['Reported Issue'], technicianName: row.Technician, driverName: row.Driver,
      partsCost: row['Parts Cost'], laborCost: row['Labor Cost'], totalCost: row['Total Cost'],
      nextServiceOdometer: row['Next Service Odometer'], nextServiceDate: dateValue(row, 'Next Service Date'),
      items: jsonValue(row['Work Items'], []), checklist: jsonValue(row.Checklist, {}), notes: row.Notes
    })
    const jobCardUpdate = updateFields(payload, change, {
      'Job Number': ['jobNumber'], 'Service Date': ['serviceDate'], 'Truck Number': ['truckId'], 'Trailer Number': ['trailerId'],
      'Odometer (km)': ['odometerKm'], 'Service Type': ['serviceType'], 'Priority': ['priority'], 'Status': ['status'],
      'Reported Issue': ['reportedIssue'], 'Technician': ['technicianName'], 'Driver': ['driverName'], 'Total Cost': ['totalCost'],
      'Parts Cost': ['partsCost'], 'Labor Cost': ['laborCost'], 'Next Service Odometer': ['nextServiceOdometer'],
      'Next Service Date': ['nextServiceDate'], 'Work Items': ['items'], 'Checklist': ['checklist'], 'Notes': ['notes']
    })
    if (isCreate) {
      const requestedNumber = text(row, 'Job Number')
      if (requestedNumber) return tx.workshopJobCard.create({ data: { ...payload, jobNumber: requestedNumber, createdById: userId } })
      const year = payload.serviceDate.getFullYear()
      const prefix = `JC-${year}-`
      await tx.$executeRaw`LOCK TABLE "workshop_job_cards" IN EXCLUSIVE MODE`
      const count = await tx.workshopJobCard.count({ where: { jobNumber: { startsWith: prefix } } })
      return tx.workshopJobCard.create({ data: { ...payload, jobNumber: `${prefix}${String(count + 1).padStart(4, '0')}`, createdById: userId } })
    }
    if (changedHeaders(change).has('Truck Number') || changedHeaders(change).has('Trailer Number')) {
      jobCardUpdate.truckId = truckId
      jobCardUpdate.trailerId = trailerId
    }
    if (changedHeaders(change).has('Job Number')) jobCardUpdate.jobNumber = text(row, 'Job Number', true)
    return tx.workshopJobCard.update({ where: { id: recordId }, data: jobCardUpdate })
  }


  if (change.entityType === 'VEHICLE_DOCUMENT') {
    const ownerType = enumValue(row['Owner Type'], ['TRUCK', 'TRAILER', 'DRIVER', 'VEHICLE'], 'Owner Type',
      String(row['Owner Type'] || '').toUpperCase())
    const ownerName = text(row, 'Owner', true)!
    let owner: { vehicleId?: string | null; truckId?: string | null; trailerId?: string | null; driverId?: string | null } = {}
    if (ownerType === 'TRUCK') {
      const truck = await tx.truck.findFirst({ where: { licensePlate: ownerName, isDeleted: false }, select: { id: true } })
      if (!truck) throw new Error(`Truck ${ownerName} was not found.`)
      owner = { vehicleId: null, truckId: truck.id, trailerId: null, driverId: null }
    } else if (ownerType === 'TRAILER') {
      const trailer = await tx.trailer.findFirst({ where: { number: ownerName, isDeleted: false }, select: { id: true } })
      if (!trailer) throw new Error(`Trailer ${ownerName} was not found.`)
      owner = { vehicleId: null, truckId: null, trailerId: trailer.id, driverId: null }
    } else if (ownerType === 'DRIVER') {
      const driver = await tx.driver.findFirst({ where: { name: ownerName, isDeleted: false }, select: { id: true } })
      if (!driver) throw new Error(`Driver ${ownerName} was not found.`)
      owner = { vehicleId: null, truckId: null, trailerId: null, driverId: driver.id }
    } else {
      const vehicle = await tx.fleetVehicle.findFirst({ where: { vehicleNumber: ownerName }, select: { id: true } })
      if (!vehicle) throw new Error(`Fleet vehicle ${ownerName} was not found.`)
      owner = { vehicleId: vehicle.id, truckId: null, trailerId: null, driverId: null } as any
    }
    const data = {
      ...owner,
      title: text(row, 'Document Title', true)!,
      documentType: text(row, 'Document Type', true)!,
      validFrom: dateValue(row, 'Issue / Valid From'),
      validUntil: dateValue(row, 'Expiry / Valid Until'),
      reminderStartDate: dateValue(row, 'Reminder Starts'),
      fileName: text(row, 'File Name'),
      notes: text(row, 'Notes')
    }
    if (isCreate) return tx.vehicleDocument.create({ data })
    const update = updateFields(data, change, {
      'Owner Type': ['vehicleId', 'truckId', 'trailerId', 'driverId'], 'Owner': ['vehicleId', 'truckId', 'trailerId', 'driverId'],
      'Document Title': ['title'], 'Document Type': ['documentType'],
      'Issue / Valid From': ['validFrom'], 'Expiry / Valid Until': ['validUntil'],
      'Reminder Starts': ['reminderStartDate'], 'File Name': ['fileName'], 'Notes': ['notes']
    })
    return tx.vehicleDocument.update({ where: { id: recordId }, data: update })
  }

  if (change.entityType === 'SPARE_PART') {
    const name = text(row, 'Part Name', true)!
    const partNumber = text(row, 'Part Number')
    const category = text(row, 'Category', true)!
    const unit = text(row, 'Unit', true)!
    const oilGrade = text(row, 'Oil Grade')
    const reorderLevel = numberValue(row, 'Reorder Level', { minimum: 0 }) ?? 0
    const id = recordId || `inv_${crypto.randomUUID()}`
    const itemExists = !isCreate && (await tx.$queryRawUnsafe(`SELECT "id" FROM "inventory_items" WHERE "id"=$1`, id)).length > 0
    if (isCreate) {
      await tx.$executeRawUnsafe(`INSERT INTO "inventory_items" ("id","name","partNumber","category","unit","oilGrade","reorderLevel") VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        id, name, partNumber, category, unit, oilGrade, reorderLevel)
    } else {
      if (!itemExists) throw new Error('Inventory item was not found.')
      const changed = changedHeaders(change)
      const fields: string[] = []
      const values: unknown[] = []
      const add = (header: string, column: string, value: unknown) => { if (changed.has(header)) { values.push(value); fields.push(`"${column}"=${values.length}`) } }
      add('Part Name','name',name); add('Part Number','partNumber',partNumber); add('Category','category',category)
      add('Unit','unit',unit); add('Oil Grade','oilGrade',oilGrade); add('Reorder Level','reorderLevel',reorderLevel)
      if (fields.length) {
        values.push(new Date(), id)
        await tx.$executeRawUnsafe(`UPDATE "inventory_items" SET ${fields.join(',')}, "updatedAt"=${values.length-1} WHERE "id"=${values.length}`, ...values)
      }
    }
    const targetStock = numberValue(row, 'Current Stock', { minimum: 0 })
    if (targetStock != null) {
      await tx.$queryRawUnsafe(`SELECT \"id\" FROM \"inventory_items\" WHERE \"id\"=$1 FOR UPDATE`, id)
      const balance = await tx.$queryRawUnsafe(`SELECT COALESCE(SUM(CASE WHEN "type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN "quantity" WHEN "type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -"quantity" ELSE 0 END),0)::float AS qty FROM "inventory_transactions" WHERE "itemId"=$1`, id)
      const current = Number(balance[0]?.qty || 0)
      const delta = targetStock - current
      if (Math.abs(delta) > 0.000001) {
        await tx.$executeRawUnsafe(`UPDATE "inventory_items" SET "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, id)
        await tx.$executeRawUnsafe(
        `INSERT INTO "inventory_transactions" ("id","itemId","type","quantity","transactionDate","reference","notes","createdById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        `itx_${crypto.randomUUID()}`, id, delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', Math.abs(delta), new Date(),
        'Excel stock reconciliation', `Workbook stock count adjustment: ${current} to ${targetStock}`, userId)
      }
    }
    return { id }
  }

  if (change.entityType === 'STOCK_MOVEMENT') {
    const itemName = text(row, 'Part', true)!
    const item = await tx.$queryRawUnsafe(`SELECT i."id", i."unit" FROM "inventory_items" i WHERE lower(i."name")=lower($1) OR i."id"=$1 ORDER BY CASE WHEN i."id"=$1 THEN 0 ELSE 1 END LIMIT 1`, itemName)
    if (!item.length) throw new Error(`Inventory part ${itemName} was not found.`)
    const type = enumValue(row.Transaction, ['OPENING','PURCHASE','ISSUE','CUSTOMER_RETURN','SUPPLIER_RETURN','ADJUSTMENT_IN','ADJUSTMENT_OUT'], 'Transaction')
    const quantity = numberValue(row, 'Quantity', { required: true, minimum: 0.000001 })!
    const transactionDate = dateValue(row, 'Date', true)!
    await tx.$queryRawUnsafe(`SELECT \"id\" FROM \"inventory_items\" WHERE \"id\"=$1 FOR UPDATE`, item[0].id)
    const values = [item[0].id, type, quantity, transactionDate, text(row,'Reference'), text(row,'Vehicle Type'), text(row,'Vehicle ID'), text(row,'Job Card ID'), numberValue(row,'Unit Cost',{minimum:0}), text(row,'Notes')]
    if (isCreate) {
      const signed = ['ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT'].includes(type) ? -quantity : quantity
      const balance = await tx.$queryRawUnsafe(`SELECT COALESCE(SUM(CASE WHEN "type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN "quantity" WHEN "type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -"quantity" ELSE 0 END),0)::float AS qty FROM "inventory_transactions" WHERE "itemId"=$1`, item[0].id)
      if (Number(balance[0]?.qty || 0) + signed < -0.000001) throw new Error('Insufficient stock for this transaction.')
      const id = `itx_${crypto.randomUUID()}`
      await tx.$executeRawUnsafe(`INSERT INTO "inventory_transactions" ("id","itemId","type","quantity","transactionDate","reference","vehicleType","vehicleId","jobCardId","unitCost","notes","createdById") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        id, ...values, userId)
      return { id }
    }
    const existing = await tx.$queryRawUnsafe(`SELECT "id","itemId","type","quantity" FROM "inventory_transactions" WHERE "id"=$1 FOR UPDATE`, recordId)
    if (!existing.length) throw new Error('Stock movement was not found.')
    const [old] = existing
    const oldSigned = ['ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT'].includes(old.type) ? -Number(old.quantity) : Number(old.quantity)
    const newSigned = ['ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT'].includes(type) ? -quantity : quantity
    const balance = await tx.$queryRawUnsafe(`SELECT COALESCE(SUM(CASE WHEN "type" IN ('OPENING','PURCHASE','CUSTOMER_RETURN','ADJUSTMENT_IN') THEN "quantity" WHEN "type" IN ('ISSUE','SUPPLIER_RETURN','ADJUSTMENT_OUT') THEN -"quantity" ELSE 0 END),0)::float AS qty FROM "inventory_transactions" WHERE "itemId"=$1`, item[0].id)
    if (Number(balance[0]?.qty || 0) - (old.itemId === item[0].id ? oldSigned : 0) + newSigned < -0.000001) throw new Error('Insufficient stock for this transaction.')
    await tx.$executeRawUnsafe(`UPDATE "inventory_transactions" SET "itemId"=$2,"type"=$3,"quantity"=$4,"transactionDate"=$5,"reference"=$6,"vehicleType"=$7,"vehicleId"=$8,"jobCardId"=$9,"unitCost"=$10,"notes"=$11,"createdAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, recordId, ...values)
    return { id: recordId }
  }

  throw new Error('This workbook row type is not supported for importing.')
}
