#!/usr/bin/env tsx
// 온비드 부동산 공매 동기화 — 일일 스냅샷 + 마감포착 archive
// NOTE: imports for prisma, _runtimeGuard, baseSyncService, onbidBase are deferred to later tasks
// and are omitted here to allow Task 3 tests to run without module-not-found errors.
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
