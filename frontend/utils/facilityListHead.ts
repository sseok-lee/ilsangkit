/**
 * 시설 목록 페이지의 robots/canonical head — 순수 함수.
 *
 * ## 왜 함수로 빼는가
 *
 * 이 판정은 원래 `pages/[category]/index.vue` 안의 `useHead(computed(...))` 에 인라인으로
 * 들어 있었다. 그래서 계약을 검증한다는 테스트가 정작 페이지를 실행하지 못하고,
 * 테스트 파일 안에 같은 분기를 **다시 구현해서**(`function buildHead(...)`) 그 사본을
 * 검사했다. 사본은 언제나 통과한다 — 페이지를 "항상 noindex" 로 바꿔도 119개가 전부
 * 초록이었다(실측 2026-09-04). 이 저장소는 테스트가 프로덕션에 없는 성질을 단언해서
 * 결함을 오래 놓친 전력이 있고, 이게 정확히 그 형태였다.
 *
 * 판정을 여기 한곳에 두면 테스트가 사본이 아니라 실물을 부른다.
 * (utils/auctionHead.ts · utils/indexability.ts · utils/realEstateListSsrOutcome.ts 와 같은 방식.)
 *
 * ## 계약
 *
 * noindex 를 내는 응답에는 canonical 을 함께 내지 않는다
 * (.omc/notes/noindex-canonical-policy.md). 둘을 같이 내보내면 "색인하지 마라" 와
 * "이걸 정본으로 삼아라" 가 동시에 나가 신호가 서로 충돌한다.
 */
import { shouldNoindexFacilityList } from './facilityListRobots'
import { PAGINATION_ROBOTS_CONTENT } from './pageQuery'
import { DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'

const DISTRICT_SLUGS = new Set(Object.values(DISTRICT_SLUG_MAP))

export interface FacilityListCanonicalInput {
  /** 카테고리 slug (toilet, trash, …). */
  category: string
  /** `?city=` 값. 이미 slug 다(RegionChips 가 slug 로 붙인다). */
  citySlug?: string
  /** `?district=` 원본 값. 내부 링크가 만들지 않는 파라미터라 한글 구·군명이 올 수 있다. */
  district?: string
}

/**
 * 목록 페이지의 canonical 경로. 쿼리 문자열은 절대 만들지 않는다.
 *
 * `?city=` 만 있으면 2-세그먼트 `/{city}/{category}` 라우트가 없으므로 전국 목록으로,
 * city+district 가 모두 있으면 실재하는 `/{city}/{district}/{category}` 로 통합한다.
 *
 * ⚠️ district 는 slug 로 정규화한 뒤 **아는 값일 때만** 쓴다. 예전엔 쿼리 값을 그대로
 * 경로에 넣어 `/seoul/강남구/toilet` 같은 canonical 을 냈는데 정본은 slug 경로라
 * 그 URL 은 301 이다 — canonical 이 리다이렉트를 가리키면 신호가 한 번 더 튕긴다.
 */
export function buildFacilityListCanonicalPath(input: FacilityListCanonicalInput): string {
  const { category, citySlug, district } = input
  if (citySlug && district) {
    const districtSlug = DISTRICT_SLUG_MAP[district] ?? district
    if (DISTRICT_SLUGS.has(districtSlug)) {
      return `/${citySlug}/${districtSlug}/${category}`
    }
  }
  return `/${category}`
}

export interface FacilityListHeadInput {
  /** 현재 페이지 번호(1-base). 2 이상이면 noindex. */
  page: number
  /** 키워드 검색어. 있으면 noindex. */
  keyword?: string
  /** 색인 대상일 때 쓸 canonical 절대 URL. */
  canonicalHref: string
}

export interface FacilityListHead {
  meta?: Array<Record<string, string>>
  link?: Array<Record<string, string>>
}

/**
 * noindex 면 robots 만, 색인 대상이면 canonical 만 — 둘이 함께 나가는 조합은 없다.
 */
export function buildFacilityListHead(input: FacilityListHeadInput): FacilityListHead {
  if (shouldNoindexFacilityList({ page: input.page, keyword: input.keyword })) {
    return { meta: [{ name: 'robots', content: PAGINATION_ROBOTS_CONTENT }] }
  }
  return { link: [{ rel: 'canonical', href: input.canonicalHref, key: 'canonical' }] }
}
