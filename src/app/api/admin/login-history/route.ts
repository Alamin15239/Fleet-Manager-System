import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getLoginHistory } from '@/lib/activity-tracking';
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
    const user = await requireAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedParams = querySchema.parse(queryParams);
    
    const params = {
      userId: validatedParams.userId,
      startDate: validatedParams.startDate ? new Date(validatedParams.startDate) : undefined,
      endDate: validatedParams.endDate ? new Date(validatedParams.endDate) : undefined,
      isActive: validatedParams.isActive ? validatedParams.isActive === 'true' : undefined,
      limit: validatedParams.limit ? parseInt(validatedParams.limit) : undefined,
      offset: validatedParams.offset ? parseInt(validatedParams.offset) : undefined,
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
    return NextResponse.json(
      { error: 'Failed to fetch login history' },
      { status: 500 }
    );
  }
}