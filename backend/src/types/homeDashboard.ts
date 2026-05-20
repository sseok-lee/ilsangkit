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
};
