export type DealMode = 'sale' | 'jeonse' | 'wolse';
export type PeriodMonths = 0 | 6 | 12 | 36;
export type PropertyType = 'apt' | 'villa' | 'offitel';

export interface DateWindow {
  from: string;
  to: string;
}

export interface DetailIdentity {
  buildingKey?: string;
  canonicalPath?: string;
  legacyGrouped?: boolean;
  dongName?: string;
  jibun?: string | null;
  bjdCode: string;
  buildingName: string;
}

export interface DetailQuery extends DetailIdentity {
  mode: DealMode;
  months: PeriodMonths;
  area?: string;
  deposit?: number;
}

export interface AppliedFilters extends DetailIdentity {
  mode: DealMode;
  months: PeriodMonths;
  area: string | null;
  deposit: number | null;
}

export interface DealPoint {
  id: number;
  date: string;
  amount: number;
  area: string;
  floor: number | null;
  deposit: number | null;
  /** 직거래 표시 태그(매매만). 전세·월세는 항상 'normal'. */
  flag: DealFlag;
}

export interface AreaOption {
  /** 면적 그룹 키 = ROUND(전용면적) */
  key: string;
  /** 그룹 내 최다 빈도 전용면적의 소수 버림 */
  label: string;
  /** 현재 모드의 최근 36개월 거래 수 */
  count: number;
}

export interface DetailOptions {
  areas: AreaOption[];
  deposits: Array<{ amount: number; count: number }>;
}

export interface DetailPage<Row> {
  items: Row[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DetailSnapshot<Row> {
  filters: AppliedFilters;
  window: DateWindow;
  options: DetailOptions;
  points: DealPoint[];
  table: DetailPage<Row>;
  generatedAt: string;
  adjustment: 'area-reset' | 'deposit-reset' | null;
}

export type SerializedTransaction = {
  id: number;
  buildingName?: string | null;
  bjdCode?: string | null;
  city?: string | null;
  district?: string | null;
  dongName?: string | null;
  floor?: number | null;
  exclusiveArea?: unknown;
  buildYear?: number | null;
  jibun?: string | null;
  roadName?: string | null;
  lat?: unknown;
  lng?: unknown;
  dealYear?: number | null;
  dealMonth?: number | null;
  dealDay?: number | null;
  dealAmount?: number | null;
  dealType?: string | null;
  cancelDealDay?: string | null;
  cancelDealType?: string | null;
  buyerType?: string | null;
  sellerType?: string | null;
  registrationDate?: string | null;
  aptDong?: string | null;
  houseType?: string | null;
  deposit?: number | null;
  monthlyRent?: number | null;
  rentType?: string | null;
  contractType?: string | null;
  contractTerm?: string | null;
  preDeposit?: number | null;
  preMonthlyRent?: number | null;
  useRenewalRight?: string | null;
  sourceId?: string | null;
};

export interface LatestSale {
  id: number;
  amount: number;
  year: number;
  month: number;
  day: number | null;
  area: string | null;
  floor: number | null;
}

/** K-apt 단지 정보(관리비 공개 의무단지). 상세와 연결되지 않으면 개요의 complex 는 null. */
export interface ComplexInfo {
  matchType: 'address' | 'road' | 'name';
  kaptCode: string;
  name: string;
  householdCount: number | null;
  dongCount: number | null;
  topFloor: number | null;
  basementFloors: number | null;
  /** YYYY-MM-DD */
  useApprovalDate: string | null;
  totalParking: number | null;
  groundParking: number | null;
  undergroundParking: number | null;
  heatingType: string | null;
  corridorType: string | null;
  builder: string | null;
  developer: string | null;
  managementType: string | null;
  saleType: string | null;
  elevatorCount: number | null;
  cctvCount: number | null;
  evChargerCount: number | null;
  /** 전용면적 오름차순 */
  areas: Array<{ exclusiveArea: number; householdCount: number }>;
  /** K-apt 기본정보 파일 기준일 YYYY-MM-DD */
  sourceDate: string | null;
}

/** 관리비 기간 평균(세대 평균, 원). from/to 는 'YYYY-MM' */
export interface FeePeriodAverage {
  from: string;
  to: string;
  amount: number;
  months: number;
}

export interface MaintenanceFeeItem {
  group: 'common' | 'individual' | 'longTermRepair';
  label: string;
  /** 세대 평균, 원 */
  amount: number;
}

/**
 * K-apt 관리비 요약. 금액은 모두 세대 평균(단지 월 부과액 ÷ 세대수, 원 반올림).
 * 평형별 실제 부과액이 아니다.
 */
export interface MaintenanceFeeSummary {
  /** 큰 숫자의 달 'YYYY-MM' — 기준 월, 이 단지에 없으면 최대 2개월 전까지 대체 */
  month: string;
  total: number;
  common: number;
  individual: number;
  longTermRepair: number;
  summer: FeePeriodAverage | null;
  winter: FeePeriodAverage | null;
  yearly: FeePeriodAverage | null;
  /** 기준 월로 끝나는 12개월 중 정상 달 + 기준 월 뒤 일부 단지만 올라온 달(partial). 오래된 달 → 최근 달 */
  monthly: Array<{ month: string; amount: number; partial: boolean }>;
  /** ㎡당 공용관리비(원) vs 같은 시군구 중간값. 기준 월 값이 없거나 비교 불가면 null */
  commonPerM2: { complex: number; sggMedian: number; sggComplexCount: number } | null;
  /** 기준 달 항목별 세대 평균, 0 원 항목 제외 */
  items: MaintenanceFeeItem[];
  office: { phone: string | null; address: string | null };
}

export interface DetailOverview {
  identity: DetailIdentity;
  latestSale: LatestSale | null;
  buildYear: number | null;
  minArea: string | null;
  maxArea: string | null;
  saleCount6m: number;
  window6m: DateWindow;
  addresses: Array<{ dongName: string; jibun: string | null; roadName: string | null }>;
  location: { lat: number; lng: number } | null;
  locationAmbiguous: boolean;
  /** 상단 최근 거래·중간값 기준 거래 유형: 매매 URL 'sale', 전월세 URL 'jeonse' */
  basisMode: 'sale' | 'jeonse';
  defaultAreaGroup: string | null;
  areaGroups: AreaGroup[];
  /** 면적 그룹 key → 매매 기준 */
  saleBasis: Record<string, PriceBasis>;
  /** 면적 그룹 key → 전세 기준 */
  jeonseBasis: Record<string, PriceBasis>;
  /** 면적 그룹 key(areaGroups 전부) → 최근 36개월 가장 최근 월세 거래. 없으면 null. */
  wolseLatest: Record<string, WolseLatestDeal | null>;
  /** K-apt 단지 정보. 연결 안 되거나 조회 실패면 null. */
  complex: ComplexInfo | null;
  /** K-apt 관리비 요약. 단지 연결이 없거나 관리비가 없거나 이상값·조회 실패면 null. */
  maintenanceFee: MaintenanceFeeSummary | null;
  generatedAt: string;
}

/** 면적별 최근 거래가 표의 월세 칸. 금액은 만원 단위. */
export interface WolseLatestDeal {
  date: string;
  deposit: number;
  monthlyRent: number;
  floor: number | null;
}

export type SectionResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'error'; data: null; code: 'UNAVAILABLE' };

export interface MarketRegion {
  city: string | null;
  district: string | null;
  label: string;
}

export interface MarketCount {
  total: number;
  daily: Array<{ date: string; count: number }>;
}

export interface RecentBuilding {
  buildingKey?: string;
  canonicalPath?: string;
  dongName?: string;
  type: PropertyType;
  transactionId: number;
  city: string;
  district: string;
  bjdCode: string;
  buildingName: string;
  jibun: string | null;
  date: string;
  amount: number;
  area: string | null;
}

export interface HomeMarket {
  region: MarketRegion;
  window: DateWindow;
  generatedAt: string;
  counts: Record<PropertyType, SectionResult<MarketCount>>;
  recent: SectionResult<RecentBuilding[]>;
}

/** 표시용 태그. 중간값은 모든 거래로 계산한다. */
export type DealFlag = 'normal' | 'direct';

export interface AreaGroup {
  key: string;
  label: string;
  pyeong: number;
  saleCount36m: number;
  jeonseCount36m: number;
}

export interface BasisDealRef {
  id: number;
  date: string;
  amount: number;
  floor: number | null;
}

/** 가장 최근 거래(직거래 포함). 상단 주 숫자·면적별 최근 거래가 표시용. */
export interface LatestAnyDeal extends BasisDealRef {
  direct: boolean;
}

export interface PriceBasis {
  representative: number | null;
  sampleCount: number;
  latestAny: LatestAnyDeal | null;
  max12m: number | null;
  yearAgo: number | null;
  changeRate: number | null;
  /** @deprecated 구 클라이언트 호환(캐시된 페이지 JS 가 읽음) — 항상 []. 다음 릴리스에 제거. */
  excluded: never[];
  /** @deprecated 구 클라이언트 호환 — latestAny 에서 direct 를 뺀 값. 다음 릴리스에 제거. */
  latest: BasisDealRef | null;
}
