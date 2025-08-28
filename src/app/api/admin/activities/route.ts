import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getUserActivities } from '@/lib/activity-tracking';
import { z } from 'zod';

const querySchema = z.object({
  userId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = requireAdmin(request);
    
    const { searchParams } = new URL(request.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    
    const validatedParams = querySchema.parse(queryParams);
    
    const params = {
      userId: validatedParams.userId,
      action: validatedParams.action,
      entityType: validatedParams.entityType,
      startDate: validatedParams.startDate ? new Date(validatedParams.startDate) : undefined,
      endDate: validatedParams.endDate ? new Date(validatedParams.endDate) : undefined,
      limit: validatedParams.limit ? parseInt(validatedParams.limit) : undefined,
      offset: validatedParams.offset ? parseInt(validatedParams.offset) : undefined,
    };

    const result = await getUserActivities(params);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching user activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activities' },
      { status: 500 }
    );
  }
}