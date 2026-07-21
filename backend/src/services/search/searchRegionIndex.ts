import { getRegions } from '../metaService.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT, FULL_TO_SLUG } from '../cityMapping.js';
import { JNGJ_CITY } from '../../lib/normalizeRegionName.js';

export interface RegionIndex {
  cityNames: Map<string, string>; // 입력형(정식/축약) → 정식 city명
  districtNames: Map<string, { city: string; district: string }>; // 입력형 → {정식 city, district}
}

/**
 * 2026-07 전남광주통합특별시(JNGJ) 정규화 회귀 방지(리뷰 M1):
 * 정규화 완료 후 Region 테이블엔 city=JNGJ_CITY 행만 남고 옛 광주/전남 축약 city 값은
 * 더 이상 존재하지 않는다. 옛 시/도명 단독 검색("광주 화장실", "전남 약국")이 지역
 * 스코프를 잃지 않도록, JNGJ 지역에 한해 옛 명칭 별칭을 cityNames에 함께 등록한다.
 */
const JNGJ_CITY_ALIASES = ['광주', '광주광역시', '전남', '전라남도', '전남광주'];

export function buildRegionIndex(regions: Array<{ city: string; district: string }>): RegionIndex {
  const cityNames = new Map<string, string>();
  const districtNames = new Map<string, { city: string; district: string }>();

  for (const { city, district } of regions) {
    cityNames.set(city, city);
    const slug = FULL_TO_SLUG[city];
    if (slug && CITY_SLUG_TO_SHORT[slug]) cityNames.set(CITY_SLUG_TO_SHORT[slug], city);
    if (slug && CITY_SLUG_TO_FULL[slug]) cityNames.set(CITY_SLUG_TO_FULL[slug], city);
    if (city === JNGJ_CITY) {
      for (const alias of JNGJ_CITY_ALIASES) cityNames.set(alias, JNGJ_CITY);
    }

    if (district) {
      districtNames.set(district, { city, district });
      const short = district.replace(/(구|군|시)$/, '');
      if (short && short !== district && !districtNames.has(short)) {
        districtNames.set(short, { city, district });
      }
    }
  }
  return { cityNames, districtNames };
}

// ─── 캐시 래퍼 (TTL 1시간) ───
let cached: { index: RegionIndex; at: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function getRegionIndex(now: number = Date.now()): Promise<RegionIndex> {
  if (cached && now - cached.at < TTL_MS) return cached.index;
  const regions = await getRegions();
  const index = buildRegionIndex(regions);
  cached = { index, at: now };
  return index;
}

export function __resetRegionIndexCache(): void {
  cached = null;
}
