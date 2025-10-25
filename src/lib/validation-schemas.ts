import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMIN', 'MANAGER', 'USER']).optional(),
});

export const truckSchema = z.object({
  vin: z.string().min(17, 'VIN must be 17 characters').max(17),
  make: z.string().min(1, 'Make is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1),
  licensePlate: z.string().min(1, 'License plate is required'),
  currentMileage: z.number().int().min(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'MAINTENANCE']).optional(),
});

export const maintenanceSchema = z.object({
  truckId: z.string().cuid(),
  serviceType: z.string().min(1, 'Service type is required'),
  description: z.string().optional(),
  datePerformed: z.string().datetime(),
  partsCost: z.number().min(0).default(0),
  laborCost: z.number().min(0).default(0),
  totalCost: z.number().min(0).default(0),
  mechanicId: z.string().cuid().optional(),
  status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
});

export const tireSchema = z.object({
  tireSize: z.string().min(1, 'Tire size is required'),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  origin: z.string().min(1, 'Origin is required'),
  plateNumber: z.string().optional(),
  trailerNumber: z.string().optional(),
  driverName: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  serialNumber: z.string().optional(),
  notes: z.string().optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  title: z.string().optional(),
  bio: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'USER']).optional(),
  isActive: z.boolean().optional(),
});
