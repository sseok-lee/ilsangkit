// Guide 자동 생성 스크립트
// Usage:
//   tsx src/scripts/generateGuide.ts [--category <slug>] [--type <news|howto|listicle|guide>] [--topic "주제"]
//   tsx src/scripts/generateGuide.ts --from-file prisma/data/guide-topics.json
// Pipeline: CLI args → 네이버 검색 API 리서치 → OpenAI 기사 생성 → 이미지 생성 → DB upsert
// --topic:
//   - 200자 미만: 토픽 기반 리서치 후 작성
//   - 200자 이상: 사용자가 제공한 브리프/리서치 데이터로 간주
// --from-file: JSON 파일에서 주제 목록 배치 생성 (완료 시 generated: true 마킹)

import 'dotenv/config';
import { createId } from '@paralleldrive/cuid2';
import OpenAI from 'openai';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ArticleType = 'news' | 'howto' | 'listicle' | 'guide';

const GUIDE_CATEGORIES = [
  'toilet',
  'aed',
  'hospital',
  'pharmacy',
  'parking',
  'wifi',
  'clothes',
  'park',
  'school',
  'market',
  'library',
  'trash',
  'childcare',
  'ev-charger',
  'sports',
  'apt-sale',
  'apt-rent',
  'subscription',
] as const;

type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

const ALL_ARTICLE_TYPES: ArticleType[] = ['news', 'howto', 'listicle', 'guide'];
const EVERGREEN_TYPES: ArticleType[] = ['howto', 'listicle', 'guide'];
const ALL_CATEGORIES: GuideCategory[] = [...GUIDE_CATEGORIES];

const REAL_ESTATE_CATEGORIES = ['apt-sale', 'apt-rent'] as const;
const REAL_ESTATE_LIKE_CATEGORIES = ['apt-sale', 'apt-rent', 'subscription'] as const;

// ---------------------------------------------------------------------------
// Category configuration
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<GuideCategory, string[]> = {
  toilet: [
    '공공화장실',
    '공중화장실 위생',
    '화장실 찾기',
    '화장실 리모델링',
    '스마트 화장실',
    '화장실 청결',
  ],
  aed: [
    '자동심장충격기',
    'AED 사용법',
    '심폐소생술',
    '심정지 응급처치',
    '골든타임 구조',
    'AED 설치 확대',
  ],
  hospital: ['병원 찾기', '야간진료', '응급실', '동네 의원 진료', '비대면 진료', '의료비 절약'],
  pharmacy: ['약국 영업시간', '야간약국', '처방전', '복약 지도', '일반의약품 편의점', '당번 약국'],
  parking: [
    '공영주차장',
    '주차요금',
    '주차장 찾기',
    '주차 요금 감면',
    '전기차 충전 주차',
    '스마트 주차',
  ],
  wifi: [
    '공공와이파이',
    '무료인터넷',
    '공공WiFi',
    '와이파이 보안',
    '공공 인터넷 속도',
    '디지털 격차',
  ],
  clothes: [
    '의류수거함',
    '헌옷 기부',
    '의류 재활용',
    '패스트패션 환경',
    '중고 의류 기부',
    '섬유 재활용',
  ],
  park: [
    '공원 산책',
    '도시 공원 조성',
    '공원 운동시설',
    '근린공원',
    '어린이 놀이터',
    '공원 문화행사',
  ],
  school: ['초등학교 입학', '학교 배정', '통학구역', '학교 정보 공개', '교육환경', '학구도'],
  market: ['전통시장 활성화', '재래시장', '상설시장', '시장 장날', '온누리상품권', '전통시장 주차'],
  library: ['공공도서관', '도서 대출', '독서', '전자도서관', '도서관 프로그램', '북스타트'],
  trash: [
    '쓰레기 분리수거',
    '재활용',
    '대형폐기물',
    '음식물 쓰레기 줄이기',
    '제로웨이스트',
    '분리배출 방법',
  ],
  childcare: [
    '어린이집 찾기',
    '국공립 어린이집',
    '어린이집 입소 대기',
    '보육료 지원',
    '어린이집 안전',
    '직장 어린이집',
  ],
  'ev-charger': [
    '전기차 충전소',
    '전기차 충전 요금',
    '급속 충전기',
    '충전 인프라 확대',
    '전기차 보조금',
    '공용 충전기',
  ],
  sports: [
    '체육시설',
    '공공 체육관',
    '생활체육',
    '국민체육센터',
    '스포츠 강좌 바우처',
    '주민 체육시설',
  ],
  'apt-sale': [
    '아파트 매매',
    '빌라 매매',
    '오피스텔 매매',
    '부동산 매매 절차',
    '실거래가 확인 방법',
    '부동산 매수 체크리스트',
    '등기부등본 보는 법',
    '부동산 계약서 작성',
    '취득세 계산',
    '부동산 중개수수료',
  ],
  'apt-rent': [
    '아파트 전세',
    '빌라 전세',
    '오피스텔 월세',
    '전세 사기 예방',
    '임대차 보호법',
    '전세 보증보험',
    '확정일자 받는 법',
    '전월세 계약 주의사항',
    '보증금 돌려받기',
    '주택 임대차 분쟁',
  ],
  subscription: [
    '청약 일정',
    '아파트 청약',
    '청약 가점',
    '특별공급 조건',
    '청약홈 사용법',
    '청약통장 가입',
  ],
};

const CATEGORY_LABELS: Record<GuideCategory, string> = {
  toilet: '공공화장실',
  aed: '자동심장충격기',
  hospital: '병원',
  pharmacy: '약국',
  parking: '공영주차장',
  wifi: '무료와이파이',
  clothes: '의류수거함',
  library: '공공도서관',
  trash: '쓰레기배출',
  park: '공원',
  school: '학교',
  market: '전통시장',
  childcare: '어린이집',
  'ev-charger': '전기차 충전소',
  sports: '체육시설',
  'apt-sale': '부동산 매매',
  'apt-rent': '부동산 임대차',
  subscription: '청약',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isGuideCategory(value: string): value is GuideCategory {
  return (ALL_CATEGORIES as readonly string[]).includes(value);
}

function isRealEstateCategory(
  category: string
): category is (typeof REAL_ESTATE_CATEGORIES)[number] {
  return (REAL_ESTATE_CATEGORIES as readonly string[]).includes(category);
}

function isRealEstateLikeCategory(
  category: string
): category is (typeof REAL_ESTATE_LIKE_CATEGORIES)[number] {
  return (REAL_ESTATE_LIKE_CATEGORIES as readonly string[]).includes(category);
}

function getCategoryLabel(category: string): string {
  return isGuideCategory(category) ? CATEGORY_LABELS[category] : category;
}

function getCategoryCta(category: GuideCategory): string {
  const label = getCategoryLabel(category);
  if (category === 'subscription') {
    return `일상킷에서 ${label} 정보를 바로 확인해보세요!`;
  }
  if (isRealEstateCategory(category)) {
    return `일상킷에서 ${label} 실거래가 정보를 바로 확인해보세요!`;
  }
  return `일상킷에서 내 주변 ${label} 정보를 바로 확인해보세요!`;
}

// ---------------------------------------------------------------------------
// Internal linking helpers
// ---------------------------------------------------------------------------

const RELATED_GUIDE_CATEGORIES: Record<GuideCategory, GuideCategory[]> = {
  toilet: ['parking'],
  aed: ['hospital'],
  hospital: ['pharmacy', 'aed'],
  pharmacy: ['hospital'],
  parking: ['ev-charger'],
  wifi: [],
  clothes: ['trash'],
  park: ['sports', 'childcare'],
  school: ['childcare', 'library'],
  market: ['parking'],
  library: ['school'],
  trash: ['clothes'],
  childcare: ['school', 'park'],
  'ev-charger': ['parking'],
  sports: ['park'],
  'apt-sale': ['apt-rent', 'subscription'],
  'apt-rent': ['apt-sale', 'subscription'],
  subscription: ['apt-sale', 'apt-rent'],
};

function getCategoryHubUrl(category: GuideCategory): string {
  if (isRealEstateCategory(category)) {
    const [propertyType, tab] = category.split('-');
    return `/real-estate/${propertyType}?tab=${tab}`;
  }
  return `/${category}`;
}

/**
 * 생성된 가이드 본문 뒤에 "함께 보면 좋은 글" 내부 링크 블록을 만든다.
 * - 같은 카테고리 다른 가이드 최대 3개 (최신순, 현재 slug 제외)
 * - 해당 카테고리 허브 링크
 * - 관련 카테고리 허브 링크 (1개)
 */
async function buildInternalLinksSection(
  category: GuideCategory,
  currentSlug: string
): Promise<string> {
  const lines: string[] = [];
  lines.push('## 함께 보면 좋은 글');
  lines.push('');

  const sameCatGuides = await prisma.guide.findMany({
    where: {
      category,
      published: true,
      slug: { not: currentSlug },
    },
    select: { slug: true, title: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  for (const guide of sameCatGuides) {
    lines.push(`- [${guide.title}](/guide/${guide.slug})`);
  }

  lines.push(
    `- [${getCategoryLabel(category)} 전체 정보 보러가기](${getCategoryHubUrl(category)})`
  );

  const related = RELATED_GUIDE_CATEGORIES[category] ?? [];
  if (related.length > 0) {
    const rel = related[0];
    lines.push(`- [${getCategoryLabel(rel)} 정보도 함께 확인하기](${getCategoryHubUrl(rel)})`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Evergreen topic pools
// ---------------------------------------------------------------------------

const EVERGREEN_TOPICS: Record<
  GuideCategory,
  { howto: string[]; listicle: string[]; guide: string[] }
> = {
  toilet: {
    howto: ['외출 중 깨끗한 공공화장실 찾는 방법', '공공화장실 위생 관리 요령'],
    listicle: ['공공화장실 이용 시 알아두면 좋은 팁 7가지', '깨끗한 공공화장실이 많은 장소 유형'],
    guide: ['공공화장실 개방 제도 완벽 가이드', '스마트 화장실 서비스 총정리'],
  },
  aed: {
    howto: ['자동심장충격기 사용법 4단계', '심정지 환자 발견 시 응급 대처 방법'],
    listicle: ['심폐소생술 관련 꼭 알아야 할 상식 7가지', '자동심장충격기 설치 장소 유형별 정리'],
    guide: ['골든타임 4분, 자동심장충격기 완벽 가이드', '일반인을 위한 응급처치 교육 안내'],
  },
  hospital: {
    howto: ['야간·주말 진료 병원 찾는 가장 빠른 방법', '비대면 진료 신청부터 처방까지 절차'],
    listicle: ['병원비 절약하는 실용 꿀팁 10가지', '응급실 가기 전 확인해야 할 체크리스트'],
    guide: ['동네 의원 vs 대학병원, 현명한 병원 선택 가이드', '의료비 본인부담 상한제 총정리'],
  },
  pharmacy: {
    howto: ['야간·공휴일 당번 약국 찾는 방법', '처방전 없이 살 수 있는 일반의약품 안내'],
    listicle: ['약국에서 꼭 확인해야 할 복약 지도 사항 7가지', '가정 상비약 필수 목록'],
    guide: ['약국 이용 완벽 가이드: 처방전부터 복약 지도까지', '편의점 의약품 판매 품목 총정리'],
  },
  parking: {
    howto: ['공영주차장 요금 할인·감면 받는 방법', '스마트 주차 앱으로 빈 자리 찾는 법'],
    listicle: ['주차 요금 아끼는 실용 꿀팁 8가지', '장기주차 시 알아두면 좋은 공영주차장 정보'],
    guide: ['공영주차장 이용 완벽 가이드: 요금·시간·할인', '거주자 우선 주차 신청 방법 총정리'],
  },
  wifi: {
    howto: ['공공 와이파이 안전하게 접속하는 방법', '무료 와이파이 속도 느릴 때 해결법'],
    listicle: ['공공 와이파이 이용 시 보안 수칙 7가지', '무료 인터넷 사용 가능한 장소 유형'],
    guide: ['공공 와이파이 서비스 총정리', '디지털 격차 해소를 위한 무료 인터넷 지원 사업'],
  },
  clothes: {
    howto: ['의류수거함에 올바르게 기부하는 방법', '헌옷 기부 전 준비사항과 절차'],
    listicle: ['의류수거함에 넣으면 안 되는 품목 7가지', '헌옷 처리하는 다양한 방법 비교'],
    guide: ['의류 재활용 완벽 가이드: 수거함부터 업사이클링까지', '중고 의류 기부처 총정리'],
  },
  park: {
    howto: ['우리 동네 공원 편의시설 활용하는 법', '공원 운동기구 올바른 사용법'],
    listicle: ['공원 산책이 건강에 좋은 이유 7가지', '아이와 가기 좋은 공원 시설 체크리스트'],
    guide: ['도시 공원 이용 완벽 가이드', '근린공원 문화행사 참여 방법 총정리'],
  },
  school: {
    howto: ['초등학교 학구도 확인하는 방법', '전학 절차와 필요 서류 안내'],
    listicle: ['학교 배정 전 확인해야 할 사항 7가지', '교육 환경 비교 시 체크할 항목'],
    guide: ['초등학교 입학 준비 완벽 가이드', '학교 정보 공개 사이트 활용법 총정리'],
  },
  market: {
    howto: ['온누리상품권 구매부터 사용까지 총정리', '전통시장 장보기 알뜰 요령'],
    listicle: ['전통시장 이용 시 알아두면 좋은 팁 8가지', '전통시장에서만 누릴 수 있는 혜택'],
    guide: ['전통시장 활성화 지원 사업 총정리', '전통시장 주차·배달·카드 결제 가이드'],
  },
  library: {
    howto: ['공공도서관 상호대차 서비스 이용법', '전자도서관에서 전자책 빌리는 방법'],
    listicle: ['도서관 무료 프로그램 종류 7가지', '도서관 활용도를 높이는 꿀팁'],
    guide: ['공공도서관 이용 완벽 가이드: 대출부터 프로그램까지', '북스타트 프로그램 참여 안내'],
  },
  trash: {
    howto: ['대형 폐기물 인터넷 신고 5분 완성 가이드', '헷갈리는 분리배출 품목 올바른 처리법'],
    listicle: ['분리수거 시 자주 틀리는 품목 10가지', '음식물 쓰레기 줄이는 실천법 7가지'],
    guide: ['분리배출 완벽 가이드: 품목별 정확한 방법', '이사 시 폐기물 처리 총정리'],
  },
  childcare: {
    howto: ['국공립 어린이집 입소 대기 신청 방법', '보육료 지원 신청 절차 안내'],
    listicle: ['어린이집 선택 시 확인할 체크리스트 10가지', '보육 지원금 종류별 혜택 정리'],
    guide: ['어린이집 입소 준비 완벽 가이드', '직장 어린이집 설치 기준과 이용 방법'],
  },
  'ev-charger': {
    howto: ['전기차 공용 충전기 이용 방법과 에티켓', '아파트 전기차 충전기 설치 지원금 신청법'],
    listicle: ['전기차 충전 요금 비교와 절약 팁 7가지', '급속 vs 완속 충전, 상황별 선택 가이드'],
    guide: ['전기차 충전 인프라 완벽 가이드', '전기차 보조금 신청부터 수령까지 총정리'],
  },
  sports: {
    howto: ['국민체육센터 이용 등록 방법', '스포츠 강좌 바우처 신청 절차'],
    listicle: ['무료로 이용 가능한 공공 체육시설 유형 7가지', '생활체육 프로그램 참여 혜택'],
    guide: ['공공 체육시설 이용 완벽 가이드', '주민 체육시설 운영 시간·요금 총정리'],
  },
  'apt-sale': {
    howto: ['아파트 실거래가 정확하게 조회하는 방법', '생애최초 주택구입자금 대출 신청 절차'],
    listicle: [
      '아파트 매매 전 반드시 확인할 체크리스트 10가지',
      '아파트 시세 파악 시 흔한 실수 5가지',
    ],
    guide: [
      '아파트 매매 완벽 가이드: 매물 탐색부터 등기까지',
      '실거래가 vs 호가, 정확한 시세 파악법',
    ],
  },
  'apt-rent': {
    howto: ['전세 보증보험 가입 절차와 필요 서류', '전세 계약 전 등기부등본 확인하는 법'],
    listicle: ['전세 사기 예방 체크리스트 10가지', '월세 소득공제·세액공제 절약 팁'],
    guide: ['아파트 전월세 계약 완벽 가이드', '임대차 3법 핵심 요약과 활용법'],
  },
  subscription: {
    howto: ['청약통장 가입부터 당첨까지 단계별 가이드', '청약 가점 계산하는 법과 점수 올리는 전략'],
    listicle: [
      '청약 초보가 꼭 알아야 할 핵심 용어 10가지',
      '특별공급 자격 조건 총정리: 신혼·다자녀·생애최초',
    ],
    guide: [
      '2026년 아파트 청약 완벽 가이드: 자격부터 당첨까지',
      '청약홈 사용법과 청약 일정 확인 방법 총정리',
    ],
  },
};

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseCategory(): GuideCategory {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--category');

  if (idx !== -1 && args[idx + 1]) {
    const category = args[idx + 1];
    if (!isGuideCategory(category)) {
      console.error(`Unknown category "${category}". Valid: ${ALL_CATEGORIES.join(', ')}`);
      process.exit(1);
    }
    return category;
  }

  return ALL_CATEGORIES[Math.floor(Math.random() * ALL_CATEGORIES.length)];
}

function parseArticleType(): ArticleType | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--type');

  if (idx !== -1 && args[idx + 1]) {
    const type = args[idx + 1] as ArticleType;
    if (!ALL_ARTICLE_TYPES.includes(type)) {
      console.error(`Unknown article type "${type}". Valid: ${ALL_ARTICLE_TYPES.join(', ')}`);
      process.exit(1);
    }
    return type;
  }

  return undefined;
}

function parseTopic(): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--topic');
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

function parseFromFile(): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--from-file');
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

// ---------------------------------------------------------------------------
// 네이버 검색 API
// ---------------------------------------------------------------------------

interface NaverSearchItem {
  title: string;
  description: string;
  link: string;
}

type NaverSearchType = 'news' | 'blog' | 'webkr' | 'encyc' | 'kin';

const RESEARCH_SOURCES: Record<ArticleType, NaverSearchType[]> = {
  news: ['news'],
  howto: ['blog', 'kin'],
  listicle: ['webkr', 'blog'],
  guide: ['encyc', 'webkr'],
};

function stripHtmlTags(str: string): string {
  return str.replace(/<[^>]*>/g, '').trim();
}

async function fetchNaverSearch(
  searchType: NaverSearchType,
  keyword: string,
  maxItems = 5
): Promise<NaverSearchItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('NAVER_CLIENT_ID/SECRET 환경변수가 없습니다. 리서치를 건너뜁니다.');
    return [];
  }

  const url = `https://openapi.naver.com/v1/search/${searchType}.json?query=${encodeURIComponent(keyword)}&display=${maxItems}&sort=date`;

  try {
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`네이버 검색 실패 (${searchType}, "${keyword}"): HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as { items?: NaverSearchItem[] };
    return (data.items ?? []).map((item) => ({
      title: stripHtmlTags(item.title),
      description: stripHtmlTags(item.description),
      link: item.link,
    }));
  } catch (err) {
    console.warn(
      `네이버 검색 에러 (${searchType}, "${keyword}"):`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

async function fetchAndDedup(
  queries: string[],
  searchTypes: NaverSearchType[],
  maxItemsPerQuery: number,
  totalMax: number
): Promise<string[]> {
  const fetchPromises: Promise<NaverSearchItem[]>[] = [];
  for (const query of queries) {
    for (const source of searchTypes) {
      fetchPromises.push(fetchNaverSearch(source, query, maxItemsPerQuery));
    }
  }

  const results = await Promise.allSettled(fetchPromises);
  const allItems: NaverSearchItem[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allItems.push(...result.value);
    }
  }

  const seen = new Set<string>();
  const formatted: string[] = [];

  for (const item of allItems) {
    if (!item.title || seen.has(item.title)) continue;
    seen.add(item.title);

    formatted.push(item.description ? `${item.title}\n   요약: ${item.description}` : item.title);

    if (formatted.length >= totalMax) break;
  }

  return formatted;
}

export async function collectNewsTitles(
  category: GuideCategory,
  articleType: ArticleType = 'news'
): Promise<string[]> {
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  const searchTypes = RESEARCH_SOURCES[articleType];
  return fetchAndDedup(keywords.slice(0, 3), searchTypes, 5, 10);
}

async function collectResearchByTopic(
  topic: string,
  articleType: ArticleType,
  maxItems = 10
): Promise<string[]> {
  const searchTypes = RESEARCH_SOURCES[articleType] ?? ['webkr'];
  return fetchAndDedup([topic], searchTypes, Math.min(maxItems, 5), maxItems);
}

async function buildTopicResearchContext(topic: string, articleType: ArticleType): Promise<string> {
  const researchItems = await collectResearchByTopic(topic, articleType, 10);

  if (researchItems.length === 0) {
    return `글 주제: ${topic}`;
  }

  return `[토픽 리서치 데이터]
주제: ${topic}

참고 자료:
${researchItems.map((item, index) => `${index + 1}. ${item}`).join('\n')}
[/토픽 리서치 데이터]

⚠️ 중요: 위 리서치 데이터를 참고해 최신 맥락과 실용 정보를 반영하세요. 리서치에 없는 세부 수치는 임의 생성하지 마세요.`;
}

// ---------------------------------------------------------------------------
// DB stats injection
// ---------------------------------------------------------------------------

type FacilityCategory = Exclude<GuideCategory, 'apt-sale' | 'apt-rent' | 'subscription'>;

const FACILITY_COUNT_MAP: Record<FacilityCategory, () => Promise<number>> = {
  toilet: () => prisma.toilet.count(),
  aed: () => prisma.aed.count(),
  hospital: () => prisma.hospital.count(),
  pharmacy: () => prisma.pharmacy.count(),
  parking: () => prisma.parking.count(),
  wifi: () => prisma.wifi.count(),
  clothes: () => prisma.clothes.count(),
  park: () => prisma.park.count(),
  school: () => prisma.school.count(),
  market: () => prisma.market.count(),
  library: () => prisma.library.count(),
  trash: () => prisma.wasteSchedule.count(),
  childcare: () => prisma.childcare.count(),
  'ev-charger': () => prisma.evCharger.count(),
  sports: () => prisma.sports.count(),
};

async function getFacilityStats(category: GuideCategory): Promise<string> {
  if (isRealEstateLikeCategory(category)) {
    return '';
  }

  const countFn = FACILITY_COUNT_MAP[category as FacilityCategory];
  if (!countFn) return '';

  try {
    const total = await countFn();
    if (total === 0) return '';

    const unit = category === 'trash' ? '건 등록' : '개소 등록';
    return `\n일상킷 데이터: 전국 ${getCategoryLabel(category)} ${total.toLocaleString('ko-KR')}${unit}`;
  } catch (err) {
    console.warn(`DB 통계 조회 실패 (${category}):`, err instanceof Error ? err.message : err);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Article templates
// ---------------------------------------------------------------------------

const COMMON_PROMPT_RULES = `
[공통 작성 원칙]
- 사용자가 가장 궁금해하는 답을 먼저 제시합니다.
- 한 문단에는 하나의 핵심만 담습니다.
- 분량을 억지로 늘리지 말고, 실질적으로 도움이 되는 정보 중심으로 씁니다.
- 같은 의미 반복, 상투적 도입, 불필요한 배경 설명은 피합니다.
- 사이트명, 앱명, 기관명, 제도명, 서류명, 비용, 기한 등은 가능한 한 구체적으로 씁니다.
- FAQ는 본문 반복이 아니라 예외사항·헷갈리는 점 보완용으로 작성합니다.
- 뉴스형은 기사 나열이 아니라 변화의 흐름과 생활 영향 중심으로 설명합니다.
`;

const OPTIONAL_BLOCK_RULES = `
[선택 블록 규칙]
- 비교가 중요한 주제는 마크다운 표를 사용할 수 있습니다.
- 절차형 글은 번호 리스트를 우선 사용합니다.
- FAQ는 필요한 경우 3~5개 정도 작성합니다.
- 흔한 실수 섹션이 있는 경우 아래 형식을 반드시 지킵니다:

1. **실수 제목**

**이런 실수를 해요:**
상황 설명 2~3문장.

**이렇게 해결하세요:**
해결 방법 2~3문장.
`;

const NEWS_INSIGHT_TEMPLATE = `
## 지금 이슈 한눈에 보기
(최근 뉴스나 정책 변화 2~3건을 연결해 왜 지금 이 주제가 중요한지 설명합니다. 단순 기사 요약이 아니라 변화의 흐름과 의미를 중심으로 씁니다)

## 무엇이 달라졌나
(정책, 제도, 시장, 이용 조건, 운영 방식 등 실제로 달라진 점을 정리합니다)

## 내 생활에 어떤 영향이 있나
(사용자 입장에서 무엇을 확인해야 하는지, 누가 특히 영향을 받는지 구체적으로 설명합니다)

## 이렇게 대응하세요
(확인할 사이트, 신청 시점, 준비서류, 체크포인트, 활용 팁 등을 실용적으로 제시합니다)

## 자주 묻는 질문
(최근 변화와 관련해 독자가 가장 많이 궁금해할 질문 3~5개를 정리합니다)

## 마무리
(핵심을 짧게 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

const QUICK_ANSWER_TEMPLATE = `
## 한눈에 보는 답
(질문에 대한 핵심 답을 먼저 2~4문장으로 설명합니다. 누가, 언제, 어디서, 어떻게 하면 되는지 바로 이해되게 씁니다)

## 바로 따라하는 방법
(번호 리스트로 실제 절차를 설명합니다. 보통 4~7단계 정도로 구성하고, 필요한 서류, 앱, 사이트, 메뉴 경로, 버튼명, 수수료 여부 등을 구체적으로 적습니다)

## 꼭 확인할 점
(운영시간, 준비서류, 신청 조건, 비용, 이용 제한, 지역별 차이, 예외사항 등 헷갈리기 쉬운 내용을 정리합니다)

## 자주 묻는 질문
(정말 자주 묻는 질문만 3~5개 작성합니다. 본문 반복이 아니라 예외 상황 보완 위주로 구성합니다)

## 마무리
(핵심을 2~3문장으로 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

const LISTICLE_TEMPLATE = `
## 먼저 기준부터
(이 목록을 어떤 기준으로 선정했는지 간단히 설명합니다. 접근성, 공공성, 가격, 편의성, 이용 조건 등 실제 판단 기준을 제시합니다)

## 추천 리스트
(번호 리스트로 5~8개 정도 항목을 소개합니다. 각 항목은 이름, 핵심 특징, 이용 방법 또는 위치/요금/대상, 추천 이유를 포함해 실용적으로 작성합니다)

## 이렇게 활용하면 좋아요
(목록을 더 잘 활용하는 방법, 상황별 추천, 시간대별 활용 팁, 함께 확인하면 좋은 정보 등을 정리합니다)

## 선택 전에 체크할 점
(운영시간, 예약 필요 여부, 지역 제한, 비용 차이, 혼잡 시간대, 대상 조건 등 실제 이용 전에 봐야 할 점을 정리합니다)

## 자주 묻는 질문
(목록형 글에서 자주 나오는 질문 3~5개를 정리합니다)

## 마무리
(핵심을 짧게 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

const EXPLAINER_TEMPLATE = `
## 핵심 요약
(이 주제가 무엇인지, 누가 알아두면 좋은지, 왜 중요한지 3줄 안팎으로 요약합니다)

## 이것부터 이해하세요
(정의, 역할, 도입 배경, 운영 방식, 왜 생겼는지 등을 쉽게 설명합니다)

## 현재 기준과 이용 방법
(관련 제도, 운영 기준, 법적 근거, 이용 대상, 신청 또는 이용 방법, 확인 가능한 기관·사이트 등을 실용적으로 설명합니다)

## 이런 경우 특히 유용해요
(사용자 상황별 예시를 3~5가지 정도 제시합니다. 누가 어떤 상황에서 활용하면 좋은지 실제 생활 맥락으로 풀어씁니다)

## 자주 헷갈리는 점
(비슷한 제도·시설·서비스와의 차이, 흔한 오해, 예외사항, 이용 시 놓치기 쉬운 부분을 정리합니다)

## 마무리
(핵심을 짧게 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

const REAL_ESTATE_TRANSACTION_TEMPLATE = `
## 먼저 확인할 핵심
(거래 목적, 예산, 대출 가능 여부, 입주 시기, 실거주 여부 등 거래 전에 먼저 판단해야 할 핵심 요소를 3~4문장으로 정리합니다)

## 준비 서류와 사전 확인
(등기부등본, 건축물대장, 토지이용계획확인서, 실거래가, 관리비, 권리관계, 임차인 현황 등 거래 전에 반드시 확인할 자료와 이유를 설명합니다)

## 단계별 절차
(매물 탐색 → 조건 확인 → 가계약 또는 협의 → 본계약 → 중도금/잔금 → 인도 → 등기 또는 전입/확정일자 등 실제 흐름에 따라 단계별로 설명합니다)

## 비용과 세금 정리
(취득세, 중개보수, 인지세, 등기비용, 법무사 비용, 대출 부대비용 등 실제 드는 비용을 항목별로 정리합니다. 계산 구조나 확인 포인트도 함께 설명합니다)

## 놓치기 쉬운 체크포인트
(특약, 하자 확인, 권리관계, 잔금일과 대출 실행 시점, 전입 가능일, 실입주 일정, 관리비 정산 등 실무적으로 자주 놓치는 부분을 정리합니다)

## 자주 묻는 질문
(거래 직전에 많이 묻는 질문 3~5개를 정리합니다)

## 마무리
(핵심을 짧게 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

const REAL_ESTATE_MARKET_TEMPLATE = `
## 지금 시장 핵심 요약
(현재 시장 분위기, 가격 흐름, 거래량 변화, 정책 변수 중 중요한 내용을 3줄 안팎으로 먼저 정리합니다)

## 시장 흐름과 최근 변화
(최근 거래량, 가격 추세, 지역별 차이, 금리 또는 정책 변화 등 시장을 이해하는 핵심 흐름을 설명합니다)

## 무엇을 확인해야 하나
(실거래가, 매물 호가, 대출 조건, 세금 부담, 지역 개발 이슈, 입주 물량 등 실제 판단에 필요한 요소를 정리합니다)

## 내 상황별 선택 가이드
(실거주 목적, 투자 목적, 무주택자, 갈아타기 수요, 전세·매매 고민 등 상황별로 어떤 점을 우선 봐야 하는지 설명합니다)

## 자주 묻는 질문
(부동산 시장 변화와 관련해 자주 묻는 질문 3~5개를 정리합니다)

## 마무리
(핵심을 짧게 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

const SUBSCRIPTION_HOWTO_TEMPLATE = `
## 먼저 확인할 핵심
(청약을 넣기 전에 가장 먼저 확인해야 할 내용을 3~4문장으로 정리합니다. 청약통장 보유 여부, 무주택 여부, 지역 우선공급, 세대주 여부, 가점/추첨제 적용 여부 등을 먼저 짚어줍니다)

## 청약 자격과 기본 용어
(청약통장, 무주택, 세대주, 특별공급, 일반공급, 가점제, 추첨제, 예치금, 거주기간 등 꼭 알아야 할 개념을 쉽게 설명합니다)

## 단계별 신청 방법
(청약 일정 확인 → 모집공고 확인 → 자격 점검 → 청약홈 준비 → 신청 → 당첨 확인 → 서류 제출 순서로 실제 절차를 설명합니다. 사이트명, 메뉴명, 준비 정보 등을 구체적으로 적습니다)

## 당첨 확률을 높이려면
(가점 계산, 특별공급 해당 여부, 지역 우선공급, 경쟁률 확인, 예치금 기준 등 실제로 중요한 판단 포인트를 설명합니다)

## 자주 헷갈리는 점
(1순위 조건, 무주택 판단, 세대원 포함 여부, 청약통장 인정기간, 재당첨 제한 등 많이 헷갈리는 내용을 정리합니다)

## 자주 묻는 질문
(청약 신청 전에 많이 묻는 질문 3~5개를 정리합니다)

## 마무리
(핵심을 짧게 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

const SUBSCRIPTION_GUIDE_TEMPLATE = `
## 지금 청약 핵심 요약
(현재 청약 시장에서 꼭 알아야 할 핵심을 3줄 안팎으로 먼저 정리합니다. 공급 유형, 자격 기준, 경쟁 포인트, 일정 확인의 중요성을 중심으로 씁니다)

## 청약 제도, 무엇을 봐야 하나
(특별공급, 일반공급, 가점제, 추첨제, 예치금, 거주요건, 재당첨 제한, 전매 제한 등 핵심 제도를 설명합니다)

## 내 상황별 청약 전략
(무주택 실수요자, 신혼부부, 생애최초, 다자녀, 청년, 1인 가구 등 상황별로 어떤 공급 유형과 조건을 우선 봐야 하는지 설명합니다)

## 신청 전에 꼭 확인할 것
(모집공고, 청약홈 일정, 지역 우선공급, 자금 계획, 계약금·중도금, 서류 준비 등 실제 신청 전에 확인할 체크포인트를 정리합니다)

## 자주 헷갈리는 점
(청약통장 가입 기간, 가점 계산, 세대 기준, 소득 기준, 자산 기준, 특별공급 중복 가능 여부 등 혼동하기 쉬운 부분을 설명합니다)

## 자주 묻는 질문
(청약 준비 단계에서 자주 나오는 질문 3~5개를 정리합니다)

## 마무리
(핵심을 짧게 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

const SUBSCRIPTION_NEWS_TEMPLATE = `
## 최근 청약 뉴스 핵심
(최근 청약 관련 뉴스나 정책 변화 2~3건을 연결해 왜 지금 이 내용이 중요한지 설명합니다. 단순 기사 요약이 아니라 변화의 배경과 의미를 중심으로 씁니다)

## 무엇이 달라졌나
(청약 자격 조건, 공급 방식, 일정, 가점 기준, 소득·자산 기준, 특별공급 요건 등 실제로 달라진 점을 정리합니다)

## 누가 영향을 받나
(무주택 실수요자, 신혼부부, 생애최초, 다자녀, 청년 등 대상별로 어떤 영향이 있는지 구체적으로 설명합니다)

## 지금 확인할 것
(청약홈, 모집공고, 청약통장 상태, 가점 재계산, 서류 준비 등 바로 확인하거나 준비해야 할 내용을 실용적으로 제시합니다)

## 자주 묻는 질문
(최근 변화와 관련해 가장 많이 궁금해할 질문 3~5개를 정리합니다)

## 마무리
(핵심을 짧게 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

const SUBSCRIPTION_LISTICLE_TEMPLATE = `
## 이 목록의 기준
(어떤 기준으로 항목을 선정했는지 설명합니다. 자격 조건, 경쟁률, 접근성, 혜택 규모 등 청약 맥락에 맞는 판단 기준을 제시합니다)

## 추천 리스트
(번호 리스트로 5~8개 항목을 소개합니다. 각 항목은 이름, 핵심 특징, 자격 조건이나 혜택, 확인 방법을 포함해 실용적으로 작성합니다)

## 상황별 활용법
(무주택자, 신혼부부, 생애최초, 다자녀 등 상황별로 어떤 항목을 우선 확인하면 좋은지 정리합니다)

## 주의할 점
(자격 기준 오해, 중복 신청 제한, 서류 미비, 일정 착오 등 실수하기 쉬운 부분을 정리합니다)

## 자주 묻는 질문
(목록과 관련해 자주 나오는 질문 3~5개를 정리합니다)

## 마무리
(핵심을 짧게 정리하고 실제 카테고리에 맞는 CTA로 마무리합니다)
`;

function getTemplate(
  articleType: ArticleType,
  category: GuideCategory
): { template: string; sectionCount: number } {
  const realEstate = isRealEstateCategory(category);
  const subscription = category === 'subscription';

  switch (articleType) {
    case 'news':
      if (subscription) return { template: SUBSCRIPTION_NEWS_TEMPLATE, sectionCount: 6 };
      return {
        template: realEstate ? REAL_ESTATE_MARKET_TEMPLATE : NEWS_INSIGHT_TEMPLATE,
        sectionCount: 6,
      };

    case 'howto':
      if (subscription) return { template: SUBSCRIPTION_HOWTO_TEMPLATE, sectionCount: 7 };
      return {
        template: realEstate ? REAL_ESTATE_TRANSACTION_TEMPLATE : QUICK_ANSWER_TEMPLATE,
        sectionCount: realEstate ? 7 : 5,
      };

    case 'listicle':
      if (subscription) return { template: SUBSCRIPTION_LISTICLE_TEMPLATE, sectionCount: 6 };
      return { template: LISTICLE_TEMPLATE, sectionCount: 6 };

    case 'guide':
      if (subscription) return { template: SUBSCRIPTION_GUIDE_TEMPLATE, sectionCount: 7 };
      return {
        template: realEstate ? REAL_ESTATE_MARKET_TEMPLATE : EXPLAINER_TEMPLATE,
        sectionCount: 6,
      };
  }
}

// ---------------------------------------------------------------------------
// SEO title patterns
// ---------------------------------------------------------------------------

const TITLE_PATTERN_GUIDE: Record<ArticleType, string> = {
  news: '최근 변화와 핵심 포인트가 드러나는 제목 (20~40자). 예: "2026년 달라지는 {카테고리}, 꼭 알아야 할 변화"',
  howto:
    '방법과 절차가 바로 드러나는 제목 (20~40자). 예: "{카테고리} 이용 방법 한눈에 정리", "{카테고리} 신청 절차 쉽게 알려드립니다"',
  listicle:
    '추천·정리형 제목 (20~40자). 예: "{카테고리} 활용 팁 모음", "알아두면 좋은 {카테고리} 정보 정리"',
  guide:
    '설명형·종합형 제목 (20~40자). 예: "{카테고리} 쉽게 이해하는 가이드", "{카테고리} 핵심만 정리한 안내서"',
};

// ---------------------------------------------------------------------------
// Evergreen type selection
// ---------------------------------------------------------------------------

function pickEvergreenType(): ArticleType {
  return EVERGREEN_TYPES[Math.floor(Math.random() * EVERGREEN_TYPES.length)];
}

function pickEvergreenTopic(category: GuideCategory, articleType: ArticleType): string {
  const categoryTopics = EVERGREEN_TOPICS[category];
  if (!categoryTopics) {
    return `${getCategoryLabel(category)} 이용 가이드`;
  }

  const topics = categoryTopics[articleType as keyof typeof categoryTopics] ?? [];
  if (topics.length === 0) {
    return `${getCategoryLabel(category)} 이용 가이드`;
  }

  return topics[Math.floor(Math.random() * topics.length)];
}

// ---------------------------------------------------------------------------
// OpenAI article generation
// ---------------------------------------------------------------------------

interface ArticleResult {
  title: string;
  summary: string;
  content: string;
  keywords: string;
}

function replaceCategoryPlaceholders(template: string, category: GuideCategory): string {
  return template
    .replaceAll('{카테고리}', getCategoryLabel(category))
    .replaceAll('실제 카테고리에 맞는 CTA', getCategoryCta(category));
}

async function generateArticle(
  openai: OpenAI,
  category: GuideCategory,
  articleType: ArticleType,
  newsTitles: string[],
  dbStats: string,
  topicOrContext?: string
): Promise<ArticleResult> {
  const categoryLabel = getCategoryLabel(category);
  const { template, sectionCount } = getTemplate(articleType, category);

  const isNews = articleType === 'news';
  const realEstateLike = isRealEstateLikeCategory(category);
  const isDetailedTopic = Boolean(topicOrContext && topicOrContext.length >= 200);
  const looksLikeResearchContext = Boolean(topicOrContext?.includes('[토픽 리서치 데이터]'));

  let contextBlock: string;
  if (looksLikeResearchContext && topicOrContext) {
    contextBlock = topicOrContext;
  } else if (isDetailedTopic && topicOrContext) {
    contextBlock = `[리서치 데이터 — 아래 내용을 사실 근거로 활용하여 기사를 작성하세요]
${topicOrContext}
[/리서치 데이터]

⚠️ 중요: 위 리서치 데이터에 포함된 수치, 점수, 조건, 날짜, 금액 등의 팩트를 반드시 기사 본문에 반영하세요. 데이터에 없는 수치를 임의로 생성하지 마세요.`;
  } else if (topicOrContext) {
    contextBlock = `글 주제: ${topicOrContext}`;
  } else if (isNews && newsTitles.length > 0) {
    contextBlock = `참고 뉴스 제목:\n${newsTitles.join('\n')}`;
  } else {
    contextBlock = `글 주제: ${pickEvergreenTopic(category, articleType)}`;
  }

  const role =
    category === 'subscription'
      ? '청약·주거 정책 전문 기자'
      : realEstateLike
        ? '부동산·주거 정책 전문 기자'
        : '생활 정보 전문 기자';

  const titlePattern = TITLE_PATTERN_GUIDE[articleType].replaceAll('{카테고리}', categoryLabel);
  const minChars = realEstateLike ? 2800 : 2200;
  const maxChars = realEstateLike ? 4200 : 3500;
  const templateText = replaceCategoryPlaceholders(template, category);

  const prompt = `<role>당신은 ${role}입니다. ${
    isNews
      ? '최근 변화와 뉴스 맥락을 쉽게 풀어 설명하면서도, 독자가 바로 활용할 수 있는 실용 정보를 제공하는 기사형 가이드를 작성합니다.'
      : `"${categoryLabel}" 관련 실용 정보를 제공하는 ${articleType === 'howto' ? '절차/방법 안내' : articleType === 'listicle' ? '추천/목록형' : '설명형'} 가이드를 작성합니다.`
  }</role>

<context>
카테고리: ${categoryLabel} (${category})
글 유형: ${articleType}
${contextBlock}${dbStats}
</context>

<template>
반드시 아래 ${sectionCount}개 섹션을 순서대로 작성하세요.

${templateText}
</template>

<rules>
${COMMON_PROMPT_RULES}

${OPTIONAL_BLOCK_RULES}

[출력 규칙]
1. 분량: 전체 ${minChars}~${maxChars}자
2. 섹션: ${sectionCount}개 전부 작성 필수
3. 각 섹션 제목은 반드시 "## " 마크다운 제목으로 시작
4. 마크다운 형식을 사용합니다: ## 소제목, **강조**, - 리스트, 1. 번호 리스트, | 표 |
5. 코드 블록(\`\`\`) 사용 금지
6. 첫 섹션에서는 독자가 가장 궁금해할 핵심 답이나 핵심 요약을 먼저 제시합니다
7. 문단 수를 억지로 늘리지 말고, 정보 밀도가 높은 내용으로 씁니다
8. 리스트 개수는 내용에 맞게 자연스럽게 작성합니다. 억지로 7개, 10개를 맞추지 않습니다
9. FAQ는 필요한 경우 3~5개 정도 작성하고, 본문 반복이 아니라 예외사항 보완 위주로 씁니다
10. 사이트명, 앱명, 제도명, 비용, 수수료, 기한, 준비 서류 등은 가능한 범위에서 구체적으로 씁니다
${
  isNews
    ? '11. 뉴스형 글은 기사 나열이 아니라 최근 변화의 흐름, 배경, 생활 영향을 중심으로 설명합니다'
    : '11. 독자가 바로 활용할 수 있는 실제 행동 정보 중심으로 씁니다'
}
${
  isDetailedTopic || looksLikeResearchContext
    ? `12. 제공된 리서치 데이터의 수치, 날짜, 조건, 금액, 자격 기준은 가능한 한 정확히 반영합니다. 데이터에 없는 수치는 임의로 만들지 않습니다
13. 리서치 데이터에 [작성 지침]이 있으면 이를 우선 반영하되, 최종 출력 형식은 현재 템플릿을 따릅니다`
    : ''
}
14. 언어는 친절한 한국어 경어체로 작성합니다
15. content 필드에는 ${sectionCount}개 섹션 마크다운 본문만 넣습니다
</rules>

<self-check>
응답 전 검증:
① "##" 섹션이 정확히 ${sectionCount}개인가?
② 첫 섹션이 핵심 요약 또는 핵심 답변 역할을 하는가?
③ 불필요한 반복 없이 실용 정보 중심으로 작성되었는가?
④ FAQ가 있다면 본문 반복이 아니라 보완 역할을 하는가?
⑤ 제목과 본문이 자연스럽고 과도하게 기계적이지 않은가?
</self-check>

<output-format>
다음 JSON 형식으로 응답하세요:
{
  "title": "${titlePattern}",
  "summary": "1~2문장 요약 (검색/SNS용, 50~100자)",
  "content": "위 ${sectionCount}개 섹션 구조의 마크다운 본문",
  "keywords": "키워드1, 키워드2, 키워드3, 키워드4, 키워드5"
}
</output-format>`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const text = (completion.choices[0].message.content ?? '').trim();

  function tryParseJson(raw: string): ArticleResult {
    try {
      return JSON.parse(raw) as ArticleResult;
    } catch {
      const sanitized = raw.replace(/("(?:[^"\\]|\\.)*")/g, (match) =>
        match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
      );
      return JSON.parse(sanitized) as ArticleResult;
    }
  }

  function cleanArticle(parsed: ArticleResult): ArticleResult {
    const title = String(parsed.title ?? '').trim();
    const summary = String(parsed.summary ?? '').trim();
    const keywords = String(parsed.keywords ?? '').trim();

    let cleanContent = String(parsed.content ?? '').trim();
    const firstLine = cleanContent
      .split('\n')[0]
      ?.replace(/^#{1,3}\s*/, '')
      .trim();
    if (firstLine === title) {
      cleanContent = cleanContent.split('\n').slice(1).join('\n').trim();
    }

    return { title, summary, content: cleanContent, keywords };
  }

  try {
    return cleanArticle(tryParseJson(text));
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      return cleanArticle(tryParseJson(match[0]));
    }
    throw new Error(`Failed to parse OpenAI article JSON. Raw response:\n${text}`);
  }
}

// ---------------------------------------------------------------------------
// OpenAI image generation
// ---------------------------------------------------------------------------

async function generateThumbnail(
  openai: OpenAI,
  title: string,
  content: string,
  outputPath: string,
  imageStyle?: string
): Promise<boolean> {
  try {
    const contentSummary = content.slice(0, 300);
    const style =
      imageStyle ??
      'Minimal clean illustration. No text, image only. Bright and friendly tone. Korean urban life theme.';

    const imagePrompt = `Generate a blog thumbnail image.
Title: "${title}"
Context: ${contentSummary}
Style: ${style}`;

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
    });

    const imageData = response.data?.[0]?.b64_json;
    if (!imageData) {
      console.warn('이미지 데이터를 찾을 수 없습니다.');
      return false;
    }

    const buffer = Buffer.from(imageData, 'base64');
    await mkdir(path.dirname(outputPath), { recursive: true });

    const tmpPath = `${outputPath}.tmp.png`;
    await writeFile(tmpPath, buffer);

    try {
      execFileSync('convert', [tmpPath, '-resize', '800x', '-quality', '80', outputPath], {
        stdio: 'pipe',
      });
      const { size: optimizedSize } = await import('fs').then((fs) => fs.statSync(outputPath));
      console.log(
        `썸네일 저장: ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB)`
      );
    } catch {
      await writeFile(outputPath, buffer);
      console.log(
        `썸네일 저장 (리사이즈 건너뜀): ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`
      );
    } finally {
      import('fs').then((fs) => {
        try {
          fs.unlinkSync(tmpPath);
        } catch {
          // noop
        }
      });
    }

    return true;
  } catch (err) {
    console.warn(
      '이미지 생성 실패 - thumbnailUrl을 null로 설정합니다:',
      err instanceof Error ? err.message : err
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

function generateSlug(category: GuideCategory, articleType: ArticleType): string {
  const cuid = createId();
  const typePrefix = articleType === 'news' ? '' : `-${articleType}`;
  return `${category}${typePrefix}-${cuid}`;
}

// ---------------------------------------------------------------------------
// Reusable guide generation
// ---------------------------------------------------------------------------

export interface GeneratedGuide {
  id: string;
  slug: string;
  title: string;
  category: GuideCategory;
  articleType: ArticleType;
}

export async function generateOneGuide(
  category: GuideCategory,
  requestedType?: ArticleType,
  topic?: string
): Promise<GeneratedGuide | null> {
  if (!isGuideCategory(category)) {
    throw new Error(`알 수 없는 카테고리 "${category}". 유효한 값: ${ALL_CATEGORIES.join(', ')}`);
  }

  if (requestedType && !ALL_ARTICLE_TYPES.includes(requestedType)) {
    throw new Error(
      `알 수 없는 글 유형 "${requestedType}". 유효한 값: ${ALL_ARTICLE_TYPES.join(', ')}`
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const openai = new OpenAI({ apiKey });

  console.log(`카테고리: ${category} (${getCategoryLabel(category)})`);

  let articleType: ArticleType;
  let newsTitles: string[] = [];
  let topicContext: string | undefined;

  if (topic) {
    articleType = requestedType ?? 'guide';
    console.log(`직접 지정 주제: "${topic}" (유형: ${articleType})`);

    const isDetailedTopic = topic.length >= 200;
    if (isDetailedTopic) {
      topicContext = topic;
      console.log('긴 토픽 감지 → 사용자 제공 리서치 데이터로 처리');
    } else {
      console.log('토픽 기반 리서치 수집 중...');
      topicContext = await buildTopicResearchContext(topic, articleType);
      console.log('토픽 기반 리서치 완료');
    }
  } else if (requestedType && requestedType !== 'news') {
    articleType = requestedType;
    console.log(`지정된 글 유형: ${articleType} (evergreen — RSS 스킵)`);
  } else {
    console.log('네이버 검색 API 수집 중...');
    newsTitles = await collectNewsTitles(category, 'news');
    console.log(`수집된 뉴스 제목 ${newsTitles.length}건:`);
    newsTitles.forEach((title, index) => console.log(`  ${index + 1}. ${title}`));

    if (requestedType === 'news') {
      articleType = 'news';
      console.log('지정된 글 유형: news');
    } else if (newsTitles.length === 0) {
      articleType = pickEvergreenType();
      console.log(`24시간 이내 뉴스 없음 → evergreen 모드 (${articleType})`);
    } else {
      articleType = 'news';
      console.log('글 유형: news (뉴스 기반)');
    }
  }

  const dbStats = await getFacilityStats(category);
  if (dbStats) console.log(`DB 통계 주입: ${dbStats.trim()}`);

  console.log('OpenAI 기사 생성 중...');
  const article = await generateArticle(
    openai,
    category,
    articleType,
    newsTitles,
    dbStats,
    topicContext
  );
  console.log(`기사 제목: ${article.title}`);

  const slug = generateSlug(category, articleType);
  console.log(`슬러그: ${slug}`);

  const cta = getCategoryCta(category);
  if (!article.content.includes(cta)) {
    article.content = `${article.content.trimEnd()}\n\n${cta}\n`;
    console.log('CTA 누락 감지 → fallback 삽입 완료');
  }

  const linksBlock = await buildInternalLinksSection(category, slug);
  article.content = `${article.content.trimEnd()}\n\n${linksBlock}\n`;
  const linkCount = (linksBlock.match(/\]\(/g) ?? []).length;
  console.log(`내부 링크 블록 삽입 완료 (${linkCount}개 링크)`);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images');
  const imagePath = path.join(uploadDir, 'guides', `${slug}.webp`);

  console.log('썸네일 이미지 생성 중...');
  const imageStyle = isRealEstateLikeCategory(category)
    ? 'Minimal clean illustration. No text, image only. Professional and modern tone. Korean housing, apartment, and policy theme.'
    : undefined;

  const imageGenerated = await generateThumbnail(
    openai,
    article.title,
    article.content,
    imagePath,
    imageStyle
  );
  if (!imageGenerated) {
    throw new Error(`썸네일 이미지 생성 실패 - 글 등록을 중단합니다. (category: ${category})`);
  }

  const thumbnailUrl = `/api/images/guides/${slug}.webp`;

  console.log('데이터베이스에 저장 중...');
  const guide = await prisma.guide.upsert({
    where: { slug },
    create: {
      slug,
      title: article.title,
      summary: article.summary,
      content: article.content,
      category,
      articleType,
      keywords: article.keywords || null,
      thumbnailUrl,
      published: true,
    },
    update: {
      title: article.title,
      summary: article.summary,
      content: article.content,
      category,
      articleType,
      keywords: article.keywords || null,
      thumbnailUrl,
    },
  });

  console.log(`가이드 저장 완료: id=${guide.id}, slug=${guide.slug}, type=${articleType}`);

  return {
    id: guide.id,
    slug: guide.slug,
    title: article.title,
    category,
    articleType,
  };
}

// ---------------------------------------------------------------------------
// Main (CLI)
// ---------------------------------------------------------------------------

interface TopicEntry {
  category: GuideCategory;
  type?: ArticleType;
  topic: string;
  generated?: boolean;
}

async function runFromFile(filePath: string): Promise<void> {
  const absPath = path.resolve(filePath);
  const raw = await readFile(absPath, 'utf-8');
  const topics = JSON.parse(raw) as TopicEntry[];

  const pending = topics.filter((topic) => !topic.generated);
  if (pending.length === 0) {
    console.log('모든 주제가 이미 생성되었습니다.');
    return;
  }

  console.log(`총 ${topics.length}건 중 미생성 ${pending.length}건 처리 시작\n`);

  for (const entry of pending) {
    if (!isGuideCategory(entry.category)) {
      console.warn(`알 수 없는 카테고리 "${entry.category}" — 건너뜁니다.`);
      continue;
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`주제: ${entry.topic}`);
    console.log(`카테고리: ${entry.category}, 유형: ${entry.type ?? 'guide'}`);
    console.log('='.repeat(60));

    try {
      const result = await generateOneGuide(entry.category, entry.type, entry.topic);
      if (result) {
        entry.generated = true;
        await writeFile(absPath, `${JSON.stringify(topics, null, 2)}\n`, 'utf-8');
        console.log(`✓ 완료: ${result.title}`);
      }
    } catch (err) {
      console.error(`✗ 실패 (${entry.topic}):`, err instanceof Error ? err.message : err);
    }
  }

  const doneCount = topics.filter((topic) => topic.generated).length;
  console.log(`\n완료: ${doneCount}/${topics.length}건 생성됨`);
}

async function main(): Promise<void> {
  const fromFile = parseFromFile();
  if (fromFile) {
    await runFromFile(fromFile);
    return;
  }

  const category = parseCategory();
  const articleType = parseArticleType();
  const topic = parseTopic();

  const result = await generateOneGuide(category, articleType, topic);
  if (!result) {
    console.log('글 생성을 건너뛰었습니다.');
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log('완료');
      process.exitCode = 0;
    })
    .catch((error) => {
      console.error('실패:', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
    });
}
