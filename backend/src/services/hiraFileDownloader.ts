import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface HiraFileRef {
  fileSno: string;
  filePath: string; // /shared/data/uploadFiles/file/<UUID>.zip
  fileName: string; // 표시 파일명 (예: 전국 병의원 및 약국 현황 2026.6.zip)
}

// 포털 상세 페이지(opendata.hira.or.kr) HTML에서 "전국 병의원 및 약국 현황"의
// 최신 분기(최대 fileSno)를 추출한다.
//
// 실제 페이지 구조(2026-07-14, sno=11925 캡처 기준. __tests__/services/fixtures/hira-portal.html 참고):
//   1) 다운로드 링크 목록 — fileSno 후보:
//      <a href="javascript:fn_fileDown('326801');"> 전국 병의원 및 약국 현황 2026.6.zip</a>
//   2) DEXT5 업로더 프리뷰 스크립트 — 서버 파일경로/파일명은 여기에만 존재:
//      DEXT5UPLOAD.AddUploadedFile('326801', '전국 병의원 및 약국 현황 2026.6.zip',
//        '/shared/data/uploadFiles/file/<UUID>.zip', '<fileSize>', '326801', uploadID);
//      인자 순서 = (fileSno, fileName, filePath, fileSize, fileSno, uploadID) — 고정 위치.
export function scrapeLatestFile(html: string): HiraFileRef | null {
  // 1) 다운로드 링크의 fileSno 후보 수집
  const snoCandidates = [...html.matchAll(/fn_fileDown\('(\d+)'\)/g)].map((m) => m[1]);
  if (snoCandidates.length === 0) return null;

  // 2) AddUploadedFile(fileSno, fileName, filePath, ...)에서 서버 경로 + 표시 파일명 매핑
  const refBySno = new Map<string, { filePath: string; fileName: string }>();
  const addRe =
    /AddUploadedFile\('(\d+)',\s*'([^']*\.zip)',\s*'(\/shared\/data\/uploadFiles\/file\/[^'"]+\.zip)'/g;
  for (const m of html.matchAll(addRe)) {
    const [, sno, fileName, filePath] = m;
    refBySno.set(sno, { filePath, fileName });
  }

  // 3) 최신 = 두 목록 모두에 존재하는 것 중 최대 fileSno(숫자 비교)
  const latest = snoCandidates
    .filter((sno) => refBySno.has(sno))
    .sort((a, b) => Number(b) - Number(a))[0];
  if (!latest) return null;

  const ref = refBySno.get(latest)!;
  return { fileSno: latest, filePath: ref.filePath, fileName: ref.fileName };
}

// ── DEXT5 다운로드 페이로드 + zip 다운로드 ──────────────────────────────
//
// 아래 프레이밍(1·2)은 포털이 로드하는 실제 DEXT5 업로더 클라이언트 코드
// (/dext5upload/js/dext5upload.js, /dext5upload/js/dext5upload.core.js)와
// 서버 설정(/dext5upload/config/dext5upload.config.xml, encrypt_param=1)을
// 읽고 재현한 것이다. 어느 필드가 서버에 실제로 필수인지 개별 검증한 것은
// 아니고, "이 코드 전체가 실제로 원하는 파일을 받아온다"는 것과 "d00 평문의
// 파일 경로가 서버에서 실제로 쓰인다"는 것만 3)에서 실측으로 확인했다.
//
// 1) dext5upload.core.js의 download_request()가 단일 파일(1개 선택) 다운로드 시 만드는
//    평문 블롭(필드 구분자는 Dext5Upload_Config 기본값):
//      trans_unitAttributeDelimiter = '\f'   (0x0C, key<AttrDelim>value)
//      trans_unitDelimiter          = '\x0B' (0x0B \v, ...value<UnitDelim>nextKey...)
//      평문 = d01\fdownloadRequest\v d10\f<fileNameRuleEx:"_">\v d25\f<filePath>\v d26\f<fileName>\v d07\f<GUID토큰>\v
//    (customValue는 이 블롭에 포함되지 않고, 별도의 최상위 폼 필드로 전송된다.)
// 2) dext5upload.js의 DEXT5UPLOAD.util.makeEncryptParam(평문) — 평문 인코딩은 EUC-KR이 아니라
//    UTF-8(JS 내장 utf8_encode가 표준 UTF-8 바이트 패킹과 동일)이다:
//      b1 = base64(utf8(평문))
//      b2 = base64("R" + b1)              // "R" 접두 + 재차 base64(이중 base64)
//      d00 = b2.replace(/\+/g, "%2B")      // literal '+'만 선제 이스케이프
//    makeEncryptParamFinal은 encrypt_param="1"일 때 폼 필드명을 "d00"으로 고정한다.
//
// 3) 실측 확인 (2026-07-14, fileSno=326801/"2026.6" 분기 대상, 아래 두 가지는
//    각각 독립적으로 라이브 검증한 사실이며 이 이상은 주장하지 않는다):
//
//    a) 이 파일의 downloadHiraZip(ref, cookie)를 수정 없이 그대로 호출하면
//       실제로 정확히 64,452,916바이트의 application/zip을 받는다 — 포털 HTML의
//       AddUploadedFile(...) 선언 크기와 100% 일치, adm-zip으로 12개 xlsx 엔트리
//       UTF-8 파일명까지 정상 파싱 확인.
//
//    b) 판별 실험 — 알려진 리스크로, buildDext5DownloadBody가 d00을
//       URLSearchParams로 직렬화하면서 makeEncryptParam이 미리 이스케이프해둔
//       literal '%2B'를 URLSearchParams.toString()이 다시 '%252B'로
//       재인코딩해 와이어로 내보낸다(서버가 디코드하면 literal '%2B' 문자
//       그대로이지 '+' 문자가 아니다). 이 상태에서도 (a)가 성공하길래, 파일
//       선택을 실제로 좌우하는 게 customValue(fileSno)인지 d00 평문인지
//       확인하기 위해 customValue는 정확한 값으로 두고 d00 평문의 d25(filePath)·
//       d26(fileName)만 존재하지 않는 값으로 오염시켜 동일하게 downloadHiraZip을
//       호출했다. 결과: 정상 zip도 빈 응답도 아니라, 서버가 text/plain으로
//       `[FAIL]` + 이중 base64 인코딩된 "error|020|Error occured on the
//       server side"를 반환했다(downloadHiraZip은 이를 content-type 불일치로
//       throw).
//       → 결론: d00을 서버가 실제로 디코드해서 d25(filePath) 존재 여부를
//         검증/사용한다 — customValue만으로 올바른 파일이 선택되는 게
//         아니다(customValue-driven 아님, d00-driven). 단, 위 %2B→%252B
//         재인코딩 자체는 (a)가 그 상태로 성공했으므로 서버가 관대하게
//         파싱하는 것으로 보이고 문제되지 않는다 — 정확해야 하는 것은 이스케이프
//         방식이 아니라 d00 평문 안의 필드 값(d25/d26)이다.

const HANDLER_URL =
  'https://opendata.hira.or.kr/dext5upload/handler/upload.dx?callType=download&url=/op/opc/selectOpenData.do';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// DEXT5 trans_unitAttributeDelimiter/trans_unitDelimiter 기본값 (Dext5Upload_Config 실측)
const ATTR_DELIM = '\f'; // 0x0C — 필드명<AttrDelim>필드값
const UNIT_DELIM = '\x0B'; // 0x0B(\v) — ...필드값<UnitDelim>다음필드명...

// dext5upload.core.js downloadFile()의 makeGuid()를 재현한 임의 토큰(d07).
// 파일 선택 자체는 d25(filePath)가 좌우함을 실측으로 확인했다(위 3-b 판별 실험).
// d07 값 자체를 서버가 검증하는지는 별도로 테스트하지 않았다(진행률 상관용 토큰으로
// 추정) — 실제 클라이언트와 동일한 포맷(8-4-4-4-12 대문자 hex-like)으로 생성한다.
function makeDownloadToken(): string {
  const seg = (): string => (((1 + Math.random()) * 65536) | 0).toString(16).substring(1);
  return (
    seg() + seg() + '-' + seg() + '-' + seg() + '-' + seg() + '-' + seg() + seg() + seg()
  ).toUpperCase();
}

function base64EncodeUtf8(input: string): string {
  return Buffer.from(input, 'utf-8').toString('base64');
}

// DEXT5UPLOAD.util.makeEncryptParam 재현: base64(utf8(plain)) → "R" 접두 → 재차 base64 → literal '+' 이스케이프
function makeEncryptParam(plain: string): string {
  const first = base64EncodeUtf8(plain);
  const second = base64EncodeUtf8('R' + first);
  return second.replace(/\+/g, '%2B');
}

// DEXT5 다운로드 요청 블롭(d00) + customValue 폼 바디 구성.
export function buildDext5DownloadBody(ref: HiraFileRef): string {
  const token = makeDownloadToken();
  const plain =
    `d01${ATTR_DELIM}downloadRequest${UNIT_DELIM}` +
    `d10${ATTR_DELIM}_${UNIT_DELIM}` +
    `d25${ATTR_DELIM}${ref.filePath}${UNIT_DELIM}` +
    `d26${ATTR_DELIM}${ref.fileName}${UNIT_DELIM}` +
    `d07${ATTR_DELIM}${token}${UNIT_DELIM}`;
  const d00 = makeEncryptParam(plain);
  const params = new URLSearchParams();
  params.set('customValue', ref.fileSno);
  params.set('d00', d00);
  return params.toString();
}

export async function downloadHiraZip(ref: HiraFileRef, cookie: string): Promise<Buffer> {
  const res = await fetch(HANDLER_URL, {
    method: 'POST',
    headers: {
      'User-Agent': BROWSER_UA,
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookie,
    },
    body: buildDext5DownloadBody(ref),
  });
  if (!res.ok) throw new Error(`HIRA download HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('zip') && !ct.includes('octet-stream')) {
    throw new Error(`HIRA download unexpected content-type: ${ct}`);
  }
  // 크기 하한 검증은 여기서 하지 않는다(모의 테스트의 소형 fakeZip을 깨뜨림).
  // 실다운로드 크기 하한 가드는 Task A4 오케스트레이터에서 수행한다.
  return Buffer.from(await res.arrayBuffer());
}

// ── zip 전개 (Task A3) ──────────────────────────────────────────────────
//
// Task A2의 라이브 다운로드 실측(위 downloadHiraZip 코멘트 3-a)으로 확인된 대로,
// 실제 HIRA zip은 UTF-8 general-purpose flag로 저장되어 있어 adm-zip의 기본
// entryName 디코딩이 이미 정확한 한글이다. 별도의 CP949/EUC-KR 디코딩은 하지
// 않는다 — 실증되지 않은 포맷 변경을 미리 가정하는 추측성 분기이며, 향후 HIRA가
// 실제로 레거시 인코딩 zip을 배포하면 그때 그라운드 트루스로 대응한다.
export function extractZipToDir(zip: Buffer, destDir: string): string[] {
  fs.mkdirSync(destDir, { recursive: true });
  const admzip = new AdmZip(zip);
  const written: string[] = [];
  for (const entry of admzip.getEntries()) {
    if (entry.isDirectory) continue;
    const base = path.basename(entry.entryName).normalize('NFC');
    const out = path.join(destDir, base);
    fs.writeFileSync(out, entry.getData());
    written.push(base);
  }
  return written;
}

// ── ensureLatestHiraFiles 오케스트레이션 (Task A4) ──────────────────────
//
// 포털 GET(쿠키+HTML) → scrapeLatestFile → 신선도 게이트(마커=최신 fileSno면
// 스킵) → downloadHiraZip → 크기 하한 검증(다운로드 핸들러가 아닌 여기서 —
// mock 테스트의 소형 fakeZip을 깨뜨리지 않기 위해 Task A2에서 의도적으로
// 미룸) → extractZipToDir → 성공 후에만 마커 갱신.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.resolve(__dirname, '../../prisma/data/extra_hospital_latest');
export const MARKER_PATH = path.join(DATA_DIR, '.hira_filesno');

const PORTAL_URL = 'https://opendata.hira.or.kr/op/opc/selectOpenData.do?sno=11925';

// 실 다운로드 zip 크기 하한(바이트). Task A2 라이브 실측(64,452,916B)보다 훨씬
// 낮게 잡아 향후 분기별 크기 변동을 흡수하되, 서버 오류 응답(수 KB의
// `[FAIL]...` text/plain, 단 content-type 불일치로 downloadHiraZip에서 이미
// throw됨) 및 손상/빈 응답을 잡아내는 안전망 역할을 한다.
const MIN_ZIP_BYTES = 10_000_000;

function readMarker(): string | null {
  try {
    return fs.readFileSync(MARKER_PATH, 'utf-8').trim();
  } catch {
    return null;
  }
}

// Node 20 undici는 여러 Set-Cookie 헤더를 getSetCookie()로 배열 그대로 제공한다
// (Headers.get('set-cookie')는 콤마로 뭉쳐 파싱이 불안정해질 수 있음). 있으면
// 우선 사용하고, 없으면(구버전 폴리필 등) get('set-cookie') 파싱으로 폴백한다.
function extractCookie(headers: Headers): string {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const rawCookies =
    typeof getSetCookie === 'function' ? getSetCookie.call(headers) : null;

  if (rawCookies && rawCookies.length > 0) {
    return rawCookies
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');
  }

  // 폴백: 단일 문자열로 뭉쳐진 set-cookie 헤더를 "다음 key=value 직전"에서 분리
  const combined = headers.get('set-cookie') || '';
  return combined
    .split(/,(?=\s*[\w-]+=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

export async function ensureLatestHiraFiles(): Promise<{ updated: boolean; fileSno?: string }> {
  // 1) 포털 GET → 쿠키 + HTML
  const res = await fetch(PORTAL_URL, { headers: { 'User-Agent': BROWSER_UA } });
  if (!res.ok) throw new Error(`HIRA portal HTTP ${res.status}`);
  const cookie = extractCookie(res.headers);
  const html = await res.text();

  const ref = scrapeLatestFile(html);
  if (!ref) throw new Error('HIRA 포털에서 다운로드 파일을 찾지 못했습니다.');

  // 2) 신선도 게이트 — 마커의 fileSno가 최신과 같으면 다운로드 없이 스킵
  if (readMarker() === ref.fileSno) {
    console.info(`[HIRA] 최신 파일(${ref.fileSno}) 이미 반영됨 — 스킵`);
    return { updated: false, fileSno: ref.fileSno };
  }

  // 3) 다운로드 → 크기 검증 → 전개
  console.info(`[HIRA] 새 분기 파일 다운로드: ${ref.fileName} (fileSno=${ref.fileSno})`);
  const zip = await downloadHiraZip(ref, cookie);
  if (zip.length < MIN_ZIP_BYTES) {
    throw new Error(`HIRA zip too small: ${zip.length} bytes (min ${MIN_ZIP_BYTES})`);
  }
  const names = extractZipToDir(zip, DATA_DIR);
  console.info(`[HIRA] 전개 완료: ${names.length}개 파일`);

  // 4) 성공 후에만 마커 갱신 (실패 시 기존 파일·마커 그대로 유지 — fail-soft 무결성)
  fs.writeFileSync(MARKER_PATH, ref.fileSno);
  return { updated: true, fileSno: ref.fileSno };
}
