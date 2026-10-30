// 국토교통부 TAGO 버스정류소정보 API 클라이언트 — odcloud 파일 데이터에서 빠진 도시(예: 익산)를 채우는 보충 원본.
// 도시코드 목록을 받은 뒤 도시별 정류소 전체를 받는다. 행은 파일 데이터와 같은 한글 키로 바꿔
// normalizeBusStopRows 를 그대로 거치게 한다(같은 정류장번호는 먼저 온 파일 행이 남는다).

import { SYNC } from '../constants/sync.js';
import type { BusStopRawRow } from './busStopDataSource.js';

const BASE = 'https://apis.data.go.kr/1613000/BusSttnInfoInqireService';
// 2026-10-30 실측: 도시 하나(전주 2,585건)를 한 번에 받는 데 4~5초
const ROWS_PER_PAGE = 5000;
const REQUEST_TIMEOUT_MS = 60_000;
const RETRIES = 2;
const RETRY_DELAY_MS = SYNC.RETRY_BASE_DELAY_MS / 4;

export interface TagoCity {
  code: string;
  name: string;
}

// 재시도해도 소용없는 오류(인증키 등)
class FatalTagoError extends Error {}

interface TagoBody {
  totalCount?: number;
  items?: { item?: unknown } | string;
}

// items.item 은 0건이면 빈 문자열, 1건이면 객체, 여러 건이면 배열로 온다
export function tagoItems(body: TagoBody | undefined): Record<string, unknown>[] {
  const items = body?.items;
  if (!items || typeof items !== 'object') return [];
  const item = items.item;
  if (Array.isArray(item)) return item as Record<string, unknown>[];
  return item && typeof item === 'object' ? [item as Record<string, unknown>] : [];
}

async function getJson(op: string, params: Record<string, string | number>): Promise<TagoBody> {
  const key = process.env.OPENAPI_SERVICE_KEY;
  if (!key) throw new FatalTagoError('OPENAPI_SERVICE_KEY 가 없습니다');
  const qs = new URLSearchParams({ _type: 'json', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const url = `${BASE}/${op}?serviceKey=${encodeURIComponent(key)}&${qs}`;

  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (res.status === 401 || res.status === 403) {
        throw new FatalTagoError(`TAGO 인증 실패 (HTTP ${res.status}): 활용신청·인증키 확인 필요`);
      }
      if (!res.ok) throw new Error(`TAGO HTTP ${res.status}`);
      const json = (await res.json()) as {
        response?: { header?: { resultCode?: string; resultMsg?: string }; body?: TagoBody };
      };
      const code = json.response?.header?.resultCode;
      if (code !== '00') throw new Error(`TAGO 결과코드 ${code ?? '없음'}: ${json.response?.header?.resultMsg ?? ''}`);
      return json.response?.body ?? {};
    } catch (err) {
      if (err instanceof FatalTagoError) throw err;
      lastError = err;
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function fetchTagoCities(): Promise<TagoCity[]> {
  const body = await getJson('getCtyCodeList', {});
  return tagoItems(body)
    .map((c) => ({ code: String(c.citycode ?? '').trim(), name: String(c.cityname ?? '').trim() }))
    .filter((c) => c.code !== '');
}

// TAGO 정류소 → 파일 데이터와 같은 한글 키
export function toBusStopRawRow(item: Record<string, unknown>, city: TagoCity, collectedAt: string): BusStopRawRow {
  return {
    정류장번호: item.nodeid,
    정류장명: item.nodenm,
    위도: item.gpslati,
    경도: item.gpslong,
    모바일단축번호: item.nodeno,
    도시코드: city.code,
    도시명: city.name,
    정보수집일: collectedAt,
  };
}

export async function fetchTagoCityRows(city: TagoCity, collectedAt: string): Promise<BusStopRawRow[]> {
  const rows: BusStopRawRow[] = [];
  for (let page = 1; ; page++) {
    const body = await getJson('getSttnNoList', { cityCode: city.code, pageNo: page, numOfRows: ROWS_PER_PAGE });
    const items = tagoItems(body);
    rows.push(...items.map((it) => toBusStopRawRow(it, city, collectedAt)));
    const total = Number(body.totalCount ?? 0);
    if (items.length === 0 || rows.length >= total) break;
  }
  return rows;
}

// 오늘 날짜(KST) YYYY-MM-DD
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(now);
}

/**
 * 전 도시 정류소를 받는다. 보충 원본이라 실패해도 sync 를 막지 않는다:
 * 도시 목록·인증 실패는 빈 배열, 도시 하나 실패는 그 도시만 건너뛴다.
 */
export async function fetchAllTagoRows(): Promise<{ rows: BusStopRawRow[]; cities: number; failedCities: string[] }> {
  let cities: TagoCity[];
  try {
    cities = await fetchTagoCities();
  } catch (err) {
    console.warn(`TAGO 도시 목록 조회 실패 — 보충 없이 진행: ${(err as Error).message}`);
    return { rows: [], cities: 0, failedCities: [] };
  }

  const collectedAt = kstToday();
  const rows: BusStopRawRow[] = [];
  const failedCities: string[] = [];
  for (const city of cities) {
    try {
      const cityRows = await fetchTagoCityRows(city, collectedAt);
      rows.push(...cityRows);
      console.info(`TAGO ${city.name}(${city.code}): ${cityRows.length}건`);
    } catch (err) {
      if (err instanceof FatalTagoError) {
        console.warn(`TAGO 중단 — 보충 없이 진행: ${err.message}`);
        return { rows: [], cities: cities.length, failedCities: cities.map((c) => c.name) };
      }
      failedCities.push(city.name);
      console.warn(`TAGO ${city.name}(${city.code}) 실패 — 건너뜀: ${(err as Error).message}`);
    }
  }
  return { rows, cities: cities.length, failedCities };
}
