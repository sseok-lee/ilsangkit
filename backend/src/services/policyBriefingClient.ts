// data.go.kr 정책브리핑 정책뉴스 API(15095335) 클라이언트.
// 정책 원문 전문(DataContents)을 근거로 오늘의 이슈 정책 트랙 글을 생성하기 위한 소스.
// 엔드포인트: http://apis.data.go.kr/1371000/policyNewsService/policyNewsList
// 라이선스: 공공누리 제1유형(출처표시). 인증: OPENAPI_SERVICE_KEY(data.go.kr).

import 'dotenv/config';

const POLICY_NEWS_ENDPOINT =
  'http://apis.data.go.kr/1371000/policyNewsService/policyNewsList';

export interface PolicyNewsItem {
  newsItemId: string;
  title: string;
  subTitle: string;
  ministerCode: string;
  dataContents: string; // HTML 제거된 본문 전문
  approveDate: string;
  originalUrl: string;
  thumbnailUrl: string;
}

export interface FetchPolicyOptions {
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
  numOfRows?: number;
  pageNo?: number;
}

export function toYyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// 응답 최상위 배열 위치가 문서/실측 간 다를 수 있어 알려진 형태를 관대하게 탐색.
function pickItemsArray(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== 'object') return [];
  const r = raw as Record<string, any>;
  if (Array.isArray(r.NewsItem)) return r.NewsItem;
  if (r.NewsItem) return [r.NewsItem];
  const body = r.response?.body ?? r.body;
  const items = body?.items;
  if (Array.isArray(items)) return items;
  if (items?.item) return Array.isArray(items.item) ? items.item : [items.item];
  if (Array.isArray(r.items)) return r.items;
  return [];
}

function mapRawItem(r: Record<string, unknown>): PolicyNewsItem {
  const g = (...keys: string[]): string => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null) return String(v).trim();
    }
    return '';
  };
  return {
    newsItemId: g('NewsItemId', 'newsItemId'),
    title: stripHtml(g('Title', 'title')),
    subTitle: stripHtml(g('SubTitle1', 'subTitle1', 'SubTitle')),
    ministerCode: g('MinisterCode', 'ministerCode'),
    dataContents: stripHtml(g('DataContents', 'dataContents')),
    approveDate: g('ApproveDate', 'approveDate'),
    originalUrl: g('OriginalUrl', 'originalUrl'),
    thumbnailUrl: g('ThumbnailUrl', 'thumbnailUrl'),
  };
}

export function parsePolicyResponse(raw: unknown): PolicyNewsItem[] {
  return pickItemsArray(raw)
    .map(mapRawItem)
    .filter((it) => it.newsItemId && it.title && it.dataContents);
}

export async function fetchRecentPolicyNews(
  opts: FetchPolicyOptions
): Promise<PolicyNewsItem[]> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    console.warn('OPENAPI_SERVICE_KEY 누락 — 정책 리서치 스킵');
    return [];
  }

  const url = new URL(POLICY_NEWS_ENDPOINT);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('startDate', opts.startDate);
  url.searchParams.set('endDate', opts.endDate);
  url.searchParams.set('pageNo', String(opts.pageNo ?? 1));
  url.searchParams.set('numOfRows', String(opts.numOfRows ?? 50));
  url.searchParams.set('type', 'json');

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`정책뉴스 API 실패: HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as unknown;
    return parsePolicyResponse(data);
  } catch (err) {
    console.warn('정책뉴스 API 에러:', err instanceof Error ? err.message : err);
    return [];
  }
}
