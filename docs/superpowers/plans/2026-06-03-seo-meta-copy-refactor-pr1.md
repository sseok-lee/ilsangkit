# SEO 메타 리팩터 PR1 — 메타 단일소스화 + 카테고리 head/h1 분리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 죽은 코드였던 `setCategoryMeta()`(키워드 완성형 카피)를 카테고리 페이지에 실제 연결하고, 빈약한 `buildCategorySeo*`를 제거하며, 브랜드 부제(`SITE_TAGLINE`)를 단일 상수로 통일한다.

**Architecture:** `seoConstants.ts`에 `SITE_TAGLINE` 추가 + `CATEGORY_SEO_TITLE`에서 군더더기 "지도에서" 제거. `useFacilityMeta.setMeta()`의 브랜드 분기와 `setCategoryMeta()`(위치 파라미터 추가)를 정리. `pages/[category]/index.vue`가 `setCategoryMeta()`를 호출하도록 전환하고 페이지 내부 `buildCategorySeo*`를 삭제. h1용 `SEO_TITLES`/`SEO_DESCRIPTIONS`는 유지(주석 명시).

**Tech Stack:** Nuxt 3, Vue 3, Vitest (happy-dom), TypeScript. 테스트 실행: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run <path>`.

**Spec:** `docs/superpowers/specs/2026-06-03-seo-meta-copy-refactor-design.md` (R1, R3, R6, §6.1)

---

## 파일 구조

- Modify: `frontend/utils/seoConstants.ts` — `SITE_TAGLINE` 추가, `CATEGORY_SEO_TITLE` 16개 항목에서 "지도에서 " 제거
- Modify: `frontend/composables/useFacilityMeta.ts` — `setMeta()` 브랜드 분기를 `SITE_TAGLINE` 사용으로, `setCategoryMeta()`에 선택적 위치 파라미터 추가
- Modify: `frontend/pages/[category]/index.vue` — `setCategoryMeta()` 호출로 전환, `buildCategorySeoTitle/Description` 삭제, `SEO_TITLES/SEO_DESCRIPTIONS`는 h1 전용 주석 추가
- Modify: `frontend/app.vue` — 폴백 타이틀을 `SITE_TAGLINE` 사용으로
- Test: `frontend/tests/utils/seoConstants.test.ts`, `frontend/tests/composables/useFacilityMeta.test.ts`

**위치 변형(시/구 선택) 처리 결정(실행 중 사용자 확인 체크포인트):** 위치 없으면 `CATEGORY_SEO_TITLE`(국가 단위 완성형), 위치 있으면 `{지역} {카테고리} 찾기`(키워드 앞배치, intent 꼬리표 제거). description도 동일하게 위치 분기. — 실행 시작 시 이 동작을 사용자에게 한 번 확인할 것.

---

## Task 1: `SITE_TAGLINE` 상수 추가

**Files:**
- Modify: `frontend/utils/seoConstants.ts:6-9`
- Test: `frontend/tests/utils/seoConstants.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/utils/seoConstants.test.ts` 상단 import에 `SITE_TAGLINE` 추가하고, 새 describe 블록 추가:

```typescript
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, DEFAULT_OG_IMAGE, SITE_TAGLINE, CATEGORY_SEO_TITLE, CATEGORY_SEO_DESCRIPTION } from '~/utils/seoConstants'

describe('SITE_TAGLINE', () => {
  it('부동산을 앞세운 단일 부제 문장이다', () => {
    expect(SITE_TAGLINE).toBe('부동산 실거래가·청약·내 주변 생활정보')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/seoConstants.test.ts -t SITE_TAGLINE`
Expected: FAIL — `SITE_TAGLINE` is undefined.

- [ ] **Step 3: 상수 추가**

`frontend/utils/seoConstants.ts`의 `SITE_DESCRIPTION` 아래(line 8 다음)에 추가:

```typescript
export const SITE_TAGLINE = '부동산 실거래가·청약·내 주변 생활정보'
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/seoConstants.test.ts -t SITE_TAGLINE`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/utils/seoConstants.ts frontend/tests/utils/seoConstants.test.ts
git commit -m "feat(seo): add SITE_TAGLINE constant (부동산 앞세운 단일 부제)"
```

---

## Task 2: `CATEGORY_SEO_TITLE`에서 "지도에서 " 제거

**Files:**
- Modify: `frontend/utils/seoConstants.ts:102-119`
- Test: `frontend/tests/utils/seoConstants.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`describe('CATEGORY_SEO_TITLE')` 블록에 추가:

```typescript
it('타이틀에 군더더기 "지도에서" 가 없다', () => {
  Object.values(CATEGORY_SEO_TITLE).forEach(title => {
    expect(title).not.toContain('지도에서')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/seoConstants.test.ts -t '지도에서'`
Expected: FAIL — 현재 모든 항목에 "지도에서" 포함.

- [ ] **Step 3: 상수 수정**

`frontend/utils/seoConstants.ts`의 `CATEGORY_SEO_TITLE`(line 102-119)을 아래로 교체 (각 항목에서 `을/를 지도에서 확인` → `확인`, 위치류는 `위치를 지도에서 확인` → `위치 확인`):

```typescript
export const CATEGORY_SEO_TITLE: Record<FacilityCategory, string> = {
  hospital:     '병원 찾기 - 근처 병원 진료과·진료시간 확인',
  pharmacy:     '약국 찾기 - 근처 약국 영업시간·야간약국 확인',
  parking:      '공영주차장 찾기 - 근처 주차장 요금·운영시간 확인',
  toilet:       '공중화장실 찾기 - 근처 화장실 위치·개방시간 확인',
  aed:          '자동심장충격기(AED) 찾기 - 근처 AED 위치 확인',
  library:      '공공도서관 찾기 - 근처 도서관 운영시간·휴관일 확인',
  clothes:      '의류수거함 찾기 - 근처 헌 옷 수거함 위치·배출 방법 안내',
  trash:        '쓰레기 배출 안내 - 지역별 분리수거 요일·방법을 동별로 확인',
  park:         '공원 찾기 - 근처 공원 산책로·운동시설·위치 확인',
  school:       '학교 찾기 - 근처 초중고 위치·설립유형 정보 확인',
  market:       '전통시장 찾기 - 근처 시장 장날·위치·상점 정보 확인',
  childcare:    '어린이집 찾기 - 근처 어린이집 정원·유형·위치 확인',
  'ev-charger': '전기차 충전소 찾기 - 근처 충전기 종류·이용시간 확인',
  sports:       '공공체육시설 찾기 - 근처 체육관·수영장 위치 확인',
  wifi:         '공공 와이파이 찾기 - 근처 무료 와이파이 위치 확인',
  subway:       '지하철역 찾기 - 근처 지하철역 위치·노선·환승 정보 확인',
}
```

- [ ] **Step 4: 테스트 통과 확인 (기존 CATEGORY_SEO_TITLE 테스트 포함)**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/seoConstants.test.ts`
Expected: PASS (전체). 만약 기존 길이 상한 assertion이 깨지면, 완성형 의도에 맞게 해당 상한 테스트를 현실값으로 갱신(스펙 R3: 목록 페이지는 초과 허용).

- [ ] **Step 5: 커밋**

```bash
git add frontend/utils/seoConstants.ts frontend/tests/utils/seoConstants.test.ts
git commit -m "feat(seo): drop redundant '지도에서' from CATEGORY_SEO_TITLE"
```

---

## Task 3: `setMeta()` 브랜드 분기를 `SITE_TAGLINE`로 통일

**Files:**
- Modify: `frontend/composables/useFacilityMeta.ts:3` (import), `:233-235`
- Test: `frontend/tests/composables/useFacilityMeta.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/composables/useFacilityMeta.test.ts`의 import(line 13) 옆에 `SITE_TAGLINE`를 쓰는 새 테스트 추가:

```typescript
describe('setMeta - 브랜드 부제 통일', () => {
  it('title이 브랜드명과 같을 때 SITE_TAGLINE을 부제로 쓴다', () => {
    const { setMeta } = useFacilityMeta()
    setMeta({ title: '일상킷', description: '설명', path: '/' })
    const call = mockUseSeoMeta.mock.calls[0][0]
    expect(call.title).toBe('일상킷 | 부동산 실거래가·청약·내 주변 생활정보')
  })

  it('일반 title에는 브랜드 suffix가 1회만 붙는다', () => {
    const { setMeta } = useFacilityMeta()
    setMeta({ title: '병원 찾기', description: '설명', path: '/hospital' })
    const call = mockUseSeoMeta.mock.calls[0][0]
    expect(call.title).toBe('병원 찾기 | 일상킷')
    expect(call.title.match(/일상킷/g)).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useFacilityMeta.test.ts -t '브랜드 부제 통일'`
Expected: FAIL — 현재 SITE_NAME 분기가 `${SITE_NAME} | 내 주변 생활 정보` 반환.

- [ ] **Step 3: 구현 수정**

`frontend/composables/useFacilityMeta.ts:3`의 import에 `SITE_TAGLINE` 추가:

```typescript
import { SITE_NAME, SITE_URL, SITE_DESCRIPTION, SITE_TAGLINE, DEFAULT_OG_IMAGE, CATEGORY_SEO_INTENT, CATEGORY_SEO_TITLE, CATEGORY_SEO_DESCRIPTION } from '~/utils/seoConstants'
```

`:233-235`의 분기를 교체:

```typescript
    const fullTitle = normalizedTitle === SITE_NAME
      ? `${SITE_NAME} | ${SITE_TAGLINE}`
      : `${normalizedTitle} | ${SITE_NAME}`
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useFacilityMeta.test.ts`
Expected: PASS (전체).

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useFacilityMeta.ts frontend/tests/composables/useFacilityMeta.test.ts
git commit -m "feat(seo): unify brand tagline via SITE_TAGLINE in setMeta"
```

---

## Task 4: `setCategoryMeta()`에 선택적 위치 파라미터 추가

**Files:**
- Modify: `frontend/composables/useFacilityMeta.ts:294-306`
- Test: `frontend/tests/composables/useFacilityMeta.test.ts`

위치 없으면 `CATEGORY_SEO_TITLE`(완성형), 위치 있으면 키워드 앞배치형 `{지역} {카테고리} 찾기` + 위치 description.

- [ ] **Step 1: 실패하는 테스트 작성**

`describe('setCategoryMeta - CTR 최적화')` 블록에 추가:

```typescript
it('위치 없으면 CATEGORY_SEO_TITLE 완성형을 쓴다', () => {
  const { setCategoryMeta } = useFacilityMeta()
  setCategoryMeta('hospital')
  const call = mockUseSeoMeta.mock.calls[0][0]
  expect(call.title).toBe('병원 찾기 - 근처 병원 진료과·진료시간 확인 | 일상킷')
})

it('위치가 있으면 지역 앞배치 타이틀을 만든다', () => {
  const { setCategoryMeta } = useFacilityMeta()
  setCategoryMeta('hospital', { cityName: '서울', districtName: '강남구' })
  const call = mockUseSeoMeta.mock.calls[0][0]
  expect(call.title).toBe('서울 강남구 병원 찾기 | 일상킷')
  expect(call.description).toContain('서울 강남구')
})

it('위치가 시(city)만 있으면 시 기준 타이틀', () => {
  const { setCategoryMeta } = useFacilityMeta()
  setCategoryMeta('hospital', { cityName: '서울' })
  const call = mockUseSeoMeta.mock.calls[0][0]
  expect(call.title).toBe('서울 병원 찾기 | 일상킷')
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useFacilityMeta.test.ts -t setCategoryMeta`
Expected: FAIL — 현재 `setCategoryMeta`는 위치 인자를 받지 않음.

- [ ] **Step 3: 구현 수정**

`frontend/composables/useFacilityMeta.ts:294-306`의 `setCategoryMeta`를 교체:

```typescript
  /**
   * 카테고리 페이지 메타태그 (head 전용).
   * 위치 없으면 CATEGORY_SEO_TITLE 완성형, 위치 있으면 {지역} {카테고리} 찾기 앞배치형.
   * 화면 h1/hero는 페이지의 SEO_TITLES(Set C)가 별도로 담당한다.
   */
  function setCategoryMeta(category: FacilityCategory, location?: { cityName?: string; districtName?: string }) {
    const categoryName = CATEGORY_META[category]?.label || category
    const loc = [location?.cityName, location?.districtName].filter(Boolean).join(' ')

    if (loc) {
      setMeta({
        title: `${loc} ${categoryName} 찾기`,
        description: `${loc} ${categoryName} 위치와 운영시간을 지도에서 확인하세요. 가까운 ${categoryName}을(를) 빠르게 찾을 수 있습니다.`,
        path: `/${category}`,
      })
      return
    }

    const intent = CATEGORY_SEO_INTENT[category] || '정보'
    setMeta({
      title: CATEGORY_SEO_TITLE[category] ?? `${categoryName} 찾기`,
      description: CATEGORY_SEO_DESCRIPTION[category] ?? `전국 ${categoryName}의 ${intent} 정보를 한눈에 확인하세요.`,
      path: `/${category}`,
    })
  }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useFacilityMeta.test.ts`
Expected: PASS (전체).

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useFacilityMeta.ts frontend/tests/composables/useFacilityMeta.test.ts
git commit -m "feat(seo): setCategoryMeta accepts optional location variant"
```

---

## Task 5: 카테고리 페이지가 `setCategoryMeta()`를 호출하도록 전환

**Files:**
- Modify: `frontend/pages/[category]/index.vue` — `buildCategorySeoTitle`(429-436)·`buildCategorySeoDescription`(438-445) 삭제, `setMeta(...)` 직접 호출(483-488)을 `setCategoryMeta(...)`로 교체, 페이지네이션 재계산부(769-770) 정리, `SEO_TITLES/SEO_DESCRIPTIONS`(394-427)에 h1 전용 주석 추가
- Test: `frontend/tests/pages/[category]/index.test.ts` (있으면) 또는 수동 검증

- [ ] **Step 1: `setCategoryMeta` 구조분해에 추가 + 함수 삭제**

`pages/[category]/index.vue`에서 `useFacilityMeta()` 구조분해에 `setCategoryMeta` 포함. `buildCategorySeoTitle`(429-436), `buildCategorySeoDescription`(438-445) 함수 2개 삭제.

- [ ] **Step 2: SSR 메타 호출 교체**

현재(483-488):

```typescript
setMeta({
  title: buildCategorySeoTitle(route.params.category as FacilityCategory, initialCityName, initialDistrictName),
  description: buildCategorySeoDescription(route.params.category as FacilityCategory, initialCityName, initialDistrictName),
  path: `/${route.params.category}`,
  ...(initialPageQueryParam >= 2 ? { canonical: false as const } : {}),
})
```

교체:

```typescript
if (initialPageQueryParam >= 2) {
  // 2페이지+ 는 noindex 정책 — setMeta로 canonical:false 직접 지정
  setMeta({
    title: initialCityName
      ? `${[initialCityName, initialDistrictName].filter(Boolean).join(' ')} ${catLabel} 찾기`
      : (CATEGORY_SEO_TITLE[route.params.category as FacilityCategory] ?? `${catLabel} 찾기`),
    description: `${catLabel} 검색 결과 ${initialPageQueryParam}페이지`,
    path: `/${route.params.category}`,
    canonical: false,
  })
} else {
  setCategoryMeta(route.params.category as FacilityCategory, {
    cityName: initialCityName || undefined,
    districtName: initialDistrictName || undefined,
  })
}
```

(파일 상단 import에 `CATEGORY_SEO_TITLE`가 없으면 `~/utils/seoConstants`에서 추가. 현재 `CATEGORY_SEO_INTENT`만 import 중 — 279행 참고.)

- [ ] **Step 3: 클라이언트 재계산부 정리**

769-770의 `buildCategorySeoTitle/Description` 호출을 동일 로직으로 교체. 해당 위치의 watch/computed가 `setMeta`를 다시 부른다면 `setCategoryMeta(cat, { cityName: selectedCity.value || undefined, districtName: selectedDistrict.value || undefined })` 로 교체.

- [ ] **Step 4: SEO_TITLES/SEO_DESCRIPTIONS에 h1 전용 주석**

`SEO_TITLES`(394) 위에 주석 추가:

```typescript
// h1/hero 전용 (Set C). <head> title/description은 setCategoryMeta(CATEGORY_SEO_*)가 담당한다.
const SEO_TITLES: Record<string, string> = {
```

- [ ] **Step 5: 빌드/타입 체크 + 전체 테스트**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx nuxi typecheck && npx vitest run`
Expected: 타입 에러 없음, 전체 테스트 PASS. (`buildCategorySeoTitle` 잔여 참조가 있으면 에러로 드러남 → 제거.)

- [ ] **Step 6: 수동 SSR 검증**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run dev` 후
`curl -s localhost:3000/hospital | grep -o '<title>[^<]*</title>'`
Expected: `<title>병원 찾기 - 근처 병원 진료과·진료시간 확인 | 일상킷</title>`
`curl -s 'localhost:3000/hospital?city=seoul&district=gangnam' | grep -o '<title>[^<]*</title>'`
Expected: `<title>서울 강남구 병원 찾기 | 일상킷</title>`

- [ ] **Step 7: 커밋**

```bash
git add frontend/pages/'[category]'/index.vue
git commit -m "refactor(seo): wire setCategoryMeta into category page, drop thin builders"
```

---

## Task 6: `app.vue` 폴백 타이틀을 `SITE_TAGLINE`로

**Files:**
- Modify: `frontend/app.vue:10-15`
- Test: 수동(SSR head)

- [ ] **Step 1: 구현 수정**

`app.vue`의 `useHead` 폴백 타이틀을 `SITE_TAGLINE` 사용으로:

```typescript
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION } from '~/utils/seoConstants'

useHead({
  titleTemplate: (title) => title || `${SITE_NAME} - ${SITE_TAGLINE}`,
  meta: [
    { name: 'description', content: SITE_DESCRIPTION },
  ],
})
```

(현재 하드코딩된 `일상킷 - 내 주변 생활 편의 정보`·description 리터럴을 상수 참조로 교체. `nuxt.config.ts:192`의 기본 title도 동일 문자열이면 `${SITE_NAME} - ${SITE_TAGLINE}` 값과 일치하도록 맞춤 — nuxt.config은 상수 import이 어려우므로 리터럴 `일상킷 - 부동산 실거래가·청약·내 주변 생활정보`로 직접 갱신.)

- [ ] **Step 2: 빌드 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run && npx nuxi typecheck`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
git add frontend/app.vue frontend/nuxt.config.ts
git commit -m "refactor(seo): use SITE_TAGLINE for fallback title"
```

---

## Task 7: PR1 최종 검증

- [ ] **Step 1: 전체 프론트 테스트 + 린트**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run && npm run lint`
Expected: 전부 PASS.

- [ ] **Step 2: PR 생성 (main 직접 커밋 금지 — develop 기준 브랜치)**

```bash
git push -u origin HEAD
gh pr create --base develop --title "refactor(seo) PR1: 메타 단일소스화 + 카테고리 head/h1 분리" --body "spec: 2026-06-03-seo-meta-copy-refactor-design.md PR1. CATEGORY_SEO_* 부활 연결, SITE_TAGLINE 통일, 빈약 빌더 제거."
```

- [ ] **Step 3: CI 통과 확인 후 머지 (ground-truth 재확인 — 실제 run headSha)**

---

## Self-Review 메모
- **Spec 커버리지(PR1 범위)**: R1(브랜드 1회·SITE_TAGLINE) ✓ Task3·6 / R3·R6(완성형+지도에서 제거) ✓ Task2·4·5 / §6.1(setCategoryMeta 실연결, 빌더 삭제, SEO_* h1 전용) ✓ Task4·5.
- **타입 일관성**: `setCategoryMeta(category, location?)` 시그니처가 Task4 정의 ↔ Task5 호출 일치.
- **체크포인트**: 위치 변형 타이틀/디스크립션 문구(Task4 Step3)는 실행 시작 시 사용자 확인.
- **후속 PR**: PR2(부동산 메타: 브랜드·30자·desc 재배치·시설 우선순위), PR3(raw useHead→setMeta 흡수), PR4(화면 카피·용어·메시지)는 동일 형식의 별도 계획 문서로 작성 예정.
