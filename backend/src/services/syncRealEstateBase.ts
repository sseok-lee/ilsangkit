// 국토교통부 실거래가 API 공통 유틸
// 아파트/오피스텔/연립다세대/단독다가구 동기화 서비스에서 재사용

import { XMLParser } from 'fast-xml-parser';
import { prisma } from '../lib/prisma.js';

const BASE_URL = 'https://apis.data.go.kr/1613000';

/**
 * sourceId 생성에 사용되는 필드 목록
 */
export interface SourceIdFields {
  bjdCode: string;
  buildYear: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  floor: string;
  area: string;
  dealAmount?: string;
  deposit?: string;
  monthlyRent?: string;
}

/**
 * parseXmlResponse 반환 타입
 */
export interface ParsedXmlResponse {
  resultCode: string;
  resultMsg: string;
  totalCount: number;
  items: Record<string, unknown>[];
}

/**
 * 고유 sourceId 생성
 * 형식: {category}-{bjdCode}-{buildYear}-{dealYear}-{dealMonth}-{dealDay}-{floor}-{area}[-dealAmount][-deposit-monthlyRent]
 */
export function generateSourceId(
  category: string,
  fields: SourceIdFields
): string {
  const { bjdCode, buildYear, dealYear, dealMonth, dealDay, floor, area, dealAmount, deposit, monthlyRent } = fields;
  const parts = [category, bjdCode, buildYear, dealYear, dealMonth, dealDay, floor, area];
  if (dealAmount !== undefined) parts.push(dealAmount);
  if (deposit !== undefined) parts.push(deposit);
  if (monthlyRent !== undefined) parts.push(monthlyRent);
  return parts.join('-');
}

/**
 * fast-xml-parser로 국토교통부 API XML 응답 파싱
 * - 단일 item과 복수 item 모두 배열로 정규화
 * - 오류 응답 감지
 */
export function parseXmlResponse(xmlString: string): ParsedXmlResponse {
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseTagValue: false,
    trimValues: true,
  });

  // fast-xml-parser는 파싱 실패 시 예외를 던지지 않고 빈 객체를 반환하는 경우가 있으므로
  // 기본적인 XML 구조 검증 추가
  if (!xmlString.includes('<response>') && !xmlString.includes('<Response>')) {
    throw new Error(`Invalid XML response: missing <response> root element`);
  }

  const parsed = parser.parse(xmlString) as Record<string, unknown>;
  const response = parsed['response'] as Record<string, unknown> | undefined;

  if (!response) {
    throw new Error('Invalid XML: missing response element');
  }

  const header = response['header'] as Record<string, unknown> | undefined;
  const body = response['body'] as Record<string, unknown> | undefined;

  const resultCode = String(header?.['resultCode'] ?? '');
  const resultMsg = String(header?.['resultMsg'] ?? '');
  const totalCount = Number(body?.['totalCount'] ?? 0);

  // items 정규화: null / 빈 태그 / 단일 item / 복수 item
  const rawItems = body?.['items'];
  let items: Record<string, unknown>[] = [];

  if (rawItems && typeof rawItems === 'object' && !Array.isArray(rawItems)) {
    const rawItemsObj = rawItems as Record<string, unknown>;
    const item = rawItemsObj['item'];
    if (Array.isArray(item)) {
      items = item as Record<string, unknown>[];
    } else if (item && typeof item === 'object') {
      items = [item as Record<string, unknown>];
    }
    // item이 없으면 items는 빈 배열 유지
  }

  return { resultCode, resultMsg, totalCount, items };
}

/**
 * 공공데이터포털 국토교통부 API URL 조합
 * @param serviceName - 서비스명 (예: RTMSDataSvcAptTrade)
 * @param params - 쿼리 파라미터 객체
 */
export function buildApiUrl(
  serviceName: string,
  params: Record<string, string | number>
): string {
  const url = new URL(`${BASE_URL}/${serviceName}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, String(value));
  }
  return url.toString();
}

/**
 * Prisma Region 테이블에서 DISTINCT bjdCode 5자리 추출
 */
export async function getAllLawdCodes(): Promise<string[]> {
  const rows = await prisma.region.findMany({
    select: { bjdCode: true },
    distinct: ['bjdCode'],
  });
  return rows.map((r) => r.bjdCode);
}

/**
 * 국토교통부 API HTTP GET 호출 + XML 파싱 -> JSON 배열 반환
 * @param apiEndpoint - 서비스명 (예: RTMSDataSvcAptTrade)
 * @param lawdCd - 법정동 코드 5자리
 * @param dealYmd - 계약년월 (YYYYMM)
 * @param serviceKey - 공공데이터포털 서비스키 (인코딩된 값)
 */
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, endpoint: string): Promise<string> {
  let attempt = 0;
  while (true) {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/xml, text/xml' },
    });

    if (response.ok) {
      return response.text();
    }

    // 429 또는 5xx는 재시도
    const retryable = response.status === 429 || (response.status >= 500 && response.status < 600);
    if (!retryable || attempt >= MAX_RETRIES) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} (${endpoint})`
      );
    }

    attempt += 1;
    const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1); // 1s, 2s, 4s, 8s, 16s
    console.warn(
      `[${endpoint}] ${response.status} 수신 — ${backoff}ms 대기 후 재시도 (${attempt}/${MAX_RETRIES})`
    );
    await sleep(backoff);
  }
}

export async function fetchRealEstateData(
  apiEndpoint: string,
  lawdCd: string,
  dealYmd: string,
  serviceKey: string
): Promise<Record<string, unknown>[]> {
  const allItems: Record<string, unknown>[] = [];
  let pageNo = 1;

  while (true) {
    const url = buildApiUrl(apiEndpoint, {
      serviceKey,
      LAWD_CD: lawdCd,
      DEAL_YMD: dealYmd,
      numOfRows: '1000',
      pageNo: String(pageNo),
    });

    const xmlText = await fetchWithRetry(url, apiEndpoint);
    const parsed = parseXmlResponse(xmlText);

    if (parsed.resultCode !== '000' && parsed.resultCode !== '00' && parsed.resultCode !== '0') {
      throw new Error(
        `API error: ${parsed.resultCode} - ${parsed.resultMsg} (${apiEndpoint})`
      );
    }

    allItems.push(...parsed.items);

    if (allItems.length >= parsed.totalCount || parsed.items.length === 0) {
      break;
    }

    pageNo++;
  }

  return allItems;
}
