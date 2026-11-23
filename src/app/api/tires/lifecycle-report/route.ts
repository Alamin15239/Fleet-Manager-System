import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermission } from '@/lib/permission-middleware'
import { ensureTireLifecycleTables } from '@/lib/tire-lifecycle'

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'tire-management', 'read')
  if (auth instanceof NextResponse) return auth

  try {
    await db.$transaction(async tx => ensureTireLifecycleTables(tx))
    const [summary, inventory, damageByDriver, damageByReason, damageByVehicle, vehicleUsage, tireLife, purchaseBySupplier, inspectionDue, averageLife] = await Promise.all([
      db.$queryRawUnsafe<any[]>(`SELECT
        COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND "lifecycleStatus"='STOCK')::int AS "inStock",
        COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND "lifecycleStatus"='INSTALLED')::int AS "installed",
        COUNT(*) FILTER (WHERE "deletedAt" IS NULL AND "lifecycleStatus"='DAMAGED')::int AS "damaged",
        COUNT(*) FILTER (WHERE "lifecycleStatus"='DISPOSED')::int AS "disposed",
        (SELECT COUNT(*)::int FROM "tire_lifecycle_events" WHERE "eventType"='RECEIVE') AS "totalReceived",
        (SELECT COUNT(*)::int FROM "tire_lifecycle_events" WHERE "eventType"='DAMAGE') AS "damageEvents"
        FROM "tires"`),
      db.$queryRawUnsafe<any[]>(`SELECT "tireSize","manufacturer","lifecycleStatus",COUNT(*)::int AS "tireCount"
        FROM "tires" WHERE "deletedAt" IS NULL AND "lifecycleStatus"<>'DISPOSED'
        GROUP BY "tireSize","manufacturer","lifecycleStatus"
        ORDER BY "tireSize","manufacturer","lifecycleStatus"`),
      db.$queryRawUnsafe<any[]>(`SELECT COALESCE(NULLIF("driverNameSnapshot",''),'Unknown driver') AS "driverName",
        COUNT(*)::int AS "damageCount",COALESCE(SUM("cost"),0)::float AS "damageCost"
        FROM "tire_lifecycle_events" WHERE "eventType"='DAMAGE'
        GROUP BY COALESCE(NULLIF("driverNameSnapshot",''),'Unknown driver')
        ORDER BY "damageCount" DESC,"damageCost" DESC`),
      db.$queryRawUnsafe<any[]>(`SELECT COALESCE(NULLIF("damageType",''),'Unspecified') AS "damageType",
        COALESCE(NULLIF("reason",''),'Unspecified') AS "reason",COUNT(*)::int AS "damageCount",
        COALESCE(SUM("cost"),0)::float AS "damageCost"
        FROM "tire_lifecycle_events" WHERE "eventType"='DAMAGE'
        GROUP BY "damageType","reason" ORDER BY "damageCount" DESC`),
      db.$queryRawUnsafe<any[]>(`SELECT e."fromTruckId",e."fromTrailerId",
        COALESCE(t."licensePlate",tr."number",'Unknown vehicle') AS "vehicleLabel",
        COUNT(*)::int AS "damageCount",COALESCE(SUM(e."cost"),0)::float AS "damageCost"
        FROM "tire_lifecycle_events" e
        LEFT JOIN "trucks" t ON t."id"=e."fromTruckId"
        LEFT JOIN "trailers" tr ON tr."id"=e."fromTrailerId"
        WHERE e."eventType"='DAMAGE'
        GROUP BY e."fromTruckId",e."fromTrailerId",t."licensePlate",tr."number"
        ORDER BY "damageCount" DESC`),
      db.$queryRawUnsafe<any[]>(`SELECT p."vehicleType",p."vehicleId",
        COALESCE(t."licensePlate",tr."number",p."vehicleId") AS "vehicleLabel",
        COUNT(*)::int AS "tiresUsed",
        COALESCE(SUM(CASE WHEN p."startOdometer" IS NULL THEN 0 ELSE GREATEST(COALESCE(p."endOdometer",CASE WHEN p."removedAt" IS NULL THEN t."currentMileage" END,p."startOdometer")-p."startOdometer",0) END),0)::float AS "totalKm",
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(p."removedAt",NOW())-p."installedAt"))/86400),0)::float AS "totalDays"
        FROM "tire_usage_periods" p
        LEFT JOIN "trucks" t ON p."vehicleType"='truck' AND t."id"=p."vehicleId"
        LEFT JOIN "trailers" tr ON p."vehicleType"='trailer' AND tr."id"=p."vehicleId"
        GROUP BY p."vehicleType",p."vehicleId",t."licensePlate",tr."number"
        ORDER BY "tiresUsed" DESC,"totalKm" DESC`),
      db.$queryRawUnsafe<any[]>(`SELECT t."id",t."internalCode",t."tireSize",t."manufacturer",
        COUNT(p."id")::int AS "installations",
        COALESCE(SUM(CASE WHEN p."startOdometer" IS NULL THEN 0 ELSE GREATEST(COALESCE(p."endOdometer",CASE WHEN p."removedAt" IS NULL THEN v."currentMileage" END,p."startOdometer")-p."startOdometer",0) END),0)::float AS "lifetimeKm",
        COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(p."removedAt",NOW())-p."installedAt"))/86400),0)::float AS "lifetimeDays"
        FROM "tires" t LEFT JOIN "tire_usage_periods" p ON p."tireId"=t."id"
        LEFT JOIN "trucks" v ON p."vehicleType"='truck' AND v."id"=p."vehicleId"
        GROUP BY t."id",t."internalCode",t."tireSize",t."manufacturer"
        ORDER BY "lifetimeKm" DESC`),
      db.$queryRawUnsafe<any[]>(`SELECT COALESCE(NULLIF("supplierName",''),'Unspecified supplier') AS "supplierName",
        COUNT(*)::int AS "tiresReceived",COALESCE(SUM("purchaseCost"),0)::float AS "purchaseSpend"
        FROM "tires" WHERE "deletedAt" IS NULL
        GROUP BY COALESCE(NULLIF("supplierName",''),'Unspecified supplier')
        ORDER BY "purchaseSpend" DESC,"tiresReceived" DESC`),
      db.$queryRawUnsafe<any[]>(`SELECT e."tireId",t."internalCode",t."tireSize",t."manufacturer",
        e."condition",e."treadDepthMm",e."pressurePsi",e."inspectionDueAt",e."eventAt"
        FROM "tire_lifecycle_events" e JOIN "tires" t ON t."id"=e."tireId"
        WHERE e."eventType"='INSPECT' AND e."inspectionDueAt" IS NOT NULL
          AND e."inspectionDueAt" <= NOW() + INTERVAL '30 days'
          AND t."deletedAt" IS NULL
          AND e."id"=(SELECT e2."id" FROM "tire_lifecycle_events" e2 WHERE e2."tireId"=e."tireId" AND e2."eventType"='INSPECT' ORDER BY e2."eventAt" DESC LIMIT 1)
        ORDER BY e."inspectionDueAt" ASC LIMIT 200`),
      db.$queryRawUnsafe<any[]>(`SELECT "manufacturer","tireSize",COUNT(*)::int AS "tireCount",
        AVG("lifetimeDays")::float AS "averageLifeDays",AVG("lifetimeKm")::float AS "averageLifeKm"
        FROM (
          SELECT t."id",t."manufacturer",t."tireSize",
            COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(p."removedAt",NOW())-p."installedAt"))/86400),0)::float AS "lifetimeDays",
            COALESCE(SUM(CASE WHEN p."startOdometer" IS NULL THEN 0 ELSE GREATEST(COALESCE(p."endOdometer",CASE WHEN p."removedAt" IS NULL THEN v."currentMileage" END,p."startOdometer")-p."startOdometer",0) END),0)::float AS "lifetimeKm"
          FROM "tires" t LEFT JOIN "tire_usage_periods" p ON p."tireId"=t."id"
          LEFT JOIN "trucks" v ON p."vehicleType"='truck' AND v."id"=p."vehicleId"
          GROUP BY t."id",t."manufacturer",t."tireSize"
          HAVING COUNT(p."id")>0
        ) life GROUP BY "manufacturer","tireSize" ORDER BY "averageLifeKm" DESC`)
    ])
    return NextResponse.json({
      summary: summary[0] || { inStock: 0, installed: 0, damaged: 0, disposed: 0, totalReceived: 0, damageEvents: 0 },
      inventory, damageByDriver, damageByReason, damageByVehicle, vehicleUsage, tireLife, averageLife, purchaseBySupplier, inspectionDue
    })
  } catch (error) {
    console.error('Tire lifecycle report error:', error)
    return NextResponse.json({ error: 'Failed to build tire lifecycle report' }, { status: 500 })
  }
}
