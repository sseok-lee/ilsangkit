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
