import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { Workbook } from 'exceljs'
import { db } from '@/lib/db'

export const ONEDRIVE_WORKBOOK_NAME = 'Fleet Manager Live Data.xlsx'
const INTEGRATION_ID = 'primary'
const LOCK_TIMEOUT_MS = 5 * 60 * 1000

export interface OneDriveSyncResult {
  connected: boolean
  success: boolean
  queued?: boolean
  error?: string | null
  lastSyncAt?: Date | null
  webUrl?: string | null
  workbookName?: string | null
  recoveredFromLock?: boolean
  recordCounts?: Record<string, number>
}

export function isOneDriveConfigured() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY &&
    (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL)
  )
}

export function getOneDriveRedirectUri(origin?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : origin)
  if (!baseUrl) throw new Error('The app URL is not configured')
  return new URL('/api/integrations/onedrive/callback', baseUrl).toString()
}

class GraphRequestError extends Error {
  constructor(readonly status: number) {
    super(`OneDrive file update failed (Microsoft Graph HTTP ${status}).`)
    this.name = 'GraphRequestError'
  }
}

function getEncryptionKey() {
  const configuredKey = process.env.MICROSOFT_TOKEN_ENCRYPTION_KEY
  if (!configuredKey || configuredKey.length < 32) {
    throw new Error('Microsoft token encryption is not configured')
  }
  return createHash('sha256').update(configuredKey).digest()
}

function encryptRefreshToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`
}

function decryptRefreshToken(encryptedToken: string) {
  const [version, ivValue, tagValue, cipherValue] = encryptedToken.split(':')
  if (version !== 'v1' || !ivValue || !tagValue || !cipherValue) {
    throw new Error('Stored Microsoft connection is invalid. Reconnect OneDrive.')
  }
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(cipherValue, 'base64url')),
    decipher.final()
  ]).toString('utf8')
}

export async function saveOneDriveConnection(refreshToken: string, connectedEmail: string | null) {
  const refreshTokenEncrypted = encryptRefreshToken(refreshToken)
  return db.oneDriveIntegration.upsert({
    where: { id: INTEGRATION_ID },
    create: {
      id: INTEGRATION_ID,
      refreshTokenEncrypted,
      connectedEmail,
      lastSyncStatus: 'NEVER'
    },
    update: {
      refreshTokenEncrypted,
      connectedEmail,
      driveItemId: null,
      driveItemName: null,
      webUrl: null,
      lastSyncStatus: 'NEVER',
      lastSyncError: null,
      lastSyncAt: null,
      syncInProgressAt: null,
      syncRevision: { increment: 1 }
    }
  })
}

async function refreshAccessToken(refreshTokenEncrypted: string): Promise<{ access_token: string; refresh_token?: string }> {
  const refreshToken = decryptRefreshToken(refreshTokenEncrypted)
  const body = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    scope: 'offline_access User.Read Files.ReadWrite'
  })
  const response = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  })
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      throw new Error('OneDrive authorization expired. Reconnect your personal Microsoft account.')
    }
    throw new Error(`Could not refresh the OneDrive authorization (HTTP ${response.status}).`)
  }
  const tokens = await response.json() as { access_token?: string; refresh_token?: string }
  if (!tokens.access_token) throw new Error('Microsoft did not return an access token.')
  return { access_token: tokens.access_token, refresh_token: tokens.refresh_token }
}

async function graphRequest(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers
    }
  })
  if (!response.ok) {
    throw new GraphRequestError(response.status)
  }
  return response
}

function asExcelValue(value: unknown) {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) return `'${value}`
  if (value && typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value)
  return value ?? null
}

type ExportColumn = { header: string; key: string; width: number }

function addTableSheet(
  workbook: Workbook,
  name: string,
  tableName: string,
  columns: ExportColumn[],
  records: Record<string, unknown>[]
) {
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = columns.map(column => ({ key: column.key, width: column.width }))
  if (records.length) {
    sheet.addTable({
      name: tableName,
      ref: 'A1',
      headerRow: true,
      totalsRow: false,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: columns.map(column => ({ name: column.header, filterButton: true })),
      rows: records.map(record => columns.map(column => asExcelValue(record[column.key])))
    })
  } else {
    sheet.addRow(columns.map(column => column.header))
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
    sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}1` }
  }
  sheet.getRow(1).height = 24
  sheet.getRow(1).alignment = { vertical: 'middle', wrapText: true }
  return sheet
}

async function createFleetWorkbook() {
  const [trucks, trailers, truckMaintenance, trailerMaintenance, oilChanges, tires, jobCards] = await Promise.all([
    db.truck.findMany({ where: { isDeleted: false }, orderBy: { licensePlate: 'asc' } }),
    db.trailer.findMany({ where: { isDeleted: false }, orderBy: { number: 'asc' } }),
    db.maintenanceRecord.findMany({ where: { isDeleted: false }, include: { truck: { select: { licensePlate: true, make: true, model: true } } }, orderBy: { datePerformed: 'desc' } }),
    db.trailerMaintenanceRecord.findMany({ where: { isDeleted: false }, include: { trailer: { select: { number: true } } }, orderBy: { datePerformed: 'desc' } }),
    db.maintenanceRecord.findMany({
      where: {
        isDeleted: false,
        OR: [
          { isOilChange: true },
          { serviceType: { contains: 'oil', mode: 'insensitive' } }
        ]
      },
      include: { truck: { select: { licensePlate: true, make: true, model: true } } },
      orderBy: { datePerformed: 'desc' }
    }),
    db.tire.findMany({ orderBy: { createdAt: 'desc' } }),
    db.workshopJobCard.findMany({ include: { truck: { select: { licensePlate: true, make: true, model: true } }, trailer: { select: { number: true } } }, orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }] })
  ])

  const workbook = new Workbook()
  workbook.creator = 'Fleet Manager'
  workbook.subject = 'One-way live export from Fleet Manager'
  workbook.title = ONEDRIVE_WORKBOOK_NAME
  workbook.created = new Date()
  workbook.modified = new Date()
  workbook.calcProperties.fullCalcOnLoad = true

  const recordCounts = {
    Trucks: trucks.length,
    Trailers: trailers.length,
    Maintenance: truckMaintenance.length + trailerMaintenance.length,
    'Oil Changes': oilChanges.length,
    Tires: tires.length,
    'Job Cards': jobCards.length
  }

  addTableSheet(workbook, 'Sync Summary', 'SyncSummary', [
    { header: 'Data', key: 'data', width: 24 },
    { header: 'Records Exported', key: 'count', width: 22 },
    { header: 'Workbook Updated', key: 'updatedAt', width: 28 }
  ], Object.entries(recordCounts).map(([data, count]) => ({ data, count, updatedAt: workbook.modified })))

  addTableSheet(workbook, 'Trucks', 'Trucks', [
    { header: 'Truck Number', key: 'truckNumber', width: 18 }, { header: 'VIN', key: 'vin', width: 24 },
    { header: 'Make', key: 'make', width: 18 }, { header: 'Model', key: 'model', width: 18 },
    { header: 'Year', key: 'year', width: 10 }, { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Mileage (km)', key: 'mileage', width: 16 }, { header: 'Status', key: 'status', width: 16 },
    { header: 'Health Score', key: 'healthScore', width: 14 }, { header: 'Risk Level', key: 'riskLevel', width: 14 },
    { header: 'Last Oil Change', key: 'lastOilChange', width: 20 }, { header: 'Next Oil Change', key: 'nextOilChange', width: 20 },
    { header: 'Last Updated', key: 'updatedAt', width: 20 }
  ], trucks.map(row => ({ truckNumber: row.licensePlate, vin: row.vin, make: row.make, model: row.model, year: row.year, driver: row.driverName, mileage: row.currentMileage, status: row.status, healthScore: row.healthScore, riskLevel: row.riskLevel, lastOilChange: row.lastOilChange, nextOilChange: row.nextOilChange, updatedAt: row.updatedAt })))

  addTableSheet(workbook, 'Trailers', 'Trailers', [
    { header: 'Trailer Number', key: 'number', width: 20 }, { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Status', key: 'status', width: 16 }, { header: 'Health Score', key: 'healthScore', width: 14 },
    { header: 'Risk Level', key: 'riskLevel', width: 14 }, { header: 'Last Inspection', key: 'lastInspection', width: 20 },
    { header: 'Next Inspection', key: 'nextInspection', width: 20 }, { header: 'Last Updated', key: 'updatedAt', width: 20 }
  ], trailers.map(row => ({ number: row.number, driver: row.driverName, status: row.status, healthScore: row.healthScore, riskLevel: row.riskLevel, lastInspection: row.lastInspection, nextInspection: row.nextInspection, updatedAt: row.updatedAt })))

  const maintenanceRows = [
    ...truckMaintenance.map(row => ({ id: row.id, assetType: 'Truck', asset: row.truck.licensePlate, date: row.datePerformed, serviceType: row.serviceType, description: row.description, status: row.status, partsCost: row.partsCost, laborCost: row.laborCost, totalCost: row.totalCost, mechanic: row.mechanicName, driver: row.driverName, nextServiceDue: row.nextServiceDue, notes: row.notes, updatedAt: row.updatedAt })),
    ...trailerMaintenance.map(row => ({ id: row.id, assetType: 'Trailer', asset: row.trailer.number, date: row.datePerformed, serviceType: row.serviceType, description: row.description, status: row.status, partsCost: row.partsCost, laborCost: row.laborCost, totalCost: row.totalCost, mechanic: row.mechanicName, driver: row.driverName, nextServiceDue: row.nextServiceDue, notes: row.notes, updatedAt: row.updatedAt }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime())
  const maintenanceColumns = [
    { header: 'Record ID', key: 'id', width: 28 }, { header: 'Asset Type', key: 'assetType', width: 14 },
    { header: 'Truck / Trailer', key: 'asset', width: 20 }, { header: 'Service Date', key: 'date', width: 20 },
    { header: 'Service Type', key: 'serviceType', width: 24 }, { header: 'Description', key: 'description', width: 42 },
    { header: 'Status', key: 'status', width: 16 }, { header: 'Parts Cost', key: 'partsCost', width: 14 },
    { header: 'Labor Cost', key: 'laborCost', width: 14 }, { header: 'Total Cost', key: 'totalCost', width: 14 },
    { header: 'Mechanic', key: 'mechanic', width: 22 }, { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Next Service Due', key: 'nextServiceDue', width: 20 }, { header: 'Notes', key: 'notes', width: 36 },
    { header: 'Last Updated', key: 'updatedAt', width: 20 }
  ]
  addTableSheet(workbook, 'Maintenance', 'MaintenanceRecords', maintenanceColumns, maintenanceRows)

  addTableSheet(workbook, 'Oil Changes', 'OilChanges', [
    { header: 'Truck Number', key: 'truck', width: 20 }, { header: 'Truck', key: 'vehicle', width: 28 },
    { header: 'Service Date', key: 'date', width: 20 }, { header: 'Mileage (km)', key: 'mileage', width: 16 },
    { header: 'Oil Quantity (L)', key: 'quantity', width: 18 }, { header: 'Interval (km)', key: 'interval', width: 16 },
    { header: 'Next Service Due', key: 'nextDue', width: 20 }, { header: 'Parts Cost', key: 'partsCost', width: 14 },
    { header: 'Labor Cost', key: 'laborCost', width: 14 }, { header: 'Total Cost', key: 'totalCost', width: 14 },
    { header: 'Mechanic', key: 'mechanic', width: 22 }, { header: 'Notes', key: 'notes', width: 36 }
  ], oilChanges.map(row => ({ truck: row.truck.licensePlate, vehicle: `${row.truck.make} ${row.truck.model}`.trim(), date: row.datePerformed, mileage: row.currentMileage, quantity: row.oilQuantityLiters, interval: row.oilChangeInterval, nextDue: row.nextServiceDue, partsCost: row.partsCost, laborCost: row.laborCost, totalCost: row.totalCost, mechanic: row.mechanicName, notes: row.notes })))

  addTableSheet(workbook, 'Tires', 'Tires', [
    { header: 'Tire Size', key: 'tireSize', width: 18 }, { header: 'Truck Number', key: 'truck', width: 20 },
    { header: 'Trailer Number', key: 'trailer', width: 20 }, { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Quantity', key: 'quantity', width: 12 }, { header: 'Serial Number', key: 'serial', width: 30 },
    { header: 'Manufacturer', key: 'manufacturer', width: 20 }, { header: 'Origin', key: 'origin', width: 16 },
    { header: 'Date', key: 'date', width: 20 }, { header: 'Notes', key: 'notes', width: 36 }
  ], tires.map(row => ({ tireSize: row.tireSize, truck: row.plateNumber, trailer: row.trailerNumber, driver: row.driverName, quantity: row.quantity, serial: row.serialNumber, manufacturer: row.manufacturer, origin: row.origin, date: row.createdAt, notes: row.notes })))

  addTableSheet(workbook, 'Job Cards', 'WorkshopJobCards', [
    { header: 'Job Number', key: 'jobNumber', width: 20 }, { header: 'Service Date', key: 'serviceDate', width: 20 },
    { header: 'Truck Number', key: 'truck', width: 20 }, { header: 'Trailer Number', key: 'trailer', width: 20 },
    { header: 'Service Type', key: 'serviceType', width: 24 }, { header: 'Priority', key: 'priority', width: 14 },
    { header: 'Status', key: 'status', width: 16 }, { header: 'Odometer (km)', key: 'odometer', width: 16 },
    { header: 'Reported Issue', key: 'issue', width: 40 }, { header: 'Technician', key: 'technician', width: 22 },
    { header: 'Driver', key: 'driver', width: 22 }, { header: 'Parts Cost', key: 'partsCost', width: 14 },
    { header: 'Labor Cost', key: 'laborCost', width: 14 }, { header: 'Total Cost', key: 'totalCost', width: 14 },
    { header: 'Next Service Odometer', key: 'nextOdometer', width: 22 }, { header: 'Next Service Date', key: 'nextDate', width: 20 },
    { header: 'Work Items', key: 'items', width: 48 }, { header: 'Checklist', key: 'checklist', width: 42 },
    { header: 'Notes', key: 'notes', width: 36 }, { header: 'Last Updated', key: 'updatedAt', width: 20 }
  ], jobCards.map(row => ({ jobNumber: row.jobNumber, serviceDate: row.serviceDate, truck: row.truck?.licensePlate, trailer: row.trailer?.number, serviceType: row.serviceType, priority: row.priority, status: row.status, odometer: row.odometerKm, issue: row.reportedIssue, technician: row.technicianName, driver: row.driverName, partsCost: row.partsCost, laborCost: row.laborCost, totalCost: row.totalCost, nextOdometer: row.nextServiceOdometer, nextDate: row.nextServiceDate, items: row.items, checklist: row.checklist, notes: row.notes, updatedAt: row.updatedAt })))

  return { bytes: Buffer.from(await workbook.xlsx.writeBuffer()), recordCounts }
}

export async function syncOneDriveWorkbook(): Promise<OneDriveSyncResult> {
  if (!isOneDriveConfigured()) {
    return { connected: false, success: false, error: 'OneDrive app configuration is incomplete.' }
  }

  const integration = await db.oneDriveIntegration.findUnique({ where: { id: INTEGRATION_ID } })
  if (!integration) return { connected: false, success: false, error: null }

  await db.oneDriveIntegration.update({
    where: { id: INTEGRATION_ID },
    data: { syncRevision: { increment: 1 } }
  })

  const staleLock = new Date(Date.now() - LOCK_TIMEOUT_MS)
  const claim = await db.oneDriveIntegration.updateMany({
    where: {
      id: INTEGRATION_ID,
      OR: [{ syncInProgressAt: null }, { syncInProgressAt: { lt: staleLock } }]
    },
    data: { syncInProgressAt: new Date(), lastSyncStatus: 'SYNCING', lastSyncError: null }
  })

  if (claim.count === 0) return { connected: true, success: true, queued: true }

  try {
    let latestItemId = integration.driveItemId
    let latestItemName = integration.driveItemName || ONEDRIVE_WORKBOOK_NAME
    let latestWebUrl = integration.webUrl
    let observedRevision = -1
    let latestRecordCounts: Record<string, number> | undefined
    let recoveredFromLock = false

    // If changes arrive while a workbook is being uploaded, immediately build
    // and upload another snapshot before releasing the lock.
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await db.oneDriveIntegration.findUniqueOrThrow({ where: { id: INTEGRATION_ID } })
      observedRevision = current.syncRevision
      const tokens = await refreshAccessToken(current.refreshTokenEncrypted)
      if (tokens.refresh_token) {
        await db.oneDriveIntegration.update({
          where: { id: INTEGRATION_ID },
          data: { refreshTokenEncrypted: encryptRefreshToken(tokens.refresh_token) }
        })
      }

      const snapshot = await createFleetWorkbook()
      latestRecordCounts = snapshot.recordCounts
      const target = latestItemId
        ? `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(latestItemId)}/content`
        : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(ONEDRIVE_WORKBOOK_NAME)}:/content`
      const uploadOptions: RequestInit = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: snapshot.bytes
      }
      let upload: Response
      try {
        upload = await graphRequest(target, tokens.access_token, uploadOptions)
      } catch (error) {
        if (!(error instanceof GraphRequestError) || error.status !== 423) throw error

        // Excel can hold an edit lock while the workbook is open. Preserve that
        // file and publish a fresh snapshot so app data can continue syncing.
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
        const suffix = randomBytes(4).toString('hex')
        latestItemName = `Fleet Manager Live Data - ${timestamp}-${suffix}.xlsx`
        const replacementTarget = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(latestItemName)}:/content`
        upload = await graphRequest(replacementTarget, tokens.access_token, uploadOptions)
        recoveredFromLock = true
      }
      const driveItem = await upload.json() as { id?: string; name?: string; webUrl?: string }
      if (!driveItem.id && recoveredFromLock) throw new Error('Microsoft did not return the new workbook file ID.')
      latestItemId = driveItem.id || latestItemId
      latestItemName = driveItem.name || latestItemName
      latestWebUrl = driveItem.webUrl || latestWebUrl

      const released = await db.oneDriveIntegration.update({
        where: { id: INTEGRATION_ID },
        data: {
          driveItemId: latestItemId,
          driveItemName: latestItemName,
          webUrl: latestWebUrl,
          lastSyncAt: new Date(),
          lastSyncStatus: 'SUCCESS',
          lastSyncError: null,
          lastSyncedRevision: observedRevision,
          syncInProgressAt: null
        }
      })
      if (released.syncRevision <= observedRevision) {
        return {
          connected: true,
          success: true,
          lastSyncAt: released.lastSyncAt,
          webUrl: released.webUrl,
          workbookName: latestItemName,
          recoveredFromLock,
          recordCounts: latestRecordCounts
        }
      }

      const reclaimed = await db.oneDriveIntegration.updateMany({
        where: { id: INTEGRATION_ID, syncInProgressAt: null },
        data: { syncInProgressAt: new Date(), lastSyncStatus: 'SYNCING' }
      })
      if (reclaimed.count === 0) return { connected: true, success: true, queued: true }
    }

    const pending = await db.oneDriveIntegration.findUnique({ where: { id: INTEGRATION_ID }, select: { syncRevision: true, lastSyncedRevision: true } })
    const stillPending = Boolean(pending && pending.syncRevision > pending.lastSyncedRevision)
    await db.oneDriveIntegration.update({
      where: { id: INTEGRATION_ID },
      data: { syncInProgressAt: null, lastSyncStatus: stillPending ? 'PENDING' : 'SUCCESS' }
    })
    return { connected: true, success: true, queued: stillPending, workbookName: latestItemName, recoveredFromLock, recordCounts: latestRecordCounts }
  } catch (error) {
    const message = error instanceof GraphRequestError && error.status === 423
      ? 'OneDrive is still locking the workbook. Close it in Excel and retry Sync Now.'
      : error instanceof Error ? error.message : 'Unknown OneDrive sync error.'
    console.error('OneDrive workbook sync failed:', message)
    await db.oneDriveIntegration.update({
      where: { id: INTEGRATION_ID },
      data: {
        syncInProgressAt: null,
        lastSyncStatus: 'ERROR',
        lastSyncError: message.slice(0, 300)
      }
    }).catch(() => undefined)
    return { connected: true, success: false, error: message }
  }
}

/** Keep the primary fleet mutation successful even if Microsoft services are unavailable. */
export async function syncOneDriveWorkbookAfterChange(): Promise<OneDriveSyncResult> {
  try {
    return await syncOneDriveWorkbook()
  } catch (error) {
    console.error('Unable to queue OneDrive workbook sync:', error instanceof Error ? error.message : 'Unknown error')
    return { connected: false, success: false, error: 'Could not queue the OneDrive workbook update.' }
  }
}
