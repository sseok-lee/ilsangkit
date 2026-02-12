// @TASK T2.3 - 무료 와이파이 데이터 동기화 스크립트
// @SPEC docs/planning/04-database-design.md#무료-와이파이

import { parseCSV, downloadAndExtractCSV } from '../lib/csvParser.js';
import prisma from '../lib/prisma.js';
import { SyncStatus } from '@prisma/client';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as iconv from 'iconv-lite';

// 와이파이 CSV 데이터 URL
const WIFI_DATA_URL = 'https://www.localdata.go.kr/datafile/each/07_24_04_P_CSV.zip';

// CSV 행 타입 정의 (localdata.go.kr 표준데이터 형식)
export interface WifiCSVRow extends Record<string, string> {
  관리번호: string;
  설치장소명: string;
  설치장소상세: string;
  설치시도명: string;
  설치시군구명: string;
  설치시설구분명: string;
  서비스제공사명: string;
  와이파이SSID: string;
  설치연월: string;
  소재지도로명주소: string;
  소재지지번주소: string;
  관리기관명: string;
  관리기관전화번호: string;
  WGS84위도: string;
  WGS84경도: string;
  데이터기준일자: string;
}

// 변환된 Wifi 데이터 타입 (flat structure)
export interface TransformedWifi {
  id: string;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  sourceId: string;
  sourceUrl: string;
  // Wifi 전용 필드
  ssid: string;
  installDate: string;
  serviceProvider: string;
  installLocation: string;
  managementAgency: string;
  phoneNumber: string;
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
 * 와이파이 CSV 데이터를 Wifi 모델 형식으로 변환
 */
export function transformWifiData(row: WifiCSVRow): TransformedWifi | null {
  // 필수 필드 검증
  const name = row.설치장소명?.trim();
  if (!name) {
    return null;
  }

  // 좌표 검증
  const lat = parseFloat(row.WGS84위도?.trim() || '');
  const lng = parseFloat(row.WGS84경도?.trim() || '');

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return null;
  }

  // 한국 좌표 범위 검증 (위도 33~39, 경도 124~132)
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    return null;
  }

  // 주소 파싱
  const roadAddress = row.소재지도로명주소?.trim() || null;
  const address = row.소재지지번주소?.trim() || null;

  // 시/도, 구/군 - CSV에서 직접 제공되는 값 사용
  const rawCity = row.설치시도명?.trim() || '';
  const city = CITY_MAP[rawCity] || rawCity || 'unknown';
  const district = row.설치시군구명?.trim() || 'unknown';

  // 고유 ID 생성
  const sourceId = `wifi_${row.관리번호}`;
  const idHash = createHash('md5')
    .update(`${sourceId}_${row.와이파이SSID}_${lat}_${lng}`)
    .digest('hex')
    .substring(0, 12);
  const id = `wifi-${idHash}`;

  return {
    id,
    name,
    address,
    roadAddress,
    lat,
    lng,
    city,
    district,
    sourceId,
    sourceUrl: WIFI_DATA_URL,
    // Wifi 전용 필드 (flat)
    ssid: row.와이파이SSID?.trim() || '',
    installDate: row.설치연월?.trim() || '',
    serviceProvider: row.서비스제공사명?.trim() || '',
    installLocation: row.설치시설구분명?.trim() || '',
    managementAgency: row.관리기관명?.trim() || '',
    phoneNumber: row.관리기관전화번호?.trim() || '',
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
 * Wifi 데이터 배치 Upsert (트랜잭션 래핑)
 */
async function batchUpsertWifi(
  wifiData: TransformedWifi[],
  syncHistoryId: number
): Promise<{ newCount: number; updatedCount: number }> {
  let newCount = 0;
  let updatedCount = 0;

  const BATCH_SIZE = 100;

  for (let i = 0; i < wifiData.length; i += BATCH_SIZE) {
    const batch = wifiData.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(wifiData.length / BATCH_SIZE);

    try {
      // 각 배치를 트랜잭션으로 래핑
      await prisma.$transaction(async (tx) => {
        for (const wifi of batch) {
          const existing = await tx.wifi.findUnique({
            where: { sourceId: wifi.sourceId },
          });

          if (existing) {
            await tx.wifi.update({
              where: { id: existing.id },
              data: {
                name: wifi.name,
                address: wifi.address,
                roadAddress: wifi.roadAddress,
                lat: wifi.lat,
                lng: wifi.lng,
                city: wifi.city,
                district: wifi.district,
                ssid: wifi.ssid,
                installDate: wifi.installDate,
                serviceProvider: wifi.serviceProvider,
                installLocation: wifi.installLocation,
                managementAgency: wifi.managementAgency,
                phoneNumber: wifi.phoneNumber,
                syncedAt: new Date(),
              },
            });
            updatedCount++;
          } else {
            await tx.wifi.create({
              data: {
                id: wifi.id,
                name: wifi.name,
                address: wifi.address,
                roadAddress: wifi.roadAddress,
                lat: wifi.lat,
                lng: wifi.lng,
                city: wifi.city,
                district: wifi.district,
                sourceId: wifi.sourceId,
                sourceUrl: wifi.sourceUrl,
                ssid: wifi.ssid,
                installDate: wifi.installDate,
                serviceProvider: wifi.serviceProvider,
                installLocation: wifi.installLocation,
                managementAgency: wifi.managementAgency,
                phoneNumber: wifi.phoneNumber,
              },
            });
            newCount++;
          }
        }
      });

      // 배치 완료마다 SyncHistory 진행 상황 업데이트
      await prisma.syncHistory.update({
        where: { id: syncHistoryId },
        data: {
          newRecords: newCount,
          updatedRecords: updatedCount,
        },
      });

      console.info(`Batch ${batchNumber}/${totalBatches} completed: ${Math.min(i + BATCH_SIZE, wifiData.length)}/${wifiData.length} records`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Batch ${batchNumber}/${totalBatches} failed: ${errorMsg}`);
      throw new Error(`Batch ${batchNumber} upsert failed: ${errorMsg}. Processed: ${i}/${wifiData.length}`);
    }
  }

  return { newCount, updatedCount };
}

/**
 * 로컬 CSV 파일 읽기 (EUC-KR/UTF-8 자동 감지)
 */
function readLocalCSV(filePath: string): string {
  const buffer = fs.readFileSync(filePath);

  // UTF-8 BOM 체크
  if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.toString('utf8').slice(1);
  }

  // EUC-KR 감지: 0xA1-0xFE 범위의 2바이트 쌍이 많으면 EUC-KR
  let eucKrScore = 0;
  for (let i = 0; i < Math.min(buffer.length, 2000); i++) {
    if (buffer[i] >= 0xa1 && buffer[i] <= 0xfe && i + 1 < buffer.length) {
      const next = buffer[i + 1];
      if (next >= 0xa1 && next <= 0xfe) {
        eucKrScore++;
        i++;
      }
    }
  }

  if (eucKrScore > 10) {
    return iconv.decode(buffer, 'euc-kr');
  }

  return buffer.toString('utf8');
}

/**
 * 와이파이 데이터 동기화 실행
 */
export async function syncWifiData(csvContentOrPath?: string): Promise<WifiSyncResult> {
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
    if (csvContentOrPath && fs.existsSync(csvContentOrPath)) {
      // 로컬 파일 경로인 경우
      console.info('Reading local CSV file:', csvContentOrPath);
      content = readLocalCSV(csvContentOrPath);
    } else if (csvContentOrPath) {
      // CSV 내용이 직접 전달된 경우
      content = csvContentOrPath;
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
    const wifiData: TransformedWifi[] = [];

    for (const row of rows) {
      try {
        const transformed = transformWifiData(row);
        if (transformed) {
          wifiData.push(transformed);
        } else {
          result.skippedRecords++;
        }
      } catch (error) {
        result.skippedRecords++;
        result.errors.push(
          `Row ${row.관리번호}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // 중복 sourceId 제거
    const uniqueWifiData = Array.from(
      new Map(wifiData.map((w) => [w.sourceId, w])).values()
    );
    const duplicateCount = wifiData.length - uniqueWifiData.length;
    result.skippedRecords += duplicateCount;

    console.info(`Transformed ${uniqueWifiData.length} unique records, skipped ${result.skippedRecords} (including ${duplicateCount} duplicates)`);

    // DB 저장
    console.info('Saving to database...');
    const { newCount, updatedCount } = await batchUpsertWifi(uniqueWifiData, historyId);
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
  // --local 옵션으로 로컬 파일 경로 지정 가능
  const args = process.argv.slice(2);
  const localIndex = args.indexOf('--local');
  const localPath = localIndex !== -1 ? args[localIndex + 1] : undefined;

  syncWifiData(localPath)
    .then((result) => {
      console.info('Sync result:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sync error:', error);
      process.exit(1);
    });
}
