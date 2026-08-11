// KRIC 레일포털 도시철도 역사정보 xlsx → subway.csv 자동 변환
//
// 전국도시철도역사정보표준데이터의 실제 제공처는 data.go.kr 이 아니라
// 국가철도공단 레일포털(data.kric.go.kr)이다. 다운로드는 로그인·세션 없는
// 고정 GET (2026-08-11 실측, 파일명 예: 전체_도시철도역사정보_20260630.xlsx).
//
// xlsx 를 exceljs 로 읽어 기존 subway.csv 와 동일한 포맷(UTF-8 BOM, 15컬럼,
// LF)으로 변환해 저장한다 — 파서(subwayDataSource.parseSubwayCSV)와 sourceId
// 파이프라인은 무변경.

import path from 'path';
import { fileURLToPath } from 'url';
import ExcelJS from 'exceljs';
import { replaceFileIfChanged, type LocaldataFileResult } from './localdataFileDownloader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_PATH = path.resolve(__dirname, '../../prisma/data/subway.csv');

const DOWNLOAD_URL = 'https://data.kric.go.kr/rips/dataset/download.file?type=filedata&id=32&operation=1';
const REFERER = 'https://data.kric.go.kr/rips/M_01_01/detail.do?id=32';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DOWNLOAD_TIMEOUT_MS = 120_000;

// 기존 subway.csv 헤더와 동일한 순서 — CSV 출력 순서의 기준.
export const SUBWAY_HEADERS = [
  '역번호',
  '역사명',
  '노선번호',
  '노선명',
  '영문역사명',
  '한자역사명',
  '환승역구분',
  '환승노선번호',
  '환승노선명',
  '역위도',
  '역경도',
  '운영기관명',
  '역사도로명주소',
  '역사전화번호',
  '데이터기준일자',
] as const;

// 2026-08 실측 1,099역 — 절단·빈 응답 fail-closed 하한.
const MIN_ROWS = 900;

/** exceljs 셀 값 → CSV 문자열. 날짜 셀은 기존 CSV 형식(YYYY-MM-DD)으로 맞춘다. */
export function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('');
    if ('text' in value && typeof value.text === 'string') return value.text;
    if ('result' in value) return cellToString(value.result as ExcelJS.CellValue);
    return String(value);
  }
  return String(value);
}

export function csvEscape(field: string): string {
  if (/[",\n\r]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * KRIC xlsx 버퍼를 subway.csv 포맷으로 변환한다.
 * 헤더가 기대와 다르면(제공처 스키마 변경) 예외 — fail-closed.
 */
export async function buildSubwayCsvFromXlsx(xlsxBuffer: Buffer): Promise<{ csv: Buffer; rows: number }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsxBuffer as unknown as ArrayBuffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('워크시트 없음');

  const headerRow = sheet.getRow(1);
  const headerByCol = new Map<string, number>();
  headerRow.eachCell((cell, col) => {
    headerByCol.set(cellToString(cell.value).trim(), col);
  });

  const missing = SUBWAY_HEADERS.filter((h) => !headerByCol.has(h));
  if (missing.length > 0) {
    throw new Error(`헤더 누락: ${missing.join(', ')} — 제공처 스키마 변경 여부 확인 필요`);
  }

  const lines: string[] = [SUBWAY_HEADERS.join(',')];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const fields = SUBWAY_HEADERS.map((h) => cellToString(row.getCell(headerByCol.get(h)!).value).trim());
    if (fields.every((f) => f === '')) continue; // 빈 행 스킵
    lines.push(fields.map(csvEscape).join(','));
  }

  const rows = lines.length - 1;
  // 기존 파일과 동일하게 UTF-8 BOM + LF
  const csv = Buffer.from('﻿' + lines.join('\n'), 'utf-8');
  return { csv, rows };
}

/** KRIC 에서 xlsx 를 받아 subway.csv 를 최신화한다. 실패 시 기존 파일 보존. */
export async function ensureLatestSubwayCsv(
  fetchFn: typeof fetch = fetch,
  targetPath: string = TARGET_PATH
): Promise<LocaldataFileResult> {
  try {
    const response = await fetchFn(DOWNLOAD_URL, {
      headers: { 'User-Agent': USER_AGENT, Referer: REFERER, 'Accept-Language': 'ko-KR,ko;q=0.9' },
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error(`[kric] subway: 다운로드 실패 HTTP ${response.status} — 기존 파일 유지`);
      return { category: 'subway', status: 'failed', reason: `HTTP ${response.status}` };
    }

    const xlsxBuffer = Buffer.from(await response.arrayBuffer());
    // xlsx(zip) 매직바이트 확인 — HTML 오류 페이지 차단
    if (xlsxBuffer.length < 4 || xlsxBuffer.readUInt16BE(0) !== 0x504b) {
      console.error('[kric] subway: xlsx 아님(zip 매직 불일치) — 기존 파일 유지');
      return { category: 'subway', status: 'failed', reason: 'xlsx 형식 아님' };
    }

    const { csv, rows } = await buildSubwayCsvFromXlsx(xlsxBuffer);
    if (rows < MIN_ROWS) {
      console.error(`[kric] subway: 행 수 부족(${rows} < ${MIN_ROWS}) — 기존 파일 유지`);
      return { category: 'subway', status: 'failed', reason: `행 수 부족 (${rows} < ${MIN_ROWS})` };
    }

    const status = replaceFileIfChanged(targetPath, csv);
    console.info(
      status === 'unchanged'
        ? `[kric] subway: 변경 없음 (${rows.toLocaleString()}행)`
        : `[kric] subway: 갱신 완료 (${rows.toLocaleString()}행)`
    );
    return { category: 'subway', status, rows };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[kric] subway: 오류(${msg}) — 기존 파일 유지`);
    return { category: 'subway', status: 'failed', reason: msg };
  }
}
