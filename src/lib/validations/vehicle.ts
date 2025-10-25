import { z } from 'zod'

export const vehicleSchema = z.object({
  plateNumber: z.string().min(1, 'Plate number is required').max(20, 'Plate number too long'),
  trailerNumber: z.string().max(20, 'Trailer number too long').optional().nullable(),
  driverName: z.string().max(100, 'Driver name too long').optional().nullable(),
  isActive: z.boolean().default(true)
})

export const vehicleQuerySchema = z.object({
  search: z.string().max(100).optional(),
  plateOnly: z.coerce.boolean().default(false),
  trailerOnly: z.coerce.boolean().default(false),
  status: z.enum(['active', 'inactive', 'all']).default('all')
})

export type VehicleInput = z.infer<typeof vehicleSchema>
export type VehicleQuery = z.infer<typeof vehicleQuerySchema>