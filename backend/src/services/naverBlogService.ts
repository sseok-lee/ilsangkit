import type { FacilityCategory } from './categoryRegistry.js';

export interface FacilityQueryInput {
  name: string;
  city: string;
  district: string;
}

export interface RealEstateQueryInput {
  buildingName: string;
  city: string;
  district: string;
}

const CITY_SHORT: Record<string, string> = {
  '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
  '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산',
  '세종특별자치시': '세종', '제주특별자치도': '제주',
};

function cityShort(city: string): string {
  return CITY_SHORT[city] ?? city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '');
}

function regionToken(d: string, c: string): string {
  return d?.trim() || cityShort(c);
}

export function buildNaverBlogQuery(input: FacilityQueryInput, category: FacilityCategory): string {
  const region = regionToken(input.district, input.city);
  const name = input.name.trim();
  switch (category) {
    case 'parking':    return `${name} ${region} 주차장`;
    case 'toilet':     return `${name} 공중화장실 ${region}`;
    case 'park':       return `${name} ${cityShort(input.city)}`;
    case 'pharmacy':   return `${name} ${region} 약국`;
    case 'ev-charger': return `${name} 전기차 충전소`;
    case 'childcare':  return `${name} ${region} 어린이집`;
    case 'aed':        return `${name} AED ${region}`;
    case 'library':
    case 'hospital':
    case 'school':
    case 'market':
    case 'sports':
    case 'wifi':
    case 'clothes':
    case 'subway':     return `${name} ${region}`;
  }
}

export type RealEstateType =
  | 'apt-sale' | 'apt-rent'
  | 'villa-sale' | 'villa-rent'
  | 'offitel-sale' | 'offitel-rent';

const REAL_ESTATE_TYPE_LABEL: Record<RealEstateType, string> = {
  'apt-sale':     '아파트 매매',
  'apt-rent':     '아파트 전세',
  'villa-sale':   '빌라 매매',
  'villa-rent':   '빌라 전세',
  'offitel-sale': '오피스텔 매매',
  'offitel-rent': '오피스텔 전세',
};

export function buildNaverBlogQueryForRealEstate(
  input: RealEstateQueryInput,
  type: RealEstateType,
): string {
  const region = regionToken(input.district, input.city);
  return `${input.buildingName.trim()} ${region} ${REAL_ESTATE_TYPE_LABEL[type]}`;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ',
};

export function stripHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]+>/g, '')
    .replace(/&[#a-zA-Z0-9]+;/g, (m) => HTML_ENTITY_MAP[m] ?? m);
}

export interface RawNaverBlogPost {
  url: string;
  title: string;
  description: string;
  bloggerName: string;
  bloggerLink: string;
  postDate: string;
}

export const NAVER_BLOG_MIN_RESULTS = 3;
const MAX_POSTS = 5;
const MIN_DESCRIPTION_LENGTH = 30;
const MAX_AGE_YEARS = 3;

const AD_KEYWORDS = [
  '체험단', '협찬', '광고', '#광고', '#협찬', '[광고]', '[Ad]', '[AD]',
  '원고료', '무료초대', '소정의 대가', '제공받아',
];

const DEFAULT_BLOCKED_BLOGGER_LINKS: string[] = [];

interface FilterOptions {
  now?: Date;
  adKeywords?: string[];
  blockedBloggerLinks?: string[];
}

function parsePostDate(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function filterNaverBlogPosts(
  posts: RawNaverBlogPost[],
  opts: FilterOptions = {},
): RawNaverBlogPost[] {
  const now = opts.now ?? new Date();
  const ads = opts.adKeywords ?? AD_KEYWORDS;
  const blocked = opts.blockedBloggerLinks ?? DEFAULT_BLOCKED_BLOGGER_LINKS;
  const cutoff = new Date(now.getTime());
  cutoff.setFullYear(cutoff.getFullYear() - MAX_AGE_YEARS);

  return posts
    .filter((p) => p.description.length >= MIN_DESCRIPTION_LENGTH)
    .filter((p) => !ads.some((kw) => p.title.includes(kw) || p.description.includes(kw)))
    .filter((p) => !blocked.includes(p.bloggerLink))
    .filter((p) => {
      const d = parsePostDate(p.postDate);
      return d ? d >= cutoff : true;
    })
    .slice(0, MAX_POSTS);
}

interface NaverApiItem {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  bloggerlink: string;
  postdate: string;
}

interface NaverApiResponse {
  items?: NaverApiItem[];
}

const NAVER_BLOG_SEARCH_URL = 'https://openapi.naver.com/v1/search/blog.json';

export async function fetchFromNaver(
  query: string,
  clientId: string,
  clientSecret: string,
): Promise<RawNaverBlogPost[]> {
  if (!clientId || !clientSecret) return [];

  const params = new URLSearchParams({
    query, display: '15', start: '1', sort: 'sim',
  });

  try {
    const res = await fetch(`${NAVER_BLOG_SEARCH_URL}?${params.toString()}`, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as NaverApiResponse;
    return (json.items ?? []).map<RawNaverBlogPost>((it) => ({
      url: it.link,
      title: stripHtml(it.title),
      description: stripHtml(it.description),
      bloggerName: it.bloggername,
      bloggerLink: it.bloggerlink,
      postDate: it.postdate,
    }));
  } catch {
    return [];
  }
}
