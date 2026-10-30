// odcloud 국토교통부 전국 버스정류장 위치정보 API 클라이언트
// 판(버전) 목록은 OAS 문서에서, 데이터는 페이지 단위로 전부 받는다.

import { SYNC } from '../constants/sync.js';
import type { BusStopRawRow } from './busStopDataSource.js';

const OAS_URL = 'https://infuser.odcloud.kr/oas/docs?namespace=15067528/v1';
const DATA_BASE = 'https://api.odcloud.kr/api';
// 2026-10-30 실측: 10000은 정상, 50000은 200이지만 data가 빈 채로 온다
const DEFAULT_PER_PAGE = 10000;
const REQUEST_TIMEOUT_MS = 30_000;
const PAGE_RETRIES = 2;
const RETRY_DELAY_MS = SYNC.RETRY_BASE_DELAY_MS / 4;

export interface BusStopVersion {
  path: string; // 예: '/15067528/v1/uddi:f74b…'
  version: string; // 예: '20251031'
}

// 재시도해도 소용없는 오류(인증키 등)
class FatalApiError extends Error {}

export function parseBusStopVersions(oas: unknown): BusStopVersion[] {
  const paths = (oas as { paths?: Record<string, { get?: { summary?: string } }> })?.paths ?? {};
  const out: BusStopVersion[] = [];
  for (const [path, def] of Object.entries(paths)) {
    const m = /_(\d{8})\s*$/.exec(def?.get?.summary ?? '');
    if (m) out.push({ path, version: m[1] });
  }
  return out.sort((a, b) => a.version.localeCompare(b.version));
}

export async function fetchLatestBusStopVersion(): Promise<BusStopVersion> {
  const res = await fetch(OAS_URL, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`버스정류장 판 목록 조회 실패: HTTP ${res.status}`);
  const versions = parseBusStopVersions(await res.json());
  if (versions.length === 0) throw new Error('버스정류장 판 목록이 비어 있습니다');
  return versions[versions.length - 1];
}

interface PageResponse {
  totalCount: number;
  data: BusStopRawRow[];
}

async function fetchPage(url: string): Promise<PageResponse> {
  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (res.status === 401 || res.status === 403) {
    let msg = '';
    try {
      msg = ((await res.json()) as { msg?: string }).msg ?? '';
    } catch {
      // 본문이 JSON이 아니어도 상태코드만으로 충분
    }
    throw new FatalApiError(`odcloud 인증 실패 (HTTP ${res.status}): ${msg || '인증키 확인 필요'}`);
  }
  if (!res.ok) throw new Error(`odcloud HTTP ${res.status}`);
  const body = (await res.json()) as Partial<PageResponse>;
  if (typeof body.totalCount !== 'number' || !Array.isArray(body.data)) {
    throw new Error('odcloud 응답 형식이 올바르지 않습니다');
  }
  return { totalCount: body.totalCount, data: body.data };
}

async function fetchPageWithRetry(url: string): Promise<PageResponse> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= PAGE_RETRIES; attempt++) {
    try {
      return await fetchPage(url);
    } catch (err) {
      if (err instanceof FatalApiError) throw err;
      lastErr = err;
      if (attempt < PAGE_RETRIES) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function fetchAllBusStopRows(
  ver: BusStopVersion,
  opts: { perPage?: number; onPage?: (page: number, total: number) => void } = {},
): Promise<BusStopRawRow[]> {
  const key = process.env.OPENAPI_SERVICE_KEY;
  if (!key) throw new Error('OPENAPI_SERVICE_KEY 환경변수가 없습니다');
  const perPage = opts.perPage ?? DEFAULT_PER_PAGE;

  const rows: BusStopRawRow[] = [];
  let total = Infinity;
  for (let page = 1; rows.length < total; page++) {
    const url =
      `${DATA_BASE}${ver.path}?page=${page}&perPage=${perPage}` +
      `&returnType=JSON&serviceKey=${encodeURIComponent(key)}`;
    const res = await fetchPageWithRetry(url);
    total = res.totalCount;
    // 빈 성공 응답(perPage 초과 등)으로 일부만 적재되는 것을 막는다
    if (res.data.length === 0 && rows.length < total) {
      throw new Error(`${page}페이지 data가 비어 있습니다 (받은 ${rows.length}/totalCount ${total})`);
    }
    for (const r of res.data) rows.push(r);
    opts.onPage?.(page, total);
  }
  if (rows.length !== total) {
    throw new Error(`받은 행 수(${rows.length})가 totalCount(${total})와 다릅니다`);
  }
  return rows;
}
