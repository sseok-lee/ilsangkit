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
import { buildFacilityListHead, buildFacilityListCanonicalPath } from '~/utils/facilityListHead'

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
  // 계약은 실물 함수(buildFacilityListCanonicalPath)로 검사한다. 예전엔 이 자리에
  // 같은 규칙을 다시 구현한 `canonicalPathFor` 가 있었고, 그 사본만 검사하고 있었다.
  it('페이지는 canonical 경로 판정을 공용 빌더에 위임한다', () => {
    expect(src).toContain('buildFacilityListCanonicalPath({')
  })

  it('canonical href 는 SITE_URL + 경로다', () => {
    expect(src).toContain('const canonicalHref = computed(() => `${SITE_URL}${canonicalPath.value}`)')
  })

  it('canonical 경로는 어떤 입력에서도 쿼리 문자열을 만들지 않는다', () => {
    const inputs = [
      { category: 'trash' },
      { category: 'trash', citySlug: 'seoul' },
      { category: 'toilet', citySlug: 'seoul', district: 'gangnam' },
      { category: 'toilet', citySlug: 'seoul', district: '강남구' },
      { category: 'toilet', citySlug: 'seoul', district: '없는구' },
    ]
    for (const input of inputs) {
      const path = buildFacilityListCanonicalPath(input)
      expect(path, JSON.stringify(input)).not.toContain('?')
      expect(path).not.toContain('schedule')
    }
  })

  it('`?city=` 필터 변형이 자기 자신을 canonical 로 선언하지 않는다', () => {
    // 회귀 방지: 예전엔 `/${categoryParam.value}?city=${citySlug}` 를 canonical 로 냈다.
    // 시설 15종 × 시·도 18개 = 270개 파라미터 URL 이 "정본"으로 선언돼 있었다.
    expect(buildFacilityListCanonicalPath({ category: 'toilet', citySlug: 'seoul' })).toBe('/toilet')
  })

  it('city+district 는 실재하는 3-segment 라우트로 통합한다', () => {
    expect(buildFacilityListCanonicalPath({ category: 'toilet', citySlug: 'seoul', district: 'gangnam' }))
      .toBe('/seoul/gangnam/toilet')
  })

  it('한글 구·군명은 slug 로 정규화한다 — canonical 이 301 을 가리키지 않게', () => {
    expect(buildFacilityListCanonicalPath({ category: 'toilet', citySlug: 'seoul', district: '강남구' }))
      .toBe('/seoul/gangnam/toilet')
  })

  it('해석되지 않는 구·군은 전국 목록으로 통합한다 (404 를 canonical 로 내지 않는다)', () => {
    expect(buildFacilityListCanonicalPath({ category: 'toilet', citySlug: 'seoul', district: '없는구' }))
      .toBe('/toilet')
  })

  it('지역 필터 자체는 남아 있다 (noindex 로 죽이지 않는다)', () => {
    expect(src).toContain('RegionChips')
    expect(src).toContain('regionChipHref')
  })

  it('/trash?schedule=13343 의 canonical 은 https://ilsangkit.co.kr/trash', () => {
    expect(`${SITE_URL}${buildFacilityListCanonicalPath({ category: 'trash' })}`).toBe(`${SITE_URL}/trash`)
  })

  it('/toilet?city=seoul 의 canonical 은 전국 목록으로 통합된다', () => {
    expect(`${SITE_URL}${buildFacilityListCanonicalPath({ category: 'toilet', citySlug: 'seoul' })}`)
      .toBe(`${SITE_URL}/toilet`)
  })
})

describe('noindex 응답에는 canonical 이 없다 — 카테고리 목록', () => {
  const src = read(PAGES.category)

  // 종전 이 자리의 두 테스트는 "setup 시점 값으로 canonical 게이트를 건다"는 구조를
  // 고정하고 있었다. 그 구조 자체가 결함이었다 — setup 값은 첫 렌더에 얼어붙고, setMeta 는
  // canonical 이 있을 때만 useHead 를 부르므로 나중에 canonical:false 로 불러도 앞서 등록된
  // 항목이 거둬지지 않는다. `/toilet` → 클라이언트 `?page=2` 에서 noindex + canonical 이
  // 함께 나갔다. 이제는 "소유자가 하나"라는 더 강한 성질을 고정한다.
  it('canonical 소유자는 reactive useHead 하나뿐이다 — setMeta 는 canonical 을 등록하지 않는다', () => {
    const setMetaCalls = src.match(/setCategoryMeta\([\s\S]*?\}, \{ canonical: [^}]*\}\)/g) ?? []

    expect(setMetaCalls.length).toBeGreaterThan(0)
    for (const call of setMetaCalls) {
      // canonical: false 이외의 값을 넘기면 소유자가 둘이 된다.
      expect(call).toContain('canonical: false')
    }
  })

  it('setup 시점에 얼어붙는 canonical 게이트로 돌아가지 않는다 (회귀 핵심)', () => {
    expect(src).not.toContain('canonical: initialNoindex ? false : undefined')
    expect(src).not.toContain('canonical: isNoindex.value ? false : canonicalHref.value')
  })

  // ⚠️ 아래 값 수준 테스트가 실물을 부르려면 페이지가 판정을 인라인으로 되돌리면 안 된다.
  // 예전엔 이 계약이 페이지 안에 인라인으로 있었고, 테스트는 같은 분기를 파일 안에 다시
  // 구현해서(`function buildHead`) 그 사본을 검사했다 — 페이지를 "항상 noindex" 로 바꿔도
  // 119개가 전부 통과했다(실측 2026-09-04).
  it('목록 head 판정은 공용 빌더에 위임한다 — 페이지에 인라인 분기를 되살리지 않는다', () => {
    expect(src).toContain('useHead(computed(() => buildFacilityListHead({')
    // 위임했다는 증거는 "빌더를 부른다"가 아니라 "페이지가 robots 를 직접 쓰지 않는다"다.
    // 문자열 포함만 보면 빌더 호출을 남겨둔 채 그 옆에 인라인 분기를 되살려도 통과한다.
    expect(src).not.toMatch(/name:\s*['"]robots['"]/)
    expect(src).not.toContain('PAGINATION_ROBOTS_CONTENT')
    // canonical link 도 빌더만 만든다.
    expect(src).not.toMatch(/rel:\s*['"]canonical['"]/)
  })

  /**
   * 계약을 값 수준에서 확인 — 재구현이 아니라 페이지가 실제로 쓰는 함수를 부른다.
   * noindex 술어가 true 면 canonical 은 어느 경로로도 발행되지 않는다.
   */
  it('키워드 검색(page 1) 은 noindex 이고 canonical 이 없다', () => {
    const head = buildFacilityListHead({ page: 1, keyword: '역삼', canonicalHref: `${SITE_URL}/toilet` })
    expect(head.meta?.[0]).toMatchObject({ name: 'robots', content: expect.stringContaining('noindex') })
    expect(head.link).toBeUndefined()
  })

  it('page 2+ 는 noindex 이고 canonical 이 없다', () => {
    const head = buildFacilityListHead({ page: 2, canonicalHref: `${SITE_URL}/toilet` })
    expect(head.meta?.[0]?.content).toContain('noindex')
    expect(head.link).toBeUndefined()
  })

  it('필터 없는 1페이지는 canonical 만 낸다', () => {
    const head = buildFacilityListHead({ page: 1, canonicalHref: `${SITE_URL}/toilet` })
    expect(head.meta).toBeUndefined()
    expect(head.link?.[0]).toMatchObject({ rel: 'canonical', href: `${SITE_URL}/toilet` })
  })

  // noindex 와 canonical 이 함께 나가는 조합은 어떤 입력에서도 없어야 한다
  // (.omc/notes/noindex-canonical-policy.md). 위 3개는 대표 입력만 보므로 전수로 한 번 더 건다.
  it('어떤 입력에서도 robots=noindex 와 canonical 이 동시에 나가지 않는다', () => {
    for (const page of [1, 2, 3, 10]) {
      for (const keyword of [undefined, '', '  ', '역삼']) {
        const head = buildFacilityListHead({ page, keyword, canonicalHref: `${SITE_URL}/toilet` })
        const hasNoindex = !!head.meta?.some((m) => m.content?.includes('noindex'))
        const hasCanonical = !!head.link?.some((l) => l.rel === 'canonical')
        expect(hasNoindex && hasCanonical, `page=${page} keyword=${JSON.stringify(keyword)}`).toBe(false)
        // 둘 중 하나는 반드시 나가야 한다 — 아무것도 안 내면 정본 신호가 사라진다.
        expect(hasNoindex || hasCanonical).toBe(true)
      }
    }
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
