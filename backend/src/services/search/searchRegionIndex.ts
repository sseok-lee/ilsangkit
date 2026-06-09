import { getRegions } from '../metaService.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT, FULL_TO_SLUG } from '../cityMapping.js';

export interface RegionIndex {
  cityNames: Map<string, string>; // 입력형(정식/축약) → 정식 city명
  districtNames: Map<string, { city: string; district: string }>; // 입력형 → {정식 city, district}
}

export function buildRegionIndex(regions: Array<{ city: string; district: string }>): RegionIndex {
  const cityNames = new Map<string, string>();
  const districtNames = new Map<string, { city: string; district: string }>();

  for (const { city, district } of regions) {
    cityNames.set(city, city);
    const slug = FULL_TO_SLUG[city];
    if (slug && CITY_SLUG_TO_SHORT[slug]) cityNames.set(CITY_SLUG_TO_SHORT[slug], city);
    if (slug && CITY_SLUG_TO_FULL[slug]) cityNames.set(CITY_SLUG_TO_FULL[slug], city);

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
