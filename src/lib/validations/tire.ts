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
  origin: z.string().optional().transform(val => val?.toUpperCase()).refine(val => !val || ['CHINESE', 'SAUDI', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER'].includes(val), { message: 'Invalid origin' }),
  plateNumber: z.string().optional(),
  quantity: z.number().int().min(0).max(100).default(1),
  serialNumber: z.string().optional(),
  
  // Trailer tires
  trailerTireSize: z.string().optional(),
  trailerManufacturer: z.string().optional(),
  trailerOrigin: z.string().optional().transform(val => val?.toUpperCase()).refine(val => !val || ['CHINESE', 'SAUDI', 'JAPANESE', 'EUROPEAN', 'AMERICAN', 'OTHER'].includes(val), { message: 'Invalid trailer origin' }),
  trailerNumber: z.string().optional(),
  trailerQuantity: z.number().int().min(0).max(100).default(1),
  trailerSerialNumber: z.string().optional(),
  
  // Common fields
  driverName: z.string().optional(),
  notes: z.string().max(500).optional(),
  createdAt: z.string().optional().transform(val => {
    if (!val) return undefined
    // Handle datetime-local format (YYYY-MM-DDTHH:MM)
    if (val.length === 16 && val.includes('T')) {
      return val + ':00.000Z'
    }
    return val
  })
}).refine(
  (data) => {
    const hasTruckData = data.tireSize && data.manufacturer && data.origin && data.quantity > 0
    const hasTrailerData = data.trailerTireSize && data.trailerManufacturer && data.trailerOrigin && data.trailerQuantity > 0
    return hasTruckData || hasTrailerData
  },
  { message: 'Either truck or trailer tire data must be provided with quantity > 0' }
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