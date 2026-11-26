import { getOrCreateOpenJobCard, recordTireLifecycleEvent } from '@/lib/tire-lifecycle'
import { reconcileJobCardInventory, reconcileOilChangeInventory } from '@/lib/job-card-inventory'

const date = new Date('2026-11-23T08:00:00.000Z')

describe('fleet maintenance synchronization', () => {
  describe('central workshop job cards', () => {
    it('reuses the vehicle open job card instead of creating a duplicate', async () => {
      const tx = {
        $executeRawUnsafe: jest.fn().mockResolvedValue(0),
        truck: { findFirst: jest.fn().mockResolvedValue({ id: 'truck-1' }) },
        trailer: { findFirst: jest.fn() },
        workshopJobCard: {
          findMany: jest.fn().mockResolvedValue([{
            id: 'job-existing', serviceDate: date, creationSource: 'WORKBOOK'
          }]),
          create: jest.fn()
        }
      }

      const result = await getOrCreateOpenJobCard(
        tx,
        { vehicleType: 'truck', vehicleId: 'truck-1' },
        { eventAt: date, userId: 'user-1', serviceType: 'OIL CHANGE' }
      )

      expect(result).toBe('job-existing')
      expect(tx.workshopJobCard.create).not.toHaveBeenCalled()
      expect(tx.workshopJobCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ truckId: 'truck-1', status: { in: ['OPEN', 'IN_PROGRESS'] } })
      }))
    })

    it('creates one open job card when the vehicle has none', async () => {
      const tx = {
        $executeRawUnsafe: jest.fn().mockResolvedValue(0),
        truck: { findFirst: jest.fn().mockResolvedValue({ id: 'truck-1' }) },
        trailer: { findFirst: jest.fn() },
        workshopJobCard: {
          findMany: jest.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ jobNumber: 'JC-2026-0007' }]),
          create: jest.fn().mockResolvedValue({ id: 'job-new' })
        }
      }

      const result = await getOrCreateOpenJobCard(
        tx,
        { vehicleType: 'truck', vehicleId: 'truck-1' },
        { eventAt: date, userId: 'user-1', serviceType: 'MAINTENANCE' }
      )

      expect(result).toMatch(/^jc_/)
      expect(tx.workshopJobCard.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          jobNumber: 'JC-2026-0008',
          truckId: 'truck-1',
          status: 'OPEN'
        })
      }))
    })
  })

  it('reverses previous job-card part issues and deducts the new issued quantity', async () => {
    const executeCalls: unknown[][] = []
    const tx = {
      $executeRawUnsafe: jest.fn(async (...args: unknown[]) => { executeCalls.push(args); return 1 }),
      $queryRawUnsafe: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT "itemId"')) return [{ itemId: 'part-1', qty: 3 }]
        if (sql.includes('SELECT "id" FROM "inventory_items"')) return [{ id: 'part-1' }]
        if (sql.includes('SELECT COALESCE(SUM')) return [{ qty: 12 }]
        return []
      })
    }

    await reconcileJobCardInventory(tx, {
      jobCardId: 'job-1',
      lines: [{ type: 'PART', inventoryItemId: 'part-1', quantity: 2, description: 'Brake pad' }],
      vehicleType: 'truck',
      vehicleId: 'truck-1',
      transactionDate: date,
      userId: 'user-1'
    })

    const sql = executeCalls.map(call => String(call[0])).join('\n')
    expect(sql).toContain("'CUSTOMER_RETURN'")
    expect(sql).toContain("'ISSUE'")
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      'part-1'
    )
  })

  it('reverses an oil change issue and records the replacement oil consumption', async () => {
    const executeCalls: unknown[][] = []
    const tx = {
      $executeRawUnsafe: jest.fn(async (...args: unknown[]) => { executeCalls.push(args); return 1 }),
      $queryRawUnsafe: jest.fn(async (sql: string) => {
        if (sql.includes('SELECT "itemId"')) return [{ itemId: 'oil-1', qty: 8 }]
        if (sql.includes('SELECT "id","unit"')) return [{ id: 'oil-1', unit: 'litres' }]
        if (sql.includes('SELECT COALESCE(SUM')) return [{ qty: 40 }]
        return []
      })
    }

    await reconcileOilChangeInventory(tx, {
      maintenanceId: 'maintenance-1',
      inventoryItemId: 'oil-1',
      quantityLiters: 6,
      transactionDate: date,
      vehicleId: 'truck-1',
      userId: 'user-1',
      jobCardId: 'job-1'
    })

    const sql = executeCalls.map(call => String(call[0])).join('\n')
    expect(sql).toContain("'CUSTOMER_RETURN'")
    expect(sql).toContain("'OIL_CHANGE'")
    expect(sql).toContain("'ISSUE'")
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FOR UPDATE'),
      'oil-1'
    )
  })

  it('transfers a tire, closes its old usage period, starts a new one and links the source job card', async () => {
    const executeCalls: unknown[][] = []
    const queryCalls: unknown[][] = []
    const tx: any = {
      $executeRawUnsafe: jest.fn(async (...args: unknown[]) => { executeCalls.push(args); return 1 }),
      $queryRawUnsafe: jest.fn(async (sql: string, ...args: unknown[]) => {
        queryCalls.push([sql, ...args])
        if (sql.includes('FROM "tires" WHERE "id"=$1 FOR UPDATE')) {
          return [{
            id: 'tire-1', truckId: 'truck-1', plateNumber: 'ABC123', trailerNumber: null,
            lifecycleStatus: 'INSTALLED', currentPosition: 'FRONT_LEFT',
            internalCode: 'TY-000001', installedAt: new Date('2026-10-01T00:00:00Z')
          }]
        }
        if (sql.includes('SELECT "id" FROM "tires" WHERE "truckId"')) return []
        if (sql.includes('SELECT "licensePlate","driverName"')) {
          return [{ licensePlate: 'XYZ789', driverName: 'New Driver' }]
        }
        return []
      }),
      truck: {
        findUnique: jest.fn().mockResolvedValue({ driverName: 'Driver One' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'truck-1' })
      },
      trailer: { findFirst: jest.fn(), findUnique: jest.fn() },
      workshopJobCard: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'job-source', serviceDate: date, creationSource: 'MANUAL'
        }])
      }
    }

    const result = await recordTireLifecycleEvent(tx, {
      tireId: 'tire-1',
      eventType: 'TRANSFER',
      eventAt: date,
      vehicle: { vehicleType: 'truck', vehicleId: 'truck-2' },
      position: 'REAR_RIGHT',
      driverName: 'New Driver',
      odometerKm: 120000,
      reason: 'Move tire to replacement truck',
      userId: 'user-1'
    })

    expect(result.jobCardId).toBe('job-source')
    expect(result.lifecycleStatus).toBe('INSTALLED')
    expect(tx.workshopJobCard.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ truckId: 'truck-1', status: { in: ['OPEN', 'IN_PROGRESS'] } })
    }))
    const sql = executeCalls.map(call => String(call[0])).join('\n')
    expect(sql).toContain('UPDATE "tire_usage_periods" SET "removedAt"')
    expect(sql).toContain('INSERT INTO "tire_usage_periods"')
    expect(sql).toContain('UPDATE "tires" SET "truckId"=$2')
    const eventInsert = executeCalls.find(call => String(call[0]).includes('INSERT INTO "tire_lifecycle_events"') && call.includes('job-source'))
    expect(eventInsert).toBeDefined()
    expect(eventInsert).toContain('job-source')
    expect(queryCalls.some(call => String(call[0]).includes('FOR UPDATE'))).toBe(true)
  })
})
