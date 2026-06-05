// backend/src/services/auctionUsage.ts
export const USAGE_GROUPS = ['residential', 'land', 'commercial', 'industrial', 'complex', 'etc'] as const;
export type UsageGroup = (typeof USAGE_GROUPS)[number];

// 키워드 우선순위: complex → industrial → commercial → land → residential
const RULES: Array<{ group: UsageGroup; keywords: string[] }> = [
  { group: 'complex', keywords: ['복합'] },
  { group: 'industrial', keywords: ['공장', '창고', '산업'] },
  { group: 'commercial', keywords: ['근린', '상가', '사무', '점포', '업무', '판매'] },
  { group: 'land', keywords: ['대지', '전', '답', '임야', '잡종지', '과수원', '토지', '농지', '목장', '도로'] },
  { group: 'residential', keywords: ['아파트', '주택', '다세대', '연립', '빌라', '오피스텔', '주거', '다가구', '단독'] },
];

export function toUsageGroup(usage: string | null | undefined): UsageGroup {
  const u = (usage ?? '').trim();
  if (!u) return 'etc';
  for (const { group, keywords } of RULES) {
    if (keywords.some((k) => u.includes(k))) return group;
  }
  return 'etc';
}
