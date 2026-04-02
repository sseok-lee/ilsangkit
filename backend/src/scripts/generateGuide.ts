// Guide 자동 생성 스크립트
// Usage: tsx src/scripts/generateGuide.ts [--category <slug>] [--type <news|howto|listicle|guide>]
// Pipeline: CLI args → RSS 뉴스 수집 → OpenAI 기사 생성 → 이미지 생성 → DB upsert
// 뉴스가 없을 경우 evergreen(howto/listicle/guide) 글을 자동 생성

import 'dotenv/config';
import { createId } from '@paralleldrive/cuid2';
import { XMLParser } from 'fast-xml-parser';
import OpenAI from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';

import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ArticleType = 'news' | 'howto' | 'listicle' | 'guide';

const ALL_ARTICLE_TYPES: ArticleType[] = ['news', 'howto', 'listicle', 'guide'];
const EVERGREEN_TYPES: ArticleType[] = ['howto', 'listicle', 'guide'];

// ---------------------------------------------------------------------------
// Category configuration
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  toilet: ['공공화장실', '공중화장실 위생', '화장실 찾기', '화장실 리모델링', '스마트 화장실', '화장실 청결'],
  aed: ['자동심장충격기', 'AED 사용법', '심폐소생술', '심정지 응급처치', '골든타임 구조', 'AED 설치 확대'],
  hospital: ['병원 찾기', '야간진료', '응급실', '동네 의원 진료', '비대면 진료', '의료비 절약'],
  pharmacy: ['약국 영업시간', '야간약국', '처방전', '복약 지도', '일반의약품 편의점', '당번 약국'],
  parking: ['공영주차장', '주차요금', '주차장 찾기', '주차 요금 감면', '전기차 충전 주차', '스마트 주차'],
  wifi: ['공공와이파이', '무료인터넷', '공공WiFi', '와이파이 보안', '공공 인터넷 속도', '디지털 격차'],
  clothes: ['의류수거함', '헌옷 기부', '의류 재활용', '패스트패션 환경', '중고 의류 기부', '섬유 재활용'],
  park: ['공원 산책', '도시 공원 조성', '공원 운동시설', '근린공원', '어린이 놀이터', '공원 문화행사'],
  school: ['초등학교 입학', '학교 배정', '통학구역', '학교 정보 공개', '교육환경', '학구도'],
  market: ['전통시장 활성화', '재래시장', '상설시장', '시장 장날', '온누리상품권', '전통시장 주차'],
  library: ['공공도서관', '도서 대출', '독서', '전자도서관', '도서관 프로그램', '북스타트'],
  trash: ['쓰레기 분리수거', '재활용', '대형폐기물', '음식물 쓰레기 줄이기', '제로웨이스트', '분리배출 방법'],
  childcare: ['어린이집 찾기', '국공립 어린이집', '어린이집 입소 대기', '보육료 지원', '어린이집 안전', '직장 어린이집'],
  'ev-charger': ['전기차 충전소', '전기차 충전 요금', '급속 충전기', '충전 인프라 확대', '전기차 보조금', '공용 충전기'],
  sports: ['체육시설', '공공 체육관', '생활체육', '국민체육센터', '스포츠 강좌 바우처', '주민 체육시설'],
  'apt-sale': ['아파트 매매', '아파트 시세', '아파트 실거래가', '아파트 매수 전략', '부동산 매매 동향', '신축 아파트 분양'],
  'apt-rent': ['아파트 전세', '아파트 월세', '전월세 시세', '전세 사기 예방', '임대차 보호법', '전세 보증보험'],
  'villa-sale': ['빌라 매매', '연립다세대 매매', '빌라 투자', '빌라 실거래가', '다세대 주택 매매', '빌라 매수 주의사항'],
  'villa-rent': ['빌라 전세', '빌라 월세', '다세대 전월세', '빌라 전세 사기', '연립 전월세 시세', '빌라 임대차'],
  'offitel-sale': ['오피스텔 매매', '오피스텔 투자', '오피스텔 시세', '오피스텔 분양', '오피스텔 수익률', '오피스텔 실거래가'],
  'offitel-rent': ['오피스텔 전세', '오피스텔 월세', '오피스텔 임대', '오피스텔 전월세 시세', '오피스텔 관리비', '오피스텔 임대 수익'],
};

const CATEGORY_LABELS: Record<string, string> = {
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
  'apt-sale': '아파트 매매',
  'apt-rent': '아파트 전월세',
  'villa-sale': '빌라 매매',
  'villa-rent': '빌라 전월세',
  'offitel-sale': '오피스텔 매매',
  'offitel-rent': '오피스텔 전월세',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_KEYWORDS);

const REAL_ESTATE_CATEGORIES = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'];

// ---------------------------------------------------------------------------
// Evergreen topic pools (뉴스 없을 때 사용할 상시 주제)
// ---------------------------------------------------------------------------

const EVERGREEN_TOPICS: Record<string, { howto: string[]; listicle: string[]; guide: string[] }> = {
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
    listicle: ['아파트 매매 전 반드시 확인할 체크리스트 10가지', '아파트 시세 파악 시 흔한 실수 5가지'],
    guide: ['아파트 매매 완벽 가이드: 매물 탐색부터 등기까지', '실거래가 vs 호가, 정확한 시세 파악법'],
  },
  'apt-rent': {
    howto: ['전세 보증보험 가입 절차와 필요 서류', '전세 계약 전 등기부등본 확인하는 법'],
    listicle: ['전세 사기 예방 체크리스트 10가지', '월세 소득공제·세액공제 절약 팁'],
    guide: ['아파트 전월세 계약 완벽 가이드', '임대차 3법 핵심 요약과 활용법'],
  },
  'villa-sale': {
    howto: ['빌라 매매 전 등기부등본 보는 법', '빌라 건축물대장 확인 방법과 주의사항'],
    listicle: ['빌라 매매 시 주의해야 할 사항 8가지', '빌라 투자 수익률 계산 시 고려할 요소'],
    guide: ['빌라 매매 완벽 가이드: 체크리스트부터 계약까지', '연립다세대 매매 시 감정평가 활용법'],
  },
  'villa-rent': {
    howto: ['빌라 전세 사기 예방을 위한 확인 절차', '빌라 전월세 계약서 작성 시 유의사항'],
    listicle: ['빌라 전세 계약 전 확인할 사항 8가지', '빌라 월세 계약 시 관리비 확인 포인트'],
    guide: ['빌라 전월세 계약 완벽 가이드', '다세대 전월세 시세 조회 방법 총정리'],
  },
  'offitel-sale': {
    howto: ['오피스텔 임대수익률 계산하는 법', '오피스텔 분양 계약 전 확인 사항'],
    listicle: ['오피스텔 투자 시 확인해야 할 핵심 5가지', '오피스텔 매매 vs 전세 수익 비교'],
    guide: ['오피스텔 매매 완벽 가이드: 투자부터 세금까지', '오피스텔 실거래가 조회 방법 총정리'],
  },
  'offitel-rent': {
    howto: ['오피스텔 관리비 항목 확인하는 법', '오피스텔 전월세 계약서 주요 확인 사항'],
    listicle: ['오피스텔 월세 계약 시 관리비 폭탄 피하는 팁 7가지', '오피스텔 임대 시 알아야 할 세금 사항'],
    guide: ['오피스텔 전월세 계약 완벽 가이드', '오피스텔 관리비 구조와 절약법 총정리'],
  },
};

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseCategory(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--category');
  if (idx !== -1 && args[idx + 1]) {
    const cat = args[idx + 1];
    if (!ALL_CATEGORIES.includes(cat)) {
      console.error(`Unknown category "${cat}". Valid: ${ALL_CATEGORIES.join(', ')}`);
      process.exit(1);
    }
    return cat;
  }
  // Random category
  return ALL_CATEGORIES[Math.floor(Math.random() * ALL_CATEGORIES.length)];
}

function parseArticleType(): ArticleType | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--type');
  if (idx !== -1 && args[idx + 1]) {
    const t = args[idx + 1] as ArticleType;
    if (!ALL_ARTICLE_TYPES.includes(t)) {
      console.error(`Unknown article type "${t}". Valid: ${ALL_ARTICLE_TYPES.join(', ')}`);
      process.exit(1);
    }
    return t;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// RSS fetch
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

async function fetchNewsTitles(keyword: string, maxItems = 10): Promise<string[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ilsangkit-guide-bot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`RSS fetch failed for "${keyword}": HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const parsed = xmlParser.parse(xml);
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];
    const itemList = Array.isArray(items) ? items : [items];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return itemList
      .filter((item: { pubDate?: string }) => {
        if (!item.pubDate) return false;
        const pubTime = new Date(item.pubDate).getTime();
        return !isNaN(pubTime) && pubTime >= oneDayAgo;
      })
      .slice(0, maxItems)
      .map((item: { title?: string | number }) => (item.title ? String(item.title).trim() : ''))
      .filter(Boolean);
  } catch (err) {
    console.warn(`RSS fetch error for "${keyword}":`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function collectNewsTitles(category: string): Promise<string[]> {
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  const allTitles: string[] = [];
  for (const kw of keywords) {
    const titles = await fetchNewsTitles(kw, 5);
    allTitles.push(...titles);
    if (allTitles.length >= 10) break;
  }
  // Deduplicate
  return [...new Set(allTitles)].slice(0, 10);
}

// ---------------------------------------------------------------------------
// DB stats injection (카테고리별 실제 데이터 통계)
// ---------------------------------------------------------------------------

async function getFacilityStats(category: string): Promise<string> {
  // 부동산 카테고리는 별도 모델 사용
  if (REAL_ESTATE_CATEGORIES.includes(category)) {
    return ''; // 부동산 통계는 실거래가 데이터에서 별도 제공
  }

  // 시설 카테고리: Prisma 모델명 매핑
  const MODEL_MAP: Record<string, string> = {
    toilet: 'toilet', aed: 'aed', hospital: 'hospital', pharmacy: 'pharmacy',
    parking: 'parking', wifi: 'wifi', clothes: 'clothes', park: 'park',
    school: 'school', market: 'market', library: 'library', childcare: 'childcare',
    'ev-charger': 'evCharger', sports: 'sports',
  };

  const modelName = MODEL_MAP[category];
  if (!modelName) return '';

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = (prisma as any)[modelName] as {
      count: () => Promise<number>;
    } | undefined;
    if (!model?.count) return '';

    const total = await model.count();
    if (total === 0) return '';

    const label = CATEGORY_LABELS[category] ?? category;
    return `\n일상킷 데이터: 전국 ${label} ${total.toLocaleString('ko-KR')}개소 등록`;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Article templates (유형별)
// ---------------------------------------------------------------------------

// 기존 뉴스 기반 템플릿 (7섹션)
const NEWS_TEMPLATE = `
## 최근 이슈: {뉴스에서 영감받은 소제목}
(수집된 뉴스 2~3건을 자연스럽게 언급하며 최근 동향 해설. 왜 지금 이 주제가 중요한지 맥락 제공. 반드시 3~4문단, 각 문단 3줄 이상)

## {카테고리}, 제대로 알고 계신가요?
(이 시설/서비스의 정의, 위치, 법적 근거, 설치 기준 등 기본 정보. 역사적 배경이나 제도 변화 포함. 반드시 3~4문단, 각 문단 3줄 이상)

## 똑똑하게 활용하는 방법
(이용 절차, 찾는 법, 사용법을 번호 리스트로 구체적 설명. 유용한 앱/웹사이트 소개 포함. 반드시 7개 이상 항목, 각 항목 2줄 이상 설명)

## 관련 제도와 정책
(이 시설/서비스와 관련된 법률, 조례, 정부 정책, 지자체 지원 제도 등. 반드시 3~4문단, 각 문단 3줄 이상)

## 자주 하는 실수와 해결법
(이용 시 흔히 하는 실수나 오해 5가지 이상. 아래 형식을 반드시 그대로 따를 것 — 들여쓰기 금지, 번호+볼드 필수:

[올바른 형식 예시]
1. **등기부등본 열람 시기를 놓치는 실수**
**이런 실수를 해요:** 계약서에 서명하기 직전이 아니라 몇 주 전에 열람한 등기부등본을 그대로 신뢰하는 분들이 많습니다. 그 사이에 근저당이나 가압류가 설정될 수 있어 큰 손해로 이어질 수 있습니다.
**이렇게 해결하세요:** 계약 당일, 잔금일 당일 두 번 반드시 등기부등본을 재열람하세요. 인터넷등기소에서 700원이면 즉시 확인할 수 있습니다.

[잘못된 형식 — 절대 이렇게 쓰지 마세요]
- 실수 제목: 잘못된 검색 ← 들여쓰기+콜론 형식 금지
  이런 실수를 해요: 잘못 검색함 ← 볼드 없는 1줄짜리 금지

반드시 "1. **제목**" 번호+볼드, 각 실수마다 **이런 실수를 해요:** / **이렇게 해결하세요:** 각각 2줄 이상)

## 이것만은 꼭! 실용 꿀팁
(대부분 모르는 유용한 팁 7개 이상. 번호 리스트(1. 2. 3.)로 작성하고, 각 항목은 **팁 제목**으로 시작 후 구체적 설명 2줄 이상)

## 마무리
(핵심 3~4줄 요약 + "일상킷에서 내 주변 {카테고리}를 바로 찾아보세요!")
`;

const NEWS_TEMPLATE_REAL_ESTATE = `
## 최근 이슈: {뉴스에서 영감받은 소제목}
(수집된 뉴스 2~3건을 자연스럽게 언급하며 최근 시장 동향 해설. 왜 지금 이 주제가 중요한지 맥락 제공. 반드시 3~4문단, 각 문단 3줄 이상)

## {카테고리} 시장, 지금 어떤 상황인가요?
(현재 시장 흐름, 가격 추이, 거래량 변화, 지역별 특성 등을 구체적 수치와 함께 설명. 반드시 3~4문단, 각 문단 3줄 이상)

## 똑똑하게 거래하는 방법
(거래 절차, 체크리스트, 유용한 사이트/앱을 번호 리스트로 구체적 설명. 반드시 7개 이상 항목, 각 항목 2줄 이상 설명)

## 관련 제도와 정책
(부동산 관련 세금, 대출 규제, 정부 정책, 청약 제도 등을 구체적으로 설명. 반드시 3~4문단, 각 문단 3줄 이상)

## 자주 하는 실수와 해결법
(거래 시 흔한 실수 5가지 이상. 아래 형식을 정확히 따를 것:

1. **실수 제목**
**이런 실수를 해요:** 구체적 상황 설명 (2~3줄)
**이렇게 해결하세요:** 올바른 방법과 근거 (2~3줄)

이 형식으로 5개 이상 작성. ### 소제목 사용 금지, 반드시 번호 리스트 + 볼드 형식 사용)

## 이것만은 꼭! 실용 꿀팁
(대부분 모르는 유용한 팁 7개 이상. 번호 리스트(1. 2. 3.)로 작성하고, 각 항목은 **팁 제목**으로 시작 후 구체적 설명 2줄 이상)

## 마무리
(핵심 3~4줄 요약 + "일상킷에서 {카테고리} 실거래가 정보를 바로 확인해보세요!")
`;

// How-to 템플릿 (5섹션 — 절차/방법 중심)
const HOWTO_TEMPLATE = `
## 핵심 요약
(이 글에서 다루는 내용을 3~4줄로 요약. 독자가 이 글을 왜 읽어야 하는지 명확히 설명)

## 준비물과 사전 확인
(시작 전 필요한 준비물, 조건, 확인 사항을 번호 리스트로 정리. 반드시 5개 이상 항목, 각 항목 1~2줄 설명)

## 단계별 방법
(구체적인 절차를 번호 리스트(1. 2. 3.)로 설명. 반드시 7단계 이상, 각 단계 2~3줄로 상세히. 앱/사이트 이름, 메뉴 경로, 버튼명 등 구체적으로 기술)

## 주의사항과 흔한 실수
(이 과정에서 자주 하는 실수 5가지 이상. 아래 형식을 반드시 그대로 따를 것 — 들여쓰기 금지, 번호+볼드 필수:

[올바른 형식 예시]
1. **등기부등본 열람 시기를 놓치는 실수**
**이런 실수를 해요:** 계약서에 서명하기 직전이 아니라 몇 주 전에 열람한 등기부등본을 그대로 신뢰하는 분들이 많습니다. 그 사이에 근저당이나 가압류가 설정될 수 있어 큰 손해로 이어질 수 있습니다.
**이렇게 해결하세요:** 계약 당일, 잔금일 당일 두 번 반드시 등기부등본을 재열람하세요. 인터넷등기소(iros.go.kr)에서 700원이면 즉시 확인할 수 있습니다.

[잘못된 형식 — 이렇게 쓰지 마세요]
- 실수 제목: 잘못된 검색 ← 이런 형식은 금지
  이런 실수를 해요: 잘못 검색함 ← 들여쓰기 금지, 볼드 없음 금지

반드시 "1. **제목**" 번호 리스트 + 볼드 형식만 사용. 각 실수마다 이런 실수를 해요/이렇게 해결하세요 각각 2줄 이상)

## 자주 묻는 질문
(관련 FAQ 5개 이상. 아래 형식을 정확히 따를 것:

**Q. 질문 내용?**
A. 구체적인 답변 (2~3줄)

반드시 5개 이상 작성)
`;

// 리스티클 템플릿 (4섹션 — 추천/비교/목록 중심)
const LISTICLE_TEMPLATE = `
## 선정 기준
(이 리스트를 어떤 기준으로 선정했는지 설명. 공신력 있는 데이터 출처나 평가 기준 명시. 반드시 2~3문단)

## 추천 리스트
(번호 리스트(1. 2. 3.)로 7개 이상 항목 작성. 각 항목은 아래 형식:

1. **항목 이름/제목**
- 핵심 특징 또는 장점 (1~2줄)
- 이용 방법, 위치, 요금 등 구체적 정보 (1~2줄)
- 추천 대상 또는 활용 팁 (1줄)

반드시 7개 이상, 각 항목 3줄 이상)

## 활용 꿀팁
(리스트 항목들을 더 잘 활용할 수 있는 팁 5개 이상. 번호 리스트로 작성, 각 항목 **팁 제목**으로 시작 후 구체적 설명 1~2줄)

## 마무리
(핵심 3~4줄 요약 + "일상킷에서 내 주변 {카테고리} 정보를 바로 확인해보세요!")
`;

// 종합 가이드 템플릿 (5섹션 — 깊이 있는 정보 중심)
const GUIDE_TEMPLATE = `
## 핵심 3줄 요약
(이 글의 핵심 내용을 번호 리스트 3개로 간결하게 요약. 각 항목 1~2줄)

## 상세 설명
(주제에 대한 깊이 있는 설명. 정의, 배경, 현황, 법적 근거 등 포함. 반드시 4~5문단, 각 문단 3줄 이상. 구체적 수치, 사이트명, 제도명 포함)

## 비교표와 선택 가이드
(관련 옵션/유형/제도를 비교하는 표 형식 또는 항목별 비교. 반드시 3개 이상 항목 비교. 마크다운 표 사용 권장. 각 항목의 장단점이나 특징 명시)

## 실전 체크리스트
(독자가 바로 활용할 수 있는 체크리스트. 번호 리스트로 10개 이상 항목. 각 항목 1~2줄. 구체적이고 실천 가능한 내용)

## 마무리
(핵심 3~4줄 요약 + "일상킷에서 내 주변 {카테고리} 정보를 바로 확인해보세요!")
`;

function getTemplate(articleType: ArticleType, category: string): { template: string; sectionCount: number } {
  const isRealEstate = REAL_ESTATE_CATEGORIES.includes(category);

  switch (articleType) {
    case 'news':
      return {
        template: isRealEstate ? NEWS_TEMPLATE_REAL_ESTATE : NEWS_TEMPLATE,
        sectionCount: 7,
      };
    case 'howto':
      return { template: HOWTO_TEMPLATE, sectionCount: 5 };
    case 'listicle':
      return { template: LISTICLE_TEMPLATE, sectionCount: 4 };
    case 'guide':
      return { template: GUIDE_TEMPLATE, sectionCount: 5 };
  }
}

// ---------------------------------------------------------------------------
// SEO title patterns (유형별)
// ---------------------------------------------------------------------------

const TITLE_PATTERN_GUIDE: Record<ArticleType, string> = {
  news: '뉴스 트렌드를 반영한 흥미로운 제목 (20~40자). 패턴 예시: "2026년 달라지는 {카테고리} 제도, 핵심만 정리"',
  howto: '절차/방법을 명확히 드러내는 제목 (20~40자). 패턴 예시: "{카테고리} 신청 방법 5단계 총정리", "5분 만에 끝내는 {카테고리} 이용법"',
  listicle: '숫자+혜택이 포함된 제목 (20~40자). 패턴 예시: "모르면 손해! {카테고리} 꿀팁 7가지", "{카테고리} 이용 시 꼭 알아야 할 8가지"',
  guide: '종합 가이드임을 드러내는 제목 (20~40자). 패턴 예시: "{카테고리} 완벽 가이드: 처음부터 끝까지", "한눈에 보는 {카테고리} 총정리"',
};

// ---------------------------------------------------------------------------
// Evergreen type selection
// ---------------------------------------------------------------------------

function pickEvergreenType(_category: string): ArticleType {
  return EVERGREEN_TYPES[Math.floor(Math.random() * EVERGREEN_TYPES.length)];
}

function pickEvergreenTopic(category: string, articleType: ArticleType): string {
  const categoryTopics = EVERGREEN_TOPICS[category];
  if (!categoryTopics) {
    const label = CATEGORY_LABELS[category] ?? category;
    return `${label} 이용 가이드`;
  }
  const topics = categoryTopics[articleType as keyof typeof categoryTopics] ?? [];
  if (topics.length === 0) {
    const label = CATEGORY_LABELS[category] ?? category;
    return `${label} 이용 가이드`;
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

async function generateArticle(
  openai: OpenAI,
  category: string,
  articleType: ArticleType,
  newsTitles: string[],
  dbStats: string,
): Promise<ArticleResult> {
  const categoryLabel = CATEGORY_LABELS[category] ?? category;
  const { template, sectionCount } = getTemplate(articleType, category);

  const isNews = articleType === 'news';
  const isRealEstate = REAL_ESTATE_CATEGORIES.includes(category);

  // 뉴스 컨텍스트 (news 유형만) 또는 evergreen 주제
  let contextBlock: string;
  if (isNews && newsTitles.length > 0) {
    contextBlock = `참고 뉴스 제목:\n${newsTitles.join('\n')}`;
  } else {
    const topic = pickEvergreenTopic(category, articleType);
    contextBlock = `글 주제: ${topic}`;
  }

  const role = isRealEstate ? '부동산 전문 기자' : '생활 정보 전문 기자';
  const titlePattern = TITLE_PATTERN_GUIDE[articleType].split('{카테고리}').join(categoryLabel);

  const prompt = `당신은 ${role}입니다.
${isNews ? '최근 뉴스를 해설하고, 관련 실용 정보를 함께 제공하는 가이드 기사를 작성해주세요.' : `"${categoryLabel}" 관련 실용 정보를 제공하는 ${articleType === 'howto' ? '절차/방법 안내' : articleType === 'listicle' ? '추천/비교 리스트' : '종합 가이드'} 기사를 작성해주세요.`}

카테고리: ${categoryLabel} (${category})
글 유형: ${articleType}
${contextBlock}${dbStats}

## 글 구조 (반드시 아래 ${sectionCount}개 섹션을 순서대로 작성)

${template.split('{카테고리}').join(categoryLabel)}

## 작성 규칙 (매우 중요 — 반드시 전부 준수)
- **전체 3000~4500자 분량** (반드시 3000자 이상. 2500자 미만 절대 금지)
- **${sectionCount}개 섹션 전부 작성 필수** — 하나라도 빠지면 실패. 각 섹션은 반드시 "## " 마크다운 제목으로 시작
- 각 섹션마다 최소 3문단 또는 리스트 항목 5개 이상 포함 (1~2문단으로 끝내지 마세요)
- 마크다운 형식 (## 소제목, **강조**, - 리스트, 1. 번호 리스트)
${isNews ? '- 참고 뉴스 제목을 자연스럽게 녹여서 해설 (원문 복사 금지)' : '- 독자에게 실질적으로 도움이 되는 구체적이고 정확한 정보 위주'}
- 독자가 바로 실천할 수 있는 구체적 정보 위주 (구체적 수치, 사이트명, 절차 포함)
- 친근하고 자연스러운 한국어 경어체
- 반드시 순수 한국어로 작성 (영어 단어 사용 금지, 고유명사/약어 제외)
- content 필드에 위 ${sectionCount}개 섹션의 마크다운만 포함
- **형식 엄수**: "실수와 해결법" 섹션은 반드시 "1. **제목**" 번호+볼드 형식 사용. 들여쓰기나 "실수 제목:" 콜론 형식 절대 금지. 1줄짜리 짧은 내용 금지 — 각 항목 최소 4줄 이상
- **구체성 필수**: "정확한 정보를 확인하세요" 같은 뻔한 조언 금지. 구체적 사이트명(예: iros.go.kr), 금액(예: 700원), 기한(예: 계약일 당일) 등 실제 수치와 경로를 반드시 포함
- 응답 전 스스로 검증: ① "##"으로 시작하는 섹션이 ${sectionCount}개인가? ② 전체 3000자 이상인가? ③ 각 섹션이 충분히 긴가? ④ 번호+볼드 형식을 따랐는가?

다음 JSON 형식으로 응답:
{
  "title": "${titlePattern}",
  "summary": "1~2문장 요약 (검색/SNS용, 50~100자)",
  "content": "위 ${sectionCount}개 섹션 구조의 마크다운 본문 (3000자 이상)",
  "keywords": "키워드1, 키워드2, 키워드3, 키워드4, 키워드5"
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const text = (completion.choices[0].message.content ?? '').trim();

  // Try to parse JSON, with sanitization for unescaped control characters
  function tryParseJson(raw: string): ArticleResult {
    try {
      return JSON.parse(raw) as ArticleResult;
    } catch {
      // Fix unescaped newlines/tabs inside JSON string values
      const sanitized = raw.replace(
        /("(?:[^"\\]|\\.)*")/g,
        (match) => match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'),
      );
      return JSON.parse(sanitized) as ArticleResult;
    }
  }

  function cleanArticle(parsed: ArticleResult): ArticleResult {
    const title = String(parsed.title ?? '').trim();
    const summary = String(parsed.summary ?? '').trim();
    const keywords = String(parsed.keywords ?? '').trim();

    // content 첫 줄이 title과 중복이면 제거
    let cleanContent = String(parsed.content ?? '').trim();
    const firstLine = cleanContent.split('\n')[0].replace(/^#{1,3}\s*/, '').trim();
    if (firstLine === title) {
      cleanContent = cleanContent.split('\n').slice(1).join('\n').trim();
    }

    return { title, summary, content: cleanContent, keywords };
  }

  try {
    const parsed = tryParseJson(text);
    return cleanArticle(parsed);
  } catch {
    // Fallback: extract JSON object via regex
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const fallback = tryParseJson(match[0]);
      return cleanArticle(fallback);
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
  imageStyle?: string,
): Promise<boolean> {
  try {
    // 글 내용 요약을 포함한 이미지 프롬프트 생성
    const contentSummary = content.slice(0, 300);
    const style = imageStyle ?? 'Minimal clean illustration. No text, image only. Bright and friendly tone. Korean urban life theme.';
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

    // 원본 임시 저장 후 ImageMagick으로 800px WebP 리사이즈
    const tmpPath = outputPath + '.tmp.png';
    await writeFile(tmpPath, buffer);
    try {
      execSync(`convert "${tmpPath}" -resize 800x -quality 80 "${outputPath}"`, { stdio: 'pipe' });
      const { size: optimizedSize } = await import('fs').then(fs => fs.statSync(outputPath));
      console.log(`썸네일 저장: ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB)`);
    } catch {
      // ImageMagick 없으면 원본 그대로 저장
      await writeFile(outputPath, buffer);
      console.log(`썸네일 저장 (리사이즈 건너뜀): ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`);
    } finally {
      import('fs').then(fs => { try { fs.unlinkSync(tmpPath); } catch { /* tmp 파일 이미 삭제됨 */ } });
    }
    return true;
  } catch (err) {
    console.warn(
      '이미지 생성 실패 - thumbnailUrl을 null로 설정합니다:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Slug generation (의미있는 slug)
// ---------------------------------------------------------------------------

function generateSlug(category: string, articleType: ArticleType): string {
  const cuid = createId();
  // 카테고리 + 글유형 + 짧은 ID
  const typePrefix = articleType === 'news' ? '' : `-${articleType}`;
  return `${category}${typePrefix}-${cuid}`;
}

// ---------------------------------------------------------------------------
// Reusable guide generation (used by CLI and scheduler)
// ---------------------------------------------------------------------------

export interface GeneratedGuide {
  id: string;
  slug: string;
  title: string;
  category: string;
  articleType: ArticleType;
}

export async function generateOneGuide(
  category: string,
  requestedType?: ArticleType,
): Promise<GeneratedGuide | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const openai = new OpenAI({ apiKey });

  console.log(`카테고리: ${category} (${CATEGORY_LABELS[category]})`);

  // 1. Determine article type & collect news (evergreen은 RSS 스킵)
  let articleType: ArticleType;
  let newsTitles: string[] = [];

  if (requestedType && requestedType !== 'news') {
    // evergreen 유형 지정 → RSS 수집 불필요
    articleType = requestedType;
    console.log(`지정된 글 유형: ${articleType} (evergreen — RSS 스킵)`);
  } else {
    // news 유형이거나 미지정 → RSS 수집
    console.log('뉴스 RSS 수집 중...');
    newsTitles = await collectNewsTitles(category);
    console.log(`수집된 뉴스 제목 ${newsTitles.length}건:`);
    newsTitles.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

    if (requestedType === 'news') {
      articleType = 'news';
      console.log('지정된 글 유형: news');
    } else if (newsTitles.length === 0) {
      // 뉴스 없으면 evergreen 유형으로 자동 전환
      articleType = pickEvergreenType(category);
      console.log(`24시간 이내 뉴스 없음 → evergreen 모드 (${articleType})`);
    } else {
      articleType = 'news';
      console.log('글 유형: news (뉴스 기반)');
    }
  }

  // 3. Fetch DB stats for prompt injection
  const dbStats = await getFacilityStats(category);
  if (dbStats) console.log(`DB 통계 주입: ${dbStats.trim()}`);

  // 4. Generate article via OpenAI
  console.log('OpenAI 기사 생성 중...');
  const article = await generateArticle(openai, category, articleType, newsTitles, dbStats);
  console.log(`기사 제목: ${article.title}`);

  // 5. Generate slug
  const slug = generateSlug(category, articleType);
  console.log(`슬러그: ${slug}`);

  // 6. Generate thumbnail image
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images');
  const imagePath = path.join(uploadDir, 'guides', `${slug}.webp`);

  console.log('썸네일 이미지 생성 중...');
  const isRealEstate = REAL_ESTATE_CATEGORIES.includes(category);
  const imageStyle = isRealEstate
    ? 'Minimal clean illustration. No text, image only. Professional and modern tone. Korean real estate and apartment theme.'
    : undefined;
  const imageGenerated = await generateThumbnail(openai, article.title, article.content, imagePath, imageStyle);
  if (!imageGenerated) {
    throw new Error(`썸네일 이미지 생성 실패 - 글 등록을 중단합니다. (category: ${category})`);
  }
  const thumbnailUrl = `/api/images/guides/${slug}.webp`;

  // 7. Upsert Guide record in DB
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
  return { id: guide.id, slug: guide.slug, title: article.title, category, articleType };
}

// ---------------------------------------------------------------------------
// Main (CLI)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const category = parseCategory();
  const articleType = parseArticleType();
  const result = await generateOneGuide(category, articleType);
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
      process.exit(0);
    })
    .catch((error) => {
      console.error('실패:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect().catch(() => {});
    });
}
