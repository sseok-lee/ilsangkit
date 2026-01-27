// @TASK T2.3.3 - 무인민원발급기 데이터 동기화 스크립트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import prisma from '../lib/prisma.js';
import { publicApiClient } from '../lib/publicApiClient.js';
import { batchGeocode, type Coordinates } from '../services/geocodingService.js';
import crypto from 'crypto';

/**
 * 무인민원발급기 API 응답 타입
 * data.go.kr/15154774 기준
 */
export interface KioskApiResponse {
  /** 설치장소주소 시도 */
  addrCtpvNm: string;
  /** 설치장소주소 시군구 */
  addrSggNm: string;
  /** 설치장소주소 읍면동 */
  addrEmdNm: string;
  /** 설치장소주소 도로명 */
  addrRn: string;
  /** 설치장소상세위치 */
  instlPlcDtlLocCn: string;
  /** 운영기관명 */
  operInstNm: string;
  /** 평일운영시작시간 */
  wdayOperBgngTm: string;
  /** 평일운영종료시간 */
  wdayOperEndTm: string;
  /** 토요일운영시작시간 */
  satOperBgngTm: string;
  /** 토요일운영종료시간 */
  satOperEndTm: string;
  /** 공휴일운영시작시간 */
  hldyOperBgngTm: string;
  /** 공휴일운영종료시간 */
  hldyOperEndTm: string;
  /** 시각장애인용키패드유무 */
  vdiYn: string;
  /** 음성안내유무 */
  vcgdYn: string;
  /** 점자출력유무 */
  brllPrnYn: string;
  /** 휠체어사용가능유무 */
  whlchUseYn: string;
}

/**
 * 변환된 Facility 데이터 타입
 */
interface FacilityData {
  id: string;
  category: 'kiosk';
  name: string;
  address: string;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  details: {
    detailLocation: string;
    operationAgency: string;
    weekdayOperatingHours: string | null;
    saturdayOperatingHours: string | null;
    holidayOperatingHours: string | null;
    blindKeypad: boolean;
    voiceGuide: boolean;
    brailleOutput: boolean;
    wheelchairAccessible: boolean;
  };
  sourceId: string;
  sourceUrl: string | null;
  syncedAt: Date;
}

/**
 * API 엔드포인트 설정
 */
const KIOSK_API_CONFIG = {
  endpoint: 'https://apis.data.go.kr/1741000/kiosk_info/installation_info',
  pageSize: 1000,
} as const;

/**
 * Y/N 문자열을 boolean으로 변환
 */
function parseYN(value: string | undefined | null): boolean {
  return value?.toUpperCase() === 'Y';
}

/**
 * 운영시간 포맷팅
 * @param start - 시작 시간
 * @param end - 종료 시간
 * @returns 포맷팅된 운영시간 또는 null
 */
function formatOperatingHours(start: string, end: string): string | null {
  const trimmedStart = start?.trim();
  const trimmedEnd = end?.trim();

  if (!trimmedStart || !trimmedEnd) {
    return null;
  }

  return `${trimmedStart}~${trimmedEnd}`;
}

/**
 * API 응답 행에서 주소 생성
 */
export function buildAddressFromKioskRow(row: KioskApiResponse): string {
  const city = row.addrCtpvNm?.trim() || '';
  const district = row.addrSggNm?.trim() || '';
  const dong = row.addrEmdNm?.trim() || '';
  const road = row.addrRn?.trim() || '';

  // 도로명 주소가 있으면 도로명 사용, 없으면 읍면동 사용
  if (road) {
    return `${city} ${district} ${road}`.trim();
  }
  return `${city} ${district} ${dong}`.trim();
}

/**
 * sourceId 생성 (주소 + 상세위치 기반 해시)
 */
function generateSourceId(row: KioskApiResponse): string {
  const address = buildAddressFromKioskRow(row);
  const detail = row.instlPlcDtlLocCn?.trim() || '';
  const combined = `${address}|${detail}`;

  return crypto.createHash('md5').update(combined).digest('hex').substring(0, 16);
}

/**
 * API 응답 데이터를 Facility 모델 형식으로 변환
 */
export function transformKioskData(
  row: KioskApiResponse,
  coords: Coordinates | null
): FacilityData {
  const address = buildAddressFromKioskRow(row);
  const sourceId = generateSourceId(row);
  const detailLocation = row.instlPlcDtlLocCn?.trim() || '';

  return {
    id: `kiosk_${sourceId}`,
    category: 'kiosk',
    name: detailLocation ? `${detailLocation} 무인민원발급기` : '무인민원발급기',
    address,
    roadAddress: row.addrRn?.trim() ? `${row.addrCtpvNm?.trim()} ${row.addrSggNm?.trim()} ${row.addrRn?.trim()}` : null,
    lat: coords?.lat ?? 0,
    lng: coords?.lng ?? 0,
    city: row.addrCtpvNm?.trim() || '',
    district: row.addrSggNm?.trim() || '',
    details: {
      detailLocation,
      operationAgency: row.operInstNm?.trim() || '',
      weekdayOperatingHours: formatOperatingHours(row.wdayOperBgngTm, row.wdayOperEndTm),
      saturdayOperatingHours: formatOperatingHours(row.satOperBgngTm, row.satOperEndTm),
      holidayOperatingHours: formatOperatingHours(row.hldyOperBgngTm, row.hldyOperEndTm),
      blindKeypad: parseYN(row.vdiYn),
      voiceGuide: parseYN(row.vcgdYn),
      brailleOutput: parseYN(row.brllPrnYn),
      wheelchairAccessible: parseYN(row.whlchUseYn),
    },
    sourceId,
    sourceUrl: 'https://www.data.go.kr/data/15154774/openapi.do',
    syncedAt: new Date(),
  };
}

/**
 * 무인민원발급기 데이터 동기화
 */
export async function syncKiosks(): Promise<void> {
  // 동기화 히스토리 생성
  const syncHistory = await prisma.syncHistory.create({
    data: {
      category: 'kiosk',
      status: 'running',
    },
  });

  let totalRecords = 0;
  let newRecords = 0;
  let updatedRecords = 0;

  try {
    console.log('무인민원발급기 데이터 동기화 시작...');

    // 1. 공공데이터 API에서 모든 데이터 조회
    console.log('API 데이터 조회 중...');
    const apiData = await publicApiClient.fetchAll<KioskApiResponse>({
      ...KIOSK_API_CONFIG,
    }, {
      onProgress: (current, total) => {
        console.log(`페이지 ${current}/${total} 조회 완료`);
      },
    });

    totalRecords = apiData.length;
    console.log(`총 ${totalRecords}개 데이터 조회 완료`);

    if (totalRecords === 0) {
      await prisma.syncHistory.update({
        where: { id: syncHistory.id },
        data: {
          status: 'success',
          totalRecords: 0,
          newRecords: 0,
          updatedRecords: 0,
          completedAt: new Date(),
        },
      });
      return;
    }

    // 2. 주소 추출 및 지오코딩
    console.log('지오코딩 진행 중...');
    const addresses = apiData.map((row) => buildAddressFromKioskRow(row));
    const coordinates = await batchGeocode(addresses, {
      batchSize: 10,
      delayMs: 200, // Kakao API rate limit 고려
    });

    const successfulGeocode = coordinates.filter((c) => c !== null).length;
    console.log(`지오코딩 완료: ${successfulGeocode}/${totalRecords} 성공`);

    // 3. 데이터 변환 및 upsert
    console.log('데이터베이스 저장 중...');
    for (let i = 0; i < apiData.length; i++) {
      const row = apiData[i];
      const coords = coordinates[i];
      const facilityData = transformKioskData(row, coords);

      try {
        const existing = await prisma.facility.findUnique({
          where: { id: facilityData.id },
        });

        await prisma.facility.upsert({
          where: { id: facilityData.id },
          create: {
            ...facilityData,
            details: facilityData.details,
          },
          update: {
            name: facilityData.name,
            address: facilityData.address,
            roadAddress: facilityData.roadAddress,
            lat: facilityData.lat,
            lng: facilityData.lng,
            city: facilityData.city,
            district: facilityData.district,
            details: facilityData.details,
            syncedAt: facilityData.syncedAt,
          },
        });

        if (existing) {
          updatedRecords++;
        } else {
          newRecords++;
        }

        // 진행률 출력 (100개마다)
        if ((i + 1) % 100 === 0) {
          console.log(`저장 진행: ${i + 1}/${totalRecords}`);
        }
      } catch (error) {
        console.error(`저장 실패 (${facilityData.id}):`, error);
      }
    }

    // 4. 동기화 히스토리 업데이트 (성공)
    await prisma.syncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status: 'success',
        totalRecords,
        newRecords,
        updatedRecords,
        completedAt: new Date(),
      },
    });

    console.log(`동기화 완료: 총 ${totalRecords}개 (신규: ${newRecords}, 업데이트: ${updatedRecords})`);
  } catch (error) {
    // 동기화 히스토리 업데이트 (실패)
    await prisma.syncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });

    console.error('동기화 실패:', error);
    throw error;
  }
}

// CLI로 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  syncKiosks()
    .then(() => {
      console.log('완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('실패:', error);
      process.exit(1);
    });
}
