import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';

const SALE_TABLES: Record<string, string> = {
  'apt-sale': 'AptSaleTransaction',
  'villa-sale': 'VillaSaleTransaction',
  'offitel-sale': 'OffitelSaleTransaction',
};

export interface NewHighItem {
  buildingName: string; city: string; district: string; bjdCode: string;
  areaBucket: number; curMax: number; histMax: number; risePct: number; priorCnt: number; curYm: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { data: { items: NewHighItem[]; asOfYm: number | null }; expiry: number }>();
export function _resetNewHighCacheForTests() { cache.clear(); }

const RECENT_MONTHS = 3;
function cutoffYm(anchorYm: number): number {
  const y = Math.floor(anchorYm / 100), m = anchorYm % 100;
  const total = y * 12 + (m - 1) - (RECENT_MONTHS - 1);
  return Math.floor(total / 12) * 100 + (total % 12) + 1;
}

export async function getNewHighBuildings(type: string, limit = 30) {
  const table = SALE_TABLES[type];
  if (!table) throw new Error(`Unsupported type for new-high: ${type}`);
  const ck = `${type}:${limit}`;
  const hit = cache.get(ck);
  if (hit && Date.now() < hit.expiry) return hit.data;

  const tbl = Prisma.raw(table);
  const anchorRows = await prisma.$queryRaw<Array<{ ym: number | bigint | null }>>(Prisma.sql`
    SELECT MAX(dealYear * 100 + dealMonth) AS ym FROM ${tbl}
    WHERE (cancelDealDay IS NULL OR cancelDealDay = '')`);
  const asOfYm = anchorRows[0]?.ym == null ? null : Number(anchorRows[0].ym);
  if (asOfYm == null) { const data = { items: [], asOfYm: null }; cache.set(ck, { data, expiry: Date.now() + CACHE_TTL_MS }); return data; }
  const cutoff = cutoffYm(asOfYm);

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    WITH base AS (
      SELECT city, district, buildingName, bjdCode,
             ROUND(exclusiveArea / 5) * 5 AS areaBucket,
             dealYear * 100 + dealMonth AS ym, dealAmount
      FROM ${tbl}
      WHERE exclusiveArea > 0
        AND (cancelDealDay IS NULL OR cancelDealDay = '')
        AND buildingName IS NOT NULL AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
    ),
    mx AS (SELECT city,district,buildingName,bjdCode,areaBucket, MAX(ym) AS curYm FROM base GROUP BY city,district,buildingName,bjdCode,areaBucket),
    cur AS (
      SELECT b.city,b.district,b.buildingName,b.bjdCode,b.areaBucket, m.curYm, MAX(b.dealAmount) AS curMax
      FROM base b JOIN mx m ON m.city=b.city AND m.district=b.district AND m.buildingName=b.buildingName AND m.bjdCode=b.bjdCode AND m.areaBucket=b.areaBucket AND b.ym=m.curYm
      GROUP BY b.city,b.district,b.buildingName,b.bjdCode,b.areaBucket,m.curYm
    ),
    hist AS (
      SELECT b.city,b.district,b.buildingName,b.bjdCode,b.areaBucket, MAX(b.dealAmount) AS histMax, COUNT(*) AS prior_cnt
      FROM base b JOIN mx m ON m.city=b.city AND m.district=b.district AND m.buildingName=b.buildingName AND m.bjdCode=b.bjdCode AND m.areaBucket=b.areaBucket AND b.ym<m.curYm
      GROUP BY b.city,b.district,b.buildingName,b.bjdCode,b.areaBucket
    )
    SELECT c.buildingName, c.city, c.district, c.bjdCode, c.areaBucket, c.curYm,
           c.curMax, h.histMax, h.prior_cnt AS priorCnt,
           ROUND((c.curMax - h.histMax) / h.histMax * 100, 2) AS risePct
    FROM cur c JOIN hist h USING (city,district,buildingName,bjdCode,areaBucket)
    WHERE h.prior_cnt >= 2 AND c.curMax > h.histMax AND c.curYm >= ${cutoff}
    ORDER BY c.curYm DESC, c.curMax DESC
    LIMIT ${limit}`);

  const items: NewHighItem[] = rows.map((r) => ({
    buildingName: String(r.buildingName ?? ''), city: String(r.city ?? ''), district: String(r.district ?? ''), bjdCode: String(r.bjdCode ?? ''),
    areaBucket: Number(r.areaBucket), curMax: Number(r.curMax), histMax: Number(r.histMax),
    risePct: r.risePct == null ? 0 : Number(r.risePct), priorCnt: Number(r.priorCnt), curYm: Number(r.curYm),
  }));
  const data = { items, asOfYm };
  cache.set(ck, { data, expiry: Date.now() + CACHE_TTL_MS });
  return data;
}
