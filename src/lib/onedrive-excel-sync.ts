import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { Workbook } from 'exceljs'
import { db, getRequestOrganization } from '@/lib/db'

export const ONEDRIVE_WORKBOOK_NAME = 'Fleet Manager Live Data.xlsx'
const INTEGRATION_ID = 'primary'
const LOCK_TIMEOUT_MS = 5 * 60 * 1000

export function isOneDriveSyncLockStale(syncInProgressAt: Date | null | undefined) {
  return Boolean(syncInProgressAt && Date.now() - syncInProgressAt.getTime() > LOCK_TIMEOUT_MS)
}

export async function getOrganizationWorkbookName() {
  const organization = await getRequestOrganization()
  return organization.isPrimary
    ? ONEDRIVE_WORKBOOK_NAME
    : `Fleet Manager Live Data - ${organization.slug}.xlsx`
}

/** Detach a non-primary organization from any legacy workbook using the shared default filename. */
export async function ensureOrganizationWorkbookIsolated() {
  const [organization, integration] = await Promise.all([
    getRequestOrganization(),
    db.oneDriveIntegration.findUnique({ where: { id: INTEGRATION_ID } })
  ])
  const workbookName = organization.isPrimary
    ? ONEDRIVE_WORKBOOK_NAME
    : `Fleet Manager Live Data - ${organization.slug}.xlsx`
  if (!integration || organization.isPrimary) return { integration, workbookName, detached: false }

  const hasWorkbookReference = Boolean(integration.driveItemId || integration.webUrl || integration.graphSubscriptionId)
  const needsWorkbookName = integration.driveItemName !== workbookName

  // A previous isolation pass detached the workbook but kept the OAuth token
  // and account email. Clear that stale connection after a short grace period
  // so this organization must explicitly connect its own Microsoft account.
  const staleDetachedConnection = !hasWorkbookReference &&
    !needsWorkbookName &&
    integration.lastSyncStatus === 'NEVER' &&
    integration.lastSyncAt === null &&
    integration.syncInProgressAt === null &&
    integration.syncRevision > 0 &&
    Date.now() - integration.updatedAt.getTime() > 2 * 60 * 1000
  if (staleDetachedConnection) {
    await db.oneDriveIntegration.delete({ where: { id: INTEGRATION_ID } })
    return { integration: null, workbookName, detached: true }
  }

  if (!hasWorkbookReference && !needsWorkbookName) return { integration, workbookName, detached: false }
  if (!hasWorkbookReference) {
    const updated = await db.oneDriveIntegration.update({
      where: { id: INTEGRATION_ID },
      data: { driveItemName: workbookName }
    })
    return { integration: updated, workbookName, detached: false }
  }

  // Do not read, update, or delete the legacy file or its subscription: either
  // may still belong to the primary organization. A later sync creates a new
  // file with this organization's unique name.
  const updated = await db.oneDriveIntegration.update({
    where: { id: INTEGRATION_ID },
    data: {
      driveItemId: null,
      driveItemName: workbookName,
      webUrl: null,
      lastWorkbookHash: null,
      graphSubscriptionId: null,
      graphSubscriptionExpiresAt: null,
      graphSubscriptionClientState: null,
      lastSyncAt: null,
      lastSyncStatus: 'NEVER',
      lastSyncError: null,
      syncInProgressAt: null,
      syncRevision: { increment: 1 },
      lastSyncedRevision: 0
    }
  })
  return { integration: updated, workbookName, detached: true }
}

export interface OneDriveSyncResult {
  connected: boolean
  success: boolean
  queued?: boolean
  error?: string | null
  lastSyncAt?: Date | null
  webUrl?: string | null
  workbookName?: string | null
  recoveredFromLock?: boolean
  pendingWorkbookChanges?: number
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
  readonly retryAfterMs: number | null

  constructor(readonly status: number, retryAfterHeader: string | null = null) {
    super(status === 507
      ? 'OneDrive does not have enough available storage for this workbook. Free up space in the connected Microsoft account, then select Sync Now again.'
      : `OneDrive file update failed (Microsoft Graph HTTP ${status}).`)
    this.name = 'GraphRequestError'
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN
    const retryAfterDate = retryAfterHeader ? Date.parse(retryAfterHeader) : NaN
    this.retryAfterMs = Number.isFinite(retryAfterSeconds)
      ? Math.max(0, retryAfterSeconds * 1000)
      : Number.isFinite(retryAfterDate) ? Math.max(0, retryAfterDate - Date.now()) : null
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
      lastWorkbookHash: null,
      graphSubscriptionId: null,
      graphSubscriptionExpiresAt: null,
      graphSubscriptionClientState: null,
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
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers
    }
  })
  if (!response.ok) {
    throw new GraphRequestError(response.status, response.headers.get('retry-after'))
  }
  return response
}

async function graphRequestWithRetry(url: string, accessToken: string, init: RequestInit, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await graphRequest(url, accessToken, init)
    } catch (error) {
      const retryable = error instanceof GraphRequestError && [408, 429, 500, 502, 503, 504].includes(error.status)
      if (!retryable || attempt >= retries) throw error

      const retryAfterMs = error.retryAfterMs
      const delayMs = retryAfterMs === null
        ? 750 * (2 ** attempt)
        : Math.min(retryAfterMs, 5000)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
}

export async function getOneDriveAccessToken() {
  const integration = await db.oneDriveIntegration.findUnique({ where: { id: INTEGRATION_ID } })
  if (!integration) throw new Error('Connect OneDrive before importing workbook changes.')
  const tokens = await refreshAccessToken(integration.refreshTokenEncrypted)
  if (tokens.refresh_token) {
    await db.oneDriveIntegration.update({
      where: { id: INTEGRATION_ID },
      data: { refreshTokenEncrypted: encryptRefreshToken(tokens.refresh_token) }
    })
  }
  return tokens.access_token
}

export async function downloadOneDriveWorkbook() {
  const integration = await db.oneDriveIntegration.findUnique({ where: { id: INTEGRATION_ID } })
  if (!integration?.driveItemId) throw new Error('The live workbook has not been created yet.')
  const accessToken = await getOneDriveAccessToken()
  const response = await graphRequest(
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(integration.driveItemId)}/content`,
    accessToken
  )
  return Buffer.from(await response.arrayBuffer())
}

function latestUpdatedAt(...values: (Date | null | undefined)[]) {
  return values.reduce<Date | null>((latest, value) => value && (!latest || value > latest) ? value : latest, null)
}

export async function getFleetRecordVersion(entityType: string, id: string, rowData?: unknown) {
  if (entityType === 'TRUCK') {
    const truck = await db.truck.findUnique({ where: { id }, select: { licensePlate: true, updatedAt: true } })
    if (!truck) return null
    const [maintenance, jobCards, tires] = await Promise.all([
      db.maintenanceRecord.aggregate({ where: { truckId: id, isDeleted: false }, _max: { updatedAt: true } }),
      db.workshopJobCard.aggregate({ where: { truckId: id }, _max: { updatedAt: true } }),
      db.tire.aggregate({ where: { plateNumber: truck.licensePlate }, _max: { updatedAt: true } })
    ])
    return latestUpdatedAt(truck.updatedAt, maintenance._max.updatedAt, jobCards._max.updatedAt, tires._max.updatedAt)
  }
  if (entityType === 'TRAILER') {
    const trailer = await db.trailer.findUnique({ where: { id }, select: { number: true, updatedAt: true } })
    if (!trailer) return null
    const [maintenance, jobCards, tires] = await Promise.all([
      db.trailerMaintenanceRecord.aggregate({ where: { trailerId: id, isDeleted: false }, _max: { updatedAt: true } }),
      db.workshopJobCard.aggregate({ where: { trailerId: id }, _max: { updatedAt: true } }),
      db.tire.aggregate({ where: { trailerNumber: trailer.number }, _max: { updatedAt: true } })
    ])
    return latestUpdatedAt(trailer.updatedAt, maintenance._max.updatedAt, jobCards._max.updatedAt, tires._max.updatedAt)
  }
  if (entityType === 'MAINTENANCE' && rowData && typeof rowData === 'object' && String((rowData as Record<string, unknown>)['Asset Type'] || '').toLowerCase() === 'trailer') {
    return (await db.trailerMaintenanceRecord.findUnique({ where: { id }, select: { updatedAt: true } }))?.updatedAt || null
  }
  if (entityType === 'MAINTENANCE' || entityType === 'OIL_CHANGE') {
    return (await db.maintenanceRecord.findUnique({ where: { id }, select: { updatedAt: true } }))?.updatedAt || null
  }
  if (entityType === 'TIRE') return (await db.tire.findUnique({ where: { id }, select: { updatedAt: true } }))?.updatedAt || null
  if (entityType === 'JOBCARD') return (await db.workshopJobCard.findUnique({ where: { id }, select: { updatedAt: true } }))?.updatedAt || null
  return null
}

export async function ensureOneDriveChangeSubscription() {
  await ensureOrganizationWorkbookIsolated()
  const integration = await db.oneDriveIntegration.findUnique({ where: { id: INTEGRATION_ID } })
  if (!integration?.driveItemId) return { enabled: false, expiresAt: null as Date | null }
  const currentExpiry = integration.graphSubscriptionExpiresAt
  if (integration.graphSubscriptionId && currentExpiry && currentExpiry.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
    return { enabled: true, expiresAt: currentExpiry }
  }

  const accessToken = await getOneDriveAccessToken()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
  if (!baseUrl) throw new Error('The public app URL is not configured for workbook notifications.')
  const notificationUrl = new URL('/api/integrations/onedrive/notifications', baseUrl).toString()
  const expirationDateTime = new Date(Date.now() + 40 * 60 * 60 * 1000)
  const clientState = integration.graphSubscriptionClientState || randomBytes(32).toString('hex')
  const body = {
    changeType: 'updated',
    notificationUrl,
    resource: '/me/drive/root',
    expirationDateTime: expirationDateTime.toISOString(),
    clientState
  }

  let subscription: { id?: string; expirationDateTime?: string }
  if (integration.graphSubscriptionId) {
    try {
      await graphRequest(
        `https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(integration.graphSubscriptionId)}`,
        accessToken,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expirationDateTime: body.expirationDateTime }) }
      )
      subscription = { id: integration.graphSubscriptionId, expirationDateTime: body.expirationDateTime }
    } catch (error) {
      if (!(error instanceof GraphRequestError) || error.status !== 404) throw error
      const response = await graphRequest('https://graph.microsoft.com/v1.0/subscriptions', accessToken, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
      })
      subscription = await response.json() as typeof subscription
    }
  } else {
    const response = await graphRequest('https://graph.microsoft.com/v1.0/subscriptions', accessToken, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })
    subscription = await response.json() as typeof subscription
  }

  const expiresAt = subscription.expirationDateTime ? new Date(subscription.expirationDateTime) : expirationDateTime
  await db.oneDriveIntegration.update({
    where: { id: INTEGRATION_ID },
    data: {
      graphSubscriptionId: subscription.id || integration.graphSubscriptionId,
      graphSubscriptionExpiresAt: expiresAt,
      graphSubscriptionClientState: clientState
    }
  })
  return { enabled: true, expiresAt }
}

export async function deleteOneDriveChangeSubscription() {
  await ensureOrganizationWorkbookIsolated()
  const integration = await db.oneDriveIntegration.findUnique({ where: { id: INTEGRATION_ID } })
  if (!integration?.graphSubscriptionId) return
  try {
    const accessToken = await getOneDriveAccessToken()
    await graphRequest(`https://graph.microsoft.com/v1.0/subscriptions/${encodeURIComponent(integration.graphSubscriptionId)}`, accessToken, { method: 'DELETE' })
  } catch (error) {
    if (!(error instanceof GraphRequestError) || error.status !== 404) {
      console.error('Could not remove OneDrive workbook notification subscription:', error instanceof Error ? error.message : 'Unknown error')
    }
  }
}

function asExcelValue(value: unknown) {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) return `'${value}`
  if (value && typeof value === 'object' && !(value instanceof Date)) return JSON.stringify(value)
  return value ?? null
}

type ExportColumn = { header: string; key: string; width: number; numFmt?: string; hidden?: boolean }
const DATE_TIME_FORMAT = 'dd/mm/yyyy hh:mm'

function snapshotCellValue(value: unknown) {
  const excelValue = asExcelValue(value)
  if (excelValue == null) return ''
  return excelValue instanceof Date ? excelValue.toISOString() : excelValue
}

function addTableSheet(
  workbook: Workbook,
  name: string,
  tableName: string,
  columns: ExportColumn[],
  records: Record<string, unknown>[],
  startRow = 1,
  withImportMetadata = false
) {
  const sheetColumns = withImportMetadata
    ? [...columns, { header: 'App Baseline', key: 'appBaseline', width: 16, hidden: true }]
    : columns
  const sheet = workbook.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = sheetColumns.map(column => ({
    key: column.key,
    width: column.width,
    ...(column.hidden ? { hidden: true } : {}),
    ...(column.numFmt ? { style: { numFmt: column.numFmt } } : {})
  }))
  if (records.length) {
    sheet.addTable({
      name: tableName,
      ref: `A${startRow}`,
      headerRow: true,
      totalsRow: false,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: sheetColumns.map(column => ({ name: column.header, filterButton: true })),
      rows: records.map(record => sheetColumns.map(column => {
        if (column.key === 'appBaseline') {
          const baseline = Object.fromEntries(columns
            .filter(item => item.header !== 'Maintenance ID' && item.header !== 'Last Updated')
            .map(item => [item.header, snapshotCellValue(record[item.key])]))
          return JSON.stringify(baseline)
        }
        return asExcelValue(record[column.key])
      }))
    })
  } else {
    const headerRow = sheet.getRow(startRow)
    headerRow.values = sheetColumns.map(column => column.header)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
    sheet.autoFilter = { from: `A${startRow}`, to: `${String.fromCharCode(64 + sheetColumns.length)}${startRow}` }
  }
  columns.forEach((column, index) => {
    if (!column.numFmt) return
    for (let rowNumber = startRow + 1; rowNumber <= records.length + startRow; rowNumber++) {
      sheet.getCell(rowNumber, index + 1).numFmt = column.numFmt
    }
  })
  sheet.getRow(startRow).height = 24
  sheet.getRow(startRow).alignment = { vertical: 'middle', wrapText: true }
  return sheet
}

function getWorkbookSyncUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://fleetmaintenance.site')
  const url = new URL('/settings', baseUrl)
  url.searchParams.set('tab', 'onedrive')
  url.searchParams.set('excelSync', '1')
  return url.toString()
}

function addWorkbookSyncSheet(workbook: Workbook) {
  const sheet = workbook.addWorksheet('Sync Now', { views: [{ showGridLines: false }] })
  sheet.columns = [{ width: 24 }, { width: 24 }, { width: 24 }, { width: 24 }]
  sheet.mergeCells('A1:D1')
  const title = sheet.getCell('A1')
  title.value = 'Fleet Manager Live Data'
  title.font = { bold: true, size: 18, color: { argb: 'FF0F172A' } }
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  sheet.getRow(1).height = 38

  sheet.mergeCells('A3:D5')
  const button = sheet.getCell('A3')
  button.value = {
    text: '↻  SYNC NOW',
    hyperlink: getWorkbookSyncUrl(),
    tooltip: 'Open Fleet Manager and sync the latest data'
  }
  button.font = { bold: true, color: { argb: 'FFFFFFFF' }, underline: true, size: 18 }
  button.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  button.alignment = { horizontal: 'center', vertical: 'middle' }
  for (const rowNumber of [3, 4, 5]) sheet.getRow(rowNumber).height = 28

  sheet.mergeCells('A7:D8')
  const instructions = sheet.getCell('A7')
  instructions.value = 'Click the button to open Fleet Manager and run a secure sync. An administrator must be signed in. If this workbook is open in Excel, the app may publish a refreshed copy.'
  instructions.font = { size: 12, color: { argb: 'FF334155' } }
  instructions.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  instructions.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
  sheet.getRow(7).height = 32
  sheet.getRow(8).height = 32
}

export async function createFleetWorkbook() {
  const [trucks, trailers, truckMaintenance, trailerMaintenance, oilChanges, tires, jobCards] = await Promise.all([
    db.truck.findMany({ where: { isDeleted: false }, orderBy: { licensePlate: 'asc' } }),
    db.trailer.findMany({ where: { isDeleted: false }, orderBy: { number: 'asc' } }),
    db.maintenanceRecord.findMany({ where: { isDeleted: false }, include: { truck: { select: { licensePlate: true, make: true, model: true } }, mechanic: { select: { name: true } } }, orderBy: { datePerformed: 'desc' } }),
    db.trailerMaintenanceRecord.findMany({ where: { isDeleted: false }, include: { trailer: { select: { number: true } }, mechanic: { select: { name: true } } }, orderBy: { datePerformed: 'desc' } }),
    db.maintenanceRecord.findMany({
      where: {
        isDeleted: false,
        OR: [
          { isOilChange: true },
          { serviceType: { contains: 'oil', mode: 'insensitive' } }
        ]
      },
      include: { truck: { select: { licensePlate: true, make: true, model: true } }, mechanic: { select: { name: true } } },
      orderBy: { datePerformed: 'desc' }
    }),
    db.tire.findMany({ orderBy: { createdAt: 'desc' } }),
    db.workshopJobCard.findMany({ include: { truck: { select: { licensePlate: true, make: true, model: true } }, trailer: { select: { number: true } } }, orderBy: [{ serviceDate: 'desc' }, { createdAt: 'desc' }] })
  ])

  const workbook = new Workbook()
  workbook.creator = 'Fleet Manager'
  workbook.subject = 'Live fleet data export and role-checked workbook imports'
  workbook.title = ONEDRIVE_WORKBOOK_NAME
  const syncedAt = new Date()
  workbook.created = syncedAt
  workbook.modified = syncedAt
  workbook.calcProperties.fullCalcOnLoad = true

  addWorkbookSyncSheet(workbook)
  workbook.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 0, visibility: 'visible' }]

  const truckLastUpdated = new Map(trucks.map(truck => [truck.id, truck.updatedAt]))
  const trailerLastUpdated = new Map(trailers.map(trailer => [trailer.id, trailer.updatedAt]))
  const updateLastActivity = (activity: Map<string, Date>, key: string | null | undefined, updatedAt: Date) => {
    if (!key) return
    const previous = activity.get(key)
    if (!previous || updatedAt > previous) activity.set(key, updatedAt)
  }
  for (const record of truckMaintenance) updateLastActivity(truckLastUpdated, record.truckId, record.updatedAt)
  for (const record of trailerMaintenance) updateLastActivity(trailerLastUpdated, record.trailerId, record.updatedAt)
  for (const record of jobCards) {
    updateLastActivity(truckLastUpdated, record.truckId, record.updatedAt)
    updateLastActivity(trailerLastUpdated, record.trailerId, record.updatedAt)
  }

  const truckIdByPlate = new Map(trucks.map(truck => [truck.licensePlate, truck.id]))
  const trailerIdByNumber = new Map(trailers.map(trailer => [trailer.number, trailer.id]))
  for (const tire of tires) {
    updateLastActivity(truckLastUpdated, tire.plateNumber ? truckIdByPlate.get(tire.plateNumber) : undefined, tire.updatedAt)
    updateLastActivity(trailerLastUpdated, tire.trailerNumber ? trailerIdByNumber.get(tire.trailerNumber) : undefined, tire.updatedAt)
  }

  const latestOilChangeByTruck = new Map<string, typeof oilChanges[number]>()
  for (const record of oilChanges) {
    const existing = latestOilChangeByTruck.get(record.truckId)
    if (!existing || record.datePerformed > existing.datePerformed) latestOilChangeByTruck.set(record.truckId, record)
  }

  const recordCounts = {
    Trucks: trucks.length,
    Trailers: trailers.length,
    Maintenance: truckMaintenance.length + trailerMaintenance.length,
    'Oil Changes': oilChanges.length,
    Tires: tires.length,
    'Job Cards': jobCards.length
  }

  const syncSummary = addTableSheet(workbook, 'Sync Summary', 'SyncSummary', [
    { header: 'Data', key: 'data', width: 24 },
    { header: 'Records Exported', key: 'count', width: 22 },
    { header: 'Workbook Updated', key: 'updatedAt', width: 28, numFmt: DATE_TIME_FORMAT }
  ], Object.entries(recordCounts).map(([data, count]) => ({ data, count, updatedAt: syncedAt })), 3)

  const syncButton = syncSummary.getCell('A1')
  const syncUrl = getWorkbookSyncUrl()
  syncButton.value = { text: '↻  Sync Now', hyperlink: syncUrl, tooltip: 'Open Fleet Manager and sync the latest data' }
  syncButton.font = { bold: true, color: { argb: 'FFFFFFFF' }, underline: true, size: 12 }
  syncButton.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  syncButton.alignment = { horizontal: 'center', vertical: 'middle' }
  syncSummary.mergeCells('B1:C1')
  const syncInstructions = syncSummary.getCell('B1')
  syncInstructions.value = 'Click Sync Now to open Fleet Manager and start a secure sync. If this file is open, a fresh copy may be created.'
  syncInstructions.font = { color: { argb: 'FF334155' }, italic: true }
  syncInstructions.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }
  syncInstructions.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  syncSummary.getRow(1).height = 32
  syncSummary.getRow(2).height = 10

  addTableSheet(workbook, 'Trucks', 'Trucks', [
    { header: 'Truck Number', key: 'truckNumber', width: 18 }, { header: 'VIN', key: 'vin', width: 24 },
    { header: 'Make', key: 'make', width: 18 }, { header: 'Model', key: 'model', width: 18 },
    { header: 'Year', key: 'year', width: 10 }, { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Mileage (km)', key: 'mileage', width: 16 }, { header: 'Status', key: 'status', width: 16 },
    { header: 'Health Score', key: 'healthScore', width: 14 }, { header: 'Risk Level', key: 'riskLevel', width: 14 },
    { header: 'Last Oil Change', key: 'lastOilChange', width: 20, numFmt: DATE_TIME_FORMAT }, { header: 'Next Oil Change', key: 'nextOilChange', width: 20, numFmt: DATE_TIME_FORMAT },
    { header: 'Last Updated', key: 'updatedAt', width: 22, numFmt: DATE_TIME_FORMAT },
    { header: 'Record ID', key: 'recordId', width: 28, hidden: true }
  ], trucks.map(row => {
    const latestOilChange = latestOilChangeByTruck.get(row.id)
    const useLatestOilChange = Boolean(latestOilChange && (!row.lastOilChange || latestOilChange.datePerformed >= row.lastOilChange))
    return {
      truckNumber: row.licensePlate,
      vin: row.vin,
      make: row.make,
      model: row.model,
      year: row.year,
      driver: row.driverName,
      mileage: row.currentMileage,
      status: row.status,
      healthScore: row.healthScore,
      riskLevel: row.riskLevel,
      lastOilChange: useLatestOilChange ? latestOilChange?.datePerformed : row.lastOilChange,
      nextOilChange: useLatestOilChange ? (latestOilChange?.nextServiceDue || row.nextOilChange) : row.nextOilChange,
      updatedAt: truckLastUpdated.get(row.id) || row.updatedAt,
      recordId: row.id
    }
  }), 1, true)

  addTableSheet(workbook, 'Trailers', 'Trailers', [
    { header: 'Trailer Number', key: 'number', width: 20 }, { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Status', key: 'status', width: 16 }, { header: 'Health Score', key: 'healthScore', width: 14 },
    { header: 'Risk Level', key: 'riskLevel', width: 14 }, { header: 'Last Inspection', key: 'lastInspection', width: 20, numFmt: DATE_TIME_FORMAT },
    { header: 'Next Inspection', key: 'nextInspection', width: 20, numFmt: DATE_TIME_FORMAT }, { header: 'Last Updated', key: 'updatedAt', width: 22, numFmt: DATE_TIME_FORMAT },
    { header: 'Record ID', key: 'recordId', width: 28, hidden: true }
  ], trailers.map(row => ({ number: row.number, driver: row.driverName, status: row.status, healthScore: row.healthScore, riskLevel: row.riskLevel, lastInspection: row.lastInspection, nextInspection: row.nextInspection, updatedAt: trailerLastUpdated.get(row.id) || row.updatedAt, recordId: row.id })), 1, true)

  const maintenanceRows = [
    ...truckMaintenance.map(row => ({ id: row.id, recordId: row.id, assetType: 'Truck', asset: row.truck.licensePlate, date: row.datePerformed, serviceType: row.serviceType, description: row.description, status: row.status, partsCost: row.partsCost, laborCost: row.laborCost, totalCost: row.totalCost, mechanic: row.mechanic?.name || row.mechanicName, driver: row.driverName, nextServiceDue: row.nextServiceDue, notes: row.notes, updatedAt: row.updatedAt })),
    ...trailerMaintenance.map(row => ({ id: row.id, recordId: row.id, assetType: 'Trailer', asset: row.trailer.number, date: row.datePerformed, serviceType: row.serviceType, description: row.description, status: row.status, partsCost: row.partsCost, laborCost: row.laborCost, totalCost: row.totalCost, mechanic: row.mechanic?.name || row.mechanicName, driver: row.driverName, nextServiceDue: row.nextServiceDue, notes: row.notes, updatedAt: row.updatedAt }))
  ].sort((a, b) => b.date.getTime() - a.date.getTime())
  const maintenanceColumns = [
    { header: 'Maintenance ID', key: 'id', width: 28 }, { header: 'Asset Type', key: 'assetType', width: 14 },
    { header: 'Truck / Trailer', key: 'asset', width: 20 }, { header: 'Service Date', key: 'date', width: 20, numFmt: DATE_TIME_FORMAT },
    { header: 'Service Type', key: 'serviceType', width: 24 }, { header: 'Description', key: 'description', width: 42 },
    { header: 'Status', key: 'status', width: 16 }, { header: 'Parts Cost', key: 'partsCost', width: 14 },
    { header: 'Labor Cost', key: 'laborCost', width: 14 }, { header: 'Total Cost', key: 'totalCost', width: 14 },
    { header: 'Mechanic', key: 'mechanic', width: 22 }, { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Next Service Due', key: 'nextServiceDue', width: 20, numFmt: DATE_TIME_FORMAT }, { header: 'Notes', key: 'notes', width: 36 },
    { header: 'Last Updated', key: 'updatedAt', width: 22, numFmt: DATE_TIME_FORMAT },
    { header: 'Record ID', key: 'recordId', width: 28, hidden: true }
  ]
  addTableSheet(workbook, 'Maintenance', 'MaintenanceRecords', maintenanceColumns, maintenanceRows, 1, true)

  addTableSheet(workbook, 'Oil Changes', 'OilChanges', [
    { header: 'Truck Number', key: 'truck', width: 20 }, { header: 'Truck', key: 'vehicle', width: 28 },
    { header: 'Driver', key: 'driver', width: 22 }, { header: 'Service Date', key: 'date', width: 20, numFmt: DATE_TIME_FORMAT }, { header: 'Mileage (km)', key: 'mileage', width: 16 },
    { header: 'Oil Quantity (L)', key: 'quantity', width: 18 }, { header: 'Interval (km)', key: 'interval', width: 16 },
    { header: 'Next Service Due', key: 'nextDue', width: 20, numFmt: DATE_TIME_FORMAT }, { header: 'Parts Cost', key: 'partsCost', width: 14 },
    { header: 'Labor Cost', key: 'laborCost', width: 14 }, { header: 'Total Cost', key: 'totalCost', width: 14 },
    { header: 'Mechanic', key: 'mechanic', width: 22 }, { header: 'Notes', key: 'notes', width: 36 },
    { header: 'Last Updated', key: 'updatedAt', width: 22, numFmt: DATE_TIME_FORMAT },
    { header: 'Record ID', key: 'recordId', width: 28, hidden: true }
  ], oilChanges.map(row => ({ truck: row.truck.licensePlate, vehicle: `${row.truck.make} ${row.truck.model}`.trim(), driver: row.driverName, date: row.datePerformed, mileage: row.currentMileage, quantity: row.oilQuantityLiters, interval: row.oilChangeInterval, nextDue: row.nextServiceDue, partsCost: row.partsCost, laborCost: row.laborCost, totalCost: row.totalCost, mechanic: row.mechanic?.name || row.mechanicName, notes: row.notes, updatedAt: row.updatedAt, recordId: row.id })), 1, true)

  addTableSheet(workbook, 'Tires', 'Tires', [
    { header: 'Tire Size', key: 'tireSize', width: 18 }, { header: 'Truck Number', key: 'truck', width: 20 },
    { header: 'Trailer Number', key: 'trailer', width: 20 }, { header: 'Driver', key: 'driver', width: 22 },
    { header: 'Quantity', key: 'quantity', width: 12 }, { header: 'Serial Number', key: 'serial', width: 30 },
    { header: 'Manufacturer', key: 'manufacturer', width: 20 }, { header: 'Origin', key: 'origin', width: 16 },
    { header: 'Date', key: 'date', width: 20, numFmt: DATE_TIME_FORMAT }, { header: 'Notes', key: 'notes', width: 36 },
    { header: 'Last Updated', key: 'updatedAt', width: 22, numFmt: DATE_TIME_FORMAT },
    { header: 'Record ID', key: 'recordId', width: 28, hidden: true }
  ], tires.map(row => ({ tireSize: row.tireSize, truck: row.plateNumber, trailer: row.trailerNumber, driver: row.driverName, quantity: row.quantity, serial: row.serialNumber, manufacturer: row.manufacturer, origin: row.origin, date: row.createdAt, notes: row.notes, updatedAt: row.updatedAt, recordId: row.id })), 1, true)

  addTableSheet(workbook, 'Job Cards', 'WorkshopJobCards', [
    { header: 'Job Number', key: 'jobNumber', width: 20 }, { header: 'Service Date', key: 'serviceDate', width: 20, numFmt: DATE_TIME_FORMAT },
    { header: 'Truck Number', key: 'truck', width: 20 }, { header: 'Trailer Number', key: 'trailer', width: 20 },
    { header: 'Service Type', key: 'serviceType', width: 24 }, { header: 'Priority', key: 'priority', width: 14 },
    { header: 'Status', key: 'status', width: 16 }, { header: 'Odometer (km)', key: 'odometer', width: 16 },
    { header: 'Reported Issue', key: 'issue', width: 40 }, { header: 'Technician', key: 'technician', width: 22 },
    { header: 'Driver', key: 'driver', width: 22 }, { header: 'Parts Cost', key: 'partsCost', width: 14 },
    { header: 'Labor Cost', key: 'laborCost', width: 14 }, { header: 'Total Cost', key: 'totalCost', width: 14 },
    { header: 'Next Service Odometer', key: 'nextOdometer', width: 22 }, { header: 'Next Service Date', key: 'nextDate', width: 20, numFmt: DATE_TIME_FORMAT },
    { header: 'Work Items', key: 'items', width: 48 }, { header: 'Checklist', key: 'checklist', width: 42 },
    { header: 'Notes', key: 'notes', width: 36 }, { header: 'Last Updated', key: 'updatedAt', width: 22, numFmt: DATE_TIME_FORMAT },
    { header: 'Record ID', key: 'recordId', width: 28, hidden: true }
  ], jobCards.map(row => ({ jobNumber: row.jobNumber, serviceDate: row.serviceDate, truck: row.truck?.licensePlate, trailer: row.trailer?.number, serviceType: row.serviceType, priority: row.priority, status: row.status, odometer: row.odometerKm, issue: row.reportedIssue, technician: row.technicianName, driver: row.driverName, partsCost: row.partsCost, laborCost: row.laborCost, totalCost: row.totalCost, nextOdometer: row.nextServiceOdometer, nextDate: row.nextServiceDate, items: row.items, checklist: row.checklist, notes: row.notes, updatedAt: row.updatedAt, recordId: row.id })), 1, true)

  return { bytes: Buffer.from(await workbook.xlsx.writeBuffer()), recordCounts }
}

export async function syncOneDriveWorkbook(): Promise<OneDriveSyncResult> {
  if (!isOneDriveConfigured()) {
    return { connected: false, success: false, error: 'OneDrive app configuration is incomplete.' }
  }

  const { integration } = await ensureOrganizationWorkbookIsolated()
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
    const beforeUpload = await db.oneDriveIntegration.findUniqueOrThrow({ where: { id: INTEGRATION_ID } })
    if (beforeUpload.driveItemId) {
      const { captureOneDriveWorkbookChanges } = await import('@/lib/onedrive-excel-import')
      await captureOneDriveWorkbookChanges()
      const pendingWorkbookChanges = await db.excelWorkbookChange.count({ where: { status: { in: ['PENDING', 'CONFLICT'] } } })
      if (pendingWorkbookChanges > 0) {
        await db.oneDriveIntegration.update({
          where: { id: INTEGRATION_ID },
          data: { syncInProgressAt: null, lastSyncStatus: 'PENDING', lastSyncError: null }
        })
        return {
          connected: true,
          success: true,
          queued: true,
          pendingWorkbookChanges,
          workbookName: beforeUpload.driveItemName || ONEDRIVE_WORKBOOK_NAME,
          webUrl: beforeUpload.webUrl
        }
      }
    }

    let latestItemId = integration.driveItemId
    let latestItemName = integration.driveItemName || await getOrganizationWorkbookName()
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
        : `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(latestItemName)}:/content`
      const uploadOptions: RequestInit = {
        method: 'PUT',
        headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        body: snapshot.bytes
      }
      let upload: Response
      try {
        upload = await graphRequestWithRetry(target, tokens.access_token, uploadOptions)
      } catch (error) {
        if (!(error instanceof GraphRequestError) || error.status !== 423) throw error

        // Excel can hold an edit lock while the workbook is open. Preserve that
        // file and publish a fresh snapshot so app data can continue syncing.
        const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
        const suffix = randomBytes(4).toString('hex')
        latestItemName = `Fleet Manager Live Data - ${timestamp}-${suffix}.xlsx`
        const replacementTarget = `https://graph.microsoft.com/v1.0/me/drive/root:/${encodeURIComponent(latestItemName)}:/content`
        upload = await graphRequestWithRetry(replacementTarget, tokens.access_token, uploadOptions)
        recoveredFromLock = true
      }
      const driveItem = await upload.json() as { id?: string; name?: string; webUrl?: string }
      const lastWorkbookHash = createHash('sha256').update(snapshot.bytes.toString('base64')).digest('hex')
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
          lastWorkbookHash,
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
