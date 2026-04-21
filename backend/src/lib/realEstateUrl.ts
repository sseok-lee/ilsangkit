/**
 * 부동산 상세/목록 URL 생성 유틸 (backend).
 *
 * URL 스펙:
 *   /real-estate/{realEstateType}/{citySlug}/{districtSlug}/{buildingNameNFC}
 *
 * - realEstateType: 'apt-sale' | 'apt-rent' | 'villa-sale' | 'villa-rent' | 'offitel-sale' | 'offitel-rent'
 * - buildingName은 `.normalize('NFC')` 후 `encodeURIComponent` — NFD/NFC 혼재로 인한 중복 색인 방지.
 *
 * Frontend `frontend/utils/realEstateUrl.ts`와 **동일 시그니처/동일 동작**을 유지해야 AC16(NFC 7-path) 통과.
 */

import { toCitySlug, toDistrictSlug } from './regionSlugs.js';

export type RealEstateUrlType =
  | 'apt-sale'
  | 'apt-rent'
  | 'villa-sale'
  | 'villa-rent'
  | 'offitel-sale'
  | 'offitel-rent';

export const REAL_ESTATE_URL_TYPES: readonly RealEstateUrlType[] = [
  'apt-sale',
  'apt-rent',
  'villa-sale',
  'villa-rent',
  'offitel-sale',
  'offitel-rent',
] as const;

export function isRealEstateUrlType(value: string): value is RealEstateUrlType {
  return (REAL_ESTATE_URL_TYPES as readonly string[]).includes(value);
}

export interface RealEstateUrlParts {
  type: RealEstateUrlType;
  city: string;
  district: string;
  /** 건물명. NFD/NFC 어느 쪽이어도 입력 가능 — 내부에서 NFC로 정규화. */
  buildingName: string;
}

/**
 * 상세 페이지 절대 경로를 생성한다 (도메인 포함 X).
 * 예: `{ type: 'apt-sale', city: '서울특별시', district: '강남구', buildingName: '래미안강남' }`
 *    → `/real-estate/apt-sale/seoul/gangnam/%EB%9E%98%EB%AF%B8%EC%95%88%EA%B0%95%EB%82%A8`
 */
export function toRealEstateUrl(parts: RealEstateUrlParts): string {
  const citySlug = toCitySlug(parts.city);
  const districtSlug = toDistrictSlug(parts.district);
  const nfcName = parts.buildingName.normalize('NFC');
  return `/real-estate/${parts.type}/${citySlug}/${districtSlug}/${encodeURIComponent(nfcName)}`;
}

/**
 * 목록(허브) 경로 생성 — buildingName 없음.
 * 예: `/real-estate/apt-sale/seoul/gangnam`
 */
export function toRealEstateListUrl(parts: Omit<RealEstateUrlParts, 'buildingName'>): string {
  const citySlug = toCitySlug(parts.city);
  const districtSlug = toDistrictSlug(parts.district);
  return `/real-estate/${parts.type}/${citySlug}/${districtSlug}`;
}

/**
 * 절대 URL 생성 (호스트 붙임). IndexNow/sitemap/OG 같은 외부 노출 위치에 사용.
 */
export function toAbsoluteRealEstateUrl(origin: string, parts: RealEstateUrlParts): string {
  return `${origin}${toRealEstateUrl(parts)}`;
}
