import { KOREA_BOUNDS, SYNC } from '../constants/index.js';
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

const EV_CHARGER_API_URL = 'https://apis.data.go.kr/B552584/EvCharger/getChargerInfo';
const NUM_OF_ROWS = 9999;

/**
 * API raw item 타입
 */
export interface EvChargerAPIItem {
  statNm?: string;
  statId?: string;
  chgerId?: string;
  chgerType?: string;
  addr?: string;
  addrDetail?: string;
  location?: string;
  useTime?: string;
  lat?: string | number;
  lng?: string | number;
  busiId?: string;
  bnm?: string;
  busiNm?: string;
  busiCall?: string;
  stat?: string | number;
  statUpdDt?: string;
  lastTsdt?: string;
  lastTedt?: string;
  nowTsdt?: string;
  powerType?: string | number;
  output?: string | number;
  method?: string;
  zcode?: string | number;
  zscode?: string | number;
  kind?: string | number;
  kindDetail?: string | number;
  parkingFree?: string;
  note?: string;
  limitYn?: string;
  limitDetail?: string;
  delYn?: string;
  delDetail?: string;
  trafficYn?: string;
  year?: string | number;
  floorNum?: string | number;
  floorType?: string;
  maker?: string;
}

/**
 * 변환된 EV 충전기 데이터 타입
 */
export interface TransformedEvCharger {
  id: string;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  city: string;
  district: string;
  bjdCode: string | null;
  sourceId: string;
  statId: string | null;
  chgerId: string | null;
  chgerType: string | null;
  addrDetail: string | null;
  location: string | null;
  useTime: string | null;
  busiId: string | null;
  bnm: string | null;
  busiNm: string | null;
  busiCall: string | null;
  stat: string | null;
  statUpdDt: string | null;
  lastTsdt: string | null;
  lastTedt: string | null;
  nowTsdt: string | null;
  powerType: string | null;
  output: string | null;
  method: string | null;
  zcode: string | null;
  zscode: string | null;
  kind: string | null;
  kindDetail: string | null;
  parkingFree: string | null;
  note: string | null;
  limitYn: string | null;
  limitDetail: string | null;
  delYn: string | null;
  delDetail: string | null;
  trafficYn: string | null;
  year: string | null;
  floorNum: string | null;
  floorType: string | null;
  maker: string | null;
}

/**
 * 빈 문자열, undefined, "null" 문자열을 null로 변환
 */
function toStringOrNull(val: string | number | undefined | null): string | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '' || s === 'null') return null;
  return s;
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

  if (!latStr || !lngStr || latStr === 'null' || lngStr === 'null') {
    return { lat: null, lng: null };
  }

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
 * 주소에서 시/도, 구/군 추출
 */
function parseAddress(address: string): { city: string; district: string } {
  const parts = address.trim().split(/\s+/);
  const rawCity = parts[0] || '';
  const district = parts[1] || '';
  const city = CITY_NAME_MAP[rawCity] || rawCity;
  return { city, district };
}

/**
 * API item → TransformedEvCharger 변환
 */
export function transformEvChargerItem(item: EvChargerAPIItem): TransformedEvCharger | null {
  const statId = toStringOrNull(item.statId);
  const chgerId = toStringOrNull(item.chgerId);
  const name = toStringOrNull(item.statNm)?.replace(/^_+/, '').replace(/^\(\d{2,4}년\)\s*/, '').trim() || null;

  if (!statId || !chgerId || !name) return null;

  const sourceId = `${statId}-${chgerId}`;
  const address = toStringOrNull(item.addr);

  if (!address) return null;

  const { city, district } = parseAddress(address);
  if (!city || !district) return null;

  const { lat, lng } = toValidCoord(item.lat, item.lng);

  return {
    id: `ev-charger-${sourceId}`,
    name,
    address,
    roadAddress: null,
    lat,
    lng,
    city,
    district,
    bjdCode: null,
    sourceId,
    statId,
    chgerId,
    chgerType: toStringOrNull(item.chgerType),
    addrDetail: toStringOrNull(item.addrDetail),
    location: toStringOrNull(item.location),
    useTime: toStringOrNull(item.useTime),
    busiId: toStringOrNull(item.busiId),
    bnm: toStringOrNull(item.bnm),
    busiNm: toStringOrNull(item.busiNm),
    busiCall: toStringOrNull(item.busiCall),
    stat: toStringOrNull(item.stat),
    statUpdDt: toStringOrNull(item.statUpdDt),
    lastTsdt: toStringOrNull(item.lastTsdt),
    lastTedt: toStringOrNull(item.lastTedt),
    nowTsdt: toStringOrNull(item.nowTsdt),
    powerType: toStringOrNull(item.powerType),
    output: toStringOrNull(item.output),
    method: toStringOrNull(item.method),
    zcode: toStringOrNull(item.zcode),
    zscode: toStringOrNull(item.zscode),
    kind: toStringOrNull(item.kind),
    kindDetail: toStringOrNull(item.kindDetail),
    parkingFree: toStringOrNull(item.parkingFree),
    note: toStringOrNull(item.note),
    limitYn: toStringOrNull(item.limitYn),
    limitDetail: toStringOrNull(item.limitDetail),
    delYn: toStringOrNull(item.delYn),
    delDetail: toStringOrNull(item.delDetail),
    trafficYn: toStringOrNull(item.trafficYn),
    year: toStringOrNull(item.year),
    floorNum: toStringOrNull(item.floorNum),
    floorType: toStringOrNull(item.floorType),
    maker: toStringOrNull(item.maker),
  };
}

/**
 * 단일 페이지 API 호출 → item 배열 반환
 */
export async function fetchEvChargerPage(
  pageNo: number,
  numOfRows: number = NUM_OF_ROWS
): Promise<{ items: EvChargerAPIItem[]; totalCount: number }> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    dataType: 'JSON',
  });

  const url = `${EV_CHARGER_API_URL}?${params.toString()}`;

  // 전체 ~52페이지 페이지네이션 중 상류 API의 일시적 5xx(502 등)·네트워크·타임아웃으로
  // sync 전체가 중단되지 않도록 지수 백오프 재시도. (page당 최대 SYNC.MAX_RETRIES회)
  let lastError: unknown;
  for (let attempt = 1; attempt <= SYNC.MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const json = await response.json() as {
        items?: { item?: EvChargerAPIItem | EvChargerAPIItem[] };
        totalCount?: number | string;
      };

      const totalCount = parseInt(String(json?.totalCount ?? '0'), 10) || 0;

      let rawItems = json?.items?.item;
      if (!rawItems) {
        return { items: [], totalCount };
      }

      if (!Array.isArray(rawItems)) {
        rawItems = [rawItems];
      }

      return { items: rawItems as EvChargerAPIItem[], totalCount };
    } catch (error) {
      lastError = error;
      if (attempt < SYNC.MAX_RETRIES) {
        const backoff = SYNC.RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
        console.warn(
          `ev-charger page ${pageNo} fetch 실패 (attempt ${attempt}/${SYNC.MAX_RETRIES}): ` +
            `${error instanceof Error ? error.message : String(error)} — ${backoff}ms 후 재시도`
        );
        await new Promise((resolve) => setTimeout(resolve, backoff));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`ev-charger page ${pageNo} fetch 실패: ${String(lastError)}`);
}

/**
 * EV 충전기 데이터 동기화 메인 함수
 * 페이지네이션으로 전체 데이터 수집 → upsert
 */
export async function syncEvChargers(): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('ev-charger');

  try {
    const allItems: TransformedEvCharger[] = [];
    let pageNo = 1;

    // 첫 페이지로 totalCount 파악
    const firstPage = await fetchEvChargerPage(pageNo, NUM_OF_ROWS);
    const totalCount = firstPage.totalCount;
    console.info(`Total records: ${totalCount}`);

    for (const item of firstPage.items) {
      const transformed = transformEvChargerItem(item);
      if (transformed) {
        allItems.push(transformed);
      } else {
        stats.skippedRecords++;
      }
    }
    stats.totalRecords += firstPage.items.length;
    console.info(`page ${pageNo}: ${firstPage.items.length} items`);

    // 나머지 페이지
    while (stats.totalRecords < totalCount) {
      pageNo++;
      const page = await fetchEvChargerPage(pageNo, NUM_OF_ROWS);
      if (page.items.length === 0) break;

      for (const item of page.items) {
        const transformed = transformEvChargerItem(item);
        if (transformed) {
          allItems.push(transformed);
        } else {
          stats.skippedRecords++;
        }
      }

      stats.totalRecords += page.items.length;
      console.info(`page ${pageNo}: ${page.items.length} items (fetched: ${stats.totalRecords}/${totalCount})`);
    }

    // 중복 제거 (sourceId 기준)
    const uniqueMap = new Map<string, TransformedEvCharger>();
    for (const item of allItems) {
      uniqueMap.set(item.sourceId, item);
    }
    const uniqueItems = Array.from(uniqueMap.values());
    const duplicateCount = allItems.length - uniqueItems.length;
    stats.skippedRecords += duplicateCount;

    console.info(`Transformed ${uniqueItems.length} unique records, skipped ${stats.skippedRecords}`);
    console.info('Upserting to database...');

    const now = new Date();
    const rowsForUpsert = uniqueItems.map((c) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      roadAddress: c.roadAddress,
      lat: c.lat,
      lng: c.lng,
      city: c.city,
      district: c.district,
      sourceId: c.sourceId,
      statId: c.statId,
      chgerId: c.chgerId,
      chgerType: c.chgerType,
      addrDetail: c.addrDetail,
      location: c.location,
      useTime: c.useTime,
      busiId: c.busiId,
      bnm: c.bnm,
      busiNm: c.busiNm,
      busiCall: c.busiCall,
      stat: c.stat,
      statUpdDt: c.statUpdDt,
      lastTsdt: c.lastTsdt,
      lastTedt: c.lastTedt,
      nowTsdt: c.nowTsdt,
      powerType: c.powerType,
      output: c.output,
      method: c.method,
      zcode: c.zcode,
      zscode: c.zscode,
      kind: c.kind,
      kindDetail: c.kindDetail,
      parkingFree: c.parkingFree,
      note: c.note,
      limitYn: c.limitYn,
      limitDetail: c.limitDetail,
      delYn: c.delYn,
      delDetail: c.delDetail,
      trafficYn: c.trafficYn,
      year: c.year,
      floorNum: c.floorNum,
      floorType: c.floorType,
      maker: c.maker,
      // createdAt 생략 — schema @default(now())가 처리. SKIP_UPDATE_COLS 의존 감소.
      updatedAt: now,   // raw INSERT 필수 (NULL 위반 방지). UPDATE는 batchUpsertRaw가 NOW()로 강제.
      syncedAt: now,    // DB default 있지만 ON DUPLICATE NOW() 갱신 위해 payload 포함.
    }));

    const { newCount, updateCount } = await batchUpsertRaw(
      'EvCharger',
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

    console.info(`ev-charger sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('ev-charger sync failed:', errorMessage);
    throw error;
  }
}

export default { syncEvChargers, createSyncHistory, updateSyncHistory };
