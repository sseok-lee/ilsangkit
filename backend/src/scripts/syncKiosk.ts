// @TASK T2.3.3 - 무인민원발급기 데이터 동기화 스크립트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import prisma from '../lib/prisma.js';
import { publicApiClient } from '../lib/publicApiClient.js';
import { batchGeocode, type Coordinates } from '../services/geocodingService.js';
import crypto from 'crypto';
import { SYNC } from '../constants/index.js';
import { extractCityDistrict } from '../lib/addressParser.js';

/**
 * 무인민원발급기 설치정보 API 응답 타입
 * data.go.kr/15154774 - installation_info
 * 2026년 1월 기준 새로운 필드명
 */
export interface KioskApiResponse {
  /** 관리번호 (API 연결키) */
  MNG_NO: string;
  /** 개방자치단체코드 */
  OPN_ATMY_GRP_CD: string;
  /** 설치장소주소 (전체 주소) */
  INSTL_PLC_ADDR: string;
  /** 설치장소상세위치 */
  INSTL_PLC_DTL_PSTN: string;
  /** 발급기명 */
  ISSUMCHN_NM: string;
  /** 관리기관명 */
  MNG_INST_NM: string;
  /** 평일운영시작시간 */
  WKDY_OPER_BGNG_TM: string;
  /** 평일운영종료시간 */
  WKDY_OPER_END_TM: string;
  /** 공휴일운영시작시간 */
  LHLDY_OPER_BGNG_TM: string;
  /** 공휴일운영종료시간 */
  LHLDY_OPER_END_TM: string;
  /** 시각장애인용키패드 (제공/미제공) */
  FRBLND_KPD: string;
  /** 음성안내 (제공/미제공) */
  FRBLND_VOICE_GD: string;
  /** 점자라벨부착 (부착/미부착) */
  BRL_LBL_ATCMNT: string;
  /** 휠체어사용가능 (가능/불가능) */
  WHCHR_USER_MNPLT: string;
  /** 설치장소위치 (읍면동 등) */
  INSTL_PLC_PSTN: string;
}

/**
 * 무인민원발급기 민원정보 API 응답 타입
 * data.go.kr/15154774 - certificate_info
 */
export interface CertificateApiResponse {
  /** 관리번호 (certificate_info 내부 키, 긴 알파벳+숫자 코드) */
  MNG_NO: string;
  /** 개방자치단체코드 */
  OPN_ATMY_GRP_CD: string;
  /** 발급기번호 (installation_info.MNG_NO와 매칭되는 키) */
  ISSUMCHN_NO: string;
  /** 민원사무분류명 */
  CVLCPT_OFCWORK_CLSF_NM: string;
  /** 초기메뉴명 */
  INITA_MENU_NM: string;
}

/**
 * 변환된 Kiosk 데이터 타입
 */
interface KioskData {
  id: string;
  name: string;
  address: string;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  sourceId: string;
  sourceUrl: string | null;
  syncedAt: Date;
  // Kiosk 전용 필드
  detailLocation: string;
  operationAgency: string;
  weekdayOperatingHours: string | null;
  saturdayOperatingHours: string | null;
  holidayOperatingHours: string | null;
  blindKeypad: boolean;
  voiceGuide: boolean;
  brailleOutput: boolean;
  wheelchairAccessible: boolean;
  mngNo: string | null;
  availableDocuments: string[];
  // 추가 상세 필드
  govCode: string;
  installPosition: string;
}

/**
 * API 엔드포인트 설정
 */
const INSTALLATION_API_CONFIG = {
  endpoint: 'https://apis.data.go.kr/1741000/kiosk_info/installation_info',
  pageSize: SYNC.PAGE_SIZE, // API가 최대 100개만 반환하므로 PAGE_SIZE로 설정
} as const;

const CERTIFICATE_API_CONFIG = {
  endpoint: 'https://apis.data.go.kr/1741000/kiosk_info/certificate_info',
  pageSize: SYNC.PAGE_SIZE, // API가 최대 100개만 반환하므로 PAGE_SIZE로 설정
} as const;

/**
 * 제공/가능/부착 등의 문자열을 boolean으로 변환
 */
function parseProvided(value: string | undefined | null): boolean {
  const v = value?.trim();
  return v === '제공' || v === '가능' || v === '부착';
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
  // 새 API는 전체 주소를 INSTL_PLC_ADDR 필드로 제공
  return row.INSTL_PLC_ADDR?.trim() || '';
}

/**
 * 지오코딩을 위한 주소 정규화
 * - 괄호 내용 제거: "서울시 강남구 (역삼빌딩)" → "서울시 강남구"
 * - 쉼표 이후 제거: "서울시 강남구, 1층 로비" → "서울시 강남구"
 * - 상세주소 제거: "서울시 강남구 123-45 OO빌딩 3층" → "서울시 강남구 123-45"
 */
function normalizeAddressForGeocode(address: string): string {
  if (!address) return '';

  const normalized = address
    .replace(/\([^)]*\)/g, '') // 괄호 내용 제거
    .replace(/,.*$/, '') // 쉼표 이후 제거
    .replace(/\s+\d+층.*$/i, '') // "N층" 이후 제거
    .replace(/\s+[가-힣]+빌딩.*$/, '') // "OO빌딩" 이후 제거
    .replace(/\s+[가-힣]+센터.*$/, '') // "OO센터" 이후 제거
    .replace(/\s+[가-힣]+타워.*$/, '') // "OO타워" 이후 제거
    .trim()
    .replace(/\s+/g, ' '); // 연속 공백 제거

  return normalized;
}

// extractCity/extractDistrict → addressParser.ts의 extractCityDistrict로 통합됨

/**
 * sourceId 생성 (MNG_NO 기반 - API의 고유 키 사용)
 */
function generateSourceId(row: KioskApiResponse): string {
  // MNG_NO가 있으면 사용, 없으면 주소+상세위치 해시
  const mngNo = row.MNG_NO?.trim();
  if (mngNo) {
    return `mng_${mngNo}`;
  }

  const address = buildAddressFromKioskRow(row);
  const detail = row.INSTL_PLC_DTL_PSTN?.trim() || '';
  const combined = `${address}|${detail}`;

  return crypto.createHash('md5').update(combined).digest('hex').substring(0, 16);
}

/**
 * API 응답 데이터를 Kiosk 모델 형식으로 변환
 */
export function transformKioskData(
  row: KioskApiResponse,
  coords: Coordinates | null,
  availableDocuments: string[] = []
): KioskData {
  const address = buildAddressFromKioskRow(row);
  const sourceId = generateSourceId(row);
  const detailLocation = row.INSTL_PLC_DTL_PSTN?.trim() || '';
  const kioskName = row.ISSUMCHN_NM?.trim() || '';
  const mngNo = row.MNG_NO?.trim() || null;
  const { city, district } = extractCityDistrict(address);

  return {
    id: `kiosk_${sourceId}`,
    name: kioskName ? `${kioskName} 무인민원발급기` : (detailLocation ? `${detailLocation} 무인민원발급기` : '무인민원발급기'),
    address,
    roadAddress: address, // 새 API는 전체 주소가 도로명 주소
    lat: coords?.lat ?? 0,
    lng: coords?.lng ?? 0,
    city,
    district,
    sourceId,
    sourceUrl: 'https://www.data.go.kr/data/15154774/openapi.do',
    syncedAt: new Date(),
    // Kiosk 전용 필드
    detailLocation,
    operationAgency: row.MNG_INST_NM?.trim() || '',
    weekdayOperatingHours: formatOperatingHours(row.WKDY_OPER_BGNG_TM, row.WKDY_OPER_END_TM),
    saturdayOperatingHours: null, // 새 API에서는 토요일 운영시간 필드 없음
    holidayOperatingHours: formatOperatingHours(row.LHLDY_OPER_BGNG_TM, row.LHLDY_OPER_END_TM),
    blindKeypad: parseProvided(row.FRBLND_KPD),
    voiceGuide: parseProvided(row.FRBLND_VOICE_GD),
    brailleOutput: parseProvided(row.BRL_LBL_ATCMNT),
    wheelchairAccessible: parseProvided(row.WHCHR_USER_MNPLT),
    mngNo,
    availableDocuments,
    // 추가 상세 필드
    govCode: row.OPN_ATMY_GRP_CD?.trim() || '',
    installPosition: row.INSTL_PLC_PSTN?.trim() || '',
  };
}

/**
 * 민원 목록을 발급기번호(ISSUMCHN_NO) 기준으로 그룹핑
 * ISSUMCHN_NO가 installation_info의 MNG_NO와 매칭됨
 */
function groupCertificatesByMngNo(
  certificates: CertificateApiResponse[]
): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  for (const cert of certificates) {
    // ISSUMCHN_NO를 사용하여 installation_info.MNG_NO와 매칭
    const issumchnNo = cert.ISSUMCHN_NO?.trim();
    if (!issumchnNo) continue;

    const docName = cert.CVLCPT_OFCWORK_CLSF_NM?.trim();
    if (!docName) continue;

    const existing = grouped.get(issumchnNo) || [];
    // 중복 제거
    if (!existing.includes(docName)) {
      existing.push(docName);
    }
    grouped.set(issumchnNo, existing);
  }

  return grouped;
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

    // 1. 설치정보 API에서 모든 데이터 조회
    console.log('설치정보 API 데이터 조회 중...');
    const installationData = await publicApiClient.fetchAll<KioskApiResponse>({
      ...INSTALLATION_API_CONFIG,
    }, {
      onProgress: (current, total) => {
        console.log(`설치정보 페이지 ${current}/${total} 조회 완료`);
      },
    });

    totalRecords = installationData.length;
    console.log(`설치정보 총 ${totalRecords}개 데이터 조회 완료`);

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

    // 2. 민원정보 API에서 모든 데이터 조회
    console.log('민원정보 API 데이터 조회 중...');
    const certificateData = await publicApiClient.fetchAll<CertificateApiResponse>({
      ...CERTIFICATE_API_CONFIG,
    }, {
      onProgress: (current, total) => {
        console.log(`민원정보 페이지 ${current}/${total} 조회 완료`);
      },
    });
    console.log(`민원정보 총 ${certificateData.length}개 데이터 조회 완료`);

    // 3. MNG_NO 기준으로 민원 목록 그룹핑
    console.log('민원 목록 그룹핑 중...');
    const certByMngNo = groupCertificatesByMngNo(certificateData);
    console.log(`${certByMngNo.size}개 발급기에 민원 정보 매핑 완료`);

    // 4. 주소 추출 및 지오코딩 (주소 정규화 적용)
    console.log('지오코딩 진행 중...');
    const addresses = installationData.map((row) =>
      normalizeAddressForGeocode(buildAddressFromKioskRow(row))
    );
    const coordinates = await batchGeocode(addresses, {
      batchSize: 10,
      delayMs: 200, // Kakao API rate limit 고려
    });

    const successfulGeocode = coordinates.filter((c) => c !== null).length;
    console.log(`지오코딩 완료: ${successfulGeocode}/${totalRecords} 성공`);

    // 5. 데이터 변환
    console.log('데이터 변환 중...');
    const kioskDataList: KioskData[] = [];
    for (let i = 0; i < installationData.length; i++) {
      const row = installationData[i];
      const coords = coordinates[i];
      const mngNo = row.MNG_NO?.trim();
      const availableDocuments = mngNo ? certByMngNo.get(mngNo) || [] : [];
      const kioskData = transformKioskData(row, coords, availableDocuments);
      kioskDataList.push(kioskData);
    }
    console.log(`변환 완료: ${kioskDataList.length}개`);

    // 6. 배치 upsert (트랜잭션 래핑)
    console.log('데이터베이스 저장 중...');
    const BATCH_SIZE = SYNC.BATCH_SIZE;
    for (let i = 0; i < kioskDataList.length; i += BATCH_SIZE) {
      const batch = kioskDataList.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(kioskDataList.length / BATCH_SIZE);

      try {
        // 각 배치를 트랜잭션으로 래핑
        await prisma.$transaction(async (tx) => {
          for (const kioskData of batch) {
            const existing = await tx.kiosk.findUnique({
              where: { id: kioskData.id },
            });

            await tx.kiosk.upsert({
              where: { id: kioskData.id },
              create: {
                id: kioskData.id,
                name: kioskData.name,
                address: kioskData.address,
                roadAddress: kioskData.roadAddress,
                lat: kioskData.lat,
                lng: kioskData.lng,
                city: kioskData.city,
                district: kioskData.district,
                sourceId: kioskData.sourceId,
                sourceUrl: kioskData.sourceUrl,
                syncedAt: kioskData.syncedAt,
                detailLocation: kioskData.detailLocation,
                operationAgency: kioskData.operationAgency,
                weekdayOperatingHours: kioskData.weekdayOperatingHours,
                saturdayOperatingHours: kioskData.saturdayOperatingHours,
                holidayOperatingHours: kioskData.holidayOperatingHours,
                blindKeypad: kioskData.blindKeypad,
                voiceGuide: kioskData.voiceGuide,
                brailleOutput: kioskData.brailleOutput,
                wheelchairAccessible: kioskData.wheelchairAccessible,
                mngNo: kioskData.mngNo,
                availableDocuments: kioskData.availableDocuments,
                govCode: kioskData.govCode,
                installPosition: kioskData.installPosition,
              },
              update: {
                name: kioskData.name,
                address: kioskData.address,
                roadAddress: kioskData.roadAddress,
                lat: kioskData.lat,
                lng: kioskData.lng,
                city: kioskData.city,
                district: kioskData.district,
                syncedAt: kioskData.syncedAt,
                detailLocation: kioskData.detailLocation,
                operationAgency: kioskData.operationAgency,
                weekdayOperatingHours: kioskData.weekdayOperatingHours,
                saturdayOperatingHours: kioskData.saturdayOperatingHours,
                holidayOperatingHours: kioskData.holidayOperatingHours,
                blindKeypad: kioskData.blindKeypad,
                voiceGuide: kioskData.voiceGuide,
                brailleOutput: kioskData.brailleOutput,
                wheelchairAccessible: kioskData.wheelchairAccessible,
                mngNo: kioskData.mngNo,
                availableDocuments: kioskData.availableDocuments,
                govCode: kioskData.govCode,
                installPosition: kioskData.installPosition,
              },
            });

            if (existing) {
              updatedRecords++;
            } else {
              newRecords++;
            }
          }
        });

        // 배치 완료마다 SyncHistory 진행 상황 업데이트
        await prisma.syncHistory.update({
          where: { id: syncHistory.id },
          data: {
            newRecords,
            updatedRecords,
          },
        });

        console.log(`Batch ${batchNumber}/${totalBatches} 완료: ${Math.min(i + BATCH_SIZE, kioskDataList.length)}/${kioskDataList.length}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Batch ${batchNumber} 저장 실패:`, errorMsg);
        throw new Error(`Batch ${batchNumber} upsert failed: ${errorMsg}. Processed: ${i}/${kioskDataList.length}`);
      }
    }

    // 7. 동기화 히스토리 업데이트 (성공)
    await prisma.syncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status: 'success',
        totalRecords: kioskDataList.length,
        newRecords,
        updatedRecords,
        completedAt: new Date(),
      },
    });

    console.log(`동기화 완료: 총 ${kioskDataList.length}개 (신규: ${newRecords}, 업데이트: ${updatedRecords})`);
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
