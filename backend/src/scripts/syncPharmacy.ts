// 약국 데이터 동기화 스크립트
// API: https://www.data.go.kr/data/15000576/openapi.do (XML 전용)

import 'dotenv/config';
import prisma from '../lib/prisma.js';
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { SYNC } from '../constants/index.js';
import { extractCityDistrict, normalizeCity } from '../lib/addressParser.js';

/**
 * 약국 API 응답 아이템 타입
 */
interface PharmacyApiItem {
  dutyName?: string;      // 기관명
  dutyAddr?: string;      // 주소
  dutyTel1?: string;      // 대표전화
  dutyTel3?: string;      // 응급실전화
  hpid?: string;          // 기관ID (고유키)
  postCdn1?: number;      // 우편번호1
  postCdn2?: number;      // 우편번호2
  wgs84Lat?: number;      // 위도
  wgs84Lon?: number;      // 경도
  dutyTime1s?: string;    // 월요일 시작시간
  dutyTime1c?: string;    // 월요일 종료시간
  dutyTime2s?: string;    // 화요일 시작시간
  dutyTime2c?: string;    // 화요일 종료시간
  dutyTime3s?: string;    // 수요일 시작시간
  dutyTime3c?: string;    // 수요일 종료시간
  dutyTime4s?: string;    // 목요일 시작시간
  dutyTime4c?: string;    // 목요일 종료시간
  dutyTime5s?: string;    // 금요일 시작시간
  dutyTime5c?: string;    // 금요일 종료시간
  dutyTime6s?: string;    // 토요일 시작시간
  dutyTime6c?: string;    // 토요일 종료시간
  dutyTime7s?: string;    // 일요일 시작시간
  dutyTime7c?: string;    // 일요일 종료시간
  dutyTime8s?: string;    // 공휴일 시작시간
  dutyTime8c?: string;    // 공휴일 종료시간
  dutyMapimg?: string;    // 간이약도
  dutyInf?: string;       // 기관설명
  dutyEtc?: string;       // 비고
}

/**
 * API 설정
 */
const API_URL = 'http://apis.data.go.kr/B552657/ErmctInsttInfoInqireService/getParmacyListInfoInqire';
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
 * sourceId에서 ID 생성
 */
function generateId(sourceId: string): string {
  const hash = crypto.createHash('md5').update(sourceId).digest('hex').substring(0, 12);
  return `pharmacy-${hash}`;
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
async function fetchPage(pageNo: number, retryCount = 0): Promise<{ items: PharmacyApiItem[]; totalCount: number }> {
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
    let items: PharmacyApiItem[] = [];
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
async function fetchAllPages(): Promise<PharmacyApiItem[]> {
  const allItems: PharmacyApiItem[] = [];

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
 * 약국 데이터 동기화 메인 함수
 */
export async function syncPharmacies(): Promise<{ totalRecords: number; newRecords: number; updatedRecords: number }> {
  // 동기화 히스토리 생성
  const syncHistory = await prisma.syncHistory.create({
    data: {
      category: 'pharmacy',
      status: 'running',
    },
  });

  let totalRecords = 0;
  let newRecords = 0;
  let updatedRecords = 0;

  try {
    console.log('약국 데이터 동기화 시작...');

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
    interface TransformedPharmacy {
      id: string;
      name: string;
      address: string | null;
      roadAddress: string | null;
      lat: number;
      lng: number;
      city: string;
      district: string;
      sourceId: string;
      phone: string | null;
      dutyTel3: string | null;
      hpid: string;
      postCdn1: string | null;
      postCdn2: string | null;
      dutyTime1s: string | null;
      dutyTime1c: string | null;
      dutyTime2s: string | null;
      dutyTime2c: string | null;
      dutyTime3s: string | null;
      dutyTime3c: string | null;
      dutyTime4s: string | null;
      dutyTime4c: string | null;
      dutyTime5s: string | null;
      dutyTime5c: string | null;
      dutyTime6s: string | null;
      dutyTime6c: string | null;
      dutyTime7s: string | null;
      dutyTime7c: string | null;
      dutyTime8s: string | null;
      dutyTime8c: string | null;
      dutyMapimg: string | null;
      dutyInf: string | null;
      dutyEtc: string | null;
    }

    const transformedItems: TransformedPharmacy[] = [];
    for (const item of items) {
      const hpid = safeString(item.hpid);
      if (!hpid) continue;

      const sourceId = hpid;
      const id = generateId(sourceId);
      const address = safeString(item.dutyAddr);
      const extracted = address ? extractCityDistrict(address) : { city: '', district: '' };
      const city = extracted.city ? normalizeCity(extracted.city) : '';
      const district = extracted.district;

      if (!city || !district) continue;

      transformedItems.push({
        id,
        name: safeString(item.dutyName) || '약국',
        address,
        roadAddress: address,
        lat: item.wgs84Lat || 0,
        lng: item.wgs84Lon || 0,
        city,
        district,
        sourceId,
        phone: safeString(item.dutyTel1),
        dutyTel3: safeString(item.dutyTel3),
        hpid,
        postCdn1: safeString(item.postCdn1),
        postCdn2: safeString(item.postCdn2),
        dutyTime1s: safeString(item.dutyTime1s),
        dutyTime1c: safeString(item.dutyTime1c),
        dutyTime2s: safeString(item.dutyTime2s),
        dutyTime2c: safeString(item.dutyTime2c),
        dutyTime3s: safeString(item.dutyTime3s),
        dutyTime3c: safeString(item.dutyTime3c),
        dutyTime4s: safeString(item.dutyTime4s),
        dutyTime4c: safeString(item.dutyTime4c),
        dutyTime5s: safeString(item.dutyTime5s),
        dutyTime5c: safeString(item.dutyTime5c),
        dutyTime6s: safeString(item.dutyTime6s),
        dutyTime6c: safeString(item.dutyTime6c),
        dutyTime7s: safeString(item.dutyTime7s),
        dutyTime7c: safeString(item.dutyTime7c),
        dutyTime8s: safeString(item.dutyTime8s),
        dutyTime8c: safeString(item.dutyTime8c),
        dutyMapimg: safeString(item.dutyMapimg),
        dutyInf: safeString(item.dutyInf),
        dutyEtc: safeString(item.dutyEtc),
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
          for (const pharmacy of batch) {
            const existing = await tx.pharmacy.findUnique({
              where: { id: pharmacy.id },
            });

            await tx.pharmacy.upsert({
              where: { id: pharmacy.id },
              create: {
                ...pharmacy,
                sourceUrl: 'https://www.data.go.kr/data/15000576/openapi.do',
                syncedAt: new Date(),
              },
              update: {
                name: pharmacy.name,
                address: pharmacy.address,
                roadAddress: pharmacy.roadAddress,
                lat: pharmacy.lat,
                lng: pharmacy.lng,
                city: pharmacy.city,
                district: pharmacy.district,
                syncedAt: new Date(),
                phone: pharmacy.phone,
                dutyTel3: pharmacy.dutyTel3,
                postCdn1: pharmacy.postCdn1,
                postCdn2: pharmacy.postCdn2,
                dutyTime1s: pharmacy.dutyTime1s,
                dutyTime1c: pharmacy.dutyTime1c,
                dutyTime2s: pharmacy.dutyTime2s,
                dutyTime2c: pharmacy.dutyTime2c,
                dutyTime3s: pharmacy.dutyTime3s,
                dutyTime3c: pharmacy.dutyTime3c,
                dutyTime4s: pharmacy.dutyTime4s,
                dutyTime4c: pharmacy.dutyTime4c,
                dutyTime5s: pharmacy.dutyTime5s,
                dutyTime5c: pharmacy.dutyTime5c,
                dutyTime6s: pharmacy.dutyTime6s,
                dutyTime6c: pharmacy.dutyTime6c,
                dutyTime7s: pharmacy.dutyTime7s,
                dutyTime7c: pharmacy.dutyTime7c,
                dutyTime8s: pharmacy.dutyTime8s,
                dutyTime8c: pharmacy.dutyTime8c,
                dutyMapimg: pharmacy.dutyMapimg,
                dutyInf: pharmacy.dutyInf,
                dutyEtc: pharmacy.dutyEtc,
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

    console.error('약국 동기화 실패:', error);
    throw error;
  }
}

// CLI로 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  syncPharmacies()
    .then(() => {
      console.log('완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('실패:', error);
      process.exit(1);
    });
}
