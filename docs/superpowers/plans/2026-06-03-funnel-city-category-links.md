# 지역 허브 카테고리 진입 링크 (⑤ 깔때기 PR1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지역 허브 `[city]/index.vue`에 카테고리 바로가기 섹션을 추가해 도시 단계에서 카테고리(도시-필터) 페이지로 바로 가는 내부링크를 보강한다.

**Architecture:** `CATEGORY_GROUPS`의 시설 카테고리를 아이콘+라벨 카드 그리드로 렌더, 각 링크는 `/${cat}?city=${citySlug}`. 카테고리 페이지는 `?city=` 슬러그를 인식해 도시-aware로 동작하고 canonical은 base라 중복 색인 없음.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-03-funnel-internal-links-design.md` (PR1)

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). `frontend/`. 브랜치 `feat/city-category-links`. 커밋 명시 경로만(절대 `git add -A` 금지).

## 확인된 사실
- `types/facility.ts` `CATEGORY_GROUPS`: 4그룹(교육/육아, 건강/안전, 생활/편의, 환경/생활), 각 `{ title, icon, categories }`. 전체 카테고리: school, childcare, library, hospital, pharmacy, sports, aed, park, market, parking, ev-charger, subway, toilet, clothes, trash.
- `[city]/index.vue`: `city`(computed, 라우트 슬러그 예 `seoul`), `cityName`(한글명), `cityData`(computed, `{ districts: {slug,name,facilityTotal}[], realEstate }`). 구/군 섹션은 `:1-45`, 그 다음 AdBanner→생활가이드.
- `CATEGORY_META[cat]`: `.icon`(material-symbols), `.label`.

---

## Task 1: 카테고리 바로가기 섹션 추가 + 테스트

**Files:**
- Modify: `frontend/pages/[city]/index.vue` (template: 구/군 섹션 다음 / script: computed + import)
- Test: `frontend/tests/pages/cityHubCategoryLinks.test.ts` (신규)

- [ ] **Step 1: 실패 테스트** — `frontend/tests/pages/cityHubCategoryLinks.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref } from 'vue'
import CityHub from '~/pages/[city]/index.vue'

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setAreaReportSchema: vi.fn(), setItemListSchema: vi.fn() }),
}))
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { city: 'seoul' }, query: {} }),
}))
vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
  const data = ref<any>({ data: { districts: [{ slug: 'gangnam-gu', name: '강남구', facilityTotal: 100 }], realEstate: null } })
  return Object.assign(Promise.resolve({ data }), { data, pending: ref(false), error: ref(null), refresh: vi.fn() })
})

const stubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: true, PageHero: true, AdBanner: true,
  RegionRealEstatePrices: true, RegionRealEstateCta: true,
  RecentGuides: true, DataSourceSection: true, ClientOnly: { template: '<div><slot /></div>' },
}

async function mountSuspended() {
  const w = mount(defineComponent({ render() { return h(Suspense, null, { default: () => h(CityHub) }) } }), { global: { stubs } })
  await flushPromises()
  return w
}

describe('지역 허브 카테고리 바로가기', () => {
  it('각 카테고리를 /{cat}?city={slug} 링크로 렌더한다', async () => {
    const w = await mountSuspended()
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/pharmacy?city=seoul')
    expect(hrefs).toContain('/hospital?city=seoul')
    expect(hrefs).toContain('/parking?city=seoul')
  })
})
```
(주: useStructuredData/useFacilityMeta가 `[city]/index.vue`에서 실제로 destructure하는 setter명을 파일에서 확인해 mock에 모두 포함시킬 것 — 누락 시 마운트 실패. useAsyncData mock의 data 형태도 페이지의 `response.value?.data` 접근에 맞출 것. 마운트가 다른 전역 의존으로 실패하면 필요한 stub/mock 보강.)

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/pages/cityHubCategoryLinks.test.ts` → FAIL(섹션 없음).

- [ ] **Step 3: script에 computed + import 추가**
`pages/[city]/index.vue` `<script setup>`:
- import 추가(기존 import 영역):
```ts
import { CATEGORY_GROUPS, CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
```
- `city`/`cityName` computed 근처에 추가:
```ts
const cityCategoryLinks = computed(() =>
  CATEGORY_GROUPS.flatMap(g => g.categories).map((cat) => ({
    slug: cat,
    to: `/${cat}?city=${city.value}`,
    icon: CATEGORY_META[cat as FacilityCategory]?.icon ?? 'place',
    label: CATEGORY_META[cat as FacilityCategory]?.label ?? cat,
  })),
)
```

- [ ] **Step 4: template에 섹션 추가**
구/군 선택 `</section>`(`:45`) 다음, AdBanner(`:47`) 앞에 삽입:
```vue
        <!-- 카테고리별 바로가기 -->
        <section id="categories" class="mb-6">
          <h2 class="text-display-2 text-slate-900 flex items-center gap-2 mb-3">
            <span class="material-symbols-outlined text-primary text-[22px]">category</span>
            카테고리별 바로가기
          </h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <NuxtLink
              v-for="cat in cityCategoryLinks"
              :key="cat.slug"
              :to="cat.to"
              class="group flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 hover:border-primary/30"
            >
              <span class="material-symbols-outlined text-primary text-[22px]">{{ cat.icon }}</span>
              <span class="font-semibold text-slate-900 text-sm">{{ cat.label }}</span>
            </NuxtLink>
          </div>
        </section>
```

- [ ] **Step 5: 통과 확인**
Run: `cd frontend && npx vitest run tests/pages/cityHubCategoryLinks.test.ts` → PASS.

- [ ] **Step 6: lint + 커밋**
Run: `cd frontend && npx eslint pages/\[city\]/index.vue` → 0 new errors.
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/\[city\]/index.vue frontend/tests/pages/cityHubCategoryLinks.test.ts
git commit -m "feat(frontend): 지역 허브에 카테고리 진입 링크 섹션 추가"
```

---

## Task 2: 회귀 검증 + SSR curl + PR

- [ ] **Step 1: 관련 테스트 + lint**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/pages/cityHubCategoryLinks.test.ts && npm run lint 2>&1 | tail -5`
Expected: PASS / 0 errors.

- [ ] **Step 2: 전체 테스트**
Run: `cd frontend && npm run test 2>&1 | tail -8` → 전체 PASS.

- [ ] **Step 3: SSR 빌드**
Run: `cd frontend && npm run build 2>&1 | tail -8` → exit 0.

- [ ] **Step 4: SSR curl 검증 (dev 떠 있을 때)**
```bash
curl -s "http://localhost:3000/seoul" | grep -oc 'href="/pharmacy?city=seoul"'   # >=1
curl -s "http://localhost:3000/seoul" | grep -oc '카테고리별 바로가기'              # >=1
```
Expected: 카테고리 링크가 SSR HTML에 포함. (dev/데이터 없으면 스킵, 단위테스트로 대체.)

- [ ] **Step 5: PR**
```bash
git push -u origin feat/city-category-links
gh pr create --base develop --title "깔때기 보강 ⑤: 지역 허브 카테고리 진입 링크" --body "audit ⑤ 깔때기 PR1. [city] 허브에 카테고리 바로가기 섹션 추가 — 각 링크 /{cat}?city={slug}. 카테고리 페이지가 ?city 슬러그를 인식(도시-aware), canonical은 base라 중복 색인 없음. 부동산 시 허브 단지 카드는 PR2."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** P1-1(카테고리 섹션)=T1 Step3-4 / P1-2(슬러그 타깃)=`to: /${cat}?city=${city.value}`. 검증=T2.
- **Placeholder scan:** 코드 단계 실제 코드. 테스트의 "setter명 파일 확인"은 mock 완전성 지시(정당).
- **Type consistency:** `cityCategoryLinks` 항목 {slug,to,icon,label} — template 사용 일치. `city`(computed 슬러그) 사용. `CATEGORY_GROUPS`/`CATEGORY_META`/`FacilityCategory` 기존 export.
- **위험:** 기존 블록 불변, 신규 섹션만 추가. subway/trash도 링크 생성(각자 페이지 존재, 유효). 로컬 데이터 없으면 SSR curl 스킵하되 단위테스트로 검증.
- **Out of scope:** PR2 단지 카드, 카테고리 카운트 집계, 신규 라우트.
