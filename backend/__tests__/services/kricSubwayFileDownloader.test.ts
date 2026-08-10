import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import ExcelJS from 'exceljs';
import {
  cellToString,
  csvEscape,
  buildSubwayCsvFromXlsx,
  ensureLatestSubwayCsv,
  SUBWAY_HEADERS,
} from '../../src/services/kricSubwayFileDownloader.js';

async function makeXlsx(
  rows: Array<Record<string, unknown>>,
  headers: readonly string[] = SUBWAY_HEADERS
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('표준데이터 역사');
  ws.addRow([...headers]);
  for (const row of rows) {
    ws.addRow(headers.map((h) => row[h] ?? ''));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

function stationRow(i: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    역번호: `S${100 + i}`,
    역사명: `역${i}`,
    노선번호: 'L1',
    노선명: '1호선',
    영문역사명: `Station${i}`,
    한자역사명: '驛',
    환승역구분: '일반역',
    역위도: 37.5 + i * 0.001,
    역경도: 127.0,
    운영기관명: '서울교통공사',
    역사도로명주소: `서울시 중구 세종대로 ${i}`,
    역사전화번호: '02-000-0000',
    데이터기준일자: new Date(2026, 5, 30),
    ...overrides,
  };
}

describe('cellToString', () => {
  it('Date 를 YYYY-MM-DD 로 변환한다', () => {
    expect(cellToString(new Date(2026, 5, 30))).toBe('2026-06-30');
  });

  it('null/undefined 는 빈 문자열', () => {
    expect(cellToString(null)).toBe('');
    expect(cellToString(undefined)).toBe('');
  });

  it('숫자는 그대로 문자열화한다 (좌표 정밀도 유지)', () => {
    expect(cellToString(37.51612526331)).toBe('37.51612526331');
  });
});

describe('csvEscape', () => {
  it('쉼표 포함 필드를 인용한다', () => {
    expect(csvEscape('서울, 중구')).toBe('"서울, 중구"');
  });

  it('따옴표는 이중화한다', () => {
    expect(csvEscape('역"별칭"')).toBe('"역""별칭"""');
  });

  it('일반 필드는 그대로 둔다', () => {
    expect(csvEscape('서울역')).toBe('서울역');
  });
});

describe('buildSubwayCsvFromXlsx', () => {
  it('xlsx 를 기존 subway.csv 포맷(BOM+헤더+LF)으로 변환한다', async () => {
    const xlsx = await makeXlsx([stationRow(1), stationRow(2)]);
    const { csv, rows } = await buildSubwayCsvFromXlsx(xlsx);
    expect(rows).toBe(2);
    const text = csv.toString('utf-8');
    expect(text.charCodeAt(0)).toBe(0xfeff); // BOM
    const lines = text.slice(1).split('\n');
    expect(lines[0]).toBe(SUBWAY_HEADERS.join(','));
    expect(lines[1]).toContain('S101,역1,L1,1호선');
    expect(lines[1]).toContain('2026-06-30'); // Date → YYYY-MM-DD
  });

  it('빈 행은 건너뛴다', async () => {
    const empty = Object.fromEntries(SUBWAY_HEADERS.map((h) => [h, '']));
    const xlsx = await makeXlsx([stationRow(1), empty, stationRow(2)]);
    const { rows } = await buildSubwayCsvFromXlsx(xlsx);
    expect(rows).toBe(2);
  });

  it('헤더가 누락되면 예외를 던진다 (스키마 변경 fail-closed)', async () => {
    const badHeaders = SUBWAY_HEADERS.filter((h) => h !== '역위도');
    const xlsx = await makeXlsx([stationRow(1)], badHeaders);
    await expect(buildSubwayCsvFromXlsx(xlsx)).rejects.toThrow('역위도');
  });
});

describe('ensureLatestSubwayCsv', () => {
  let dir: string;
  let target: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kric-test-'));
    target = path.join(dir, 'subway.csv');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function mockFetch(buf: Buffer, status = 200) {
    return vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      arrayBuffer: () => Promise.resolve(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
    }) as unknown as typeof fetch;
  }

  it('정상 xlsx 를 받아 CSV 로 저장한다 (updated)', async () => {
    const xlsx = await makeXlsx(Array.from({ length: 950 }, (_, i) => stationRow(i)));
    const result = await ensureLatestSubwayCsv(mockFetch(xlsx), target);
    expect(result.status).toBe('updated');
    expect(result.rows).toBe(950);
    expect(fs.existsSync(target)).toBe(true);
  });

  it('같은 데이터 재실행 시 unchanged (멱등)', async () => {
    const xlsx = await makeXlsx(Array.from({ length: 950 }, (_, i) => stationRow(i)));
    await ensureLatestSubwayCsv(mockFetch(xlsx), target);
    const result = await ensureLatestSubwayCsv(mockFetch(xlsx), target);
    expect(result.status).toBe('unchanged');
  });

  it('행 수 하한 미만이면 기존 파일을 보존한다', async () => {
    fs.writeFileSync(target, 'old-data');
    const xlsx = await makeXlsx([stationRow(1)]);
    const result = await ensureLatestSubwayCsv(mockFetch(xlsx), target);
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('행 수 부족');
    expect(fs.readFileSync(target, 'utf-8')).toBe('old-data');
  });

  it('HTML 오류 페이지(zip 매직 불일치)는 거부한다', async () => {
    fs.writeFileSync(target, 'old-data');
    const html = Buffer.from('<!DOCTYPE html><html>error</html>', 'utf-8');
    const result = await ensureLatestSubwayCsv(mockFetch(html), target);
    expect(result.status).toBe('failed');
    expect(fs.readFileSync(target, 'utf-8')).toBe('old-data');
  });

  it('HTTP 오류 시 기존 파일을 보존한다', async () => {
    fs.writeFileSync(target, 'old-data');
    const result = await ensureLatestSubwayCsv(mockFetch(Buffer.from(''), 500), target);
    expect(result.status).toBe('failed');
    expect(result.reason).toContain('500');
    expect(fs.readFileSync(target, 'utf-8')).toBe('old-data');
  });
});
