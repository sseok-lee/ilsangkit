#!/usr/bin/env tsx
// 마이홈 공공임대 입주자 모집공고 동기화
// API: apis.data.go.kr/1613000/HWSPR02
//   - rsdtRcritNtcList:    일반 공공임대 모집공고  (source='general')
//   - ltRsdtRcritNtcList:  장기임대(매입/전세) 모집공고 (source='longTerm')
// 두 endpoint 의 응답 envelope 가 동일 — source 필드로만 구분.

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
  pblancId: string;
  pblancNo?: string | null;
  pblancNm: string;
  suplyInsttNm?: string | null;
  suplyTyNm?: string | null;
  brtcNm?: string | null;
  signguNm?: string | null;
  hsmpNm?: string | null;
  pnu?: string | null;
  rcritPblancDe?: string | null;
  beginDe?: string | null;
  endDe?: string | null;
  totSplyHshldco?: number | string | null;
  url?: string | null;
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

export interface TransformedAnnouncement {
  pblancId: string;
  pblancNo: string | null;
  pblancNm: string;
  source: AnnouncementSource;
  suplyInsttNm: string | null;
  suplyTyNm: string | null;
  brtcNm: string | null;
  signguNm: string | null;
  hsmpNm: string | null;
  pnu: string | null;
  rcritPblancDe: string | null;
  beginDe: string | null;
  endDe: string | null;
  totSplyHshldco: number | null;
  url: string | null;
  rawJson: AnnouncementApiItem;
}

export function transformAnnouncement(
  item: AnnouncementApiItem,
  source: AnnouncementSource,
): TransformedAnnouncement {
  return {
    pblancId: String(item.pblancId),
    pblancNo: toStr(item.pblancNo),
    pblancNm: String(item.pblancNm ?? '').trim(),
    source,
    suplyInsttNm: toStr(item.suplyInsttNm),
    suplyTyNm: toStr(item.suplyTyNm),
    brtcNm: toStr(item.brtcNm),
    signguNm: toStr(item.signguNm),
    hsmpNm: toStr(item.hsmpNm),
    pnu: toStr(item.pnu),
    rcritPblancDe: normalizeDate(item.rcritPblancDe),
    beginDe: normalizeDate(item.beginDe),
    endDe: normalizeDate(item.endDe),
    totSplyHshldco: toIntOrNull(item.totSplyHshldco),
    url: toStr(item.url),
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
      items?: { item?: AnnouncementApiItem[] | AnnouncementApiItem } | AnnouncementApiItem[] | null;
      totalCount?: number;
      pageNo?: number;
      numOfRows?: number;
    };
  };
}

function extractItems(envelope: ApiEnvelope): { items: AnnouncementApiItem[]; totalCount: number } {
  const body = envelope?.response?.body;
  if (!body) return { items: [], totalCount: 0 };
  const totalCount = typeof body.totalCount === 'number' ? body.totalCount : 0;
  const raw = body.items;
  // 응답 envelope 변형: { item: [...] } / { item: {} } / [...] / null / "" 모두 가능
  let arr: AnnouncementApiItem[] = [];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (raw && typeof raw === 'object' && 'item' in raw) {
    const inner = (raw as { item?: AnnouncementApiItem[] | AnnouncementApiItem }).item;
    arr = Array.isArray(inner) ? inner : inner ? [inner] : [];
  }
  return { items: arr, totalCount };
}

async function fetchPage(
  source: AnnouncementSource,
  pageNo: number,
  serviceKey: string,
): Promise<{ items: AnnouncementApiItem[]; totalCount: number }> {
  const url = new URL(`${API_BASE}/${ENDPOINTS[source]}`);
  url.searchParams.set('numOfRows', String(PAGE_SIZE));
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('_type', 'json');
  // serviceKey 는 URLSearchParams 가 한 번 더 인코딩하면 깨질 수 있어 raw query 로 부착.
  const finalUrl = `${url.toString()}&serviceKey=${serviceKey}`;
  const res = await fetchWithRetry(finalUrl);
  const data = (await res.json()) as ApiEnvelope;
  return extractItems(data);
}

async function fetchAll(source: AnnouncementSource, serviceKey: string): Promise<AnnouncementApiItem[]> {
  const all: AnnouncementApiItem[] = [];
  const first = await fetchPage(source, 1, serviceKey);
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
    // 동일 pblancId 중복 제거 (longTerm 우선 — ltRsdtRcritNtcList 에 매입/전세 메타가 더 풍부).
    const dedup = new Map<string, TransformedAnnouncement>();
    for (const t of transformed) {
      if (!t.pblancId) continue;
      const prev = dedup.get(t.pblancId);
      if (!prev || (prev.source === 'general' && t.source === 'longTerm')) {
        dedup.set(t.pblancId, t);
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
          const existing = await prisma.publicRentalAnnouncement.findUnique({
            where: { pblancId: item.pblancId },
            select: { id: true },
          });
          const rawJson = item.rawJson as unknown as Prisma.InputJsonValue;
          await prisma.publicRentalAnnouncement.upsert({
            where: { pblancId: item.pblancId },
            create: { ...item, rawJson },
            update: {
              pblancNo: item.pblancNo,
              pblancNm: item.pblancNm,
              source: item.source,
              suplyInsttNm: item.suplyInsttNm,
              suplyTyNm: item.suplyTyNm,
              brtcNm: item.brtcNm,
              signguNm: item.signguNm,
              hsmpNm: item.hsmpNm,
              pnu: item.pnu,
              rcritPblancDe: item.rcritPblancDe,
              beginDe: item.beginDe,
              endDe: item.endDe,
              totSplyHshldco: item.totSplyHshldco,
              url: item.url,
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
