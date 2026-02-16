// 병원 데이터 동기화 스크립트
// API: https://www.data.go.kr/data/15001698/openapi.do (XML 전용)

import 'dotenv/config';
import prisma from '../lib/prisma.js';
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { SYNC } from '../constants/index.js';
import { normalizeCity } from '../lib/addressParser.js';

/**
 * Hospital API 응답 아이템 타입
 */
interface HospitalApiItem {
  yadmNm?: string;           // 병원명
  addr?: string;             // 주소
  telno?: string;            // 전화번호
  hospUrl?: string;          // 홈페이지
  postNo?: string;           // 우편번호
  estbDd?: string;           // 개설일자
  ykiho?: string;            // 암호화 요양기호 (고유키)
  clCd?: string;             // 종별코드
  clCdNm?: string;           // 종별코드명
  sidoCd?: string;           // 시도코드
  sidoCdNm?: string;         // 시도명
  sgguCd?: string;           // 시군구코드
  sgguCdNm?: string;         // 시군구명
  emdongNm?: string;         // 읍면동명
  XPos?: number;             // X좌표
  YPos?: number;             // Y좌표
  drTotCnt?: number;         // 의사총수
  mdeptSdrCnt?: number;      // 내과전문의수
  mdeptGdrCnt?: number;      // 내과일반의수
  mdeptIntnCnt?: number;     // 내과인턴수
  mdeptResdntCnt?: number;   // 내과레지던트수
  detySdrCnt?: number;       // 치과전문의수
  detyGdrCnt?: number;       // 치과일반의수
  detyIntnCnt?: number;      // 치과인턴수
  detyResdntCnt?: number;    // 치과레지던트수
  cmdcSdrCnt?: number;       // 한방전문의수
  cmdcGdrCnt?: number;       // 한방일반의수
  cmdcIntnCnt?: number;      // 한방인턴수
  cmdcResdntCnt?: number;    // 한방레지던트수
  pnursCnt?: number;         // 간호사수
}

/**
 * API 설정
 */
const API_URL = 'https://apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList';
const PAGE_SIZE = 1000;

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
  return `hospital-${hash}`;
}

/**
 * 문자열 값을 안전하게 추출 (숫자가 올 수도 있으므로 String 변환)
 */
function safeString(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  return String(value).trim() || null;
}

/**
 * 숫자 값을 안전하게 추출
 */
function safeInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * 단일 페이지 API 호출 (XML 응답) - 재시도 로직 포함
 */
async function fetchPage(pageNo: number, retryCount = 0): Promise<{ items: HospitalApiItem[]; totalCount: number }> {
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
    let items: HospitalApiItem[] = [];
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
async function fetchAllPages(): Promise<HospitalApiItem[]> {
  const allItems: HospitalApiItem[] = [];

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
 * 병원 데이터 동기화 메인 함수
 */
export async function syncHospitals(): Promise<{ totalRecords: number; newRecords: number; updatedRecords: number }> {
  // 동기화 히스토리 생성
  const syncHistory = await prisma.syncHistory.create({
    data: {
      category: 'hospital',
      status: 'running',
    },
  });

  let totalRecords = 0;
  let newRecords = 0;
  let updatedRecords = 0;

  try {
    console.log('병원 데이터 동기화 시작...');

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
    interface TransformedHospital {
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
      homepage: string | null;
      postNo: string | null;
      estbDd: string | null;
      ykiho: string | null;
      clCd: string | null;
      clCdNm: string | null;
      sidoCd: string | null;
      sgguCd: string | null;
      emdongNm: string | null;
      drTotCnt: number | null;
      mdeptSdrCnt: number | null;
      mdeptGdrCnt: number | null;
      mdeptIntnCnt: number | null;
      mdeptResdntCnt: number | null;
      detySdrCnt: number | null;
      detyGdrCnt: number | null;
      detyIntnCnt: number | null;
      detyResdntCnt: number | null;
      cmdcSdrCnt: number | null;
      cmdcGdrCnt: number | null;
      cmdcIntnCnt: number | null;
      cmdcResdntCnt: number | null;
      pnursCnt: number | null;
    }

    const transformedItems: TransformedHospital[] = [];
    for (const item of items) {
      const ykiho = safeString(item.ykiho);
      if (!ykiho) continue;

      const sourceId = ykiho;
      const id = generateId(sourceId);
      const sidoCdNm = safeString(item.sidoCdNm);
      const sgguCdNm = safeString(item.sgguCdNm);

      if (!sidoCdNm || !sgguCdNm) continue;

      const city = normalizeCity(sidoCdNm);
      const district = sgguCdNm;

      transformedItems.push({
        id,
        name: safeString(item.yadmNm) || '병원',
        address: safeString(item.addr),
        roadAddress: safeString(item.addr),
        lat: item.YPos || 0,
        lng: item.XPos || 0,
        city,
        district,
        sourceId,
        phone: safeString(item.telno),
        homepage: safeString(item.hospUrl),
        postNo: safeString(item.postNo),
        estbDd: safeString(item.estbDd),
        ykiho: safeString(item.ykiho),
        clCd: safeString(item.clCd),
        clCdNm: safeString(item.clCdNm),
        sidoCd: safeString(item.sidoCd),
        sgguCd: safeString(item.sgguCd),
        emdongNm: safeString(item.emdongNm),
        drTotCnt: safeInt(item.drTotCnt),
        mdeptSdrCnt: safeInt(item.mdeptSdrCnt),
        mdeptGdrCnt: safeInt(item.mdeptGdrCnt),
        mdeptIntnCnt: safeInt(item.mdeptIntnCnt),
        mdeptResdntCnt: safeInt(item.mdeptResdntCnt),
        detySdrCnt: safeInt(item.detySdrCnt),
        detyGdrCnt: safeInt(item.detyGdrCnt),
        detyIntnCnt: safeInt(item.detyIntnCnt),
        detyResdntCnt: safeInt(item.detyResdntCnt),
        cmdcSdrCnt: safeInt(item.cmdcSdrCnt),
        cmdcGdrCnt: safeInt(item.cmdcGdrCnt),
        cmdcIntnCnt: safeInt(item.cmdcIntnCnt),
        cmdcResdntCnt: safeInt(item.cmdcResdntCnt),
        pnursCnt: safeInt(item.pnursCnt),
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
          for (const hospital of batch) {
            const existing = await tx.hospital.findUnique({
              where: { id: hospital.id },
            });

            await tx.hospital.upsert({
              where: { id: hospital.id },
              create: {
                ...hospital,
                sourceUrl: 'https://www.data.go.kr/data/15001698/openapi.do',
                syncedAt: new Date(),
              },
              update: {
                name: hospital.name,
                address: hospital.address,
                roadAddress: hospital.roadAddress,
                lat: hospital.lat,
                lng: hospital.lng,
                city: hospital.city,
                district: hospital.district,
                syncedAt: new Date(),
                phone: hospital.phone,
                homepage: hospital.homepage,
                postNo: hospital.postNo,
                estbDd: hospital.estbDd,
                ykiho: hospital.ykiho,
                clCd: hospital.clCd,
                clCdNm: hospital.clCdNm,
                sidoCd: hospital.sidoCd,
                sgguCd: hospital.sgguCd,
                emdongNm: hospital.emdongNm,
                drTotCnt: hospital.drTotCnt,
                mdeptSdrCnt: hospital.mdeptSdrCnt,
                mdeptGdrCnt: hospital.mdeptGdrCnt,
                mdeptIntnCnt: hospital.mdeptIntnCnt,
                mdeptResdntCnt: hospital.mdeptResdntCnt,
                detySdrCnt: hospital.detySdrCnt,
                detyGdrCnt: hospital.detyGdrCnt,
                detyIntnCnt: hospital.detyIntnCnt,
                detyResdntCnt: hospital.detyResdntCnt,
                cmdcSdrCnt: hospital.cmdcSdrCnt,
                cmdcGdrCnt: hospital.cmdcGdrCnt,
                cmdcIntnCnt: hospital.cmdcIntnCnt,
                cmdcResdntCnt: hospital.cmdcResdntCnt,
                pnursCnt: hospital.pnursCnt,
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

    console.error('병원 동기화 실패:', error);
    throw error;
  }
}

// CLI로 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  syncHospitals()
    .then(() => {
      console.log('완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('실패:', error);
      process.exit(1);
    });
}
