// 시설 카테고리 (Prisma enum 대응) — 런타임 배열을 단일 소스로 두고 타입을 그로부터 파생한다.
export const FACILITY_CATEGORIES = [
  'toilet',
  'trash',
  'wifi',
  'clothes',
  'parking',
  'aed',
  'library',
  'hospital',
  'pharmacy',
  'park',
  'school',
  'market',
  'childcare',
  'ev-charger',
  'sports',
  'subway',
] as const

export type FacilityCategory = (typeof FACILITY_CATEGORIES)[number]

export function isFacilityCategory(value: string): value is FacilityCategory {
  return (FACILITY_CATEGORIES as readonly string[]).includes(value)
}

// 시설 기본 정보 (목록용)
export interface Facility {
  id: string
  name: string
  category: FacilityCategory
  address: string | null
  roadAddress: string | null
  lat: number
  lng: number
  city: string
  district: string
  distance?: number
  extras?: Record<string, unknown>
}

// 시설 상세 정보
export interface FacilityDetail {
  id: string
  category: FacilityCategory
  name: string
  address: string | null
  roadAddress: string | null
  lat: number
  lng: number
  city: string
  district: string
  bjdCode: string | null
  details: ToiletDetails | WifiDetails | ClothesDetails | ParkingDetails | AedDetails | LibraryDetails | HospitalDetails | PharmacyDetails | ParkDetails | SchoolDetails | MarketDetails | ChildcareDetails | EvChargerDetails | SportsDetails
  sourceId: string
  sourceUrl: string | null
  viewCount: number
  createdAt: string
  updatedAt: string
  syncedAt: string
}

// 카테고리별 상세 정보
export interface ToiletDetails {
  operatingHours?: string | null
  maleToilets?: number
  maleUrinals?: number
  femaleToilets?: number
  hasDisabledToilet?: boolean
  openTime?: string | null
  managingOrg?: string | null
  phoneNumber?: string | null
  installDate?: string | null
  ownershipType?: string | null
  sewageTreatment?: string | null
  hasEmergencyBell?: boolean
  emergencyBellLocation?: string | null
  hasCCTV?: boolean
  hasDiaperChangingTable?: boolean
  diaperChangingLocation?: string | null
  maleDisabledToilets?: number
  maleDisabledUrinals?: number
  maleChildToilets?: number
  maleChildUrinals?: number
  femaleDisabledToilets?: number
  femaleChildToilets?: number
  remodelingDate?: string | null
  facilityType?: string | null
  legalBasis?: string | null
  govCode?: string | null
  dataDate?: string | null
}

export interface WifiDetails {
  ssid?: string | null
  installDate?: string | null
  serviceProvider?: string | null
  installLocation?: string | null
  managementAgency?: string | null
  phoneNumber?: string | null
  installLocationDetail?: string | null
  govCode?: string | null
  dataDate?: string | null
}

export interface ClothesDetails {
  managementAgency?: string | null
  phoneNumber?: string | null
  dataDate?: string | null
  detailLocation?: string | null
  providerCode?: string | null
  providerName?: string | null
}

export interface ParkingDetails {
  parkingType?: string | null
  lotType?: string | null
  capacity?: number
  baseFee?: number | null
  baseTime?: number | null
  additionalFee?: number | null
  additionalTime?: number | null
  dailyMaxFee?: number | null
  monthlyFee?: number | null
  operatingHours?: string | null
  phone?: string | null
  paymentMethod?: string | null
  remarks?: string | null
  hasDisabledParking?: boolean
  zoneClass?: string | null
  alternateParking?: string | null
  operatingDays?: string | null
  feeType?: string | null
  dailyMaxFeeHours?: string | null
  managingOrg?: string | null
  dataDate?: string | null
  providerCode?: string | null
  providerName?: string | null
}

export interface AedDetails {
  buildPlace?: string | null
  org?: string | null
  clerkTel?: string | null
  mfg?: string | null
  model?: string | null
  monSttTme?: string | null
  monEndTme?: string | null
  tueSttTme?: string | null
  tueEndTme?: string | null
  wedSttTme?: string | null
  wedEndTme?: string | null
  thuSttTme?: string | null
  thuEndTme?: string | null
  friSttTme?: string | null
  friEndTme?: string | null
  satSttTme?: string | null
  satEndTme?: string | null
  sunSttTme?: string | null
  sunEndTme?: string | null
  holSttTme?: string | null
  holEndTme?: string | null
  dataDate?: string | null
}

export interface LibraryDetails {
  libraryType?: string | null
  closedDays?: string | null
  weekdayOpenTime?: string | null
  weekdayCloseTime?: string | null
  saturdayOpenTime?: string | null
  saturdayCloseTime?: string | null
  holidayOpenTime?: string | null
  holidayCloseTime?: string | null
  seatCount?: number
  bookCount?: number
  serialCount?: number
  nonBookCount?: number
  loanableBooks?: number
  loanableDays?: number
  phoneNumber?: string | null
  homepageUrl?: string | null
  operatingOrg?: string | null
  lotArea?: string | null
  buildingArea?: string | null
  dataDate?: string | null
  providerCode?: string | null
  providerName?: string | null
}

export interface HospitalDepartment {
  dgsbjtCdNm: string
  dgsbjtPrSdrCnt?: number | null
}

export interface HospitalDetails {
  phone?: string | null
  homepage?: string | null
  postNo?: string | null
  estbDd?: string | null
  ykiho?: string | null
  clCd?: string | null
  clCdNm?: string | null
  sidoCd?: string | null
  sgguCd?: string | null
  emdongNm?: string | null
  drTotCnt?: number | null
  mdeptSdrCnt?: number | null
  mdeptGdrCnt?: number | null
  mdeptIntnCnt?: number | null
  mdeptResdntCnt?: number | null
  detySdrCnt?: number | null
  detyGdrCnt?: number | null
  detyIntnCnt?: number | null
  detyResdntCnt?: number | null
  cmdcSdrCnt?: number | null
  cmdcGdrCnt?: number | null
  cmdcIntnCnt?: number | null
  cmdcResdntCnt?: number | null
  pnursCnt?: number | null
  dataDate?: string | null
  trmtMonStart?: string | null
  trmtMonEnd?: string | null
  trmtTueStart?: string | null
  trmtTueEnd?: string | null
  trmtWedStart?: string | null
  trmtWedEnd?: string | null
  trmtThuStart?: string | null
  trmtThuEnd?: string | null
  trmtFriStart?: string | null
  trmtFriEnd?: string | null
  trmtSatStart?: string | null
  trmtSatEnd?: string | null
  trmtSunStart?: string | null
  trmtSunEnd?: string | null
  lunchWeek?: string | null
  lunchSat?: string | null
  noTrmtSun?: string | null
  noTrmtHoli?: string | null
  parkQty?: number | null
  parkEtc?: string | null
  detailSyncedAt?: string | null
  // 시설정보 + 간호등급 (xlsx 파일 3, 9)
  foundationCd?: string | null
  foundationCdNm?: string | null
  nurseGrade?: string | null
  generalUpperBeds?: number | null
  generalNormalBeds?: number | null
  adultIcuBeds?: number | null
  childIcuBeds?: number | null
  neonatalIcuBeds?: number | null
  deliveryBeds?: number | null
  operatingBeds?: number | null
  emergencyBeds?: number | null
  physicalTherapyBeds?: number | null
  psychClosedUpper?: number | null
  psychClosedNormal?: number | null
  psychOpenUpper?: number | null
  psychOpenNormal?: number | null
  isolationBeds?: number | null
  sterileBeds?: number | null
  specialtyField?: string | null
  departments?: HospitalDepartment[]
  equipment?: { eqpCdNm: string; eqpCnt: number | null }[]
}

export interface PharmacyDetails {
  phone?: string | null
  dutyTel3?: string | null
  hpid?: string | null
  postCdn1?: string | null
  postCdn2?: string | null
  dutyTime1s?: string | null
  dutyTime1c?: string | null
  dutyTime2s?: string | null
  dutyTime2c?: string | null
  dutyTime3s?: string | null
  dutyTime3c?: string | null
  dutyTime4s?: string | null
  dutyTime4c?: string | null
  dutyTime5s?: string | null
  dutyTime5c?: string | null
  dutyTime6s?: string | null
  dutyTime6c?: string | null
  dutyTime7s?: string | null
  dutyTime7c?: string | null
  dutyTime8s?: string | null
  dutyTime8c?: string | null
  dutyMapimg?: string | null
  dutyInf?: string | null
  dutyEtc?: string | null
  dataDate?: string | null
  // HIRA xlsx 보강 (파일 4, 12)
  ykiho?: string | null
  pharmacistCnt?: number | null
  lunchWeek?: string | null
  lunchSat?: string | null
  noTrmtSun?: string | null
  noTrmtHoli?: string | null
  recpWeek?: string | null
  recpSat?: string | null
}

export interface ParkDetails {
  parkType?: string | null
  area?: number | null
  exerciseFacilities?: string | null
  playFacilities?: string | null
  convenienceFacilities?: string | null
  cultureFacilities?: string | null
  otherFacilities?: string | null
  designatedDate?: string | null
  managingOrg?: string | null
  phoneNumber?: string | null
  dataDate?: string | null
  providerCode?: string | null
  providerName?: string | null
}

export interface SchoolEnrollment {
  grade: number
  classCount?: number | null
}

export interface SchoolDepartmentInfo {
  departmentName: string
  dgsbjtCdNm?: string
  dgsbjtPrSdrCnt?: number | null
}

export interface SchoolDetails {
  schoolLevel?: string | null
  foundedDate?: string | null
  foundationType?: string | null
  branchType?: string | null
  operationStatus?: string | null
  sidoEduCode?: string | null
  sidoEduName?: string | null
  localEduCode?: string | null
  localEduName?: string | null
  createdDate?: string | null
  modifiedDate?: string | null
  dataDate?: string | null
  providerCode?: string | null
  providerName?: string | null
  // NEIS 추가 필드
  neisEduCode?: string | null
  phoneNumber?: string | null
  faxNumber?: string | null
  homepageUrl?: string | null
  coeducationType?: string | null
  highSchoolType?: string | null
  dayNightType?: string | null
  enrollments?: SchoolEnrollment[]
  departments?: SchoolDepartmentInfo[]
}

export interface MarketDetails {
  marketType?: string | null
  openingCycle?: string | null
  storeCount?: number | null
  products?: string | null
  giftCertificates?: string | null
  homepageUrl?: string | null
  hasPublicToilet?: boolean | null
  hasParking?: boolean | null
  foundedYear?: number | null
  phoneNumber?: string | null
  dataDate?: string | null
  providerCode?: string | null
  providerName?: string | null
}

export interface ChildcareDetails {
  sidoname?: string
  sigunname?: string
  crtypename?: string
  crstatusname?: string
  zipcode?: string
  crtelno?: string
  crfaxno?: string
  crhome?: string
  nrtrroomcnt?: number
  nrtrroomsize?: string
  plgrdco?: number
  cctvinstlcnt?: number
  chcrtescnt?: number
  crcapat?: number
  crchcnt?: number
  crcargbname?: string
  crcnfmdt?: string
  crpausebegindt?: string
  crpauseenddt?: string
  crabldt?: string
  datastdrdt?: string
  crspec?: string
  crrepname?: string
  // 반별 정원
  classCnt00?: number
  classCnt01?: number
  classCnt02?: number
  classCnt03?: number
  classCnt04?: number
  classCnt05?: number
  classCntM2?: number
  classCntM5?: number
  classCntSp?: number
  classCntTot?: number
  // 아동별 현원
  childCnt00?: number
  childCnt01?: number
  childCnt02?: number
  childCnt03?: number
  childCnt04?: number
  childCnt05?: number
  childCntM2?: number
  childCntM5?: number
  childCntSp?: number
  childCntTot?: number
  // 직원 현황 (경력별)
  emCnt0y?: number
  emCnt1y?: number
  emCnt2y?: number
  emCnt4y?: number
  emCnt6y?: number
  // 직원 현황 (직종별)
  emCntA1?: number   // 원장
  emCntA2?: number   // 보육교사
  emCntA3?: number   // 특수교사
  emCntA4?: number   // 치료사
  emCntA5?: number   // 영양사
  emCntA6?: number   // 간호사(조무사)
  emCntA10?: number  // 조리원
  emCntA7?: number   // 사무원
  emCntA8?: number   // 기타
  emCntTot?: number  // 직원 총수
  // 기타 직원
  ewCnt00?: number
  ewCnt01?: number
  ewCnt02?: number
  ewCnt03?: number
  ewCnt04?: number
  ewCnt05?: number
  ewCntM6?: number
  ewCntTot?: number
}

export interface EvChargerItem {
  chgerId?: string
  chgerType?: string
  output?: string
  stat?: string
  statUpdDt?: string
  method?: string
  maker?: string
}

export interface EvChargerDetails {
  statId?: string
  useTime?: string
  busiNm?: string
  busiCall?: string
  parkingFree?: string
  limitYn?: string
  limitDetail?: string
  location?: string
  addrDetail?: string
  note?: string
  year?: string
  chargers?: EvChargerItem[]
}

export interface SportsDetails {
  faciNm?: string
  faciGbNm?: string
  fcobNm?: string
  ftypeNm?: string
  fmngCpNm?: string
  fmngCpbNm?: string
  faciRoadAddr?: string
  faciGfa?: string
  standCptPsnCnt?: number
  faciHomepage?: string
  faciStatCd?: string
  addrCtpvNm?: string
  addrCpbNm?: string
  addrEmdNm?: string
  nationYn?: string
  fmngTypeGbNm?: string
  delYn?: string
}

// 카테고리 그룹 (헤더, 홈페이지 등에서 공유)
export interface CategoryGroup {
  title: string
  icon: string
  categories: FacilityCategory[]
}

/**
 * GNB 드롭다운 링크 그룹 (부동산·청약/임대·공매).
 *
 * 아이콘 필드가 없다. GNB 는 텍스트온리이고(신뢰 디자인 #577 에서 내린 결정),
 * AppHeader 는 링크의 label 만 렌더한다. AppHeader.test.ts 가
 * `img[src*="/icons/category/"]` 개수를 0 으로 단언해 아이콘 복귀를 막고 있다.
 * 종전에는 icon/iconImg 를 들고 다녔지만 어느 소비처도 읽지 않는 죽은 데이터였다.
 * 아이콘을 다시 넣으려면 그 결정과 테스트부터 뒤집어야 한다.
 *
 * CategoryGroup 의 icon 은 별개다 — faq.vue 가 실제로 렌더하므로 그대로 있다.
 */
export interface LinkGroup {
  title: string
  links: Array<{ to: string; label: string; section?: string }>
}

// 네비게이션 그룹 = 기존 카테고리 그룹 | 링크 그룹
export type NavGroup = CategoryGroup | LinkGroup

// 타입 가드
export function isLinkGroup(group: NavGroup): group is LinkGroup {
  return 'links' in group
}

export const CATEGORY_GROUPS: readonly CategoryGroup[] = [
  {
    title: '교육/육아',
    icon: 'local_library',
    categories: ['school', 'childcare', 'library'],
  },
  {
    title: '건강/안전',
    icon: 'health_and_safety',
    categories: ['hospital', 'pharmacy', 'sports', 'aed'],
  },
  {
    title: '생활/편의',
    icon: 'home',
    categories: ['park', 'market', 'parking', 'ev-charger', 'subway', 'toilet'],
  },
  {
    title: '환경/생활',
    icon: 'eco',
    categories: ['clothes', 'trash'],
  },
] as const

// 지역×카테고리(/[city]/[district]/[category]) 페이지가 없는 카테고리.
// subway 는 역(station) 그룹 단위라 지역 목록 라우트가 없고(/[city]/[district]/subway → 404),
// 허브 /subway·상세 /subway/[id] 만 존재한다. 지역 스코프 링크 생성 시 제외한다.
export const NON_REGION_CATEGORIES: readonly string[] = ['subway']

// 개별 드롭다운으로 남는 링크 그룹 (부동산, 청약·임대)
export const NAV_LINK_GROUPS: readonly LinkGroup[] = [
  {
    title: '부동산',
    links: [
      // '부동산 전체' 였다. /real-estate 가 목록 허브에서 지도 탐색기로 바뀌면서 '전체'가
      // 내용과 어긋났고, 그룹명이 이미 '부동산' 이라 접두어도 중복이었다. 페이지 자신의
      // title('부동산 실거래가 지도')과 맞춘다. 형제 항목은 전부 매물 유형이라 이 항목만
      // 성격이 다르다는 점도 라벨로 드러난다.
      { to: '/real-estate', label: '실거래가 지도' },
      { to: '/real-estate/apt-sale', label: '아파트' },
      { to: '/real-estate/villa-sale', label: '빌라' },
      { to: '/real-estate/offitel-sale', label: '오피스텔' },
      { to: '/real-estate/land', label: '토지' },
    ],
  },
  {
    title: '청약·임대',
    links: [
      // 청약홈 — 모든 청약(분양+임대) 최상위 hub. 섹션 없음(헤더 역할).
      { to: '/subscription', label: '청약홈' },
      { to: '/subscription/sale/apt', label: '아파트 분양', section: '분양' },
      { to: '/subscription/sale/offitel', label: '오피스텔·도시형', section: '분양' },
      { to: '/subscription/sale/remaining', label: '무순위·잔여세대', section: '분양' },
      { to: '/subscription/sale/optional', label: '임의공급', section: '분양' },
      // 임대 청약 — 청약통장 사용
      { to: '/subscription/rent/public', label: '공공임대 청약', section: '임대 청약' },
      { to: '/subscription/rent/private', label: '공공지원 민간임대', section: '임대 청약' },
    ],
  },
  {
    title: '공매',
    links: [
      { to: '/auction', label: '공매 홈' },
      { to: '/auction/list?usage=residential', label: '아파트·주거용' },
      { to: '/auction/list?usage=land', label: '토지' },
      { to: '/auction/list?usage=commercial', label: '상가·업무' },
      { to: '/auction/list?usage=industrial', label: '공장·창고' },
      { to: '/auction/ranking', label: '낙찰가율 랭킹' },
      { to: '/auction/list', label: '전체 물건' },
    ],
  },
] as const

export const NAV_GROUPS: readonly NavGroup[] = [
  ...NAV_LINK_GROUPS,
  ...CATEGORY_GROUPS,
] as const

// 검색 파라미터
export interface SearchParams {
  keyword?: string
  category?: FacilityCategory
  lat?: number
  lng?: number
  radius?: number
  swLat?: number
  swLng?: number
  neLat?: number
  neLng?: number
  city?: string
  district?: string
  page?: number
  limit?: number
  grouped?: boolean
  sort?: string
  departments?: string[]
}

// 검색 응답
export interface SearchResponse {
  items: Facility[]
  total: number
  page: number
  totalPages: number
}

// 그룹별 검색 응답
export interface GroupedCategory {
  category: FacilityCategory
  label: string
  count: number
  items: Facility[]
}

export interface GroupedSearchResponse {
  categories: GroupedCategory[]
  totalCount: number
}

// API 응답
export interface ApiResponse<T> {
  success: boolean
  data: T
  error?: {
    code: string
    message: string
  }
}

// 카테고리 메타데이터
export interface CategoryMeta {
  label: string
  shortLabel: string
  icon: string
  color: string
}

export const CATEGORY_META: Record<FacilityCategory, CategoryMeta> = {
  toilet: {
    label: '공공화장실',
    shortLabel: '화장실',
    icon: 'wc',
    color: 'blue',
  },
  trash: {
    label: '쓰레기 배출정보',
    shortLabel: '쓰레기 배출정보',
    icon: 'delete',
    color: 'red',
  },
  wifi: {
    label: '무료와이파이',
    shortLabel: '와이파이',
    icon: 'wifi',
    color: 'green',
  },
  clothes: {
    label: '의류수거함',
    shortLabel: '의류수거함',
    icon: 'checkroom',
    color: 'purple',
  },
  parking: {
    label: '공영주차장',
    shortLabel: '주차장',
    icon: 'local_parking',
    color: 'sky',
  },
  aed: {
    label: '자동심장충격기',
    shortLabel: 'AED',
    icon: 'favorite',
    color: 'red',
  },
  library: {
    label: '공공도서관',
    shortLabel: '도서관',
    icon: 'local_library',
    color: 'amber',
  },
  hospital: {
    label: '병원',
    shortLabel: '병원',
    icon: 'local_hospital',
    color: 'teal',
  },
  pharmacy: {
    label: '약국',
    shortLabel: '약국',
    icon: 'local_pharmacy',
    color: 'emerald',
  },
  park: {
    label: '공원',
    shortLabel: '공원',
    icon: 'park',
    color: 'green',
  },
  school: {
    label: '학교',
    shortLabel: '학교',
    icon: 'school',
    color: 'indigo',
  },
  market: {
    label: '전통시장',
    shortLabel: '전통시장',
    icon: 'storefront',
    color: 'orange',
  },
  childcare: {
    label: '어린이집',
    shortLabel: '어린이집',
    icon: 'child_care',
    color: 'pink',
  },
  'ev-charger': {
    label: '전기차 충전소',
    shortLabel: '전기차 충전소',
    icon: 'ev_station',
    color: 'teal',
  },
  sports: {
    label: '체육시설',
    shortLabel: '체육시설',
    icon: 'sports',
    color: 'cyan',
  },
  subway: {
    label: '지하철역',
    shortLabel: '지하철',
    icon: 'subway',
    color: 'slate',
  },
}

// 카테고리별 공공데이터포털 URL 매핑
export const CATEGORY_DATA_PORTAL_URL: Record<FacilityCategory, string> = {
  toilet: 'https://www.data.go.kr/data/15012892/standard.do',
  trash: 'https://www.data.go.kr/data/15155080/openapi.do',
  wifi: 'https://www.data.go.kr/data/15013116/standard.do',
  clothes: 'https://www.data.go.kr/data/15139214/standard.do',
  parking: 'https://www.data.go.kr/data/15012896/standard.do',
  aed: 'https://www.data.go.kr/data/15000652/openapi.do',
  library: 'https://www.data.go.kr/data/15013109/standard.do',
  hospital: 'https://www.data.go.kr/data/15001698/openapi.do',
  pharmacy: 'https://www.data.go.kr/data/15000576/openapi.do',
  park: 'https://www.data.go.kr/data/15012900/standard.do',
  school: 'https://www.data.go.kr/data/15021148/standard.do',
  market: 'https://www.data.go.kr/data/15012874/standard.do',
  childcare: 'https://info.childcare.go.kr/',
  'ev-charger': 'https://www.data.go.kr/data/15076352/openapi.do',
  subway: 'https://www.data.go.kr/data/15013205/standard.do',
  sports: 'https://www.data.go.kr/data/15107764/openapi.do',
}

// ============================================
// API 공통 타입
// ============================================

/**
 * 페이지네이션 요청 파라미터
 */
export interface PaginationParams {
  page?: number
  limit?: number
}

/**
 * 페이지네이션 응답
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  totalPages: number
}

/**
 * API 에러 상세
 */
export interface ApiErrorDetail {
  code: string
  message: string
  details?: unknown
}

/**
 * 헬스체크 응답
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error'
  timestamp: string
  uptime: number
}

// ============================================
// 카테고리 타입
// ============================================

/**
 * 카테고리 정보
 */
export interface CategoryInfo {
  id: string
  name: string
  icon: string
  description: string | null
  sortOrder: number
  isActive: boolean
}

/**
 * 카테고리별 시설 수
 */
export interface CategoryCount {
  category: string
  count: number
}

// ============================================
// 지역 타입
// ============================================

/**
 * 지역 정보
 */
export interface RegionInfo {
  id: number
  bjdCode: string
  city: string
  district: string
  slug: string
  lat: number
  lng: number
}

/**
 * 시/도 정보
 */
export interface CityInfo {
  city: string
  districtCount: number
}

/**
 * 구/군 정보
 */
export interface DistrictInfo {
  district: string
  slug: string
  lat: number
  lng: number
}

// ============================================
// 쓰레기 배출 관련 타입
// ============================================

export interface TrashDetails {
  trashType?: string | null
  collectionDays?: string[] | null
  collectionStartTime?: string | null
  collectionEndTime?: string | null
  disposalMethod?: string | null
  notes?: string | null
}

// Vue 템플릿용 - 모든 상세 타입의 프로퍼티를 optional로 통합
// 런타임 안전성은 템플릿의 v-if 카테고리 가드가 보장
export type FacilityDetailsAll = ToiletDetails & WifiDetails & ClothesDetails & ParkingDetails & AedDetails & LibraryDetails & HospitalDetails & PharmacyDetails & TrashDetails & ParkDetails & SchoolDetails & MarketDetails & ChildcareDetails & EvChargerDetails & SportsDetails
