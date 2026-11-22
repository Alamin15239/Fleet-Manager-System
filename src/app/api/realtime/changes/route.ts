import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Authenticated change watermark for Vercel-compatible polling.
export async function GET(request: NextRequest) {
  try {
    await requireAuth(request)
    const rows = await db.$queryRawUnsafe<Array<{ version: Date | null; rowCount: bigint | number }>>(
      "SELECT MAX(changed_at) AS version, SUM(row_count)::bigint AS \"rowCount\" FROM (" +
      "SELECT MAX(\"updatedAt\") AS changed_at, COUNT(*)::bigint AS row_count FROM \"trucks\" " +
      "UNION ALL SELECT MAX(\"updatedAt\"), COUNT(*)::bigint FROM \"trailers\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"drivers\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"maintenance_jobs\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"predictive_alerts\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"trailer_predictive_alerts\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"settings\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"vendors\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"fleet_ledger_accounts\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"notifications\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"trailer_notifications\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"vehicles\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"vehicle_types\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"fleet_vehicles\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"vehicle_documents\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"maintenance_types\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"documents\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"organizations\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"organization_purchase_requests\\\" " +
      "UNION ALL SELECT MAX(\\\"updatedAt\\\"), COUNT(*)::bigint FROM \\\"organization_billing_payments\\\" " +
      "UNION ALL SELECT MAX(\"updatedAt\"), COUNT(*)::bigint FROM \"maintenance_records\" " +
      "UNION ALL SELECT MAX(\"updatedAt\"), COUNT(*)::bigint FROM \"trailer_maintenance_records\" " +
      "UNION ALL SELECT MAX(\"updatedAt\"), COUNT(*)::bigint FROM \"tires\" " +
      "UNION ALL SELECT MAX(\"updatedAt\"), COUNT(*)::bigint FROM \"workshop_job_cards\" " +
      "UNION ALL SELECT MAX(\"updatedAt\"), COUNT(*)::bigint FROM \"mechanics\" " +
      "UNION ALL SELECT MAX(\"updatedAt\"), COUNT(*)::bigint FROM \"purchase_invoices\" " +
      "UNION ALL SELECT MAX(\"updatedAt\"), COUNT(*)::bigint FROM \"inventory_items\" " +
      "UNION ALL SELECT MAX(\"createdAt\"), COUNT(*)::bigint FROM \"inventory_transactions\" " +
      "UNION ALL SELECT MAX(\"createdAt\"), COUNT(*)::bigint FROM \"purchase_journal_entries\" " +
      ") changes"
    )
    const version = rows[0]?.version ? new Date(rows[0].version).toISOString() : 'empty'
    return NextResponse.json(
      { version: `${version}:${String(rows[0]?.rowCount ?? 0)}` },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const status = ['No token provided', 'Invalid token'].includes(message) ? 401 : 500
    return NextResponse.json({ error: status === 401 ? 'Authentication required' : 'Unable to check data updates' }, { status })
  }
}
