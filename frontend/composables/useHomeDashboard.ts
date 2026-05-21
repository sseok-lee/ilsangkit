import type { RealEstatePropertyType } from '~/types/realEstate'

export interface TrendingBuildingItem {
  buildingName: string;
  city: string;
  district: string;
  txnCount: number;
  representativeArea: number | null;
  medianPrice: number | null;
  medianMonthlyRent: number | null;
  slug: string;
}

export interface RealEstateTrend {
  key:
    | 'apt-sale' | 'apt-rent-jeonse' | 'apt-rent-wolse'
    | 'villa-sale' | 'villa-rent-jeonse' | 'villa-rent-wolse'
    | 'offitel-sale' | 'offitel-rent-jeonse' | 'offitel-rent-wolse';
  label: string;
  pricePerPyeong: number | null;
  txnCount: number;
  prevPricePerPyeong: number | null;
  changePct: number | null;
}

export interface SubscriptionImminent {
  id: number;
  houseName: string;
  regionName: string;
  endDate: string;
}

export interface ComplexRef {
  buildingName: string;
  citySlug: string;
  city: string;
  district: string;
  districtSlug: string;
}

export interface NewHighRow extends ComplexRef {
  dealDate: string;
  newPyeong: number;
  prevMaxPyeong: number;
  changePct: number;
}

export interface ActiveRow extends ComplexRef {
  txnCount: number;
  latestDealDate: string;
  avgPyeongPrice: number;
}

export interface TopPyeongRow extends ComplexRef {
  avgPyeongPrice: number;
  txnCount: number;
}

export interface ComplexHotspots {
  newHigh: NewHighRow[];
  active: ActiveRow[];
  topPyeong: TopPyeongRow[];
}

export type ComplexHotspotsByProperty = Partial<Record<RealEstatePropertyType, ComplexHotspots>>;

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
  realEstateHotspots?: ComplexHotspotsByProperty;
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
