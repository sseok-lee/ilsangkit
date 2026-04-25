#!/usr/bin/env tsx
// LH 공고 동기화 스크립트 (분양/임대 — 토지 제외)
// API 3종:
//   - 목록: B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1
//   - 상세: B552555/lhLeaseNoticeDtlInfo1/getLeaseNoticeDtlInfo1
//   - 공급: B552555/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { runSync } from '../services/baseSyncService.js';
import type { SyncStats } from '../services/baseSyncService.js';
import {
  buildSourceId,
  flattenLhResponse,
  isLandAnnouncement,
  transformLhAnnouncement,
  type AnnouncementBundle,
  type LhAnnouncementListItem,
  type LhDetailResponse,
  type LhSupplyResponse,
} from '../utils/lhAnnouncementTransform.js';

const LIST_URL = 'https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1';
const DETAIL_URL = 'https://apis.data.go.kr/B552555/lhLeaseNoticeDtlInfo1/getLeaseNoticeDtlInfo1';
const SUPPLY_URL = 'https://apis.data.go.kr/B552555/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1';

const PAGE_SIZE = 100;
const RATE_LIMIT_MS = 200;
const LOOKBACK_DAYS = 365;

function ymd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ListResponseItem extends LhAnnouncementListItem {
  ALL_CNT?: number | string;
}

interface ListResponse {
  dsList?: ListResponseItem[];
}

async function fetchListPage(
  serviceKey: string,
  page: number,
  startYmd: string,
  endYmd: string
): Promise<{ items: ListResponseItem[]; totalCount: number }> {
  const params = new URLSearchParams({
    PG_SZ: String(PAGE_SIZE),
    PAGE: String(page),
    PAN_ST_DT: startYmd,
    PAN_ED_DT: endYmd,
  });
  const url = `${LIST_URL}?${params.toString()}&serviceKey=${serviceKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`list HTTP ${res.status}`);
  // data.go.kr LH API 응답은 [{dsSch:...}, {dsList:...}] 배열 형태 — 머지 후 dsList 추출.
  const merged = flattenLhResponse<ListResponse>(await res.json());
  const items = merged.dsList ?? [];
  const totalCount = items[0] ? Number(items[0].ALL_CNT ?? 0) : 0;
  return { items, totalCount };
}

async function fetchDetail(
  serviceKey: string,
  item: LhAnnouncementListItem
): Promise<LhDetailResponse> {
  const params = new URLSearchParams({
    PAN_ID: item.PAN_ID,
    CCR_CNNT_SYS_DS_CD: item.CCR_CNNT_SYS_DS_CD,
    UPP_AIS_TP_CD: item.UPP_AIS_TP_CD,
    AIS_TP_CD: item.AIS_TP_CD,
    SPL_INF_TP_CD: item.SPL_INF_TP_CD,
  });
  const url = `${DETAIL_URL}?${params.toString()}&serviceKey=${serviceKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`detail HTTP ${res.status}`);
  return flattenLhResponse<LhDetailResponse>(await res.json());
}

async function fetchSupply(
  serviceKey: string,
  item: LhAnnouncementListItem
): Promise<LhSupplyResponse> {
  const params = new URLSearchParams({
    PAN_ID: item.PAN_ID,
    CCR_CNNT_SYS_DS_CD: item.CCR_CNNT_SYS_DS_CD,
    UPP_AIS_TP_CD: item.UPP_AIS_TP_CD,
    AIS_TP_CD: item.AIS_TP_CD,
    SPL_INF_TP_CD: item.SPL_INF_TP_CD,
  });
  const url = `${SUPPLY_URL}?${params.toString()}&serviceKey=${serviceKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`supply HTTP ${res.status}`);
  return flattenLhResponse<LhSupplyResponse>(await res.json());
}

async function upsertBundle(bundle: AnnouncementBundle): Promise<'new' | 'updated'> {
  const existing = await prisma.lhAnnouncement.findUnique({
    where: { sourceId: bundle.announcement.sourceId },
    select: { id: true },
  });

  const announcement = await prisma.lhAnnouncement.upsert({
    where: { sourceId: bundle.announcement.sourceId },
    update: bundle.announcement,
    create: bundle.announcement,
  });

  // Replace child records (supplies/attachments) atomically per-announcement.
  // Scope is small (handful of supplies + attachments per announcement),
  // so a single transaction stays well under the 30s timeout.
  await prisma.$transaction(
    async (tx) => {
      await tx.lhAnnouncementSupply.deleteMany({ where: { announcementId: announcement.id } });
      await tx.lhAnnouncementAttachment.deleteMany({ where: { announcementId: announcement.id } });

      if (bundle.supplies.length > 0) {
        await tx.lhAnnouncementSupply.createMany({
          data: bundle.supplies.map((s) => ({ ...s, announcementId: announcement.id })),
        });
      }
      if (bundle.attachments.length > 0) {
        await tx.lhAnnouncementAttachment.createMany({
          data: bundle.attachments.map((a) => ({ ...a, announcementId: announcement.id })),
        });
      }
    },
    { timeout: 15000 }
  );

  return existing ? 'updated' : 'new';
}

async function syncLhAnnouncement(stats: SyncStats): Promise<void> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const now = new Date();
  const start = new Date(now.getTime() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const startYmd = ymd(start);
  const endYmd = ymd(now);

  // Probe page 1 to learn totalCount
  const first = await fetchListPage(serviceKey, 1, startYmd, endYmd);
  const totalPages = Math.max(1, Math.ceil((first.totalCount || first.items.length) / PAGE_SIZE));
  console.info(`LH announcement list: total=${first.totalCount}, pages=${totalPages}`);

  let collected: LhAnnouncementListItem[] = [...first.items];
  for (let page = 2; page <= totalPages; page++) {
    await delay(RATE_LIMIT_MS);
    try {
      const next = await fetchListPage(serviceKey, page, startYmd, endYmd);
      collected = collected.concat(next.items);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`list page ${page} failed: ${msg}`);
      stats.errors.push(`list page ${page}: ${msg}`);
    }
  }

  // Filter: 토지(land) 제외
  const housing = collected.filter((item) => !isLandAnnouncement(item));
  console.info(`Filtered land announcements: ${collected.length} -> ${housing.length}`);

  for (const item of housing) {
    stats.totalRecords++;
    try {
      await delay(RATE_LIMIT_MS);
      const detail = await fetchDetail(serviceKey, item).catch((err) => {
        console.warn(`detail ${item.PAN_ID}: ${err instanceof Error ? err.message : err}`);
        return undefined;
      });
      await delay(RATE_LIMIT_MS);
      const supply = await fetchSupply(serviceKey, item).catch((err) => {
        console.warn(`supply ${item.PAN_ID}: ${err instanceof Error ? err.message : err}`);
        return undefined;
      });

      const bundle = transformLhAnnouncement(item, detail, supply);
      const result = await upsertBundle(bundle);
      if (result === 'new') stats.newRecords++;
      else stats.updatedRecords++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`upsert ${item.PAN_ID}-${item.CCR_CNNT_SYS_DS_CD}: ${msg}`);
      stats.errors.push(`${buildSourceId(item.PAN_ID, item.CCR_CNNT_SYS_DS_CD)}: ${msg}`);
      stats.skippedRecords++;
    }
  }
}

async function main() {
  if (!process.env.OPENAPI_SERVICE_KEY) {
    console.error('Error: OPENAPI_SERVICE_KEY 환경변수가 필요합니다.');
    process.exit(1);
  }

  try {
    await runSync('lh-announcement', syncLhAnnouncement);
  } catch (err) {
    console.error('LH announcement sync 실패:', err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly = (() => {
  const argv1 = process.argv[1] ?? '';
  return argv1.endsWith('syncLhAnnouncement.ts') || argv1.endsWith('syncLhAnnouncement.js');
})();

if (invokedDirectly) {
  void main();
}

export { syncLhAnnouncement, upsertBundle, fetchListPage, fetchDetail, fetchSupply };
