# 색인 품질 PR2 Implementation Plan (audit ③ 나머지)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** thin-content/noindex 정확도, canonical 보강, FAQ·ItemList 구조화 데이터, 죽은 코드 정리로 색인 품질을 높인다.

**Architecture:** 각 항목은 독립적인 소규모 변경. 공유 빌더(`useStructuredData`의 `setFAQSchema`/`setItemListSchema`, `useFacilityMeta.setMeta`)를 재사용. 단위 테스트는 해당 setter를 모킹해 호출/인자를 검증.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-02-indexing-quality-design.md` (PR2 섹션)

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). 작업 디렉터리 `frontend/`. 브랜치 `feat/indexing-quality-pr2`(컨트롤러 생성). 커밋 스테이징은 **명시 경로만** (절대 `git add -A` 금지).

**탐색 보정:** `about/terms/privacy/contact`는 이미 `setMeta({path})`로 canonical 설정됨 → ⓒ 대상에서 제외. ⓒ는 `subway/[slug].vue`만 canonical 누락.

---

## File Structure

- `pages/[city]/[district]/[category].vue` — (수정) noindex를 `summary.count` 기반으로 (T1)
- `pages/real-estate/[realEstateType]/[city]/index.vue` — (수정) 요약 인트로 섹션 (T2)
- `pages/subway/[slug].vue` — (수정) canonical link 추가 (T3)
- `pages/real-estate/index.vue`, `pages/real-estate/[realEstateType]/index.vue` — (수정) setFAQSchema (T4)
- `pages/subway/index.vue`, `pages/guide/index.vue` — (수정) setItemListSchema (T5)
- `composables/useRealEstateMeta.ts` + `tests/composables/useRealEstateMeta.test.ts` — (삭제); `components/realEstate/ComplexCard.vue` — (수정) legacy URL 미렌더 (T6)
- 테스트: 각 task에 신규/수정

---

## Task 1: [district]/[category] noindex를 SSR summary.count 기반으로 (ⓑ1)

**문제:** noindex 판정이 클라 패칭된 `facilities.value.length`(fetch 전 `[]`)에 의존 → SSR 시점 오작동 위험. `summary`(SSR 주입, `summary.value?.count`)로 판정.

**Files:**
- Modify: `frontend/pages/[city]/[district]/[category].vue` (`:355-376` useHead 블록)
- Test: `frontend/tests/pages/districtCategoryNoindex.test.ts` (신규)

- [ ] **Step 1: 실패 테스트** — `frontend/tests/pages/districtCategoryNoindex.test.ts`

이 페이지는 무겁고 의존성이 많아 전체 마운트 대신 **noindex 판정 순수 함수**를 추출해 테스트한다. 먼저 헬퍼를 만들고 페이지가 그것을 쓰도록 한다.

```ts
import { describe, it, expect } from 'vitest'
import { computeAreaNoindex } from '~/utils/areaNoindex'

describe('computeAreaNoindex', () => {
  it('비-trash: summary.count 0이면 noindex', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: 0, wasteEmpty: false, page: 1 })).toBe(true)
  })
  it('비-trash: summary.count>0이면 indexable', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: 12, wasteEmpty: false, page: 1 })).toBe(false)
  })
  it('비-trash: summary 미확보(undefined)면 indexable(보수적)', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: undefined, wasteEmpty: false, page: 1 })).toBe(false)
  })
  it('page>1이면 항상 noindex', () => {
    expect(computeAreaNoindex({ isTrash: false, summaryCount: 12, wasteEmpty: false, page: 2 })).toBe(true)
  })
  it('trash: wasteEmpty true면 noindex', () => {
    expect(computeAreaNoindex({ isTrash: true, summaryCount: undefined, wasteEmpty: true, page: 1 })).toBe(true)
  })
  it('trash: wasteEmpty false면 indexable', () => {
    expect(computeAreaNoindex({ isTrash: true, summaryCount: undefined, wasteEmpty: false, page: 1 })).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/pages/districtCategoryNoindex.test.ts`
Expected: FAIL — `~/utils/areaNoindex` 없음.

- [ ] **Step 3: 헬퍼 생성** — `frontend/utils/areaNoindex.ts`
```ts
export interface AreaNoindexInput {
  isTrash: boolean
  /** 비-trash 카테고리의 SSR summary.count. 미확보 시 undefined */
  summaryCount: number | undefined
  /** trash 카테고리에서 일정이 비었는지 */
  wasteEmpty: boolean
  page: number
}

/**
 * 지역×카테고리 페이지 noindex 판정.
 * - page>1 → noindex (페이지네이션 정책)
 * - trash → 일정 비면 noindex
 * - 그 외 → SSR summary.count === 0 이면 noindex (summary 미확보 시 보수적으로 indexable)
 */
export function computeAreaNoindex(input: AreaNoindexInput): boolean {
  if (input.page > 1) return true
  if (input.isTrash) return input.wasteEmpty
  return input.summaryCount === 0
}
```

- [ ] **Step 4: 페이지가 헬퍼를 쓰도록 수정**
`frontend/pages/[city]/[district]/[category].vue`:
(a) script에 import 추가:
```ts
import { computeAreaNoindex } from '~/utils/areaNoindex'
```
(b) 현재 useHead 블록(`:355-376`)의 `isEmpty`/`isNoindex` 계산을 교체:
```ts
useHead(computed(() => {
  const isNoindex = computeAreaNoindex({
    isTrash: isTrash.value,
    summaryCount: summary.value?.count,
    wasteEmpty: !wasteLoading.value && wasteSchedules.value.length === 0,
    page: pageQueryParam.value,
  })
  if (isNoindex) {
    return { meta: [{ name: 'robots', content: PAGINATION_ROBOTS_CONTENT }] }
  }
  return {
    link: [
      {
        rel: 'canonical',
        href: `https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}`,
        key: 'canonical',
      },
    ],
  }
}))
```
(`summary`는 같은 파일 `:163`의 useAsyncData 결과 — 이미 존재. `PAGINATION_ROBOTS_CONTENT`/`pageQueryParam`/`isTrash`/`wasteLoading`/`wasteSchedules`/`city`/`district`/`category` 모두 기존 존재.)

- [ ] **Step 5: 통과 확인**
Run: `cd frontend && npx vitest run tests/pages/districtCategoryNoindex.test.ts` → PASS(6).

- [ ] **Step 6: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/utils/areaNoindex.ts frontend/pages/\[city\]/\[district\]/\[category\].vue frontend/tests/pages/districtCategoryNoindex.test.ts
git commit -m "fix(frontend): [district]/[category] noindex를 SSR summary.count 기반으로"
```

---

## Task 2: real-estate city 허브 요약 인트로 (ⓑ2 thin-content 방어)

**문제:** `real-estate/[realEstateType]/[city]/index.vue`는 구/군 그리드만 있는 thin 허브(≈102개)가 indexable. (type, city) 맥락 인트로 텍스트를 추가해 substantive content 확보(색인 유지).

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/index.vue` (template + script)
- Test: `frontend/tests/pages/real-estate/realEstateCityHub.test.ts` (신규)

- [ ] **Step 1: 실패 테스트** — `frontend/tests/pages/real-estate/realEstateCityHub.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import CityHub from '~/pages/real-estate/[realEstateType]/[city]/index.vue'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))
vi.stubGlobal('useRoute', () => ({ params: { realEstateType: 'apt-sale', city: 'seoul' } }))
vi.stubGlobal('createError', (e: any) => { throw new Error(e.statusMessage) })
vi.stubGlobal('useHead', vi.fn())
vi.stubGlobal('useSeoMeta', vi.fn())

const stubs = {
  NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
  Breadcrumb: true,
  PageHero: { template: '<div><slot /></div>', props: ['eyebrow', 'title', 'description'] },
  SectionBlock: { template: '<section><slot name="heading" /><slot /></section>' },
}

describe('real-estate city 허브 인트로', () => {
  it('도시명+타입 맥락의 요약 인트로 문단을 렌더한다', () => {
    const wrapper = mount(CityHub, { global: { stubs } })
    const text = wrapper.text()
    expect(text).toContain('서울')        // cityName
    expect(text).toContain('아파트')       // 타입 라벨
    expect(text).toContain('국토교통부')   // 데이터 출처 문구
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateCityHub.test.ts`
Expected: FAIL — 인트로 문단 없음(국토교통부 출처 문구가 그리드 영역엔 없음).

- [ ] **Step 3: 인트로 섹션 추가**
`frontend/pages/real-estate/[realEstateType]/[city]/index.vue`:
(a) script에 인트로 텍스트 computed 추가(기존 `heroTitle`/`typeLabel`/`propertyMeta`/`cityName` 다음):
```ts
const introParagraph = `${cityName} ${typeLabel} 실거래가 정보입니다. ${propertyMeta?.description ?? ''} 아래 구/군을 선택하면 ${cityName} 내 단지별 실거래 내역과 시세 추이를 확인할 수 있습니다. 모든 데이터는 국토교통부 실거래가 공개시스템 기준이며 매월 갱신됩니다.`
```
(b) template에서 `<PageHero ... />` 다음, 구/군 `<SectionBlock>` 앞에 인트로 섹션 삽입:
```vue
      <section class="bg-white border border-line rounded-xl p-4 md:p-5">
        <p class="text-sm md:text-[15px] leading-relaxed text-slate-700">{{ introParagraph }}</p>
      </section>
```

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateCityHub.test.ts` → PASS(1).

- [ ] **Step 5: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/real-estate/\[realEstateType\]/\[city\]/index.vue frontend/tests/pages/real-estate/realEstateCityHub.test.ts
git commit -m "feat(frontend): real-estate city 허브 요약 인트로(thin-content 방어)"
```

---

## Task 3: subway/[slug] canonical 보강 (ⓒ)

**문제:** `subway/[slug].vue`는 useSeoMeta+useHead(JSON-LD)만 있고 canonical link 누락. (about/terms/privacy/contact는 이미 setMeta로 canonical 있음 → 제외.)

**Files:**
- Modify: `frontend/pages/subway/[slug].vue` (`:585` useHead 블록)
- Test: `frontend/tests/pages/subwaySlugCanonical.test.ts` (신규)

- [ ] **Step 1: 실패 테스트** — `frontend/tests/pages/subwaySlugCanonical.test.ts`

이 페이지는 무거우므로 canonical URL 생성 헬퍼를 추출해 테스트(다른 페이지에서 재사용 가능).
```ts
import { describe, it, expect } from 'vitest'
import { subwayCanonicalUrl } from '~/utils/subwayCanonical'

describe('subwayCanonicalUrl', () => {
  it('슬러그로 canonical URL을 만든다', () => {
    expect(subwayCanonicalUrl('gangnam')).toBe('https://ilsangkit.co.kr/subway/gangnam')
  })
  it('빈 슬러그는 /subway로', () => {
    expect(subwayCanonicalUrl('')).toBe('https://ilsangkit.co.kr/subway')
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/pages/subwaySlugCanonical.test.ts` → FAIL (헬퍼 없음).

- [ ] **Step 3: 헬퍼 + 페이지 수정**
(a) `frontend/utils/subwayCanonical.ts` 생성:
```ts
import { SITE_URL } from '~/utils/seoConstants'

export function subwayCanonicalUrl(slug: string): string {
  return slug ? `${SITE_URL}/subway/${slug}` : `${SITE_URL}/subway`
}
```
(b) `frontend/pages/subway/[slug].vue` — import 추가 + useHead에 canonical link 추가. 기존 `useHead({ script: [...] })`(`:585`)를 아래로 교체:
```ts
useHead({
  link: [{ rel: 'canonical', href: subwayCanonicalUrl(slug.value), key: 'canonical' }],
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify(buildSubwayJsonLd(station.value))),
    },
  ],
})
```
import(스크립트 상단, seoConstants import 부근):
```ts
import { subwayCanonicalUrl } from '~/utils/subwayCanonical'
```
(`slug`는 `:328`의 computed — 이미 존재. `SITE_URL`은 헬퍼 내부에서만 쓰므로 페이지 중복 import 불필요.)

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/pages/subwaySlugCanonical.test.ts` → PASS(2).

- [ ] **Step 5: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/utils/subwayCanonical.ts frontend/pages/subway/\[slug\].vue frontend/tests/pages/subwaySlugCanonical.test.ts
git commit -m "fix(frontend): subway/[slug] canonical 보강"
```

---

## Task 4: real-estate FAQ 구조화 데이터 (ⓓ FAQ)

**문제:** `real-estate/index.vue`·`[realEstateType]/index.vue`가 가시 FAQ를 렌더하지만 `setFAQSchema` 미연결. `setFAQSchema`는 `{question, answer}[]`를 받음.

**Files:**
- Modify: `frontend/pages/real-estate/index.vue` (`:136` 구조화 데이터 블록), `frontend/pages/real-estate/[realEstateType]/index.vue` (`:382` 블록)
- Test: `frontend/tests/pages/real-estate/realEstateFaqSchema.test.ts` (신규)

- [ ] **Step 1: 실패 테스트** — `frontend/tests/pages/real-estate/realEstateFaqSchema.test.ts`
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import RealEstateHub from '~/pages/real-estate/index.vue'

const setFAQSchema = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(), setItemListSchema: vi.fn(),
    setDatasetSchema: vi.fn(), setFAQSchema,
  }),
}))
vi.stubGlobal('useHead', vi.fn())
vi.stubGlobal('useSeoMeta', vi.fn())

const stubs = { NuxtLink: { template: '<a><slot /></a>', props: ['to'] }, Breadcrumb: true, PageHero: true, SectionBlock: { template: '<section><slot /></section>' } }

async function mountSuspended(c: any) {
  const w = mount(defineComponent({ render() { return h(Suspense, null, { default: () => h(c) }) } }), { global: { stubs } })
  await flushPromises()
  return w
}

beforeEach(() => vi.clearAllMocks())

describe('real-estate 허브 FAQ 스키마', () => {
  it('가시 FAQ를 setFAQSchema로 연결한다(question/answer 형태)', async () => {
    await mountSuspended(RealEstateHub)
    expect(setFAQSchema).toHaveBeenCalled()
    const arg = setFAQSchema.mock.calls[0][0]
    expect(Array.isArray(arg)).toBe(true)
    expect(arg[0]).toHaveProperty('question')
    expect(arg[0]).toHaveProperty('answer')
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateFaqSchema.test.ts` → FAIL.

- [ ] **Step 3: 두 페이지 수정**
(a) `frontend/pages/real-estate/index.vue`: `:136`의 destructure에 `setFAQSchema` 추가하고, 기존 `realEstateFAQs`(이미 `{question,answer}` 형태, `:128`)로 호출:
```ts
const { setBreadcrumbSchema, setItemListSchema, setDatasetSchema, setFAQSchema } = useStructuredData()
```
그리고 구조화 데이터 설정부(setBreadcrumbSchema 호출들 근처)에 추가:
```ts
setFAQSchema(realEstateFAQs)
```
(b) `frontend/pages/real-estate/[realEstateType]/index.vue`: `:382` destructure에 `setFAQSchema` 추가하고, `faqs`(computed, `{q,a}` 형태)를 변환해 호출:
```ts
const { setBreadcrumbSchema, setItemListSchema, setDatasetSchema, setFAQSchema } = useStructuredData()
```
구조화 데이터 설정부에 추가(컴포넌트 setup에서 1회; faqs.value 사용):
```ts
setFAQSchema(faqs.value.map(f => ({ question: f.q, answer: f.a })))
```

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateFaqSchema.test.ts` → PASS(1).
Run(회귀): `cd frontend && npx vitest run tests/pages/real-estate/` → 기존 real-estate 테스트 통과.

- [ ] **Step 5: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/real-estate/index.vue frontend/pages/real-estate/\[realEstateType\]/index.vue frontend/tests/pages/real-estate/realEstateFaqSchema.test.ts
git commit -m "feat(frontend): real-estate 허브/타입 FAQPage 구조화 데이터"
```

---

## Task 5: subway/index + guide/index ItemList (ⓓ ItemList)

**문제:** 두 목록 페이지에 ItemList 스키마 없음(Breadcrumb는 guide만 있음). `setItemListSchema(items)`는 `{name,url,position}[]`.

**Files:**
- Modify: `frontend/pages/subway/index.vue`, `frontend/pages/guide/index.vue`
- Test: `frontend/tests/pages/listItemListSchema.test.ts` (신규)

- [ ] **Step 1: 실패 테스트** — `frontend/tests/pages/listItemListSchema.test.ts`
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import GuideIndex from '~/pages/guide/index.vue'

const setItemListSchema = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setItemListSchema }),
}))
vi.stubGlobal('useHead', vi.fn())
vi.stubGlobal('useSeoMeta', vi.fn())
vi.stubGlobal('useAsyncData', (_k: string, h: () => Promise<unknown>) => {
  const data = ref<any>({ items: [
    { id: 1, slug: 'a', title: '가이드 A' },
    { id: 2, slug: 'b', title: '가이드 B' },
  ] })
  return Object.assign(Promise.resolve({ data }), { data, pending: ref(false), error: ref(null), refresh: vi.fn() })
})

import { ref } from 'vue'
const stubs = { NuxtLink: { template: '<a><slot /></a>', props: ['to'] }, Breadcrumb: true, PageHero: true, SectionBlock: { template: '<section><slot /></section>' }, AdBanner: true, Pagination: true }

async function mountSuspended(c: any) {
  const w = mount(defineComponent({ render() { return h(Suspense, null, { default: () => h(c) } ) } }), { global: { stubs } })
  await flushPromises()
  return w
}
beforeEach(() => vi.clearAllMocks())

describe('guide 목록 ItemList 스키마', () => {
  it('가이드 목록을 ItemList로 연결한다', async () => {
    await mountSuspended(GuideIndex)
    expect(setItemListSchema).toHaveBeenCalledWith([
      { name: '가이드 A', url: '/guide/a', position: 1 },
      { name: '가이드 B', url: '/guide/b', position: 2 },
    ])
  })
})
```
(주: `import { ref } from 'vue'`를 파일 상단으로 이동해도 됨 — vitest 호이스팅 상 mock 팩토리 안에서 ref 사용 시 상단 import 필요. 구현자는 import 순서를 조정해 통과시킬 것.)

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/pages/listItemListSchema.test.ts` → FAIL.

- [ ] **Step 3: 두 페이지 수정**
(a) `frontend/pages/guide/index.vue`: 기존 `const { setBreadcrumbSchema } = useStructuredData()`(`:156`)를 확장하고 ItemList 추가(`guides` computed = `guidesData.value?.items ?? []`, 각 항목 `slug`/`title`):
```ts
const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '생활 가이드', url: '/guide' },
])
setItemListSchema(
  guides.value.map((g, i) => ({ name: g.title, url: `/guide/${g.slug}`, position: i + 1 })),
)
```
(기존 setBreadcrumbSchema 인자는 현행 유지 — 위 예시의 배열이 기존과 다르면 기존 것을 보존하고 setItemListSchema만 추가.)
(b) `frontend/pages/subway/index.vue`: useStructuredData import 추가 + ItemList. `facilities` computed(각 항목 `id`=nameSlug, `name`) 사용, URL `/subway/${id}`:
```ts
import { useStructuredData } from '~/composables/useStructuredData'
```
`await useAsyncData(...)`(stations 패칭, `:259`) 다음에:
```ts
const { setItemListSchema } = useStructuredData()
setItemListSchema(
  facilities.value.map((f, i) => ({ name: f.name, url: `/subway/${f.id}`, position: i + 1 })),
)
```

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/pages/listItemListSchema.test.ts` → PASS(1).

- [ ] **Step 5: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/guide/index.vue frontend/pages/subway/index.vue frontend/tests/pages/listItemListSchema.test.ts
git commit -m "feat(frontend): subway/guide 목록 ItemList 구조화 데이터"
```

---

## Task 6: 죽은 useRealEstateMeta 삭제 + ComplexCard legacy URL 정리 (ⓔ)

**Files:**
- Delete: `frontend/composables/useRealEstateMeta.ts`, `frontend/tests/composables/useRealEstateMeta.test.ts`
- Modify: `frontend/components/realEstate/ComplexCard.vue` (`:84-93` linkUrl + isRenderable)
- Test: `frontend/tests/components/realEstate/ComplexCard.test.ts` (있으면 수정, 없으면 신규)

- [ ] **Step 1: 죽은 코드 미사용 재확인**
Run: `cd frontend && grep -rn "useRealEstateMeta" --include='*.vue' --include='*.ts' . | grep -v node_modules | grep -v 'useRealEstateMeta.ts:' | grep -v 'useRealEstateMeta.test.ts:'`
Expected: 출력 없음(테스트 외 사용처 0). 출력이 있으면 STOP(삭제 보류, 보고).

- [ ] **Step 2: 삭제**
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
git rm composables/useRealEstateMeta.ts tests/composables/useRealEstateMeta.test.ts
```

- [ ] **Step 3: ComplexCard legacy URL — 실패 테스트** — `frontend/tests/components/realEstate/ComplexCard.test.ts`

(기존 파일 있으면 케이스 추가) 핵심: city/district 없으면 legacy 2-segment URL을 렌더하지 않는다(미렌더).
```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ComplexCard from '~/components/realEstate/ComplexCard.vue'

const base = { buildingName: '강남타워', bjdCode: '11680', transactionCount: 5, latestPrice: 100000 }

function mountCard(complex: any) {
  return mount(ComplexCard, {
    props: { complex, propertyType: 'apt', tab: 'sale' },
    global: { stubs: { NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] }, HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
  })
}

describe('ComplexCard legacy URL 정리', () => {
  it('city/district 있으면 4-segment URL', () => {
    const w = mountCard({ ...base, city: '서울특별시', district: '강남구' })
    const href = w.find('a').attributes('href') ?? ''
    expect(href).toContain('/real-estate/apt-sale/')
    expect(href).not.toContain('bjdCode=')
  })
  it('city/district 없으면 legacy 2-segment 카드를 렌더하지 않는다', () => {
    const w = mountCard({ ...base, city: null, district: null })
    expect(w.find('a').exists()).toBe(false)
  })
})
```
(주: 실제 `toRealEstateUrl` 4-segment 출력/HardLink 래퍼 구조는 구현자가 컴포넌트를 읽어 stub/단언을 맞출 것. 핵심 단언은 "city/district 없을 때 미렌더".)

- [ ] **Step 4: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/realEstate/ComplexCard.test.ts` → 두 번째 케이스 FAIL(현재는 legacy URL 렌더).

- [ ] **Step 5: ComplexCard 수정**
`frontend/components/realEstate/ComplexCard.vue`:
`isRenderable` computed에 city/district 조건 추가(legacy 폴백 경로 제거):
```ts
const isRenderable = computed(() => {
  if (!isValidBuildingName(props.complex.buildingName)) return false
  if (props.complex.transactionCount < props.minTransactionCount) return false
  // 4-segment URL을 만들 수 없는(시/구 누락) 불완전 레코드는 렌더하지 않음(legacy 2-segment 색인 방지)
  if (!props.complex.city || !props.complex.district) return false
  return true
})
```
그리고 `linkUrl` computed의 legacy 2-segment 폴백 분기를 제거하고 4-segment만 반환(미렌더 가드가 city/district 보장):
```ts
const linkUrl = computed(() => {
  const { buildingName, city, district } = props.complex
  const type = `${props.propertyType}-${props.tab}` as RealEstateUrlType
  return toRealEstateUrl({ type, city: city as string, district: district as string, buildingName })
})
```

- [ ] **Step 6: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/realEstate/ComplexCard.test.ts` → PASS.

- [ ] **Step 7: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/realEstate/ComplexCard.vue frontend/tests/components/realEstate/ComplexCard.test.ts
git commit -m "chore(frontend): 죽은 useRealEstateMeta 삭제 + ComplexCard legacy URL 미렌더"
```
(`git rm`은 이미 스테이징됨 — 이 커밋에 함께 포함. `git add -A` 금지.)

---

## Task 7: 회귀 검증 + PR

- [ ] **Step 1: 변경 관련 테스트 디렉터리**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/pages tests/components/realEstate`
Expected: PASS.

- [ ] **Step 2: lint**
Run: `cd frontend && npm run lint 2>&1 | tail -5` → 0 errors.

- [ ] **Step 3: 전체 테스트**
Run: `cd frontend && npm run test 2>&1 | tail -8` → 전체 PASS(삭제한 useRealEstateMeta.test 제외 반영).

- [ ] **Step 4: SSR 빌드**
Run: `cd frontend && npm run build 2>&1 | tail -8` → exit 0.
(주: 떠 있는 dev 서버가 있으면 build가 .nuxt를 덮어써 dev가 깨짐 → 이후 dev 재시작 필요, 사용자 위임.)

- [ ] **Step 5: 수동 SSR curl(dev 떠 있을 때)**
```bash
# 허브 인트로 텍스트 SSR 포함
curl -s "http://localhost:3000/real-estate/apt-sale/seoul" | grep -c '국토교통부'        # >=1
# subway 상세 canonical
SL=$(curl -s "http://localhost:8000/api/subway/stations?limit=1" | python3 -c "import sys,json;d=json.load(sys.stdin);i=d['data']['items'];print(i[0].get('nameSlug','') if i else '')")
curl -s "http://localhost:3000/subway/$SL" | grep -c 'rel="canonical"'                    # >=1
# real-estate 허브 FAQPage
curl -s "http://localhost:3000/real-estate" | grep -c 'FAQPage'                            # >=1
# guide 목록 ItemList
curl -s "http://localhost:3000/guide" | grep -c 'ItemList'                                 # >=1
```
Expected: 각 >=1.

- [ ] **Step 6: PR**
```bash
git push -u origin feat/indexing-quality-pr2
gh pr create --base develop --title "색인 품질 PR2: noindex 정확도·canonical·FAQ/ItemList·죽은코드" --body "audit ③ PR2. [district]/[category] noindex를 SSR summary.count로, real-estate 시 허브 인트로(thin 방어), subway/[slug] canonical, real-estate FAQPage, subway/guide ItemList, 죽은 useRealEstateMeta 삭제 + ComplexCard legacy URL 미렌더."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** ⓑ1=T1 / ⓑ2=T2 / ⓒ=T3(about 등은 이미 canonical 보유 → subway만) / ⓓ FAQ=T4, ItemList=T5 / ⓔ=T6. 검증=T7.
- **Placeholder scan:** 모든 코드 단계 실제 코드. ComplexCard 테스트의 stub 구조는 구현자가 컴포넌트 읽어 맞추되 핵심 단언(미렌더) 명시 — 허용. curl 런타임 값($SL 등) 의도적.
- **Type consistency:** `computeAreaNoindex(AreaNoindexInput)` 시그니처 T1 일관. `setFAQSchema({question,answer}[])` — index.vue는 그대로, [realEstateType]는 q/a→question/answer 변환 명시. `setItemListSchema({name,url,position}[])` — guide(slug/title)·subway(id=nameSlug/name) 일관. `subwayCanonicalUrl(slug)` T3 일관.
- **Out of scope:** announcements 네트워크오류 404/503(후속), audit ⑫(비이슈), ④⑤⑥.
