/**
 * 부동산 상세/목록 URL 생성 유틸 (frontend).
 *
 * URL 스펙:
 *   /real-estate/{realEstateType}/{citySlug}/{districtSlug}/{buildingNameNFC}
 *
 * Backend `backend/src/lib/realEstateUrl.ts` 와 **동일 시그니처/동일 동작**을 유지.
 * 규칙이 변경되면 양쪽 파일을 함께 수정하고 vitest 양쪽을 실행할 것.
 */

import { CITY_SLUGS, CITY_FULL_NAME_TO_SLUG, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'

export type RealEstateUrlType =
  | 'apt-sale'
  | 'apt-rent'
  | 'villa-sale'
  | 'villa-rent'
  | 'offitel-sale'
  | 'offitel-rent'

export const REAL_ESTATE_URL_TYPES: readonly RealEstateUrlType[] = [
  'apt-sale',
  'apt-rent',
  'villa-sale',
  'villa-rent',
  'offitel-sale',
  'offitel-rent',
] as const

export function isRealEstateUrlType(value: string): value is RealEstateUrlType {
  return (REAL_ESTATE_URL_TYPES as readonly string[]).includes(value)
}

export interface RealEstateUrlParts {
  type: RealEstateUrlType
  city: string
  district: string
  /** 건물명. NFD/NFC 어느 쪽이어도 입력 가능 — 내부에서 NFC로 정규화. */
  buildingName: string
}

export function toCitySlug(city: string): string {
  const trimmed = city.trim()
  return (
    CITY_FULL_NAME_TO_SLUG[trimmed] ??
    CITY_SLUGS[trimmed] ??
    trimmed.toLowerCase()
  )
}

export function toDistrictSlug(district: string): string {
  const trimmed = district.trim()
  return DISTRICT_SLUG_MAP[trimmed] ?? trimmed.toLowerCase().replace(/\s+/g, '-')
}

export function toRealEstateUrl(parts: RealEstateUrlParts): string {
  const citySlug = toCitySlug(parts.city)
  const districtSlug = toDistrictSlug(parts.district)
  const nfcName = parts.buildingName.normalize('NFC')
  return `/real-estate/${parts.type}/${citySlug}/${districtSlug}/${encodeURIComponent(nfcName)}`
}

export function toRealEstateListUrl(parts: Omit<RealEstateUrlParts, 'buildingName'>): string {
  const citySlug = toCitySlug(parts.city)
  const districtSlug = toDistrictSlug(parts.district)
  return `/real-estate/${parts.type}/${citySlug}/${districtSlug}`
}

export function toAbsoluteRealEstateUrl(origin: string, parts: RealEstateUrlParts): string {
  return `${origin}${toRealEstateUrl(parts)}`
}
