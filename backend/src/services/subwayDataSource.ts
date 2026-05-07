/**
 * 지하철역 표준데이터 CSV → DB transform 파이프라인.
 *
 * 데이터 출처: data.go.kr 전국도시철도역사정보표준데이터 (국토교통부)
 *  - data.go.kr "전국도시철도역사정보표준데이터" — API 미제공, CSV 다운로드만 가능
 *  - backend/prisma/data/subway.csv 위치에 commit
 */

import * as fs from 'fs';
import { parse } from 'csv-parse';
import * as iconv from 'iconv-lite';
import { KOREA_BOUNDS } from '../constants/index.js';
import { slugifyStation } from '../utils/subwaySlug.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT } from './cityMapping.js';

export interface SubwayCsvRow {
  '역번호': string;
  '역사명': string;
  '노선번호': string;
  '노선명': string;
  '영문역사명': string;
  '한자역사명': string;
  '환승역구분': string;
  '환승노선번호': string;
  '환승노선명': string;
  '역위도': string;
  '역경도': string;
  '운영기관명': string;
  '역사도로명주소': string;
  '역사전화번호': string;
  '데이터기준일자': string;
  [key: string]: string | undefined;
}

export interface TransformedSubwayStation {
  id: string;
  sourceId: string;
  name: string;
  nameSlug: string;
  line: string;
  transferLines: string | null;
  operator: string | null;
  lat: number;
  lng: number;
  address: string | null;
  roadAddress: string | null;
  city: string | null;
  district: string | null;
  regionSlug: string | null;
  phoneNumber: string | null;
  dataDate: string | null;
}

const CITY_NORMALIZE_MAP: Record<string, string> = {
  '서울특별시': '서울',
  '부산광역시': '부산',
  '대구광역시': '대구',
  '인천광역시': '인천',
  '광주광역시': '광주',
  '대전광역시': '대전',
  '울산광역시': '울산',
  '세종특별자치시': '세종',
  '경기도': '경기',
  '강원도': '강원',
  '강원특별자치도': '강원',
  '충청북도': '충북',
  '충청남도': '충남',
  '전라북도': '전북',
  '전북특별자치도': '전북',
  '전라남도': '전남',
  '경상북도': '경북',
  '경상남도': '경남',
  '제주특별자치도': '제주',
};

const FULL_NAME_SET = new Set(Object.values(CITY_SLUG_TO_FULL));
const SHORT_NAME_SET = new Set(Object.values(CITY_SLUG_TO_SHORT));

function detectEncoding(buffer: Buffer): 'euc-kr' | 'utf8' {
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return 'utf8';

  let utf8Score = 0;
  let eucKrScore = 0;
  let invalidUtf8 = 0;

  for (let i = 0; i < Math.min(buffer.length, 2000); i++) {
    const byte = buffer[i];
    if (byte >= 0xe0 && byte <= 0xef && i + 2 < buffer.length) {
      const b2 = buffer[i + 1];
      const b3 = buffer[i + 2];
      if ((b2 >= 0x80 && b2 <= 0xbf) && (b3 >= 0x80 && b3 <= 0xbf)) {
        utf8Score += 3;
        i += 2;
        continue;
      } else {
        invalidUtf8++;
      }
    }
    if (byte >= 0xa1 && byte <= 0xfe && i + 1 < buffer.length) {
      const next = buffer[i + 1];
      if (next >= 0xa1 && next <= 0xfe) {
        eucKrScore += 2;
        i += 1;
        continue;
      }
    }
  }

  if (invalidUtf8 > 5) return 'euc-kr';
  return utf8Score >= eucKrScore ? 'utf8' : 'euc-kr';
}

export async function parseSubwayCSV(filePath: string): Promise<SubwayCsvRow[]> {
  return new Promise((resolve, reject) => {
    const buffer = fs.readFileSync(filePath);
    const encoding = detectEncoding(buffer);

    let content: string;
    if (encoding === 'euc-kr') {
      content = iconv.decode(buffer, 'euc-kr');
    } else {
      content = buffer.toString('utf8');
      if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);
    }

    const rows: SubwayCsvRow[] = [];
    parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
      relax_column_count: true,
    })
      .on('data', (row: SubwayCsvRow) => rows.push(row))
      .on('error', (err: Error) => reject(err))
      .on('end', () => resolve(rows));
  });
}

function parseCityDistrict(roadAddress: string): { city: string | null; district: string | null } {
  const trimmed = (roadAddress ?? '').trim();
  if (!trimmed) return { city: null, district: null };

  const parts = trimmed.split(/\s+/);
  let city: string | null = null;
  let district: string | null = null;

  for (const part of parts) {
    if (!city && (FULL_NAME_SET.has(part) || SHORT_NAME_SET.has(part))) {
      city = CITY_NORMALIZE_MAP[part] ?? part;
      continue;
    }
    if (city && !district && /[시군구]$/.test(part)) {
      district = part;
      break;
    }
  }

  return { city, district };
}

function findRegionSlug(city: string | null): string | null {
  if (!city) return null;
  const slug = Object.entries(CITY_SLUG_TO_SHORT).find(([, short]) => short === city)?.[0];
  return slug ?? null;
}

function compositeSourceId(stationCode: string, lineCode: string): string {
  return `${stationCode}-${lineCode}`;
}

function buildTransferLines(row: SubwayCsvRow): string | null {
  const raw = (row['환승노선명'] ?? '').trim();
  if (!raw) return null;

  // 한 셀에 여러 줄/슬래시로 나열되는 케이스 — 분리 후 normalize
  const lines = raw
    .split(/[\n,/·]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (lines.length === 0) return null;
  return JSON.stringify(lines);
}

export interface TransformContext {
  takenSlugs: Set<string>;
  takenSourceIds: Set<string>;
}

export function createTransformContext(): TransformContext {
  return {
    takenSlugs: new Set(),
    takenSourceIds: new Set(),
  };
}

export function transformSubwayRow(
  row: SubwayCsvRow,
  ctx: TransformContext,
): TransformedSubwayStation | null {
  const stationCode = (row['역번호'] ?? '').trim();
  const koreanName = (row['역사명'] ?? '').trim();
  const lineCode = (row['노선번호'] ?? '').trim();
  const lineName = (row['노선명'] ?? '').trim();
  const englishName = (row['영문역사명'] ?? '').trim();
  const latStr = (row['역위도'] ?? '').trim();
  const lngStr = (row['역경도'] ?? '').trim();
  const operator = (row['운영기관명'] ?? '').trim() || null;
  const roadAddress = (row['역사도로명주소'] ?? '').trim();
  const phoneNumberRaw = (row['역사전화번호'] ?? '').trim();
  const phoneNumber = phoneNumberRaw && phoneNumberRaw !== '-' ? phoneNumberRaw : null;
  const dataDate = (row['데이터기준일자'] ?? '').trim() || null;

  if (!stationCode || !koreanName || !lineName) return null;

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);
  if (isNaN(lat) || isNaN(lng)) return null;
  if (lat < KOREA_BOUNDS.LAT_MIN || lat > KOREA_BOUNDS.LAT_MAX) return null;
  if (lng < KOREA_BOUNDS.LNG_MIN || lng > KOREA_BOUNDS.LNG_MAX) return null;

  const sourceId = compositeSourceId(stationCode, lineCode);
  if (ctx.takenSourceIds.has(sourceId)) return null;
  ctx.takenSourceIds.add(sourceId);

  const nameSlug = slugifyStation({
    englishName,
    koreanName,
    lineName,
    lineNumber: lineCode,
    takenSlugs: ctx.takenSlugs,
  });

  const { city, district } = parseCityDistrict(roadAddress);
  const regionSlug = findRegionSlug(city);
  const transferLines = buildTransferLines(row);

  const cleanedRoadAddress = roadAddress.replace(/\s+/g, ' ').trim() || null;

  return {
    id: `subway-${sourceId}`,
    sourceId,
    name: koreanName,
    nameSlug,
    line: lineName,
    transferLines,
    operator,
    lat,
    lng,
    address: cleanedRoadAddress,
    roadAddress: cleanedRoadAddress,
    city,
    district,
    regionSlug,
    phoneNumber,
    dataDate,
  };
}

export function transformAll(rows: SubwayCsvRow[]): {
  stations: TransformedSubwayStation[];
  skipped: number;
} {
  const ctx = createTransformContext();
  const stations: TransformedSubwayStation[] = [];
  let skipped = 0;

  for (const row of rows) {
    const t = transformSubwayRow(row, ctx);
    if (t) stations.push(t);
    else skipped++;
  }

  return { stations, skipped };
}
