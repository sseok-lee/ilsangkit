// backend/src/services/onbidBase.ts
import { XMLParser } from 'fast-xml-parser';

const LIST_URL = 'https://open.kamco.or.kr/services/OnbidRlstListSrvc/getRlstCltrList';
const DETAIL_URL = 'https://open.kamco.or.kr/services/OnbidRlstDetailSrvc/getRlstCltrDetail';
const TIMEOUT_MS = 30000;

export interface ParsedOnbid {
  resultCode: string;
  resultMsg: string;
  totalCount: number;
  items: Record<string, unknown>[];
}

export function parseOnbidXml(xml: string): ParsedOnbid {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });
  const doc = parser.parse(xml) as Record<string, any>;
  const root = doc.response ?? doc.result ?? doc;
  const header = root.header ?? root;
  const body = root.body ?? root;
  const resultCode = String(header.resultCode ?? '');
  const resultMsg = String(header.resultMsg ?? '');
  let items: Record<string, unknown>[] = [];
  const rawItems = body?.items?.item;
  if (Array.isArray(rawItems)) items = rawItems;
  else if (rawItems && typeof rawItems === 'object') items = [rawItems];
  const totalCount = parseInt(String(body?.totalCount ?? items.length), 10) || 0;
  return { resultCode, resultMsg, totalCount, items };
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res.text();
}

export async function fetchOnbidList(
  serviceKey: string, prptDivCd: string, pvctTrgtYn: string, pageNo: number, numOfRows = 100
): Promise<ParsedOnbid> {
  const qs = new URLSearchParams({ serviceKey, prptDivCd, pvctTrgtYn, pageNo: String(pageNo), numOfRows: String(numOfRows) });
  return parseOnbidXml(await fetchXml(`${LIST_URL}?${qs}`));
}

export async function fetchOnbidDetail(
  serviceKey: string, cltrMngNo: string, pbctCdtnNo: string
): Promise<ParsedOnbid> {
  const qs = new URLSearchParams({ serviceKey, cltrMngNo, pbctCdtnNo });
  return parseOnbidXml(await fetchXml(`${DETAIL_URL}?${qs}`));
}
