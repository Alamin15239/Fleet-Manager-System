import { controlDb } from '@/lib/db';
import type { PrismaClient } from '@/lib/prisma-compat';

export const prisma: PrismaClient = controlDb;
