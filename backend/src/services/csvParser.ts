// @TASK T2.1 - CSV 파싱 공통 모듈
// @SPEC docs/planning/02-trd.md#데이터-동기화

import * as fs from 'fs';
import { parse } from 'csv-parse';
import * as iconv from 'iconv-lite';
import { createHash } from 'crypto';

// CSV 로우 타입 정의
export interface ToiletCSVRow {
  '화장실명': string;
  '소재지도로명주소': string;
  '소재지지번주소': string;
  '위도': string;
  '경도': string;
  '운영시간상세': string;
  '남성용-대변기수'?: string;
  '남성용-소변기수'?: string;
  '여성용-대변기수'?: string;
  '장애인용대변기유무'?: string;
  '개방시간'?: string;
  '관리기관명'?: string;
  [key: string]: string | undefined;
}

// Facility 변환 결과 타입
export interface TransformedFacility {
  id: string;
  category: 'toilet';
  name: string;
  address: string;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  sourceId: string;
  details: {
    operatingHours: string;
    maleToilets: number;
    maleUrinals: number;
    femaleToilets: number;
    hasDisabledToilet: boolean;
    openTime: string;
    managingOrg: string;
  };
}

/**
 * CSV 파일 인코딩 감지
 * EUC-KR 또는 UTF-8 자동 감지
 */
function detectEncoding(buffer: Buffer): 'euc-kr' | 'utf8' {
  // BOM 체크 (UTF-8 with BOM)
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf8';
  }

  let utf8Score = 0;
  let eucKrScore = 0;
  let invalidUtf8 = 0;

  for (let i = 0; i < Math.min(buffer.length, 2000); i++) {
    const byte = buffer[i];

    // UTF-8 3바이트 시퀀스 (한글) - 0xE0-0xEF로 시작
    if (byte >= 0xe0 && byte <= 0xef && i + 2 < buffer.length) {
      const b2 = buffer[i + 1];
      const b3 = buffer[i + 2];
      if ((b2 >= 0x80 && b2 <= 0xbf) && (b3 >= 0x80 && b3 <= 0xbf)) {
        utf8Score += 3; // 3바이트 한글 매치
        i += 2;
        continue;
      } else {
        invalidUtf8++;
      }
    }

    // UTF-8 2바이트 시퀀스 - 0xC0-0xDF로 시작
    if (byte >= 0xc0 && byte <= 0xdf && i + 1 < buffer.length) {
      const b2 = buffer[i + 1];
      if (b2 >= 0x80 && b2 <= 0xbf) {
        utf8Score += 2;
        i += 1;
        continue;
      } else {
        invalidUtf8++;
      }
    }

    // EUC-KR 범위 체크 (0xA1-0xFE 2바이트 쌍)
    if (byte >= 0xa1 && byte <= 0xfe && i + 1 < buffer.length) {
      const next = buffer[i + 1];
      if (next >= 0xa1 && next <= 0xfe) {
        eucKrScore += 2;
        i += 1;
        continue;
      }
    }
  }

  // UTF-8 invalid sequence가 많으면 EUC-KR로 판단
  if (invalidUtf8 > 5) {
    return 'euc-kr';
  }

  return utf8Score >= eucKrScore ? 'utf8' : 'euc-kr';
}

/**
 * CSV 파일을 파싱하여 ToiletCSVRow 배열 반환
 */
export async function parseToiletCSV(filePath: string): Promise<ToiletCSVRow[]> {
  return new Promise((resolve, reject) => {
    const buffer = fs.readFileSync(filePath);
    const encoding = detectEncoding(buffer);

    let content: string;
    if (encoding === 'euc-kr') {
      content = iconv.decode(buffer, 'euc-kr');
    } else {
      content = buffer.toString('utf8');
      // BOM 제거
      if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
      }
    }

    const rows: ToiletCSVRow[] = [];

    parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
      relaxQuotes: true,
    })
      .on('data', (row: ToiletCSVRow) => {
        rows.push(row);
      })
      .on('error', (err: Error) => {
        reject(err);
      })
      .on('end', () => {
        resolve(rows);
      });
  });
}

/**
 * 주소에서 시/도, 구/군 추출
 */
function parseAddress(address: string): { city: string; district: string } {
  const parts = address.trim().split(/\s+/);
  const city = parts[0] || '';
  const district = parts[1] || '';

  return { city, district };
}

/**
 * sourceId 생성 (해시 기반)
 */
function generateSourceId(name: string, lat: string, lng: string): string {
  const input = `${name}-${lat}-${lng}`;
  return createHash('md5').update(input).digest('hex').substring(0, 16);
}

/**
 * CSV 로우를 Facility 형식으로 변환
 */
export function transformToiletRow(row: ToiletCSVRow): TransformedFacility | null {
  const name = row['화장실명']?.trim() || '';
  const roadAddress = row['소재지도로명주소']?.trim() || '';
  const jibunAddress = row['소재지지번주소']?.trim() || '';
  const latStr = row['위도']?.trim() || '';
  const lngStr = row['경도']?.trim() || '';

  // 필수 필드 검증
  if (!name) {
    return null;
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  // 주소 결정 (도로명 우선, 없으면 지번)
  const primaryAddress = roadAddress || jibunAddress;
  if (!primaryAddress) {
    return null;
  }

  const { city, district } = parseAddress(primaryAddress);

  if (!city || !district) {
    return null;
  }

  const sourceId = generateSourceId(name, latStr, lngStr);
  const facilityId = `toilet-${sourceId}`;

  // 상세 정보
  const details = {
    operatingHours: row['운영시간상세']?.trim() || '',
    maleToilets: parseInt(row['남성용-대변기수'] || '0', 10) || 0,
    maleUrinals: parseInt(row['남성용-소변기수'] || '0', 10) || 0,
    femaleToilets: parseInt(row['여성용-대변기수'] || '0', 10) || 0,
    hasDisabledToilet: row['장애인용대변기유무'] === 'Y',
    openTime: row['개방시간']?.trim() || '',
    managingOrg: row['관리기관명']?.trim() || '',
  };

  return {
    id: facilityId,
    category: 'toilet',
    name,
    address: jibunAddress || roadAddress,
    roadAddress: roadAddress || null,
    lat,
    lng,
    city,
    district,
    sourceId,
    details,
  };
}

export default {
  parseToiletCSV,
  transformToiletRow,
};
