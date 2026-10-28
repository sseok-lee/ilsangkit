// K-apt 자료실(https://www.k-apt.go.kr/web/board/webReference/boardList.do) 주간 파일 받기.
//
// 자료실은 매주 "K-apt 관리비공개의무단지 기본정보(2026.10.26.)" 같은 글에 전국 xlsx 를 올린다.
// 다운로드 URL 을 직접 GET 하면 "정상적인 접근이 아닙니다"로 돌려보내므로 브라우저와 같은 순서를 밟는다
// (2026-10-28 실측):
//   1) GET boardList.do → 세션 쿠키 + <meta name="_csrf">
//   2) POST boardListAjax.do (scode=탭, _csrf) → 글 목록 HTML
//   3) POST /board/getFileDownload.do?seq=<글번호>&boardType=03 (_csrf, fileNum=1) → xlsx

const BASE = 'https://www.k-apt.go.kr';
const LIST_PAGE = `${BASE}/web/board/webReference/boardList.do`;
const LIST_AJAX = `${BASE}/web/board/webReference/boardListAjax.do`;
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const PAGE_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 180_000;

export type KaptDataset = 'basic' | 'parcel' | 'area';

/** 자료실 탭 코드와 글 제목 키워드 */
const DATASETS: Record<KaptDataset, { tab: string; keyword: string }> = {
  basic: { tab: '01', keyword: '기본정보' },
  parcel: { tab: '02', keyword: '필지고유번호' },
  area: { tab: '04', keyword: '면적정보' },
};

export interface KaptSession {
  cookie: string;
  csrf: string;
}

export interface KaptPost {
  postSeq: number;
  title: string;
  /** 제목 괄호 안 기준일 YYYY-MM-DD. "(2026년)" 처럼 날짜가 아니면 null */
  fileDate: string | null;
}

export interface KaptFile {
  fileName: string;
  buffer: Buffer;
}

type FetchFn = typeof fetch;

export function extractCsrfToken(html: string): string | null {
  const m = html.match(/name="_csrf"\s+content="([^"]+)"/);
  return m ? m[1] : null;
}

export function parseBoardListHtml(html: string): KaptPost[] {
  const posts: KaptPost[] = [];
  for (const m of html.matchAll(/goCheck\((\d+),[^)]*\);">\s*([^<]+?)\s*<\/a>/g)) {
    const title = m[2].trim();
    const d = title.match(/\((\d{4})\.(\d{2})\.(\d{2})\.?\)/);
    posts.push({ postSeq: Number(m[1]), title, fileDate: d ? `${d[1]}-${d[2]}-${d[3]}` : null });
  }
  return posts;
}

export function findLatestPost(posts: KaptPost[], dataset: KaptDataset): KaptPost | null {
  const { keyword } = DATASETS[dataset];
  // 필지고유번호만 제목이 "필지고유번호 정보(…)" 다 (2026-10-26 실측)
  const pattern = new RegExp(`관리비공개의무단지 ${keyword}(?: 정보)?\\(`);
  const candidates = posts.filter((p) => p.fileDate && pattern.test(p.title));
  candidates.sort((a, b) => (b.fileDate! < a.fileDate! ? -1 : b.fileDate! > a.fileDate! ? 1 : b.postSeq - a.postSeq));
  return candidates[0] ?? null;
}

function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

export async function openKaptSession(fetchFn: FetchFn = fetch): Promise<KaptSession> {
  const response = await fetchFn(LIST_PAGE, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'ko-KR,ko;q=0.9' },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`K-apt 자료실 열기 실패 HTTP ${response.status}`);
  const csrf = extractCsrfToken(await response.text());
  if (!csrf) throw new Error('K-apt 자료실 CSRF 토큰을 찾지 못했다 — 페이지 구조 변경 확인 필요');
  return { cookie: cookieHeader(response), csrf };
}

function postHeaders(session: KaptSession): Record<string, string> {
  return {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    Referer: LIST_PAGE,
    Cookie: session.cookie,
  };
}

export async function fetchLatestKaptPost(
  session: KaptSession,
  dataset: KaptDataset,
  fetchFn: FetchFn = fetch,
): Promise<KaptPost | null> {
  const body = new URLSearchParams({
    scode: DATASETS[dataset].tab, boardType: '03', pageNo: '1', stype: '', keyword: '', _csrf: session.csrf,
  });
  const response = await fetchFn(LIST_AJAX, {
    method: 'POST',
    headers: postHeaders(session),
    body: body.toString(),
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`K-apt 자료실 목록(${dataset}) HTTP ${response.status}`);
  return findLatestPost(parseBoardListHtml(await response.text()), dataset);
}

function fileNameFrom(response: Response, postSeq: number): string {
  const disposition = response.headers.get('content-disposition') ?? '';
  const m = disposition.match(/filename="?([^";]+)"?/);
  if (!m) return `kapt-${postSeq}.xlsx`;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

export async function downloadKaptFile(
  session: KaptSession,
  postSeq: number,
  fetchFn: FetchFn = fetch,
): Promise<KaptFile> {
  const response = await fetchFn(`${BASE}/board/getFileDownload.do?seq=${postSeq}&boardType=03`, {
    method: 'POST',
    headers: postHeaders(session),
    body: new URLSearchParams({ _csrf: session.csrf, fileNum: '1' }).toString(),
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`K-apt 파일(${postSeq}) 다운로드 HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  // xlsx(zip) 매직바이트 — 거부 시 HTML 경고 페이지가 200 으로 온다
  if (buffer.length < 4 || buffer.readUInt16BE(0) !== 0x504b) {
    throw new Error(`K-apt 파일(${postSeq})이 xlsx 가 아니다 — 접근 거부 페이지일 가능성`);
  }
  return { fileName: fileNameFrom(response, postSeq), buffer };
}
