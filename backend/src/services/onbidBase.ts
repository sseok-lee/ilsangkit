// backend/src/services/onbidBase.ts
const LIST_URL = 'https://apis.data.go.kr/B010003/OnbidRlstListSrvc2/getRlstCltrList2';
const DETAIL_URL = 'https://apis.data.go.kr/B010003/OnbidCltrBidDtlSrvc2/getCltrBidInf2';
const TIMEOUT_MS = 30000;

export const NORMAL_CODE = '00';

export interface ParsedOnbid {
  resultCode: string;
  resultMsg: string;
  totalCount: number;
  items: Record<string, unknown>[];
}

/** JSON 응답 파싱: body.items.item 을 항상 배열로 정규화 */
export function parseOnbid(jsonText: string): ParsedOnbid {
  let doc: Record<string, any>;
  try {
    doc = JSON.parse(jsonText) as Record<string, any>;
  } catch {
    return { resultCode: 'PARSE_ERROR', resultMsg: 'JSON parse failed', totalCount: 0, items: [] };
  }
  const header = doc.header ?? {};
  const body = doc.body ?? {};
  const resultCode = String(header.resultCode ?? '');
  const resultMsg = String(header.resultMsg ?? '');
  let items: Record<string, unknown>[] = [];
  const rawItems = body?.items?.item;
  // items:""(공백 문자열) 또는 undefined → 빈 배열로 정규화
  if (Array.isArray(rawItems)) items = rawItems as Record<string, unknown>[];
  else if (rawItems && typeof rawItems === 'object') items = [rawItems as Record<string, unknown>];
  const totalCount = parseInt(String(body?.totalCount ?? items.length), 10) || 0;
  return { resultCode, resultMsg, totalCount, items };
}

async function fetchJson(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res.text();
}

export async function fetchOnbidList(
  serviceKey: string,
  prptDivCd: string,
  pvctTrgtYn: string,
  pageNo: number,
  numOfRows = 100,
): Promise<ParsedOnbid> {
  const qs = new URLSearchParams({
    serviceKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
    resultType: 'json',
    prptDivCd,
    pvctTrgtYn,
  });
  return parseOnbid(await fetchJson(`${LIST_URL}?${qs}`));
}

export async function fetchOnbidDetail(
  serviceKey: string,
  cltrMngNo: string,
  pbctCdtnNo: string,
): Promise<ParsedOnbid> {
  const qs = new URLSearchParams({
    serviceKey,
    pageNo: '1',
    numOfRows: '50',
    resultType: 'json',
    cltrMngNo,
    pbctCdtnNo,
  });
  return parseOnbid(await fetchJson(`${DETAIL_URL}?${qs}`));
}
