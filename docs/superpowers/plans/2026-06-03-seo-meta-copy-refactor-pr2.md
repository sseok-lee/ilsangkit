# SEO 메타 리팩터 PR2 — 부동산 건물 상세 메타 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 부동산 건물 상세의 title에 브랜드를 부착하고 30자 이내로 압축하며, description에서 주변 생활시설(학교·병원)을 앞으로 끌어와 SERP 잘림선 안쪽에 노출한다. 시설 카테고리 우선순위를 부동산 맥락에 맞게 재정렬한다.

**Architecture:** `useRealEstateDetailMeta.ts`의 `buildTitle`(브랜드+30자 가드+거래유형 키워드화)·`buildDescription`(주변 생활시설 앞배치+중간 압축)을 수정. `[buildingName].vue`의 SSR `facilitySummary` 생성부 `DISPLAY_CATS` 우선순위 재정렬 및 접미사 변경.

**Tech Stack:** Nuxt 3, Vitest. 테스트: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run <path>`.

**Spec:** `docs/superpowers/specs/2026-06-03-seo-meta-copy-refactor-design.md` §5, R1, R4

**선행:** PR1 머지(또는 `SITE_TAGLINE`/`SITE_NAME` 존재) 권장. 본 PR은 `SITE_NAME`만 사용하므로 PR1 없이도 가능.

---

## 파일 구조

- Modify: `frontend/composables/useRealEstateDetailMeta.ts` — `buildTitle`(56-66)·`buildDescription`(68-111)
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` — `DISPLAY_CATS`/라벨/접미사(1027-1036)
- Create: `frontend/tests/composables/useRealEstateDetailMeta.test.ts`

---

## Task 1: buildTitle — 브랜드 부착 + 30자 가드 + 거래유형 키워드화

**Files:**
- Modify: `frontend/composables/useRealEstateDetailMeta.ts:1` (import), `:56-66`
- Test: `frontend/tests/composables/useRealEstateDetailMeta.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/composables/useRealEstateDetailMeta.test.ts` 생성:

```typescript
import { describe, it, expect } from 'vitest'
import { buildRealEstateDetailMeta, type DetailMetaInput } from '~/composables/useRealEstateDetailMeta'

const base: DetailMetaInput = {
  buildingName: '래미안대치팰리스',
  region: { city: '서울특별시', district: '강남구', dong: '대치동' },
  propertyType: 'apt',
  transactionMode: 'sale',
  summary: { totalCount: 312, recentDeal: { amount: 285000, dealDate: '2025.3' } },
  buildYear: 2015,
  areaRange: { min: 84, max: 114 },
  facilitySummary: '학교 4곳·병원 6곳',
}

describe('buildRealEstateDetailMeta - title', () => {
  it('브랜드 | 일상킷 가 1회 붙는다', () => {
    const { title } = buildRealEstateDetailMeta(base)
    expect(title.endsWith(' | 일상킷')).toBe(true)
    expect(title.match(/일상킷/g)).toHaveLength(1)
  })

  it('아파트는 "아파트" 타입어를 생략한다', () => {
    const { title } = buildRealEstateDetailMeta(base)
    expect(title).toBe('래미안대치팰리스 매매 실거래가 | 일상킷')
  })

  it('빌라/오피스텔은 타입어를 유지한다', () => {
    const { title } = buildRealEstateDetailMeta({ ...base, buildingName: '역삼e편한세상', propertyType: 'villa', transactionMode: 'rent' })
    expect(title).toBe('역삼e편한세상 빌라 전월세 실거래가 | 일상킷')
  })

  it('이름이 길면 타입어를 생략해 30자에 근접시킨다', () => {
    const { title } = buildRealEstateDetailMeta({ ...base, buildingName: '강남역푸르지오시티', propertyType: 'offitel', transactionMode: 'rent' })
    expect(title).toBe('강남역푸르지오시티 전월세 실거래가 | 일상킷')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useRealEstateDetailMeta.test.ts -t title`
Expected: FAIL — 현재 title은 `… 실거래 · 서울 강남구 대치동`(브랜드 없음).

- [ ] **Step 3: 구현 수정**

`frontend/composables/useRealEstateDetailMeta.ts:1` 위에 import 추가:

```typescript
import { SITE_NAME } from '~/utils/seoConstants'
```

`:56-66`의 `buildTitle`을 교체:

```typescript
function buildTitle(input: DetailMetaInput): string {
  const propertyLabel = PROPERTY_LABEL[input.propertyType]
  const transactionLabel = TRANSACTION_LABEL[input.transactionMode]
  // 아파트는 이름이 타입을 암시 → 타입어 생략. 빌라/오피스텔은 유지
  const typePart = input.propertyType === 'apt' ? '' : `${propertyLabel} `
  let core = `${input.buildingName} ${typePart}${transactionLabel} 실거래가`
  // 30자(브랜드 제외 ~24자) 초과 + 타입어 있으면 타입어 생략
  if (core.length > 24 && typePart) {
    core = `${input.buildingName} ${transactionLabel} 실거래가`
  }
  return `${core} | ${SITE_NAME}`
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useRealEstateDetailMeta.test.ts -t title`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useRealEstateDetailMeta.ts frontend/tests/composables/useRealEstateDetailMeta.test.ts
git commit -m "feat(seo): RE detail title gets brand + 30char guard + tx keyword"
```

---

## Task 2: buildDescription — 주변 생활시설 앞배치 + 중간 압축

**Files:**
- Modify: `frontend/composables/useRealEstateDetailMeta.ts:68-111`
- Test: `frontend/tests/composables/useRealEstateDetailMeta.test.ts`

`facilitySummary` 입력은 Task(PR2-3)에서 `학교 4곳·병원 6곳`(접미사 없는 형태)로 바뀐다. buildDescription이 `… 등 주변 생활시설과`로 감싼다.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
describe('buildRealEstateDetailMeta - description', () => {
  it('주변 생활시설(학교·병원)을 면적/마무리보다 앞에 배치한다', () => {
    const { description } = buildRealEstateDetailMeta(base)
    const facIdx = description.indexOf('주변 생활시설')
    const areaIdx = description.indexOf('면적별')
    expect(facIdx).toBeGreaterThan(-1)
    expect(facIdx).toBeLessThan(areaIdx)
    expect(description).toContain('학교 4곳·병원 6곳 등 주변 생활시설')
  })

  it('준공년도 문구를 더는 넣지 않는다(압축)', () => {
    const { description } = buildRealEstateDetailMeta(base)
    expect(description).not.toContain('준공')
  })

  it('전체 길이 100자 이하', () => {
    const { description } = buildRealEstateDetailMeta(base)
    expect(description.length).toBeLessThanOrEqual(100)
  })

  it('facilitySummary 없으면 "주변 생활시설과"로 일반화', () => {
    const { description } = buildRealEstateDetailMeta({ ...base, facilitySummary: null })
    expect(description).toContain('주변 생활시설과')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useRealEstateDetailMeta.test.ts -t description`
Expected: FAIL — 현재 생활시설이 맨 뒤 + 준공 포함 + 100자 초과.

- [ ] **Step 3: 구현 수정**

`frontend/composables/useRealEstateDetailMeta.ts:68-111`의 `buildDescription`을 교체:

```typescript
function buildDescription(input: DetailMetaInput): string {
  const propertyLabel = PROPERTY_LABEL[input.propertyType]
  const transactionLabel = TRANSACTION_LABEL[input.transactionMode]
  const cityShort = shortCityName(input.region.city)
  const regionLabel = [cityShort, input.region.district].filter(Boolean).join(' ')

  const totalCount = input.summary?.totalCount ?? 0
  const recentDeal = input.summary?.recentDeal
  const areaText = formatArea(input.areaRange)

  const facilityClause = input.facilitySummary
    ? `${input.facilitySummary} 등 주변 생활시설과 `
    : '주변 생활시설과 '
  const areaClause = areaText ? `전용 ${areaText} ` : ''

  if (totalCount === 0) {
    return `${regionLabel} ${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래가. ${facilityClause}${areaClause}면적별 시세를 함께 확인하세요.`.replace(/\s+/g, ' ').trim()
  }

  const priceText = recentDeal ? formatKoreanPrice(recentDeal.amount) : ''
  const priceClause = priceText ? `, 최근 ${priceText}(${recentDeal!.dealDate})` : ''
  const opening = `${regionLabel} ${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래 ${totalCount.toLocaleString()}건${priceClause}.`

  return `${opening} ${facilityClause}${areaClause}면적별 시세를 함께 확인하세요.`.replace(/\s+/g, ' ').trim()
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useRealEstateDetailMeta.test.ts`
Expected: PASS (전체).

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useRealEstateDetailMeta.ts frontend/tests/composables/useRealEstateDetailMeta.test.ts
git commit -m "feat(seo): RE detail desc front-loads 주변 생활시설, compresses middle"
```

---

## Task 3: facilitySummary 시설 우선순위 재정렬 + 접미사 제거

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:1027-1036`
- Test: 수동 SSR(데이터 의존) — 단위 테스트는 §Task2가 facilitySummary 포맷을 커버

- [ ] **Step 1: 구현 수정**

`[buildingName].vue:1027-1036`을 교체 (우선순위 `school→hospital→park→childcare→sports→pharmacy`, `·` 조인, `등 생활시설` 접미사 제거 → buildDescription이 `등 주변 생활시설`을 부착):

```typescript
        const DISPLAY_CATS = ['school', 'hospital', 'park', 'childcare', 'sports', 'pharmacy'] as const
        const FACILITY_LABELS: Record<string, string> = {
          school: '학교', hospital: '병원', park: '공원', childcare: '어린이집', sports: '체육시설', pharmacy: '약국',
        }
        const parts = DISPLAY_CATS
          .map(cat => ({ cat, count: facilityItems.filter((i: any) => i.category === cat).length }))
          .filter(({ count }) => count > 0)
          .slice(0, 2)
          .map(({ cat, count }) => `${FACILITY_LABELS[cat]} ${count}곳`)
        if (parts.length > 0) facilitySummarySSR = parts.join('·')
```

(상위 3개→2개로 축소: 앞배치 후 길이 확보. 접미사를 buildDescription으로 이관.)

- [ ] **Step 2: 빌드/타입 체크 + 전체 테스트**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx nuxi typecheck && npx vitest run`
Expected: PASS.

- [ ] **Step 3: 수동 SSR 검증 (좌표 있는 단지)**

Run: dev 서버 후 임의 건물 상세 `curl -s '<building-url>' | grep -o '<meta name="description"[^>]*>'`
Expected: `… 실거래 N건, 최근 …. 학교 N곳·병원 N곳 등 주변 생활시설과 전용 …㎡ 면적별 시세를 함께 확인하세요.`

- [ ] **Step 4: 커밋**

```bash
git add frontend/pages/real-estate/'[realEstateType]'/'[city]'/'[district]'/'[buildingName]'.vue
git commit -m "feat(seo): reorder RE nearby-facility priority (school→hospital→park)"
```

---

## Task 4: PR2 최종 검증 + PR 생성

- [ ] **Step 1: 전체 테스트 + 린트**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run && npm run lint`
Expected: PASS.

- [ ] **Step 2: PR 생성 + CI 통과 후 머지 (ground-truth 재확인)**

```bash
git push -u origin HEAD
gh pr create --base develop --title "refactor(seo) PR2: 부동산 건물 상세 메타(브랜드·30자·생활시설 앞배치)" --body "spec §5"
```

---

## Self-Review 메모
- **Spec 커버리지**: R1(브랜드) ✓ Task1 / R4(30자 가드) ✓ Task1 / §5(주변 생활시설 앞배치·중간 압축·우선순위 school→hospital) ✓ Task2·3.
- **타입 일관성**: `DetailMetaInput` export 필요 — `useRealEstateDetailMeta.ts`에서 `export interface DetailMetaInput`(이미 export됨, :15) 확인. 테스트가 `import { ..., type DetailMetaInput }` 사용.
- **데이터 정직성**: "학교 N곳"은 반경 1km 카운트(사실). "학군" 단어 미사용.
