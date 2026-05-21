import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { FULL_TO_SLUG, SHORT_TO_SLUG } from './cityMapping.js';
import type {
  ComplexRef, NewHighRow, ActiveRow, TopPyeongRow, ComplexHotspots,
} from '../types/homeDashboard.js';
import type { RealEstatePropertyType } from '../schemas/realEstate.js';

const MAX_PER_CARD = 5;
const NEW_HIGH_PRIOR_MIN_TXN = 3;       // 직전 12개월 ≥ 3건
const ACTIVE_MIN_TXN = 2;                // 30일 ≥ 2건
const TOP_PYEONG_MIN_TXN = 2;            // 30일 ≥ 2건
const CITY_CAP = 2;                      // active/topPyeong 시별 캡

type SaleTable = 'AptSaleTransaction' | 'VillaSaleTransaction' | 'OffitelSaleTransaction';

function cityToSlug(city: string): string {
  return FULL_TO_SLUG[city] ?? SHORT_TO_SLUG[city] ?? '';
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

type RawNewHighRow = {
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  districtSlug: string;
  dealDate: string | Date;
  newPyeong: number | string;
  prevMaxPyeong: number | string;
  changePct: number | string;
};

function toIsoDate(v: string | Date): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** 카드 1: 신고가 갱신 */
export async function getNewHigh(table: SaleTable): Promise<NewHighRow[]> {
  const tbl = Prisma.raw(table);
  const rows = await prisma.$queryRaw<RawNewHighRow[]>`
    WITH anchor AS (
      SELECT MAX(STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')) AS latest
      FROM ${tbl} t
    ),
    recent AS (
      SELECT t.buildingName, t.bjdCode, t.city, t.district,
             STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d') AS dealDate,
             t.dealAmount / (t.exclusiveArea / 3.3058) AS pyeongPrice
      FROM ${tbl} t, anchor a
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(a.latest, INTERVAL 7 DAY)
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            <= a.latest
    ),
    recent_top AS (
      SELECT buildingName, bjdCode, city, district,
             MAX(dealDate) AS dealDate,
             MAX(pyeongPrice) AS newPyeong
      FROM recent
      GROUP BY buildingName, bjdCode, city, district
    ),
    prior AS (
      SELECT t.buildingName, t.bjdCode,
             MAX(t.dealAmount / (t.exclusiveArea / 3.3058)) AS prevMaxPyeong,
             COUNT(*) AS prevCount
      FROM ${tbl} t, anchor a
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(a.latest, INTERVAL 365 DAY)
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            <  DATE_SUB(a.latest, INTERVAL 7 DAY)
      GROUP BY t.buildingName, t.bjdCode
      HAVING COUNT(*) >= ${NEW_HIGH_PRIOR_MIN_TXN}
    )
    SELECT r.buildingName, r.bjdCode, r.city, r.district,
           reg.slug AS districtSlug,
           r.dealDate AS dealDate,
           r.newPyeong AS newPyeong,
           p.prevMaxPyeong AS prevMaxPyeong,
           (r.newPyeong / p.prevMaxPyeong - 1) * 100 AS changePct
    FROM recent_top r
    INNER JOIN prior p ON p.buildingName = r.buildingName AND p.bjdCode = r.bjdCode
    INNER JOIN Region reg ON reg.city = r.city AND reg.district = r.district
    WHERE r.newPyeong > p.prevMaxPyeong
    ORDER BY changePct DESC
    LIMIT ${MAX_PER_CARD}
  `;

  return rows.map((r) => ({
    buildingName: r.buildingName,
    citySlug: cityToSlug(r.city),
    city: r.city,
    district: r.district,
    districtSlug: r.districtSlug,
    dealDate: toIsoDate(r.dealDate),
    newPyeong: toNumber(r.newPyeong),
    prevMaxPyeong: toNumber(r.prevMaxPyeong),
    changePct: toNumber(r.changePct),
  }));
}
