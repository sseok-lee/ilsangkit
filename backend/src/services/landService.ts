import { prisma } from '../lib/prisma.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeRow(row: any): any {
  const result = { ...row };
  for (const key of Object.keys(result)) {
    const v = result[key];
    if (typeof v === 'bigint') result[key] = Number(v);
    else if (v && typeof v === 'object' && typeof v.toNumber === 'function') result[key] = v.toNumber();
  }
  return result;
}

export interface RegionListParams {
  city?: string;
  district?: string;
  page: number;
  limit: number;
}

export interface RegionListResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getRegionList(params: RegionListParams): Promise<RegionListResult> {
  const { city, district, page, limit } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (city) where.city = city;
  if (district) where.district = district;

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.landAreaSummary.findMany({
      where,
      orderBy: { transactionCount: 'desc' },
      skip,
      take: limit,
    }),
    prisma.landAreaSummary.count({ where }),
  ]);

  return {
    items: rows.map((r) => {
      const s = serializeRow(r);
      if (s.avgPricePerPyeong != null) s.avgPricePerPyeong = Number(s.avgPricePerPyeong);
      return s;
    }),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
