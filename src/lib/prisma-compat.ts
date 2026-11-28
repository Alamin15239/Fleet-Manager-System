/**
 * Stand-in for the removed `@prisma/client` package. The application now runs
 * the Prisma 8 client (see `prisma-client-compat.ts`), and the few names the
 * code imported from `@prisma/client` live here:
 *
 * - `PrismaClient` is the compatibility client type served by `@/lib/db`.
 * - `Prisma.PrismaClientKnownRequestError` is the error class the
 *   compatibility layer throws for missing records, so `instanceof` checks
 *   in the error handler keep working.
 * - `Prisma.Decimal` constructs decimal values (the Prisma 8 runtime stores
 *   `numeric` columns as decimal text).
 * - The remaining `Prisma.*` names are type-only aliases used by call sites.
 */

/**
 * Typed surface for the Prisma 6-style delegates exposed by the runtime
 * compatibility proxy. The adapter intentionally accepts Prisma-shaped
 * arguments while keeping query results generic so existing call sites can
 * supply a precise result type where needed.
 */
export interface PrismaModelDelegate {
  findMany<T = any>(args?: any): Promise<T[]>
  findFirst<T = any>(args?: any): Promise<T | null>
  findUnique<T = any>(args?: any): Promise<T | null>
  findFirstOrThrow<T = any>(args?: any): Promise<T>
  findUniqueOrThrow<T = any>(args?: any): Promise<T>
  create<T = any>(args: any): Promise<T>
  createMany(args?: any): Promise<{ count: number }>
  update<T = any>(args: any): Promise<T>
  updateMany(args?: any): Promise<{ count: number }>
  upsert<T = any>(args: any): Promise<T>
  delete<T = any>(args: any): Promise<T>
  deleteMany(args?: any): Promise<{ count: number }>
  count<T = number>(args?: any): Promise<T>
  aggregate<T = any>(args?: any): Promise<T>
  groupBy<T = any>(args?: any): Promise<T[]>
}

export interface PrismaClient {
  user: PrismaModelDelegate
  passkeyCredential: PrismaModelDelegate
  mechanic: PrismaModelDelegate
  driver: PrismaModelDelegate
  truck: PrismaModelDelegate
  trailer: PrismaModelDelegate
  maintenanceJob: PrismaModelDelegate
  predictiveAlert: PrismaModelDelegate
  trailerPredictiveAlert: PrismaModelDelegate
  maintenanceRecord: PrismaModelDelegate
  trailerMaintenanceRecord: PrismaModelDelegate
  workshopJobCard: PrismaModelDelegate
  settings: PrismaModelDelegate
  organization: PrismaModelDelegate
  organizationPurchaseRequest: PrismaModelDelegate
  organizationBillingPayment: PrismaModelDelegate
  vendor: PrismaModelDelegate
  purchaseInvoice: PrismaModelDelegate
  purchaseInvoiceLine: PrismaModelDelegate
  fleetLedgerAccount: PrismaModelDelegate
  purchaseJournalEntry: PrismaModelDelegate
  purchaseJournalLine: PrismaModelDelegate
  oneDriveIntegration: PrismaModelDelegate
  excelWorkbookChange: PrismaModelDelegate
  notification: PrismaModelDelegate
  trailerNotification: PrismaModelDelegate
  auditLog: PrismaModelDelegate
  userActivity: PrismaModelDelegate
  loginHistory: PrismaModelDelegate
  vehicle: PrismaModelDelegate
  vehicleType: PrismaModelDelegate
  fleetVehicle: PrismaModelDelegate
  vehicleDocument: PrismaModelDelegate
  maintenanceType: PrismaModelDelegate
  tire: PrismaModelDelegate
  tireLifecycleEvent: PrismaModelDelegate
  tireUsagePeriod: PrismaModelDelegate
  document: PrismaModelDelegate
  storageObjectDeletionQueue: PrismaModelDelegate
  emailLog: PrismaModelDelegate
  inventoryItem: PrismaModelDelegate
  inventoryTransaction: PrismaModelDelegate
  websiteVisitorSession: PrismaModelDelegate
  $transaction<T>(operation: (transaction: PrismaClient) => Promise<T>): Promise<T>
  $queryRaw<T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>
  $executeRaw(strings: TemplateStringsArray, ...values: unknown[]): Promise<number>
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>
  $connect(): Promise<void>
  $disconnect(): Promise<void>
  $on(event: string, callback: (...args: any[]) => void): void
}

export class PrismaClientKnownRequestError extends Error {
  code: string
  clientVersion: string

  constructor(message: string, { code, clientVersion }: { code: string; clientVersion?: string }) {
    super(message)
    this.name = 'PrismaClientKnownRequestError'
    this.code = code
    this.clientVersion = clientVersion ?? '0.0.0'
  }
}

/** Decimal values are decimal text under the Prisma 8 runtime. */
export class Decimal {
  readonly value: string

  constructor(value: unknown) {
    this.value =
      typeof value === 'string'
        ? value
        : value instanceof Decimal
          ? value.value
          : String(value)
  }

  toString(): string {
    return this.value
  }

  valueOf(): string {
    return this.value
  }

  toJSON(): string {
    return this.value
  }

  toNumber(): number {
    return Number(this.value)
  }
}

export type InputJsonValue = unknown
export type PurchaseInvoiceWhereInput = unknown
export type PurchaseInvoiceLineWhereInput = unknown
export type DateTimeFilter = unknown
export type TireCreateManyInput = unknown
export type PurchaseJournalLineCreateWithoutEntryInput = unknown

export enum PurchaseExpenseCategory {
  MAINTENANCE = 'MAINTENANCE',
  SPARE_PARTS = 'SPARE_PARTS',
  TIRE = 'TIRE',
  BATTERY = 'BATTERY',
  OIL_FILTER = 'OIL_FILTER',
  OTHER = 'OTHER',
}

export const Prisma = {
  PrismaClientKnownRequestError,
  Decimal,
}
