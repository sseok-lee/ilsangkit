export interface CategoryMatchResult {
  category: string | null;
  keywords: string[];
}

// Order matters: earlier entries win on tie.
const CATEGORY_KEYWORDS: Array<[string, string[]]> = [
  ['public-rental',  ['공공임대', '행복주택', '매입임대', '전세임대', 'LH 임대']],
  ['subscription',   ['청약', '특별공급', '민간분양', '공공분양']],
  ['apt-sale',       ['아파트 매매', '실거래가', '분양가']],
  ['apt-rent',       ['전월세', '전세 시세']],
  ['ev-charger',     ['전기차 충전', '충전기', '충전 인프라', '충전소']],
  ['pharmacy',       ['약국', '심야약국', '공공심야']],
  ['hospital',       ['병원', '응급실', '의료기관']],
  ['parking',        ['주차장', '공영주차']],
  ['park',           ['도시공원', '근린공원']],
  ['library',        ['공공도서관', '도서관 개관']],
  ['school',         ['초등학교', '중학교', '고등학교 배정']],
  ['childcare',      ['어린이집', '국공립 어린이집']],
  ['market',         ['전통시장']],
  ['aed',            ['자동심장충격기', 'AED']],
  ['toilet',         ['공중화장실']],
];

export function matchCategory(
  title: string,
  excerpt: string
): CategoryMatchResult {
  const haystack = `${title}\n${excerpt}`;
  for (const [category, keywords] of CATEGORY_KEYWORDS) {
    const hits = keywords.filter((k) => haystack.includes(k));
    if (hits.length > 0) {
      return { category, keywords: hits };
    }
  }
  return { category: null, keywords: [] };
}
