/**
 * AdSense 커버리지(채움률/unfill) 진단 리포트 (읽기 전용, 온디맨드)
 *
 * AD_REQUESTS_COVERAGE(= MATCHED_AD_REQUESTS / AD_REQUESTS)를 기기·포맷·광고단위·URL채널
 * 차원으로 분해해 "어디서 광고가 안 채워지는지"를 실측한다. DB 변경 없음.
 *
 * 인증: backend/.env 의 ADSENSE_CLIENT_ID / ADSENSE_CLIENT_SECRET / ADSENSE_REFRESH_TOKEN
 * (OAuth2 3-legged — AdSense는 서비스 계정 미지원)
 *
 * Usage:
 *   npm run report:adsense-coverage                 # 최근 30일
 *   npm run report:adsense-coverage -- --range LAST_7_DAYS
 *   npm run report:adsense-coverage -- --range MONTH_TO_DATE --top 20
 */
import 'dotenv/config';

import { google } from 'googleapis';

// AdSense Management API v2 의 유효한 ReportingDateRange 값만 허용
// (TODAY/YESTERDAY/MONTH_TO_DATE/YEAR_TO_DATE/LAST_7_DAYS/LAST_30_DAYS/CUSTOM)
type RangeEnum = 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'MONTH_TO_DATE' | 'YEAR_TO_DATE';

const CORE_METRICS = [
  'AD_REQUESTS',
  'MATCHED_AD_REQUESTS',
  'AD_REQUESTS_COVERAGE',
  'IMPRESSIONS',
  'CLICKS',
  'ESTIMATED_EARNINGS',
];

const BREAKDOWNS: Array<{ dim: string; label: string }> = [
  { dim: 'PLATFORM_TYPE_NAME', label: '기기(플랫폼)' },
  { dim: 'AD_FORMAT_NAME', label: '광고 포맷' },
  { dim: 'AD_UNIT_NAME', label: '광고 단위' },
  { dim: 'URL_CHANNEL_NAME', label: 'URL 채널(페이지 그룹)' },
];

interface Args {
  range: RangeEnum;
  top: number;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  let range: RangeEnum = 'LAST_30_DAYS';
  let top = 15;

  const rangeIdx = argv.indexOf('--range');
  if (rangeIdx !== -1 && argv[rangeIdx + 1]) {
    const v = argv[rangeIdx + 1].toUpperCase();
    const allowed: RangeEnum[] = ['LAST_7_DAYS', 'LAST_30_DAYS', 'MONTH_TO_DATE', 'YEAR_TO_DATE'];
    if ((allowed as string[]).includes(v)) range = v as RangeEnum;
    else console.warn(`⚠️ 알 수 없는 --range "${v}", 기본값 LAST_30_DAYS 사용 (허용: ${allowed.join(', ')})`);
  }

  const topIdx = argv.indexOf('--top');
  if (topIdx !== -1 && argv[topIdx + 1]) {
    const parsed = parseInt(argv[topIdx + 1], 10);
    if (!isNaN(parsed) && parsed > 0) top = parsed;
  }

  return { range, top };
}

type Row = Record<string, string | undefined>;

interface ReportData {
  headers?: Array<{ name?: string | null; currencyCode?: string | null }> | null;
  rows?: Array<{ cells?: Array<{ value?: string | null }> | null }> | null;
  totals?: { cells?: Array<{ value?: string | null }> | null } | null;
}

function rowsToObjects(data: ReportData): Row[] {
  const headers = (data.headers ?? []).map((h) => h.name ?? '');
  return (data.rows ?? []).map((r) => {
    const o: Row = {};
    (r.cells ?? []).forEach((c, i) => {
      if (headers[i]) o[headers[i]] = c.value ?? undefined;
    });
    return o;
  });
}

function totalsToObject(data: ReportData): Row {
  const headers = (data.headers ?? []).map((h) => h.name ?? '');
  const o: Row = {};
  (data.totals?.cells ?? []).forEach((c, i) => {
    if (headers[i]) o[headers[i]] = c.value ?? undefined;
  });
  return o;
}

function currencyOf(data: ReportData): string {
  return data.headers?.find((h) => h.currencyCode)?.currencyCode ?? '';
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};
const int = (v: string | undefined): string => num(v).toLocaleString('en-US');
const pct = (v: string | undefined): string => `${(num(v) * 100).toFixed(2)}%`;
const money = (v: string | undefined, cur: string): string => `${num(v).toFixed(2)} ${cur}`.trim();

// 터미널 표시 폭(한글·전각·이모지는 2칸) 기준 정렬 — String.length는 한글을 1로 세어 어긋남
function dispWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    const wide =
      (c >= 0x1100 && c <= 0x115f) ||
      (c >= 0x2e80 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe4f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) ||
      (c >= 0x1f300 && c <= 0x1faff);
    w += wide ? 2 : 1;
  }
  return w;
}
function truncToWidth(s: string, w: number): string {
  let out = '';
  let cur = 0;
  for (const ch of s) {
    const cw = dispWidth(ch);
    if (cur + cw > w - 1) return out + '…';
    out += ch;
    cur += cw;
  }
  return out;
}
const pad = (s: string, w: number): string => {
  const d = dispWidth(s);
  return d >= w ? s : s + ' '.repeat(w - d);
};
const padL = (s: string, w: number): string => {
  const d = dispWidth(s);
  return d >= w ? s : ' '.repeat(w - d) + s;
};

async function generate(
  adsense: ReturnType<typeof google.adsense>,
  account: string,
  range: RangeEnum,
  dimensions: string[],
): Promise<ReportData> {
  const { data } = await adsense.accounts.reports.generate({
    account,
    dateRange: range,
    metrics: CORE_METRICS,
    dimensions,
  });
  return data as ReportData;
}

function printSummary(totals: Row, cur: string): void {
  const cov = num(totals.AD_REQUESTS_COVERAGE);
  const impCtr = num(totals.IMPRESSIONS) > 0 ? num(totals.CLICKS) / num(totals.IMPRESSIONS) : 0;
  console.log('\n═══════════════ 전체 요약 ═══════════════');
  console.log(`  광고 요청(AD_REQUESTS)      : ${int(totals.AD_REQUESTS)}`);
  console.log(`  채워진 요청(MATCHED)        : ${int(totals.MATCHED_AD_REQUESTS)}`);
  console.log(`  ▶ 커버리지(채움률)          : ${pct(totals.AD_REQUESTS_COVERAGE)}  (미충전 ${((1 - cov) * 100).toFixed(2)}%)`);
  console.log(`  노출(IMPRESSIONS)           : ${int(totals.IMPRESSIONS)}`);
  console.log(`  클릭(CLICKS)                : ${int(totals.CLICKS)}  (노출CTR ${(impCtr * 100).toFixed(2)}%)`);
  console.log(`  추정 수익                   : ${money(totals.ESTIMATED_EARNINGS, cur)}`);
}

function printBreakdown(
  label: string,
  dim: string,
  rows: Row[],
  cur: string,
  top: number,
  overallCoverage: number,
): void {
  console.log(`\n──────── ${label} 별 커버리지 ────────`);
  if (rows.length === 0) {
    if (dim === 'URL_CHANNEL_NAME') {
      console.log('  (설정된 URL 채널 없음 — AdSense에서 URL 채널을 만들면 페이지 그룹별 분석 가능)');
    } else {
      console.log('  (데이터 없음)');
    }
    return;
  }

  // 요청량 큰 순으로 정렬(영향 큰 세그먼트 우선)
  const sorted = [...rows].sort((a, b) => num(b.AD_REQUESTS) - num(a.AD_REQUESTS));
  const shown = sorted.slice(0, top);

  const nameW = Math.min(
    28,
    Math.max(dispWidth('세그먼트'), ...shown.map((r) => dispWidth(r[dim] ?? '(미지정)'))),
  );
  console.log(
    `  ${pad('세그먼트', nameW)}  ${padL('요청', 11)}  ${padL('채움', 11)}  ${padL('커버리지', 9)}  ${padL('수익', 12)}`,
  );
  for (const r of shown) {
    const name = r[dim] ?? '(미지정)';
    console.log(
      `  ${pad(dispWidth(name) > nameW ? truncToWidth(name, nameW) : name, nameW)}  ` +
        `${padL(int(r.AD_REQUESTS), 11)}  ${padL(int(r.MATCHED_AD_REQUESTS), 11)}  ` +
        `${padL(pct(r.AD_REQUESTS_COVERAGE), 9)}  ${padL(money(r.ESTIMATED_EARNINGS, cur), 12)}`,
    );
  }
  if (sorted.length > shown.length) {
    console.log(`  … 외 ${sorted.length - shown.length}개 세그먼트 생략 (--top 로 더 보기)`);
  }

  // 유의미한 볼륨(전체 요청의 5% 이상) 중 최저 커버리지가 전체 평균보다 낮으면 강조
  const totalReq = sorted.reduce((s, r) => s + num(r.AD_REQUESTS), 0);
  const threshold = totalReq * 0.05;
  const meaningful = sorted.filter((r) => num(r.AD_REQUESTS) >= threshold);
  const worst = meaningful.reduce<Row | null>(
    (min, r) =>
      min === null || num(r.AD_REQUESTS_COVERAGE) < num(min.AD_REQUESTS_COVERAGE) ? r : min,
    null,
  );
  if (worst && num(worst.AD_REQUESTS_COVERAGE) < overallCoverage) {
    const unfilled = num(worst.AD_REQUESTS) - num(worst.MATCHED_AD_REQUESTS);
    console.log(
      `  ⚠️ 최저 커버리지(볼륨≥5%): "${worst[dim] ?? '(미지정)'}" = ${pct(worst.AD_REQUESTS_COVERAGE)} ` +
        `(전체 ${pct(String(overallCoverage))} 대비 낮음) → 요청 ${int(worst.AD_REQUESTS)}건 중 ${int(String(unfilled))}건 미충전`,
    );
  }
}

async function main() {
  const { range, top } = parseArgs();

  const clientId = process.env.ADSENSE_CLIENT_ID;
  const clientSecret = process.env.ADSENSE_CLIENT_SECRET;
  const refreshToken = process.env.ADSENSE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    console.error(
      '❌ ADSENSE_CLIENT_ID / ADSENSE_CLIENT_SECRET / ADSENSE_REFRESH_TOKEN 환경 변수가 필요합니다.',
    );
    process.exit(1);
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
  oauth2.setCredentials({ refresh_token: refreshToken });
  const adsense = google.adsense({ version: 'v2', auth: oauth2 });

  // 계정 확인 (env 우선, 없으면 첫 계정)
  let account = process.env.ADSENSE_ACCOUNT ?? '';
  if (!account) {
    const { data } = await adsense.accounts.list();
    account = data.accounts?.[0]?.name ?? '';
  }
  if (!account) {
    console.error('❌ AdSense 계정을 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`\n🔎 AdSense 커버리지 진단  |  계정 ${account}  |  기간 ${range}`);

  // 전체 요약
  const summary = await generate(adsense, account, range, []);
  const summaryTotals = totalsToObject(summary);
  const cur = currencyOf(summary);
  printSummary(summaryTotals, cur);
  const overallCov = num(summaryTotals.AD_REQUESTS_COVERAGE);

  // 차원별 분해
  for (const b of BREAKDOWNS) {
    try {
      const data = await generate(adsense, account, range, [b.dim]);
      printBreakdown(b.label, b.dim, rowsToObjects(data), currencyOf(data) || cur, top, overallCov);
    } catch (e) {
      console.warn(`\n──────── ${b.label} ────────\n  ⚠️ 조회 실패: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // 일자별 커버리지 추세(하락 감지)
  try {
    const data = await generate(adsense, account, range, ['DATE']);
    const rows = rowsToObjects(data);
    console.log('\n──────── 일자별 커버리지 추세 ────────');
    for (const r of rows) {
      const cov = num(r.AD_REQUESTS_COVERAGE);
      const bar = '█'.repeat(Math.round(cov * 20));
      console.log(`  ${r.DATE ?? '?'}  ${padL(pct(r.AD_REQUESTS_COVERAGE), 8)}  ${bar}`);
    }
  } catch (e) {
    console.warn(`  ⚠️ 추세 조회 실패: ${e instanceof Error ? e.message : String(e)}`);
  }

  console.log('\n✅ 완료. (읽기 전용 — 저장/변경 없음)');
}

main().catch((err) => {
  console.error('❌ 실행 실패:', err);
  process.exit(1);
});
