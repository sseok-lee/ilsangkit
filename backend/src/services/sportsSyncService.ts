import { createHash } from 'crypto';
import { KOREA_BOUNDS } from '../constants/index.js';
import { CITY_NAME_MAP } from './csvParser.js';
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  batchUpsertRaw,
} from './baseSyncService.js';

export { createSyncHistory, updateSyncHistory };
export type { SyncStats, SyncHistoryUpdateData };

const SPORTS_API_URL = 'https://apis.data.go.kr/B551014/SRVC_SFMS_FACIL_INFO/TODZ_SFMS_FACIL_INFO';
const PAGE_SIZE = 1000;

/**
 * API raw item 타입
 */
export interface SportsAPIItem {
  faci_nm?: string;
  faci_gb_nm?: string;
  fcob_nm?: string;
  ftype_nm?: string;
  fmng_cp_nm?: string;
  fmng_cpb_nm?: string;
  faci_road_addr?: string;
  faci_lat?: string | number;
  faci_lot?: string | number;
  faci_gfa?: string | number;
  stand_cpt_psn_cnt?: string | number;
  faci_homepage?: string;
  faci_stat_cd?: string;
  addr_ctpv_nm?: string;
  addr_cpb_nm?: string;
  addr_emd_nm?: string;
  nation_yn?: string;
  fmng_type_gb_nm?: string;
  del_yn?: string;
  row_num?: string | number;
}

/**
 * 변환된 체육시설 데이터 타입
 */
export interface TransformedSports {
  id: string;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  city: string;
  district: string;
  sourceId: string;
  faciGbNm: string | null;
  fcobNm: string | null;
  ftypeNm: string | null;
  fmngCpNm: string | null;
  fmngCpbNm: string | null;
  faciGfa: number | null;
  standCptPsnCnt: number | null;
  faciHomepage: string | null;
  faciStatCd: string | null;
  addrCtpvNm: string | null;
  addrCpbNm: string | null;
  addrEmdNm: string | null;
  nationYn: string | null;
  fmngTypeGbNm: string | null;
  delYn: string | null;
  rowNum: number | null;
}

/**
 * 빈 문자열 또는 undefined를 null로 변환
 */
function toStringOrNull(val: string | number | undefined | null): string | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

/**
 * 정수 변환 (빈 문자열 → null)
 */
function toIntOrNull(val: string | number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/**
 * 실수 변환 (빈 문자열 → null)
 */
function toFloatOrNull(val: string | number | undefined | null): number | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * 좌표 변환 및 한국 범위 검증
 */
function toValidCoord(
  latVal: string | number | undefined,
  lngVal: string | number | undefined
): { lat: number | null; lng: number | null } {
  const latStr = String(latVal ?? '').trim();
  const lngStr = String(lngVal ?? '').trim();

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (
    isNaN(lat) || isNaN(lng) ||
    lat < KOREA_BOUNDS.LAT_MIN || lat > KOREA_BOUNDS.LAT_MAX ||
    lng < KOREA_BOUNDS.LNG_MIN || lng > KOREA_BOUNDS.LNG_MAX
  ) {
    return { lat: null, lng: null };
  }

  return { lat, lng };
}

/**
 * MD5 sourceId 생성 (faci_nm + faci_road_addr)
 */
function generateSourceId(faciNm: string, faciRoadAddr: string): string {
  return createHash('md5')
    .update(`${faciNm}${faciRoadAddr}`)
    .digest('hex')
    .substring(0, 16);
}

/**
 * API item → TransformedSports 변환
 */
export function transformSportsItem(item: SportsAPIItem): TransformedSports | null {
  const name = toStringOrNull(item.faci_nm);
  if (!name) return null;

  // del_yn='Y' → 삭제된 시설은 건너뜀
  const delYn = toStringOrNull(item.del_yn);
  if (delYn === 'Y') return null;

  const faciRoadAddr = toStringOrNull(item.faci_road_addr) ?? '';
  const sourceId = generateSourceId(name, faciRoadAddr);

  // city/district: addr_ctpv_nm, addr_cpb_nm 우선 사용 (더 신뢰성 높음)
  const rawCity = toStringOrNull(item.addr_ctpv_nm) ?? '';
  const district = toStringOrNull(item.addr_cpb_nm) ?? '';

  if (!rawCity || !district) return null;

  // 시도명 정규화 (서울특별시 → 서울)
  const city = CITY_NAME_MAP[rawCity] || rawCity;

  const { lat, lng } = toValidCoord(item.faci_lat, item.faci_lot);

  return {
    id: `sports-${sourceId}`,
    name,
    address: faciRoadAddr || null,
    roadAddress: faciRoadAddr || null,
    lat,
    lng,
    city,
    district,
    sourceId,
    faciGbNm: toStringOrNull(item.faci_gb_nm),
    fcobNm: toStringOrNull(item.fcob_nm),
    ftypeNm: toStringOrNull(item.ftype_nm),
    fmngCpNm: toStringOrNull(item.fmng_cp_nm),
    fmngCpbNm: toStringOrNull(item.fmng_cpb_nm),
    faciGfa: toFloatOrNull(item.faci_gfa),
    standCptPsnCnt: toIntOrNull(item.stand_cpt_psn_cnt),
    faciHomepage: toStringOrNull(item.faci_homepage),
    faciStatCd: toStringOrNull(item.faci_stat_cd),
    addrCtpvNm: toStringOrNull(item.addr_ctpv_nm),
    addrCpbNm: toStringOrNull(item.addr_cpb_nm),
    addrEmdNm: toStringOrNull(item.addr_emd_nm),
    nationYn: toStringOrNull(item.nation_yn),
    fmngTypeGbNm: toStringOrNull(item.fmng_type_gb_nm),
    delYn,
    rowNum: toIntOrNull(item.row_num),
  };
}

/**
 * 단일 페이지 API 호출 → item 배열 반환
 */
export async function fetchSportsPage(
  pageNo: number,
  numOfRows: number = PAGE_SIZE
): Promise<{ items: SportsAPIItem[]; totalCount: number }> {
  const apiKey = process.env.OPENAPI_SERVICE_KEY;
  if (!apiKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const params = new URLSearchParams({
    serviceKey: apiKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    resultType: 'json',
  });

  const url = `${SPORTS_API_URL}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const json: any = await response.json(); // eslint-disable-line @typescript-eslint/no-explicit-any

  const body = json?.response?.body;
  if (!body) {
    return { items: [], totalCount: 0 };
  }

  const totalCount = parseInt(String(body.totalCount ?? '0'), 10) || 0;

  let rawItems = body?.items?.item;
  if (!rawItems) {
    return { items: [], totalCount };
  }

  // 단건 응답 시 배열이 아닐 수 있음
  if (!Array.isArray(rawItems)) {
    rawItems = [rawItems];
  }

  return { items: rawItems as SportsAPIItem[], totalCount };
}

/**
 * 체육시설 데이터 동기화 메인 함수
 * 페이지네이션으로 전체 43K 데이터 수집 → upsert
 */
export async function syncSports(): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('sports');

  try {
    const allItems: TransformedSports[] = [];
    let pageNo = 1;
    let totalCount = 0;
    let keepGoing = true;

    while (keepGoing) {
      const { items, totalCount: tc } = await fetchSportsPage(pageNo);
      if (pageNo === 1) {
        totalCount = tc;
        console.info(`Total records to sync: ${totalCount}`);
      }

      if (items.length === 0) break;

      for (const item of items) {
        const transformed = transformSportsItem(item);
        if (transformed) {
          allItems.push(transformed);
        } else {
          stats.skippedRecords++;
        }
      }

      stats.totalRecords += items.length;
      console.info(`  page ${pageNo}: ${items.length} items (total fetched: ${stats.totalRecords}/${totalCount})`);

      if (stats.totalRecords >= totalCount) {
        keepGoing = false;
      } else {
        pageNo++;
      }
    }

    // 중복 제거 (sourceId 기준)
    const uniqueMap = new Map<string, TransformedSports>();
    for (const item of allItems) {
      uniqueMap.set(item.sourceId, item);
    }
    const uniqueItems = Array.from(uniqueMap.values());
    const duplicateCount = allItems.length - uniqueItems.length;
    stats.skippedRecords += duplicateCount;

    console.info(`Transformed ${uniqueItems.length} unique records, skipped ${stats.skippedRecords}`);
    console.info('Upserting to database...');

    const now = new Date();
    const rowsForUpsert = uniqueItems.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      roadAddress: s.roadAddress,
      lat: s.lat,
      lng: s.lng,
      city: s.city,
      district: s.district,
      sourceId: s.sourceId,
      faciGbNm: s.faciGbNm,
      fcobNm: s.fcobNm,
      ftypeNm: s.ftypeNm,
      fmngCpNm: s.fmngCpNm,
      fmngCpbNm: s.fmngCpbNm,
      faciGfa: s.faciGfa,
      standCptPsnCnt: s.standCptPsnCnt,
      faciHomepage: s.faciHomepage,
      faciStatCd: s.faciStatCd,
      addrCtpvNm: s.addrCtpvNm,
      addrCpbNm: s.addrCpbNm,
      addrEmdNm: s.addrEmdNm,
      nationYn: s.nationYn,
      fmngTypeGbNm: s.fmngTypeGbNm,
      delYn: s.delYn,
      rowNum: s.rowNum,
      // createdAt 생략 — schema @default(now())가 처리. SKIP_UPDATE_COLS 의존 감소.
      updatedAt: now,   // raw INSERT 필수 (NULL 위반 방지). UPDATE는 batchUpsertRaw가 NOW()로 강제.
      syncedAt: now,    // DB default 있지만 ON DUPLICATE NOW() 갱신 위해 payload 포함.
    }));

    const { newCount, updateCount } = await batchUpsertRaw(
      'Sports',
      rowsForUpsert,
      100,
      syncHistory.id,
      { exactStats: true, uniqueKey: 'sourceId' }
    );

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`sports sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('sports sync failed:', errorMessage);
    throw error;
  }
}

export default { syncSports, createSyncHistory, updateSyncHistory };
