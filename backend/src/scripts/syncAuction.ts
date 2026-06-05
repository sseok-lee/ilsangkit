#!/usr/bin/env tsx
// 온비드 부동산 공매 동기화 — 일일 스냅샷 + 마감포착 archive
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
import { runSync, batchUpsert, transformAndDedupe, type SyncStats } from '../services/baseSyncService.js';
import { fetchOnbidList, fetchOnbidDetail } from '../services/onbidBase.js';
import { toUsageGroup } from '../services/auctionUsage.js';

const CATEGORY = 'auction';
// 부동산 재산유형코드 (Task 0에서 유효값 확정 후 갱신)
export const PRPT_DIV_CODES = ['0001', '0002', '0003', '0004', '0005', '0006'];

export interface RawAuctionItem extends Record<string, unknown> {
  cltrMngNo: string; pbctCdtnNo: string; plnmNo?: string;
  cltrNm: string; ctgrFullNm?: string; prptDivNm?: string; dpslMtdNm?: string;
  apslAssAmt?: string; minBidPrc?: string;
  pbctBegnDtm?: string; pbctClsDtm?: string;
  fbdrCnt?: string; pbctSno?: string; orgNm?: string;
  ldCd?: string; lat?: string; lng?: string;
  city?: string; district?: string;
}

function parseBigIntOrNull(v: unknown): bigint | null {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (!s || !/^\d+$/.test(s)) return null;
  return BigInt(s);
}
function parseIntOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
// YYYYMMDDhhmm(또는 YYYYMMDD) → Date(UTC)
function parseDtm(v: unknown): Date | null {
  const s = String(v ?? '').replace(/[^0-9]/g, '').trim();
  if (s.length < 8) return null;
  const y = +s.slice(0, 4), mo = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
  const h = s.length >= 12 ? +s.slice(8, 10) : 0, mi = s.length >= 12 ? +s.slice(10, 12) : 0;
  const dt = new Date(Date.UTC(y, mo, d, h, mi));
  return isNaN(dt.getTime()) ? null : dt;
}

export function transformAuctionItem(item: RawAuctionItem, now: Date = new Date()) {
  const cltrMngNo = String(item.cltrMngNo ?? '').trim();
  if (!cltrMngNo) return null;
  const address = String(item.cltrNm ?? '').trim();
  const usage = String(item.ctgrFullNm ?? '').trim() || null;
  // ⚠️ MAJOR #3: 'ldCd'는 가정한 필드명. Task 0 라이브 probe에서 실제 시군구코드 필드명 확정 필수.
  //   ldCd가 없거나 다른 이름이면 bjdCode=''가 되어 해당 물건이 모든 지역/집계 페이지에서 누락됨(SEO 자산 0).
  //   1순위: 시군구코드 필드 직접 사용. 2순위(없을 때): enrich 단계에서 city/district명↔regionMap 역매칭으로 bjdCode 채움.
  const ldCd = String(item.ldCd ?? '').trim();
  const bjdCode = ldCd ? ldCd.slice(0, 5) : '';
  const bidBeginDtm = parseDtm(item.pbctBegnDtm);
  const bidCloseDtm = parseDtm(item.pbctClsDtm);
  const status = bidCloseDtm && bidCloseDtm < now ? 'closed'
    : bidBeginDtm && bidBeginDtm > now ? 'scheduled' : 'ongoing';
  return {
    sourceId: `${CATEGORY}-${cltrMngNo}`,
    cltrMngNo,
    pbctCdtnNo: String(item.pbctCdtnNo ?? '').trim(),
    plnmNo: String(item.plnmNo ?? '').trim() || null,
    city: String(item.city ?? '').trim(),
    district: String(item.district ?? '').trim(),
    bjdCode,
    dongName: null as string | null, // 주소 파싱은 Task 0 결과 따라 보강(법정동)
    address,
    usage,
    usageGroup: toUsageGroup(usage),
    propertyType: String(item.prptDivNm ?? '').trim() || null,
    dpslMtdNm: String(item.dpslMtdNm ?? '').trim() || null,
    landArea: null as string | null,
    bldArea: null as string | null,
    apslAssAmt: parseBigIntOrNull(item.apslAssAmt),
    minBidPrc: parseBigIntOrNull(item.minBidPrc),
    failCnt: parseIntOrNull(item.fbdrCnt) ?? 0,
    bidRound: parseIntOrNull(item.pbctSno),
    bidBeginDtm,
    bidCloseDtm,
    orgNm: String(item.orgNm ?? '').trim() || null,
    pvctTrgtYn: (item as { pvctTrgtYn?: boolean }).pvctTrgtYn === true, // enriched에서 'Y'→true 주입됨
    status,
    lat: item.lat ? String(item.lat).trim() : null,
    lng: item.lng ? String(item.lng).trim() : null,
  };
}

// --- Task 4: computeAuctionSummary ---

const INDEX_SOLD_MIN = 3;
const INDEX_CLOSED_MIN = 5;
const INDEX_ACTIVE_MIN = 3;

export interface ItemForSummary {
  isClosed: boolean;
  resultType: string | null;
  apslAssAmt: number;
  winBidPrc: number | null;
  resultDate: Date | null;
}
export interface AuctionSummaryResult {
  activeCount: number; closedCount: number; soldCount: number;
  avgBidRate: number | null; avgApslAmt: number | null; avgWinBidPrc: number | null;
  failRate: number | null; latestResultDate: Date | null; isIndexable: boolean;
}

export function computeAuctionSummary(items: ItemForSummary[]): AuctionSummaryResult {
  let activeCount = 0, closedCount = 0, soldCount = 0, failedCount = 0;
  const rates: number[] = []; const apsls: number[] = []; const wins: number[] = [];
  let latest: Date | null = null;
  for (const it of items) {
    if (it.isClosed) {
      closedCount++;
      if (it.resultType === 'sold') {
        soldCount++;
        if (it.apslAssAmt > 0 && it.winBidPrc != null && it.winBidPrc > 0) {
          rates.push((it.winBidPrc / it.apslAssAmt) * 100);
          wins.push(it.winBidPrc);
        }
        if (it.apslAssAmt > 0) apsls.push(it.apslAssAmt);
      } else if (it.resultType === 'failed') {
        failedCount++;
      }
      if (it.resultDate && (!latest || it.resultDate > latest)) latest = it.resultDate;
    } else {
      activeCount++;
    }
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);
  const avgBidRate = round2(avg(rates));
  const failRate = closedCount > 0 ? round2((failedCount / closedCount) * 100) : null;
  const isIndexable = soldCount >= INDEX_SOLD_MIN || closedCount >= INDEX_CLOSED_MIN || activeCount >= INDEX_ACTIVE_MIN;
  return {
    activeCount, closedCount, soldCount, avgBidRate,
    avgApslAmt: avg(apsls) != null ? Math.round(avg(apsls)!) : null,
    avgWinBidPrc: avg(wins) != null ? Math.round(avg(wins)!) : null,
    failRate, latestResultDate: latest, isIndexable,
  };
}

// --- Task 6: mapDetailResult + refreshAuctionSummary + syncAuctionSnapshot + main ---

export interface DetailResultRaw { scsbidAmt?: string; pbctCltrStatNm?: string; rsltDtm?: string; }
export interface MappedResult {
  isClosed: boolean; resultType: string | null; winBidPrc: bigint | null;
  bidRate: number | null; resultDate: Date | null; status: string;
}
export function mapDetailResult(d: DetailResultRaw, apslAssAmt: bigint | null): MappedResult {
  const stat = String(d.pbctCltrStatNm ?? '').trim();
  const win = parseBigIntOrNull(d.scsbidAmt);
  const resultDate = parseDtm(d.rsltDtm);
  if (win && win > 0n) {
    const bidRate = apslAssAmt && apslAssAmt > 0n
      ? Math.round((Number(win) / Number(apslAssAmt)) * 100 * 100) / 100 : null;
    return { isClosed: true, resultType: 'sold', winBidPrc: win, bidRate, resultDate, status: 'sold' };
  }
  if (/유찰/.test(stat)) return { isClosed: true, resultType: 'failed', winBidPrc: null, bidRate: null, resultDate, status: 'failed' };
  if (/취소|해제|중지/.test(stat)) return { isClosed: true, resultType: 'cancelled', winBidPrc: null, bidRate: null, resultDate, status: 'cancelled' };
  return { isClosed: true, resultType: null, winBidPrc: null, bidRate: null, resultDate, status: 'closed' };
}

export async function refreshAuctionSummary(): Promise<void> {
  const groups = await prisma.auctionItem.findMany({
    select: { bjdCode: true, usageGroup: true, city: true, district: true },
    distinct: ['bjdCode', 'usageGroup'],
    where: { bjdCode: { not: '' } },
  });
  for (const g of groups) {
    const rows = await prisma.auctionItem.findMany({
      where: { bjdCode: g.bjdCode, usageGroup: g.usageGroup },
      select: { isClosed: true, resultType: true, apslAssAmt: true, winBidPrc: true, resultDate: true },
    });
    const summary = computeAuctionSummary(rows.map((r) => ({
      isClosed: r.isClosed, resultType: r.resultType,
      apslAssAmt: r.apslAssAmt ? Number(r.apslAssAmt) : 0,
      winBidPrc: r.winBidPrc ? Number(r.winBidPrc) : null,
      resultDate: r.resultDate,
    })));
    await prisma.auctionAreaSummary.upsert({
      where: { bjdCode_usageGroup: { bjdCode: g.bjdCode, usageGroup: g.usageGroup } },
      create: { bjdCode: g.bjdCode, usageGroup: g.usageGroup, city: g.city, district: g.district,
        ...toSummaryData(summary) },
      update: { city: g.city, district: g.district, ...toSummaryData(summary) },
    });
  }
  console.info(`[auction] AreaSummary 갱신: ${groups.length}개 (시군구×용도)`);
}
function toSummaryData(s: ReturnType<typeof computeAuctionSummary>) {
  return {
    activeCount: s.activeCount, closedCount: s.closedCount, soldCount: s.soldCount,
    avgBidRate: s.avgBidRate, avgApslAmt: s.avgApslAmt != null ? BigInt(s.avgApslAmt) : null,
    avgWinBidPrc: s.avgWinBidPrc != null ? BigInt(s.avgWinBidPrc) : null,
    failRate: s.failRate, latestResultDate: s.latestResultDate, isIndexable: s.isIndexable,
  };
}

// 반환: clean=true면 전 재산유형×수의여부 스냅샷이 에러 없이 완료됨(마감포착 안전).
async function syncAuctionSnapshot(serviceKey: string, runStart: Date,
  regionMap: Map<string, { city: string; district: string }>, stats: SyncStats): Promise<boolean> {
  let clean = true;
  for (const prptDivCd of PRPT_DIV_CODES) {
    for (const pvctTrgtYn of ['N', 'Y']) {
      let pageNo = 1;
      for (;;) {
        let res;
        try {
          res = await fetchOnbidList(serviceKey, prptDivCd, pvctTrgtYn, pageNo, 100);
        } catch (e) {
          console.error(`[auction] 목록 호출 실패 ${prptDivCd}/${pvctTrgtYn}/p${pageNo}: ${e instanceof Error ? e.message : e}`);
          clean = false; break; // 이 조합 중단 — 부분 실패 표시
        }
        if (res.resultCode !== '00') { // API 오류 → 부분 실패(빈 결과와 구분)
          if (res.resultCode !== '03' /* NODATA가 아닌 진짜 오류 */) clean = false;
          break;
        }
        if (res.items.length === 0) break; // 정상 종료
        const enriched = res.items.map((it) => {
          const ldCd = String((it as Record<string, unknown>).ldCd ?? '').slice(0, 5);
          const region = regionMap.get(ldCd) ?? { city: '', district: '' };
          return { ...it, city: region.city, district: region.district, pvctTrgtYn: pvctTrgtYn === 'Y' };
        }) as unknown as RawAuctionItem[];
        const records = transformAndDedupe(enriched, (it) => transformAuctionItem(it, runStart), (r) => r!.sourceId, stats);
        await batchUpsert(records, async (record) => {
          const r = record as NonNullable<ReturnType<typeof transformAuctionItem>>;
          const existing = await prisma.auctionItem.findUnique({ where: { cltrMngNo: r.cltrMngNo }, select: { id: true, isClosed: true } });
          if (existing?.isClosed) return 'updated'; // 마감 물건은 active로 되돌리지 않음
          // ⚠️ landArea/bldArea/dongName/pvctTrgtYn은 절대 drop하지 말 것(MAJOR #2 회귀 방지).
          //   lat/lng만 string→number 변환 위해 분리, 나머지는 ...rest로 전부 전달.
          //   Decimal? 컬럼(landArea/bldArea)은 land와 동일하게 string|null 그대로 Prisma에 전달 가능.
          const { lat, lng, ...rest } = r;
          const data = { ...rest, lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null };
          await prisma.auctionItem.upsert({
            where: { cltrMngNo: r.cltrMngNo },
            create: { ...data, firstSeenAt: runStart, lastSeenAt: runStart, syncedAt: new Date() },
            update: { ...data, lastSeenAt: runStart, syncedAt: new Date() },
          });
          return existing ? 'updated' : 'new';
        });
        if (res.items.length < 100) break;
        pageNo++;
      }
    }
  }
  return clean;
}

async function captureClosedItems(serviceKey: string, runStart: Date): Promise<void> {
  // 이번 런에서 안 보인(=목록서 사라진) 미마감 물건 = 마감 후보
  const candidates = await prisma.auctionItem.findMany({
    where: { isClosed: false, lastSeenAt: { lt: runStart } },
    select: { cltrMngNo: true, pbctCdtnNo: true, apslAssAmt: true },
    take: 2000,
  });
  let closed = 0;
  for (const c of candidates) {
    try {
      const res = await fetchOnbidDetail(serviceKey, c.cltrMngNo, c.pbctCdtnNo);
      const d = (res.items[0] ?? {}) as DetailResultRaw;
      const mapped = mapDetailResult(d, c.apslAssAmt);
      await prisma.auctionItem.update({
        where: { cltrMngNo: c.cltrMngNo },
        data: { isClosed: mapped.isClosed, resultType: mapped.resultType, winBidPrc: mapped.winBidPrc,
          bidRate: mapped.bidRate, resultDate: mapped.resultDate ?? runStart, status: mapped.status, syncedAt: new Date() },
      });
      closed++;
    } catch (e) {
      console.error(`[auction] 마감포착 실패 ${c.cltrMngNo}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.info(`[auction] 마감 포착: ${closed}/${candidates.length}`);
}

async function main(): Promise<void> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';
  if (!serviceKey) throw new Error('OPENAPI_SERVICE_KEY is not set');
  const regions = await prisma.region.findMany({ select: { bjdCode: true, city: true, district: true } });
  const regionMap = new Map(regions.map((r) => [r.bjdCode.slice(0, 5), { city: r.city, district: r.district }]));
  await runSync(CATEGORY, async (stats) => {
    const runStart = new Date();
    const clean = await syncAuctionSnapshot(serviceKey, runStart, regionMap, stats);
    // GAP 방지: 스냅샷이 부분 실패하면 "사라진 물건"을 신뢰할 수 없으므로 마감포착 건너뜀
    // (살아있는 물건을 오인 마감 처리하는 사고 방지). 다음 정상 런에서 포착됨.
    if (clean) await captureClosedItems(serviceKey, runStart);
    else console.warn('[auction] 스냅샷 부분 실패 → 마감포착 스킵(다음 런에서 재시도)');
    await refreshAuctionSummary();
  });
  console.info('\n=== auction sync completed ===');
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const guardMinutes = Number(process.env.SYNC_GUARD_MINUTES) || 20;
  installRuntimeGuard({ maxMinutes: guardMinutes, name: 'syncAuction', prisma });
  main().catch((e) => { console.error('Fatal error:', e); process.exit(1); });
}
