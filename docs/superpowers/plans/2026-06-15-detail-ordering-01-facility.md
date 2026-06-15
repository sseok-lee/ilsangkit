# 시설(facility) 상세 섹션 재배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시설 상세 페이지(`pages/[category]/[id].vue`)를 공통 우선순위 사다리(spec §2)에 맞춘다. 구체적으로 (1) **T1 = 시설현황(DetailFacilityStatus)** 을 헤더 광고 직후로 끌어올리고 기본정보(DetailBasicInfo, T3)를 그 뒤로 내린다(모바일=데스크톱 동일 → order 클래스 없이 소스 순서만 스왑). (2) FAQPage **JSON-LD를 발행**한다(`setFAQSchema(generateDynamicFAQ(facility))` — 현재 화면 FAQ만 있고 구조화 데이터는 누락). (3) `hasFacilityStatus`가 false인 카테고리(clothes/trash/빈 pharmacy)에서 **빈 T1 + 광고 연속 노출**을 막는 v-if 가드를 추가한다. 광고 6개(article 내)는 개수·위치 유지.

**Architecture:** 헤더는 Foundation 플랜에서 이미 `~/components/common/MobileDetailHeader.vue`로 교체됨(본 플랜의 선행 조건). 본문은 단일 `<article class="flex flex-col gap-4">` 안에 콘텐츠 섹션과 6개 광고가 DOM 소스 순서대로 세로 스택된다(모바일=데스크톱 동일 컬럼). spec §3.3에 따라 **모바일=데스크톱 순서가 같은 시설 페이지는 order 클래스를 쓰지 않고 소스 순서 자체를 T1 우선으로 재배열**한다. `DetailFacilityStatus`는 내부에 `v-if="hasFacilityStatus"` 가드가 있어 비대상 카테고리에서 섹션 전체가 사라진다 — 그래서 이 섹션과 짝지어진 광고는 페이지 레벨에서 동일 조건의 v-if로 가드해야 "빈 T1 + 광고 두 개 연속" 회귀를 막는다.

**Tech Stack:** Nuxt 3 SSR + Vue 3 `<script setup lang="ts">`, Vitest + `@vue/test-utils` + happy-dom, TailwindCSS.

**참조 spec:** `docs/superpowers/specs/2026-06-15-detail-section-ordering-design.md` (§4.1 시설 facility, §3.2 광고 cadence, §3.3 order 컨벤션, §3.4 headline-first, §5 표(T3)·FAQ(T5), §6 결정4 FAQ 스키마 통일)

> **⚠️ 사용자 결정 (2026-06-15) — 광고 6개 유지:** 시설현황 없는 카테고리(clothes/trash/빈 pharmacy)에서도 **광고 6개를 그대로 유지**한다. 따라서 Task 2의 `v-if="hasFacilityStatus"` **짝 광고 가드와 `hasFacilityStatus` 미러 computed는 구현하지 말 것**. 콘텐츠(`DetailFacilityStatus`)만 내부 v-if로 자연 폴백되고 광고 6개는 항상 렌더된다(현행 thin-카테고리 광고 동작과 동일, 개수 불변). Task 2에서는 BasicInfo↔FacilityStatus **블록 스왑 + FAQ 스키마 발행만** 수행하고, 광고 `v-if`·미러 computed 관련 스텝/테스트는 생략한다.

**선행:** Foundation 플랜(공용 헤더) 먼저 적용 — `pages/[category]/[id].vue:288`이 이미 `~/components/common/MobileDetailHeader.vue`를 import하고 헤더 사용부가 `eyebrow`/`copyable` 형태여야 한다. (본 플랜은 헤더는 건드리지 않고 본문 순서·FAQ 스키마만 다룬다.)

**작업 위치:** 작업 브랜치 `docs/detail-section-ordering-design`(또는 별도 feat 브랜치). 명령은 모두 `cd frontend` 기준. Node 20 (`nvm use 20`). 재배치 검증 시 Nitro route cache(`.nuxt/cache/nitro/routes`) stale 주의 — 단위 테스트는 영향 없으나 dev 스모크 시 캐시 삭제.

**현재 본문 순서 (article, `pages/[category]/[id].vue` 기준):**

| 절대 라인 | 요소 | tier |
|---|---|---|
| 79–90 | Breadcrumb + 공유 버튼 | — |
| 93–104 | `<MobileDetailHeader>` (모바일 h1) | T0 |
| 105–112 | `<PageHero hidden md:block title-tag="div">` | T0(데스크톱) |
| 115 | `<AdBanner ... :fixed-height="280">` 광고① (HERO 아래) | 광고 |
| 118–127 | `<DetailBasicInfo>` | **T3 (현재 위치, 내릴 대상)** |
| 130 | `<AdBanner ... :fixed-height="280">` 광고② | 광고 |
| 133 | `<DetailFacilityStatus>` | **T1 (현재 위치, 올릴 대상)** |
| 136 | `<AdBanner ... :fixed-height="280">` 광고③ | 광고 |
| 139–161 | 위치·로드뷰 `<SectionBlock>` | T2 |
| 164 | `<AdBanner ... :fixed-height="280">` 광고④ | 광고 |
| 167–173 | `<DetailNearby>` | T4 |
| 176 | `<AdBanner />` 광고⑤ | 광고 |
| 179–191 | YouTube + 블로그 후기 | T4 |
| 194 | `<AdBanner />` 광고⑥ | 광고 |
| 197 | `<CoupangBanner class="md:hidden">` | 쿠팡(모바일) |
| 200–208 | `<DetailContextLinks>` (가이드+지역+팁+FAQ+출처) | T4/T5/T6 |

**목표 순서 (HERO 광고 직후 T1 승격):** … 광고①(115) → **T1 DetailFacilityStatus** → 광고②(짝 광고, `v-if` 가드) → **T3 DetailBasicInfo** → 광고③ → T2 … (이하 동일). 즉 118–127(BasicInfo)와 133(FacilityStatus) 블록을 **스왑**하고, 그 사이에 끼는 광고②(130)는 FacilityStatus와 동일한 `v-if` 조건으로 가드한다. 광고 개수(6)·종류는 불변.

---

### Task 1: FAQPage JSON-LD 발행 (T5 구조화 데이터)

화면에는 FAQ가 보이지만(`categoryFaqItems` → `DetailContextLinks`) `setFAQSchema`가 호출되지 않아 FAQPage JSON-LD가 누락돼 있다(spec §3.4·§6 결정4). `useStructuredData`에 이미 존재하는 `setFAQSchema(faqs: {question, answer}[])`를 `watchEffect` 안에서 호출한다. `generateDynamicFAQ`는 `FAQItem[]`(`{question, answer}`)을 반환 → `setFAQSchema` 시그니처와 동일하므로 매핑 불필요.

**Files:**
- Modify: `frontend/pages/[category]/[id].vue:303` (destructure에 `setFAQSchema` 추가), `:392-408` (`watchEffect` 안에서 `setFAQSchema` 호출)
- Test: `frontend/tests/pages/detail.test.ts` (FAQPage JSON-LD 발행 가드 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/pages/detail.test.ts`의 `describe('DetailPage', ...)` 블록 맨 끝(현재 마지막 `it(...)` 다음, `})` 닫기 직전, 절대 라인 275 근처)에 아래 테스트를 추가한다. 이 테스트는 페이지 SSR HTML에 `FAQPage` JSON-LD `<script type="application/ld+json">`가 존재함을 검증한다.

```ts
  // ---------------- FAQPage JSON-LD 발행 가드 (spec §3.4·§6 결정4) ----------------
  // 화면 FAQ(DetailContextLinks)만으로는 SEO 가치가 없으므로 setFAQSchema 로 FAQPage JSON-LD 를 발행해야 한다.
  it('FAQPage JSON-LD(structured data)를 발행한다', async () => {
    const heads: any[] = []
    ;(globalThis as any).useHead = vi.fn((arg: any) => {
      heads.push(typeof arg === 'function' ? arg() : arg)
    })

    await mountSuspended(DetailPage, { global: { stubs: globalStubs } })

    const scripts = heads.flatMap(h => h?.script ?? [])
    const faqScript = scripts.find((s: any) => s?.key === 'jsonld-faq')
    expect(faqScript).toBeTruthy()
    expect(faqScript.innerHTML).toContain('"@type":"FAQPage"')
  })
```

> 참고: 이 테스트는 `useHead`를 spy로 덮어쓴다. `tests/setup.ts`가 전역 `useHead`를 제공하므로 다른 테스트에 누수되지 않도록 이 `it` 내부에서만 스텁한다(테스트 격리). 기존 SEO 가드 테스트들은 `useHead` 결과를 검사하지 않으므로 영향 없음.

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts -t "FAQPage JSON-LD"`
Expected: FAIL — `expected undefined to be truthy` (현재 `setFAQSchema`가 호출되지 않아 `jsonld-faq` 스크립트가 없음)

- [ ] **Step 3: 구현 — destructure에 `setFAQSchema` 추가**

`frontend/pages/[category]/[id].vue:303`:

```ts
// 변경 전
const { setFacilitySchema, setBreadcrumbSchema, setVideoListSchema } = useStructuredData()
// 변경 후
const { setFacilitySchema, setBreadcrumbSchema, setVideoListSchema, setFAQSchema } = useStructuredData()
```

- [ ] **Step 4: 구현 — `watchEffect` 안에서 `setFAQSchema` 호출**

`frontend/pages/[category]/[id].vue:392-408`의 `watchEffect` 블록에서, `setVideoListSchema` 분기 다음(블록 닫기 `}` 직전)에 FAQ 스키마 발행을 추가한다. `categoryFaqItems`는 이미 `generateDynamicFAQ(facility.value)`를 래핑한 computed(`:474-477`)이므로 재사용한다.

```ts
// 변경 전
    const ssrVideos = secondaryResponse.value?.youtube?.videos ?? []
    if (ssrVideos.length >= 2) {
      setVideoListSchema(ssrVideos)
    }
  }
})
// 변경 후
    const ssrVideos = secondaryResponse.value?.youtube?.videos ?? []
    if (ssrVideos.length >= 2) {
      setVideoListSchema(ssrVideos)
    }
    // FAQPage JSON-LD 발행 (화면 FAQ 와 동일 소스 generateDynamicFAQ → SEO 구조화 데이터)
    if (categoryFaqItems.value.length > 0) {
      setFAQSchema(categoryFaqItems.value)
    }
  }
})
```

> 주의: `categoryFaqItems`(`:474`)는 `watchEffect`(`:392`)보다 소스상 **뒤**에 선언돼 있지만, `<script setup>`의 최상위 `const` 바인딩은 호이스팅되며 `watchEffect` 콜백은 마운트 후 실행되므로 참조 안전(temporal dead zone 미발생). 별도 이동 불필요.

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts -t "FAQPage JSON-LD"`
Expected: PASS (1 test) — `jsonld-faq` 스크립트 존재 + `"@type":"FAQPage"` 포함

- [ ] **Step 6: 회귀 — 파일 전체 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts`
Expected: PASS — 기존 13 + 신규 1 = 14 tests (단일 h1, 404 가드, nearby 렌더 등 회귀 없음)

- [ ] **Step 7: 커밋**

```bash
git add frontend/pages/\[category\]/\[id\].vue frontend/tests/pages/detail.test.ts
git commit -m "feat(facility): 상세 FAQPage JSON-LD 발행 (T5 구조화 데이터)"
```

---

### Task 2: T1 시설현황을 헤더 광고 직후로 승격 + 짝 광고 v-if 가드

`DetailBasicInfo`(T3)와 `DetailFacilityStatus`(T1) 블록을 소스에서 스왑한다(모바일=데스크톱 동일 → order 클래스 미사용, spec §3.3). 광고 6개는 그대로 두되, FacilityStatus 직후에 끼는 광고(현 130, 스왑 후 BasicInfo 앞)는 `DetailFacilityStatus`의 내부 `v-if="hasFacilityStatus"`와 동일 조건으로 페이지 레벨에서 가드해 "빈 T1 + 광고 연속 노출"을 방지한다(spec §4.1 폴백).

**Files:**
- Modify: `frontend/pages/[category]/[id].vue:117-136` (BasicInfo/Ad/FacilityStatus/Ad 4블록 재배열 + 광고 v-if), `:560-577` 부근(script, `hasFacilityStatus` 미러 computed 신규)
- Test: `frontend/tests/pages/detail.test.ts` (순서 + 광고 가드 회귀 테스트 추가)

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/pages/detail.test.ts`의 `describe('DetailPage', ...)` 블록 끝(Task 1에서 추가한 FAQ 테스트 다음)에 아래 두 테스트를 추가한다. (1) 시설현황 헤딩이 기본정보 헤딩보다 **앞**에 렌더되는지(소스 순서 검증), (2) `hasFacilityStatus=false`(clothes)일 때 시설현황 섹션이 없고 광고가 줄어드는지(빈 T1 + 광고 연속 방지).

```ts
  // ---------------- T1 시설현황 승격 (spec §4.1) ----------------
  // 시설현황(T1)이 기본정보(T3)보다 DOM 상 먼저 와야 한다 (모바일=데스크톱 동일, order 미사용).
  it('시설현황(T1)이 기본정보(T3)보다 먼저 렌더된다', async () => {
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    const html = wrapper.html()
    const statusIdx = html.indexOf('시설현황')
    const basicIdx = html.indexOf('기본정보')
    expect(statusIdx).toBeGreaterThan(-1)
    expect(basicIdx).toBeGreaterThan(-1)
    expect(statusIdx).toBeLessThan(basicIdx)
  })

  // hasFacilityStatus=false 카테고리(clothes)는 시설현황 섹션과 그 짝 광고가 함께 빠져야 한다.
  it('clothes(시설현황 없음)는 빈 T1 + 광고 연속 노출이 없다', async () => {
    mockUseAsyncDataWith({
      success: true,
      data: { ...mockFacility, id: 'clothes-1', category: 'clothes', details: { detailLocation: '정문 앞' } },
    })
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    const html = wrapper.html()
    // 시설현황 SectionBlock 자체가 렌더되지 않음 (DetailFacilityStatus 내부 v-if)
    expect(html).not.toContain('시설현황')
  })
```

> `AdBanner`는 `tests/setup.ts`에서 stub 처리되거나 자동 import 컴포넌트라 happy-dom에서 빈 요소로 렌더된다. 본 테스트는 광고 DOM 개수가 아닌 **시설현황 섹션 부재**로 "빈 T1 + 광고 연속"을 간접 검증한다(광고 인스턴스 stub 형태가 환경 의존적이므로 헤딩 텍스트 기준이 안정적).

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts -t "시설현황"`
Expected: FAIL — 첫 테스트에서 `statusIdx < basicIdx` 위배(현재는 기본정보가 먼저라 `statusIdx > basicIdx`).

- [ ] **Step 3: 구현 — script에 `hasFacilityStatus` 미러 computed 추가**

광고 v-if 가드를 위해 페이지 레벨에 `DetailFacilityStatus`의 표시 조건과 **동일한** computed를 둔다(컴포넌트와 진실 출처가 갈리지 않도록 같은 규칙 복제: clothes/trash 제외, pharmacy는 `pharmacistCnt>0`, 그 외 details 있으면 true). `relatedCategories` computed(`:560-563`) 바로 뒤에 추가한다.

`frontend/pages/[category]/[id].vue:560-563` 다음에 삽입:

```ts
// 변경 전
// 이 지역 다른 시설 관련 카테고리
const relatedCategories = computed(() => {
  const cat = category.value
  return (RELATED_CATEGORIES[cat] || []).filter(c => c !== cat)
})
// 변경 후
// 이 지역 다른 시설 관련 카테고리
const relatedCategories = computed(() => {
  const cat = category.value
  return (RELATED_CATEGORIES[cat] || []).filter(c => c !== cat)
})

// 시설현황(T1) 표시 여부 — DetailFacilityStatus.vue 의 hasFacilityStatus 와 동일 규칙.
// T1 섹션과 짝 광고를 페이지 레벨에서 함께 v-if 가드해 "빈 T1 + 광고 연속" 회귀를 막는다(spec §4.1).
const hasFacilityStatus = computed(() => {
  if (!facility.value?.details) return false
  const cat = facility.value.category
  if (cat === 'clothes' || cat === 'trash') return false
  if (cat === 'pharmacy') {
    const d = facility.value.details as Record<string, unknown>
    return typeof d.pharmacistCnt === 'number' && d.pharmacistCnt > 0
  }
  return true
})
```

- [ ] **Step 4: 구현 — 템플릿 4블록 재배열 + 광고 v-if 가드**

`frontend/pages/[category]/[id].vue:117-136`의 4개 블록(주석 포함)을 아래로 교체한다. BasicInfo↔FacilityStatus 스왑 + FacilityStatus 직후 광고를 `v-if="hasFacilityStatus"`로 가드.

```vue
<!-- 변경 전 (라인 117-136) -->
              <!-- BasicInfo -->
              <DetailBasicInfo
                :facility="facility"
                :hospital-operating-hours="hospitalOperatingHours"
                :hospital-weekly-hours="hospitalWeeklyHours"
                :hospital-weekly-hours-count="hospitalWeeklyHours.length"
                :aed-operating-hours="aedOperatingHours"
                :aed-weekly-hours="aedWeeklyHours"
                :aed-weekly-hours-count="aedWeeklyHours.length"
                :pharmacy-weekly-hours="pharmacyWeeklyHours"
              />

              <!-- Ad: BASIC INFO ↔ FACILITY STATUS 사이 -->
              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />

              <!-- FacilityStatus -->
              <DetailFacilityStatus :facility="facility" />

              <!-- Ad: DETAILS ↔ MAP 사이 -->
              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />
```

```vue
<!-- 변경 후 -->
              <!-- T1 FacilityStatus (시설현황) — 헤더 광고 직후 1차 고유 콘텐츠로 승격 -->
              <DetailFacilityStatus :facility="facility" />

              <!-- Ad: FACILITY STATUS ↔ BASIC INFO 사이 (시설현황 없는 카테고리는 빈 T1+광고 연속 방지 위해 함께 숨김) -->
              <AdBanner v-if="hasFacilityStatus" sizing="fixed" ad-format="rectangle" :fixed-height="280" />

              <!-- T3 BasicInfo (기본정보·운영시간) -->
              <DetailBasicInfo
                :facility="facility"
                :hospital-operating-hours="hospitalOperatingHours"
                :hospital-weekly-hours="hospitalWeeklyHours"
                :hospital-weekly-hours-count="hospitalWeeklyHours.length"
                :aed-operating-hours="aedOperatingHours"
                :aed-weekly-hours="aedWeeklyHours"
                :aed-weekly-hours-count="aedWeeklyHours.length"
                :pharmacy-weekly-hours="pharmacyWeeklyHours"
              />

              <!-- Ad: BASIC INFO ↔ MAP 사이 -->
              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />
```

> **광고 개수 보존 검증:** 변경 전 이 구간 광고 2개(130, 136) → 변경 후도 2개(가드 광고 1 + MAP 사이 광고 1). `hasFacilityStatus=true`인 일반 카테고리는 광고 6개 그대로. `hasFacilityStatus=false`(clothes/trash/빈 pharmacy)일 때만 가드 광고 1개가 빠져 5개가 되는데, 이는 spec §4.1·§8 "조건부 섹션 갭"이 의도한 동작(빈 T1 뒤 광고 연속 방지)이며 §3.2 cadence 위반 아님(헤더 직후 광고①은 유지). HERO 아래 광고①(115), MAP 사이 광고(스왑 후), 광고④⑤⑥은 모두 불변.

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts -t "시설현황"`
Expected: PASS (2 tests) — 시설현황이 기본정보보다 먼저 렌더 + clothes에서 시설현황 섹션 부재

- [ ] **Step 6: 회귀 — 파일 전체 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts`
Expected: PASS — Task1 결과(14) + 신규 2 = 16 tests. 특히 단일 h1(`:205`)·중복 없음(`:216`)·nearby(`:227`) 가드 회귀 없음.

- [ ] **Step 7: 커밋**

```bash
git add frontend/pages/\[category\]/\[id\].vue frontend/tests/pages/detail.test.ts
git commit -m "feat(facility): 시설현황(T1)을 헤더 광고 직후로 승격 + 짝 광고 v-if 가드"
```

---

### Task 3: 전체 프론트 테스트 + 빌드 검증

페이지 외 다른 테스트(예: `facility-detail-links.test.ts`, `category-cross-links.test.ts`)가 본 변경에 영향받지 않는지, 빌드가 깨지지 않는지 확인한다.

**Files:**
- (변경 없음 — 검증 전용)

- [ ] **Step 1: 시설 관련 테스트 묶음 실행**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts tests/pages/facility-detail-links.test.ts tests/components/facility/detail/`
Expected: 전부 PASS — DetailFacilityStatus/DetailBasicInfo 컴포넌트 단위 테스트 회귀 없음(본 플랜은 컴포넌트 내부 미변경, 순서·광고만 조정).

- [ ] **Step 2: 전체 프론트 테스트**

Run: `cd frontend && npx vitest run`
Expected: 전체 PASS.

- [ ] **Step 3: 빌드 검증**

Run: `cd frontend && npm run build`
Expected: 빌드 성공(타입 에러·미해결 import 없음). `setFAQSchema`/`hasFacilityStatus` 추가가 타입 통과.

- [ ] **Step 4: (선택) 데스크톱/모바일 스모크**

dev 스모크 시 Nitro route cache stale 주의 — 메인 외 시설 상세는 보통 캐시 대상 아니나, 순서가 반영 안 되면 `rm -rf frontend/.nuxt/cache/nitro/routes` 후 `npm run dev` 재시작. 토일렛(시설현황 있음)·의류수거함(시설현황 없음, clothes) 2종으로 (a) 시설현황이 헤더 광고 직후에 오는지, (b) clothes에서 빈 섹션·광고 연속이 없는지, (c) `h1` 1개인지 확인.

- [ ] **Step 5: 커밋 불필요 (검증 단계). 실패 시 해당 Task로 복귀해 수정.**

---

## Self-Review

- **Spec §4.1 시설 facility 커버:**
  - "T1 = DetailFacilityStatus(시설현황)" → Task 2에서 BasicInfo 위로 승격. ✅
  - "현재 기본정보 뒤·광고 2개 뒤 → 헤더 광고 직후로 승격" → 정확히 광고①(HERO 아래) 직후가 FacilityStatus가 되도록 스왑. ✅
  - "모바일=데스크톱, order 불필요" → order 클래스 미사용, 소스 순서 스왑(spec §3.3 시설 규칙 준수). ✅
  - "폴백: hasFacilityStatus=false(clothes/trash/빈 pharmacy)는 빈 섹션+광고 연속 노출 방지 v-if 확인" → Task 2에서 페이지 레벨 `hasFacilityStatus` 미러 computed + 짝 광고 `v-if` 가드 + clothes 테스트. ✅
  - "데스크톱: 우측 sticky 사이드바에 지도+액션+쿠팡+광고⑦ 유지(T2 사이드바 예외)" → aside(`:212-263`) 미변경. ✅
- **Spec §6 결정4 / §3.4 FAQ 스키마:** "FAQ 있는 페이지는 FAQPage JSON-LD 발행 통일" → Task 1에서 `setFAQSchema(categoryFaqItems)` 발행(화면 FAQ와 동일 소스 `generateDynamicFAQ`). ✅
- **Spec §3.2 광고 cadence:** 광고 6개(article) 개수·종류 유지, 본문 첫 광고는 T0 헤더 직후(광고① 불변), 스왑 구간 광고 2개 보존. 조건부 카테고리에서 가드 광고 1개 생략은 §8 "조건부 섹션 갭"이 인정한 의도된 동작. ✅
- **플레이스홀더 스캔:** "적절히/TODO/위와 유사" 없음. 모든 재배치는 실제 before→after 마크업 코드 블록 제시. 모든 vitest 명령은 실제 파일 경로(`tests/pages/detail.test.ts`)와 `-t` 필터 명시. ✅
- **타입/prop 일관성:**
  - `setFAQSchema(faqs: {question, answer}[])` ← `generateDynamicFAQ`가 `FAQItem`(`{question, answer}`) 반환 → 매핑 없이 호환(`utils/categoryFAQ.ts:3-6` 확인). ✅
  - 페이지 `hasFacilityStatus` computed는 `DetailFacilityStatus.vue:576-585`의 동일 규칙 복제(clothes/trash 제외, pharmacy `pharmacistCnt>0`, else true) — 진실 출처 일치. ✅
  - `DetailBasicInfo`/`DetailFacilityStatus`/`AdBanner` props·태그 전부 기존과 동일(순서만 이동). ✅
- **회귀 가드:** 단일 h1(`detail.test.ts:205`), 컴포넌트 중복 없음(`:216`), nearby 렌더(`:227`), 404/네트워크 에러 가드(`:171`,`:250`) 모두 본 변경과 직교 → Task 1·2 Step 6에서 전체 파일 재실행으로 확인. ✅
- **범위 밖:** 헤더 통합(Foundation), 컴포넌트 내부 headline-first 리라이트, 다른 페이지(지하철·부동산·토지·공매·청약·공공임대)는 각 per-page 플랜. 본 플랜은 시설 본문 순서 + FAQ 스키마 + 광고 가드만. ✅
