// 건축HUB 대용량 제공 서비스(https://www.hub.go.kr/portal/opn/lps/idx-lgcpt-pvsn-srvc-list.do) 파일 받기.
//
// 매월 20일(휴일이면 다음 날) 전월까지 반영된 전국 파일이 올라온다. 로그인은 필요 없고 브라우저와 같은 순서를 밟는다
// (2026-10-29 실측):
//   1) GET 목록(?pageIndex=N) → 세션 쿠키 + <input name="_csrf">, 행마다 fnDownloadPop('업무구분','업무코드','파일ID')
//   2) POST idx-srvc-hstry-insert.do (이용 목적 기록, 헤더 X-CSRF-TOKEN)
//   3) POST /cmm/fms/fileOpnDown.do (srvrFileNm=파일ID, _csrf) → zip
// 같은 이름의 "폐쇄말소대장" 파일(업무구분 04)이 목록에 섞여 있어 업무구분 03(건축물대장)만 쓴다.

import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

const BASE = 'https://www.hub.go.kr';
const LIST_PAGE = `${BASE}/portal/opn/lps/idx-lgcpt-pvsn-srvc-list.do`;
const PURPOSE_LOG = `${BASE}/portal/opn/lps/idx-srvc-hstry-insert.do`;
const DOWNLOAD = `${BASE}/cmm/fms/fileOpnDown.do`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const PAGE_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 30 * 60_000;
/** 03 업무 행은 2026-10 기준 2~3쪽에 있다. 넉넉히 보되 끝없이 돌지 않는다. */
const MAX_LIST_PAGES = 6;

/** 0303 표제부 · 0302 총괄표제부 · 0306 전유공용면적 */
export type HubTaskCode = '0303' | '0302' | '0306';
const REGISTER_TASK_SE = '03';
const WANTED: HubTaskCode[] = ['0303', '0302', '0306'];

export interface HubFileEntry {
  taskSe: string;
  taskCode: string;
  title: string;
  /** 제목의 "(2026년 09월)" → '2026-09' */
  sourceMonth: string;
  fileId: string;
}

export interface HubSession {
  cookie: string;
  csrf: string;
  entries: HubFileEntry[];
}

type FetchFn = typeof fetch;

export function extractHubCsrf(html: string): string | null {
  const m = html.match(/name="_csrf"\s+value="([^"]+)"/);
  return m ? m[1] : null;
}

export function parseHubFileList(html: string): HubFileEntry[] {
  const titles = new Map<string, string>();
  for (const m of html.matchAll(/fnLgcptPop\('(\d+)','(\d+)','([^']*)'/g)) titles.set(`${m[1]}|${m[2]}`, m[3]);
  const entries: HubFileEntry[] = [];
  for (const m of html.matchAll(/fnDownloadPop\('(\d+)','(\d+)','(OPN\d+)'\)/g)) {
    const title = titles.get(`${m[1]}|${m[2]}`) ?? '';
    const month = title.match(/\((\d{4})년\s*(\d{2})월\)/);
    if (!month) continue;
    entries.push({ taskSe: m[1], taskCode: m[2], title, sourceMonth: `${month[1]}-${month[2]}`, fileId: m[3] });
  }
  return entries;
}

export function findHubFile(entries: HubFileEntry[], taskCode: HubTaskCode): HubFileEntry | null {
  return entries.find((e) => e.taskSe === REGISTER_TASK_SE && e.taskCode === taskCode) ?? null;
}

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

function baseHeaders(cookie: string): Record<string, string> {
  return { 'User-Agent': USER_AGENT, 'Accept-Language': 'ko-KR,ko;q=0.9', Referer: LIST_PAGE, Cookie: cookie };
}

/** 목록 첫 쪽에서 세션을 열고, 03 업무 세 파일이 모두 보일 때까지 다음 쪽을 읽는다. */
export async function openHubSession(fetchFn: FetchFn = fetch): Promise<HubSession> {
  const first = await fetchFn(LIST_PAGE, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ko-KR,ko;q=0.9' },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!first.ok) throw new Error(`건축HUB 목록 열기 실패 HTTP ${first.status}`);
  const html = await first.text();
  const csrf = extractHubCsrf(html);
  if (!csrf) throw new Error('건축HUB 목록 CSRF 토큰을 찾지 못했다 — 페이지 구조 변경 확인 필요');
  const cookie = cookieHeader(first);
  const entries = parseHubFileList(html);

  const complete = () => WANTED.every((code) => findHubFile(entries, code));
  for (let page = 2; page <= MAX_LIST_PAGES && !complete(); page++) {
    const response = await fetchFn(`${LIST_PAGE}?pageIndex=${page}`, {
      headers: baseHeaders(cookie),
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`건축HUB 목록 ${page}쪽 HTTP ${response.status}`);
    entries.push(...parseHubFileList(await response.text()));
  }
  return { cookie, csrf, entries };
}

function fileNameFrom(response: Response): string {
  const disposition = response.headers.get('content-disposition') ?? '';
  const m = disposition.match(/filename="?([^";]+)"?/);
  if (!m) return '';
  try {
    return decodeURIComponent(m[1].replace(/\+/g, ' '));
  } catch {
    return m[1];
  }
}

/** 파일을 메모리에 올리지 않고 destPath 로 흘려 쓴다. */
export async function downloadHubFile(
  session: HubSession,
  entry: HubFileEntry,
  destPath: string,
  fetchFn: FetchFn = fetch,
): Promise<{ bytes: number }> {
  const form = { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' };
  const purpose = await fetchFn(PURPOSE_LOG, {
    method: 'POST',
    headers: { ...baseHeaders(session.cookie), ...form, 'X-CSRF-TOKEN': session.csrf, 'X-Requested-With': 'XMLHttpRequest' },
    body: new URLSearchParams({ opnLgcptTaskSeCd: entry.taskSe, opnTaskCd: entry.taskCode, opnPrcusePrpsCd: '1' }).toString(),
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!purpose.ok) throw new Error(`건축HUB 이용 목적 기록 HTTP ${purpose.status}`);

  const response = await fetchFn(DOWNLOAD, {
    method: 'POST',
    headers: { ...baseHeaders(session.cookie), ...form },
    body: new URLSearchParams({ srvrFileNm: entry.fileId, _csrf: session.csrf }).toString(),
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok || !response.body) throw new Error(`건축HUB 파일(${entry.fileId}) 다운로드 HTTP ${response.status}`);
  const fileName = fileNameFrom(response);
  if (!fileName.includes('건축물대장_')) {
    await response.body.cancel();
    throw new Error(`건축HUB 파일(${entry.fileId})이 건축물대장이 아니다: "${fileName}"`);
  }

  let bytes = 0;
  const source = Readable.fromWeb(response.body as unknown as WebReadableStream);
  source.on('data', (chunk: Buffer) => { bytes += chunk.length; });
  await pipeline(source, createWriteStream(destPath));
  return { bytes };
}
