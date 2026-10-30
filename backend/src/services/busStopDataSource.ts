// 버스정류장 원본 행 정규화·검증
// odcloud API(JSON)와 비상용 로컬 CSV(--local)가 같은 한글 헤더 키를 쓰므로 같은 정규화를 거친다.

import { parse } from 'csv-parse/sync';
import * as iconv from 'iconv-lite';
import { KOREA_BOUNDS } from '../constants/geo.js';

// 키: 정류장번호·정류장명·위도·경도·정보수집일·모바일단축번호·도시코드·도시명·관리도시명
export type BusStopRawRow = Record<string, unknown>;

export interface BusStopRecord {
  nodeId: string;
  name: string;
  lat: number;
  lng: number;
  mobileId: string | null;
  cityCode: string | null;
  cityName: string | null;
  adminName: string | null;
  collectedAt: string | null;
}

// API 값은 숫자일 수 있어 문자열로 바꾼 뒤 trim, 빈 값은 null
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function coord(v: unknown): number | null {
  const s = str(v);
  if (s === null) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function normalizeBusStopRows(rows: BusStopRawRow[]): {
  records: BusStopRecord[];
  skipped: number;
} {
  const records: BusStopRecord[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const row of rows) {
    const nodeId = str(row['정류장번호']);
    const name = str(row['정류장명']);
    const lat = coord(row['위도']);
    const lng = coord(row['경도']);

    const valid =
      nodeId !== null &&
      name !== null &&
      lat !== null &&
      lng !== null &&
      lat >= KOREA_BOUNDS.LAT_MIN &&
      lat <= KOREA_BOUNDS.LAT_MAX &&
      lng >= KOREA_BOUNDS.LNG_MIN &&
      lng <= KOREA_BOUNDS.LNG_MAX;

    // 중복 정류장번호는 첫 행만 남긴다
    if (!valid || seen.has(nodeId)) {
      skipped += 1;
      continue;
    }
    seen.add(nodeId);

    records.push({
      nodeId,
      name,
      lat,
      lng,
      mobileId: str(row['모바일단축번호']),
      cityCode: str(row['도시코드']),
      cityName: str(row['도시명']),
      adminName: str(row['관리도시명']),
      collectedAt: str(row['정보수집일']),
    });
  }

  return { records, skipped };
}

// 비상용 --local: UTF-8 BOM이 있으면 UTF-8, 없으면 euc-kr(CP949)로 보고 헤더 기준 파싱
export function parseBusStopCsvFile(buf: Buffer): BusStopRawRow[] {
  const hasBom = buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const content = hasBom ? buf.subarray(3).toString('utf8') : iconv.decode(buf, 'euc-kr');

  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true,
  }) as BusStopRawRow[];
}
