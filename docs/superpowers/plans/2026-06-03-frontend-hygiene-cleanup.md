# 프론트엔드 위생 정리 (Audit ⑥) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** audit ⑥ 위생 항목(죽은 코드·타입 핵 주석·그리드 정렬·광고 과호출·이모지·용어 혼용)을 한 PR에서 정리한다.

**Architecture:** 4개 독립 커밋(A 죽은 코드 / B 마이크로 개선 / C 주석 / D 용어 통일). 동작·시각 변화 있는 항목(B,D)만 단위 테스트 추가·갱신, 순수 제거(A)는 기존 테스트+lint+build로 회귀 검증.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-03-frontend-hygiene-cleanup-design.md`

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). 작업 디렉터리 `frontend/`. 브랜치 `feat/frontend-hygiene-cleanup`(이미 생성됨). 커밋은 **명시 경로만**(절대 `git add -A` 금지 — 메모리 규칙).

## 확인된 사실

- `pages/index.vue:241` `import HomeMarketStats` 미사용(템플릿은 `HomeHotspotSignals` 사용). 컴포넌트 파일/테스트는 유지(import 줄만 제거).
- `pages/search.vue:426` `import ComplexCard` 미사용(단지 결과는 228–240행 인라인 `NuxtLink`).
- `pages/public-rental/[type]/[id].vue` 템플릿: `<div v-if="!rental">…</div>` + `<PublicRentalDetailView v-else …>`. `!rental` 도달 불가(81행 `createError(404)`).
- `pages/subscription/[id].vue` 템플릿: `<div v-if="pending">…</div>` + `<template v-else-if="subscription">`. `pending=ref(false)`(455행) 영구 false.
- `nuxt.config.ts` icon_names에 `calendar_month` 이미 등록 → 아이콘 교체에 config 변경 불필요.
- quickFacilities(388행) 9개 + 그리드 `grid-cols-4 md:grid-cols-8`(117행). 각 항목 `/${q.id}` 라우팅 + `CategoryIcon`. 추가 7개 id는 유효 facility 카테고리(`/wifi` 등 라우트·아이콘 정상).
- 용어 테스트 영향: `HomeSubscriptionSection.test.ts:54`(`'접수중'` 단언), `lhRentalHub.test.ts:77`(`'청약·임대'` 단언), `index.test.ts`(quickFacilities 8-icon). `announcementDetail.test.ts:90`의 "진행중"은 `it()` 이름일 뿐 렌더 단언 아님(안전).
- `index.vue:78` "진행중 청약"은 홈 집계 stat 라벨(형제: "실거래 부동산"/"등록 시설") — 상태 배지 아님 → **용어 통일 범위 외**(의도적 유지).

---

## Task A: 죽은 코드 제거

**Files:**
- Modify: `frontend/pages/index.vue:241`
- Modify: `frontend/pages/search.vue:426`
- Modify: `frontend/pages/public-rental/[type]/[id].vue` (template 6–15행)
- Modify: `frontend/pages/subscription/[id].vue` (template 3–10행 + script 455행)

- [ ] **Step 1: HomeMarketStats import 제거** — `pages/index.vue`
아래 줄 삭제:
```ts
import HomeMarketStats from '~/components/home/HomeMarketStats.vue'
```

- [ ] **Step 2: ComplexCard import 제거** — `pages/search.vue`
아래 줄 삭제:
```ts
import ComplexCard from '~/components/realEstate/ComplexCard.vue'
```

- [ ] **Step 3: public-rental 도달 불가 폴백 제거** — `pages/public-rental/[type]/[id].vue`
현재:
```vue
      <div v-if="!rental" class="rounded-xl bg-slate-50 p-12 text-center">
        <p class="text-slate-600 font-medium">매물 정보를 불러올 수 없습니다</p>
      </div>

      <PublicRentalDetailView
        v-else
        :rental="rental"
        :siblings="siblings"
        :nearby="nearby"
      />
```
교체(빈-상태 div 제거, `v-else` → `v-if="rental"`로 null 가드 보존):
```vue
      <PublicRentalDetailView
        v-if="rental"
        :rental="rental"
        :siblings="siblings"
        :nearby="nearby"
      />
```

- [ ] **Step 4: subscription 미연결 pending 제거** — `pages/subscription/[id].vue`
(a) 템플릿 로딩 블록 제거 + `v-else-if` → `v-if`. 현재:
```vue
    <!-- Loading State -->
    <div v-if="pending" class="flex items-center justify-center py-20 min-h-[400px]">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p class="text-slate-600">로딩 중...</p>
      </div>
    </div>

    <template v-else-if="subscription">
```
교체:
```vue
    <template v-if="subscription">
```
(b) script 455행 `const pending = ref(false)` 줄 삭제.

- [ ] **Step 5: 회귀 검증(테스트+lint)**
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/pages/index.test.ts tests/pages/lhRentalHub.test.ts && npx eslint pages/index.vue pages/search.vue "pages/public-rental/[type]/[id].vue" "pages/subscription/[id].vue"
```
Expected: 테스트 PASS, eslint 0 error(미사용 import 경고 사라짐). subscription/public-rental 상세 테스트가 있으면 함께 실행해 통과 확인.

- [ ] **Step 6: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/index.vue frontend/pages/search.vue "frontend/pages/public-rental/[type]/[id].vue" "frontend/pages/subscription/[id].vue"
git commit -m "chore(frontend): 죽은 import·도달불가 폴백·미연결 pending 제거"
```

---

## Task B: 마이크로 개선 (이모지·광고 watch·빠른찾기)

**Files:**
- Modify: `frontend/components/common/StaticPageHeader.vue:11`
- Test: `frontend/tests/components/common/StaticPageHeader.test.ts`
- Modify: `frontend/components/ads/AdBanner.vue:137`
- Modify: `frontend/pages/index.vue` (387–398행 quickFacilities)
- Test: `frontend/tests/pages/index.test.ts`

- [ ] **Step 1: StaticPageHeader 실패 테스트 추가** — `tests/components/common/StaticPageHeader.test.ts`
기존 `describe` 블록 안에 추가:
```ts
  it('renders the update badge icon as a material-symbol, not an emoji', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: 'T', updatedAt: '2026.06.01' } })
    expect(wrapper.text()).not.toContain('📅')
    const icon = wrapper.find('.material-symbols-outlined')
    expect(icon.exists()).toBe(true)
    expect(icon.text()).toBe('calendar_month')
  })
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/common/StaticPageHeader.test.ts`
Expected: 신규 케이스 FAIL(📅 존재 / material-symbols 없음).

- [ ] **Step 3: 이모지 교체** — `components/common/StaticPageHeader.vue`
현재(11행):
```vue
        <span aria-hidden="true">📅</span>
```
교체:
```vue
        <span class="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">calendar_month</span>
```

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/common/StaticPageHeader.test.ts`
Expected: 전체 PASS.

- [ ] **Step 5: AdBanner watch 좁히기** — `components/ads/AdBanner.vue`
현재(137행 부근):
```ts
watch(() => route.fullPath, async () => {
  if (!shouldShow.value) return
  adKey.value++
  await nextTick()
  refresh()
})
```
교체(`fullPath` → `path`):
```ts
watch(() => route.path, async () => {
  if (!shouldShow.value) return
  adKey.value++
  await nextTick()
  refresh()
})
```
(주: 단위 테스트 미추가 — `tests/setup.ts`의 `useRoute` mock이 비반응형이라 watch 발동을 시뮬레이션할 수 없음. 변경은 watch 의존성 1개 축소이며, 페이지 이동 노출은 컴포넌트 remount로 별개 보장됨(동작 불변). 검증은 기존 AdBanner 테스트 통과 + lint/build로 수행.)

- [ ] **Step 6: AdBanner 회귀 확인**
Run: `cd frontend && npx vitest run tests/components/ads/AdBanner.test.ts && npx eslint components/ads/AdBanner.vue`
Expected: PASS / 0 error.

- [ ] **Step 7: quickFacilities 테스트 갱신** — `tests/pages/index.test.ts`
"8-icon" 테스트(134행 부근)를 16개로 갱신:
```ts
  it('renders "빠른 생활시설 찾기" 16-icon grid (전 시설 카테고리 + 지하철)', async () => {
    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.text()).toContain('빠른 생활시설 찾기')
    // 기존 대표
    expect(wrapper.text()).toContain('병원')
    expect(wrapper.text()).toContain('약국')
    expect(wrapper.text()).toContain('학교')
    expect(wrapper.text()).toContain('쓰레기')
    // 신규 추가분
    expect(wrapper.text()).toContain('도서관')
    expect(wrapper.text()).toContain('공원')
    expect(wrapper.text()).toContain('체육시설')
  })
```

- [ ] **Step 8: 실패 확인**
Run: `cd frontend && npx vitest run tests/pages/index.test.ts`
Expected: 16-icon 케이스 FAIL(도서관/공원/체육시설 미존재).

- [ ] **Step 9: quickFacilities 16개로 확장** — `pages/index.vue`
현재(387–398행):
```ts
// 빠른 생활시설 찾기 (와이어프레임 8개)
const quickFacilities: { id: string; label: string }[] = [
  { id: 'hospital', label: '병원' },
  { id: 'pharmacy', label: '약국' },
  { id: 'parking', label: '주차' },
  { id: 'ev-charger', label: '충전' },
  { id: 'subway', label: '지하철' },
  { id: 'school', label: '학교' },
  { id: 'childcare', label: '어린이집' },
  { id: 'toilet', label: '화장실' },
  { id: 'trash', label: '쓰레기' },
]
```
교체:
```ts
// 빠른 생활시설 찾기 (전 시설 카테고리 15개 + 지하철 = 16개, 8-col 2줄)
const quickFacilities: { id: string; label: string }[] = [
  { id: 'hospital', label: '병원' },
  { id: 'pharmacy', label: '약국' },
  { id: 'parking', label: '주차' },
  { id: 'ev-charger', label: '충전' },
  { id: 'subway', label: '지하철' },
  { id: 'school', label: '학교' },
  { id: 'childcare', label: '어린이집' },
  { id: 'toilet', label: '화장실' },
  { id: 'trash', label: '쓰레기' },
  { id: 'wifi', label: '와이파이' },
  { id: 'clothes', label: '의류수거' },
  { id: 'aed', label: 'AED' },
  { id: 'library', label: '도서관' },
  { id: 'park', label: '공원' },
  { id: 'market', label: '전통시장' },
  { id: 'sports', label: '체육시설' },
]
```
(그리드 클래스 `grid-cols-4 md:grid-cols-8`는 변경 없음 — 16개가 정확히 정렬됨.)

- [ ] **Step 10: 통과 확인**
Run: `cd frontend && npx vitest run tests/pages/index.test.ts`
Expected: 전체 PASS.

- [ ] **Step 11: lint + 커밋**
Run: `cd frontend && npx eslint components/common/StaticPageHeader.vue pages/index.vue`
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/common/StaticPageHeader.vue frontend/tests/components/common/StaticPageHeader.test.ts frontend/components/ads/AdBanner.vue frontend/pages/index.vue frontend/tests/pages/index.test.ts
git commit -m "feat(frontend): 홈 빠른찾기 전 시설 노출 + 이모지→material-symbols + 광고 path watch"
```

---

## Task C: 지도 마커 placeholder 설명 주석

**Files:**
- Modify: `frontend/pages/subscription/[id].vue:474`
- Modify: `frontend/components/subscription/PublicRentalDetailView.vue:104`

- [ ] **Step 1: subscription 마커 주석** — `pages/subscription/[id].vue`
474행 `category: 'toilet' as const,` 바로 윗줄에 주석 삽입:
```ts
    // 지도 마커 타입(FacilityCategory) 충족용 placeholder — 실제 시설 아님(상세 페이지의 단일 위치 핀)
    category: 'toilet' as const,
```

- [ ] **Step 2: PublicRentalDetailView 마커 주석** — `components/subscription/PublicRentalDetailView.vue`
104행 `category: 'toilet' as const,`(또는 동일 패턴) 바로 윗줄에 동일 주석 삽입:
```ts
    // 지도 마커 타입(FacilityCategory) 충족용 placeholder — 실제 시설 아님(상세 페이지의 단일 위치 핀)
    category: 'toilet' as const,
```
(주: 정확한 줄은 파일에서 `category: 'toilet'`를 grep해 확인 후 그 줄 위에 삽입.)

- [ ] **Step 3: lint + 커밋**
Run: `cd frontend && npx eslint "pages/subscription/[id].vue" components/subscription/PublicRentalDetailView.vue`
Expected: 0 error.
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add "frontend/pages/subscription/[id].vue" frontend/components/subscription/PublicRentalDetailView.vue
git commit -m "docs(frontend): 지도 마커 placeholder category 설명 주석"
```

---

## Task D: 용어 통일 (청약중·모집중·청약 정보)

**Files:**
- Modify: `frontend/components/subscription/SubscriptionCard.vue:79`
- Modify: `frontend/components/subscription/SubscriptionListView.vue:207`
- Modify: `frontend/pages/subscription/[id].vue:691`
- Modify: `frontend/components/subscription/HomeSubscriptionSection.vue:21`
- Test: `frontend/tests/components/subscription/HomeSubscriptionSection.test.ts:54`
- Modify: `frontend/pages/public-rental/announcements/index.vue:114,120`
- Modify: `frontend/pages/public-rental/announcements/[pblancId].vue:163`
- Modify: `frontend/pages/subscription/[id].vue:588`
- Modify: `frontend/pages/public-rental/index.vue:56`
- Test: `frontend/tests/pages/lhRentalHub.test.ts:77`

- [ ] **Step 1: HomeSubscriptionSection 테스트 갱신(실패)** — `tests/components/subscription/HomeSubscriptionSection.test.ts`
54행 단언을 변경:
```ts
    expect(text).toContain('청약중')
```
(같은 it 블록의 다른 단언은 그대로. 변경 후 이 테스트는 컴포넌트가 아직 "접수중"이라 FAIL.)

- [ ] **Step 2: lhRentalHub 테스트 갱신(실패)** — `tests/pages/lhRentalHub.test.ts`
77행:
```ts
    expect(breadcrumbs[1].name).toBe('청약 정보')
```
(변경 후 페이지가 아직 "청약·임대"라 FAIL.)

- [ ] **Step 3: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/subscription/HomeSubscriptionSection.test.ts tests/pages/lhRentalHub.test.ts`
Expected: 두 케이스 FAIL.

- [ ] **Step 4: 청약 ongoing "접수중" → "청약중" (4곳)**
- `components/subscription/SubscriptionCard.vue:79` — `if (status === 'ongoing') return '접수중'` → `return '청약중'`
- `components/subscription/SubscriptionListView.vue:207` — `if (status === 'ongoing') return '접수중'` → `return '청약중'`
- `pages/subscription/[id].vue:691` — `if (status === 'ongoing') return '접수중'`(`return '접수중'` 줄) → `return '청약중'`
- `components/subscription/HomeSubscriptionSection.vue:21` — 텍스트 `접수중 <strong>{{ ongoingTotal }}건</strong>` → `청약중 <strong>{{ ongoingTotal }}건</strong>`
(주: 각 파일에서 `'접수중'`/`접수중`을 grep해 정확 위치 확인. "접수예정"(upcoming)은 변경 금지.)

- [ ] **Step 5: 공공임대 ongoing "진행중" → "모집중" (3곳)**
- `pages/public-rental/announcements/index.vue:114` — 필터 옵션 `{ value: 'ongoing', label: '진행중' }` → `label: '모집중'`
- `pages/public-rental/announcements/index.vue:120` — 라벨 맵 `ongoing: '진행중',` → `ongoing: '모집중',`
- `pages/public-rental/announcements/[pblancId].vue:163` — 라벨 맵 `ongoing: '진행중',` → `ongoing: '모집중',`
(주: `closed: '마감'` 등 다른 상태·마케팅 산문(:8,:193 "진행중·예정·마감")은 변경 금지.)

- [ ] **Step 6: 허브 라벨 "청약·임대" → "청약 정보" (2곳)**
- `pages/subscription/[id].vue:588` — 보이는 브레드크럼 `{ label: '청약·임대', href: '/subscription', current: false }` → `label: '청약 정보'`
- `pages/public-rental/index.vue:56` — JSON-LD `{ name: '청약·임대', url: \`${SITE_URL}/subscription\` }` → `name: '청약 정보'`
(주: AppHeader 내비 그룹 "청약·임대"(`navGroups`/`AppHeader.vue`)와 그 테스트는 변경 금지 — 우산 그룹명으로 유지.)

- [ ] **Step 7: 갱신 테스트 통과 확인**
Run: `cd frontend && npx vitest run tests/components/subscription/HomeSubscriptionSection.test.ts tests/pages/lhRentalHub.test.ts`
Expected: 전체 PASS.

- [ ] **Step 8: 용어 회귀 스캔**
Run: `cd frontend && grep -rn "접수중\|진행중" pages/subscription pages/public-rental/announcements components/subscription | grep -v "접수예정\|진행중 청약\|\.test\."`
Expected: 상태 라벨로서의 "접수중"/"진행중"이 남아있지 않음(마케팅 산문 제외). 남은 게 있으면 의도 확인 후 처리.

- [ ] **Step 9: lint + 커밋**
Run: `cd frontend && npx eslint components/subscription/SubscriptionCard.vue components/subscription/SubscriptionListView.vue "pages/subscription/[id].vue" components/subscription/HomeSubscriptionSection.vue pages/public-rental/announcements/index.vue "pages/public-rental/announcements/[pblancId].vue" pages/public-rental/index.vue`
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/subscription/SubscriptionCard.vue frontend/components/subscription/SubscriptionListView.vue "frontend/pages/subscription/[id].vue" frontend/components/subscription/HomeSubscriptionSection.vue frontend/tests/components/subscription/HomeSubscriptionSection.test.ts frontend/pages/public-rental/announcements/index.vue "frontend/pages/public-rental/announcements/[pblancId].vue" frontend/pages/public-rental/index.vue frontend/tests/pages/lhRentalHub.test.ts
git commit -m "refactor(frontend): 청약/공공임대 상태·허브 용어 통일(청약중·모집중·청약 정보)"
```

---

## Task E: 전체 검증 + PR

- [ ] **Step 1: 전체 테스트**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test 2>&1 | tail -12`
Expected: 전체 PASS. 실패 시 해당 테스트가 변경 문자열을 단언하는지 확인해 갱신(예상 외 실패는 원인 분석).

- [ ] **Step 2: lint 전체**
Run: `cd frontend && npm run lint 2>&1 | tail -8`
Expected: 0 error.

- [ ] **Step 3: build**
Run: `cd frontend && npm run build 2>&1 | tail -8`
Expected: exit 0. (주의: 사용자 `nuxt dev`가 떠 있으면 빌드가 `.nuxt`를 덮어써 dev가 깨질 수 있음 — 사용자에게 알릴 것.)

- [ ] **Step 4: PR**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git push -u origin feat/frontend-hygiene-cleanup
gh pr create --base develop --title "위생 정리 ⑥: 죽은 코드·빠른찾기 16종·용어 통일" --body "audit ⑥ 위생 묶음. A)죽은 import·도달불가 폴백·미연결 pending 제거 B)홈 빠른찾기 전 시설 16종 + 📅→material-symbols + 광고 path watch C)지도 마커 placeholder 주석 D)청약/공공임대 상태·허브 용어 통일(청약중·모집중·청약 정보). 동작·배치·노출 불변, 광고 과호출만 제거."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** A(죽은 코드 4건)=Task A. B(이모지/광고/빠른찾기)=Task B. C(주석 2건)=Task C. D(용어 3종)=Task D. 검증=Task E. 모든 spec 항목 매핑됨.
- **Placeholder scan:** 모든 코드 단계 실제 코드. "grep으로 정확 줄 확인" 지시는 줄번호 드리프트 대비(정당). AdBanner 테스트 미추가는 비반응형 mock 근거를 명시(placeholder 아님).
- **Type consistency:** quickFacilities 항목 `{id,label}` 일관, id는 유효 `CategoryId`. 용어 라벨 함수 시그니처 불변(반환 문자열만 교체). 브레드크럼 `{label/name, href/url}` 형태 유지.
- **범위 외 명시:** `index.vue:78 "진행중 청약"`(집계 stat), 마케팅 산문, AppHeader 그룹명, 광고 배치/개수 — 모두 변경 금지로 명시.
