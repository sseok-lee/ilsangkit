// @TASK T2.3 - 무료 와이파이 데이터 동기화 스크립트
// @SPEC docs/planning/04-database-design.md#무료-와이파이

import { parseCSV, downloadAndExtractCSV } from '../lib/csvParser.js';
import prisma from '../lib/prisma.js';
import { FacilityCategory, SyncStatus } from '@prisma/client';
import { createHash } from 'crypto';

// 와이파이 CSV 데이터 URL
const WIFI_DATA_URL = 'https://www.localdata.go.kr/datafile/each/07_24_04_P_CSV.zip';

// CSV 행 타입 정의
export interface WifiCSVRow extends Record<string, string> {
  연번: string;
  설치장소명: string;
  소재지도로명주소: string;
  소재지지번주소: string;
  위도: string;
  경도: string;
  와이파이SSID: string;
  설치년월: string;
  통신사: string;
  설치환경: string;
  관리기관명: string;
  관리기관전화번호: string;
  데이터기준일자: string;
}

// 변환된 시설 데이터 타입
export interface TransformedFacility {
  id: string;
  category: FacilityCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  sourceId: string;
  sourceUrl: string;
  details: {
    ssid: string;
    installDate: string;
    serviceProvider: string;
    installLocation: string;
    managementAgency: string;
    phoneNumber: string;
  };
}

// 동기화 결과 타입
export interface WifiSyncResult {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errors: string[];
}

// 시/도 정규화 맵
const CITY_MAP: Record<string, string> = {
  서울특별시: '서울',
  서울시: '서울',
  서울: '서울',
  부산광역시: '부산',
  부산시: '부산',
  부산: '부산',
  대구광역시: '대구',
  대구시: '대구',
  대구: '대구',
  인천광역시: '인천',
  인천시: '인천',
  인천: '인천',
  광주광역시: '광주',
  광주시: '광주',
  광주: '광주',
  대전광역시: '대전',
  대전시: '대전',
  대전: '대전',
  울산광역시: '울산',
  울산시: '울산',
  울산: '울산',
  세종특별자치시: '세종',
  세종시: '세종',
  세종: '세종',
  경기도: '경기',
  경기: '경기',
  강원특별자치도: '강원',
  강원도: '강원',
  강원: '강원',
  충청북도: '충북',
  충북: '충북',
  충청남도: '충남',
  충남: '충남',
  전북특별자치도: '전북',
  전라북도: '전북',
  전북: '전북',
  전라남도: '전남',
  전남: '전남',
  경상북도: '경북',
  경북: '경북',
  경상남도: '경남',
  경남: '경남',
  제주특별자치도: '제주',
  제주도: '제주',
  제주: '제주',
};

/**
 * 주소에서 시/도, 구/군 추출
 */
export function parseAddress(
  address: string
): { city: string; district: string } | null {
  if (!address || address.trim() === '') {
    return null;
  }

  const trimmedAddress = address.trim();

  // 세종시 특별 처리 (구/군이 없음)
  if (
    trimmedAddress.includes('세종특별자치시') ||
    trimmedAddress.includes('세종시') ||
    trimmedAddress.startsWith('세종')
  ) {
    return { city: '세종', district: '세종시' };
  }

  // 정규식으로 시/도, 구/군/시 추출
  const regex =
    /^(서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주시|광주|대전광역시|대전시|대전|울산광역시|울산시|울산|세종특별자치시|세종시|세종|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전북특별자치도|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주)\s+(\S+[구군시])/;

  const match = trimmedAddress.match(regex);

  if (!match) {
    return null;
  }

  const rawCity = match[1];
  const district = match[2];
  const city = CITY_MAP[rawCity] || rawCity;

  return { city, district };
}

/**
 * 와이파이 CSV 데이터를 Facility 모델 형식으로 변환
 */
export function transformWifiData(row: WifiCSVRow): TransformedFacility | null {
  // 필수 필드 검증
  const name = row.설치장소명?.trim();
  if (!name) {
    return null;
  }

  // 좌표 검증
  const lat = parseFloat(row.위도?.trim() || '');
  const lng = parseFloat(row.경도?.trim() || '');

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return null;
  }

  // 주소 파싱
  const roadAddress = row.소재지도로명주소?.trim() || null;
  const address = row.소재지지번주소?.trim() || null;

  // 주소에서 시/도, 구/군 추출
  const parsedAddress = parseAddress(roadAddress || address || '');
  const city = parsedAddress?.city || 'unknown';
  const district = parsedAddress?.district || 'unknown';

  // 고유 ID 생성
  const sourceId = `wifi_${row.연번}`;
  const idHash = createHash('md5')
    .update(`${sourceId}_${row.와이파이SSID}_${lat}_${lng}`)
    .digest('hex')
    .substring(0, 12);
  const id = `wifi-${idHash}`;

  return {
    id,
    category: 'wifi' as FacilityCategory,
    name,
    address,
    roadAddress,
    lat,
    lng,
    city,
    district,
    sourceId,
    sourceUrl: WIFI_DATA_URL,
    details: {
      ssid: row.와이파이SSID?.trim() || '',
      installDate: row.설치년월?.trim() || '',
      serviceProvider: row.통신사?.trim() || '',
      installLocation: row.설치환경?.trim() || '',
      managementAgency: row.관리기관명?.trim() || '',
      phoneNumber: row.관리기관전화번호?.trim() || '',
    },
  };
}

/**
 * 동기화 히스토리 생성
 */
async function createSyncHistory(): Promise<number> {
  const history = await prisma.syncHistory.create({
    data: {
      category: 'wifi',
      status: 'running' as SyncStatus,
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
    },
  });
  return history.id;
}

/**
 * 동기화 히스토리 업데이트
 */
async function updateSyncHistory(
  id: number,
  status: SyncStatus,
  result: Partial<WifiSyncResult>,
  errorMessage?: string
): Promise<void> {
  await prisma.syncHistory.update({
    where: { id },
    data: {
      status,
      totalRecords: result.totalRecords || 0,
      newRecords: result.newRecords || 0,
      updatedRecords: result.updatedRecords || 0,
      errorMessage,
      completedAt: new Date(),
    },
  });
}

/**
 * 시설 데이터 배치 Upsert
 */
async function batchUpsertFacilities(
  facilities: TransformedFacility[]
): Promise<{ newCount: number; updatedCount: number }> {
  let newCount = 0;
  let updatedCount = 0;

  // 배치 크기
  const BATCH_SIZE = 100;

  for (let i = 0; i < facilities.length; i += BATCH_SIZE) {
    const batch = facilities.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (facility) => {
        const existing = await prisma.facility.findUnique({
          where: {
            category_sourceId: {
              category: facility.category,
              sourceId: facility.sourceId,
            },
          },
        });

        if (existing) {
          await prisma.facility.update({
            where: { id: existing.id },
            data: {
              name: facility.name,
              address: facility.address,
              roadAddress: facility.roadAddress,
              lat: facility.lat,
              lng: facility.lng,
              city: facility.city,
              district: facility.district,
              details: facility.details,
              syncedAt: new Date(),
            },
          });
          updatedCount++;
        } else {
          await prisma.facility.create({
            data: {
              id: facility.id,
              category: facility.category,
              name: facility.name,
              address: facility.address,
              roadAddress: facility.roadAddress,
              lat: facility.lat,
              lng: facility.lng,
              city: facility.city,
              district: facility.district,
              sourceId: facility.sourceId,
              sourceUrl: facility.sourceUrl,
              details: facility.details,
            },
          });
          newCount++;
        }
      })
    );

    // 진행 상황 로깅
    console.info(`Processed ${Math.min(i + BATCH_SIZE, facilities.length)} / ${facilities.length} records`);
  }

  return { newCount, updatedCount };
}

/**
 * 와이파이 데이터 동기화 실행
 */
export async function syncWifiData(csvContent?: string): Promise<WifiSyncResult> {
  const result: WifiSyncResult = {
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
    errors: [],
  };

  // SyncHistory 생성
  const historyId = await createSyncHistory();

  try {
    // CSV 데이터 가져오기
    let content: string;
    if (csvContent) {
      content = csvContent;
    } else {
      console.info('Downloading wifi data from:', WIFI_DATA_URL);
      content = await downloadAndExtractCSV(WIFI_DATA_URL);
    }

    // CSV 파싱
    console.info('Parsing CSV data...');
    const rows = parseCSV<WifiCSVRow>(content);
    result.totalRecords = rows.length;
    console.info(`Parsed ${rows.length} rows`);

    // 데이터 변환
    console.info('Transforming data...');
    const facilities: TransformedFacility[] = [];

    for (const row of rows) {
      try {
        const transformed = transformWifiData(row);
        if (transformed) {
          facilities.push(transformed);
        } else {
          result.skippedRecords++;
        }
      } catch (error) {
        result.skippedRecords++;
        result.errors.push(
          `Row ${row.연번}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    console.info(`Transformed ${facilities.length} valid records, skipped ${result.skippedRecords}`);

    // DB 저장
    console.info('Saving to database...');
    const { newCount, updatedCount } = await batchUpsertFacilities(facilities);
    result.newRecords = newCount;
    result.updatedRecords = updatedCount;

    // SyncHistory 업데이트 (성공)
    await updateSyncHistory(historyId, 'success' as SyncStatus, result);

    console.info('Sync completed successfully');
    console.info(`Total: ${result.totalRecords}, New: ${result.newRecords}, Updated: ${result.updatedRecords}, Skipped: ${result.skippedRecords}`);

    return result;
  } catch (error) {
    // SyncHistory 업데이트 (실패)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateSyncHistory(historyId, 'failed' as SyncStatus, result, errorMessage);

    console.error('Sync failed:', errorMessage);
    throw error;
  }
}

// 직접 실행 시
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  syncWifiData()
    .then((result) => {
      console.info('Sync result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sync error:', error);
      process.exit(1);
    });
}
