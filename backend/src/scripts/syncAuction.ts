#!/usr/bin/env tsx
// 온비드 부동산 공매 동기화 — 일일 스냅샷 + 마감포착 archive
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
import { runSync, batchUpsert, transformAndDedupe, type SyncStats } from '../services/baseSyncService.js';
import { fetchOnbidList, fetchOnbidDetail, NORMAL_CODE } from '../services/onbidBase.js';
import { toUsageGroup } from '../services/auctionUsage.js';

const CATEGORY = 'auction';

// 온비드 차세대 API 재산유형코드 (prptDivCd) — 실거래 부동산 전용 서비스이므로 전 유형 수집
export const PRPT_DIV_CODES = [
  '0007', // 압류재산
  '0010', // 국유재산
  '0005', // 기타일반재산
  '0002', // 공유재산
  '0003', // 금융권담보재산
  '0004', // 불용품
  '0006', // 유입재산
  '0008', // 수탁재산
  '0011', // 공공개발재산
  '0013', // 파산자산
];

// 차세대 OnbidRlstListSrvc2 API 실제 필드명 (라이브 검증 완료)
export interface RawAuctionItem extends Record<string, unknown> {
  cltrMngNo: string;       // 물건관리번호 "2019-02917-004"
  pbctCdtnNo: unknown;     // 공매조건번호 NUMBER 6001661
  onbidPbancNo?: unknown;  // 공고번호 NUMBER → plnmNo
  onbidCltrNm?: string;    // 소재지/물건명
  cltrUsgMclsCtgrNm?: string; // 용도 대분류 "토지"
  cltrUsgSclsCtgrNm?: string; // 용도 소분류 "임야"
  prptDivNm?: string;      // 재산유형 "압류재산"
  dspsMthodNm?: string;    // 처분방법 "매각"
  landSqms?: unknown;      // 토지면적(㎡) NUMBER
  bldSqms?: unknown;       // 건물면적(㎡) NUMBER
  apslEvlAmt?: unknown;    // 감정평가금액 NUMBER → apslAssAmt (DB 필드명 유지)
  lowstBidPrcIndctCont?: string; // 최저입찰가 STRING "5236000"
  usbdNft?: unknown;       // 유찰횟수 NUMBER
  pbctNsq?: string;        // 입찰회차 STRING "035"
  cltrBidBgngDt?: string;  // 입찰시작일시 "202610061400"
  cltrBidEndDt?: string;   // 입찰종료일시 "202610071700"
  orgNm?: string;          // 기관명
  pvctTrgtYn?: string;     // 공매예외여부 per-item "Y"/"N"
  ltnoPnu?: string;        // 지번 PNU (19자리)
  rdnmPnu?: string;        // 도로명 PNU (fallback)
  lctnSdnm?: string;       // 소재지 시도명 (fallback city)
  lctnSggnm?: string;      // 소재지 시군구명 (fallback district)
  lctnEmdNm?: string;      // 소재지 읍면동명 → dongName
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

  const address = String(item.onbidCltrNm ?? '').trim();

  // 용도: 대분류+소분류 조합 → usageGroup
  const mCls = String(item.cltrUsgMclsCtgrNm ?? '').trim();
  const sCls = String(item.cltrUsgSclsCtgrNm ?? '').trim();
  const usage = [mCls, sCls].filter(Boolean).join(' ') || null;

  // bjdCode: ltnoPnu 앞 5자리(시군구코드). 없으면 rdnmPnu fallback, 그래도 없으면 ''
  const pnu = String(item.ltnoPnu ?? '').trim() || String(item.rdnmPnu ?? '').trim();
  const bjdCode = pnu.length >= 5 ? pnu.slice(0, 5) : '';

  const bidBeginDtm = parseDtm(item.cltrBidBgngDt);
  const bidCloseDtm = parseDtm(item.cltrBidEndDt);
  // 활성 목록(입찰중/예정) 물건은 'closed'로 판정하지 않는다.
  // 종료일이 지났어도 목록에 남아 있으면 재공고/다음 회차 대기 상태이므로 진행/예정으로 둔다.
  // 진짜 마감(낙찰/유찰/취소)은 목록에서 사라질 때 captureClosedItems가 설정한다.
  const status = bidBeginDtm && bidBeginDtm > now ? 'scheduled' : 'ongoing';

  // 면적: 0이면 null로 정규화
  const landSqms = parseIntOrNull(item.landSqms);
  const bldSqms = parseIntOrNull(item.bldSqms);

  return {
    sourceId: `${CATEGORY}-${cltrMngNo}`,
    cltrMngNo,
    pbctCdtnNo: String(item.pbctCdtnNo ?? '').trim(),
    plnmNo: item.onbidPbancNo ? String(item.onbidPbancNo).trim() || null : null,
    city: String((item as { city?: string }).city ?? '').trim(),         // enrich가 regionMap/lctnSdnm으로 주입한 값
    district: String((item as { district?: string }).district ?? '').trim(), // 동일
    bjdCode,
    dongName: String(item.lctnEmdNm ?? '').trim() || null,
    address,
    usage,
    usageGroup: toUsageGroup(usage),
    propertyType: String(item.prptDivNm ?? '').trim() || null,
    dpslMtdNm: String(item.dspsMthodNm ?? '').trim() || null,
    landArea: landSqms != null && landSqms > 0 ? String(landSqms) : null,
    bldArea: bldSqms != null && bldSqms > 0 ? String(bldSqms) : null,
    apslAssAmt: parseBigIntOrNull(item.apslEvlAmt),
    minBidPrc: parseBigIntOrNull(item.lowstBidPrcIndctCont),
    failCnt: parseIntOrNull(item.usbdNft) ?? 0,
    bidRound: parseIntOrNull(item.pbctNsq),
    bidBeginDtm,
    bidCloseDtm,
    orgNm: String(item.orgNm ?? '').trim() || null,
    pvctTrgtYn: item.pvctTrgtYn === 'Y',  // per-item 필드; 주입 불필요
    status,
    lat: null as string | null,  // 좌표는 차세대 API 미제공 — geocoding 별도 follow-up
    lng: null as string | null,
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

// 회차별 이전입찰결과 항목 (prcnBidClgList 각 entry)
export interface PrcnBidClgEntry {
  pbctNsq?: string;                  // 회차
  pbctsn?: string;                   // 공매일련번호
  cltrOpbdDt?: string;               // 개찰일시 "202401111100"
  pbctStatNm?: string;               // 상태명 "취소"/"유찰"/"낙찰"/"매각"...
  lowstBidPrcIndctCont?: string;     // 회차 최저가 string
  scfbAmt?: unknown;                 // 낙찰가 추정 (null when not sold)
  apslPrcCtrsLowstBidRto?: unknown;  // 감정가 대비 최저가 비율
  frstCtrsLowstBidPrcRto?: unknown;  // 최초 최저가 대비 비율
}

export interface DetailItemRaw {
  prcnBidClgList?: PrcnBidClgEntry | PrcnBidClgEntry[] | '';
  [key: string]: unknown;
}

export interface MappedResult {
  isClosed: boolean; resultType: string | null; winBidPrc: bigint | null;
  bidRate: number | null; resultDate: Date | null; status: string;
}

export function mapDetailResult(detailItem: DetailItemRaw, apslAssAmt: bigint | null): MappedResult {
  // prcnBidClgList: 회차별 이전입찰결과 배열. 빈 문자열/undefined → 결과 없음
  const raw = detailItem?.prcnBidClgList;
  let entries: PrcnBidClgEntry[] = [];
  if (Array.isArray(raw)) entries = raw;
  else if (raw && typeof raw === 'object') entries = [raw];
  // 빈 배열이면 아직 개찰 전이거나 데이터 없음
  if (entries.length === 0) {
    return { isClosed: true, resultType: null, winBidPrc: null, bidRate: null, resultDate: null, status: 'closed' };
  }
  // 최신 회차 = cltrOpbdDt(개찰일시) 문자열 최대값
  const latest = entries.reduce((a, b) =>
    String(b.cltrOpbdDt ?? '') > String(a.cltrOpbdDt ?? '') ? b : a
  );
  const stat = String(latest.pbctStatNm ?? '').trim();
  // scfbAmt(낙찰가) 필드명은 실 낙찰 케이스로 추후 확정 — 유찰/취소는 정확, 낙찰가는 best-effort
  const win = parseBigIntOrNull(latest.scfbAmt);
  const resultDate = parseDtm(latest.cltrOpbdDt);

  if ((win && win > 0n) || /낙찰|매각/.test(stat)) {
    const bidRate = win && apslAssAmt && apslAssAmt > 0n
      ? Math.round((Number(win) / Number(apslAssAmt)) * 100 * 100) / 100
      : null;
    return { isClosed: true, resultType: 'sold', winBidPrc: win, bidRate, resultDate, status: 'sold' };
  }
  if (/유찰/.test(stat)) {
    return { isClosed: true, resultType: 'failed', winBidPrc: null, bidRate: null, resultDate, status: 'failed' };
  }
  if (/취소|해제|중지|취하/.test(stat)) {
    return { isClosed: true, resultType: 'cancelled', winBidPrc: null, bidRate: null, resultDate, status: 'cancelled' };
  }
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
  const PAGE_SIZE = 1000; // 일일 트래픽=호출횟수 제한이므로 페이지를 크게(1000) 잡아 호출 수 최소화(API 허용 확인)
  for (const prptDivCd of PRPT_DIV_CODES) {
    for (const pvctTrgtYn of ['N', 'Y']) {
      let pageNo = 1;
      for (;;) {
        // 일시적 오류(timeout/5xx/일시 오류코드)는 즉시 포기하지 않고 재시도 — 한 번의 hiccup으로
        // 해당 재산유형 전체를 건너뛰던 회귀 방지(로컬 첫 수집에서 73k→23k 손실 원인).
        let res: Awaited<ReturnType<typeof fetchOnbidList>> | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            res = await fetchOnbidList(serviceKey, prptDivCd, pvctTrgtYn, pageNo, PAGE_SIZE);
          } catch (e) {
            console.error(`[auction] 목록 호출 실패 ${prptDivCd}/${pvctTrgtYn}/p${pageNo} (시도 ${attempt}/3): ${e instanceof Error ? e.message : e}`);
            res = null;
          }
          if (res && (res.resultCode === NORMAL_CODE || res.resultCode === '03')) break;
          if (res) console.error(`[auction] 목록 오류 ${prptDivCd}/${pvctTrgtYn}/p${pageNo} resultCode=${res.resultCode} (시도 ${attempt}/3)`);
          if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
        if (!res || (res.resultCode !== NORMAL_CODE && res.resultCode !== '03')) { clean = false; break; }
        if (res.resultCode === '03' || res.items.length === 0) break;
        const enriched = res.items.map((it) => {
          const raw = it as RawAuctionItem;
          // bjdCode: ltnoPnu 앞 5자리 우선, fallback rdnmPnu
          const pnu = String(raw.ltnoPnu ?? '').trim() || String(raw.rdnmPnu ?? '').trim();
          const bjd5 = pnu.length >= 5 ? pnu.slice(0, 5) : '';
          const region = regionMap.get(bjd5);
          // region 없으면 API 제공 lctnSdnm/lctnSggnm fallback
          const city = region?.city ?? String(raw.lctnSdnm ?? '').trim();
          const district = region?.district ?? String(raw.lctnSggnm ?? '').trim();
          return { ...it, city, district } as unknown as RawAuctionItem;
        });
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
        if (res.items.length < PAGE_SIZE) break;
        pageNo++;
      }
    }
  }
  return clean;
}

async function captureClosedItems(serviceKey: string, runStart: Date): Promise<void> {
  const candidates = await prisma.auctionItem.findMany({
    where: { isClosed: false, lastSeenAt: { lt: runStart } },
    select: { cltrMngNo: true, pbctCdtnNo: true, apslAssAmt: true },
    take: 2000,
  });
  let closed = 0;
  for (const c of candidates) {
    try {
      const res = await fetchOnbidDetail(serviceKey, c.cltrMngNo, c.pbctCdtnNo);
      const detailItem = (res.items[0] ?? {}) as DetailItemRaw;
      const mapped = mapDetailResult(detailItem, c.apslAssAmt);
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
