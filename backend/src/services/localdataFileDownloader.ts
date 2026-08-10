// localdata.go.kr 표준데이터 CSV 자동 다운로드
//
// toilet·wifi 는 공공데이터포털 표준데이터인데 전국 단위 오픈API가 없어
// (표준데이터 페이지 제공형태 = "기관자체에서 다운로드") 지금까지 수동으로
// CSV 를 받아 prisma/data/ 에 갈아끼워 왔다 — 그 결과 데이터가 수개월씩
// 묵는 구조였다. 이 서비스가 hiraFileDownloader 와 같은 역할로 sync 전에
// 원본 파일을 자동 최신화한다.
//
// 다운로드 실측(2026-08-11):
//   GET https://file.localdata.go.kr/file/download/{service}/info
//   - 쿠키/CSRF 불필요, 단 브라우저 UA + Referer 없으면 403
//   - 응답: CSV 본문 (toilet ~15MB 5.3만행 / wifi ~24MB 9.3만행, EUC-KR)
//
// 실패 시 기존 파일을 보존한다(fail-closed) — 다운로드가 막혀도 sync 는
// 직전 데이터로 계속 돈다.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as iconv from 'iconv-lite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../prisma/data');

const DOWNLOAD_BASE = 'https://file.localdata.go.kr/file/download';
const REFERER_BASE = 'https://file.localdata.go.kr/file';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DOWNLOAD_TIMEOUT_MS = 300_000; // wifi 24MB — 느린 회선 여유

export interface LocaldataFileSpec {
  category: string;
  service: string;
  targetPath: string;
  /** 다운로드 본문 검증용 필수 컬럼 — 없으면 HTML 오류 페이지 등으로 판단 */
  requiredHeaders: string[];
  /** 이 미만 행 수면 절단 응답으로 보고 거부 (fail-closed) */
  minRows: number;
}

// minRows 는 2026-08 실측(toilet 53,745 / wifi 92,941)의 ~70% — 정상 변동은
// 통과시키되 절단·빈 응답은 걸러낸다.
export const LOCALDATA_FILE_SPECS: LocaldataFileSpec[] = [
  {
    category: 'toilet',
    service: 'public_restroom_info',
    targetPath: path.join(DATA_DIR, 'toilet.csv'),
    requiredHeaders: ['개방자치단체코드', '관리번호', '화장실명', '소재지도로명주소'],
    minRows: 38_000,
  },
  {
    category: 'wifi',
    service: 'free_wifi_info',
    targetPath: path.join(DATA_DIR, 'wifi.csv'),
    requiredHeaders: ['개방자치단체코드', '관리번호', '설치장소명', 'WGS84위도'],
    minRows: 65_000,
  },
];

export interface CsvValidation {
  ok: boolean;
  rows: number;
  reason?: string;
}

/**
 * 다운로드 본문이 기대하는 CSV 인지 검증한다.
 * 헤더는 UTF-8/EUC-KR 양쪽으로 디코드해 확인한다 (원본은 EUC-KR 이지만
 * 제공처가 인코딩을 바꿔도 파서(csvParser 자동 감지)와 함께 계속 동작).
 */
export function validateCsvBuffer(buffer: Buffer, spec: LocaldataFileSpec): CsvValidation {
  const newlineIdx = buffer.indexOf(0x0a);
  const headerBytes = buffer.subarray(0, newlineIdx === -1 ? Math.min(buffer.length, 4096) : newlineIdx);

  const candidates = [headerBytes.toString('utf-8'), iconv.decode(headerBytes, 'euc-kr')];
  const headerOk = candidates.some((header) => spec.requiredHeaders.every((col) => header.includes(col)));
  if (!headerOk) {
    return { ok: false, rows: 0, reason: `필수 헤더 누락 (${spec.requiredHeaders.join(', ')})` };
  }

  // 데이터 행 수 = 개행 수에서 헤더 몫을 뺀 값. 파일 끝에 개행이 있으면
  // 마지막 개행은 행을 만들지 않으므로 함께 보정한다.
  let newlines = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x0a) newlines++;
  }
  const trailingNewline = buffer.length > 0 && buffer[buffer.length - 1] === 0x0a;
  const dataRows = Math.max(newlines - (trailingNewline ? 1 : 0), 0);

  if (dataRows < spec.minRows) {
    return { ok: false, rows: dataRows, reason: `행 수 부족 (${dataRows} < ${spec.minRows})` };
  }

  return { ok: true, rows: dataRows };
}

export interface LocaldataFileResult {
  category: string;
  status: 'updated' | 'unchanged' | 'failed';
  rows?: number;
  reason?: string;
}

/**
 * 파일 내용이 다를 때만 원자적으로 교체한다 (동일하면 mtime 보존).
 * 교체 시 직전 파일을 `.bak` 으로 남긴다. kricSubwayFileDownloader 와 공용.
 */
export function replaceFileIfChanged(targetPath: string, buffer: Buffer): 'updated' | 'unchanged' {
  const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : null;
  if (existing && existing.equals(buffer)) {
    return 'unchanged';
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (existing) {
    fs.copyFileSync(targetPath, `${targetPath}.bak`);
  }
  const tmpPath = `${targetPath}.tmp`;
  fs.writeFileSync(tmpPath, buffer);
  fs.renameSync(tmpPath, targetPath);
  return 'updated';
}

/**
 * 스펙 목록의 CSV 를 다운로드해 검증 후 교체한다.
 * - 내용 동일 → unchanged (파일 미변경 → mtime 보존, lastmod 오염 없음)
 * - 교체 시 직전 파일을 `.bak` 으로 남긴다
 * - 실패한 파일은 기존 파일 보존, 다른 파일 처리는 계속
 */
export async function ensureLatestLocaldataCsvs(
  specs: LocaldataFileSpec[] = LOCALDATA_FILE_SPECS,
  fetchFn: typeof fetch = fetch
): Promise<{ results: LocaldataFileResult[] }> {
  const results: LocaldataFileResult[] = [];

  for (const spec of specs) {
    try {
      const response = await fetchFn(`${DOWNLOAD_BASE}/${spec.service}/info`, {
        headers: {
          'User-Agent': USER_AGENT,
          Referer: `${REFERER_BASE}/${spec.service}/info`,
          'Accept-Language': 'ko-KR,ko;q=0.9',
        },
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });

      if (!response.ok) {
        results.push({ category: spec.category, status: 'failed', reason: `HTTP ${response.status}` });
        console.error(`[localdata] ${spec.category}: 다운로드 실패 HTTP ${response.status} — 기존 파일 유지`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      const validation = validateCsvBuffer(buffer, spec);
      if (!validation.ok) {
        results.push({ category: spec.category, status: 'failed', reason: validation.reason });
        console.error(`[localdata] ${spec.category}: 검증 실패(${validation.reason}) — 기존 파일 유지`);
        continue;
      }

      const status = replaceFileIfChanged(spec.targetPath, buffer);
      results.push({ category: spec.category, status, rows: validation.rows });
      if (status === 'unchanged') {
        console.info(`[localdata] ${spec.category}: 변경 없음 (${validation.rows.toLocaleString()}행)`);
      } else {
        console.info(
          `[localdata] ${spec.category}: 갱신 완료 (${validation.rows.toLocaleString()}행, ${(buffer.length / 1024 / 1024).toFixed(1)}MB)`
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      results.push({ category: spec.category, status: 'failed', reason: msg });
      console.error(`[localdata] ${spec.category}: 오류(${msg}) — 기존 파일 유지`);
    }
  }

  return { results };
}
