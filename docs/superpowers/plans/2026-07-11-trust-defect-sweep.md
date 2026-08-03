# 결함 스윕 8건 (신뢰 디자인 격상 PR ③) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 신뢰를 깎는 디테일 결함 8건을 제거하고, 각각 재발 방지 테스트로 고정한다.

**Architecture:** 8개 결함은 대부분 독립적이다 — 프론트엔드 표시 정제(라벨 폴백·조회수 임계·HHMM 포맷·오늘 배지·쿠팡 고지문 dedup)와 백엔드 데이터 정합(한글 우선 정렬·주변 시설 dedup·최근 거래가 결정성)으로 나뉜다. 각 결함이 한 태스크이며, 두 결함(라벨·조회수)만 동일 4개 콘텐츠 페이지를 순차 편집한다. SEO/SSR 불변식은 전 태스크 공통(정제·정정만, 구조 불변).

**Tech Stack:** Nuxt 3 + Vue 3 (script setup), Express 5 + Prisma (MySQL), Vitest

**Spec:** `docs/superpowers/specs/2026-07-10-trust-design-elevation-design.md` §5-6 (결함 스윕 8건 표)

## Global Constraints

- **Node 20 필수**: 모든 npm/vitest 실행 전 `source ~/.nvm/nvm.sh && nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **SEO/SSR 불변**: URL·단일 h1·title/meta·canonical·noindex·섹션 순서·광고 슬롯(배너 이미지) 개수·위치 불변. 이 PR은 기존 SSR 텍스트를 **정제·정정**하거나(포맷·라벨·dedup) 조건부로 **제거**(조회수)할 뿐 — 구조·메타 불변식은 유지.
- **정렬/데이터 변경은 백엔드에서**: 프론트는 목록·주변 시설을 재정렬/재dedup하지 않는다(전부 백엔드 소스).
- **SQL 안전**: raw SQL의 사용자 입력값(city/district 등)은 반드시 `?` 파라미터 바인딩. 테이블명만 내부 고정 맵에서 보간.
- **법적 고지 유지**: 쿠팡 파트너스 고지문은 모든 뷰포트에서 페이지당 최소 1회 노출(브레이크포인트 숨김 클래스 금지).
- **커밋**: conventional commit 한국어 (`fix(trust): ...`). PR은 develop 대상, 자체 머지 금지.
- **직접 mount되는 컴포넌트**(WeekdayHoursTable·CoupangBanner 등)는 vue API·유틸 명시 import (auto-import는 CI vitest ReferenceError).

## 브랜치

모든 태스크는 한 브랜치 `feat/trust-defect-sweep`에서 순차 커밋. Task 1 Step 1에서 생성:
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull origin develop
git checkout -b feat/trust-defect-sweep
```

---

### Task 1: [결함 8] 운영시간 표 "오늘" 배지

**Files:**
- Modify: `frontend/components/facility/detail/WeekdayHoursTable.vue:19` (`{{ row.isToday ? ' ★' : '' }}`)
- Test: `frontend/tests/components/facility/detail/WeekdayHoursTable.test.ts` (기존, "★" 단언 케이스 갱신)

**Interfaces:**
- Consumes: 없음 (기존 `row.isToday: boolean`)
- Produces: 없음

- [ ] **Step 1: 브랜치 생성** (위 "브랜치" 블록 실행)

- [ ] **Step 2: 기존 테스트 케이스 갱신(RED)** — `WeekdayHoursTable.test.ts`의 'isToday 행에 ★ ...' 케이스(약 L20-25)에서 `expect(todayRow.text()).toContain('★')`를 `expect(todayRow.text()).toContain('오늘')` + `expect(todayRow.text()).not.toContain('★')`로 변경.

```bash
cd frontend && npx vitest run tests/components/facility/detail/WeekdayHoursTable.test.ts
```
Expected: FAIL — 아직 ★ 렌더 중

- [ ] **Step 3: 구현** — `WeekdayHoursTable.vue:19`의 요일 셀에서 `{{ row.isToday ? ' ★' : '' }}`를 텍스트 배지로 교체:

```html
<span v-if="row.isToday" class="ml-1 inline-block rounded bg-primary-100 px-1 py-0.5 text-[10px] font-semibold text-primary-700 align-middle">오늘</span>
```
(컴포넌트가 이미 쓰는 primary 토큰 계열 재사용. "오늘" 텍스트 자체가 자기설명적이라 별도 범례 불필요.)

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run tests/components/facility/detail/WeekdayHoursTable.test.ts
```
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add components/facility/detail/WeekdayHoursTable.vue tests/components/facility/detail/WeekdayHoursTable.test.ts
git commit -m "fix(trust): 운영시간 표 오늘 강조를 ★→'오늘' 배지로 (의미 명확화)"
```

---

### Task 2: [결함 2] 콘텐츠 조회수 100 미만 비노출

**Files:**
- Modify: `frontend/utils/seoConstants.ts` — `VIEW_COUNT_DISPLAY_MIN = 100` 추가
- Modify: `frontend/pages/guide/[slug].vue:44-47`, `frontend/pages/article/[slug].vue:44-47` (상세 visibility span v-if)
- Modify: `frontend/pages/guide/index.vue:86-91`, `frontend/pages/article/index.vue:86-91` (목록 카드 바깥 div v-if)
- Test: `frontend/tests/pages/article-detail.test.ts`, `frontend/tests/pages/article-index.test.ts` (기존, 케이스 추가)

**Interfaces:**
- Consumes: 기존 `viewCount: number` (GuideSummary/ArticleSummary, non-nullable)
- Produces: `VIEW_COUNT_DISPLAY_MIN = 100` (`~/utils/seoConstants`)

- [ ] **Step 1: 실패 테스트 추가(RED)** — `article-detail.test.ts`에 "viewCount<100이면 visibility 미노출 / >=100이면 노출" 2케이스, `article-index.test.ts`에 목록 카드 동일 케이스. mock article의 viewCount를 각각 2와 150 등으로.

```bash
npx vitest run tests/pages/article-detail.test.ts tests/pages/article-index.test.ts
```
Expected: FAIL

- [ ] **Step 2: 상수 추가** — `seoConstants.ts`:

```ts
/** 콘텐츠 조회수 표시 임계 — 이 미만이면 비노출(방문자 없는 사이트 역신호 방지, 스펙 §5-6) */
export const VIEW_COUNT_DISPLAY_MIN = 100
```

- [ ] **Step 3: 상세 2곳 수정** — guide/[slug].vue·article/[slug].vue의 visibility `<span class="flex items-center gap-1">`에 `v-if`:
```html
<span v-if="guide.viewCount >= VIEW_COUNT_DISPLAY_MIN" class="flex items-center gap-1">
```
(article은 `article.viewCount`.) 각 파일의 기존 `seoConstants` import 라인에 `VIEW_COUNT_DISPLAY_MIN` 추가.

- [ ] **Step 4: 목록 2곳 수정** — guide/index.vue·article/index.vue의 **바깥** `<div class="flex items-center justify-end text-xs text-muted">`에 `v-if`를 걸어 빈 flex 행이 SSR에 남지 않게:
```html
<div v-if="guide.viewCount >= VIEW_COUNT_DISPLAY_MIN" class="flex items-center justify-end text-xs text-muted">
```
import 추가.

- [ ] **Step 5: 테스트 통과 + 전체**

```bash
npx vitest run tests/pages/article-detail.test.ts tests/pages/article-index.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS (기존 목데이터 viewCount가 100 미만이면 관련 단언이 사라진 노출을 기대할 수 있으니 목값을 >=100으로 올리거나 케이스별 명시)

- [ ] **Step 6: 커밋**

```bash
git add utils/seoConstants.ts 'pages/guide/[slug].vue' 'pages/article/[slug].vue' pages/guide/index.vue pages/article/index.vue tests/pages/article-detail.test.ts tests/pages/article-index.test.ts
git commit -m "fix(trust): 콘텐츠 조회수 100 미만 비노출 (저조회 역신호 제거)"
```

---

### Task 3: [결함 1] 콘텐츠 카테고리 라벨 raw slug 폴백

**Files:**
- Create: `frontend/utils/contentCategoryLabel.ts` — `getContentCategoryLabel(category: string): string`
- Modify: `frontend/pages/article/index.vue:208-215`, `frontend/pages/article/[slug].vue:188-195`, `frontend/pages/guide/index.vue:209-216`, `frontend/pages/guide/[slug].vue:205-211` (4곳 로컬 라벨 함수를 공유 유틸로 교체)
- Test: `frontend/tests/utils/contentCategoryLabel.test.ts` (신규) + `article-index.test.ts`/`article-detail.test.ts`에 public-rental 케이스

**Interfaces:**
- Consumes: 기존 `CATEGORY_META`(`~/types/facility`), `REAL_ESTATE_META`(부동산 라벨 맵 — 기존 로컬 함수가 쓰는 것과 동일 소스)
- Produces: `getContentCategoryLabel(category: string): string` (`~/utils/contentCategoryLabel`)

- [ ] **Step 1: 실패 테스트 작성(RED)** — `contentCategoryLabel.test.ts`: `apt-sale`→'부동산', `subscription`→'청약/임대', 시설(`pharmacy`)→CATEGORY_META 라벨, 부동산(`apt-sale` 계열이 아닌 것은 REAL_ESTATE_META camelKey), `public-rental`→'매입임대', 미지정 slug(`xyz`)→'생활정보'(raw 미포함). + `article-index.test.ts`에 `{ category: 'public-rental' }` mock 행 추가해 pill 텍스트가 'public-rental' 미포함 검증.

```bash
npx vitest run tests/utils/contentCategoryLabel.test.ts tests/pages/article-index.test.ts
```
Expected: FAIL — 유틸 없음

- [ ] **Step 2: 유틸 구현** — `frontend/utils/contentCategoryLabel.ts`. 기존 4개 로컬 함수의 합집합 로직 + 레거시 맵 + 안전 폴백:

```ts
import { CATEGORY_META } from '~/types/facility'
import { REAL_ESTATE_META } from '~/utils/realEstateMeta' // 기존 로컬 함수가 import하던 경로에 맞출 것

const LEGACY_CONTENT_LABELS: Record<string, string> = {
  'public-rental': '매입임대',
  sale: '분양',
  rent: '임대',
}

/** 콘텐츠(가이드·기사) 카테고리 slug → 한글 라벨. 미지정 slug는 raw 노출 대신 안전 폴백. */
export function getContentCategoryLabel(category: string): string {
  if (category === 'apt-sale' || category === 'apt-rent') return '부동산'
  if (category === 'subscription') return '청약/임대'
  const facilityLabel = CATEGORY_META[category as keyof typeof CATEGORY_META]?.label
  if (facilityLabel) return facilityLabel
  const camelKey = category.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const reLabel = REAL_ESTATE_META[camelKey as keyof typeof REAL_ESTATE_META]?.label
  if (reLabel) return reLabel
  if (LEGACY_CONTENT_LABELS[category]) return LEGACY_CONTENT_LABELS[category]
  return '생활정보'
}
```
(REAL_ESTATE_META의 실제 import 경로·라벨 필드는 기존 4개 로컬 함수에서 확인해 정확히 맞출 것. index 계열이 쓰던 apt/subscription 특수분기를 보존해 기존 apt/청약 카드 SSR 라벨이 안 바뀌게.)

- [ ] **Step 3: 4개 페이지 교체** — 각 파일의 로컬 `getCategoryLabel`/`categoryLabel` 정의를 삭제하고 `import { getContentCategoryLabel } from '~/utils/contentCategoryLabel'`로 교체, 호출부를 `getContentCategoryLabel(...)`로. guide/[slug].vue는 `categoryLabel`이 `<title>`(약 L266)에 쓰이므로 교체 후 title이 미지정 slug에서 '생활정보'로 나오는 것 확인(현재 raw slug보다 개선).

- [ ] **Step 4: 상세 테스트 추가 + 통과** — `article-detail.test.ts`에 category:'public-rental' 기사 히어로 pill이 'public-rental' 미포함 케이스.

```bash
npx vitest run tests/utils/contentCategoryLabel.test.ts tests/pages/article-index.test.ts tests/pages/article-detail.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add utils/contentCategoryLabel.ts 'pages/article/index.vue' 'pages/article/[slug].vue' pages/guide/index.vue 'pages/guide/[slug].vue' tests/utils/contentCategoryLabel.test.ts tests/pages/article-index.test.ts tests/pages/article-detail.test.ts
git commit -m "fix(trust): 콘텐츠 카테고리 라벨 공유 유틸화 + raw slug 안전 폴백 (public-rental 노출 제거)"
```

---

### Task 4: [결함 3] FAQ·팁 HHMM 시각 포맷

**Files:**
- Create: `frontend/utils/formatTime.ts` — `formatHHMM(raw: string | number | null | undefined): string`
- Modify: `frontend/utils/dynamicFAQ.ts` (pharmacy 195-202, hospital 174-178, aed 118-124, library 142-145 시간 보간)
- Modify: `frontend/utils/dynamicTips.ts` (aed 43-44, pharmacy 66-67)
- Test: `frontend/tests/utils/formatTime.test.ts`, `frontend/tests/utils/dynamicFAQ.test.ts` (신규)

**Interfaces:**
- Consumes: 없음
- Produces: `formatHHMM(raw): string` (`~/utils/formatTime`)

- [ ] **Step 1: 실패 테스트 작성(RED)** — `formatTime.test.ts`: `'900'`→`'09:00'`, `'1930'`→`'19:30'`, `'09:00'`→`'09:00'`(이미 콜론), `''`→`''`, `null`→`''`, `2000`(number)→`'20:00'`. `dynamicFAQ.test.ts`: pharmacy(dutyTime1s:'900',dutyTime1c:'2000')의 영업시간 답변이 `'09:00~20:00'` 포함·`'900~2000'` 미포함; hospital(trmtMonStart:'0900',trmtMonEnd:'1730') 동일; library 이미-콜론 값 통과.

```bash
npx vitest run tests/utils/formatTime.test.ts tests/utils/dynamicFAQ.test.ts
```
Expected: FAIL

- [ ] **Step 2: formatHHMM 구현** — `frontend/utils/formatTime.ts` (기존 useStructuredData.ts:18·useFacilityMeta.ts:20·FacilityCard.vue:162 인라인 복제본과 동일 로직):

```ts
/** HHMM 원값('900'·'1930'·2000) → 'H:MM'('09:00'·'19:30'). 이미 콜론 있으면 그대로, falsy면 ''. */
export function formatHHMM(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return ''
  const s = String(raw).trim()
  if (s.includes(':')) return s
  const padded = s.padStart(4, '0')
  return `${padded.slice(0, 2)}:${padded.slice(2)}`
}
```

- [ ] **Step 3: dynamicFAQ.ts·dynamicTips.ts 적용** — 4개 카테고리 시간 보간부의 `${d.dutyTime1s}~${d.dutyTime1c}` 등을 `${formatHHMM(d.dutyTime1s)}~${formatHHMM(d.dutyTime1c)}`로 래핑. dynamicTips 2곳도 동일. 각 파일 상단에 `import { formatHHMM } from '~/utils/formatTime'`.

- [ ] **Step 4: 테스트 통과 + 전체**

```bash
npx vitest run tests/utils/formatTime.test.ts tests/utils/dynamicFAQ.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add utils/formatTime.ts utils/dynamicFAQ.ts utils/dynamicTips.ts tests/utils/formatTime.test.ts tests/utils/dynamicFAQ.test.ts
git commit -m "fix(trust): FAQ·이용팁 HHMM 원값을 H:MM 포맷으로 (기계 생성 티 제거)"
```

**주의(범위 외 기록):** parking FAQ의 `operatingHours`는 백엔드 `csvParser.ts:671 buildParkingOperatingHours`가 원시 HHMM을 문자열에 박아 저장 → 프론트에서 못 고침(재sync 필요). 동일 유형이나 이 PR 범위 밖 — §플랜 메모에 후속 기록.

---

### Task 5: [결함 7] 쿠팡 파트너스 고지문 페이지당 1회

**Files:**
- Modify: `frontend/components/ads/CoupangBanner.vue:25-27` — `disclosure?: boolean` prop(기본 true) + 고지문 상수 export
- Modify: `frontend/pages/[category]/[id].vue:195,255`, `frontend/pages/subway/[slug].vue:209,270` — 두 배너 `:disclosure="false"` + 단일 고지문 `<p>` 1개 추가
- Test: `frontend/tests/components/ads/CoupangBanner.test.ts` (prop 케이스), 페이지 단위 고지문 1회 회귀 테스트

**Interfaces:**
- Consumes: 없음
- Produces: `CoupangBanner`의 `disclosure?: boolean` prop, 고지문 상수(컴포넌트에서 export 또는 `~/constants`)

- [ ] **Step 1: 실패 테스트 작성(RED)** — `CoupangBanner.test.ts`: 기본(disclosure 미지정)이면 고지문 렌더, `:disclosure="false"`면 미렌더. 페이지 회귀: `[category]/[id].vue`를 실제 CoupangBanner로 마운트(setup.ts stub 우회)해 고지문 문자열 출현이 정확히 1회. 광고 배너(CoupangBanner) 개수 2 불변 단언도(기존 auction/land 테스트 패턴 재사용).

```bash
npx vitest run tests/components/ads/CoupangBanner.test.ts
```
Expected: FAIL

- [ ] **Step 2: CoupangBanner.vue 수정** — 고지문 문자열을 상수로 추출(drift 방지) + `disclosure` prop:

```ts
export const COUPANG_DISCLOSURE = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.'
```
props에 `disclosure?: boolean` (기본 true), 고지문 `<p>`를 `v-if="disclosure ?? true"`로.

- [ ] **Step 3: 두 상세 페이지 수정** — `[category]/[id].vue`와 `subway/[slug].vue`의 두 `<CoupangBanner>` 인스턴스에 `:disclosure="false"` 추가. 첫 쿠팡 블록(모바일 인라인, DOM상 첫 번째) 인접에 브레이크포인트 숨김 클래스 **없는** 단일 고지문 `<p>` 1개 추가(모든 뷰포트 노출):
```html
<p class="mt-2 text-center text-[11px] leading-relaxed text-slate-400">{{ COUPANG_DISCLOSURE }}</p>
```
`import { COUPANG_DISCLOSURE } from '~/components/ads/CoupangBanner.vue'` (또는 상수 파일 경로).

- [ ] **Step 4: 테스트 통과 + 전체**

```bash
npx vitest run tests/components/ads/CoupangBanner.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS. **광고 배너 이미지 슬롯 개수·위치는 2개 그대로** — 고지문 텍스트 노출만 2→1.

- [ ] **Step 5: 커밋**

```bash
git add components/ads/CoupangBanner.vue 'pages/[category]/[id].vue' 'pages/subway/[slug].vue' tests/components/ads/CoupangBanner.test.ts
git commit -m "fix(trust): 쿠팡 파트너스 고지문 페이지당 1회로 통합 (모든 뷰포트 노출 유지)"
```

**주의:** `tests/setup.ts:105`의 CoupangBanner stub은 고지문을 렌더하지 않으므로 페이지 회귀 테스트는 stub 교체 또는 실제 마운트 필요. 남기는 단일 고지문 `<p>`에 **절대 `md:hidden`/`hidden md:flex` 붙이지 말 것**(법적 요건 — 반대 브레이크포인트에서 광고 있는데 고지 사라짐).

---

### Task 6: [결함 6] 전국 시설 목록 한글 우선 정렬

**Files:**
- Modify: `backend/src/services/facilityService.ts` — `search()` 기본 name 정렬 분기(약 552, 575-581)에 raw SQL 한글 우선 정렬, `getByRegion()`(약 977-986)에도 동일 적용
- Test: `backend/__tests__/services/facilityService.test.ts` (기존, prisma mock 구조)

**Interfaces:**
- Consumes: 기존 `cityVariantList(city)`(지역 필터), 카테고리→테이블명 맵(신규 상수)
- Produces: 없음 (정렬 순서만 변경)

- [ ] **Step 1: 실패/갱신 테스트 작성(RED)** — `facilityService.test.ts`의 mock prismaClient에 `$queryRawUnsafe: mockQueryRaw` 추가(정렬된 id 배열 resolve). 새 케이스: `search({category:'pharmacy', page:1, limit:20})`가 `$queryRawUnsafe`를 `REGEXP '^[가-힣]'`와 한글 DESC 포함 ORDER BY로 호출, 지역값이 `?` 바인딩 인자로 전달, findMany가 `where:{ id:{ in:[...] } }`로 호출되고 결과가 id 순서 보존. 기존 'searches single category with DB pagination'·'city/district filter' 단언은 새 경로(findMany id-in)로 이동.

```bash
cd backend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run __tests__/services/facilityService.test.ts
```
Expected: FAIL

- [ ] **Step 2: 카테고리→테이블명 맵 추가** — schema.prisma 모델명(@@map 없음 확인) 기준 PascalCase: Toilet/Wifi/Clothes/Parking/Aed/Library/Hospital/Pharmacy/Park/School/Market/Childcare/Sports. (ev-charger·trash는 조기 return이라 제외.)

- [ ] **Step 3: 구현** — `search()`의 **기본 name 정렬 + 키워드 없음 + departments 없음** 분기에서만 raw 경로:
  1. `SELECT id FROM \`Table\` [WHERE city IN (?,...) AND district = ?] ORDER BY (name REGEXP '^[가-힣]') DESC, name ASC LIMIT ? OFFSET ?` → ids (테이블명만 고정맵 보간, 지역·limit·offset은 `?` 바인딩)
  2. `total`은 기존 `model.count({ where })` 재사용
  3. `model.findMany({ where:{ id:{ in: ids } }, select: buildListSelect(cat) })` 후 기존 FULLTEXT 경로(약 570-571)의 id-order Map 재정렬 재사용
  키워드(FULLTEXT)·1자 LIKE·latest/popular 정렬·hospital departments 경로는 **기존대로 유지**. `getByRegion()`도 동일 정렬식 적용. `getByRegionAll()`(혼합 카테고리 병합)은 범위 밖(명시).

- [ ] **Step 4: 테스트 통과 + 백엔드 전체**

```bash
npx vitest run __tests__/services/facilityService.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/services/facilityService.ts __tests__/services/facilityService.test.ts
git commit -m "fix(trust): 전국/지역 시설 목록 한글 우선 정렬 (기호·숫자 항목 뒤로)"
```

**SQL 안전 필수:** city/district는 사용자 입력 → `?` 바인딩. 테이블명은 내부 고정맵만 보간. 테이블명 대소문자는 Linux MySQL 케이스 민감이므로 모델명과 정확히 일치(trash `WasteSchedule` 선례). `ORDER BY (name REGEXP …)`는 filesort지만 25k행 기준 수 ms — 허용.

---

### Task 7: [결함 5] 주변 시설 name+좌표 dedup

**Files:**
- Modify: `backend/src/services/facilityService.ts` — `dedupeByLocation()` 헬퍼 + `getNearbyFacilities()`(약 244-291)·`search()` 좌표 경로(약 494-508) 적용
- Test: `backend/__tests__/services/facilityService.test.ts` (또는 신규 `facilityNearby.test.ts`)

**Interfaces:**
- Consumes: 기존 `FacilityItem`(category·name·lat·lng·distance)
- Produces: `dedupeByLocation(items: FacilityItem[]): FacilityItem[]` (모듈 내부)

- [ ] **Step 1: 실패 테스트 작성(RED)** — 동일 name+좌표·다른 id 2건 mock 후: (1) `getNearbyFacilities()`가 1건만 반환, (2) `search()` 좌표 경로 결과 items·`total`이 1건으로 dedup, (3) 다른 좌표 동명 시설은 2건 유지(과다 dedup 방지).

```bash
npx vitest run __tests__/services/facilityService.test.ts
```
Expected: FAIL

- [ ] **Step 2: 헬퍼 구현** — 키 = `${category}|${name}|${lat.toFixed(5)}|${lng.toFixed(5)}`(id/sourceId 아님, 좌표 ~1m 반올림), 정렬 후 첫 항목(최근접) 유지:

```ts
function dedupeByLocation(items: FacilityItem[]): FacilityItem[] {
  const seen = new Set<string>()
  const out: FacilityItem[] = []
  for (const item of items) {
    const key = `${item.category}|${item.name}|${item.lat.toFixed(5)}|${item.lng.toFixed(5)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
```

- [ ] **Step 3: 적용** — (a) `getNearbyFacilities()`의 `.sort()` 후 `.slice(0,6)` 앞, (b) `search()` 좌표 경로에서 `withDistance` 정렬 직후·**total/paginate 계산 전**(그래야 total/totalPages도 dedup 정합). self 제외가 dedup 뒤라면, 같은 좌표에서 self.id를 우선 유지하도록 정렬 보정(0m 쌍둥이 노출 방지).

- [ ] **Step 4: 테스트 통과 + 전체**

```bash
npx vitest run __tests__/services/facilityService.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add src/services/facilityService.ts __tests__/services/facilityService.test.ts
git commit -m "fix(trust): 주변 시설 name+좌표 기준 dedup (중복 노출 제거)"
```

**주의:** `search()` 좌표 경로는 지도/근처검색도 먹이므로 dedup이 지도 중복 핀도 제거함(바람직). 반드시 dedup 후 total/totalPages 재계산. 좌표 5자리 dedup은 정확히 동일 좌표+이름만 병합(오탐 없음).

---

### Task 8: [결함 4] 최근 거래가 meta·헤더 정합

**Files:**
- Modify: `backend/src/services/realEstateService.ts` — `getBuildingInfo` orderBy(약 553)·`searchTransactions` orderBy(약 216-220)에 `{ id: 'desc' }` tie-break, `getBuildingInfo` where(약 557)에 sale일 때 `cancelDealDay: null`
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` — `detailMeta`의 recentDeal을 헤더와 동일 소스(`buildingInfo`)에서 산출(약 579-608), `latestPrice`/heroStats(약 818-861)와 공유하는 단일 computed
- Test: `backend/__tests__/services/realEstateServiceGetBuildingInfo.test.ts`(있으면)·`realEstateService.test.ts`, `frontend/tests/composables/useRealEstateDetailMeta.test.ts`(있으면)

**Interfaces:**
- Consumes: 기존 `buildingInfo.latestDealAmount/latestDealYear/latestDealMonth`, `formatKoreanPrice`
- Produces: 없음 (meta·헤더가 동일 값 산출)

- [ ] **Step 1: 실패 테스트 작성(RED)** — 백엔드: 같은 dealYear/월/일 2건(금액 상이)일 때 `getBuildingInfo`의 `latestDealAmount`가 id desc로 결정적 + sale 취소거래 제외. `searchTransactions`도 동일일 다건 시 `items[0]`가 id desc로 결정적(두 함수가 같은 규칙으로 같은 행 선택). 프론트: `detailMeta`의 recentDeal이 헤더 소스(buildingInfo)와 동일 값일 때 description `최근 …원(…)`이 헤더와 일치.

```bash
cd backend && npx vitest run __tests__/services/
```
Expected: FAIL

- [ ] **Step 2: 백엔드 결정성** — `getBuildingInfo` orderBy와 `searchTransactions` orderBy 둘 다 `[{dealYear:'desc'},{dealMonth:'desc'},{dealDay:'desc'},{id:'desc'}]`로. `getBuildingInfo` where에 sale일 때 `cancelDealDay: null` 추가(검색 엔드포인트 규칙과 정렬).

- [ ] **Step 3: 프론트 단일 소스화** — `detailMeta`의 `recentDeal`을 `transactions.value.items[0]` 대신 `buildingInfo`(latestDealAmount/Year/Month)에서 산출. `latestPrice`/heroStats와 공유하는 단일 computed(예: `recentDealForDisplay`)로 amount·dealDate를 한 곳에서. currentTab/apiSlug가 URL 고정이라 buildingInfo는 페이지당 불변 → pagination·필터와 무관하게 meta==헤더 보장. `formatKoreanPrice`는 utils 쪽으로 통일(eok만일 때 표기 미세 불일치 해소).

- [ ] **Step 4: 테스트 통과 + 백엔드·프론트 전체**

```bash
cd backend && npx vitest run 2>&1 | tail -4
cd ../frontend && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/services/realEstateService.ts 'frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue' backend/__tests__ frontend/tests
git commit -m "fix(trust): 아파트 최근 거래가 meta·헤더 단일 소스화 + 결정적 tie-break (불일치 제거)"
```

---

### Task 9: 전체 검증 + PR 생성

**Files:** 없음

- [ ] **Step 1: lint + 양쪽 전체 테스트**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
source ~/.nvm/nvm.sh && nvm use 20
(cd backend && npm run lint 2>&1 | tail -3 && npx vitest run 2>&1 | tail -3)
(cd frontend && npm run lint 2>&1 | tail -3 && npx vitest run 2>&1 | tail -3)
git diff develop --stat -- '**/package-lock.json'   # 결과 없어야 함
```
Expected: 양쪽 lint 신규 오류 0, 전체 PASS. 실패 시 해당 태스크로 복귀.

- [ ] **Step 2: 불변식 스폿체크(dev 서버 가능 시)** — 시설 상세 운영시간 표 "오늘" 배지, FAQ 시각 콜론 포맷, 저조회 콘텐츠 조회수 미노출, /article 목록 pill 한글 라벨, 상세 쿠팡 고지문 1회, 전국 약국 목록 첫 화면 한글 실명 우선, 아파트 상세 meta description과 헤더 최근 거래가 일치, 주변 시설 중복 없음. 모바일 390px 넘침 없음.

- [ ] **Step 3: 푸시 + PR 생성**

```bash
git push -u origin feat/trust-defect-sweep
gh pr create --base develop \
  --title "fix(trust): 신뢰 훼손 디테일 결함 8건 스윕 (PR ③)" \
  --body "$(cat <<'EOF'
## 요약
신뢰 디자인 격상(spec 2026-07-10, 로컬) Phase 1 PR ③ — §5-6 결함 스윕 8건.

1. 운영시간 표 '오늘' 강조 ★→배지 (의미 명확화)
2. 콘텐츠 조회수 100 미만 비노출 (저조회 역신호 제거)
3. 콘텐츠 카테고리 라벨 공유 유틸 + raw slug 폴백 (public-rental 노출 제거)
4. FAQ·팁 HHMM 원값 → H:MM 포맷 (기계 생성 티 제거)
5. 쿠팡 파트너스 고지문 페이지당 1회 (법적 요건 유지, 모든 뷰포트 노출)
6. 전국/지역 시설 목록 한글 우선 정렬 (기호·숫자 항목 뒤로)
7. 주변 시설 name+좌표 dedup (중복 노출 제거)
8. 아파트 최근 거래가 meta·헤더 단일 소스화 + 결정적 tie-break

## 불변식
- URL·단일 h1·title/meta·canonical·noindex·섹션 순서·광고 슬롯 개수/위치 불변
- 정제·정정·조건부 제거만 (SSR 텍스트 정제, 광고 배너 개수 불변, 고지문은 텍스트 노출 횟수만 2→1)
- raw SQL 사용자 입력 `?` 바인딩, 테이블명만 고정맵 보간
- Node 20, package-lock 무변경

## 테스트
- 신규 유틸/컴포넌트/페이지 테스트 + 백엔드 정렬·dedup·tie-break 회귀 테스트
- backend·frontend vitest 전체 PASS, lint 0 errors

## 범위 외 (후속)
- parking FAQ operatingHours HHMM: 백엔드 csvParser가 저장 시 박음 → 재sync 필요, 별도 처리
EOF
)"
```
Expected: PR URL. CI green 확인 후 사용자 머지 판단.

---

## 플랜 메모

- **결함 순서 근거**: 프론트 단순(오늘 배지)→콘텐츠 페이지(조회수·라벨, 동일 4파일 순차)→유틸(HHMM)→반응형 주의(쿠팡)→백엔드 복잡(정렬 raw SQL·주변 dedup·meta 정합). 백엔드 3건이 blast radius가 크므로 뒤로.
- **동일 파일 순차 편집**: Task 2(조회수)·Task 3(라벨)이 guide/article의 index+[slug] 4파일을 공유 — 순차 커밋이라 충돌 없음. Task 3 구현자는 Task 2 반영 상태에서 작업.
- **범위 외 기록**: (1) parking FAQ operatingHours의 HHMM은 백엔드 csvParser 저장 시점 문제(재sync 필요), (2) 기존 3곳 시간 포맷 인라인 복제본(useStructuredData·useFacilityMeta·FacilityCard)의 formatHHMM 재사용 DRY 리팩터는 저위험이나 선택 — 이 PR은 결함 표면만, 리팩터는 후속.
- **후속 트랙**: PR ④ 광고 라벨·경계 + 마이크로카피 → PR ⑤~⑦ Phase 2.
