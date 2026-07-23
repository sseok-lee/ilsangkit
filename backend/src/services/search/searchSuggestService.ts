// 주의: select 필드(buildingName/type/city/district/bjdCode/transactionCount)는 모두 JSON-safe(BigInt 아님) → serializeRow 불필요.
import { prisma } from '../../lib/prisma.js';
import { parseSearchQueryCached } from './searchQueryParser.js';
import { getRegionIndex } from './searchRegionIndex.js';
import { CATEGORY_SYNONYM_MAP } from './searchCategorySynonyms.js';
import type { FacilityCategory } from '../../schemas/facility.js';

export interface SuggestItem {
  type: 'region' | 'category' | 'building';
  label: string;
  sublabel?: string;
  city?: string;
  district?: string;
  category?: FacilityCategory;
  buildingName?: string;
  bjdCode?: string;
  reType?: string;
}
export interface SuggestResponse { items: SuggestItem[] }

const SECTION_LIMIT = 5;

// scope 없음(undefined) = 하위호환 혼합. 'realestate' = 카테고리 추천 억제(단지명 유지).
// 'facility:{category}' = 단지명 추천 억제(카테고리+지역 유지). 개별 시설명 조회는 v1 범위 밖(스펙 §5-4).
export type SuggestScope = 'realestate' | `facility:${string}` | undefined;

export async function suggest(q: string, scope?: SuggestScope): Promise<SuggestResponse> {
  const query = (q ?? '').trim();
  if (!query) return { items: [] };

  const suppressCategory = scope === 'realestate';
  const suppressBuilding = typeof scope === 'string' && scope.startsWith('facility:');

  const items: SuggestItem[] = [];

  // 1) 지역: 지역 인덱스에서 접두 매칭(시/구) — scope 무관 항상 노출
  const index = await getRegionIndex();
  const regionHits: SuggestItem[] = [];
  for (const [name, hit] of index.districtNames) {
    if (name.startsWith(query)) {
      regionHits.push({ type: 'region', label: hit.district, sublabel: hit.city, city: hit.city, district: hit.district });
      if (regionHits.length >= SECTION_LIMIT) break;
    }
  }
  items.push(...dedupeRegions(regionHits));

  const parsed = await parseSearchQueryCached(query);

  // 2) 카테고리: 파서가 인식한 카테고리(+지역 결합) — realestate scope 면 억제
  if (!suppressCategory) {
    if (parsed.categoryToken) {
      const label = parsed.districtToken ? `${parsed.districtToken} ${categoryKo(parsed.categoryToken)}` : categoryKo(parsed.categoryToken);
      items.push({
        type: 'category', label, sublabel: '생활시설',
        category: parsed.categoryToken,
        city: parsed.cityToken ?? undefined,
        district: parsed.districtToken ?? undefined,
      });
    } else {
      for (const [word, cat] of CATEGORY_SYNONYM_MAP) {
        if (word.startsWith(query)) {
          items.push({ type: 'category', label: categoryKo(cat), sublabel: '생활시설', category: cat });
          break;
        }
      }
    }
  }

  // 3) 건물명: startsWith + transactionCount 내림차순 top N (q>=2 가드) — facility scope 면 억제
  if (!suppressBuilding) {
    const nameForBuilding = parsed.freeText || query;
    if (nameForBuilding.length >= 2) {
      const rows = await prisma.realEstateBuildingSummary.findMany({
        where: { buildingName: { startsWith: nameForBuilding } },
        orderBy: { transactionCount: 'desc' },
        take: SECTION_LIMIT,
        select: { buildingName: true, type: true, city: true, district: true, bjdCode: true, transactionCount: true },
      });
      for (const r of rows) {
        items.push({
          type: 'building',
          label: r.buildingName,
          sublabel: `${r.district} · 거래 ${r.transactionCount}건`,
          buildingName: r.buildingName,
          bjdCode: r.bjdCode,
          city: r.city,
          district: r.district,
          reType: r.type,
        });
      }
    }
  }

  return { items };
}

function dedupeRegions(hits: SuggestItem[]): SuggestItem[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.city}|${h.district}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const CATEGORY_KO: Record<string, string> = {
  toilet: '화장실', wifi: '무료와이파이', clothes: '의류수거함', parking: '주차장',
  aed: '제세동기', library: '도서관', hospital: '병원', pharmacy: '약국', park: '공원',
  school: '학교', market: '전통시장', childcare: '어린이집', 'ev-charger': '전기차 충전소', sports: '체육시설',
};
function categoryKo(cat: string): string { return CATEGORY_KO[cat] ?? cat; }
