import { CAPITAL_CITY_SLUGS, RISING_LIMIT } from '../constants/regionMarket.js';
import { prisma } from '../lib/prisma.js';
import type { RisingRegion, RisingRegions, RisingScope } from '../types/housingRedesign.js';
import { isRising, regionMarketWindows } from './regionMarketSummaryService.js';

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 10;

interface CacheEntry {
  value: RisingRegions;
  expiresAt: number;
}

const cache = new Map<RisingScope, CacheEntry>();
const inflight = new Map<RisingScope, Promise<RisingRegions>>();

export function __resetRisingRegionsCacheForTest(): void {
  cache.clear();
  inflight.clear();
}

export async function getRisingRegions(scope: RisingScope = 'all', now = new Date()): Promise<RisingRegions> {
  const cached = cache.get(scope);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (cached) cache.delete(scope);

  const existing = inflight.get(scope);
  if (existing) return existing;

  const promise = loadRisingRegions(scope, now);
  inflight.set(scope, promise);
  const cleanup = (): void => {
    if (inflight.get(scope) === promise) inflight.delete(scope);
  };
  promise.then(cleanup, cleanup);
  return promise;
}

const LEGACY_JNGJ_CITY_SLUGS: readonly string[] = ['gwangju', 'jeonnam'];

async function loadRisingRegions(scope: RisingScope, now: Date): Promise<RisingRegions> {
  const capital: readonly string[] = CAPITAL_CITY_SLUGS;
  const rows = await prisma.regionMarketSummary.findMany({ where: { scope: 'district' } });
  const scoped = rows.filter((row) => {
    // 레거시 광주/전남 요약 행은 정식 jeonnamgwangju 와 거래량이 같아 중복 노출된다.
    if (LEGACY_JNGJ_CITY_SLUGS.includes(row.citySlug)) return false;
    if (scope === 'capital') return capital.includes(row.citySlug);
    if (scope === 'nonCapital') return !capital.includes(row.citySlug);
    return true;
  });

  const items: RisingRegion[] = scoped
    .filter((row) => isRising(row.volRecent, row.volPrev))
    .map((row) => ({
      label: row.label,
      citySlug: row.citySlug,
      districtSlug: row.districtSlug,
      ppMedian: row.ppMedian12m,
      volRecent: row.volRecent,
      volPrev: row.volPrev,
      changePct: Math.round((row.volRecent / row.volPrev - 1) * 1000) / 10,
    }))
    .sort((a, b) => b.changePct - a.changePct || b.volRecent - a.volRecent || a.label.localeCompare(b.label))
    .slice(0, RISING_LIMIT);

  // 구간은 요약 행에서 가져오고(전 행 동일), 테이블이 비면 오늘(KST) 기준으로 계산한다.
  const sample = rows[0];
  let window = { from: '', to: '' };
  let prevWindow = { from: '', to: '' };
  if (sample) {
    window = { from: sample.recentFrom, to: sample.recentTo };
    prevWindow = { from: sample.prevFrom, to: sample.prevTo };
  } else {
    const today = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const windows = regionMarketWindows(today);
    window = windows.recent;
    prevWindow = windows.prev;
  }
  const computedAt = rows.reduce<Date | null>(
    (latest, row) => (latest === null || row.computedAt > latest ? row.computedAt : latest),
    null,
  );

  const value: RisingRegions = {
    scope,
    window,
    prevWindow,
    computedAt: computedAt ? computedAt.toISOString() : null,
    items,
  };
  cache.set(scope, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  while (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as RisingScope | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
  return value;
}
