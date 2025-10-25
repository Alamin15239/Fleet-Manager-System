import { Prisma } from '@prisma/client';

interface PaginationParams {
  page?: number;
  limit?: number;
}

interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface FilterParams {
  [key: string]: any;
}

export class QueryBuilder {
  static paginate(params: PaginationParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 10));
    
    return {
      skip: (page - 1) * limit,
      take: limit,
      meta: { page, limit },
    };
  }

  static sort(params: SortParams) {
    if (!params.sortBy) return {};
    
    return {
      orderBy: {
        [params.sortBy]: params.sortOrder || 'asc',
      },
    };
  }

  static buildWhere(filters: FilterParams): any {
    const where: any = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined || value === null) continue;

      if (typeof value === 'string' && value.includes('*')) {
        where[key] = {
          contains: value.replace(/\*/g, ''),
          mode: 'insensitive',
        };
      } else if (Array.isArray(value)) {
        where[key] = { in: value };
      } else {
        where[key] = value;
      }
    }

    return where;
  }

  static async paginated<T>(
    model: any,
    params: PaginationParams & SortParams & { where?: any }
  ): Promise<{ data: T[]; meta: any }> {
    const { skip, take, meta } = this.paginate(params);
    const orderBy = this.sort(params);

    const [data, total] = await Promise.all([
      model.findMany({
        where: params.where,
        skip,
        take,
        ...orderBy,
      }),
      model.count({ where: params.where }),
    ]);

    return {
      data,
      meta: {
        ...meta,
        total,
        totalPages: Math.ceil(total / meta.limit),
      },
    };
  }
}
