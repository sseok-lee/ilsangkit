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
// 9999행/요청은 상류 API가 느릴 때 응답 지연(>30s 타임아웃)·502를 유발.
// 작은 페이지(기본 1000, parking sync와 동일)로 요청당 빠르고 안정적으로.
// 상류 상태에 따라 env로 무재배포 튜닝(더 작게/타임아웃 상향).
const NUM_OF_ROWS = Number(process.env.EV_CHARGER_NUM_OF_ROWS) || 1000;
const FETCH_TIMEOUT_MS = Number(process.env.EV_CHARGER_FETCH_TIMEOUT_MS) || 60_000;

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
    try {
      // 타임아웃은 fetch에만 스코프 — 응답 수신 즉시 해제(백오프 대기와 분리).
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

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
    // 첫 페이지로 totalCount 파악 (아래 루프에서 pageNo=1로 재사용 — 중복 fetch 방지).
    // 첫 페이지는 totalCount 확보의 유일한 수단이라 여기서 실패하면 전체 진행 불가 —
    // fetchEvChargerPage의 백오프 재시도가 소진된 뒤에도 실패하면 명확한 메시지로 감싸
    // 바깥 catch가 status 'failed'로 기록하도록 그대로 전파(skip-continue 대상 아님).
    let firstPage: { items: EvChargerAPIItem[]; totalCount: number };
    try {
      firstPage = await fetchEvChargerPage(1, NUM_OF_ROWS);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`ev-charger sync: 첫 페이지(totalCount 확보용) 조회 실패로 동기화를 진행할 수 없음 — ${msg}`);
    }
    const totalCount = firstPage.totalCount;
    const totalPages = Math.ceil(totalCount / NUM_OF_ROWS);
    // 부분 실패 허용 임계값 — totalPages의 20% 미만이면 부분 성공(success+errorMessage),
    // 그 이상이면 상류 장애 가능성이 높다고 보고 failed 처리.
    const failureThreshold = Math.ceil(totalPages * 0.2);
    console.info(`Total records: ${totalCount} (${totalPages} pages)`);

    const now = new Date();
    let failedPages = 0;
    const failedPageNos: number[] = [];

    // 페이지별 증분 upsert — 메모리에는 항상 한 페이지 분량만 보유(바운드),
    // 페이지 처리 직후 batchUpsertRaw로 즉시 반영해 중간 실패 시에도 이미 처리한 페이지는 durable.
    // 종료조건은 totalPages(페이지 인덱스) 기준 — totalRecords 누적 기준이 아님
    // (skip 로직 도입 시에도 안전하게 종료하기 위함, Task 2).
    for (let pageNo = 1; pageNo <= totalPages; pageNo++) {
      let page: { items: EvChargerAPIItem[]; totalCount: number };
      if (pageNo === 1) {
        page = firstPage;
      } else {
        try {
          page = await fetchEvChargerPage(pageNo, NUM_OF_ROWS);
        } catch (error) {
          // fetchEvChargerPage 내부 지수 백오프 재시도가 모두 소진된 뒤의 영구 실패.
          // 전체 sync를 throw로 중단하지 않고 이 페이지만 skip — 나머지 페이지는 계속 진행(부분 내구성).
          failedPages++;
          failedPageNos.push(pageNo);
          console.error(
            `ev-charger page ${pageNo}/${totalPages} 영구 실패(재시도 소진) — skip: ` +
              `${error instanceof Error ? error.message : String(error)}`
          );
          continue;
        }
      }

      // 변환 + 페이지 내 dedup (sourceId 기준) — 크로스 페이지 dedup은 불필요
      // (upsert-by-sourceId라 이후 페이지가 같은 sourceId를 다시 upsert해도 덮어쓸 뿐 안전).
      const pageMap = new Map<string, TransformedEvCharger>();
      let transformedCount = 0;
      let pageSkipped = 0;
      for (const item of page.items) {
        const transformed = transformEvChargerItem(item);
        if (transformed) {
          pageMap.set(transformed.sourceId, transformed);
          transformedCount++;
        } else {
          pageSkipped++;
        }
      }
      const duplicateCount = transformedCount - pageMap.size;

      stats.totalRecords += page.items.length;
      stats.skippedRecords += pageSkipped + duplicateCount;

      const pageRows = Array.from(pageMap.values()).map((c) => ({
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

      if (pageRows.length > 0) {
        const { newCount, updateCount } = await batchUpsertRaw(
          'EvCharger',
          pageRows,
          100,
          syncHistory.id,
          { exactStats: true, uniqueKey: 'sourceId' }
        );
        stats.newRecords += newCount;
        stats.updatedRecords += updateCount;
      }

      // 참조 해제(pageMap/pageRows는 루프 스코프 로컬 — 다음 반복에서 GC 대상, 메모리 바운드 유지)
      console.info(
        `page ${pageNo}/${totalPages}: ${pageRows.length} items upserted ` +
          `(total so far: ${stats.totalRecords}/${totalCount}, new=${stats.newRecords}, updated=${stats.updatedRecords})`
      );
    }

    if (failedPages > 0) {
      const pagesSummary = failedPageNos.length <= 20
        ? failedPageNos.join(', ')
        : `${failedPageNos.slice(0, 20).join(', ')} 외 ${failedPageNos.length - 20}개`;

      if (failedPages >= failureThreshold) {
        // 임계값(totalPages의 20%) 이상 페이지가 영구 실패 — 상류 장애 가능성이 높음.
        // 이미 처리한 페이지는 durable하지만(멱등 upsert로 다음 run이 이어감), 이번 run은 failed로 표기.
        throw new Error(
          `ev-charger sync: ${failedPages}/${totalPages}페이지 영구 실패(임계값 ${failureThreshold} 이상) — ` +
            `실패 페이지: ${pagesSummary}. 상류 장애 가능성 — 실패 처리(성공한 페이지 데이터는 유지, 다음 run에서 재시도).`
        );
      }

      // 임계값 미만 — 부분 성공. 데이터는 성공한 페이지만큼 durable, 실패 페이지는 다음 run(멱등 upsert)이 재시도.
      const partialFailureMessage =
        `부분 성공: ${failedPages}/${totalPages}페이지 영구 실패(재시도 소진, skip) — ` +
        `실패 페이지: ${pagesSummary}. 다음 run에서 재시도됨(멱등 upsert).`;

      await updateSyncHistory(syncHistory.id, {
        status: 'success',
        totalRecords: stats.totalRecords,
        newRecords: stats.newRecords,
        updatedRecords: stats.updatedRecords,
        errorMessage: partialFailureMessage,
      });

      console.warn(`ev-charger sync 부분 성공: ${partialFailureMessage}`);
      console.info(`ev-charger sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
      return stats;
    }

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
