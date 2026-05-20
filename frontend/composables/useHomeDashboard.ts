export interface TrendingBuildingItem {
  buildingName: string;
  city: string;
  district: string;
  txnCount: number;
  avgPrice: number | null;
  avgMonthlyRent: number | null;
  slug: string;
}

export interface RealEstateTrend {
  key:
    | 'apt-sale' | 'apt-rent-jeonse' | 'apt-rent-wolse'
    | 'villa-sale' | 'villa-rent-jeonse' | 'villa-rent-wolse'
    | 'offitel-sale' | 'offitel-rent-jeonse' | 'offitel-rent-wolse';
  label: string;
  avgPrice: number | null;
  txnCount: number;
  prevAvgPrice: number | null;
  changePct: number | null;
}

export interface SubscriptionImminent {
  id: number;
  houseName: string;
  regionName: string;
  endDate: string;
}

export interface HomeDashboard {
  total: number;
  buildingCount: number;
  realEstateBuildings: { apt: number; villa: number; offitel: number };
  subscriptionActiveCount: number;
  newlyListedToday: number;
  realEstateTrends: RealEstateTrend[];
  trendingBuildings: { sale: TrendingBuildingItem[]; jeonse: TrendingBuildingItem[]; wolse: TrendingBuildingItem[] };
  subscriptionSummary: {
    closingThisWeek: number;
    upcomingNextWeek: number;
    avgSupplyPrice: number | null;
    imminent: SubscriptionImminent[];
  };
}

interface ApiEnvelope {
  success: boolean;
  data: HomeDashboard;
}

export function useHomeDashboard() {
  const config = useRuntimeConfig();
  return useAsyncData('home-dashboard', () =>
    $fetch<ApiEnvelope>(`${config.public.apiBase}/api/meta/home-dashboard`).catch(() => null),
  );
}
