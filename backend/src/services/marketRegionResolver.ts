import { ValidationError } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT, GWANGJU_GU_BJD } from './cityMapping.js';

const MERGED_REGION_SLUG = 'jeonnamgwangju';
const LEGACY_MERGED_SLUGS = new Set(['gwangju', 'jeonnam']);

interface RegionRow {
  bjdCode: string;
  city: string;
  district: string;
  slug: string;
}

export interface ResolvedRegion {
  input: { city?: string; district?: string };
  queryCity?: string;
  queryDistrict?: string;
  label: string;
  districtLimit: string[];
}

export type MarketRegionKey =
  | { scope: 'nation'; citySlug: ''; districtSlug: ''; label: string }
  | { scope: 'city'; citySlug: string; districtSlug: ''; label: string; queryCity: string; districtLimit: string[] }
  | {
      scope: 'district';
      citySlug: string;
      districtSlug: string;
      label: string;
      queryCity: string;
      queryDistrict: string;
    };

export async function resolveMarketRegion(input: { city?: string; district?: string }): Promise<ResolvedRegion> {
  if (!input.city && input.district) {
    throw new ValidationError('city is required when district is provided');
  }

  if (!input.city) {
    return { input, label: '전국', districtLimit: [] };
  }

  const queryCity = CITY_SLUG_TO_FULL[input.city];
  if (!queryCity) {
    throw new ValidationError('unknown city slug');
  }

  // 마이크로태스크 수를 늘리지 않도록 헬퍼를 거치지 않고 바로 await 한다(홈 in-flight 테스트가 틱 수에 민감).
  const rows = await prisma.region.findMany(regionQuery(input.city, queryCity)) as RegionRow[];
  const scopedRows = rows.filter((row) => belongsToSelectedCity(input.city!, row));
  if (scopedRows.length === 0) {
    throw new ValidationError('city has no known districts');
  }

  const districtLimit = scopedRows.map((row) => row.district);
  if (input.district) {
    const match = scopedRows.find((row) => row.slug === input.district);
    if (!match) {
      throw new ValidationError('district does not belong to city');
    }

    return {
      input,
      queryCity,
      queryDistrict: match.district,
      label: `${CITY_SLUG_TO_SHORT[input.city] ?? queryCity} ${match.district}`,
      districtLimit,
    };
  }

  return {
    input,
    queryCity,
    label: CITY_SLUG_TO_SHORT[input.city] ?? queryCity,
    districtLimit,
  };
}

/** 홈 지역 선택이 보낼 수 있는 모든 (city, district) 조합. 지역 규칙은 resolveMarketRegion 과 같다. */
export async function listMarketRegionKeys(): Promise<MarketRegionKey[]> {
  const keys: MarketRegionKey[] = [{ scope: 'nation', citySlug: '', districtSlug: '', label: '전국' }];

  for (const [citySlug, queryCity] of Object.entries(CITY_SLUG_TO_FULL)) {
    const scopedRows = await loadScopedRows(citySlug, queryCity);
    if (scopedRows.length === 0) {
      continue;
    }

    const cityLabel = CITY_SLUG_TO_SHORT[citySlug] ?? queryCity;
    keys.push({
      scope: 'city',
      citySlug,
      districtSlug: '',
      label: cityLabel,
      queryCity,
      districtLimit: scopedRows.map((row) => row.district),
    });

    for (const row of scopedRows) {
      keys.push({
        scope: 'district',
        citySlug,
        districtSlug: row.slug,
        label: `${cityLabel} ${row.district}`,
        queryCity,
        queryDistrict: row.district,
      });
    }
  }

  return keys;
}

async function loadScopedRows(citySlug: string, queryCity: string): Promise<RegionRow[]> {
  const rows = await prisma.region.findMany(regionQuery(citySlug, queryCity)) as RegionRow[];
  const seen = new Set<string>();
  return rows.filter((row) => {
    // 전체명/축약명 혼재로 같은 slug 가 두 번 나올 수 있다 — 첫 행만(resolveMarketRegion 의 find 와 동일).
    if (!belongsToSelectedCity(citySlug, row) || seen.has(row.slug)) {
      return false;
    }
    seen.add(row.slug);
    return true;
  });
}

function regionQuery(citySlug: string, queryCity: string) {
  return {
    where: { city: { in: regionLookupCities(citySlug, queryCity) } },
    select: { bjdCode: true, city: true, district: true, slug: true },
    orderBy: { district: 'asc' as const },
  };
}

function regionLookupCities(citySlug: string, queryCity: string): string[] {
  const lookup = new Set([queryCity, CITY_SLUG_TO_SHORT[citySlug]].filter(Boolean));
  if (LEGACY_MERGED_SLUGS.has(citySlug)) {
    lookup.add(CITY_SLUG_TO_FULL[MERGED_REGION_SLUG]);
  }
  return [...lookup];
}

function belongsToSelectedCity(citySlug: string, row: RegionRow): boolean {
  if (citySlug === 'gwangju') {
    return GWANGJU_GU_BJD.has(row.bjdCode);
  }

  if (citySlug === 'jeonnam') {
    return row.city === CITY_SLUG_TO_FULL[MERGED_REGION_SLUG] && !GWANGJU_GU_BJD.has(row.bjdCode);
  }

  return true;
}
