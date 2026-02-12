// @TASK T2.1 - CSV 파싱 공통 모듈
// @SPEC docs/planning/02-trd.md#데이터-동기화

import * as fs from 'fs';
import { parse } from 'csv-parse';
import * as iconv from 'iconv-lite';
import { createHash } from 'crypto';
import { KOREA_BOUNDS } from '../constants/index.js';

// CSV 로우 타입 정의
export interface ClothesCSVRow {
  '관리번호': string;
  '설치장소명': string;
  '시도명': string;
  '시군구명': string;
  '소재지도로명주소': string;
  '소재지지번주소': string;
  '위도': string;
  '경도': string;
  '상세위치'?: string;
  '관리기관명'?: string;
  '관리기관전화번호'?: string;
  '데이터기준일자'?: string;
  '제공기관코드'?: string;
  '제공기관명'?: string;
  [key: string]: string | undefined;
}

export interface ToiletCSVRow {
  '화장실명': string;
  '소재지도로명주소': string;
  '소재지지번주소': string;
  'WGS84위도': string;
  'WGS84경도': string;
  '개방시간상세': string;
  '남성용-대변기수'?: string;
  '남성용-소변기수'?: string;
  '여성용-대변기수'?: string;
  '남성용-장애인용대변기수'?: string;
  '여성용-장애인용대변기수'?: string;
  '개방시간'?: string;
  '관리기관명'?: string;
  [key: string]: string | undefined;
}

// Toilet 변환 결과 타입
export interface TransformedToilet {
  id: string;
  name: string;
  address: string;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  city: string;
  district: string;
  sourceId: string;
  // Toilet 전용 필드
  operatingHours: string;
  maleToilets: number;
  maleUrinals: number;
  femaleToilets: number;
  hasDisabledToilet: boolean;
  openTime: string;
  managingOrg: string;
}

// Clothes 변환 결과 타입
export interface TransformedClothes {
  id: string;
  name: string;
  address: string;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  city: string;
  district: string;
  sourceId: string;
  // Clothes 전용 필드
  managementAgency: string;
  phoneNumber: string;
  dataDate: string;
  detailLocation: string;
}

// Parking CSV 로우 타입
export interface ParkingCSVRow {
  '주차장관리번호': string;
  '주차장명': string;
  '주차장구분': string;       // 공영/민영
  '주차장유형': string;       // 노외/노상/부설
  '소재지도로명주소': string;
  '소재지지번주소': string;
  '주차구획수': string;
  '급지구분'?: string;
  '부제시행구분'?: string;
  '운영요일': string;
  '평일운영시작시각': string;
  '평일운영종료시각': string;
  '토요일운영시작시각'?: string;
  '토요일운영종료시각'?: string;
  '공휴일운영시작시각'?: string;
  '공휴일운영종료시각'?: string;
  '요금정보': string;         // 유료/무료
  '주차기본시간': string;
  '주차기본요금': string;
  '추가단위시간': string;
  '추가단위요금': string;
  '1일주차권요금'?: string;
  '월정기권요금'?: string;
  '결제방법'?: string;
  '특기사항'?: string;
  '장애인전용주차구역보유여부'?: string;
  '전화번호'?: string;
  '위도': string;
  '경도': string;
  '관리기관명'?: string;
  [key: string]: string | undefined;
}

// Library CSV 로우 타입
export interface LibraryCSVRow {
  '도서관명': string;
  '시도명': string;
  '시군구명': string;
  '도서관유형': string;
  '휴관일': string;
  '평일운영시작시각': string;
  '평일운영종료시각': string;
  '토요일운영시작시각'?: string;
  '토요일운영종료시각'?: string;
  '공휴일운영시작시각'?: string;
  '공휴일운영종료시각'?: string;
  '열람좌석수': string;
  '자료수(도서)': string;
  '소재지도로명주소': string;
  '운영기관명'?: string;
  '도서관전화번호'?: string;
  '홈페이지주소'?: string;
  '자료수(연속간행물)'?: string;
  '자료수(비도서)'?: string;
  '대출가능권수'?: string;
  '대출가능일수'?: string;
  '위도': string;
  '경도': string;
  [key: string]: string | undefined;
}

// Library 변환 결과 타입
export interface TransformedLibrary {
  id: string;
  name: string;
  address: string;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  city: string;
  district: string;
  sourceId: string;
  // Library 전용 필드
  libraryType: string;
  closedDays: string;
  weekdayOpenTime: string;
  weekdayCloseTime: string;
  saturdayOpenTime: string;
  saturdayCloseTime: string;
  holidayOpenTime: string;
  holidayCloseTime: string;
  seatCount: number;
  bookCount: number;
  serialCount: number;
  nonBookCount: number;
  loanableBooks: number;
  loanableDays: number;
  phoneNumber: string;
  homepageUrl: string;
  operatingOrg: string;
}

// Parking 변환 결과 타입
export interface TransformedParking {
  id: string;
  name: string;
  address: string;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  city: string;
  district: string;
  sourceId: string;
  // Parking 전용 필드
  parkingType: string;
  lotType: string;
  capacity: number;
  baseFee: number | null;
  baseTime: number | null;
  additionalFee: number | null;
  additionalTime: number | null;
  dailyMaxFee: number | null;
  monthlyFee: number | null;
  operatingHours: string;
  phone: string;
  paymentMethod: string;
  remarks: string;
  hasDisabledParking: boolean;
}

// 하위 호환성을 위한 타입 (deprecated - 사용 지양)
export type TransformedFacility = TransformedToilet | TransformedClothes;

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
 * CSV 로우를 Toilet 형식으로 변환
 */
export function transformToiletRow(row: ToiletCSVRow): TransformedToilet | null {
  const name = row['화장실명']?.trim() || '';
  const roadAddress = row['소재지도로명주소']?.trim() || '';
  const jibunAddress = row['소재지지번주소']?.trim() || '';
  const latStr = row['WGS84위도']?.trim() || '';
  const lngStr = row['WGS84경도']?.trim() || '';

  // 필수 필드 검증
  if (!name) {
    return null;
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  // 유효성 검사: NaN 또는 한국 범위 밖의 좌표는 제외
  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  // 한국 좌표 범위 검증
  if (lat < KOREA_BOUNDS.LAT_MIN || lat > KOREA_BOUNDS.LAT_MAX || lng < KOREA_BOUNDS.LNG_MIN || lng > KOREA_BOUNDS.LNG_MAX) {
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
  const toiletId = `toilet-${sourceId}`;

  // 장애인용 대변기 유무 (남성용 또는 여성용 중 하나라도 있으면 true)
  const maleDisabled = parseInt(row['남성용-장애인용대변기수'] || '0', 10) || 0;
  const femaleDisabled = parseInt(row['여성용-장애인용대변기수'] || '0', 10) || 0;
  const hasDisabledToilet = maleDisabled > 0 || femaleDisabled > 0;

  return {
    id: toiletId,
    name,
    address: jibunAddress || roadAddress,
    roadAddress: roadAddress || null,
    lat,
    lng,
    city,
    district,
    sourceId,
    // Toilet 전용 필드
    operatingHours: row['개방시간상세']?.trim() || '',
    maleToilets: parseInt(row['남성용-대변기수'] || '0', 10) || 0,
    maleUrinals: parseInt(row['남성용-소변기수'] || '0', 10) || 0,
    femaleToilets: parseInt(row['여성용-대변기수'] || '0', 10) || 0,
    hasDisabledToilet,
    openTime: row['개방시간']?.trim() || '',
    managingOrg: row['관리기관명']?.trim() || '',
  };
}

/**
 * 시도명 정규화 맵
 */
export const CITY_NAME_MAP: Record<string, string> = {
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

/**
 * 시도명을 짧은 형태로 변환
 */
function normalizeCityName(ctprvnNm: string): string {
  return CITY_NAME_MAP[ctprvnNm] || ctprvnNm;
}

/**
 * CSV 파일을 파싱하여 ClothesCSVRow 배열 반환
 */
export async function parseClothesCSV(filePath: string): Promise<ClothesCSVRow[]> {
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

    const rows: ClothesCSVRow[] = [];

    parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
      relaxQuotes: true,
    })
      .on('data', (row: ClothesCSVRow) => {
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
 * 의류수거함 CSV 로우를 Clothes 형식으로 변환
 * 좌표가 없어도 저장 (null로 처리)
 */
export function transformClothesRow(row: ClothesCSVRow): TransformedClothes | null {
  const mngNo = row['관리번호']?.trim() || '';
  const name = row['설치장소명']?.trim() || '';
  const city = row['시도명']?.trim() || '';
  const district = row['시군구명']?.trim() || '';
  const roadAddress = row['소재지도로명주소']?.trim() || '';
  const jibunAddress = row['소재지지번주소']?.trim() || '';
  const latStr = row['위도']?.trim() || '';
  const lngStr = row['경도']?.trim() || '';

  // 관리번호 없어도 진행 (sourceId 생성 시 대체값 사용)

  // 시도명 정규화
  const normalizedCity = normalizeCityName(city);

  if (!normalizedCity || !district) {
    return null;
  }

  // 좌표 파싱 및 유효성 검사
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  // 좌표가 유효하면 사용, 아니면 null
  const hasValidCoords =
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    lat >= KOREA_BOUNDS.LAT_MIN &&
    lat <= KOREA_BOUNDS.LAT_MAX &&
    lng >= KOREA_BOUNDS.LNG_MIN &&
    lng <= KOREA_BOUNDS.LNG_MAX;

  const finalLat = hasValidCoords ? lat : null;
  const finalLng = hasValidCoords ? lng : null;

  // sourceId: 관리번호가 있으면 사용, 없으면 주소+설치장소명으로 대체
  const hashInput = mngNo
    ? `${normalizedCity}-${district}-${mngNo}`
    : `${normalizedCity}-${district}-${jibunAddress || roadAddress}-${name}`;
  const sourceId = createHash('md5').update(hashInput).digest('hex').substring(0, 16);
  const clothesId = `clothes-${sourceId}`;

  return {
    id: clothesId,
    name: name || `의류수거함 ${mngNo || district}`,
    address: jibunAddress || roadAddress,
    roadAddress: roadAddress || null,
    lat: finalLat,
    lng: finalLng,
    city: normalizedCity,
    district,
    sourceId,
    // Clothes 전용 필드
    managementAgency: row['관리기관명']?.trim() || '',
    phoneNumber: row['관리기관전화번호']?.trim() || '',
    dataDate: row['데이터기준일자']?.trim() || '',
    detailLocation: row['상세위치']?.trim() || '',
  };
}

/**
 * CSV 파일을 파싱하여 ParkingCSVRow 배열 반환
 */
export async function parseParkingCSV(filePath: string): Promise<ParkingCSVRow[]> {
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

    const rows: ParkingCSVRow[] = [];

    parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
      relaxQuotes: true,
    })
      .on('data', (row: ParkingCSVRow) => {
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
 * 운영시간 문자열 생성
 */
function buildParkingOperatingHours(row: ParkingCSVRow): string {
  const parts: string[] = [];

  const weekdayStart = row['평일운영시작시각']?.trim();
  const weekdayEnd = row['평일운영종료시각']?.trim();
  if (weekdayStart && weekdayEnd) {
    parts.push(`평일 ${weekdayStart}~${weekdayEnd}`);
  }

  const satStart = row['토요일운영시작시각']?.trim();
  const satEnd = row['토요일운영종료시각']?.trim();
  if (satStart && satEnd) {
    parts.push(`토요일 ${satStart}~${satEnd}`);
  }

  const holStart = row['공휴일운영시작시각']?.trim();
  const holEnd = row['공휴일운영종료시각']?.trim();
  if (holStart && holEnd) {
    parts.push(`공휴일 ${holStart}~${holEnd}`);
  }

  return parts.join(', ');
}

/**
 * 공영주차장 CSV 로우를 Parking 형식으로 변환
 */
export function transformParkingRow(row: ParkingCSVRow): TransformedParking | null {
  const mngNo = row['주차장관리번호']?.trim() || '';
  const name = row['주차장명']?.trim() || '';
  const roadAddress = row['소재지도로명주소']?.trim() || '';
  const jibunAddress = row['소재지지번주소']?.trim() || '';
  const latStr = row['위도']?.trim() || '';
  const lngStr = row['경도']?.trim() || '';

  if (!name) {
    return null;
  }

  // 주소 결정 (도로명 우선, 없으면 지번)
  const primaryAddress = roadAddress || jibunAddress;
  if (!primaryAddress) {
    return null;
  }

  const { city, district } = parseAddress(primaryAddress);
  const normalizedCity = normalizeCityName(city);

  if (!normalizedCity || !district) {
    return null;
  }

  // 좌표 파싱 및 유효성 검사
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  const hasValidCoords =
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    lat >= KOREA_BOUNDS.LAT_MIN &&
    lat <= KOREA_BOUNDS.LAT_MAX &&
    lng >= KOREA_BOUNDS.LNG_MIN &&
    lng <= KOREA_BOUNDS.LNG_MAX;

  const finalLat = hasValidCoords ? lat : null;
  const finalLng = hasValidCoords ? lng : null;

  // sourceId: 관리번호 사용, 없으면 해시 생성
  const hashInput = mngNo
    ? `parking-${mngNo}`
    : `parking-${normalizedCity}-${district}-${name}-${latStr}-${lngStr}`;
  const sourceId = createHash('md5').update(hashInput).digest('hex').substring(0, 16);
  const parkingId = `parking-${sourceId}`;

  // 요금 정보 파싱
  const parseIntSafe = (val: string | undefined): number | null => {
    if (!val) return null;
    const n = parseInt(val.trim(), 10);
    return isNaN(n) ? null : n;
  };

  return {
    id: parkingId,
    name,
    address: jibunAddress || roadAddress,
    roadAddress: roadAddress || null,
    lat: finalLat,
    lng: finalLng,
    city: normalizedCity,
    district,
    sourceId,
    // Parking 전용 필드
    parkingType: row['주차장구분']?.trim() || '',
    lotType: row['주차장유형']?.trim() || '',
    capacity: parseInt(row['주차구획수'] || '0', 10) || 0,
    baseFee: parseIntSafe(row['주차기본요금']),
    baseTime: parseIntSafe(row['주차기본시간']),
    additionalFee: parseIntSafe(row['추가단위요금']),
    additionalTime: parseIntSafe(row['추가단위시간']),
    dailyMaxFee: parseIntSafe(row['1일주차권요금']),
    monthlyFee: parseIntSafe(row['월정기권요금']),
    operatingHours: buildParkingOperatingHours(row),
    phone: row['전화번호']?.trim() || '',
    paymentMethod: row['결제방법']?.trim() || '',
    remarks: row['특기사항']?.trim() || '',
    hasDisabledParking: row['장애인전용주차구역보유여부']?.trim() === 'Y',
  };
}

/**
 * CSV 파일을 파싱하여 LibraryCSVRow 배열 반환
 */
export async function parseLibraryCSV(filePath: string): Promise<LibraryCSVRow[]> {
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

    const rows: LibraryCSVRow[] = [];

    parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
      relaxQuotes: true,
    })
      .on('data', (row: LibraryCSVRow) => {
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
 * 도서관 CSV 로우를 Library 형식으로 변환
 */
export function transformLibraryRow(row: LibraryCSVRow): TransformedLibrary | null {
  const name = row['도서관명']?.trim() || '';
  const city = row['시도명']?.trim() || '';
  const district = row['시군구명']?.trim() || '';
  const roadAddress = row['소재지도로명주소']?.trim() || '';
  const latStr = row['위도']?.trim() || '';
  const lngStr = row['경도']?.trim() || '';

  if (!name) {
    return null;
  }

  // 시도명 정규화
  const normalizedCity = normalizeCityName(city);

  if (!normalizedCity || !district) {
    return null;
  }

  // 좌표 파싱 및 유효성 검사
  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  const hasValidCoords =
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    lat >= KOREA_BOUNDS.LAT_MIN &&
    lat <= KOREA_BOUNDS.LAT_MAX &&
    lng >= KOREA_BOUNDS.LNG_MIN &&
    lng <= KOREA_BOUNDS.LNG_MAX;

  const finalLat = hasValidCoords ? lat : null;
  const finalLng = hasValidCoords ? lng : null;

  const sourceId = generateSourceId(name, latStr, lngStr);
  const libraryId = `library-${sourceId}`;

  return {
    id: libraryId,
    name,
    address: roadAddress,
    roadAddress: roadAddress || null,
    lat: finalLat,
    lng: finalLng,
    city: normalizedCity,
    district,
    sourceId,
    // Library 전용 필드
    libraryType: row['도서관유형']?.trim() || '',
    closedDays: row['휴관일']?.trim() || '',
    weekdayOpenTime: row['평일운영시작시각']?.trim() || '',
    weekdayCloseTime: row['평일운영종료시각']?.trim() || '',
    saturdayOpenTime: row['토요일운영시작시각']?.trim() || '',
    saturdayCloseTime: row['토요일운영종료시각']?.trim() || '',
    holidayOpenTime: row['공휴일운영시작시각']?.trim() || '',
    holidayCloseTime: row['공휴일운영종료시각']?.trim() || '',
    seatCount: parseInt(row['열람좌석수'] || '0', 10) || 0,
    bookCount: parseInt(row['자료수(도서)'] || '0', 10) || 0,
    serialCount: parseInt(row['자료수(연속간행물)'] || '0', 10) || 0,
    nonBookCount: parseInt(row['자료수(비도서)'] || '0', 10) || 0,
    loanableBooks: parseInt(row['대출가능권수'] || '0', 10) || 0,
    loanableDays: parseInt(row['대출가능일수'] || '0', 10) || 0,
    phoneNumber: row['도서관전화번호']?.trim() || '',
    homepageUrl: row['홈페이지주소']?.trim() || '',
    operatingOrg: row['운영기관명']?.trim() || '',
  };
}

export default {
  parseToiletCSV,
  transformToiletRow,
  parseClothesCSV,
  transformClothesRow,
  parseParkingCSV,
  transformParkingRow,
  parseLibraryCSV,
  transformLibraryRow,
};
