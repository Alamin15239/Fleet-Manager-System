import { z } from 'zod'

export const tireSchema = z.object({
  tireSize: z.string().min(1, 'Tire size is required').max(50, 'Tire size too long'),
  manufacturer: z.string().min(1, 'Manufacturer is required').max(100, 'Manufacturer name too long'),
  origin: z.enum(['CHINESE', 'SAUDI', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER'], { required_error: 'Origin is required' }),
  plateNumber: z.string().optional().nullable(),
  trailerNumber: z.string().optional().nullable(),
  driverName: z.string().optional().nullable(),
  quantity: z.number().int().min(1).max(100).default(1),
  serialNumber: z.string().optional().nullable(),
  notes: z.string().max(500, 'Notes too long').optional().nullable(),
  createdAt: z.string().datetime().optional()
})

export const createTireSchema = z.object({
  // Truck tires
  tireSize: z.string().optional(),
  manufacturer: z.string().optional(),
  origin: z.enum(['CHINESE', 'SAUDI', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER']).optional(),
  plateNumber: z.string().optional(),
  quantity: z.number().int().min(0).max(100).default(1),
  serialNumber: z.string().optional(),
  
  // Trailer tires
  trailerTireSize: z.string().optional(),
  trailerManufacturer: z.string().optional(),
  trailerOrigin: z.enum(['CHINESE', 'SAUDI', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER']).optional(),
  trailerNumber: z.string().optional(),
  trailerQuantity: z.number().int().min(0).max(100).default(1),
  trailerSerialNumber: z.string().optional(),
  
  // Common fields
  driverName: z.string().optional(),
  notes: z.string().max(500).optional(),
  createdAt: z.string().datetime().optional()
}).refine(
  (data) => {
    const hasTruckData = data.tireSize && data.manufacturer
    const hasTrailerData = data.trailerTireSize && data.trailerManufacturer
    return hasTruckData || hasTrailerData
  },
  { message: 'Either truck or trailer tire data must be provided' }
)

export const tireQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  origin: z.string().optional(), // Allow any string for existing data
  plateNumber: z.string().max(50).optional(),
  driverName: z.string().max(100).optional()
})

export type TireInput = z.infer<typeof tireSchema>
export type CreateTireInput = z.infer<typeof createTireSchema>
export type TireQuery = z.infer<typeof tireQuerySchema>