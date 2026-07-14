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
