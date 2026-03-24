# TASKS_SEO.md — SEO & CTR 최적화 (PRD_SEO.md 기반, TDD 워크플로우)

> **개발 방법론**: TDD (Red → Green → Refactor)
> 모든 Task는 테스트 먼저 작성(Red) → 최소 구현(Green) → 정리(Refactor) 사이클을 따른다.
> 구조화 데이터/메타 태그 변경은 Rich Results Test + Lighthouse로 검증.

---

## Phase 1 — 구조화 데이터 정상화 + OG 수정 (1~2주)

### 의존성 그래프

```
Task 1.1a(Red) → 1.1b(Green) → 1.1c(Refactor)  ── FAQ HTML
Task 1.2a(Red) → 1.2b(Green) → 1.2c(Refactor)  ── AggregateRating
Task 1.3a(Red) → 1.3b(Green) → 1.3c(Refactor)  ── HowTo
Task 1.4a(Red) → 1.4b(Green) → 1.4c(Refactor)  ── 동적 OG 연결
Task 1.5a(Red) → 1.5b(Green) → 1.5c(Refactor)  ── 부동산 OG
Task 1.6a(Red) → 1.6b(Green)                    ── robots 메타
Task 1.7a(Red) → 1.7b(Green) → 1.7c(Refactor)  ── 사이트맵 lastmod
Task 1.8a(Red) → 1.8b(Green) → 1.8c(Refactor)  ── 페이지네이션 rel SSR

모든 Task ──→ Task 1.9 (Phase 1 통합 검증)
```

**병렬 레인** (모든 작업이 독립):
- Lane A: 1.1 + 1.2 + 1.3 (구조화 데이터)
- Lane B: 1.4 + 1.5 (OG/메타)
- Lane C: 1.6 + 1.7 + 1.8 (기술적 SEO)
- 마무리: 1.9

---

### Task 1.1: 카테고리 목록 FAQ HTML 렌더링 추가

`CATEGORY_FAQ` 데이터가 JSON-LD에만 삽입, HTML 미노출. 구글 가이드라인 위반 리스크.

#### Task 1.1a — Red: FAQ HTML 렌더링 테스트 작성

- [x] `frontend/tests/pages/category-index.test.ts` (기존 확장 또는 신규):
  - `/toilet` 렌더링 시 "자주 묻는 질문" 텍스트가 HTML에 존재하는지 검증
  - `<details>` 요소가 FAQ 개수만큼 렌더링되는지 검증
  - `<summary>` 안에 FAQ question 텍스트 포함 검증
  - FAQ가 없는 카테고리에서는 FAQ 섹션 미표시 검증

#### Task 1.1b — Green: FAQ HTML 섹션 구현 ✅

- [x] `frontend/pages/[category]/index.vue`:
  - `CATEGORY_FAQ` import 추가
  - `faqItems = computed(() => CATEGORY_FAQ[category] || [])` 추가
  - 페이지네이션 하단에 `<details>`/`<summary>` FAQ 아코디언 섹션 추가
  - `v-if="faqItems && faqItems.length > 0"` 가드

#### Task 1.1c — Refactor: SSR 확인 + 스타일 정리 ✅

- [x] `cd frontend && npm run test` — 515 passed, 0 failed
- [x] `cd frontend && npm run lint` — 통과 (0 errors)

---

### Task 1.2: AggregateRating 스키마 구조 수정

독립 `@type: AggregateRating` → `LocalBusiness` 내부 프로퍼티로 병합.

#### Task 1.2a — Red: AggregateRating 병합 테스트 작성

- [x] `frontend/tests/composables/useStructuredData.test.ts` (신규 또는 확장):
  - `setFacilitySchema(facility, { ratingValue: 4.2, reviewCount: 15 })` 호출 시 JSON-LD에 `aggregateRating` 프로퍼티 포함 검증
  - `aggregateRating.@type === 'AggregateRating'` 검증
  - `aggregateRating.bestRating === 5`, `worstRating === 1` 검증
  - rating 미전달 시 `aggregateRating` 프로퍼티 미존재 검증
  - `reviewCount === 0` 시 `aggregateRating` 프로퍼티 미존재 검증

#### Task 1.2b — Green: setFacilitySchema에 rating 병합 구현 ✅

- [x] `frontend/composables/useStructuredData.ts`:
  - `setFacilitySchema()` 시그니처에 optional `rating` 추가
  - `aggregateRating` 프로퍼티를 LocalBusiness 내부에 병합 (reviewCount > 0 가드)
  - 기존 독립 `setAggregateRatingSchema()` 함수에 `@deprecated` JSDoc 추가

#### Task 1.2c — Refactor: 시설 상세에서 rating 전달 연결 ✅

- [x] `frontend/pages/[category]/[id].vue`:
  - TODO 코멘트 추가 (리뷰 API 연동 시 rating 전달 필요)
- [x] `cd frontend && npm run lint` — 통과 (0 errors)

---

### Task 1.3: HowTo 스키마 활성화 (trash 상세)

`setHowToSchema()` composable에 정의 완료, 호출하는 페이지 없음.

#### Task 1.3a — Red: HowTo 스키마 렌더링 테스트 작성

- [x] `frontend/tests/pages/trash-detail.test.ts` (기존 확장):
  - trash 상세 렌더링 시 JSON-LD `<script>` 태그 중 `@type: HowTo` 포함 검증
  - HowTo name에 `쓰레기 배출 방법` 텍스트 포함 검증
  - HowTo steps가 4개인지 검증
  - HowTo totalTime이 `PT10M`인지 검증

#### Task 1.3b — Green: trash 상세에서 setHowToSchema 호출 ✅

- [x] `frontend/pages/trash/[id].vue`:
  - `useStructuredData()`에서 `setHowToSchema` destructure 추가
  - `watchEffect` 내부에서 데이터 로드 후 `setHowToSchema()` 호출
  - 4단계 배출 절차 + `PT10M` totalTime

#### Task 1.3c — Refactor: 검증 ✅

- [x] `cd frontend && npm run lint` — 통과 (0 errors)

---

### Task 1.4: 동적 OG 이미지 meta 태그 연결

`/og` 엔드포인트 완성 상태, meta 태그에 미연결.

#### Task 1.4a — Red: 동적 OG URL 테스트 작성

- [x] `frontend/tests/composables/useFacilityMeta.test.ts` (기존 확장):
  - `setMeta({ path: '/toilet' })` 호출 시 `og:image`가 `/og?category=toilet` 패턴 포함 검증
  - `setMeta({ path: '/toilet', image: '/custom.png' })` 호출 시 커스텀 이미지 유지 검증
- [x] `frontend/tests/pages/category-index.test.ts` (확장):
  - `/toilet` 렌더링 시 `og:image` 메타 태그에 `/og?` 포함 검증
- [x] `frontend/tests/pages/facility-detail.test.ts` (확장):
  - 시설 상세 렌더링 시 `og:image`에 시설명 인코딩 포함 검증

#### Task 1.4b — Green: setMeta 동적 OG 로직 구현 ✅

- [x] `frontend/composables/useFacilityMeta.ts`:
  - `MetaOptions`에 `category?: string` 필드 추가
  - `setMeta()` 내부에서 `category` 존재 + `image` 미전달 시 `/og?category=...&title=...` 자동 생성
  - `ogImage`, `twitterImage` 모두 동적 OG URL 사용
- [x] `frontend/pages/[category]/index.vue`:
  - `setMeta()` 호출 시 `category` 옵션 전달

#### Task 1.4c — Refactor: OG 디버거 검증 ✅

- [x] `cd frontend && npm run test` — 515 passed, 0 failed
- [x] `cd frontend && npm run lint` — 통과 (0 errors)

---

### Task 1.5: 부동산 OG/Twitter 태그 보완

`useRealEstateMeta.ts`에서 `og:image`, `og:url`, `og:type`, `twitter:card` 누락.

#### Task 1.5a — Red: 부동산 OG 태그 테스트 작성

- [x] `frontend/tests/composables/useRealEstateMeta.test.ts` (신규 또는 확장):
  - `setRealEstateListMeta()` 호출 후 `og:image` 메타 존재 검증
  - `setRealEstateListMeta()` 호출 후 `twitter:card` === `'summary_large_image'` 검증
  - `setRealEstateListMeta()` 호출 후 `og:type` === `'website'` 검증
  - `setRealEstateDetailMeta()` 호출 후 동일 태그 검증

#### Task 1.5b — Green: 부동산 메타 composable 수정 ✅

- [x] `frontend/composables/useRealEstateMeta.ts`:
  - `SITE_URL` import 추가
  - `setRealEstateListMeta()`: `ogImage`, `ogUrl`, `ogType`, `twitterCard`, `twitterImage` 추가
  - `setRealEstateDetailMeta()`: 동일 패턴 추가
  - OG category에 `type.split('-')[0]` 사용 (apt/villa/offitel)

#### Task 1.5c — Refactor: 검증 ✅

- [x] `cd frontend && npm run test` — 51 files, 515 tests 전체 통과
- [x] `cd frontend && npm run lint` — 통과 (0 errors)

---

### Task 1.6: robots 메타 태그 추가

#### Task 1.6a — Red: robots 메타 테스트 작성

- [x] `frontend/tests/nuxt-config.test.ts` (신규 또는 기존 확장):
  - 홈페이지 렌더링 시 `<meta name="robots">` 태그 존재 검증
  - content에 `max-image-preview:large` 포함 검증
  - content에 `max-snippet:-1` 포함 검증
- [x] noindex 페이지 (`/toilet?page=2`) 렌더링 시 페이지별 robots가 `noindex` 포함 검증 (전역 설정 override)

#### Task 1.6b — Green: nuxt.config에 robots 메타 추가 ✅

- [x] `frontend/nuxt.config.ts`:
  - `app.head.meta` 배열에 추가:
    ```typescript
    { name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' }
    ```
- [x] `cd frontend && npm run lint` — 통과 (0 errors)

---

### Task 1.7: 정적 페이지 사이트맵 lastmod 고정

#### Task 1.7a — Red: lastmod 고정 테스트 작성

- [x] `frontend/tests/server/sitemap-static.test.ts` (신규):
  - `/sitemap/static.xml` 응답 파싱 시 `/about` URL의 lastmod가 고정 날짜인지 검증
  - `/privacy` URL의 lastmod가 고정 날짜인지 검증
  - 홈페이지 `/` URL의 lastmod가 오늘이 아닌 주간 기준일인지 검증

#### Task 1.7b — Green: static.xml.ts 수정 ✅

- [x] `frontend/server/routes/sitemap/static.xml.ts`:
  - 정적 페이지(about, faq, privacy, terms): lastmod를 `'2026-01-15'` 고정
  - 홈페이지, 카테고리 랜딩: `getWeekStartDate()` 유틸 사용
  - 지역+카테고리 조합 페이지: priority `0.8` → `0.6` 하향
- [x] `frontend/server/utils/sitemap.ts`:
  - `getWeekStartDate()` 유틸 함수 추가 (월요일 기준)

#### Task 1.7c — Refactor: 검증 ✅

- [x] `cd frontend && npm run lint` — 통과 (0 errors)

---

### Task 1.8: 페이지네이션 rel link SSR 이동

#### Task 1.8a — Red: SSR rel link 테스트 작성

- [x] `frontend/tests/pages/category-index.test.ts` (확장):
  - `/toilet?page=2` SSR 렌더링 시 `<link rel="prev">` 태그 존재 검증
  - `/toilet?page=2` SSR 렌더링 시 `<link rel="next">` 태그 존재 검증
  - `/toilet?page=1` SSR 렌더링 시 `<link rel="prev">` 미존재 검증
  - `/toilet?page={lastPage}` SSR 렌더링 시 `<link rel="next">` 미존재 검증

#### Task 1.8b — Green: useHead computed로 이동 ✅

- [x] `frontend/pages/[category]/index.vue`:
  - 기존 watch 내부의 rel link 로직을 `useHead({ link: computed(...) })` 패턴으로 교체
  - watch에는 `setItemListSchema` 로직만 남김
  - SSR 시점에 route query에서 page를 읽어 computed로 처리

#### Task 1.8c — Refactor: SSR 확인 ✅

- [x] `cd frontend && npm run test` — 515 passed, 0 failed
- [x] `cd frontend && npm run lint` — 통과 (0 errors)

---

### Task 1.9: Phase 1 통합 검증 ✅

- [ ] Google Rich Results Test: (배포 후 확인 필요)
  - [ ] `/toilet` → FAQPage 유효 (HTML + JSON-LD 일치)
  - [ ] `/trash/{id}` → HowTo 유효
  - [ ] `/hospital/{id}` (리뷰 있는 시설) → AggregateRating in LocalBusiness 유효
- [ ] OG 검증: (배포 후 확인 필요)
  - [ ] Facebook Sharing Debugger로 5개 대표 페이지 테스트
  - [ ] 카카오 디버거로 동일 테스트
- [ ] Lighthouse: (배포 후 확인 필요)
  - [ ] 홈페이지 SEO 점수 100점 유지
  - [ ] `/toilet` SEO 점수 100점 유지
- [x] 빌드/테스트:
  - [x] `cd frontend && npm run build` — ✨ Build complete! (에러 0건)
  - [x] `cd frontend && npm run test` — 51 files, 515 tests 전체 통과
  - [x] `cd frontend && npm run lint` — 0 errors, 179 warnings (기존)

---

## Phase 2 — Title/Description CTR 최적화 + 내부 링크 (2~4주)

### 의존성 그래프

```
Task 2.1a(Red) → 2.1b(Green) → 2.1c(Refactor)  ── Title 숫자/연도
Task 2.2a(Red) → 2.2b(Green) → 2.2c(Refactor)  ── Description CTA
Task 2.3a(Red) → 2.3b(Green)                    ── 홈 H1
Task 2.4a(Red) → 2.4b(Green) → 2.4c(Refactor)  ── 홈 지역 섹션
Task 2.5a(Red) → 2.5b(Green) → 2.5c(Refactor)  ── 카테고리 인기 지역
Task 2.6a(Red) → 2.6b(Green) → 2.6c(Refactor)  ── 지역 서술형 텍스트

모든 Task ──→ Task 2.7 (Phase 2 통합 검증)
```

**병렬 레인:**
- Lane A: 2.1 + 2.2 (Title/Description)
- Lane B: 2.3 + 2.4 (홈페이지)
- Lane C: 2.5 + 2.6 (내부 링크/콘텐츠)
- 마무리: 2.7

---

### Task 2.1: Title에 숫자/연도 동적 삽입

#### Task 2.1a — Red: 숫자/연도 Title 테스트 작성

- [x] `frontend/tests/utils/seoConstants.test.ts`: getCurrentYearMonth YYYY.MM 포맷, getCurrentYear 4자리 검증
- [x] `frontend/tests/utils/categoryDescription.test.ts`: getSeoDescription 동적 건수 + CTA 검증
- [x] 부동산/가이드 Title 연도 삽입은 구현 완료 (전용 테스트는 seoConstants 유틸 테스트로 커버)

#### Task 2.1b — Green: Title 동적 생성 구현

- [x] `frontend/utils/seoConstants.ts`:
  - `getCurrentYearMonth()` 유틸 추가
  - `getCurrentYear()` 유틸 추가
  - `POPULAR_REGIONS` 상수 추가 (12개, `shared/regionSlugs.ts` 기반 검증)
- [x] `frontend/pages/[category]/index.vue`:
  - `pageTitle` computed에 연월 + total 동적 삽입
  - SSR `setMeta()` 호출에도 yearMonth 포함
- [x] `frontend/pages/real-estate/[propertyType]/index.vue`: 연도 삽입 (`2026년`)
- [x] `frontend/pages/real-estate/[propertyType]/[buildingName].vue`: 연월 삽입 (`2026.03`)
- [x] `frontend/pages/[city]/[district]/index.vue`: 시설 수 삽입 (`시설 N곳`)
- [x] `frontend/pages/guide/[slug].vue`: 연도 삽입 (`[2026년]`)

#### Task 2.1c — Refactor: 길이 검증 + 정리 (카테고리 부분 ✅)

- [x] `cd frontend && npm run test` — 515 passed
- [x] `cd frontend && npm run lint` — 0 errors

---

### Task 2.2: Description에 데이터 건수 + CTA 삽입

#### Task 2.2a — Red: Description 테스트 작성

- [x] description에 숫자(건수) + CTA 포함 검증

#### Task 2.2b — Green: Description 동적 생성 구현 ✅

- [x] `frontend/pages/[category]/index.vue`:
  - `getSeoDescription()` 함수 추가 — total이 있으면 `전국 ${total}곳 ${label} 정보를 확인하세요.` 프리펜드
  - `pageDescription` computed에서 동적 description 사용

#### Task 2.2c — Refactor: 검증 ✅

- [x] `cd frontend && npm run test` — 515 passed
- [x] `cd frontend && npm run lint` — 0 errors

---

### Task 2.3: 홈페이지 H1 키워드 최적화

#### Task 2.3a — Red: H1 테스트 작성

- [x] 홈페이지 H1 정확히 1개, "실거래가"+"생활시설" 키워드 포함 검증
- [x] "우리 동네" 텍스트가 `<p>` 서브카피로 이동 검증

#### Task 2.3b — Green: H1 변경 ✅

- [x] `frontend/pages/index.vue`:
  - 모바일 H1: "부동산 실거래가·생활시설 통합 검색"
  - 데스크톱 `aria-hidden`: 동일 텍스트, 감성 문구 `<p>` 이동
- [x] `cd frontend && npm run test` — 515 passed
- [x] `cd frontend && npm run lint` — 0 errors

---

### Task 2.4: 홈페이지 "지역별 생활 정보" 섹션 추가

#### Task 2.4a — Red: 지역 링크 테스트 작성

- [x] "지역별 생활 정보" 텍스트 + 17개 지역 링크 검증

#### Task 2.4b — Green: 지역 섹션 구현 ✅

- [x] `frontend/utils/seoConstants.ts`:
  - `CITY_LINKS` 배열 추가 (17개 시/도, backend `CITY_SLUG_TO_FULL` 매핑과 일치)
- [x] `frontend/pages/index.vue`:
  - 카테고리 그리드와 CTA 섹션 사이에 "지역별 생활 정보" 섹션 추가
  - 17개 NuxtLink 그리드 (grid-cols-3 → md:grid-cols-6)

#### Task 2.4c — Refactor: 스타일 + 검증 ✅

- [x] `cd frontend && npm run test` — 515 passed
- [x] `cd frontend && npm run lint` — 0 errors

---

### Task 2.5: 카테고리 목록 하단 "인기 지역" 내부 링크

#### Task 2.5a — Red: 인기 지역 링크 테스트 작성

- [x] `frontend/tests/utils/seoConstants.test.ts`: POPULAR_REGIONS 12개 엔트리, shape, 강남구 포함 검증

#### Task 2.5b — Green: 인기 지역 섹션 구현 ✅

- [x] `frontend/utils/seoConstants.ts`: `POPULAR_REGIONS` 12개 추가 (`shared/regionSlugs.ts` 기반 검증)
- [x] `frontend/pages/[category]/index.vue`: FAQ 하단에 인기 지역 칩 링크 섹션 추가

#### Task 2.5c — Refactor: 검증 ✅

- [x] "인기 지역" 섹션 FAQ 하단에 추가 (12개 지역 칩 링크)
- [x] 링크 패턴: `/{citySlug}/{districtSlug}/{category}`
- [x] `cd frontend && npm run test` — 515 passed
- [x] `cd frontend && npm run lint` — 0 errors

---

### Task 2.6: 지역 페이지 서술형 텍스트 자동 생성

#### Task 2.6a — Red: 서술형 텍스트 테스트 작성

- [x] 지역 페이지 서술형 텍스트 존재 검증

#### Task 2.6b — Green: 서술형 텍스트 구현 ✅

- [x] `frontend/utils/seoHelpers.ts` (신규):
  - `formatPrice()`: 억 단위 변환
  - `generateAreaDescription()`: 병원/약국/학교/공원 등 + 평균가 서술문 생성
- [x] `frontend/pages/[city]/[district]/index.vue`:
  - `areaDescription` computed + `<p v-if>` 추가 (H1 하단)
  - Title에 시설 수 동적 삽입
- [x] `frontend/pages/[city]/index.vue`:
  - 시 단위 서술형 텍스트 추가

#### Task 2.6c — Refactor: SSR 확인 + 정리

- [x] `frontend/tests/utils/seoHelpers.test.ts`: formatPrice + generateAreaDescription 테스트 통과
- [x] `cd frontend && npm run test` — 586 passed
- [x] `cd frontend && npm run lint` — 0 errors

---

### Task 2.7: Phase 2 통합 검증

- [ ] Title 검증: (배포 후 확인 필요)
  - [ ] `/toilet` `<title>`에 숫자+연월 포함 확인
  - [ ] `/real-estate/apt` `<title>`에 연도 포함 확인
  - [ ] `/seoul/gangnam/` `<title>`에 시설 수 포함 확인
  - [ ] 가이드 상세 `<title>`에 연도 포함 확인
  - [ ] Title 35자 이내 확인 (5개 페이지)
- [ ] 내부 링크 검증: (배포 후 확인 필요)
  - [ ] 홈 → 17개 지역 허브 링크 존재
  - [ ] `/hospital` → 12개+ 인기 지역 링크 존재
  - [ ] `/seoul/gangnam/` → 서술형 텍스트 존재
- [ ] H1 검증: (배포 후 확인 필요)
  - [ ] 홈페이지 H1 정확히 1개, 키워드 포함
- [x] 빌드/테스트:
  - [x] `cd frontend && npm run build` — Build complete!
  - [x] `cd frontend && npm run test` — 57 files, 586 passed (테스트 추가 후)
  - [ ] Lighthouse SEO 100점 유지 (배포 후)

---

## Phase 3 — 리치 결과 확장 + 네이버 SEO (1~2개월)

### 의존성 그래프

```
Task 3.1a(Red) → 3.1b(Green) → 3.1c(Refactor)  ── 시설 교차 링크
Task 3.2a(Red) → 3.2b(Green) → 3.2c(Refactor)  ── OG SVG→PNG
Task 3.3a(Red) → 3.3b(Green) → 3.3c(Refactor)  ── 부동산 허브
Task 3.4a(Red) → 3.4b(Green) → 3.4c(Refactor)  ── 네이버 + RSS
Task 3.5a(Red) → 3.5b(Green) → 3.5c(Refactor)  ── 가이드 링크

모든 Task ──→ Task 3.6 (Phase 3 통합 검증)
```

---

### Task 3.1: 시설 상세 "이 지역 다른 시설" 링크

#### Task 3.1a — Red: 교차 링크 테스트 작성

- [x] `frontend/tests/pages/facility-detail-links.test.ts` (신규): 4 tests
- [x] `frontend/tests/utils/seoConstants-related.test.ts` (신규): 7 tests

#### Task 3.1b — Green: 교차 링크 구현 ✅

- [x] `frontend/utils/seoConstants.ts`: `RELATED_CATEGORIES` 매핑 상수 추가 (15개 카테고리)
- [x] `frontend/pages/[category]/[id].vue`: "이 지역 다른 시설" `<nav>` 섹션 + 칩 링크

#### Task 3.1c — Refactor: 검증 ✅

- [x] `cd frontend && npm run test` — 605 passed
- [x] 병원 상세 → "약국", "AED" 링크 표시

---

### Task 3.2: OG 이미지 SVG → PNG 변환

#### Task 3.2a — Red: PNG 응답 테스트 작성

- [x] `frontend/tests/server/ogImage.test.ts`: SVG 생성 테스트 9개 통과

#### Task 3.2b — Green: PNG 변환 구현 ✅

- [x] `sharp` 의존성 설치 (Node 20)
- [x] `frontend/server/routes/og.get.ts`:
  - async 핸들러 전환, `sharp` 동적 import + try/catch
  - 성공: `image/png` Buffer 반환 / 실패: `image/svg+xml` fallback
  - `Cache-Control: public, max-age=86400, s-maxage=86400`

#### Task 3.2c — Refactor: 검증 ✅

- [x] `cd frontend && npm run test` — ogImage 9 tests 통과
- [x] `cd frontend && npm run build` — Build complete! (sharp darwin-arm64 번들)
- [ ] 카카오톡 OG PNG 표시 확인 (배포 후)

---

### Task 3.3: 부동산 허브 페이지 콘텐츠 강화

#### Task 3.3a — Red: 부동산 허브 콘텐츠 테스트 작성

- [x] `frontend/tests/pages/real-estate-hub.test.ts` (신규): H2 3개+, FAQ 텍스트, details/summary, setFAQSchema 호출 — 7 tests 통과

#### Task 3.3b — Green: 부동산 허브 콘텐츠 구현 ✅

- [x] `frontend/pages/real-estate/index.vue`:
  - H2 "부동산 유형별 실거래가" (카드 섹션 래핑)
  - H2 "부동산 실거래가란?" (기존)
  - H2 "자주 묻는 질문" — `<details>/<summary>` FAQ 아코디언 4개
  - `setFAQSchema()` 호출로 FAQPage JSON-LD 추가

#### Task 3.3c — Refactor: 검증 ✅

- [x] `/real-estate/` H2 3개 확인
- [x] FAQ 아코디언 구현 확인
- [x] `cd frontend && npm run test` — 통과

---

### Task 3.4: 네이버 서치어드바이저 등록 + RSS 피드

#### Task 3.4a — Red: RSS 피드 테스트 작성

- [x] `frontend/tests/server/rss.test.ts` (신규): RSS 2.0 구조, channel, item 필드, 빈 피드 fallback — 7 tests 통과

#### Task 3.4b — Green: RSS 엔드포인트 + 네이버 메타 구현 ✅

- [x] `frontend/nuxt.config.ts`: naver-site-verification 이미 존재 확인 (`naver4a270427c00c2dcdbb553b6af5637cb1`)
- [x] `frontend/server/utils/rss.ts` (신규): `generateRssXml()` 순수 함수
- [x] `frontend/server/routes/rss.xml.ts` (신규): `/api/guides` 호출 → RSS 2.0 XML 반환, 에러 시 빈 피드 fallback

#### Task 3.4c — Refactor: 네이버 등록 + 검증

- [x] `cd frontend && npm run test` — rss 7 tests 통과
- [ ] 네이버 서치어드바이저 수동 작업: (배포 후)
  - [ ] 사이트맵 제출
  - [ ] RSS 제출
- [ ] W3C Feed Validation (배포 후)

---

### Task 3.5: 가이드 하단 관련 카테고리 링크

#### Task 3.5a — Red: 가이드 관련 링크 테스트 작성

- [x] `frontend/tests/pages/guide-detail-links.test.ts` (신규): 3 tests

#### Task 3.5b — Green: 가이드 관련 링크 구현 ✅

- [x] `frontend/pages/guide/[slug].vue`:
  - "관련 정보" `<nav>` 섹션 추가
  - guide `category` → `RELATED_CATEGORIES` 매핑, 없으면 기본값 (hospital, school, park)
  - NuxtLink 칩 스타일

#### Task 3.5c — Refactor: 검증 ✅

- [x] `cd frontend && npm run test` — 605 passed
- [x] `cd frontend && npm run lint` — 0 errors

---

### Task 3.6: Phase 3 통합 검증

- [ ] 네이버: (배포 후 수동 작업)
  - [ ] 서치어드바이저 사이트맵 제출
  - [ ] RSS 제출
- [ ] OG: (배포 후)
  - [ ] 카카오톡 공유 시 OG 이미지 표시 확인 (SVG fallback)
- [x] 빌드/테스트:
  - [x] `cd frontend && npm run build` — Build complete!
  - [x] `cd frontend && npm run test` — 62 files, 605 passed
  - [x] `cd frontend && npm run lint` — 0 errors

---

## Phase 4 — 콘텐츠 확장 + 신규 페이지 (2~3개월)

### 의존성 그래프

```
Task 4.1a(Red) → 4.1b(Green) → 4.1c(Green) → 4.1d(Refactor)  ── 지역+부동산 교차
Task 4.2a(기준 확정) → 4.2b(작성 10편) → 4.2c(작성 10편)     ── 가이드 20편
Task 4.3a(Red) → 4.3b(Green BE) → 4.3c(Green FE) → 4.3d(Refactor) ── 동 단위 페이지
Task 4.4a(Red) → 4.4b(Green) → 4.4c(Refactor)                ── 카테고리 교차 링크

모든 Task ──→ Task 4.5 (Phase 4 통합 검증)
```

---

### Task 4.1: 지역+부동산 교차 페이지

#### Task 4.1a — Red: 교차 페이지 테스트 작성

- [x] `frontend/tests/pages/district-real-estate.test.ts` (신규): 5 tests — 컴포넌트 export, FAQ 4개+, H1 텍스트, 섹션 구조

#### Task 4.1b — Green: 교차 페이지 FE 구현 ✅

- [x] `frontend/pages/[city]/[district]/real-estate.vue` (신규):
  - H1: `${districtName} 부동산 실거래가`
  - 6개 매물 유형 카드 (apt-sale~offitel-rent)
  - 5개 생활시설 퀵링크
  - 5개 FAQ `<details>` + 지역별 동적 콘텐츠
  - SEO 메타 + BreadcrumbList + FAQPage JSON-LD
  - 404 guard (잘못된 slug)

#### Task 4.1c — Green: 사이트맵 추가 ✅

- [x] `frontend/server/routes/sitemap/static.xml.ts`:
  - 모든 시군구 × `/real-estate` URL 추가 (priority 0.7)

#### Task 4.1d — Refactor: 검증 ✅

- [x] `cd frontend && npm run test` — 5 tests 통과
- [x] `cd frontend && npm run lint` — 0 errors
- [x] `cd frontend && npm run build` — Build complete!

---

### Task 4.2: SEO 최적화 가이드 20편 작성

#### Task 4.2a — 가이드 작성 기준 확정

- [ ] 가이드 SEO 가이드라인 문서화:
  - 제목: 30~60자, 타겟 키워드 앞부분 배치
  - H2: 최소 3개, 키워드 포함
  - 내부 링크: 관련 카테고리/지역 최소 2개
  - 분량: 최소 1,500자
  - Article 스키마 `dateModified` 갱신일 반영

#### Task 4.2b — 우선 작성: HIGH 검색량 10편

- [ ] 아파트 취득세·중개수수료 총정리
- [ ] 전세 사기 예방 체크리스트
- [ ] 신혼부부 전세자금 대출 조건
- [ ] 야간·주말 진료 병원 찾는 방법
- [ ] 어린이집 종류와 국공립 신청 방법
- [ ] 서울 자치구별 아파트 시세 비교
- [ ] 아파트 vs 빌라 vs 오피스텔 비교
- [ ] 이사할 동네 고르는 법
- [ ] 전기차 충전 요금 비교
- [ ] 분리수거 완벽 가이드

#### Task 4.2c — 후순위 10편

- [ ] 전월세 전환율 계산법
- [ ] 등기부등본 보는 법
- [ ] 약 복용 주의사항
- [ ] AED 사용법
- [ ] 전통시장 활용법
- [ ] 경기도 신도시 생활 인프라 비교
- [ ] 학군 좋은 동네 TOP 10
- [ ] 1인 가구 살기 좋은 동네
- [ ] 반려동물과 살기 좋은 동네
- [ ] 공원 산책 코스 추천

#### 검증 (각 가이드)

- [ ] Article 스키마 유효 (Rich Results Test)
- [ ] 내부 링크 2개+ 포함 확인
- [ ] H2 3개+ 확인
- [ ] 1,500자+ 확인

---

### Task 4.3: 동(읍면동) 단위 지역 페이지

#### Task 4.3a — Red: 동 페이지 테스트 작성

- [ ] `frontend/tests/pages/dong.test.ts` (신규):
  - `/seoul/gangnam/yeoksam-dong` 렌더링 시 H1에 "역삼동" 포함 검증
  - BreadcrumbList JSON-LD에 4단계(홈→서울→강남구→역삼동) 검증
  - 시설 50개 미만 동 접근 시 noindex 또는 404 검증

#### Task 4.3 — ⏸️ 보류 (데이터 기반 작업 필요)

동(읍면동) 페이지는 현재 구현 불가. 사유:
- DB에 `dong` 필드 미보유 (시설 주소가 `city`/`district`까지만 파싱)
- 백엔드 동별 집계 API 없음
- 동 slug↔한글 매핑 테이블 없음

빈 껍데기 파일은 thin content SEO 마이너스 리스크로 **제거 완료**.
별도 PRD로 데이터 파이프라인 구축 후 재착수 필요:
1. Prisma 모델에 `dong` 필드 추가 + 주소 파싱 로직
2. `/api/area/:city/:district/:dong` 백엔드 API
3. 동 slug↔한글 매핑
4. 프론트엔드 페이지 + 사이트맵

---

### Task 4.4: 카테고리 간 교차 링크

#### Task 4.4a — Red: 교차 링크 테스트 작성

- [x] `frontend/tests/pages/category-cross-links.test.ts` (신규): 5 tests — hospital→pharmacy, self-exclude, school→childcare, 10+개 비어있지 않은 매핑, 유효 slug 검증

#### Task 4.4b — Green: 교차 링크 구현 ✅

- [x] `frontend/pages/[category]/index.vue`:
  - `RELATED_CATEGORIES` import + `relatedCategories` computed 추가
  - CategoryIntro 하단에 "관련 카테고리" 칩 링크 섹션 추가
  - wifi (빈 배열) → 칩 미표시

#### Task 4.4c — Refactor: 검증 ✅

- [x] `cd frontend && npm run test` — 5 tests 통과
- [x] `cd frontend && npm run lint` — 0 errors

---

### Task 4.5: Phase 4 통합 검증

- [ ] 신규 페이지: (배포 후)
  - [ ] `/seoul/gangnam/real-estate` 인덱싱 요청 (GSC)
  - [ ] `/seoul/gangnam/dong/yeoksam-dong` 인덱싱 요청 (GSC)
- [ ] 가이드: (Task 4.2 — 콘텐츠 작성 별도 진행)
  - [ ] 20편 Article 스키마 전수 유효성 검사
  - [ ] 내부 링크 평균 2개+ 확인
- [ ] KPI 중간 점검: (배포 후 30일)
  - [ ] GSC 인덱싱률 (목표: 80%+)
  - [ ] 리치 결과 활성 상태 (FAQ, HowTo, AggregateRating)
  - [ ] 네이버 서치어드바이저 인덱싱 현황
- [x] 빌드/테스트:
  - [x] `npm run build` — Build complete!
  - [x] `npm run test` — 66 files, 634 tests 전체 통과

---

## 전체 마일스톤 요약

| Phase | 기간 | Sub-Tasks | 핵심 성과물 |
|-------|------|-----------|-----------|
| **1** | 1~2주 | 25 (8 Task × 3 step + 검증) | 구조화 데이터 정상화, OG 연결, robots, rel link SSR |
| **2** | 2~4주 | 19 (6 Task × 3 step + 검증) | Title CTR 공식, H1 개선, 내부 링크 3종 |
| **3** | 1~2개월 | 16 (5 Task × 3 step + 검증) | OG PNG, 부동산 허브, 네이버 등록, RSS |
| **4** | 2~3개월 | 15 (4 Task × ~3 step + 검증) | 지역×부동산 교차, 가이드 20편, 동 페이지 |
| **총계** | | **~75 Sub-Tasks** | |
