#!/usr/bin/env tsx
// 마이홈 공공임대 입주자 모집공고 동기화
// API: apis.data.go.kr/1613000/HWSPR02
//   - rsdtRcritNtcList:    일반 공공임대 모집공고  (source='general')
//   - ltRsdtRcritNtcList:  장기임대(매입/전세/공공분양) 모집공고 (source='longTerm')
//
// 한 공고(pblancId) 안에 여러 호수(houseSn) 행이 들어오므로 (pblancId, houseSn) 복합 unique.
// 응답 envelope: response.body.item (단수형!), totalCount/numOfRows/pageNo 는 문자열로 반환.

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { runSync } from '../services/baseSyncService.js';
import type { SyncStats } from '../services/baseSyncService.js';
import type { Prisma } from '@prisma/client';
import { installRuntimeGuard } from './_runtimeGuard.js';

const API_BASE = 'https://apis.data.go.kr/1613000/HWSPR02';
const PAGE_SIZE = 500;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 500;

export type AnnouncementSource = 'general' | 'longTerm';

const ENDPOINTS: Record<AnnouncementSource, string> = {
  general: 'rsdtRcritNtcList',
  longTerm: 'ltRsdtRcritNtcList',
};

export interface AnnouncementApiItem {
  pblancId: string | number;
  houseSn?: string | number | null;
  pblancNm: string;
  sttusNm?: string | null;
  suplyInsttNm?: string | null;
  suplyTyNm?: string | null;
  houseTyNm?: string | null;
  brtcNm?: string | null;
  signguNm?: string | null;
  hsmpNm?: string | null;
  fullAdres?: string | null;
  pnu?: string | null;
  rcritPblancDe?: string | null;
  beginDe?: string | null;
  endDe?: string | null;
  przwnerPresnatnDe?: string | null;
  totHshldCo?: string | number | null;
  sumSuplyCo?: string | number | null;
  rentGtn?: string | number | null;
  enty?: string | number | null;
  prtpay?: string | number | null;
  surlus?: string | number | null;
  mtRntchrg?: string | number | null;
  heatMthdNm?: string | null;
  refrnc?: string | null;
  url?: string | null;
  pcUrl?: string | null;
  mobileUrl?: string | null;
}

export function normalizeDate(s: string | null | undefined): string | null {
  if (s == null) return null;
  const str = String(s).trim();
  if (str === '') return null;
  if (/^\d{8}$/.test(str)) return `${str.slice(0, 4)}-${str.slice(4, 6)}-${str.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return null;
}

function toStr(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

function toIntOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

function toBigIntOrNull(v: unknown): bigint | null {
  const n = toIntOrNull(v);
  return n === null ? null : BigInt(n);
}

export interface TransformedAnnouncement {
  pblancId: string;
  houseSn: number;
  source: AnnouncementSource;
  pblancNm: string;
  sttusNm: string | null;
  suplyInsttNm: string | null;
  suplyTyNm: string | null;
  houseTyNm: string | null;
  brtcNm: string | null;
  signguNm: string | null;
  hsmpNm: string | null;
  fullAdres: string | null;
  pnu: string | null;
  rcritPblancDe: string | null;
  beginDe: string | null;
  endDe: string | null;
  przwnerDe: string | null;
  totHshldCo: number | null;
  sumSuplyCo: number | null;
  rentGtn: bigint | null;
  enty: bigint | null;
  prtpay: bigint | null;
  surlus: bigint | null;
  mtRntchrg: number | null;
  heatMthdNm: string | null;
  refrnc: string | null;
  url: string | null;
  pcUrl: string | null;
  mobileUrl: string | null;
  rawJson: AnnouncementApiItem;
}

export function transformAnnouncement(
  item: AnnouncementApiItem,
  source: AnnouncementSource,
): TransformedAnnouncement {
  const houseSn = toIntOrNull(item.houseSn) ?? 1;
  return {
    pblancId: String(item.pblancId),
    houseSn,
    source,
    pblancNm: String(item.pblancNm ?? '').trim(),
    sttusNm: toStr(item.sttusNm),
    suplyInsttNm: toStr(item.suplyInsttNm),
    suplyTyNm: toStr(item.suplyTyNm),
    houseTyNm: toStr(item.houseTyNm),
    brtcNm: toStr(item.brtcNm),
    signguNm: toStr(item.signguNm),
    hsmpNm: toStr(item.hsmpNm),
    fullAdres: toStr(item.fullAdres),
    pnu: toStr(item.pnu),
    rcritPblancDe: normalizeDate(item.rcritPblancDe),
    beginDe: normalizeDate(item.beginDe),
    endDe: normalizeDate(item.endDe),
    przwnerDe: normalizeDate(item.przwnerPresnatnDe),
    totHshldCo: toIntOrNull(item.totHshldCo),
    sumSuplyCo: toIntOrNull(item.sumSuplyCo),
    rentGtn: toBigIntOrNull(item.rentGtn),
    enty: toBigIntOrNull(item.enty),
    prtpay: toBigIntOrNull(item.prtpay),
    surlus: toBigIntOrNull(item.surlus),
    mtRntchrg: toIntOrNull(item.mtRntchrg),
    heatMthdNm: toStr(item.heatMthdNm),
    refrnc: toStr(item.refrnc),
    url: toStr(item.url),
    pcUrl: toStr(item.pcUrl),
    mobileUrl: toStr(item.mobileUrl),
    rawJson: item,
  };
}

async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      lastErr = err;
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attempt + 1)));
      continue;
    }
    if (res.ok) return res;
    if (res.status < 500 || attempt === MAX_RETRIES) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
    await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attempt + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetchWithRetry exhausted');
}

interface ApiEnvelope {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: {
      // 실제 응답: body.item (단수). 가끔 body.items.item / body.items 변형도 방어적으로 처리.
      item?: AnnouncementApiItem[] | AnnouncementApiItem;
      items?: { item?: AnnouncementApiItem[] | AnnouncementApiItem } | AnnouncementApiItem[] | null;
      totalCount?: number | string;
      pageNo?: number | string;
      numOfRows?: number | string;
    };
  };
}

export function extractItems(envelope: ApiEnvelope): { items: AnnouncementApiItem[]; totalCount: number } {
  const body = envelope?.response?.body;
  if (!body) return { items: [], totalCount: 0 };

  const totalCountRaw = body.totalCount;
  const totalCount = typeof totalCountRaw === 'number'
    ? totalCountRaw
    : typeof totalCountRaw === 'string'
      ? Number(totalCountRaw) || 0
      : 0;

  // body.item (실 응답) 우선. 없으면 body.items 변형 처리.
  let arr: AnnouncementApiItem[] = [];
  if (body.item !== undefined) {
    arr = Array.isArray(body.item) ? body.item : body.item ? [body.item] : [];
  } else if (Array.isArray(body.items)) {
    arr = body.items;
  } else if (body.items && typeof body.items === 'object' && 'item' in body.items) {
    const inner = (body.items as { item?: AnnouncementApiItem[] | AnnouncementApiItem }).item;
    arr = Array.isArray(inner) ? inner : inner ? [inner] : [];
  }
  return { items: arr, totalCount };
}

async function fetchPage(
  source: AnnouncementSource,
  pageNo: number,
  serviceKey: string,
): Promise<{ items: AnnouncementApiItem[]; totalCount: number; resultCode?: string; resultMsg?: string }> {
  const url = new URL(`${API_BASE}/${ENDPOINTS[source]}`);
  url.searchParams.set('numOfRows', String(PAGE_SIZE));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('_type', 'json');
  // serviceKey 는 이미 인코딩된 형태가 많아 raw 로 부착.
  const finalUrl = `${url.toString()}&serviceKey=${serviceKey}`;
  const res = await fetchWithRetry(finalUrl);
  const data = (await res.json()) as ApiEnvelope;
  const header = data?.response?.header;
  const out = extractItems(data);
  return { ...out, resultCode: header?.resultCode, resultMsg: header?.resultMsg };
}

async function fetchAll(source: AnnouncementSource, serviceKey: string): Promise<AnnouncementApiItem[]> {
  const all: AnnouncementApiItem[] = [];
  const first = await fetchPage(source, 1, serviceKey);
  if (first.resultCode && first.resultCode !== '00') {
    throw new Error(`API ${first.resultCode}: ${first.resultMsg ?? 'unknown'}`);
  }
  all.push(...first.items);
  console.info(`  ${source}: 1페이지 ${first.items.length}건 / 총 ${first.totalCount}건`);

  let fetched = first.items.length;
  let page = 2;
  while (fetched < first.totalCount && first.items.length > 0) {
    const next = await fetchPage(source, page, serviceKey);
    if (next.items.length === 0) break;
    all.push(...next.items);
    fetched += next.items.length;
    page++;
    await new Promise((r) => setTimeout(r, 150));
  }
  return all;
}

async function syncRentalAnnouncement(): Promise<SyncStats> {
  return runSync('rental-announcement', async (stats) => {
    const serviceKey = process.env.OPENAPI_SERVICE_KEY;
    if (!serviceKey) throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');

    const buckets: Array<{ source: AnnouncementSource; items: AnnouncementApiItem[] }> = [];
    for (const source of Object.keys(ENDPOINTS) as AnnouncementSource[]) {
      console.info(`[${source}] 모집공고 수집...`);
      try {
        const items = await fetchAll(source, serviceKey);
        buckets.push({ source, items });
        console.info(`[${source}] 총 ${items.length}건 수집 완료`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[${source}] 수집 실패 — skip: ${msg}`);
        stats.errors.push(`${source}: ${msg}`);
      }
    }

    const transformed = buckets.flatMap(({ source, items }) =>
      items.map((it) => transformAnnouncement(it, source)),
    );
    // 동일 (pblancId, houseSn) 중복 제거 — longTerm 우선 (메타가 더 풍부).
    const dedup = new Map<string, TransformedAnnouncement>();
    for (const t of transformed) {
      if (!t.pblancId) continue;
      const key = `${t.pblancId}#${t.houseSn}`;
      const prev = dedup.get(key);
      if (!prev || (prev.source === 'general' && t.source === 'longTerm')) {
        dedup.set(key, t);
      }
    }
    const items = [...dedup.values()];
    stats.totalRecords = items.length;
    console.info(`중복 제거 후 ${items.length}건`);

    const CONCURRENCY = 20;
    let newCount = 0;
    let updateCount = 0;
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const slice = items.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (item) => {
          const rawJson = item.rawJson as unknown as Prisma.InputJsonValue;
          const where = { pblancId_houseSn: { pblancId: item.pblancId, houseSn: item.houseSn } };
          const existing = await prisma.publicRentalAnnouncement.findUnique({
            where,
            select: { id: true },
          });
          await prisma.publicRentalAnnouncement.upsert({
            where,
            create: { ...item, rawJson },
            update: {
              source: item.source,
              pblancNm: item.pblancNm,
              sttusNm: item.sttusNm,
              suplyInsttNm: item.suplyInsttNm,
              suplyTyNm: item.suplyTyNm,
              houseTyNm: item.houseTyNm,
              brtcNm: item.brtcNm,
              signguNm: item.signguNm,
              hsmpNm: item.hsmpNm,
              fullAdres: item.fullAdres,
              pnu: item.pnu,
              rcritPblancDe: item.rcritPblancDe,
              beginDe: item.beginDe,
              endDe: item.endDe,
              przwnerDe: item.przwnerDe,
              totHshldCo: item.totHshldCo,
              sumSuplyCo: item.sumSuplyCo,
              rentGtn: item.rentGtn,
              enty: item.enty,
              prtpay: item.prtpay,
              surlus: item.surlus,
              mtRntchrg: item.mtRntchrg,
              heatMthdNm: item.heatMthdNm,
              refrnc: item.refrnc,
              url: item.url,
              pcUrl: item.pcUrl,
              mobileUrl: item.mobileUrl,
              rawJson,
            },
          });
          if (existing) updateCount++;
          else newCount++;
        }),
      );
    }
    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;
    console.info(`완료 — 신규: ${newCount}, 업데이트: ${updateCount}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  installRuntimeGuard({ maxMinutes: 30, name: 'syncRentalAnnouncement', prisma });
  syncRentalAnnouncement()
    .then(() => {
      console.log('✅ 공공임대 모집공고 동기화 완료');
      process.exit(0);
    })
    .catch((e) => {
      console.error('❌ 공공임대 모집공고 동기화 실패:', e);
      process.exit(1);
    });
}

export { syncRentalAnnouncement };
