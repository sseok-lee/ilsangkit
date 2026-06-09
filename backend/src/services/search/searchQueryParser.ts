import type { FacilityCategory } from '../../schemas/facility.js';
import { getRegionIndex, type RegionIndex } from './searchRegionIndex.js';
import { CATEGORY_SYNONYM_MAP } from './searchCategorySynonyms.js';

export interface ParsedQuery {
  cityToken: string | null;       // 정식 city명
  districtToken: string | null;   // district명
  categoryToken: FacilityCategory | null;
  freeText: string;               // 남은 토큰 공백 join
  raw: string;
}

export function parseSearchQuery(
  keyword: string | undefined,
  regionIndex: RegionIndex,
  synonymMap: Map<string, FacilityCategory>,
): ParsedQuery {
  const raw = (keyword ?? '').trim();
  const result: ParsedQuery = { cityToken: null, districtToken: null, categoryToken: null, freeText: '', raw };
  if (!raw) return result;

  // v1 한계(의도적): 토큰별 "first match wins". 카테고리 동의어("시장","공원")나
  // 구 축약형("강남")과 같은 토큰은 지역/카테고리로 먼저 소비되어 freeText(건물명 매칭)에서 빠진다.
  // 동음이의 건물명 매칭 보강은 Phase 2(자동완성) 과제. 공백 토큰화만 수행(세그멘테이션/오타교정 없음).
  const leftover: string[] = [];
  for (const token of raw.split(/\s+/)) {
    if (!result.cityToken && regionIndex.cityNames.has(token)) {
      result.cityToken = regionIndex.cityNames.get(token)!;
      continue;
    }
    if (!result.districtToken && regionIndex.districtNames.has(token)) {
      const hit = regionIndex.districtNames.get(token)!;
      result.districtToken = hit.district;
      if (!result.cityToken) result.cityToken = hit.city;
      continue;
    }
    if (!result.categoryToken && synonymMap.has(token)) {
      result.categoryToken = synonymMap.get(token)!;
      continue;
    }
    leftover.push(token);
  }
  result.freeText = leftover.join(' ');
  return result;
}

// 캐시 래퍼 — 서비스에서 사용
export async function parseSearchQueryCached(keyword: string | undefined): Promise<ParsedQuery> {
  const index = await getRegionIndex();
  return parseSearchQuery(keyword, index, CATEGORY_SYNONYM_MAP);
}

export interface SearchScope {
  effectiveCity?: string;
  effectiveDistrict?: string;
  nameText?: string;
  parsed: ParsedQuery;
}

// 명시적 city/district 파라미터가 파서 토큰보다 우선. freeText만 이름 매칭에 사용.
export function resolveScope(
  params: { city?: string; district?: string },
  parsed: ParsedQuery,
): SearchScope {
  return {
    effectiveCity: params.city ?? parsed.cityToken ?? undefined,
    effectiveDistrict: params.district ?? parsed.districtToken ?? undefined,
    nameText: parsed.freeText || undefined,
    parsed,
  };
}
