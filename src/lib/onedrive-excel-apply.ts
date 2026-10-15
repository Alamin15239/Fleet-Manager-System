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

  throw new Error('This workbook row type is not supported for importing.')
}
