import { prisma } from '../../lib/prisma.js';

export interface PopularItem { keyword: string }
export interface PopularResult { items: PopularItem[]; source: 'aggregated' | 'static' }

const STATIC_POPULAR: string[] = [
  '화장실', '주차장', '아파트 실거래가', '약국', '도서관', '공원', '전기차 충전소', '병원',
];
const MIN_DISTINCT = 10;        // 집계 전환 임계치
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { result: PopularResult; at: number } | null = null;

export function __clearPopularCache(): void { cache = null; }

function periodStart(period: 'day' | 'week' | 'month', now: number): Date {
  const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

export async function getPopular(
  params: { limit: number; period: 'day' | 'week' | 'month' },
  now: number = Date.now(),
): Promise<PopularResult> {
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.result;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grouped: any[] = await prisma.searchLog.groupBy({
    by: ['keyword'],
    where: { keyword: { not: null }, createdAt: { gte: periodStart(params.period, now) } },
    _count: { keyword: true },
    orderBy: { _count: { keyword: 'desc' } },
    take: Math.max(params.limit, MIN_DISTINCT),
  }).catch(() => []);

  let result: PopularResult;
  if (grouped.length >= MIN_DISTINCT) {
    result = { source: 'aggregated', items: grouped.slice(0, params.limit).map((g) => ({ keyword: g.keyword as string })) };
  } else {
    result = { source: 'static', items: STATIC_POPULAR.slice(0, params.limit).map((keyword) => ({ keyword })) };
  }
  cache = { result, at: now };
  return result;
}
