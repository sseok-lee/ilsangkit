// backend/src/types/homeDashboard.ts

export type TrendingBuildingItem = {
  buildingName: string;
  slug: string;
  city: string;       // 정식명 ('서울특별시')
  district: string;
  txnCount: number;
  avgPrice: number | null;       // sale: dealAmount 평균(만원). jeonse: deposit 평균(만원). wolse: deposit 평균(만원)
  avgMonthlyRent: number | null; // wolse에만 채워짐 (monthlyRent 평균, 만원)
};

export type RealEstateTrend = {
  key:
    | 'apt-sale' | 'apt-rent-jeonse' | 'apt-rent-wolse'
    | 'villa-sale' | 'villa-rent-jeonse' | 'villa-rent-wolse'
    | 'offitel-sale' | 'offitel-rent-jeonse' | 'offitel-rent-wolse';
  label: string;
  avgPrice: number | null;
  txnCount: number;
  prevAvgPrice: number | null;
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
