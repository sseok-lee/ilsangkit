# CTA 개선 Phase 1+2 (퀵윈 + 빈결과/오류 복구) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ayo/114 대비 CTA 감사에서 도출된 "결정 불필요한 결함"을 일관성 있게 보강한다 — 행동 CTA(tel·외부링크·교차링크) 누락 보완(Phase 1)과 빈결과/오류 상태의 복구 CTA 표준화(Phase 2).

**Architecture:** 신규 추상화 없음. 기존 패턴 재사용 — 행동 CTA는 `FacilityCard.vue` 학교 tel 패턴 / `subscription/[id].vue` 외부 CTA 패턴, 빈/오류는 **이미 존재하는 `components/common/EmptyState.vue`(icon/title/description + CTA slot)** 와 `pages/[category]/index.vue:179-203`의 베스트 패턴, 오류 retry는 `RegionFacilitiesGrid.vue:16-24`·`SubscriptionListView.vue:38-52` 패턴으로 통일. 공통 `Pagination.vue`로 자체 페이지네이션 2곳을 흡수.

**Tech Stack:** Nuxt 3 SSR · Vue 3 `<script setup>` · TypeScript · TailwindCSS · Vitest(happy-dom). **Node 20 필수**(`source ~/.nvm/nvm.sh && nvm use 20`).

## Global Constraints

- **광고(AdBanner/CoupangBanner) 배치·개수 불변** — 이 플랜은 광고를 추가·이동·축소하지 않는다.
- **단일 h1 불변, SSR 안전**(브라우저 API는 클라이언트 가드), order 클래스 기존 값 보존.
- **터치타깃 44px**(`min-h-[44px]`/`min-w-[44px]`)을 신규/수정 인터랙티브 요소에 적용.
- **HardLink/NuxtLink 컨벤션**: 카드·MPA 진입은 기존 파일의 링크 컴포넌트 관례를 따른다(새 컨벤션 도입 금지).
- 커밋 전 **Node 20에서 해당 테스트 + lint** 통과. 기존 실패 테스트도 즉시 수정.
- 모든 변경은 **PR 경유, CI green 후 머지**. Phase 1 = 1 PR, Phase 2 = 1 PR(분리).
- geolocation·홈 전환 CTA·모바일 하단탭바는 **범위 밖**(보류).

---

# Phase 1 — 퀵윈 (행동 CTA 보강 + 일관성)

### Task 1: 병원/약국 카드 tel: 링크 + 공모공고 문의처 tel:

**Files:**
- Modify: `frontend/components/facility/FacilityCard.vue:90`
- Modify: `frontend/pages/public-rental/announcements/[pblancId].vue:47-50`
- Test: `frontend/tests/components/facility/FacilityCard.test.ts`(있으면 확장, 없으면 생성)

**Interfaces:**
- Consumes: `facility.extras.phone`(hospital/pharmacy, `types/facility.ts:266`), `detail.refrnc`(공모공고)
- Produces: 없음(템플릿 변경)

- [ ] **Step 1: 실패 테스트** — hospital 카드에서 phone이 `<a href="tel:...">`로 렌더되는지.
```ts
it('병원 카드의 전화번호는 tel: 링크다', () => {
  const wrapper = mount(FacilityCard, { props: { facility: hospitalWithPhone }, global })
  const tel = wrapper.find('a[href^="tel:"]')
  expect(tel.exists()).toBe(true)
  expect(tel.attributes('href')).toBe('tel:02-123-4567')
})
```
- [ ] **Step 2: FAIL 확인** — `npx vitest run tests/components/facility/FacilityCard.test.ts`
- [ ] **Step 3: 구현** — `FacilityCard.vue:90` 의 `<span v-if="facility.extras.phone">{{ phone }}</span>` 를 학교 패턴(`:114`)과 동일한 tel 링크로 교체:
```html
<a v-if="facility.extras.phone"
   :href="`tel:${facility.extras.phone}`"
   class="inline-flex items-center min-h-[44px] px-3 py-2 rounded-md text-xs font-medium bg-slate-100 text-slate-600 hover:underline"
   @click.stop>{{ facility.extras.phone }}</a>
```
  그리고 `announcements/[pblancId].vue:47-50` 의 `<dd>` 내부를 tel 링크로:
```html
<dd class="text-ink"><a :href="`tel:${detail.refrnc}`" class="hover:underline">{{ detail.refrnc }}</a></dd>
```
  ※ `refrnc`가 복수번호("02-xxx / 1588-xxx") 가능 — 우선 전체 문자열을 그대로 `tel:`에 넣되, 공백/슬래시 포함 시 첫 번째 토큰만 추출(`detail.refrnc.split(/[\/,]/)[0].trim()`)해 href에 사용, 표시는 원문 유지.
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: 커밋** — `feat(cta): 병원·약국 카드 + 공모공고 문의처 전화 tel: 링크`

---

### Task 2: 공매 온비드 외부 CTA + 시설→부동산 교차 pill

**Files:**
- Modify: `frontend/pages/auction/item/[cltrMngNo].vue`(AdBanner 직전, `order-9`)
- Modify: `frontend/components/facility/detail/DetailContextLinks.vue`
- Test: `frontend/tests/pages/auction/auctionItemDetail.test.ts`, `frontend/tests/pages/category-cross-links.test.ts`

**Interfaces:**
- Consumes: `item.cltrMngNo`(`types/auction.ts:6`), `regionLink: { href, cityHref, ... }`(DetailContextLinks prop)
- Produces: 없음

- [ ] **Step 1: 실패 테스트** — 공매 상세에 온비드 외부 링크가 있는지 + 시설 상세 DetailContextLinks에 `/real-estate/...` 링크가 있는지.
```ts
// auction
expect(wrapper.find('a[href*="onbid.co.kr"]').exists()).toBe(true)
// cross-link: regionLink.href = /seoul/gangnam-gu/hospital → 부동산 링크는 /real-estate/seoul/gangnam-gu
expect(wrapper.find('a[href="/real-estate/seoul/gangnam-gu"]').exists()).toBe(true)
```
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현**
  - 공매: `[cltrMngNo].vue`의 `<AdBanner />`(CoupangBanner 위) **직전**에 추가:
```html
<div class="order-9">
  <a :href="`https://www.onbid.co.kr/op/cta/cltrMgNo/ctaCltrMgNoInfo.do?cltrMgNo=${item.cltrMngNo}`"
     target="_blank" rel="noopener noreferrer"
     class="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm">
    <span class="material-symbols-outlined text-[20px]">gavel</span>
    온비드에서 입찰하기
  </a>
</div>
```
  - 교차 pill: `DetailContextLinks.vue`의 `related-categories` nav(`:38-48`) 아래에, `regionLink`에서 부동산 허브 경로를 구성해 추가. `regionLink.href`(`/{city}/{district}/{category}`)에서 앞 2세그먼트를 취해 `/real-estate/{city}/{district}`:
```html
<NuxtLink v-if="regionLink"
  :to="`/real-estate/${regionLink.href.split('/').slice(1,3).join('/')}`"
  class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-full text-sm font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors">
  <span class="material-symbols-outlined text-[16px]">apartment</span>
  이 지역 부동산 시세
</NuxtLink>
```
  ※ `regionLink.href`가 city/district를 슬러그로 담고 있음을 `[category]/[id].vue:552-571`에서 확인. 부동산 지역목록 URL은 `/real-estate/{citySlug}/{districtSlug}`(부동산 라우트 컨벤션 확인 필수 — 없으면 `/real-estate/apt-sale/{city}/{district}`로 조정).
- [ ] **Step 4: PASS 확인** — 부동산 교차 URL이 실제 라우트(404 아님)인지 `server/middleware`/페이지 매칭으로 검증.
- [ ] **Step 5: 커밋** — `feat(cta): 공매 온비드 입찰 외부 CTA + 시설→부동산 교차 링크`

---

### Task 3: "생활시설" 라벨 통일

**Files:**
- Modify: `frontend/components/common/AppHeader.vue:101-116`(또는 navigation/AppHeader), `frontend/components/common/AppFooter.vue:23`, `frontend/pages/index.vue:105-111`

**Interfaces:** Consumes: 없음 / Produces: 없음(텍스트)

- [ ] **Step 1: 결정 확인** — 표준 라벨을 **"생활시설"**로 통일(헤더 기준). 푸터 "시설 찾기"→"생활시설", 홈 "빠른 생활시설 찾기"는 유지(헤딩 맥락상 자연스러움) 또는 "생활시설 바로찾기"로 정렬. 최소 변경: 푸터만 "생활시설"로.
- [ ] **Step 2: 구현** — `AppFooter.vue:23` 텍스트 `시설 찾기` → `생활시설`(링크 `/search` 유지).
- [ ] **Step 3: 테스트** — 푸터 테스트 있으면 텍스트 어서션 갱신, 없으면 스킵.
- [ ] **Step 4: lint** — `npm run lint`
- [ ] **Step 5: 커밋** — `refactor(cta): 시설 진입 라벨 "생활시설"로 통일`

---

### Task 4: 자체 페이지네이션 → 공통 Pagination.vue 흡수

**Files:**
- Modify: `frontend/components/region/RegionFacilitiesGrid.vue:41-57`, `frontend/pages/guide/index.vue:105-118`
- Test: `frontend/tests/components/region/*`, `frontend/tests/pages/guide*`(있으면)

**Interfaces:**
- Consumes: `Pagination.vue` props `{ currentPage, totalPages }`, emit `pageChange: [page]`
- Produces: 없음

- [ ] **Step 1: 실패 테스트** — 페이지네이션 버튼에 `aria-label`이 있는지.
```ts
expect(wrapper.find('[aria-label="이전 페이지"]').exists()).toBe(true)
```
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현** — 두 곳의 자체 `<div>...이전/다음...</div>` 블록을 `<Pagination :current-page="currentPage" :total-pages="totalPages" @page-change="goToPage" />`로 교체.
  - `RegionFacilitiesGrid`: 기존 `emit('page-change', n)` 호출부를 Pagination의 `@page-change`로 연결(부모 emit 이름 `page-change` 유지하려면 핸들러에서 재emit).
  - `guide/index.vue`: `goToPage` 그대로 연결.
- [ ] **Step 4: PASS 확인** — aria + 44px(`min-w-[44px]`) 자동 확보.
- [ ] **Step 5: 커밋** — `refactor(cta): 자체 페이지네이션 2곳을 공통 Pagination(aria+44px)으로 교체`

---

### Task 5: 터치타깃(TxnTypeMiniTabs) + 공유 alert 일관성

**Files:**
- Modify: `frontend/components/home/hotspot/TxnTypeMiniTabs.vue:3-11`
- Modify: `frontend/pages/real-estate/land/[city]/[district]/[dong].vue:333-341`(피드백 부재), 참조: `[buildingName].vue:699`·`auction/item/[cltrMngNo].vue:92`(alert)

**Interfaces:** 없음

- [ ] **Step 1: 구현(터치타깃)** — `TxnTypeMiniTabs` 버튼 클래스 `px-2 py-0.5` → `px-3 min-h-[44px]`(또는 `py-2.5`). 시각 밀도 유지 위해 폰트/패딩 미세조정 허용.
- [ ] **Step 2: 구현(공유 피드백 일관성)** — `[dong].vue`의 clipboard 복사 후 피드백 부재를 다른 두 곳과 일치시킨다. 최소 변경: clipboard 성공 시 `alert('링크가 복사되었습니다.')` 추가(기존 패턴과 동일). ※ 토스트 컴포넌트가 코드에 있으면 세 곳 모두 토스트로 통일(선호) — 없으면 alert 정렬.
- [ ] **Step 3: 테스트/lint** — TxnTypeMiniTabs 테스트 있으면 클래스 어서션, 없으면 lint만.
- [ ] **Step 4: 커밋** — `fix(cta): TxnTypeMiniTabs 44px 터치타깃 + 토지 공유 피드백 정렬`

---

# Phase 2 — 빈결과/오류 복구 CTA 표준화

**공통 재사용**: `components/common/EmptyState.vue`(icon/title/description + slot) + CTA slot 표준(`[category]/index.vue:179-203`) + 오류 retry 표준(`SubscriptionListView.vue:38-52`).

### Task 6: 공매 빈결과 3종 → EmptyState + 상위 허브 CTA

**Files:**
- Modify: `frontend/pages/auction/list.vue:34-37`, `frontend/pages/auction/ranking.vue:35-37`, `frontend/pages/auction/[city]/index.vue:30-33`
- Test: `frontend/tests/pages/auction/*`(있으면)

- [ ] **Step 1: 실패 테스트** — 공매 목록 빈결과에 "필터 초기화" 또는 "전체 공매 보기"(`/auction`) 링크가 있는지.
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현** — 3곳의 인라인 텍스트 빈결과를 `<EmptyState>`로 교체 + slot CTA:
  - `auction/list.vue`: 필터(`usage/status/city/district`가 비어있지 않으면) "필터 초기화"(`router.push({ query: {} })`) + "전체 공매 보기"(`/auction`).
  - `auction/ranking.vue`: "전체 공매 보기"(`/auction`).
  - `auction/[city]/index.vue`: "전국 공매 허브로"(`/auction`).
```html
<EmptyState icon="gavel" title="조회된 공매 물건이 없습니다" description="필터를 변경하거나 전체 목록을 확인해 보세요.">
  <div class="flex items-center justify-center gap-3">
    <button v-if="hasActiveFilter" @click="resetFilters" class="...">필터 초기화</button>
    <NuxtLink to="/auction" class="btn-primary ...">전체 공매 보기</NuxtLink>
  </div>
</EmptyState>
```
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: 커밋** — `feat(cta): 공매 빈결과 3종에 필터초기화·허브 복귀 CTA`

---

### Task 7: 청약·공공임대 ListView 빈결과 → 필터초기화 + 허브 CTA

**Files:**
- Modify: `frontend/components/subscription/SubscriptionListView.vue:55-61`, `frontend/components/subscription/PublicRentalListView.vue:30-33`
- Test: 해당 컴포넌트 테스트(있으면)

- [ ] **Step 1: 실패 테스트** — 빈결과에 "필터 초기화" 버튼 존재.
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현** — 두 ListView 빈결과를 `<EmptyState>` slot CTA로:
  - Subscription: 필터(`currentStatus/selectedRegion/selectedDistrict`) 초기화 → `loadSubscriptions()`.
  - PublicRental: 필터(`currentCity/selectedDistrict`) 초기화 → `reload()`. (오류 상태 retry 아이콘/스타일도 `SubscriptionListView`와 일치시킴.)
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: 커밋** — `feat(cta): 청약·공공임대 빈결과에 필터 초기화 CTA + 오류 스타일 통일`

---

### Task 8: 공모공고 목록 빈결과 + 오류 retry

**Files:**
- Modify: `frontend/pages/public-rental/announcements/index.vue:52-55`

- [ ] **Step 1: 실패 테스트** — 오류 상태에 "다시 시도" 버튼 존재.
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현** — 빈결과(`:53-55`)를 `<EmptyState>` + "전체 공고 보기"(필터 `status/q/page` 초기화 → `reload()`)로, 오류(`:52`)를 retry 버튼 패턴(`reload()`)으로 교체.
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: 커밋** — `feat(cta): 공모공고 목록 빈결과 CTA + 오류 재시도`

---

### Task 9: 지역허브 2종 오류 retry + 복귀 링크

**Files:**
- Modify: `frontend/pages/[city]/index.vue:90-93`, `frontend/pages/[city]/[district]/index.vue:54-56`
- Test: `frontend/tests/pages/*`(지역허브, 있으면)

**Interfaces:** Consumes: `useAsyncData`의 `refresh`(또는 `router.go(0)`)

- [ ] **Step 1: 실패 테스트** — 오류 상태에 "다시 시도" 버튼.
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현** — `UI_MESSAGES.fetchError` 단순 텍스트 분기를 retry 패턴으로 교체. `useAsyncData` 결과의 `refresh()`를 버튼에 연결(없으면 `router.go(0)`), 보조로 시/도 허브(`/{city}`)·홈 복귀 링크.
```html
<div v-else class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
  <p class="text-red-800">{{ UI_MESSAGES.fetchError }}</p>
  <div class="mt-4 flex items-center justify-center gap-2">
    <button @click="refresh()" class="px-4 py-2 bg-red-600 text-white rounded-lg ...">다시 시도</button>
    <NuxtLink to="/" class="px-4 py-2 bg-white border ...">홈으로</NuxtLink>
  </div>
</div>
```
  ※ 지역허브는 SSR 풀고갈→noindex 회귀 이력(프로젝트 메모리) — 오류 시 fail-open 렌더가 noindex 유발하지 않도록, 오류 분기가 200+빈페이지를 SSR하지 않는지 확인(가능하면 클라이언트 전용 retry).
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: 커밋** — `feat(cta): 지역허브 오류 상태 재시도 + 복귀 CTA`

---

### Task 10: 공통 빈결과 정리 (FacilityList·RegionFacilitiesGrid·부동산허브·trash 중복)

**Files:**
- Modify: `frontend/components/facility/FacilityList.vue:21-30`, `frontend/components/region/RegionFacilitiesGrid.vue:28-30`, `frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue:76-91`, `frontend/pages/[category]/index.vue:130-153`(trash 분기)

- [ ] **Step 1: 실패 테스트** — FacilityList 빈결과에 CTA 또는 emit 경로 존재 / trash 빈결과가 EmptyState 컴포넌트 사용.
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현**
  - `FacilityList.vue`: 이모지 빈결과(`:21-30`)를 `<EmptyState>`로 교체 + 필터초기화 emit(`@reset`) 노출(부모가 처리).
  - `RegionFacilitiesGrid.vue:28-30`: 빈결과를 `<EmptyState>` + "전국으로"(필터 해제) CTA로.
  - 부동산 지역허브(`:76-91`): 이미 CTA 있음 — 인라인을 `<EmptyState>` 컴포넌트로 감싸 시각 일관화(CTA 2개 유지).
  - `[category]/index.vue` trash 분기(`:130-153`): non-trash(`:179-203`)와 중복된 인라인 빈결과를 `<EmptyState>`로 통일(DRY).
- [ ] **Step 4: PASS 확인** — 전체 영향 테스트 그린.
- [ ] **Step 5: 커밋** — `refactor(cta): 빈결과 4종을 공통 EmptyState로 통일 + 복구 CTA`

---

## Self-Review 체크
- **Spec coverage**: Phase 1(tel·외부·교차·라벨·페이지네이션·터치/alert) 7항목 → T1~T5 / Phase 2(공매·청약·임대·공고·지역허브·공통) → T6~T10. 감사 [High]빈결과복구·[Med]퀵윈 전부 매핑.
- **범위 밖 확인**: 홈 전환 CTA(Phase 3)·geolocation·하단탭바 미포함 — 의도적.
- **타입 일관성**: `EmptyState` props(icon/title/description+slot)·`Pagination` emit(`pageChange`) 전 태스크 동일 사용.
- **검증 주의**: T2 부동산 교차 URL은 실제 라우트 매칭 확인 필수(404 방지) · T9 오류 SSR이 noindex 유발 안 하도록.
