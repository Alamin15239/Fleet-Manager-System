import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const maxDuration = 60

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, '""')}"`
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    const tableRows = await db.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `

    const tables: Record<string, unknown[]> = {}
    for (const { table_name: tableName } of tableRows) {
      const rows = await db.$queryRawUnsafe<unknown[]>(`SELECT * FROM public.${quoteIdentifier(tableName)}`)
      tables[tableName] = rows
    }

    const createdAt = new Date()
    await db.auditLog.create({
      data: {
        action: 'DATABASE_BACKUP',
        entityType: 'SYSTEM',
        entityId: 'database',
        userId: admin.id,
        userName: admin.name || null,
        userEmail: admin.email,
        userRole: admin.role,
        changes: { tableCount: tableRows.length, formatVersion: 1 },
      },
    })

    const date = createdAt.toISOString().slice(0, 10)
    const encoder = new TextEncoder()
    const backupStream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (chunk: string) => controller.enqueue(encoder.encode(chunk))
        const serialized = (value: unknown) => JSON.stringify(value, (_key, nested) => typeof nested === 'bigint' ? nested.toString() : nested)
        write(`{"format":"fleet-manager-postgres-json-backup","formatVersion":1,"createdAt":${JSON.stringify(createdAt.toISOString())},"tableCount":${tableRows.length},"tables":{`)
        tableRows.forEach(({ table_name: tableName }, tableIndex) => {
          if (tableIndex > 0) write(',')
          write(`${JSON.stringify(tableName)}:[`)
          tables[tableName].forEach((row, rowIndex) => {
            if (rowIndex > 0) write(',')
            write(serialized(row))
          })
          write(']')
        })
        write('}}')
        controller.close()
      },
    })

    return new NextResponse(backupStream, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="fleet-database-backup-${date}.json"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    const unauthorized = error instanceof Error && ['No token provided', 'Invalid token'].includes(error.message)
    const forbidden = error instanceof Error && error.message === 'Insufficient permissions'
    console.error('Database backup failed:', error)
    return NextResponse.json(
      { error: unauthorized ? 'Authentication required' : forbidden ? 'Administrator access required' : 'Database backup failed' },
      { status: unauthorized ? 401 : forbidden ? 403 : 503 },
    )
  }
}
