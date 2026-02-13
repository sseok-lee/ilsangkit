// @TASK T9.2 - AED(자동심장충격기) 데이터 동기화 스크립트
// API: https://www.data.go.kr/data/15000652/openapi.do (XML 전용)

import 'dotenv/config';
import prisma from '../lib/prisma.js';
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { SYNC } from '../constants/index.js';

/**
 * AED API 응답 아이템 타입
 */
interface AedApiItem {
  org?: string;           // 설치기관
  clerkTel?: string;      // 담당자 전화
  buildAddress?: string;  // 설치 주소
  buildPlace?: string;    // 설치 상세위치
  wgs84Lat?: number;      // 위도
  wgs84Lon?: number;      // 경도
  mfg?: string;           // 제조사
  model?: string;         // 모델명
  serialSeq?: string;     // 시리얼번호 (고유키)
  monSttTme?: string;     // 월요일 시작
  monEndTme?: string;     // 월요일 종료
  tueSttTme?: string;
  tueEndTme?: string;
  wedSttTme?: string;
  wedEndTme?: string;
  thuSttTme?: string;
  thuEndTme?: string;
  friSttTme?: string;
  friEndTme?: string;
  satSttTme?: string;
  satEndTme?: string;
  sunSttTme?: string;
  sunEndTme?: string;
  holSttTme?: string;     // 공휴일 시작
  holEndTme?: string;     // 공휴일 종료
}

/**
 * API 설정
 */
const API_URL = 'http://apis.data.go.kr/B552657/AEDInfoInqireService/getEgytAedManageInfoInqire';
const PAGE_SIZE = SYNC.PAGE_SIZE;

/**
 * XML 파서 인스턴스
 */
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

/**
 * 주소에서 시/도 추출
 */
function extractCity(address: string): string {
  const parts = address.trim().split(/\s+/);
  return parts[0] || '';
}

/**
 * 주소에서 시/군/구 추출
 */
function extractDistrict(address: string): string {
  const parts = address.trim().split(/\s+/);
  return parts[1] || '';
}

/**
 * sourceId에서 ID 생성
 */
function generateId(sourceId: string): string {
  const hash = crypto.createHash('md5').update(sourceId).digest('hex').substring(0, 12);
  return `aed-${hash}`;
}

/**
 * 문자열 값을 안전하게 추출 (숫자가 올 수도 있으므로 String 변환)
 */
function safeString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim() || null;
}

/**
 * 단일 페이지 API 호출 (XML 응답) - 재시도 로직 포함
 */
async function fetchPage(pageNo: number, retryCount = 0): Promise<{ items: AedApiItem[]; totalCount: number }> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const url = new URL(API_URL);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('numOfRows', String(PAGE_SIZE));

  const MAX_RETRIES = 5;

  try {
    // 429 Rate Limit 재시도 로직 (최대 5회, 지수 백오프)
    // eslint-disable-next-line no-undef
    let response: Response | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      response = await fetch(url.toString());

      if (response.status === 429) {
        const waitSec = Math.pow(2, attempt) * 10; // 10, 20, 40, 80, 160초
        console.log(`429 Rate Limit - ${waitSec}초 대기 후 재시도 (${attempt + 1}/${MAX_RETRIES}, page ${pageNo})`);
        await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
        continue;
      }

      // 503 Service Unavailable도 재시도
      if (response.status === 503 && attempt < MAX_RETRIES - 1) {
        const waitSec = Math.pow(2, attempt); // 1, 2, 4, 8초
        console.log(`503 Service Unavailable - ${waitSec}초 대기 후 재시도 (${attempt + 1}/${MAX_RETRIES}, page ${pageNo})`);
        await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
        continue;
      }

      break;
    }

    if (!response || !response.ok) {
      throw new Error(`HTTP error: ${response?.status} ${response?.statusText}`);
    }

    const xmlText = await response.text();
    const parsed = xmlParser.parse(xmlText);

    const header = parsed?.response?.header;
    // resultCode는 XML에서 "00"이지만 fast-xml-parser가 숫자 0으로 파싱함
    const resultCode = String(header?.resultCode);
    if (!header || (resultCode !== '00' && resultCode !== '0')) {
      throw new Error(`API error: ${header?.resultMsg || 'Unknown error'} (code: ${resultCode})`);
    }

    const body = parsed?.response?.body;
    const totalCount = body?.totalCount || 0;

    // items 정규화 (단일 항목이면 배열로 감싸기)
    let items: AedApiItem[] = [];
    const rawItems = body?.items?.item;
    if (Array.isArray(rawItems)) {
      items = rawItems;
    } else if (rawItems) {
      items = [rawItems];
    }

    return { items, totalCount };
  } catch (error) {
    // 네트워크 에러는 최대 3회 재시도
    if (retryCount < 3 && (error instanceof TypeError || (error as { code?: string }).code === 'ECONNREFUSED')) {
      const waitMs = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`네트워크 에러 - ${waitMs}ms 대기 후 재시도 (${retryCount + 1}/3, page ${pageNo})`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return fetchPage(pageNo, retryCount + 1);
    }
    throw error;
  }
}

/**
 * 전체 데이터 조회 (페이지네이션)
 */
async function fetchAllPages(): Promise<AedApiItem[]> {
  const allItems: AedApiItem[] = [];

  // 첫 페이지에서 totalCount 확인
  const firstPage = await fetchPage(1);
  allItems.push(...firstPage.items);

  if (firstPage.totalCount === 0) {
    return allItems;
  }

  const totalPages = Math.ceil(firstPage.totalCount / PAGE_SIZE);
  console.log(`총 ${firstPage.totalCount}건, ${totalPages}페이지 조회 예정`);

  // 나머지 페이지 조회
  for (let pageNo = 2; pageNo <= totalPages; pageNo++) {
    await new Promise((resolve) => setTimeout(resolve, 300)); // rate limit

    const page = await fetchPage(pageNo);
    allItems.push(...page.items);

    if (pageNo % 50 === 0) {
      console.log(`페이지 ${pageNo}/${totalPages} 조회 완료 (${allItems.length}건)`);
    }
  }

  return allItems;
}

/**
 * AED 데이터 동기화 메인 함수
 */
export async function syncAeds(): Promise<{ totalRecords: number; newRecords: number; updatedRecords: number }> {
  // 동기화 히스토리 생성
  const syncHistory = await prisma.syncHistory.create({
    data: {
      category: 'aed',
      status: 'running',
    },
  });

  let totalRecords = 0;
  let newRecords = 0;
  let updatedRecords = 0;

  try {
    console.log('AED(자동심장충격기) 데이터 동기화 시작...');

    // 1. 전체 데이터 조회
    const items = await fetchAllPages();
    totalRecords = items.length;
    console.log(`총 ${totalRecords}건 데이터 조회 완료`);

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
      return { totalRecords: 0, newRecords: 0, updatedRecords: 0 };
    }

    // 2. 데이터 변환
    console.log('데이터 변환 중...');
    interface TransformedAed {
      id: string;
      name: string;
      address: string | null;
      roadAddress: string | null;
      lat: number;
      lng: number;
      city: string;
      district: string;
      sourceId: string;
      buildPlace: string | null;
      org: string | null;
      clerkTel: string | null;
      mfg: string | null;
      model: string | null;
      monSttTme: string | null;
      monEndTme: string | null;
      tueSttTme: string | null;
      tueEndTme: string | null;
      wedSttTme: string | null;
      wedEndTme: string | null;
      thuSttTme: string | null;
      thuEndTme: string | null;
      friSttTme: string | null;
      friEndTme: string | null;
      satSttTme: string | null;
      satEndTme: string | null;
      sunSttTme: string | null;
      sunEndTme: string | null;
      holSttTme: string | null;
      holEndTme: string | null;
    }

    const transformedItems: TransformedAed[] = [];
    for (const item of items) {
      const serialSeq = safeString(item.serialSeq);
      if (!serialSeq) continue;

      const sourceId = serialSeq;
      const id = generateId(sourceId);
      const address = safeString(item.buildAddress);
      const city = address ? extractCity(address) : '';
      const district = address ? extractDistrict(address) : '';
      const orgName = safeString(item.org);

      if (!city || !district) continue;

      transformedItems.push({
        id,
        name: orgName || 'AED(자동심장충격기)',
        address,
        roadAddress: address,
        lat: item.wgs84Lat || 0,
        lng: item.wgs84Lon || 0,
        city,
        district,
        sourceId,
        buildPlace: safeString(item.buildPlace),
        org: orgName,
        clerkTel: safeString(item.clerkTel),
        mfg: safeString(item.mfg),
        model: safeString(item.model),
        monSttTme: safeString(item.monSttTme),
        monEndTme: safeString(item.monEndTme),
        tueSttTme: safeString(item.tueSttTme),
        tueEndTme: safeString(item.tueEndTme),
        wedSttTme: safeString(item.wedSttTme),
        wedEndTme: safeString(item.wedEndTme),
        thuSttTme: safeString(item.thuSttTme),
        thuEndTme: safeString(item.thuEndTme),
        friSttTme: safeString(item.friSttTme),
        friEndTme: safeString(item.friEndTme),
        satSttTme: safeString(item.satSttTme),
        satEndTme: safeString(item.satEndTme),
        sunSttTme: safeString(item.sunSttTme),
        sunEndTme: safeString(item.sunEndTme),
        holSttTme: safeString(item.holSttTme),
        holEndTme: safeString(item.holEndTme),
      });
    }

    console.log(`변환 완료: ${transformedItems.length}/${totalRecords} (스킵: ${totalRecords - transformedItems.length})`);

    // 3. 배치 upsert (트랜잭션 래핑)
    console.log('데이터베이스 저장 중...');
    const BATCH_SIZE = SYNC.BATCH_SIZE;
    for (let i = 0; i < transformedItems.length; i += BATCH_SIZE) {
      const batch = transformedItems.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(transformedItems.length / BATCH_SIZE);

      try {
        // 각 배치를 트랜잭션으로 래핑
        await prisma.$transaction(async (tx) => {
          for (const aed of batch) {
            const existing = await tx.aed.findUnique({
              where: { id: aed.id },
            });

            await tx.aed.upsert({
              where: { id: aed.id },
              create: {
                ...aed,
                sourceUrl: 'https://www.data.go.kr/data/15000652/openapi.do',
                syncedAt: new Date(),
              },
              update: {
                name: aed.name,
                address: aed.address,
                roadAddress: aed.roadAddress,
                lat: aed.lat,
                lng: aed.lng,
                city: aed.city,
                district: aed.district,
                syncedAt: new Date(),
                buildPlace: aed.buildPlace,
                org: aed.org,
                clerkTel: aed.clerkTel,
                mfg: aed.mfg,
                model: aed.model,
                monSttTme: aed.monSttTme,
                monEndTme: aed.monEndTme,
                tueSttTme: aed.tueSttTme,
                tueEndTme: aed.tueEndTme,
                wedSttTme: aed.wedSttTme,
                wedEndTme: aed.wedEndTme,
                thuSttTme: aed.thuSttTme,
                thuEndTme: aed.thuEndTme,
                friSttTme: aed.friSttTme,
                friEndTme: aed.friEndTme,
                satSttTme: aed.satSttTme,
                satEndTme: aed.satEndTme,
                sunSttTme: aed.sunSttTme,
                sunEndTme: aed.sunEndTme,
                holSttTme: aed.holSttTme,
                holEndTme: aed.holEndTme,
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

        console.log(`Batch ${batchNumber}/${totalBatches} 완료: ${Math.min(i + BATCH_SIZE, transformedItems.length)}/${transformedItems.length}`);
      } catch (error) {
        console.error(`Batch ${batchNumber} 저장 실패:`, error);
        throw new Error(`Batch ${batchNumber} upsert failed. Processed: ${i}/${transformedItems.length}`);
      }
    }

    // 4. 동기화 히스토리 업데이트 (성공)
    await prisma.syncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status: 'success',
        totalRecords: transformedItems.length,
        newRecords,
        updatedRecords,
        completedAt: new Date(),
      },
    });

    console.log(`동기화 완료: 총 ${transformedItems.length}건 (신규: ${newRecords}, 업데이트: ${updatedRecords})`);
    return { totalRecords: transformedItems.length, newRecords, updatedRecords };
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

    console.error('AED 동기화 실패:', error);
    throw error;
  }
}

// CLI로 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  syncAeds()
    .then(() => {
      console.log('완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('실패:', error);
      process.exit(1);
    });
}
