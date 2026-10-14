const allowedStatuses = new Set(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
const allowedPriorities = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
const checklistKeys = ['engineOil', 'airFilter', 'fuelFilter', 'brakes', 'tyres', 'battery', 'lights', 'belts', 'cooling', 'transmission']

export function cleanJobCardPayload(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Enter valid job card details')
  const truckId = typeof body.truckId === 'string' ? body.truckId : ''
  const trailerId = typeof body.trailerId === 'string' ? body.trailerId : ''
  if (Boolean(truckId) === Boolean(trailerId)) throw new Error('Select exactly one truck or trailer')
  const serviceDate = new Date(body.serviceDate)
  if (!body.serviceDate || Number.isNaN(serviceDate.getTime())) throw new Error('Enter a valid service date')
  const serviceType = String(body.serviceType || '').trim()
  if (!serviceType) throw new Error('Service type is required')
  const status = String(body.status || 'OPEN')
  if (!allowedStatuses.has(status)) throw new Error('Select a valid job card status')
  const priority = String(body.priority || 'NORMAL')
  if (!allowedPriorities.has(priority)) throw new Error('Select a valid job card priority')
  const items = Array.isArray(body.items) ? body.items.filter((item: any) => item && typeof item === 'object').slice(0, 50).map((item: any) => ({
    type: String(item.type || 'PART').trim().slice(0, 60),
    description: String(item.description || '').trim().slice(0, 300),
    quantity: Math.min(999999, Math.max(0, Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 0)),
    remarks: String(item.remarks || '').trim().slice(0, 300)
  })).filter((item: any) => item.description && item.quantity > 0) : []
  const inputChecklist = body.checklist && typeof body.checklist === 'object' ? body.checklist : {}
  const checklist = Object.fromEntries(checklistKeys.map(key => [key, ['OK', 'REPAIR', 'NA'].includes(inputChecklist[key]) ? inputChecklist[key] : '']))
  const optionalDate = body.nextServiceDate ? new Date(body.nextServiceDate) : null
  if (optionalDate && Number.isNaN(optionalDate.getTime())) throw new Error('Enter a valid next service date')
  const integerOrNull = (value: any) => {
    if (value === '' || value == null) return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null
  }
  const moneyOrZero = (value: any) => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) return 0
    return Math.round(parsed * 100) / 100
  }
  const partsCost = moneyOrZero(body.partsCost)
  const laborCost = moneyOrZero(body.laborCost)
  const odometerKm = integerOrNull(body.odometerKm)
  const requestedNextServiceOdometer = integerOrNull(body.nextServiceOdometer)

  return {
    truckId: truckId || null,
    trailerId: trailerId || null,
    serviceDate,
    odometerKm,
    serviceType,
    priority,
    reportedIssue: String(body.reportedIssue || '').trim().slice(0, 5000) || null,
    technicianName: String(body.technicianName || '').trim() || null,
    driverName: String(body.driverName || '').trim() || null,
    status,
    nextServiceOdometer: requestedNextServiceOdometer ?? (odometerKm == null ? null : odometerKm + 5000),
    nextServiceDate: optionalDate,
    partsCost,
    laborCost,
    totalCost: Math.round((partsCost + laborCost) * 100) / 100,
    notes: String(body.notes || '').trim().slice(0, 5000) || null,
    items,
    checklist,
    technicianSignature: String(body.technicianSignature || '').trim().slice(0, 300) || null,
    supervisorSignature: String(body.supervisorSignature || '').trim().slice(0, 300) || null,
    driverSignature: String(body.driverSignature || '').trim().slice(0, 300) || null
  }
}
