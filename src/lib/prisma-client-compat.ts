/**
 * Compatibility layer between the Prisma ORM 6 model-delegate API that the
 * application code uses (db.user.findMany({ where, include }), $transaction,
 * $queryRawUnsafe, ...) and the Prisma 8 client built from the emitted data
 * contract (`db.orm.public.<Model>` fluent collections).
 *
 * It keeps every existing call site unchanged while the runtime underneath is
 * the Prisma 8 client that the platform provides through the service
 * declaration.
 */
import { and, not, or } from '@prisma/orm-postgres/orm-client'

/* eslint-disable @typescript-eslint/no-explicit-any */

type AnyRecord = Record<string, any>

type OrmClient = any

const FILTER_OPS = new Set([
  'equals', 'not', 'in', 'notIn', 'lt', 'lte', 'gt', 'gte',
  'contains', 'startsWith', 'endsWith', 'mode', 'search',
])

const RELATION_KEYS = new Set([
  'create', 'connect', 'connectOrCreate', 'createMany', 'update', 'updateMany',
  'upsert', 'disconnect', 'delete', 'deleteMany', 'set',
])

const escapeLike = (value: unknown) => String(value).replace(/[\\%_]/g, (m) => '\\' + m)

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** Plain data object, excluding values that only look like objects. */
function isPlainObject(value: unknown): value is AnyRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof Uint8Array) &&
    !(value instanceof ArrayBuffer)
  )
}

function equality(field: any, value: unknown): any {
  return value === null || value === undefined ? field.isNull() : field.eq(value)
}

function inequality(field: any, value: unknown): any {
  return value === null || value === undefined ? field.isNotNull() : field.neq(value)
}

function caseInsensitive(condition: AnyRecord): boolean {
  return condition.mode === 'insensitive'
}

function fieldCondition(field: any, condition: unknown, key: string): any {
  if (condition === null || condition === undefined) return field.isNull()

  const isFilter =
    isPlainObject(condition) && Object.keys(condition).some((op) => FILTER_OPS.has(op))

  if (isFilter) {
    const cond = condition as AnyRecord
    const parts: any[] = []
    for (const [op, value] of Object.entries(cond)) {
      switch (op) {
        case 'equals':
          parts.push(equality(field, value))
          break
        case 'not':
          if (value === null || value === undefined) parts.push(field.isNotNull())
          else if (isPlainObject(value) && Object.keys(value).some((k) => FILTER_OPS.has(k))) parts.push(not(fieldCondition(field, value, key)))
          else parts.push(inequality(field, value))
          break
        case 'in':
          parts.push(field.in(asArray(value as any)))
          break
        case 'notIn':
          parts.push(not(field.in(asArray(value as any))))
          break
        case 'lt':
          parts.push(field.lt(value))
          break
        case 'lte':
          parts.push(field.lte(value))
          break
        case 'gt':
          parts.push(field.gt(value))
          break
        case 'gte':
          parts.push(field.gte(value))
          break
        case 'contains': {
          const pattern = `%${escapeLike(value)}%`
          parts.push(caseInsensitive(cond) ? field.ilike(pattern) : field.like(pattern))
          break
        }
        case 'startsWith': {
          const pattern = `${escapeLike(value)}%`
          parts.push(caseInsensitive(cond) ? field.ilike(pattern) : field.like(pattern))
          break
        }
        case 'endsWith': {
          const pattern = `%${escapeLike(value)}`
          parts.push(caseInsensitive(cond) ? field.ilike(pattern) : field.like(pattern))
          break
        }
        case 'mode':
        case 'search':
          break
        default:
          throw new Error(`Unsupported Prisma filter operator "${op}" on field "${key}"`)
      }
    }
    if (!parts.length) return undefined
    return parts.length === 1 ? parts[0] : and(...parts)
  }

  return equality(field, condition)
}

/** Translate a Prisma ORM 6 `where` object into a Prisma 8 predicate. */
export function wherePred(row: any, where: AnyRecord | null | undefined): any {
  if (!where || Object.keys(where).length === 0) return undefined
  const parts: any[] = []
  for (const [key, value] of Object.entries(where)) {
    if (key === 'AND' || key === 'OR' || key === 'NOT') {
      const inner = asArray(value as any)
        .map((w) => wherePred(row, w))
        .filter(Boolean)
      if (!inner.length) continue
      if (key === 'AND') parts.push(inner.length === 1 ? inner[0] : and(...inner))
      else if (key === 'OR') parts.push(or(...inner))
      else parts.push(not(inner.length === 1 ? inner[0] : and(...inner)))
      continue
    }
    if (key === 'is' || key === 'isNot') {
      const relPred = wherePred(row[key], value as AnyRecord)
      if (relPred === undefined) continue
      parts.push(key === 'is' ? relPred : not(relPred))
      continue
    }
    const field = row[key]
    if (field === undefined) throw new Error(`Unknown field "${key}" in a "${where.__model ?? ''}" query filter`)
    if (isPlainObject(value) && ('some' in value || 'every' in value || 'none' in value)) {
      if ('some' in value) parts.push(field.some((r: any) => wherePred(r, value.some)))
      if ('none' in value) parts.push(field.none((r: any) => wherePred(r, value.none)))
      if ('every' in value) parts.push(field.every((r: any) => wherePred(r, value.every)))
      continue
    }
    const pred = fieldCondition(field, value, key)
    if (pred !== undefined) parts.push(pred)
  }
  if (!parts.length) return undefined
  return parts.length === 1 ? parts[0] : and(...parts)
}

function orderLambdas(orderBy: unknown, invert: boolean): any[] {
  return asArray(orderBy as any).map((entry: AnyRecord) => (row: any) => {
    for (const [key, spec] of Object.entries(entry)) {
      let direction: string
      let isCount = false
      if (isPlainObject(spec) && '_count' in spec) {
        isCount = true
        direction = String((spec as AnyRecord)._count)
      } else if (isPlainObject(spec) && 'sort' in spec) {
        direction = String((spec as AnyRecord).sort)
      } else {
        direction = String(spec)
      }
      if (invert) direction = direction === 'desc' ? 'asc' : 'desc'
      const suffix = direction === 'desc' ? 'desc' : 'asc'
      if (isCount) return row[key].count()[suffix]()
      return row[key][suffix]()
    }
    throw new Error('Empty orderBy entry')
  })
}

function applyOrder(collection: any, orderBy: unknown, invert = false): any {
  const lambdas = orderLambdas(orderBy, invert)
  if (!lambdas.length) return collection
  return collection.orderBy(lambdas.length === 1 ? lambdas[0] : lambdas)
}

type ReadArgs = { select?: unknown; include?: unknown }

function refineRelation(rel: any, spec: AnyRecord): any {
  let c = rel
  if (spec.where) c = c.where((row: any) => wherePred(row, spec.where as AnyRecord))
  c = applyOrder(c, spec.orderBy)
  if (typeof spec.skip === 'number') c = c.offset(spec.skip)
  if (typeof spec.take === 'number') c = c.limit(Math.abs(spec.take))
  const shaped = applyReadShape(c, spec)
  return shaped.collection
}

function applyReadShape(collection: any, args: ReadArgs) {
  let c = collection
  const postCount: string[] = []
  const flat: string[] = []
  const nested: Array<[string, AnyRecord]> = []

  const absorb = (shape: AnyRecord) => {
    for (const [k, v] of Object.entries(shape)) {
      if (v === true) flat.push(k)
      else if (isPlainObject(v) && k === '_count') {
        const counts = isPlainObject(v.select) ? v.select : { _all: true }
        for (const [rel, on] of Object.entries(counts)) if (on) postCount.push(rel)
      } else if (isPlainObject(v)) nested.push([k, v])
    }
  }
  if (isPlainObject(args.select)) absorb(args.select as AnyRecord)
  if (isPlainObject(args.include)) absorb(args.include as AnyRecord)

  if (flat.length) c = c.select(...flat)
  for (const [rel, spec] of nested) c = c.include(rel, (r: any) => refineRelation(r, spec))
  for (const rel of postCount) c = c.include(rel, (r: any) => r.count())
  return { collection: c, postCount }
}

function applyDistinct(collection: any, distinct: unknown): any {
  const fields = asArray(distinct as any) as string[]
  if (!fields.length) return collection
  let c = collection.orderBy(fields.map((f) => (row: any) => row[f].asc()))
  return c.distinctOn(...fields)
}

function attachCounts(row: any, postCount: string[]) {
  if (row && typeof row === 'object' && postCount.length) {
    const counts: AnyRecord = {}
    for (const rel of postCount) {
      counts[rel] = row[rel]
      delete row[rel]
    }
    row._count = counts
  }
  return row
}

function applyPagination(collection: any, args: AnyRecord) {
  let c = collection
  const invert = typeof args.take === 'number' && args.take < 0
  c = applyOrder(c, args.orderBy, invert)
  if (typeof args.skip === 'number' && args.skip > 0) c = c.offset(args.skip)
  if (typeof args.take === 'number') c = c.limit(Math.abs(args.take))
  return { collection: c, invert }
}

/** Rewrite nested relation writes (`{ rel: { create } }`) into Prisma 8 form. */
export function transformWriteData(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(transformWriteData)
  if (!isPlainObject(data)) return data
  const out: AnyRecord = {}
  for (const [key, value] of Object.entries(data)) {
    const isRelationWrite =
      isPlainObject(value) &&
      Object.keys(value).length > 0 &&
      Object.keys(value).every((k) => RELATION_KEYS.has(k))
    if (!isRelationWrite) {
      out[key] = value
      continue
    }
    const spec = value as AnyRecord
    if ('create' in spec) out[key] = (rel: any) => rel.create(transformWriteData(spec.create))
    else if ('createMany' in spec) {
      const payload = isPlainObject(spec.createMany) ? spec.createMany.data ?? spec.createMany : spec.createMany
      out[key] = (rel: any) => rel.createAll(asArray(payload).map(transformWriteData))
    } else if ('connect' in spec) {
      const target = spec.connect
      if (isPlainObject(target) && Object.keys(target).length === 1 && 'id' in target) {
        // Prisma convention in this schema: the foreign key is `<relation>Id`.
        out[`${key}Id`] = target.id
      } else {
        throw new Error(`Nested connect on relation "${key}" is not supported by the Prisma 8 compatibility layer`)
      }
    } else {
      throw new Error(
        `Nested relation write (${Object.keys(spec).join(', ')}) on relation "${key}" is not supported by the Prisma 8 compatibility layer`,
      )
    }
  }
  return out
}

function normalizeCount(result: any): number {
  if (typeof result === 'number') return result
  if (Array.isArray(result)) return result.length
  if (isPlainObject(result)) {
    for (const key of ['count', 'affectedRows', 'updated', 'rows']) {
      if (typeof result[key] === 'number') return result[key]
    }
  }
  return 0
}

function notFoundError(): Error & { code: string } {
  const error = new Error('Record not found') as Error & { code: string }
  error.code = 'P2025'
  return error
}

type AggregateArgs = {
  _count?: unknown
  _sum?: unknown
  _avg?: unknown
  _min?: unknown
  _max?: unknown
}

function buildAggregateSpec(args: AggregateArgs) {
  const aliases: Array<{ alias: string; section: string; key: string }> = []
  const spec = (a: any) => {
    const o: AnyRecord = {}
    const push = (section: string, key: string, value: any) => {
      const alias = `${section.slice(1)}__${key}`
      aliases.push({ alias, section, key })
      o[alias] = value
    }
    if (args._count !== undefined) {
      if (args._count === true) push('_count', '_all', a.count())
      else
        for (const [k, on] of Object.entries(args._count as AnyRecord))
          if (on) push('_count', k, k === '_all' ? a.count() : a.count(k))
    }
    if (isPlainObject(args._sum)) for (const [k, on] of Object.entries(args._sum)) if (on) push('_sum', k, a.sum(k))
    if (isPlainObject(args._avg)) for (const [k, on] of Object.entries(args._avg)) if (on) push('_avg', k, a.avg(k))
    if (isPlainObject(args._min)) for (const [k, on] of Object.entries(args._min)) if (on) push('_min', k, a.min(k))
    if (isPlainObject(args._max)) for (const [k, on] of Object.entries(args._max)) if (on) push('_max', k, a.max(k))
    return o
  }
  const remapRow = (row: any) => {
    const out: AnyRecord = {}
    for (const { alias, section, key } of aliases) {
      out[section] = out[section] ?? {}
      out[section][key] = row[alias]
    }
    return out
  }
  return { spec, remapRow }
}

function applyGroupOrderBy(rows: AnyRecord[], orderBy: unknown) {
  for (const [key, spec] of Object.entries((orderBy ?? {}) as AnyRecord).reverse()) {
    const descending = (isPlainObject(spec) ? Object.values(spec)[0] : spec) === 'desc'
    const sectionKey = key.startsWith('_') ? key : null
    const field = sectionKey ? Object.keys(spec as AnyRecord)[0] : null
    rows.sort((a, b) => {
      const av = sectionKey ? (a[sectionKey] as AnyRecord)?.[field as string] : a[key]
      const bv = sectionKey ? (b[sectionKey] as AnyRecord)?.[field as string] : b[key]
      const an = av === null || av === undefined ? -Infinity : Number(av)
      const bn = bv === null || bv === undefined ? -Infinity : Number(bv)
      return descending ? bn - an : an - bn
    })
  }
}

function toPascal(model: string): string {
  return model.charAt(0).toUpperCase() + model.slice(1)
}

function makeModelDelegate(client: OrmClient, model: string) {
  const root = client.orm.public[toPascal(model)]

  const filtered = (args: AnyRecord | undefined) => {
    const where = args?.where
    if (!where) return root
    return root.where((row: any) => wherePred(row, where))
  }

  return {
    async findUnique(args: AnyRecord = {}) {
      const shaped = applyReadShape(filtered(args), args)
      const row = await shaped.collection.first()
      return attachCounts(row, shaped.postCount)
    },
    async findUniqueOrThrow(args: AnyRecord = {}) {
      const row = await this.findUnique(args)
      if (row === null) throw notFoundError()
      return row
    },
    async findFirst(args: AnyRecord = {}) {
      const { collection: c } = applyPagination(filtered(args), args)
      const shaped = applyReadShape(c, args)
      const row = await shaped.collection.first()
      return attachCounts(row, shaped.postCount)
    },
    async findMany(args: AnyRecord = {}) {
      let { collection: c, invert } = applyPagination(filtered(args), args)
      c = applyDistinct(c, args.distinct)
      const shaped = applyReadShape(c, args)
      let rows = await shaped.collection.all()
      if (invert) rows = rows.slice().reverse()
      return rows.map((row: any) => attachCounts(row, shaped.postCount))
    },
    async create(args: AnyRecord = {}) {
      const shaped = applyReadShape(root, args)
      const row = await shaped.collection.create(transformWriteData(args.data))
      return attachCounts(row, shaped.postCount)
    },
    async createMany(args: AnyRecord = {}) {
      const rows = await root.createAll(asArray(args.data).map(transformWriteData))
      return { count: normalizeCount(rows) }
    },
    async update(args: AnyRecord) {
      const shaped = applyReadShape(filtered(args), args)
      const row = await shaped.collection.update(transformWriteData(args.data))
      if (row === null || row === undefined) throw notFoundError()
      return attachCounts(row, shaped.postCount)
    },
    async updateMany(args: AnyRecord = {}) {
      const result = await filtered(args).updateAndCount(transformWriteData(args.data))
      return { count: normalizeCount(result) }
    },
    async upsert(args: AnyRecord) {
      const pred = (row: any) => wherePred(row, args.where)
      const existing = await root.where(pred).first()
      if (existing) {
        const row = await root.where(pred).update(transformWriteData(args.update))
        return row ?? existing
      }
      return root.create(transformWriteData(args.create))
    },
    async delete(args: AnyRecord) {
      const shaped = applyReadShape(filtered(args), args)
      const row = await shaped.collection.delete()
      if (row === null || row === undefined) throw notFoundError()
      return attachCounts(row, shaped.postCount)
    },
    async deleteMany(args: AnyRecord = {}) {
      const result = await filtered(args).deleteAndCount()
      return { count: normalizeCount(result) }
    },
    async count(args: AnyRecord = {}) {
      const collection = filtered(args)
      const select = isPlainObject(args.select) ? (args.select as AnyRecord) : null
      if (select) {
        const fields = Object.keys(select).filter((k) => select[k])
        const result = await collection.aggregate((a: any) => {
          const o: AnyRecord = {}
          for (const f of fields) o[f === '_all' ? '_all' : f] = a.count(f === '_all' ? undefined : f)
          return o
        })
        const out: AnyRecord = {}
        for (const f of fields) out[f] = result[f === '_all' ? '_all' : f]
        return out
      }
      const result = await collection.aggregate((a: any) => ({ __count: a.count() }))
      return result.__count
    },
    async aggregate(args: AnyRecord = {}) {
      const collection = filtered(args)
      const { spec, remapRow } = buildAggregateSpec(args)
      const result = await collection.aggregate(spec)
      return remapRow(result)
    },
    async groupBy(args: AnyRecord = {}) {
      const by = asArray(args.by) as string[]
      let c = filtered(args).groupBy(...by)
      const { spec, remapRow } = buildAggregateSpec(args)
      const rows = await c.aggregate(spec)
      const mapped = rows.map((row: any) => {
        const out = remapRow(row)
        for (const b of by) out[b] = row[b]
        return out
      })
      applyGroupOrderBy(mapped, args.orderBy)
      if (typeof args.skip === 'number' || typeof args.take === 'number') {
        const start = typeof args.skip === 'number' ? args.skip : 0
        const end = typeof args.take === 'number' ? start + Math.abs(args.take) : undefined
        return mapped.slice(start, end)
      }
      return mapped
    },
  }
}

/** Serve `$queryRaw`/`$executeRaw` tagged-template calls through the raw lane. */
function rawTag(client: OrmClient, strings: TemplateStringsArray, values: unknown[]) {
  return client.raw.sql(strings, ...values)
}

function rawUnsafe(strings: string, values: unknown[]) {
  const cooked = Object.assign([strings], { raw: [strings] })
  return (client: OrmClient) => client.raw.sql(cooked as unknown as TemplateStringsArray, ...values)
}

/**
 * Wrap a Prisma 8 client so it answers the Prisma ORM 6 delegate API that the
 * application uses (`db.<model>.<method>()`, `$transaction`, `$queryRawUnsafe`, ...).
 */
export function makeCompatClient(client: OrmClient): any {
  const delegateCache = new Map<string, any>()
  return new Proxy({} as AnyRecord, {
    get(_target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (prop === '$transaction') {
        return (arg: any) => {
          if (typeof arg !== 'function') {
            throw new Error('Sequential $transaction arrays are not supported by the Prisma 8 compatibility layer')
          }
          return client.transaction(async (tx: any) => arg(makeCompatClient(tx)))
        }
      }
      if (prop === '$queryRaw') {
        return (strings: TemplateStringsArray, ...values: unknown[]) => client.query(rawTag(client, strings, values))
      }
      if (prop === '$queryRawUnsafe') {
        return (sql: string, ...values: unknown[]) => client.query(rawUnsafe(sql, values)(client))
      }
      if (prop === '$executeRaw') {
        return async (strings: TemplateStringsArray, ...values: unknown[]) =>
          normalizeCount(await client.execute(rawTag(client, strings, values)))
      }
      if (prop === '$executeRawUnsafe') {
        return async (sql: string, ...values: unknown[]) =>
          normalizeCount(await client.execute(rawUnsafe(sql, values)(client)))
      }
      if (prop === '$connect') return () => Promise.resolve()
      if (prop === '$disconnect') return () => (typeof client.$disconnect === 'function' ? client.$disconnect() : Promise.resolve())
      if (prop === '$on') return () => undefined
      if (!delegateCache.has(prop)) delegateCache.set(prop, makeModelDelegate(client, prop))
      return delegateCache.get(prop)
    },
    has() {
      return true
    },
  })
}
