import type { ParsedQuery } from './searchQueryParser.js';
import type { FacilityCategory } from '../../schemas/facility.js';

export interface RecoveryChip {
  label: string;
  category: FacilityCategory;
  city: string | null;     // 정식 city명 (region scope일 때만)
  district: string | null; // district명 (region scope일 때만)
}
export interface Recovery {
  scope: 'region' | 'category' | 'popular';
  regionLabel: string | null;
  chips: RecoveryChip[];
}

// 정적 인기 카테고리 (v1 큐레이션).
const POPULAR: Array<{ category: FacilityCategory; label: string }> = [
  { category: 'toilet', label: '화장실' },
  { category: 'parking', label: '주차장' },
  { category: 'pharmacy', label: '약국' },
  { category: 'hospital', label: '병원' },
];

export function buildRecovery(parsed: ParsedQuery): Recovery {
  // 1) 지역 인식
  if (parsed.cityToken && parsed.districtToken) {
    return {
      scope: 'region',
      regionLabel: `${parsed.cityToken} ${parsed.districtToken}`,
      chips: POPULAR.map((p) => ({
        label: `${parsed.districtToken} ${p.label}`,
        category: p.category,
        city: parsed.cityToken,
        district: parsed.districtToken,
      })),
    };
  }
  // 2) 카테고리만 인식
  if (parsed.categoryToken) {
    const cat = parsed.categoryToken;
    return {
      scope: 'category',
      regionLabel: null,
      chips: [{ label: cat, category: cat, city: null, district: null }],
    };
  }
  // 3) 미인식 → 정적 인기
  return {
    scope: 'popular',
    regionLabel: null,
    chips: POPULAR.map((p) => ({ label: p.label, category: p.category, city: null, district: null })),
  };
}
