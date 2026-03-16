import { prisma } from '../lib/prisma.js';
import { XMLParser } from 'fast-xml-parser';
import { KOREA_BOUNDS } from '../constants/index.js';
import { CITY_NAME_MAP } from './csvParser.js';
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  batchUpsert,
} from './baseSyncService.js';

export { createSyncHistory, updateSyncHistory };
export type { SyncStats, SyncHistoryUpdateData };

const CHILDCARE_API_URL = 'https://api.childcare.go.kr/mediate/rest/cpmsapi030/cpmsapi030/request';

// 서울 특별/광역시 아르코드 목록 (행정구역코드 앞 5자리 기준)
// 실제 운영 시 전국 아르코드 목록으로 확장 필요
export const DEFAULT_ARCODES = [
  '11010', '11020', '11030', '11040', '11050', '11060', '11070', '11080',
  '11090', '11100', '11110', '11120', '11130', '11140', '11150', '11160',
  '11170', '11180', '11190', '11200', '11210', '11220', '11230', '11240',
  '11250', // 서울 25개 구
  '21010', '21020', '21030', '21040', '21050', '21060', '21070', '21080',
  '21090', '21100', // 부산
];

/**
 * API raw item 타입
 */
export interface ChildcareAPIItem {
  sidoname?: string;
  sigunname?: string;
  stcode?: string;
  crname?: string;
  crtypename?: string;
  crstatusname?: string;
  zipcode?: string;
  craddr?: string;
  crtelno?: string;
  crfaxno?: string;
  crhome?: string;
  CRREPNAME?: string;
  nrtrroomcnt?: string | number;
  nrtrroomsize?: string;
  plgrdco?: string | number;
  cctvinstlcnt?: string | number;
  chcrtescnt?: string | number;
  crcapat?: string | number;
  crchcnt?: string | number;
  la?: string | number;
  lo?: string | number;
  crcargbname?: string;
  crcnfmdt?: string;
  crpausebegindt?: string;
  crpauseenddt?: string;
  crabldt?: string;
  datastdrdt?: string;
  crspec?: string;
  CLASS_CNT_00?: string | number;
  CLASS_CNT_01?: string | number;
  CLASS_CNT_02?: string | number;
  CLASS_CNT_03?: string | number;
  CLASS_CNT_04?: string | number;
  CLASS_CNT_05?: string | number;
  CLASS_CNT_M2?: string | number;
  CLASS_CNT_M5?: string | number;
  CLASS_CNT_SP?: string | number;
  CLASS_CNT_TOT?: string | number;
  CHILD_CNT_00?: string | number;
  CHILD_CNT_01?: string | number;
  CHILD_CNT_02?: string | number;
  CHILD_CNT_03?: string | number;
  CHILD_CNT_04?: string | number;
  CHILD_CNT_05?: string | number;
  CHILD_CNT_M2?: string | number;
  CHILD_CNT_M5?: string | number;
  CHILD_CNT_SP?: string | number;
  CHILD_CNT_TOT?: string | number;
  EM_CNT_0Y?: string | number;
  EM_CNT_1Y?: string | number;
  EM_CNT_2Y?: string | number;
  EM_CNT_4Y?: string | number;
  EM_CNT_6Y?: string | number;
  EM_CNT_A1?: string | number;
  EM_CNT_A2?: string | number;
  EM_CNT_A3?: string | number;
  EM_CNT_A4?: string | number;
  EM_CNT_A5?: string | number;
  EM_CNT_A6?: string | number;
  EM_CNT_A10?: string | number;
  EM_CNT_A7?: string | number;
  EM_CNT_A8?: string | number;
  EM_CNT_TOT?: string | number;
  EW_CNT_00?: string | number;
  EW_CNT_01?: string | number;
  EW_CNT_02?: string | number;
  EW_CNT_03?: string | number;
  EW_CNT_04?: string | number;
  EW_CNT_05?: string | number;
  EW_CNT_M6?: string | number;
  EW_CNT_TOT?: string | number;
}

/**
 * 변환된 어린이집 데이터 타입
 */
export interface TransformedChildcare {
  id: string;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  city: string;
  district: string;
  sourceId: string;
  crtypename: string | null;
  crstatusname: string | null;
  zipcode: string | null;
  crtelno: string | null;
  crfaxno: string | null;
  crhome: string | null;
  crrepname: string | null;
  nrtrroomcnt: number | null;
  nrtrroomsize: string | null;
  plgrdco: number | null;
  cctvinstlcnt: number | null;
  chcrtescnt: number | null;
  crcapat: number | null;
  crchcnt: number | null;
  crcargbname: string | null;
  crcnfmdt: string | null;
  crpausebegindt: string | null;
  crpauseenddt: string | null;
  crabldt: string | null;
  datastdrdt: string | null;
  crspec: string | null;
  classCnt00: number | null;
  classCnt01: number | null;
  classCnt02: number | null;
  classCnt03: number | null;
  classCnt04: number | null;
  classCnt05: number | null;
  classCntM2: number | null;
  classCntM5: number | null;
  classCntSp: number | null;
  classCntTot: number | null;
  childCnt00: number | null;
  childCnt01: number | null;
  childCnt02: number | null;
  childCnt03: number | null;
  childCnt04: number | null;
  childCnt05: number | null;
  childCntM2: number | null;
  childCntM5: number | null;
  childCntSp: number | null;
  childCntTot: number | null;
  emCnt0y: number | null;
  emCnt1y: number | null;
  emCnt2y: number | null;
  emCnt4y: number | null;
  emCnt6y: number | null;
  emCntA1: number | null;
  emCntA2: number | null;
  emCntA3: number | null;
  emCntA4: number | null;
  emCntA5: number | null;
  emCntA6: number | null;
  emCntA10: number | null;
  emCntA7: number | null;
  emCntA8: number | null;
  emCntTot: number | null;
  ewCnt00: number | null;
  ewCnt01: number | null;
  ewCnt02: number | null;
  ewCnt03: number | null;
  ewCnt04: number | null;
  ewCnt05: number | null;
  ewCntM6: number | null;
  ewCntTot: number | null;
}

/**
 * 빈 문자열 또는 undefined를 null로 변환
 */
function toStringOrNull(val: string | number | undefined): string | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

/**
 * 정수 변환 (빈 문자열 → null)
 */
export function toIntOrNull(val: string | number | undefined): number | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '') return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

/**
 * 좌표 변환 및 한국 범위 검증
 */
function toValidCoord(
  latVal: string | number | undefined,
  lngVal: string | number | undefined
): { lat: number | null; lng: number | null } {
  const latStr = String(latVal ?? '').trim();
  const lngStr = String(lngVal ?? '').trim();

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  if (
    isNaN(lat) || isNaN(lng) ||
    lat < KOREA_BOUNDS.LAT_MIN || lat > KOREA_BOUNDS.LAT_MAX ||
    lng < KOREA_BOUNDS.LNG_MIN || lng > KOREA_BOUNDS.LNG_MAX
  ) {
    return { lat: null, lng: null };
  }

  return { lat, lng };
}

/**
 * 주소에서 시/도, 구/군 추출
 */
function parseAddress(address: string): { city: string; district: string } {
  const parts = address.trim().split(/\s+/);
  const rawCity = parts[0] || '';
  const district = parts[1] || '';
  const city = CITY_NAME_MAP[rawCity] || rawCity;
  return { city, district };
}

/**
 * API item → TransformedChildcare 변환
 */
export function transformChildcareItem(item: ChildcareAPIItem): TransformedChildcare | null {
  const sourceId = toStringOrNull(item.stcode);
  const name = toStringOrNull(item.crname);

  if (!sourceId || !name) return null;

  const address = toStringOrNull(item.craddr);
  if (!address) return null;

  const { city, district } = parseAddress(address);
  if (!city || !district) return null;

  const { lat, lng } = toValidCoord(item.la, item.lo);

  return {
    id: `childcare-${sourceId}`,
    name,
    address,
    roadAddress: null, // API에서 도로명주소 미제공
    lat,
    lng,
    city,
    district,
    sourceId,
    crtypename: toStringOrNull(item.crtypename),
    crstatusname: toStringOrNull(item.crstatusname),
    zipcode: toStringOrNull(item.zipcode),
    crtelno: toStringOrNull(item.crtelno),
    crfaxno: toStringOrNull(item.crfaxno),
    crhome: toStringOrNull(item.crhome),
    crrepname: toStringOrNull(item.CRREPNAME),
    nrtrroomcnt: toIntOrNull(item.nrtrroomcnt),
    nrtrroomsize: toStringOrNull(item.nrtrroomsize),
    plgrdco: toIntOrNull(item.plgrdco),
    cctvinstlcnt: toIntOrNull(item.cctvinstlcnt),
    chcrtescnt: toIntOrNull(item.chcrtescnt),
    crcapat: toIntOrNull(item.crcapat),
    crchcnt: toIntOrNull(item.crchcnt),
    crcargbname: toStringOrNull(item.crcargbname),
    crcnfmdt: toStringOrNull(item.crcnfmdt),
    crpausebegindt: toStringOrNull(item.crpausebegindt),
    crpauseenddt: toStringOrNull(item.crpauseenddt),
    crabldt: toStringOrNull(item.crabldt),
    datastdrdt: toStringOrNull(item.datastdrdt),
    crspec: toStringOrNull(item.crspec),
    classCnt00: toIntOrNull(item.CLASS_CNT_00),
    classCnt01: toIntOrNull(item.CLASS_CNT_01),
    classCnt02: toIntOrNull(item.CLASS_CNT_02),
    classCnt03: toIntOrNull(item.CLASS_CNT_03),
    classCnt04: toIntOrNull(item.CLASS_CNT_04),
    classCnt05: toIntOrNull(item.CLASS_CNT_05),
    classCntM2: toIntOrNull(item.CLASS_CNT_M2),
    classCntM5: toIntOrNull(item.CLASS_CNT_M5),
    classCntSp: toIntOrNull(item.CLASS_CNT_SP),
    classCntTot: toIntOrNull(item.CLASS_CNT_TOT),
    childCnt00: toIntOrNull(item.CHILD_CNT_00),
    childCnt01: toIntOrNull(item.CHILD_CNT_01),
    childCnt02: toIntOrNull(item.CHILD_CNT_02),
    childCnt03: toIntOrNull(item.CHILD_CNT_03),
    childCnt04: toIntOrNull(item.CHILD_CNT_04),
    childCnt05: toIntOrNull(item.CHILD_CNT_05),
    childCntM2: toIntOrNull(item.CHILD_CNT_M2),
    childCntM5: toIntOrNull(item.CHILD_CNT_M5),
    childCntSp: toIntOrNull(item.CHILD_CNT_SP),
    childCntTot: toIntOrNull(item.CHILD_CNT_TOT),
    emCnt0y: toIntOrNull(item.EM_CNT_0Y),
    emCnt1y: toIntOrNull(item.EM_CNT_1Y),
    emCnt2y: toIntOrNull(item.EM_CNT_2Y),
    emCnt4y: toIntOrNull(item.EM_CNT_4Y),
    emCnt6y: toIntOrNull(item.EM_CNT_6Y),
    emCntA1: toIntOrNull(item.EM_CNT_A1),
    emCntA2: toIntOrNull(item.EM_CNT_A2),
    emCntA3: toIntOrNull(item.EM_CNT_A3),
    emCntA4: toIntOrNull(item.EM_CNT_A4),
    emCntA5: toIntOrNull(item.EM_CNT_A5),
    emCntA6: toIntOrNull(item.EM_CNT_A6),
    emCntA10: toIntOrNull(item.EM_CNT_A10),
    emCntA7: toIntOrNull(item.EM_CNT_A7),
    emCntA8: toIntOrNull(item.EM_CNT_A8),
    emCntTot: toIntOrNull(item.EM_CNT_TOT),
    ewCnt00: toIntOrNull(item.EW_CNT_00),
    ewCnt01: toIntOrNull(item.EW_CNT_01),
    ewCnt02: toIntOrNull(item.EW_CNT_02),
    ewCnt03: toIntOrNull(item.EW_CNT_03),
    ewCnt04: toIntOrNull(item.EW_CNT_04),
    ewCnt05: toIntOrNull(item.EW_CNT_05),
    ewCntM6: toIntOrNull(item.EW_CNT_M6),
    ewCntTot: toIntOrNull(item.EW_CNT_TOT),
  };
}

/**
 * 단일 페이지 API 호출 → item 배열 반환
 */
export async function fetchChildcarePage(
  apiKey: string,
  arcode: string,
  pageNo: number
): Promise<{ items: ChildcareAPIItem[]; totalCount: number }> {
  const params = new URLSearchParams({
    key: apiKey,
    arcode,
    crstatustype: '1',
    pageNo: String(pageNo),
  });

  const url = `${CHILDCARE_API_URL}?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  const xmlText = await response.text();

  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: true,
    allowBooleanAttributes: true,
  });

  const parsed = parser.parse(xmlText);

  // 응답 구조: response.item 또는 response.items.item
  const responseData = parsed?.response ?? parsed;
  const totalCount = parseInt(String(responseData?.totalCount ?? '0'), 10) || 0;

  let rawItems = responseData?.item ?? responseData?.items?.item;
  if (!rawItems) {
    return { items: [], totalCount };
  }

  // 단건 응답 시 배열이 아닐 수 있음
  if (!Array.isArray(rawItems)) {
    rawItems = [rawItems];
  }

  return { items: rawItems as ChildcareAPIItem[], totalCount };
}

/**
 * 어린이집 데이터 동기화 메인 함수
 * arcode 목록을 순회하며 페이지네이션으로 전체 데이터 수집 → upsert
 */
export async function syncChildcare(
  arcodes: string[] = DEFAULT_ARCODES
): Promise<SyncStats> {
  const apiKey = process.env.CHILDCARE_LIST_API_KEY;
  if (!apiKey) {
    throw new Error('CHILDCARE_LIST_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('childcare');

  try {
    const allItems: TransformedChildcare[] = [];

    for (const arcode of arcodes) {
      console.info(`Fetching arcode: ${arcode}`);
      let pageNo = 1;

      for (;;) {
        const { items, totalCount } = await fetchChildcarePage(apiKey, arcode, pageNo);

        if (items.length === 0) break;

        for (const item of items) {
          const transformed = transformChildcareItem(item);
          if (transformed) {
            allItems.push(transformed);
          } else {
            stats.skippedRecords++;
          }
        }

        stats.totalRecords += items.length;
        console.info(`  page ${pageNo}: ${items.length} items (total: ${totalCount})`);

        // 마지막 페이지 판단
        if (items.length < 10 || stats.totalRecords >= totalCount) break;
        pageNo++;
      }
    }

    // 중복 제거 (sourceId 기준)
    const uniqueMap = new Map<string, TransformedChildcare>();
    for (const item of allItems) {
      uniqueMap.set(item.sourceId, item);
    }
    const uniqueItems = Array.from(uniqueMap.values());
    const duplicateCount = allItems.length - uniqueItems.length;
    stats.skippedRecords += duplicateCount;

    console.info(`Transformed ${uniqueItems.length} unique records, skipped ${stats.skippedRecords}`);
    console.info('Upserting to database...');

    const { newCount, updateCount } = await batchUpsert(
      uniqueItems,
      async (childcare) => {
        const existing = await prisma.childcare.findUnique({
          where: { sourceId: childcare.sourceId },
        });

        await prisma.childcare.upsert({
          where: { sourceId: childcare.sourceId },
          update: {
            name: childcare.name,
            address: childcare.address,
            roadAddress: childcare.roadAddress,
            lat: childcare.lat,
            lng: childcare.lng,
            city: childcare.city,
            district: childcare.district,
            crtypename: childcare.crtypename,
            crstatusname: childcare.crstatusname,
            zipcode: childcare.zipcode,
            crtelno: childcare.crtelno,
            crfaxno: childcare.crfaxno,
            crhome: childcare.crhome,
            crrepname: childcare.crrepname,
            nrtrroomcnt: childcare.nrtrroomcnt,
            nrtrroomsize: childcare.nrtrroomsize,
            plgrdco: childcare.plgrdco,
            cctvinstlcnt: childcare.cctvinstlcnt,
            chcrtescnt: childcare.chcrtescnt,
            crcapat: childcare.crcapat,
            crchcnt: childcare.crchcnt,
            crcargbname: childcare.crcargbname,
            crcnfmdt: childcare.crcnfmdt,
            crpausebegindt: childcare.crpausebegindt,
            crpauseenddt: childcare.crpauseenddt,
            crabldt: childcare.crabldt,
            datastdrdt: childcare.datastdrdt,
            crspec: childcare.crspec,
            classCnt00: childcare.classCnt00,
            classCnt01: childcare.classCnt01,
            classCnt02: childcare.classCnt02,
            classCnt03: childcare.classCnt03,
            classCnt04: childcare.classCnt04,
            classCnt05: childcare.classCnt05,
            classCntM2: childcare.classCntM2,
            classCntM5: childcare.classCntM5,
            classCntSp: childcare.classCntSp,
            classCntTot: childcare.classCntTot,
            childCnt00: childcare.childCnt00,
            childCnt01: childcare.childCnt01,
            childCnt02: childcare.childCnt02,
            childCnt03: childcare.childCnt03,
            childCnt04: childcare.childCnt04,
            childCnt05: childcare.childCnt05,
            childCntM2: childcare.childCntM2,
            childCntM5: childcare.childCntM5,
            childCntSp: childcare.childCntSp,
            childCntTot: childcare.childCntTot,
            emCnt0y: childcare.emCnt0y,
            emCnt1y: childcare.emCnt1y,
            emCnt2y: childcare.emCnt2y,
            emCnt4y: childcare.emCnt4y,
            emCnt6y: childcare.emCnt6y,
            emCntA1: childcare.emCntA1,
            emCntA2: childcare.emCntA2,
            emCntA3: childcare.emCntA3,
            emCntA4: childcare.emCntA4,
            emCntA5: childcare.emCntA5,
            emCntA6: childcare.emCntA6,
            emCntA10: childcare.emCntA10,
            emCntA7: childcare.emCntA7,
            emCntA8: childcare.emCntA8,
            emCntTot: childcare.emCntTot,
            ewCnt00: childcare.ewCnt00,
            ewCnt01: childcare.ewCnt01,
            ewCnt02: childcare.ewCnt02,
            ewCnt03: childcare.ewCnt03,
            ewCnt04: childcare.ewCnt04,
            ewCnt05: childcare.ewCnt05,
            ewCntM6: childcare.ewCntM6,
            ewCntTot: childcare.ewCntTot,
            syncedAt: new Date(),
          },
          create: {
            id: childcare.id,
            name: childcare.name,
            address: childcare.address,
            roadAddress: childcare.roadAddress,
            lat: childcare.lat,
            lng: childcare.lng,
            city: childcare.city,
            district: childcare.district,
            sourceId: childcare.sourceId,
            crtypename: childcare.crtypename,
            crstatusname: childcare.crstatusname,
            zipcode: childcare.zipcode,
            crtelno: childcare.crtelno,
            crfaxno: childcare.crfaxno,
            crhome: childcare.crhome,
            crrepname: childcare.crrepname,
            nrtrroomcnt: childcare.nrtrroomcnt,
            nrtrroomsize: childcare.nrtrroomsize,
            plgrdco: childcare.plgrdco,
            cctvinstlcnt: childcare.cctvinstlcnt,
            chcrtescnt: childcare.chcrtescnt,
            crcapat: childcare.crcapat,
            crchcnt: childcare.crchcnt,
            crcargbname: childcare.crcargbname,
            crcnfmdt: childcare.crcnfmdt,
            crpausebegindt: childcare.crpausebegindt,
            crpauseenddt: childcare.crpauseenddt,
            crabldt: childcare.crabldt,
            datastdrdt: childcare.datastdrdt,
            crspec: childcare.crspec,
            classCnt00: childcare.classCnt00,
            classCnt01: childcare.classCnt01,
            classCnt02: childcare.classCnt02,
            classCnt03: childcare.classCnt03,
            classCnt04: childcare.classCnt04,
            classCnt05: childcare.classCnt05,
            classCntM2: childcare.classCntM2,
            classCntM5: childcare.classCntM5,
            classCntSp: childcare.classCntSp,
            classCntTot: childcare.classCntTot,
            childCnt00: childcare.childCnt00,
            childCnt01: childcare.childCnt01,
            childCnt02: childcare.childCnt02,
            childCnt03: childcare.childCnt03,
            childCnt04: childcare.childCnt04,
            childCnt05: childcare.childCnt05,
            childCntM2: childcare.childCntM2,
            childCntM5: childcare.childCntM5,
            childCntSp: childcare.childCntSp,
            childCntTot: childcare.childCntTot,
            emCnt0y: childcare.emCnt0y,
            emCnt1y: childcare.emCnt1y,
            emCnt2y: childcare.emCnt2y,
            emCnt4y: childcare.emCnt4y,
            emCnt6y: childcare.emCnt6y,
            emCntA1: childcare.emCntA1,
            emCntA2: childcare.emCntA2,
            emCntA3: childcare.emCntA3,
            emCntA4: childcare.emCntA4,
            emCntA5: childcare.emCntA5,
            emCntA6: childcare.emCntA6,
            emCntA10: childcare.emCntA10,
            emCntA7: childcare.emCntA7,
            emCntA8: childcare.emCntA8,
            emCntTot: childcare.emCntTot,
            ewCnt00: childcare.ewCnt00,
            ewCnt01: childcare.ewCnt01,
            ewCnt02: childcare.ewCnt02,
            ewCnt03: childcare.ewCnt03,
            ewCnt04: childcare.ewCnt04,
            ewCnt05: childcare.ewCnt05,
            ewCntM6: childcare.ewCntM6,
            ewCntTot: childcare.ewCntTot,
          },
        });

        return existing ? 'updated' : 'new';
      },
      100,
      syncHistory.id
    );

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`childcare sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('childcare sync failed:', errorMessage);
    throw error;
  }
}

export default { syncChildcare, createSyncHistory, updateSyncHistory };
