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

export type PrismaClient = any

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
