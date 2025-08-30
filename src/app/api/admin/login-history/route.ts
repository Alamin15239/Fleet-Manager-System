import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getLoginHistory } from '@/lib/activity-tracking';
import { db } from '@/lib/db';
import { z } from 'zod';

const querySchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  isActive: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    // Test database connection first
    try {
      await db.$queryRaw`SELECT 1`
    } catch (dbError) {
      console.error('Database connection failed:', dbError)
      return NextResponse.json({ history: [], total: 0 })
    }

    const user = await requireAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedParams = querySchema.parse(queryParams);
    
    const params = {
      userId: validatedParams.userId,
      startDate: validatedParams.startDate ? new Date(validatedParams.startDate) : undefined,
      endDate: validatedParams.endDate ? new Date(validatedParams.endDate) : undefined,
      isActive: validatedParams.isActive ? validatedParams.isActive === 'true' : undefined,
      limit: validatedParams.limit ? parseInt(validatedParams.limit) : 25,
      offset: validatedParams.offset ? parseInt(validatedParams.offset) : 0,
    };

    const result = await getLoginHistory(params);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching login history:', error);
    if (error instanceof Error) {
      if (error.message === 'No token provided' || error.message === 'Invalid token') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      if (error.message === 'Insufficient permissions') {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }
    }
    return NextResponse.json({ history: [], total: 0 });
  }
}