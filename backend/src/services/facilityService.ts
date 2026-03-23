// @TASK T1.1, T1.2, T1.3 - 시설 검색, 상세 조회, 지역별 조회 서비스
// @SPEC docs/planning/02-trd.md#API-설계

import prisma from '../lib/prisma.js';
import { FacilitySearchInput } from '../schemas/facility.js';
import { PAGINATION, SEARCH_DEFAULTS } from '../constants/index.js';

// 카테고리 타입
export type FacilityCategory = 'toilet' | 'wifi' | 'clothes' | 'parking' | 'aed' | 'library' | 'hospital' | 'pharmacy' | 'park' | 'school' | 'market' | 'childcare' | 'ev-charger' | 'sports';

const ALL_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market', 'childcare', 'ev-charger', 'sports'];

// 정렬 옵션 매핑
const ORDER_BY_MAP: Record<string, Record<string, string>> = {
  name: { name: 'asc' },
  latest: { updatedAt: 'desc' },
  popular: { viewCount: 'desc' },
};

// --- Haversine 거리 계산 ---

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- Category Registry ---

interface CategoryConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: () => any;
  listFields: string[];
  detailFields: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const CATEGORY_REGISTRY: Record<FacilityCategory, CategoryConfig> = {
  toilet: {
    model: () => prisma.toilet,
    listFields: ['operatingHours', 'hasDisabledToilet'],
    detailFields: ['operatingHours', 'maleToilets', 'maleUrinals', 'femaleToilets', 'hasDisabledToilet', 'openTime', 'managingOrg', 'phoneNumber', 'installDate', 'ownershipType', 'sewageTreatment', 'hasEmergencyBell', 'emergencyBellLocation', 'hasCCTV', 'hasDiaperChangingTable', 'diaperChangingLocation', 'maleDisabledToilets', 'maleDisabledUrinals', 'maleChildToilets', 'maleChildUrinals', 'femaleDisabledToilets', 'femaleChildToilets', 'remodelingDate', 'facilityType', 'legalBasis', 'govCode', 'dataDate'],
  },
  wifi: {
    model: () => prisma.wifi,
    listFields: ['ssid', 'installLocation'],
    detailFields: ['ssid', 'installDate', 'serviceProvider', 'installLocation', 'managementAgency', 'phoneNumber', 'installLocationDetail', 'govCode', 'dataDate'],
  },
  clothes: {
    model: () => prisma.clothes,
    listFields: ['detailLocation'],
    detailFields: ['managementAgency', 'phoneNumber', 'dataDate', 'detailLocation', 'providerCode', 'providerName'],
  },
  parking: {
    model: () => prisma.parking,
    listFields: ['capacity', 'baseFee', 'feeType'],
    detailFields: ['parkingType', 'lotType', 'capacity', 'baseFee', 'baseTime', 'additionalFee', 'additionalTime', 'dailyMaxFee', 'monthlyFee', 'operatingHours', 'phone', 'paymentMethod', 'remarks', 'hasDisabledParking', 'zoneClass', 'alternateParking', 'operatingDays', 'feeType', 'dailyMaxFeeHours', 'managingOrg', 'dataDate', 'providerCode', 'providerName'],
  },
  aed: {
    model: () => prisma.aed,
    listFields: ['buildPlace', 'org'],
    detailFields: ['buildPlace', 'org', 'clerkTel', 'mfg', 'model', 'monSttTme', 'monEndTme', 'tueSttTme', 'tueEndTme', 'wedSttTme', 'wedEndTme', 'thuSttTme', 'thuEndTme', 'friSttTme', 'friEndTme', 'satSttTme', 'satEndTme', 'sunSttTme', 'sunEndTme', 'holSttTme', 'holEndTme', 'dataDate'],
  },
  library: {
    model: () => prisma.library,
    listFields: ['weekdayOpenTime', 'weekdayCloseTime', 'seatCount'],
    detailFields: ['libraryType', 'closedDays', 'weekdayOpenTime', 'weekdayCloseTime', 'saturdayOpenTime', 'saturdayCloseTime', 'holidayOpenTime', 'holidayCloseTime', 'seatCount', 'bookCount', 'serialCount', 'nonBookCount', 'loanableBooks', 'loanableDays', 'phoneNumber', 'homepageUrl', 'operatingOrg', 'lotArea', 'buildingArea', 'dataDate', 'providerCode', 'providerName'],
  },
  hospital: {
    model: () => prisma.hospital,
    listFields: ['clCdNm', 'phone', 'drTotCnt',
      'trmtMonStart', 'trmtMonEnd', 'trmtTueStart', 'trmtTueEnd',
      'trmtWedStart', 'trmtWedEnd', 'trmtThuStart', 'trmtThuEnd',
      'trmtFriStart', 'trmtFriEnd', 'trmtSatStart', 'trmtSatEnd',
      'trmtSunStart', 'trmtSunEnd', 'lunchWeek', 'noTrmtSun', 'noTrmtHoli'],
    detailFields: ['phone', 'homepage', 'postNo', 'estbDd', 'ykiho', 'clCd', 'clCdNm', 'sidoCd', 'sgguCd', 'emdongNm', 'drTotCnt', 'mdeptSdrCnt', 'mdeptGdrCnt', 'mdeptIntnCnt', 'mdeptResdntCnt', 'detySdrCnt', 'detyGdrCnt', 'detyIntnCnt', 'detyResdntCnt', 'cmdcSdrCnt', 'cmdcGdrCnt', 'cmdcIntnCnt', 'cmdcResdntCnt', 'pnursCnt', 'dataDate', 'trmtMonStart', 'trmtMonEnd', 'trmtTueStart', 'trmtTueEnd', 'trmtWedStart', 'trmtWedEnd', 'trmtThuStart', 'trmtThuEnd', 'trmtFriStart', 'trmtFriEnd', 'trmtSatStart', 'trmtSatEnd', 'trmtSunStart', 'trmtSunEnd', 'lunchWeek', 'lunchSat', 'noTrmtSun', 'noTrmtHoli', 'parkQty', 'parkEtc', 'detailSyncedAt'],
  },
  pharmacy: {
    model: () => prisma.pharmacy,
    listFields: ['phone', 'dutyTime1s', 'dutyTime1c'],
    detailFields: ['phone', 'dutyTel3', 'hpid', 'postCdn1', 'postCdn2', 'dutyTime1s', 'dutyTime1c', 'dutyTime2s', 'dutyTime2c', 'dutyTime3s', 'dutyTime3c', 'dutyTime4s', 'dutyTime4c', 'dutyTime5s', 'dutyTime5c', 'dutyTime6s', 'dutyTime6c', 'dutyTime7s', 'dutyTime7c', 'dutyTime8s', 'dutyTime8c', 'dutyMapimg', 'dutyInf', 'dutyEtc', 'dataDate'],
  },
  park: {
    model: () => prisma.park,
    listFields: ['parkType', 'area'],
    detailFields: ['parkType', 'area', 'exerciseFacilities', 'playFacilities', 'convenienceFacilities', 'cultureFacilities', 'otherFacilities', 'designatedDate', 'managingOrg', 'phoneNumber', 'dataDate', 'providerCode', 'providerName'],
  },
  school: {
    model: () => prisma.school,
    listFields: ['schoolLevel', 'operationStatus', 'phoneNumber', 'coeducationType', 'highSchoolType'],
    detailFields: ['schoolLevel', 'foundedDate', 'foundationType', 'branchType', 'operationStatus', 'sidoEduCode', 'sidoEduName', 'localEduCode', 'localEduName', 'createdDate', 'modifiedDate', 'dataDate', 'providerCode', 'providerName', 'neisEduCode', 'phoneNumber', 'faxNumber', 'homepageUrl', 'coeducationType', 'highSchoolType', 'dayNightType'],
  },
  market: {
    model: () => prisma.market,
    listFields: ['marketType', 'storeCount'],
    detailFields: ['marketType', 'openingCycle', 'storeCount', 'products', 'giftCertificates', 'homepageUrl', 'hasPublicToilet', 'hasParking', 'foundedYear', 'phoneNumber', 'dataDate', 'providerCode', 'providerName'],
  },
  childcare: {
    model: () => prisma.childcare,
    listFields: ['crtypename', 'crcapat', 'crchcnt'],
    detailFields: ['crtypename', 'crstatusname', 'zipcode', 'crtelno', 'crfaxno', 'crhome', 'crrepname', 'nrtrroomcnt', 'nrtrroomsize', 'plgrdco', 'cctvinstlcnt', 'chcrtescnt', 'crcapat', 'crchcnt', 'crcargbname', 'crcnfmdt', 'crpausebegindt', 'crpauseenddt', 'crabldt', 'datastdrdt', 'crspec', 'classCnt00', 'classCnt01', 'classCnt02', 'classCnt03', 'classCnt04', 'classCnt05', 'classCntM2', 'classCntM5', 'classCntSp', 'classCntTot', 'childCnt00', 'childCnt01', 'childCnt02', 'childCnt03', 'childCnt04', 'childCnt05', 'childCntM2', 'childCntM5', 'childCntSp', 'childCntTot', 'emCnt0y', 'emCnt1y', 'emCnt2y', 'emCnt4y', 'emCnt6y', 'emCntA1', 'emCntA2', 'emCntA3', 'emCntA4', 'emCntA5', 'emCntA6', 'emCntA10', 'emCntA7', 'emCntA8', 'emCntTot', 'ewCnt00', 'ewCnt01', 'ewCnt02', 'ewCnt03', 'ewCnt04', 'ewCnt05', 'ewCntM6', 'ewCntTot'],
  },
  'ev-charger': {
    model: () => prisma.evCharger,
    listFields: ['chgerType', 'output', 'busiNm', 'stat'],
    detailFields: ['statId', 'chgerId', 'chgerType', 'addrDetail', 'location', 'useTime', 'busiId', 'bnm', 'busiNm', 'busiCall', 'stat', 'statUpdDt', 'lastTsdt', 'lastTedt', 'nowTsdt', 'powerType', 'output', 'method', 'zcode', 'zscode', 'kind', 'kindDetail', 'parkingFree', 'note', 'limitYn', 'limitDetail', 'delYn', 'delDetail', 'trafficYn', 'year', 'floorNum', 'floorType', 'maker'],
  },
  sports: {
    model: () => prisma.sports,
    listFields: ['ftypeNm', 'fcobNm', 'faciGbNm'],
    detailFields: ['faciGbNm', 'fcobNm', 'ftypeNm', 'fmngCpNm', 'fmngCpbNm', 'faciGfa', 'standCptPsnCnt', 'faciHomepage', 'faciStatCd', 'addrCtpvNm', 'addrCpbNm', 'addrEmdNm', 'nationYn', 'fmngTypeGbNm', 'delYn', 'rowNum'],
  },
};

// 기본 select 필드 (공통 필드)
const BASE_SELECT_FIELDS = {
  id: true,
  name: true,
  address: true,
  roadAddress: true,
  lat: true,
  lng: true,
  city: true,
  district: true,
} as const;

/**
 * 카테고리별 리스트 select 필드 생성
 * BASE_SELECT_FIELDS + 카테고리별 listFields
 */
function buildListSelect(category: FacilityCategory): Record<string, boolean> {
  const { listFields } = CATEGORY_REGISTRY[category];
  return {
    ...BASE_SELECT_FIELDS,
    ...Object.fromEntries(listFields.map((f) => [f, true])),
  };
}

// 응답 타입 정의
interface FacilityItem {
  id: string;
  category: FacilityCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  distance?: number;
  extras?: Record<string, unknown>;
}

interface SearchResult {
  items: FacilityItem[];
  total: number;
  page: number;
  totalPages: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFacilityItem(record: any, category: FacilityCategory): FacilityItem {
  const { listFields } = CATEGORY_REGISTRY[category];
  const extras: Record<string, unknown> = {};
  for (const field of listFields) {
    if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
      extras[field] = record[field];
    }
  }

  return {
    id: record.id,
    category,
    name: record.name,
    address: record.address,
    roadAddress: record.roadAddress,
    lat: Number(record.lat) || 0,
    lng: Number(record.lng) || 0,
    city: record.city,
    district: record.district,
    ...(Object.keys(extras).length > 0 ? { extras } : {}),
  };
}

/**
 * 키워드 기반 검색 조건 생성
 */
function buildKeywordFilter(keyword?: string): Record<string, unknown> {
  if (!keyword) return {};
  return {
    OR: [
      { name: { contains: keyword } },
      { address: { contains: keyword } },
      { roadAddress: { contains: keyword } },
    ],
  };
}

/**
 * 지역 필터 조건 생성
 */
function buildRegionFilter(city?: string, district?: string): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (city) {
    // city variants: short(서울) ↔ full(서울특별시) 모두 매칭
    const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
    if (slug) {
      const variants = new Set([city, CITY_SLUG_TO_FULL[slug], CITY_SLUG_TO_SHORT[slug]].filter(Boolean));
      filter.city = variants.size > 1 ? { in: [...variants] } : city;
    } else {
      filter.city = city;
    }
  }
  if (district) filter.district = district;
  return filter;
}

/**
 * bounds 필터 조건 생성
 */
function buildBoundsFilter(swLat: number, swLng: number, neLat: number, neLng: number): { lat: { gte: number; lte: number }; lng: { gte: number; lte: number } } {
  return {
    lat: { gte: swLat, lte: neLat },
    lng: { gte: swLng, lte: neLng },
  };
}

// 그룹별 검색 응답 타입
interface GroupedCategoryResult {
  category: FacilityCategory;
  label: string;
  count: number;
  items: FacilityItem[];
}

interface GroupedSearchResult {
  categories: GroupedCategoryResult[];
  totalCount: number;
}

const CATEGORY_LABELS: Record<FacilityCategory, string> = {
  toilet: '공공화장실',
  wifi: '무료와이파이',
  clothes: '의류수거함',
  parking: '공영주차장',
  aed: '자동심장충격기',
  library: '공공도서관',
  hospital: '병원',
  pharmacy: '약국',
  park: '공원',
  school: '학교',
  market: '전통시장',
  childcare: '어린이집',
  'ev-charger': '전기차충전소',
  sports: '체육시설',
};

// 크로스 카테고리 추천 맵
export const CROSS_CATEGORY_MAP: Record<FacilityCategory, FacilityCategory[]> = {
  toilet: ['park', 'wifi'],
  wifi: ['library', 'park', 'toilet'],
  parking: ['ev-charger', 'toilet', 'market'],
  hospital: ['pharmacy', 'aed'],
  pharmacy: ['hospital', 'childcare'],
  aed: ['hospital', 'pharmacy'],
  library: ['parking', 'wifi', 'park'],
  clothes: ['toilet', 'park'],
  park: ['toilet', 'parking', 'sports'],
  school: ['childcare', 'library', 'park'],
  market: ['parking', 'toilet'],
  childcare: ['school', 'hospital', 'pharmacy', 'park'],
  'ev-charger': ['parking', 'park', 'market', 'library'],
  sports: ['parking', 'park', 'toilet'],
};

// --- EV Charger 충전소 단위 검색 ---

/**
 * ev-charger 충전소(station) 단위 검색 — $queryRaw로 GROUP BY statId
 */
async function evChargerStationSearch(params: {
  keyword?: string; city?: string; district?: string;
  lat?: number; lng?: number; radius?: number;
  swLat?: number; swLng?: number; neLat?: number; neLng?: number;
  page: number; limit: number;
}): Promise<SearchResult> {
  const { keyword, city, district, lat, lng, radius, swLat, swLng, neLat, neLng, page, limit } = params;
  const conditions: string[] = ['statId IS NOT NULL'];
  const values: unknown[] = [];

  if (keyword) {
    conditions.push('(name LIKE ? OR address LIKE ? OR roadAddress LIKE ?)');
    values.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (city) {
    // city variants: short(서울) ↔ full(서울특별시) 모두 매칭
    const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
    if (slug) {
      const full = CITY_SLUG_TO_FULL[slug];
      const short = CITY_SLUG_TO_SHORT[slug];
      const variants = [city, full, short].filter(Boolean);
      const unique = [...new Set(variants)];
      if (unique.length > 1) {
        conditions.push(`city IN (${unique.map(() => '?').join(', ')})`);
        values.push(...unique);
      } else {
        conditions.push('city = ?');
        values.push(city);
      }
    } else {
      conditions.push('city = ?');
      values.push(city);
    }
  }
  if (district) { conditions.push('district = ?'); values.push(district); }

  // 좌표 기반 범위 필터
  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    const radiusKm = radius / 1000;
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(toRad(lat)));
    conditions.push('lat BETWEEN ? AND ?');
    values.push(lat - latDelta, lat + latDelta);
    conditions.push('lng BETWEEN ? AND ?');
    values.push(lng - lngDelta, lng + lngDelta);
  }

  // bounds 기반 필터
  if (swLat !== undefined && swLng !== undefined && neLat !== undefined && neLng !== undefined) {
    conditions.push('lat BETWEEN ? AND ?');
    values.push(swLat, neLat);
    conditions.push('lng BETWEEN ? AND ?');
    values.push(swLng, neLng);
  }

  const whereClause = conditions.join(' AND ');
  const offset = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countResult: any[] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT statId) as cnt FROM EvCharger WHERE ${whereClause}`,
    ...values,
  );
  const total = Number(countResult[0]?.cnt || 0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = await prisma.$queryRawUnsafe(
    `SELECT statId, MIN(name) as name, MIN(address) as address, MIN(roadAddress) as roadAddress,
            MIN(lat) as lat, MIN(lng) as lng, MIN(city) as city, MIN(district) as district,
            COUNT(*) as totalChargers,
            SUM(CASE WHEN CAST(output AS DECIMAL) >= 50 THEN 1 ELSE 0 END) as rapidCount,
            SUM(CASE WHEN CAST(output AS DECIMAL) < 50 THEN 1 ELSE 0 END) as slowCount
     FROM EvCharger WHERE ${whereClause}
     GROUP BY statId ORDER BY name ASC LIMIT ? OFFSET ?`,
    ...values, limit, offset,
  );

  let items: FacilityItem[] = rows.map((r) => ({
    id: r.statId,
    category: 'ev-charger' as FacilityCategory,
    name: r.name || '',
    address: r.address || null,
    roadAddress: r.roadAddress || null,
    lat: Number(r.lat) || 0,
    lng: Number(r.lng) || 0,
    city: r.city || '',
    district: r.district || '',
    extras: {
      totalChargers: Number(r.totalChargers),
      rapidCount: Number(r.rapidCount),
      slowCount: Number(r.slowCount),
    },
  }));

  // 좌표 검색 시 Haversine 거리 계산 + 거리순 정렬
  if (lat !== undefined && lng !== undefined && radius !== undefined) {
    items = items
      .map((item) => ({
        ...item,
        distance: Math.round(haversineDistance(lat, lng, item.lat, item.lng) * 1000),
      }))
      .filter((item) => item.distance! <= radius)
      .sort((a, b) => a.distance! - b.distance!);
    return { items: items.slice(0, limit), total: items.length, page, totalPages: Math.ceil(items.length / limit) };
  }

  return { items, total, page, totalPages: Math.ceil(total / limit) };
}

/**
 * ev-charger 충전소 상세 조회 — statId로 조회, 모든 충전기 포함
 */
async function getEvChargerStationDetail(statId: string): Promise<FacilityDetail | null> {
  const chargers = await prisma.evCharger.findMany({
    where: { statId },
    orderBy: [{ chgerId: 'asc' }],
  });

  if (chargers.length === 0) return null;

  const first = chargers[0];

  // 조회수 증가 (첫 번째 레코드만)
  prisma.evCharger.update({ where: { id: first.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  const chargerList = chargers.map((c) => ({
    chgerId: c.chgerId,
    chgerType: c.chgerType,
    output: c.output,
    stat: c.stat,
    statUpdDt: c.statUpdDt,
    method: c.method,
    maker: c.maker,
  }));

  return {
    id: statId,
    category: 'ev-charger' as FacilityCategory,
    name: first.name,
    address: first.address,
    roadAddress: first.roadAddress,
    lat: Number(first.lat),
    lng: Number(first.lng),
    city: first.city,
    district: first.district,
    bjdCode: first.bjdCode,
    details: {
      statId: first.statId,
      useTime: first.useTime,
      busiNm: first.busiNm,
      busiCall: first.busiCall,
      parkingFree: first.parkingFree,
      limitYn: first.limitYn,
      limitDetail: first.limitDetail,
      location: first.location,
      addrDetail: first.addrDetail,
      note: first.note,
      year: first.year,
      chargers: chargerList,
    },
    sourceId: first.sourceId,
    sourceUrl: first.sourceUrl,
    viewCount: first.viewCount,
    createdAt: first.createdAt,
    updatedAt: first.updatedAt,
    syncedAt: first.syncedAt,
  };
}

/**
 * 크로스 카테고리 주변 시설 조회
 * - 현재 카테고리와 연관된 다른 카테고리 시설을 조회
 * - 거리순 정렬, 최대 6개 반환
 */
export async function getNearbyFacilities(
  category: FacilityCategory,
  lat: number,
  lng: number,
  radius = 1000
): Promise<FacilityItem[]> {
  const targetCategories = CROSS_CATEGORY_MAP[category];
  if (!targetCategories || targetCategories.length === 0) return [];

  const radiusKm = radius / 1000;
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(toRad(lat)));
  const approxBounds = {
    lat: { gte: lat - latDelta, lte: lat + latDelta },
    lng: { gte: lng - lngDelta, lte: lng + lngDelta },
  };

  const fetchResults = await Promise.all(
    targetCategories.map(async (cat) => {
      // ev-charger: 충전소 단위 그룹핑
      if (cat === 'ev-charger') {
        const stationResult = await evChargerStationSearch({
          lat, lng, radius,
          page: 1, limit: 10,
        });
        return stationResult.items;
      }
      const records = await CATEGORY_REGISTRY[cat].model().findMany({
        where: approxBounds,
        select: buildListSelect(cat),
      });
      return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
  );

  const allItems = fetchResults.flat();

  // ev-charger는 이미 거리 계산됨, 나머지만 계산
  return allItems
    .map((item) => item.distance !== undefined ? item : {
      ...item,
      distance: Math.round(haversineDistance(lat, lng, item.lat, item.lng) * 1000),
    })
    .filter((item) => item.distance! <= radius)
    .sort((a, b) => a.distance! - b.distance!)
    .slice(0, 6);
}

/**
 * 카테고리별 그룹핑 검색
 * - 각 카테고리별 건수 + 상위 3건 미리보기 반환
 * - count가 0인 카테고리는 제외
 */
export async function searchGrouped(params: FacilitySearchInput): Promise<GroupedSearchResult> {
  const { keyword, city, district } = params;

  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
  };

  // Phase 1: count만 먼저 — 14개 병렬
  const countResults = await Promise.all(
    ALL_CATEGORIES.map(async (cat) => {
      if (cat === 'ev-charger') {
        const stationResult = await evChargerStationSearch({
          keyword, city, district, page: 1, limit: 3,
        });
        return { category: cat, count: stationResult.total, items: stationResult.items };
      }
      const model = CATEGORY_REGISTRY[cat].model();
      const count = await model.count({ where });
      return { category: cat, count, items: null };
    }),
  );

  // Phase 2: count > 0인 카테고리만 findMany — N개 병렬 (보통 5~8개)
  const results = await Promise.all(
    countResults.map(async (cr) => {
      if (cr.items !== null) {
        // ev-charger: 이미 Phase 1에서 items 포함
        return {
          category: cr.category,
          label: CATEGORY_LABELS[cr.category],
          count: cr.count,
          items: cr.items,
        };
      }
      if (cr.count === 0) {
        return { category: cr.category, label: CATEGORY_LABELS[cr.category], count: 0, items: [] };
      }
      const model = CATEGORY_REGISTRY[cr.category].model();
      const records = await model.findMany({ where, take: 3, select: buildListSelect(cr.category) });
      return {
        category: cr.category,
        label: CATEGORY_LABELS[cr.category],
        count: cr.count,
        items: records.map((r: any) => toFacilityItem(r, cr.category)), // eslint-disable-line @typescript-eslint/no-explicit-any
      };
    }),
  );

  const categories = results.filter((r) => r.count > 0);

  // trash(WasteSchedule) 별도 조회 — 좌표 없는 일정 데이터이므로 ALL_CATEGORIES와 분리
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trashWhere: any = {
    ...buildRegionFilter(city, district),
  };
  if (keyword) {
    trashWhere.OR = [
      { targetRegion: { contains: keyword } },
      { emissionPlace: { contains: keyword } },
    ];
  }
  const [trashCount, trashRecords] = await Promise.all([
    prisma.wasteSchedule.count({ where: trashWhere }),
    prisma.wasteSchedule.findMany({ where: trashWhere, take: 3, orderBy: { targetRegion: 'asc' } }),
  ]);
  if (trashCount > 0) {
    categories.push({
      category: 'trash' as FacilityCategory,
      label: '쓰레기배출',
      count: trashCount,
      items: trashRecords.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
        id: String(r.id),
        category: 'trash' as FacilityCategory,
        name: r.targetRegion || `${r.district} 쓰레기 배출`,
        address: r.emissionPlace || null,
        roadAddress: null,
        lat: 0,
        lng: 0,
        city: r.city,
        district: r.district,
      })),
    });
  }

  const totalCount = categories.reduce((sum, r) => sum + r.count, 0);

  return { categories, totalCount };
}

/**
 * 시설 검색
 * - 좌표 기반 검색 (lat/lng + radius)
 * - bounds 기반 검색 (swLat/swLng/neLat/neLng)
 * - 키워드 검색
 * - 카테고리 필터
 * - 지역 필터
 */
export async function search(params: FacilitySearchInput): Promise<SearchResult> {
  const { category, keyword, lat, lng, radius = SEARCH_DEFAULTS.RADIUS_METERS, swLat, swLng, neLat, neLng, city, district, page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT, sort = 'name' } = params;

  // ev-charger: 충전소 단위 그룹 검색 (모든 검색 유형)
  if (category === 'ev-charger') {
    return evChargerStationSearch({ keyword, city, district, lat, lng, radius, swLat, swLng, neLat, neLng, page, limit });
  }

  // trash: WasteSchedule 별도 처리 (좌표 없는 일정 데이터)
  if (category === 'trash') {
    const skip = (page - 1) * limit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trashWhere: any = { ...buildRegionFilter(city, district) };
    if (keyword) {
      trashWhere.OR = [
        { targetRegion: { contains: keyword } },
        { emissionPlace: { contains: keyword } },
      ];
    }
    const [records, total] = await Promise.all([
      prisma.wasteSchedule.findMany({ where: trashWhere, skip, take: limit, orderBy: { targetRegion: 'asc' } }),
      prisma.wasteSchedule.count({ where: trashWhere }),
    ]);
    const items: FacilityItem[] = records.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      id: String(r.id),
      category: 'trash' as FacilityCategory,
      name: r.targetRegion || `${r.district} 쓰레기 배출`,
      address: r.emissionPlace || null,
      roadAddress: null,
      lat: 0,
      lng: 0,
      city: r.city,
      district: r.district,
    }));
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // --- 좌표 기반 검색: Haversine 거리 계산 ---
  if (lat !== undefined && lng !== undefined) {
    const categories = category ? [category as FacilityCategory] : ALL_CATEGORIES;
    const keywordFilter = buildKeywordFilter(keyword);
    const radiusKm = radius / 1000;

    // 대략적인 위경도 범위로 사전 필터링 (성능 최적화)
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(toRad(lat)));
    const approxBounds = {
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    };

    const allItems: FacilityItem[] = [];

    const fetchResults = await Promise.all(
      categories.map(async (cat) => {
        // ev-charger: 충전소 단위 그룹핑
        if (cat === 'ev-charger') {
          const stationResult = await evChargerStationSearch({
            keyword, lat, lng, radius, swLat, swLng, neLat, neLng,
            page: 1, limit: 100,
          });
          return stationResult.items;
        }
        const where = { ...keywordFilter, ...approxBounds };
        const records = await CATEGORY_REGISTRY[cat].model().findMany({
          where,
          select: buildListSelect(cat),
        });
        return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    );

    for (const items of fetchResults) {
      allItems.push(...items);
    }

    // Haversine으로 정확한 거리 계산 + radius 필터
    // ev-charger는 이미 거리 계산됨, 나머지만 계산
    const withDistance = allItems
      .map((item) => item.distance !== undefined ? item : ({
        ...item,
        distance: Math.round(haversineDistance(lat, lng, item.lat, item.lng) * 1000),
      }))
      .filter((item) => item.distance! <= radius)
      .sort((a, b) => a.distance! - b.distance!);

    const total = withDistance.length;
    const skip = (page - 1) * limit;
    const paged = withDistance.slice(skip, skip + limit);

    return { items: paged, total, page, totalPages: Math.ceil(total / limit) };
  }

  // --- bounds 기반 검색 ---
  if (swLat !== undefined && swLng !== undefined && neLat !== undefined && neLng !== undefined) {
    const categories = category ? [category as FacilityCategory] : ALL_CATEGORIES;
    const keywordFilter = buildKeywordFilter(keyword);
    const boundsFilter = buildBoundsFilter(swLat, swLng, neLat, neLng);

    const allItems: FacilityItem[] = [];

    const fetchResults = await Promise.all(
      categories.map(async (cat) => {
        const where = { ...keywordFilter, ...boundsFilter };
        const records = await CATEGORY_REGISTRY[cat].model().findMany({
          where,
          select: buildListSelect(cat),
        });
        return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    );

    for (const items of fetchResults) {
      allItems.push(...items);
    }

    const total = allItems.length;
    const skip = (page - 1) * limit;
    const paged = allItems.slice(skip, skip + limit);

    return { items: paged, total, page, totalPages: Math.ceil(total / limit) };
  }

  // --- 키워드/지역 기반 검색 (기존 로직) ---
  const skip = (page - 1) * limit;

  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
  };

  // 단일 카테고리: DB skip/take + count
  const orderBy = ORDER_BY_MAP[sort] || ORDER_BY_MAP.name;
  if (category) {
    const model = CATEGORY_REGISTRY[category as FacilityCategory].model();
    const [records, total] = await Promise.all([
      model.findMany({ where, skip, take: limit, orderBy, select: buildListSelect(category as FacilityCategory) }),
      model.count({ where }),
    ]);
    const items = records.map((r: any) => toFacilityItem(r, category as FacilityCategory)); // eslint-disable-line @typescript-eslint/no-explicit-any
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // 전체 카테고리: 카운트 먼저 → 필요한 카테고리만 fetch
  const counts = await Promise.all(
    ALL_CATEGORIES.map((cat) => CATEGORY_REGISTRY[cat].model().count({ where })),
  );
  const total = counts.reduce((sum, c) => sum + c, 0);

  // 어떤 카테고리에서 몇 개씩 가져올지 계산
  const fetchParams: { cat: FacilityCategory; catSkip: number; catTake: number }[] = [];
  let remainingSkip = skip;
  let remainingTake = limit;

  for (let i = 0; i < ALL_CATEGORIES.length && remainingTake > 0; i++) {
    const catCount = counts[i];
    if (remainingSkip >= catCount) {
      remainingSkip -= catCount;
      continue;
    }
    const catSkip = remainingSkip;
    const catTake = Math.min(remainingTake, catCount - catSkip);
    remainingSkip = 0;
    remainingTake -= catTake;
    fetchParams.push({ cat: ALL_CATEGORIES[i], catSkip, catTake });
  }

  // 필요한 카테고리만 병렬 fetch
  const fetchResults = await Promise.all(
    fetchParams.map(async ({ cat, catSkip, catTake }) => {
      const records = await CATEGORY_REGISTRY[cat].model().findMany({
        where,
        skip: catSkip,
        take: catTake,
        orderBy,
        select: buildListSelect(cat),
      });
      return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
  );

  return {
    items: fetchResults.flat(),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// @TASK T1.2 - 시설 상세 조회
// @SPEC docs/planning/02-trd.md#시설-상세-조회

// 상세 조회 응답 타입
interface FacilityDetail {
  id: string;
  category: FacilityCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  bjdCode: string | null;
  details: Record<string, unknown>;
  sourceId: string;
  sourceUrl: string | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
}

/**
 * 레코드를 FacilityDetail로 변환 (레지스트리 기반)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDetail(record: any, category: FacilityCategory): FacilityDetail {
  const { detailFields } = CATEGORY_REGISTRY[category];
  const details: Record<string, unknown> = {};
  for (const field of detailFields) {
    details[field] = record[field];
  }
  // hospital: departments 관계 포함
  if (category === 'hospital' && record.departments) {
    details.departments = record.departments.map((d: { dgsbjtCdNm: string; dgsbjtPrSdrCnt: number | null }) => ({
      dgsbjtCdNm: d.dgsbjtCdNm,
      dgsbjtPrSdrCnt: d.dgsbjtPrSdrCnt,
    }));
  }
  // school: enrollments + departments 관계 포함
  if (category === 'school') {
    if (record.enrollments) {
      details.enrollments = record.enrollments.map((e: { grade: number; classCount: number | null }) => ({
        grade: e.grade,
        classCount: e.classCount,
      }));
    }
    if (record.departments) {
      details.departments = record.departments.map((d: { departmentName: string }) => ({
        departmentName: d.departmentName,
      }));
    }
  }

  return {
    id: record.id,
    category,
    name: record.name,
    address: record.address,
    roadAddress: record.roadAddress,
    lat: Number(record.lat),
    lng: Number(record.lng),
    city: record.city,
    district: record.district,
    bjdCode: record.bjdCode,
    details,
    sourceId: record.sourceId,
    sourceUrl: record.sourceUrl,
    viewCount: record.viewCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncedAt: record.syncedAt,
  };
}

/**
 * 시설 상세 조회
 * - 카테고리와 ID로 시설 조회
 * - 조회 시 viewCount 증가 (비동기, 응답 대기 안함)
 *
 * @param category - 시설 카테고리
 * @param id - 시설 ID
 * @returns 시설 상세 정보 또는 null
 */
export async function getDetail(category: string, id: string): Promise<FacilityDetail | null> {
  const config = CATEGORY_REGISTRY[category as FacilityCategory];
  if (!config) return null;

  // ev-charger: statId로 충전소 단위 조회
  if (category === 'ev-charger') {
    return getEvChargerStationDetail(id);
  }

  const model = config.model();
  const findOptions: { where: { id: string }; include?: Record<string, boolean> } = { where: { id } };
  if (category === 'hospital') {
    findOptions.include = { departments: true };
  }
  if (category === 'school') {
    findOptions.include = { enrollments: true, departments: true };
  }
  const record = await model.findUnique(findOptions);
  if (!record) return null;

  // 조회수 증가 (비동기)
  model.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return toDetail(record, category as FacilityCategory);
}

/**
 * 사이트맵용 전체 ID 조회
 * @param category - 시설 카테고리
 * @returns { id, updatedAt } 배열
 */
export async function getAllIds(
  category: FacilityCategory
): Promise<{ id: string; updatedAt: Date }[]> {
  const config = CATEGORY_REGISTRY[category];
  if (!config) return [];

  // ev-charger: statId 단위로 반환 (충전소 단위 사이트맵)
  if (category === 'ev-charger') {
    const stations = await prisma.evCharger.findMany({
      where: { statId: { not: null } },
      select: { statId: true, updatedAt: true },
      distinct: ['statId'],
    });
    return stations.map((s) => ({ id: s.statId!, updatedAt: s.updatedAt }));
  }

  return config.model().findMany({ select: { id: true, updatedAt: true } });
}

// @TASK T1.3 - 지역별 조회 서비스
// @SPEC docs/planning/02-trd.md#API-설계

// 지역별 조회 결과 타입
interface RegionSearchResult {
  region: {
    city: string;
    district: string;
    bjdCode: string | null;
  };
  category: string;
  items: FacilityItem[];
  total: number;
  page: number;
  totalPages: number;
}

export const CITY_SLUG_TO_FULL: Record<string, string> = {
  seoul: '서울특별시',
  busan: '부산광역시',
  daegu: '대구광역시',
  incheon: '인천광역시',
  gwangju: '광주광역시',
  daejeon: '대전광역시',
  ulsan: '울산광역시',
  sejong: '세종특별자치시',
  gyeonggi: '경기도',
  gangwon: '강원특별자치도',
  chungbuk: '충청북도',
  chungnam: '충청남도',
  jeonbuk: '전북특별자치도',
  jeonnam: '전라남도',
  gyeongbuk: '경상북도',
  gyeongnam: '경상남도',
  jeju: '제주특별자치도',
};

export const CITY_SLUG_TO_SHORT: Record<string, string> = {
  seoul: '서울',
  busan: '부산',
  daegu: '대구',
  incheon: '인천',
  gwangju: '광주',
  daejeon: '대전',
  ulsan: '울산',
  sejong: '세종',
  gyeonggi: '경기',
  gangwon: '강원',
  chungbuk: '충북',
  chungnam: '충남',
  jeonbuk: '전북',
  jeonnam: '전남',
  gyeongbuk: '경북',
  gyeongnam: '경남',
  jeju: '제주',
};

// 역매핑: short name(서울) → slug, full name(서울특별시) → slug
export const SHORT_TO_SLUG = Object.fromEntries(
  Object.entries(CITY_SLUG_TO_SHORT).map(([slug, name]) => [name, slug])
);
const FULL_TO_SLUG = Object.fromEntries(
  Object.entries(CITY_SLUG_TO_FULL).map(([slug, name]) => [name, slug])
);

/**
 * slug 또는 한글 지역명을 실제 지역 정보로 변환
 * @param city - 시/도 (한글 또는 slug)
 * @param district - 구/군 (한글 또는 slug)
 * @returns 해결된 지역 정보
 */
async function resolveRegion(
  city: string,
  district: string
): Promise<{ city: string; district: string; bjdCode: string | null }> {
  const fullCityName = CITY_SLUG_TO_FULL[city];
  const shortCityName = CITY_SLUG_TO_SHORT[city];

  // Region 테이블에서 조회 (city + district 또는 city + slug, slug city도 지원)
  const region = await prisma.region.findFirst({
    where: {
      OR: [
        // 기존 조건 (slug 그대로)
        { city, district },
        { city, slug: district },
        // fullCityName (서울특별시) 조건
        ...(fullCityName
          ? [
              { city: fullCityName, district },
              { city: fullCityName, slug: district },
            ]
          : []),
        // shortCityName (서울) 조건
        ...(shortCityName
          ? [
              { city: shortCityName, district },
              { city: shortCityName, slug: district },
            ]
          : []),
      ],
    },
  });

  if (region) {
    return {
      city: region.city,
      district: region.district,
      bjdCode: region.bjdCode,
    };
  }

  // Region 테이블에 없으면 입력값 그대로 반환
  return {
    city,
    district,
    bjdCode: null,
  };
}

/**
 * 지역별 시설 조회
 * @param city - 시/도 (한글 또는 slug)
 * @param district - 구/군 (한글 또는 slug)
 * @param category - 시설 카테고리
 * @param options - 페이지네이션 옵션
 * @returns 지역별 시설 목록
 */
export async function getByRegion(
  city: string,
  district: string,
  category: string,
  options: { page?: number; limit?: number } = {}
): Promise<RegionSearchResult> {
  const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT } = options;

  // slug -> 한글 변환
  const resolved = await resolveRegion(city, district);

  // 시설 테이블은 '서울특별시', Region 테이블은 '서울'처럼 city 형태가 다를 수 있음
  const cityVariants = [
    resolved.city,
    CITY_SLUG_TO_FULL[city],
    CITY_SLUG_TO_SHORT[city],
  ].filter((v): v is string => !!v && v !== resolved.city);
  const cityCondition = cityVariants.length > 0
    ? { in: [resolved.city, ...cityVariants] }
    : resolved.city;

  const where = {
    city: cityCondition,
    district: resolved.district,
  };

  // trash: WasteSchedule 테이블 조회 (좌표 없는 일정 데이터)
  if (category === 'trash') {
    const cityVariants = [
      resolved.city,
      CITY_SLUG_TO_FULL[city],
      CITY_SLUG_TO_SHORT[city],
    ].filter((v): v is string => !!v);
    const uniqueCities = [...new Set(cityVariants)];

    const wasteWhere = {
      city: uniqueCities.length > 1 ? { in: uniqueCities } : uniqueCities[0],
      district: resolved.district,
    };

    const [records, total] = await Promise.all([
      prisma.wasteSchedule.findMany({
        where: wasteWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ targetRegion: 'asc' }],
      }),
      prisma.wasteSchedule.count({ where: wasteWhere }),
    ]);

    const items = records.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
      id: String(r.id),
      category: 'trash' as FacilityCategory,
      name: r.targetRegion || `${r.district} 쓰레기 배출`,
      address: r.emissionPlace || null,
      roadAddress: null,
      lat: 0,
      lng: 0,
      city: r.city,
      district: r.district,
      extras: r.details ? (r.details as Record<string, unknown>) : undefined,
    }));

    return {
      region: { city: resolved.city, district: resolved.district, bjdCode: resolved.bjdCode },
      category: 'trash',
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ev-charger: 충전소 단위 그룹 검색 (search()와 동일)
  if (category === 'ev-charger') {
    const result = await evChargerStationSearch({
      city: resolved.city,
      district: resolved.district,
      page,
      limit,
    });
    return {
      region: { city: resolved.city, district: resolved.district, bjdCode: resolved.bjdCode },
      category,
      items: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  const config = CATEGORY_REGISTRY[category as FacilityCategory];
  let items: FacilityItem[] = [];
  let total = 0;

  if (config) {
    const model = config.model();
    const [records, count] = await Promise.all([
      model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        select: buildListSelect(category as FacilityCategory),
      }),
      model.count({ where }),
    ]);
    items = records.map((r: any) => toFacilityItem(r, category as FacilityCategory)); // eslint-disable-line @typescript-eslint/no-explicit-any
    total = count;
  }

  return {
    region: {
      city: resolved.city,
      district: resolved.district,
      bjdCode: resolved.bjdCode,
    },
    category,
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 지역별 전체 카테고리 시설 조회
 * - 모든 카테고리의 시설을 합산하여 페이지네이션
 * - search()의 전체-카테고리 페이지네이션 로직 재활용
 */
export async function getByRegionAll(
  city: string,
  district: string,
  options: { page?: number; limit?: number } = {}
): Promise<{
  region: { city: string; district: string; bjdCode: string | null };
  items: FacilityItem[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT } = options;

  const resolved = await resolveRegion(city, district);

  // 시설 테이블은 '서울특별시', Region 테이블은 '서울'처럼 city 형태가 다를 수 있음
  const cityVariants = [
    CITY_SLUG_TO_FULL[city],
    CITY_SLUG_TO_SHORT[city],
  ].filter((v): v is string => !!v && v !== resolved.city);
  const cityCondition = cityVariants.length > 0
    ? { in: [resolved.city, ...cityVariants] }
    : resolved.city;

  const where = {
    city: cityCondition,
    district: resolved.district,
  };

  // 전체 카테고리 카운트 (trash 포함)
  const trashWhere = { city: cityCondition, district: resolved.district };
  const [counts, trashCount] = await Promise.all([
    Promise.all(ALL_CATEGORIES.map((cat) => CATEGORY_REGISTRY[cat].model().count({ where }))),
    prisma.wasteSchedule.count({ where: trashWhere }),
  ]);
  const total = counts.reduce((sum, c) => sum + c, 0) + trashCount;

  // skip/take 계산 → 필요한 카테고리만 병렬 fetch
  const skip = (page - 1) * limit;
  const fetchParams: { cat: FacilityCategory; catSkip: number; catTake: number }[] = [];
  let remainingSkip = skip;
  let remainingTake = limit;

  for (let i = 0; i < ALL_CATEGORIES.length && remainingTake > 0; i++) {
    const catCount = counts[i];
    if (remainingSkip >= catCount) {
      remainingSkip -= catCount;
      continue;
    }
    const catSkip = remainingSkip;
    const catTake = Math.min(remainingTake, catCount - catSkip);
    remainingSkip = 0;
    remainingTake -= catTake;
    fetchParams.push({ cat: ALL_CATEGORIES[i], catSkip, catTake });
  }

  const fetchResults = await Promise.all(
    fetchParams.map(async ({ cat, catSkip, catTake }) => {
      const records = await CATEGORY_REGISTRY[cat].model().findMany({
        where,
        skip: catSkip,
        take: catTake,
        orderBy: { name: 'asc' },
        select: buildListSelect(cat),
      });
      return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
  );

  const allItems = fetchResults.flat();

  // trash(WasteSchedule) 페이지네이션 처리
  if (remainingTake > 0 && trashCount > 0) {
    if (remainingSkip < trashCount) {
      const trashSkip = remainingSkip;
      const trashTake = Math.min(remainingTake, trashCount - trashSkip);
      const trashRecords = await prisma.wasteSchedule.findMany({
        where: trashWhere,
        skip: trashSkip,
        take: trashTake,
        orderBy: { targetRegion: 'asc' },
      });
      allItems.push(
        ...trashRecords.map((r: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          id: String(r.id),
          category: 'trash' as FacilityCategory,
          name: r.targetRegion || `${r.district} 쓰레기 배출`,
          address: r.emissionPlace || null,
          roadAddress: null,
          lat: 0,
          lng: 0,
          city: r.city,
          district: r.district,
        })),
      );
    }
  }

  return {
    region: {
      city: resolved.city,
      district: resolved.district,
      bjdCode: resolved.bjdCode,
    },
    items: allItems,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 시/도별 카테고리별 시설 통계 조회
 * - City Hub 페이지에서 동적 콘텐츠 생성용
 * - district별 total도 포함
 */
export async function getStatsByCity(citySlug: string): Promise<{
  city: string;
  citySlug: string;
  total: number;
  categories: Record<string, number>;
  topCategories: string[];
  districts: Array<{ district: string; total: number }>;
} | null> {
  const fullName = CITY_SLUG_TO_FULL[citySlug];
  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  if (!fullName) return null;

  const cityVariants = [fullName, shortName].filter(Boolean);
  const cityCondition = cityVariants.length > 1 ? { in: cityVariants } : fullName;

  // groupBy district로 일괄 조회 — N+1 제거 (14 categories × 1 groupBy = 14 queries)
  const [categoryGroupResults, trashGroups] = await Promise.all([
    Promise.all(
      ALL_CATEGORIES.map(async (cat) => {
        const groups = await CATEGORY_REGISTRY[cat].model().groupBy({
          by: ['district'],
          where: { city: cityCondition },
          _count: true,
        });
        return { category: cat, groups };
      })
    ),
    prisma.wasteSchedule.groupBy({
      by: ['district'],
      where: { city: cityCondition },
      _count: true,
    }),
  ]);

  // 시 전체 카테고리별 합계 + district별 카테고리 카운트 동시 집계
  const cityCategories: Record<string, number> = {};
  const districtMap = new Map<string, Record<string, number>>();

  for (const { category, groups } of categoryGroupResults) {
    let catTotal = 0;
    for (const g of groups) {
      catTotal += g._count;
      if (g.district) {
        if (!districtMap.has(g.district)) districtMap.set(g.district, {});
        districtMap.get(g.district)![category] = g._count;
      }
    }
    cityCategories[category] = catTotal;
  }

  let trashTotal = 0;
  for (const g of trashGroups) {
    trashTotal += g._count;
    if (g.district) {
      if (!districtMap.has(g.district)) districtMap.set(g.district, {});
      districtMap.get(g.district)!.trash = g._count;
    }
  }
  cityCategories.trash = trashTotal;

  const total = Object.values(cityCategories).reduce((sum, c) => sum + c, 0);

  const topCategories = Object.entries(cityCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat);

  // district별 total
  const districts = [...districtMap.entries()]
    .map(([district, cats]) => ({
      district,
      total: Object.values(cats).reduce((sum, c) => sum + c, 0),
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => a.district.localeCompare(b.district));

  return { city: fullName, citySlug, total, categories: cityCategories, topCategories, districts };
}

/**
 * 시 단위 전체 구/군별 시설 통계 — area 라우트용 (groupBy로 N+1 제거)
 * 기존: 14 categories × 25 districts = 350 COUNT queries
 * 개선: 14 categories × 1 groupBy = 14 GROUP BY queries
 */
export async function getDistrictStatsByCity(citySlug: string): Promise<Map<string, { total: number; categories: Record<string, number>; topCategories: string[] }>> {
  const fullName = CITY_SLUG_TO_FULL[citySlug];
  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  if (!fullName) return new Map();

  const cityVariants = [fullName, shortName].filter(Boolean);
  const cityCondition = cityVariants.length > 1 ? { in: cityVariants } : fullName;

  const [categoryGroupResults, trashGroups] = await Promise.all([
    Promise.all(
      ALL_CATEGORIES.map(async (cat) => {
        const groups = await CATEGORY_REGISTRY[cat].model().groupBy({
          by: ['district'],
          where: { city: cityCondition },
          _count: true,
        });
        return { category: cat, groups };
      })
    ),
    prisma.wasteSchedule.groupBy({
      by: ['district'],
      where: { city: cityCondition },
      _count: true,
    }),
  ]);

  const districtMap = new Map<string, Record<string, number>>();

  for (const { category, groups } of categoryGroupResults) {
    for (const g of groups) {
      if (!g.district) continue;
      if (!districtMap.has(g.district)) districtMap.set(g.district, {});
      districtMap.get(g.district)![category] = g._count;
    }
  }

  for (const g of trashGroups) {
    if (!g.district) continue;
    if (!districtMap.has(g.district)) districtMap.set(g.district, {});
    districtMap.get(g.district)!.trash = g._count;
  }

  const result = new Map<string, { total: number; categories: Record<string, number>; topCategories: string[] }>();

  for (const [district, categories] of districtMap) {
    const total = Object.values(categories).reduce((sum, c) => sum + c, 0);
    const topCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat]) => cat);
    result.set(district, { total, categories, topCategories });
  }

  return result;
}

/**
 * 구/군별 카테고리별 시설 통계 조회
 */
export async function getStatsByDistrict(citySlug: string, districtSlug: string): Promise<{
  total: number;
  categories: Record<string, number>;
  topCategories: string[];
} | null> {
  const fullName = CITY_SLUG_TO_FULL[citySlug];
  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  if (!fullName) return null;

  const cityVariants = [fullName, shortName].filter(Boolean);

  // districtSlug로 district name 조회
  const region = await prisma.region.findFirst({
    where: { city: { in: cityVariants }, slug: districtSlug },
    select: { district: true },
  });
  if (!region) return null;

  const cityCondition = cityVariants.length > 1 ? { in: cityVariants } : fullName;
  const where = { city: cityCondition, district: region.district };

  const [categoryCounts, trashCount] = await Promise.all([
    Promise.all(
      ALL_CATEGORIES.map(async (cat) => ({
        category: cat,
        count: await CATEGORY_REGISTRY[cat].model().count({ where }),
      }))
    ),
    prisma.wasteSchedule.count({ where }),
  ]);

  const categories: Record<string, number> = {};
  for (const { category, count } of categoryCounts) {
    categories[category] = count;
  }
  categories.trash = trashCount;

  const total = Object.values(categories).reduce((sum, c) => sum + c, 0);

  const topCategories = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat);

  return { total, categories, topCategories };
}

/**
 * 사이트맵용: 실제 데이터가 있는 지역-카테고리 조합 조회
 */
/**
 * 카테고리별 최신 동기화 완료 시간 조회
 */
export async function getSyncStatus(): Promise<Record<string, string | null>> {
  const categories = [...ALL_CATEGORIES, 'trash'] as const;

  const results = await Promise.all(
    categories.map(async (cat) => {
      const record = await prisma.syncHistory.findFirst({
        where: { category: cat, status: 'success' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });
      return [cat, record?.completedAt?.toISOString() ?? null] as const;
    }),
  );

  // 부동산 카테고리: SyncHistory 대신 각 테이블의 MAX(syncedAt) 조회
  const realEstateModels = [
    { key: 'aptSale', model: prisma.aptSaleTransaction },
    { key: 'aptRent', model: prisma.aptRentTransaction },
    { key: 'villaSale', model: prisma.villaSaleTransaction },
    { key: 'villaRent', model: prisma.villaRentTransaction },
    { key: 'offitelSale', model: prisma.offitelSaleTransaction },
    { key: 'offitelRent', model: prisma.offitelRentTransaction },
  ] as const;

  const reResults = await Promise.all(
    realEstateModels.map(async ({ key, model }) => {
      const record = await (model as any).findFirst({
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      });
      return [key, record?.syncedAt?.toISOString() ?? null] as const;
    }),
  );

  return Object.fromEntries([...results, ...reResults]);
}

export async function getRegionCategoryCombinations(): Promise<
  Array<{ city: string; district: string; citySlug: string; districtSlug: string; category: string }>
> {
  // Region 테이블에서 slug 조회
  const allRegions = await prisma.region.findMany({
    select: { city: true, district: true, slug: true },
  });

  // district slug lookup: "서울|강남구" -> "gangnam"
  // DB slug에서 잔존하는 -(gu|si|gun) 접미사 정규화 (slug 변경 후 미동기화 대응)
  const SUFFIX_RE = /-(gu|si|gun)$/;
  const regionSlugMap = new Map<string, string>();
  for (const r of allRegions) {
    const normalized = SUFFIX_RE.test(r.slug) ? r.slug.replace(SUFFIX_RE, '') : r.slug;
    regionSlugMap.set(`${r.city}|${r.district}`, normalized);
  }

  // city name -> slug reverse map (서울 -> seoul, 서울특별시 -> seoul)
  const cityToSlug = new Map<string, string>();
  for (const [slug, shortName] of Object.entries(CITY_SLUG_TO_SHORT)) {
    cityToSlug.set(shortName, slug);
  }
  for (const [slug, fullName] of Object.entries(CITY_SLUG_TO_FULL)) {
    cityToSlug.set(fullName, slug);
  }

  const results: Array<{ city: string; district: string; citySlug: string; districtSlug: string; category: string }> = [];

  for (const category of ALL_CATEGORIES) {
    const config = CATEGORY_REGISTRY[category];
    const model = config.model();
    const regions = await model.findMany({
      select: { city: true, district: true },
      distinct: ['city', 'district'],
      where: {
        city: { not: '' },
        district: { not: '' },
      },
    });

    for (const region of regions) {
      const cs = cityToSlug.get(region.city);
      if (!cs) continue;

      // 시설 테이블 city(서울특별시)와 Region 테이블 city(서울) 불일치 대응
      const ds = regionSlugMap.get(`${region.city}|${region.district}`)
        || regionSlugMap.get(`${CITY_SLUG_TO_SHORT[cs]}|${region.district}`);
      if (!ds) continue;

      results.push({
        city: region.city,
        district: region.district,
        citySlug: cs,
        districtSlug: ds,
        category,
      });
    }
  }

  // trash(WasteSchedule) 지역 조합 추가
  const wasteRegions = await prisma.wasteSchedule.findMany({
    select: { city: true, district: true },
    distinct: ['city', 'district'],
    where: {
      city: { not: '' },
      district: { not: '' },
    },
  });

  for (const region of wasteRegions) {
    const cs = cityToSlug.get(region.city);
    if (!cs) continue;

    const ds = regionSlugMap.get(`${region.city}|${region.district}`)
      || regionSlugMap.get(`${CITY_SLUG_TO_SHORT[cs]}|${region.district}`);
    if (!ds) continue;

    results.push({
      city: region.city,
      district: region.district,
      citySlug: cs,
      districtSlug: ds,
      category: 'trash',
    });
  }

  return results;
}
