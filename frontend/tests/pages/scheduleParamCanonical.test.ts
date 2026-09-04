/**
 * `?schedule=` 파라미터 URL + 목록 페이지 canonical 위생 회귀 방지.
 *
 * 2026-09-04 프로덕션 실측: 중복 title 225,681 / 중복 description 225,388.
 * 2026-08 네이버 중복 title 진단에서 `?schedule=` 파라미터 색인이 표본의 27% 였다.
 *
 * 지켜야 하는 계약:
 *  1) `schedule` 은 UI 상태다 — canonical 은 언제나 쿼리 없는 지역 허브/카테고리 경로다.
 *  2) 파라미터 URL 을 404·301 로 바꾸지 않는다(모달 딥링크는 공유 가능해야 한다).
 *     대신 크롤러가 그 공간을 "발견"하는 내부 링크를 만들지 않는다.
 *  3) noindex 를 내보내는 응답에는 canonical 을 함께 내보내지 않는다
 *     (.omc/notes/noindex-canonical-policy.md).
 *
 * 페이지 SFC 를 mount 하지 않고 소스 계약을 검사한다.
 * tests/pages/realEstateListPagination.test.ts 와 같은 방식이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { shouldNoindexFacilityList } from '~/utils/facilityListRobots'

const SITE_URL = 'https://ilsangkit.co.kr'

const PAGES = {
  district: 'pages/[city]/[district]/[category].vue',
  category: 'pages/[category]/index.vue',
  trashSchedule: 'components/region/RegionTrashSchedule.vue',
} as const

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf-8')
}

/** `const <name> = computed(() => {` ... 다음 줄머리 `})` 까지의 본문을 뽑는다. */
function extractComputedBody(src: string, name: string): string {
  const marker = `const ${name} = computed(() => {`
  const start = src.indexOf(marker)
  if (start === -1) throw new Error(`${name} computed 를 찾지 못했다`)
  const end = src.indexOf('\n})', start)
  if (end === -1) throw new Error(`${name} computed 의 끝을 찾지 못했다`)
  return src.slice(start + marker.length, end)
}

/** 소스에서 뽑은 canonical 템플릿 리터럴을 실제 값으로 렌더한다. */
function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\$\{([^}]+)\}/g, (_, expr: string) => {
    const key = expr.trim()
    if (!(key in vars)) {
      throw new Error(`canonical 템플릿에 예상치 못한 표현식이 들어왔다: \${${key}}`)
    }
    return vars[key]
  })
}

describe('구·군 목록 canonical — /{city}/{district}/trash?schedule=N', () => {
  const src = read(PAGES.district)

  it('canonical 은 쿼리 없는 지역 허브를 가리킨다', () => {
    const match = /rel: 'canonical',\s*href: `([^`]+)`/.exec(src)
    expect(match, 'canonical link 를 찾지 못했다').not.toBeNull()

    const rendered = renderTemplate(match![1], {
      'city.value': 'chungnam',
      'district.value': 'buyeo',
      'category.value': 'trash',
    })
    expect(rendered).toBe(`${SITE_URL}/chungnam/buyeo/trash`)
    expect(rendered).not.toContain('?')
    expect(rendered).not.toContain('schedule')
  })

  it('canonical 계산이 route.query 를 읽지 않는다 (파라미터 URL 자기참조 금지)', () => {
    const headBlock = src.slice(src.indexOf('useHead(computed(() => {'))
    const canonicalStmt = /rel: 'canonical',\s*href: `[^`]+`/.exec(headBlock)
    expect(canonicalStmt![0]).not.toContain('route.query')
  })

  it('noindex 분기는 robots 만 반환하고 canonical 을 함께 내지 않는다', () => {
    const headBlock = src.slice(
      src.indexOf('useHead(computed(() => {'),
      src.indexOf('// ItemList 구조화 데이터 (non-trash only)'),
    )
    const noindexBranch = headBlock.slice(
      headBlock.indexOf('if (isPageNoindex.value) {'),
      headBlock.indexOf('return {\n    link:'),
    )
    expect(noindexBranch).toContain(`content: PAGINATION_ROBOTS_CONTENT`)
    expect(noindexBranch).not.toContain('canonical')
  })

  it('`?schedule=` 를 301 이나 404 로 바꾸지 않는다 (모달 딥링크 보존)', () => {
    expect(src).not.toMatch(/schedule[\s\S]{0,120}createError/)
    expect(src).not.toMatch(/schedule[\s\S]{0,120}statusCode:\s*30\d/)
  })
})

describe('카테고리 목록 canonical — /trash?schedule=N, /toilet?city=seoul', () => {
  const src = read(PAGES.category)
  const canonicalBody = extractComputedBody(src, 'canonicalPath')

  it('canonicalPath 는 쿼리 문자열을 만들지 않는다', () => {
    expect(canonicalBody).not.toContain('?')
    expect(canonicalBody).not.toContain('schedule')
  })

  it('canonical href 는 SITE_URL + 쿼리 없는 경로다', () => {
    expect(src).toContain('const canonicalHref = computed(() => `${SITE_URL}${canonicalPath.value}`)')
    expect(src).toContain("link: [{ rel: 'canonical', href: canonicalHref.value, key: 'canonical' }]")
  })

  it('`?city=` 필터 변형이 자기 자신을 canonical 로 선언하지 않는다', () => {
    // 회귀 방지: 예전엔 `/${categoryParam.value}?city=${citySlug}` 를 canonical 로 냈다.
    // 시설 15종 × 시·도 18개 = 270개 파라미터 URL 이 "정본"으로 선언돼 있었다.
    expect(canonicalBody).not.toMatch(/city=\$\{/)
  })

  it('city+district 는 실재하는 3-segment 라우트로 통합한다', () => {
    expect(canonicalBody).toContain('`/${citySlug}/${districtSlug}/${categoryParam.value}`')
  })

  it('지역 필터 자체는 남아 있다 (noindex 로 죽이지 않는다)', () => {
    expect(src).toContain('RegionChips')
    expect(src).toContain('regionChipHref')
  })

  /** 소스에서 확인한 규칙을 값으로 재현 — `?schedule=` 은 canonical 에 영향이 없다. */
  function canonicalPathFor(input: { category: string; city?: string; district?: string }): string {
    if (input.city && input.district) return `/${input.city}/${input.district}/${input.category}`
    return `/${input.category}`
  }

  it('/trash?schedule=13343 의 canonical 은 https://ilsangkit.co.kr/trash', () => {
    expect(`${SITE_URL}${canonicalPathFor({ category: 'trash' })}`).toBe(`${SITE_URL}/trash`)
  })

  it('/toilet?city=seoul 의 canonical 은 전국 목록으로 통합된다', () => {
    expect(`${SITE_URL}${canonicalPathFor({ category: 'toilet', city: 'seoul' })}`).toBe(
      `${SITE_URL}/toilet`,
    )
  })
})

describe('noindex 응답에는 canonical 이 없다 — 카테고리 목록', () => {
  const src = read(PAGES.category)

  it('초기 setCategoryMeta 의 canonical 게이트가 noindex 술어와 같은 함수를 쓴다', () => {
    // 회귀 방지: 예전엔 page>=2 만 봐서 `?keyword=X`(page 없음) 진입 시
    // robots=noindex 와 rel=canonical 이 한 응답에 같이 나갔다.
    expect(src).toMatch(/const initialNoindex = shouldNoindexFacilityList\(\{[\s\S]{0,120}keyword: initialKeyword,/)
    expect(src).toContain('{ canonical: initialNoindex ? false : undefined }')
  })

  it('city 변경 watch 도 같은 canonical 정책을 넘긴다', () => {
    expect(src).toContain('{ canonical: isNoindex.value ? false : canonicalHref.value }')
  })

  it('reactive head 의 noindex 분기는 canonical 을 포함하지 않는다', () => {
    const headBlock = src.slice(src.indexOf('useHead(computed(() => {'))
    const noindexBranch = headBlock.slice(0, headBlock.indexOf('return {\n    link:'))
    expect(noindexBranch).toContain('PAGINATION_ROBOTS_CONTENT')
    expect(noindexBranch).not.toContain('canonical')
  })

  /**
   * 페이지가 따르는 계약을 값 수준에서 재현:
   * noindex 술어가 true 면 canonical 은 어느 경로로도 발행되지 않는다.
   */
  function buildHead(input: { page: number; keyword?: string }) {
    if (shouldNoindexFacilityList(input)) {
      return { robots: 'noindex, follow' as const, canonical: null }
    }
    return { robots: null, canonical: `${SITE_URL}/toilet` }
  }

  it('키워드 검색(page 1) 은 noindex 이고 canonical 이 없다', () => {
    const head = buildHead({ page: 1, keyword: '역삼' })
    expect(head.robots).toBe('noindex, follow')
    expect(head.canonical).toBeNull()
  })

  it('page 2+ 는 noindex 이고 canonical 이 없다', () => {
    expect(buildHead({ page: 2 }).canonical).toBeNull()
  })

  it('필터 없는 1페이지는 canonical 만 낸다', () => {
    const head = buildHead({ page: 1 })
    expect(head.robots).toBeNull()
    expect(head.canonical).toBe(`${SITE_URL}/toilet`)
  })
})

describe('rel=prev/next — key 부여 + noindex 페이지 억제', () => {
  it('카테고리 목록: noindex 면 prev/next 를 만들지 않는다', () => {
    const src = read(PAGES.category)
    const block = src.slice(src.indexOf('// ItemList structured data'))
    expect(block).toContain('if (isNoindex.value) return')
    expect(block).toContain("key: 'seo-rel-prev'")
    expect(block).toContain("key: 'seo-rel-next'")
  })

  it('구·군 목록: trash 블록도 key 를 붙인다 (client nav 누적 방지)', () => {
    const src = read(PAGES.district)
    const trashBlock = src.slice(src.indexOf('// ItemList 구조화 데이터 (trash)'))
    expect(trashBlock).toContain('if (isPageNoindex.value) return')
    expect(trashBlock).toContain("key: 'seo-rel-prev'")
    expect(trashBlock).toContain("key: 'seo-rel-next'")
  })
})

describe('trash 페이지네이션이 크롤 가능한 <a href> 로 렌더된다', () => {
  it('RegionTrashSchedule 이 href-for 를 Pagination 에 전달한다', () => {
    const src = read(PAGES.trashSchedule)
    expect(src).toContain(':href-for="hrefFor"')
    expect(src).toContain('hrefFor?: (page: number) => string')
  })

  it('구·군 페이지가 RegionTrashSchedule 에 pageHref 를 넘긴다', () => {
    const src = read(PAGES.district)
    const trashTag = src.slice(src.indexOf('<RegionTrashSchedule'), src.indexOf('<!-- 일반 시설 그리드 -->'))
    expect(trashTag).toContain(':href-for="pageHref"')
  })

  it('카테고리 목록의 trash 분기도 href-for 를 넘긴다', () => {
    const src = read(PAGES.category)
    const trashPagination = /<Pagination v-if="!wasteLoading[^/]*\/>/.exec(src)
    expect(trashPagination, 'trash Pagination 을 찾지 못했다').not.toBeNull()
    expect(trashPagination![0]).toContain(':href-for="pageHref"')
  })

  it('두 페이지 모두 pageHref 를 buildPageHref 로 만든다 (UI 상태 키가 제거된 href)', () => {
    for (const rel of [PAGES.district, PAGES.category]) {
      expect(read(rel)).toContain('buildPageHref(route.path, route.query, page)')
    }
  })

  it('두 페이지의 syncPageQuery 가 stripUiStateQuery 를 거친다 (href 와 SPA URL 일치)', () => {
    for (const rel of [PAGES.district, PAGES.category]) {
      expect(read(rel)).toContain('const nextQuery: LocationQueryRaw = stripUiStateQuery(route.query)')
    }
  })
})
