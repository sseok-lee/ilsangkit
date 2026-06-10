import type { FacilityCategory } from '../../schemas/facility.js';

// 단어 → 카테고리. 새 카테고리/별칭 추가 시 여기만 수정.
const SYNONYMS: Record<FacilityCategory, string[]> = {
  toilet: ['화장실', '공중화장실', '공공화장실'],
  wifi: ['와이파이', '무료와이파이', 'wifi'],
  clothes: ['의류수거함', '헌옷'],
  parking: ['주차', '주차장', '공영주차장'],
  aed: ['제세동기', '심장충격기', 'aed'],
  library: ['도서관'],
  hospital: ['병원'],
  pharmacy: ['약국'],
  park: ['공원'],
  school: ['학교'],
  market: ['전통시장', '시장'],
  childcare: ['어린이집', '보육'],
  'ev-charger': ['충전소', '전기차충전', '충전기'],
  sports: ['체육시설', '운동시설', '체육관'],
};

export const CATEGORY_SYNONYM_MAP: Map<string, FacilityCategory> = new Map(
  Object.entries(SYNONYMS).flatMap(([category, words]) =>
    words.map((w) => [w, category as FacilityCategory] as const)
  )
);
