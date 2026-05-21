// backend/src/types/homeDashboard.ts
import type { RealEstatePropertyType } from '../schemas/realEstate.js';

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
  realEstateHotspots?: RealEstateHotspots;  // apt만 채워짐
};

/** 한 지역(시·군·구) 핫스팟 정보 */
export interface HotspotRegion {
  citySlug: string;        // 'seoul'
  city: string;            // '서울특별시'
  districtSlug: string;    // 'gangnam-gu'
  district: string;        // '강남구'
  pricePerPyeong: number | null;   // 평당가(만원). 월세는 null
  txnCount: number;                // 최근 7일 거래건수
  changePct: number | null;        // 전주 대비 평당가 변동률(%). 월세는 null
  volumeChangePct: number | null;  // 거래량 변동률(%)
}

/** 매매/전세 슬라이스의 3시그널 묶음 */
export interface HotspotBundle {
  rising: HotspotRegion[];   // 평당가 상승 TOP. changePct desc, max 5
  falling: HotspotRegion[];  // 평당가 하락 TOP. changePct asc, max 5
  active: HotspotRegion[];   // 거래 급증 TOP. volumeChangePct desc, max 5
}

/** 월세 슬라이스 — 거래 급증만 */
export interface WolseHotspotBundle {
  active: HotspotRegion[];   // pricePerPyeong/changePct는 null로 채워짐
}

/** 건물 유형별 핫스팟: 매매/전세/월세 */
export interface PropertyHotspots {
  sale: HotspotBundle;
  jeonse: HotspotBundle;
  wolse: WolseHotspotBundle;
}

/** 메인 SSR은 apt만 채움. 나머지 건물유형은 클라이언트 lazy fetch */
export type RealEstateHotspots = Partial<Record<RealEstatePropertyType, PropertyHotspots>>;
