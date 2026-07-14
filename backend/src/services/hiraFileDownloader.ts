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
// 그라운드 트루스(2026-07-14, sno=11925 라이브 캡처 기준): 포털이 로드하는 실제
// DEXT5 업로더 클라이언트 코드(/dext5upload/js/dext5upload.js, /dext5upload/js/dext5upload.core.js)와
// 서버 설정(/dext5upload/config/dext5upload.config.xml, encrypt_param=1)을 역추적해 확정했다.
// (설계 문서의 "\t/\v 구분자·EUC-KR" 가정은 틀렸음 — 아래가 실측 정정본.)
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
// 3) 라이브 스모크(fileSno=326801, 2026.6 분기)로 실제 서버에 POST해 정확히
//    64,452,916바이트 application/zip(선언된 fileSize와 100% 일치)을 수신해 검증 완료.
//    (adm-zip로 12개 xlsx 엔트리 UTF-8 파일명 정상 파싱까지 확인.)

const HANDLER_URL =
  'https://opendata.hira.or.kr/dext5upload/handler/upload.dx?callType=download&url=/op/opc/selectOpenData.do';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

// DEXT5 trans_unitAttributeDelimiter/trans_unitDelimiter 기본값 (Dext5Upload_Config 실측)
const ATTR_DELIM = '\f'; // 0x0C — 필드명<AttrDelim>필드값
const UNIT_DELIM = '\x0B'; // 0x0B(\v) — ...필드값<UnitDelim>다음필드명...

// dext5upload.core.js downloadFile()의 makeGuid()를 재현한 임의 토큰(d07).
// 서버가 값 자체를 검증하지 않는 진행률 상관용 토큰으로 보이나(파일 선택은 d25로 결정),
// 실제 클라이언트와 동일한 포맷(8-4-4-4-12 대문자 hex-like)으로 생성한다.
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
