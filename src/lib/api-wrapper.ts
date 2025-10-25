import { NextRequest } from 'next/server';
import { handleError } from './error-handler';
import { successResponse } from './api-response';
import { logger } from './logger';

type Handler = (req: NextRequest, context?: any) => Promise<any>;

export function withErrorHandling(handler: Handler) {
  return async (req: NextRequest, context?: any) => {
    try {
      const result = await handler(req, context);
      return result;
    } catch (error) {
      logger.error('API Error', { error, path: req.nextUrl.pathname });
      return handleError(error);
    }
  };
}

export function withAuth(handler: Handler) {
  return async (req: NextRequest, context?: any) => {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return handleError(new Error('Unauthorized'));
    }

    // Add token verification logic here
    return handler(req, context);
  };
}

export function withValidation<T>(schema: any, handler: (req: NextRequest, data: T, context?: any) => Promise<any>) {
  return async (req: NextRequest, context?: any) => {
    const body = await req.json();
    const validatedData = schema.parse(body);
    return handler(req, validatedData, context);
  };
}
