// backend/src/types/homeDashboard.ts

export type TrendingBuildingItem = {
  buildingName: string;
  slug: string;
  city: string;       // 정식명 ('서울특별시')
  district: string;
  txnCount: number;
  // 주력 평형 (㎡, 5㎡ 버킷 round) — 단지 내 거래수 최다 평형
  representativeArea: number | null;
  // 주력 평형의 가격 중앙값(만원). sale: dealAmount, jeonse/wolse: deposit
  medianPrice: number | null;
  // wolse 슬롯에만 채워짐 — 주력 평형의 monthlyRent 중앙값(만원)
  medianMonthlyRent: number | null;
};

export type RealEstateTrend = {
  key:
    | 'apt-sale' | 'apt-rent-jeonse' | 'apt-rent-wolse'
    | 'villa-sale' | 'villa-rent-jeonse' | 'villa-rent-wolse'
    | 'offitel-sale' | 'offitel-rent-jeonse' | 'offitel-rent-wolse';
  label: string;
  // 평당가(만원/평). 매매=dealAmount/면적, 전세=deposit/면적, 월세=monthlyRent/면적.
  // 면적이 NULL/0 인 거래는 제외하고 면적 가중 산출.
  pricePerPyeong: number | null;
  txnCount: number;
  prevPricePerPyeong: number | null;
  changePct: number | null;
};

export type SubscriptionImminent = {
  id: number;
  houseName: string;
  regionName: string;
  endDate: string; // ISO yyyy-mm-dd
};

export type HomeDashboardResponse = {
  // 기존 stats superset
  total: number;
  buildingCount: number;
  realEstateBuildings: { apt: number; villa: number; offitel: number };
  subscriptionActiveCount: number;

  // 신규
  newlyListedToday: number;
  realEstateTrends: RealEstateTrend[];
  trendingBuildings: {
    sale: TrendingBuildingItem[];
    jeonse: TrendingBuildingItem[];
    wolse: TrendingBuildingItem[];
  };
  subscriptionSummary: {
    closingThisWeek: number;
    upcomingNextWeek: number;
    avgSupplyPrice: number | null;
    imminent: SubscriptionImminent[];
  };
  realEstateHotspots?: ComplexHotspotsByProperty;  // apt만 채워짐
};

/** 한 단지 식별 + URL 생성용 공통 필드 */
export interface ComplexRef {
  buildingName: string;
  citySlug: string;        // 'seoul'
  city: string;            // '서울특별시'
  district: string;        // '강남구'
  districtSlug: string;    // 'gangnam-gu' or 'gangnam'
}

/** 카드 1: 신고가 갱신 (직전 12개월 최고 평당가 갱신) */
export interface NewHighRow extends ComplexRef {
  dealDate: string;        // ISO yyyy-mm-dd
  newPyeong: number;       // 만원/평
  prevMaxPyeong: number;   // 만원/평
  changePct: number;       // % (e.g., 12.5 = +12.5%)
}

/** 카드 2: 거래 활발 (30일 내 단지 거래 ≥ 2건 TOP) */
export interface ActiveRow extends ComplexRef {
  txnCount: number;        // 30일 거래수
  latestDealDate: string;  // ISO yyyy-mm-dd
  avgPyeongPrice: number;  // 만원/평
}

/** 카드 3: 평당가 TOP (30일 평균 평당가 상위, 시별 캡 2) */
export interface TopPyeongRow extends ComplexRef {
  avgPyeongPrice: number;  // 만원/평
  txnCount: number;        // 30일 거래수
}

/** 자산 1개분 3카드 묶음 */
export interface ComplexHotspots {
  newHigh: NewHighRow[];   // 0~5
  active: ActiveRow[];     // 0~5
  topPyeong: TopPyeongRow[]; // 0~5
}

/** SSR seed: apt만 채워짐 (오피스텔/빌라는 클라이언트 토글 시 lazy) */
export type ComplexHotspotsByProperty = Partial<Record<import('../schemas/realEstate.js').RealEstatePropertyType, ComplexHotspots>>;
