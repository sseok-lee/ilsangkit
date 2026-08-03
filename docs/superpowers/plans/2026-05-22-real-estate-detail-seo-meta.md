# 부동산 단지 상세 SEO 메타 & OG 라우트 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 단지 상세 페이지의 title/description을 단지마다 차별화된 키워드 풍부한 형태로 재설계하고, OG 라우트의 다단계 302 fallback을 inline 200 응답으로 바꿔 봇이 항상 이미지를 받도록 한다.

**Architecture:** title/description 생성을 순수 함수 composable로 추출(TDD 가능). backend `getBuildingInfo`에 대표 동/리 필드 추가. og-map의 NCP 실패 처리를 인라인 SVG/PNG 응답으로 변경. 전부 단일 PR로 통합.

**Tech Stack:** Nuxt 3, Vue 3, Express 5 + Prisma, Vitest, TypeScript ESM.

**Spec:** `docs/superpowers/specs/2026-05-22-real-estate-detail-seo-meta-design.md`

**Branch:** `feat/real-estate-detail-seo`

---

## File Structure

**Backend:**
- Modify: `backend/src/services/realEstateService.ts` — `getBuildingInfo`에 `dongName` 추가
- Modify: `backend/src/schemas/realEstate.ts` (또는 관련 schema) — `BuildingInfoSchema`에 `dongName: z.string().nullable().optional()` 추가
- Test: `backend/__tests__/services/realEstateService.dongName.test.ts` (신규)

**Frontend:**
- Create: `frontend/composables/useRealEstateDetailMeta.ts` — 순수 함수 `buildRealEstateDetailMeta`
- Test: `frontend/tests/composables/useRealEstateDetailMeta.test.ts` (신규)
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:558-611` — `useHead`가 composable 호출
- Modify: `frontend/server/routes/og-map.get.ts` — sanitizeLabel + inlineFallback + 로깅
- Test: `frontend/tests/server/og-map.test.ts` (신규)

**Scripts:**
- Create: `scripts/verify-og.sh` — 배포 후 OG 라우트 smoke 테스트

**Types:**
- Modify: `frontend/types/realEstate.ts` 또는 `frontend/composables/useRealEstate.ts` — `BuildingInfo` 타입에 `dongName?: string | null` 추가

---

## Task 1: Backend `getBuildingInfo`에 대표 dongName 추가

**Files:**
- Modify: `backend/src/services/realEstateService.ts:477-` (getBuildingInfo 함수)
- Modify: `backend/src/schemas/realEstate.ts` (BuildingInfoSchema 응답 검증)
- Test: `backend/__tests__/services/realEstateService.dongName.test.ts` (신규)

### Step 1.1: 현재 `getBuildingInfo` 구조 확인

- [ ] **Read current implementation**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
sed -n '440,540p' backend/src/services/realEstateService.ts
```

`getBuildingInfo(apiSlug, bjdCode, buildingName)` 시그니처와 현재 반환 객체 형태를 메모. 트랜잭션 테이블 모델명(`aptSaleTransaction` 등)이 어떻게 분기되는지 확인.

### Step 1.2: 실패하는 테스트 작성

- [ ] **Write failing test**

`backend/__tests__/services/realEstateService.dongName.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { getBuildingInfo } from '../../src/services/realEstateService.js'
import prisma from '../../src/lib/prisma.js'

describe('getBuildingInfo dongName', () => {
  const fixtureBjd = '99999'
  const fixtureBuilding = '테스트단지A'

  beforeAll(async () => {
    await prisma.aptSaleTransaction.deleteMany({ where: { bjdCode: fixtureBjd } })
    await prisma.aptSaleTransaction.createMany({
      data: [
        // 동A: 3건 (최다)
        { id: 'fx-1', bjdCode: fixtureBjd, buildingName: fixtureBuilding, dongName: '동A', dealAmount: 10000n, dealYear: 2026, dealMonth: 5, dealDay: 1, exclusiveArea: 60, floor: 3, buildYear: 1996, sourceId: 'fx-1' },
        { id: 'fx-2', bjdCode: fixtureBjd, buildingName: fixtureBuilding, dongName: '동A', dealAmount: 10500n, dealYear: 2026, dealMonth: 5, dealDay: 2, exclusiveArea: 60, floor: 3, buildYear: 1996, sourceId: 'fx-2' },
        { id: 'fx-3', bjdCode: fixtureBjd, buildingName: fixtureBuilding, dongName: '동A', dealAmount: 11000n, dealYear: 2026, dealMonth: 5, dealDay: 3, exclusiveArea: 60, floor: 3, buildYear: 1996, sourceId: 'fx-3' },
        // 동B: 1건
        { id: 'fx-4', bjdCode: fixtureBjd, buildingName: fixtureBuilding, dongName: '동B', dealAmount: 9500n, dealYear: 2026, dealMonth: 5, dealDay: 4, exclusiveArea: 60, floor: 3, buildYear: 1996, sourceId: 'fx-4' },
      ],
    })
  })

  afterAll(async () => {
    await prisma.aptSaleTransaction.deleteMany({ where: { bjdCode: fixtureBjd } })
  })

  it('returns dongName with the highest transaction count for the building', async () => {
    const info = await getBuildingInfo('apt-sale', fixtureBjd, fixtureBuilding)
    expect(info).toBeTruthy()
    expect(info?.dongName).toBe('동A')
  })

  it('returns dongName=null when no transactions exist', async () => {
    const info = await getBuildingInfo('apt-sale', fixtureBjd, '존재하지않는단지')
    expect(info?.dongName ?? null).toBeNull()
  })
})
```

(스키마 필드명은 `backend/prisma/schema.prisma`의 `AptSaleTransaction` 모델 확인 후 누락 필드 추가 — 테스트 작성 전에 1회 `head -30 backend/prisma/schema.prisma | grep -A 30 AptSaleTransaction` 으로 정렬)

### Step 1.3: 테스트 실패 확인

- [ ] **Run test, expect FAIL**

```bash
cd backend && npx vitest run __tests__/services/realEstateService.dongName.test.ts 2>&1 | tail -20
```

Expected: `dongName` 필드가 응답에 없거나 undefined로 FAIL.

### Step 1.4: `getBuildingInfo`에 dongName 산출 로직 추가

- [ ] **Modify `backend/src/services/realEstateService.ts`**

`getBuildingInfo` 함수 내부, 기존 building 조회 후 다음 블록 추가:

```typescript
// 대표 동/리: 해당 단지의 거래 중 가장 많이 등장한 dongName 1개
const txModel = getTransactionModel(apiSlug)  // 기존 헬퍼 사용 또는 인라인 switch
const dongGroups = await txModel.groupBy({
  by: ['dongName'],
  where: { bjdCode, buildingName, dongName: { not: '' } },
  _count: { _all: true },
  orderBy: { _count: { dongName: 'desc' } },
  take: 1,
})
const dongName = dongGroups[0]?.dongName ?? null
```

기존 반환 객체에 `dongName` 필드 추가:
```typescript
return {
  // ... 기존 필드
  dongName,
}
```

`getTransactionModel(apiSlug)` 헬퍼가 없으면 인라인 분기 작성 (`apt-sale` → `prisma.aptSaleTransaction`, `apt-rent` → `prisma.aptRentTransaction`, 등 6개).

### Step 1.5: 테스트 통과 확인

- [ ] **Run test, expect PASS**

```bash
cd backend && npx vitest run __tests__/services/realEstateService.dongName.test.ts 2>&1 | tail -10
```

Expected: 2/2 PASS.

### Step 1.6: 응답 스키마(zod)에 dongName 옵션 필드 추가

- [ ] **Modify schema**

`backend/src/schemas/realEstate.ts` (또는 `BuildingInfo` 응답 스키마 정의된 파일):

```typescript
export const BuildingInfoSchema = z.object({
  // ... 기존 필드
  dongName: z.string().nullable().optional(),
})
```

### Step 1.7: 전체 백엔드 테스트 실행

- [ ] **Run full backend test suite, expect no regression**

```bash
cd backend && npm run test 2>&1 | tail -30
```

Expected: 기존 통과 테스트가 모두 PASS. dongName 테스트 추가.

### Step 1.8: 커밋

- [ ] **Commit**

```bash
git add backend/src/services/realEstateService.ts backend/src/schemas/realEstate.ts backend/__tests__/services/realEstateService.dongName.test.ts
git commit -m "feat(real-estate): getBuildingInfo가 대표 동/리(dongName) 반환

각 단지의 트랜잭션 중 가장 많이 등장한 dongName 1개를 반환.
시군구 + 동 표기로 SEO 타이틀 차별화를 위한 사전 작업."
```

---

## Task 2: 프론트엔드 `buildRealEstateDetailMeta` composable 신규

**Files:**
- Create: `frontend/composables/useRealEstateDetailMeta.ts`
- Test: `frontend/tests/composables/useRealEstateDetailMeta.test.ts`

### Step 2.1: 실패하는 테스트 작성

- [ ] **Write failing tests**

`frontend/tests/composables/useRealEstateDetailMeta.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { buildRealEstateDetailMeta } from '~/composables/useRealEstateDetailMeta'

const base = {
  buildingName: '새한A',
  region: { city: '광주', district: '북구', dong: '용봉동' },
  propertyType: 'apt' as const,
  transactionMode: 'sale' as const,
  buildYear: 1996,
  areaRange: { min: 60 },
  facilitySummary: '학교 5곳, 병원 12곳 등 생활시설',
} as const

describe('buildRealEstateDetailMeta', () => {
  it('full payload — title with dong, description with all chunks', () => {
    const { title, description } = buildRealEstateDetailMeta({
      ...base,
      summary: {
        totalCount: 30,
        recentDeal: { amount: 10700, dealDate: '2026년 5월' },
      },
    })
    expect(title).toBe('새한A 아파트 매매 실거래 · 광주 북구 용봉동')
    expect(description).toContain('광주 북구 새한A 아파트 매매 실거래 30건')
    expect(description).toContain('최근 거래가는 1억 700만원(2026년 5월)')
    expect(description).toContain('1996년 준공된 단지입니다')
    expect(description).toContain('전용 60㎡')
    expect(description).toContain('인근 학교 5곳, 병원 12곳 등 생활시설')
    expect(description).toContain('주변 시세를 함께 확인하세요')
  })

  it('dong missing — title omits dong segment', () => {
    const { title } = buildRealEstateDetailMeta({
      ...base,
      region: { city: '광주', district: '북구' },
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(title).toBe('새한A 아파트 매매 실거래 · 광주 북구')
  })

  it('city+district missing — title is buildingName-only', () => {
    const { title } = buildRealEstateDetailMeta({
      ...base,
      region: { city: '', district: '' },
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(title).toBe('새한A 아파트 매매 실거래')
  })

  it('totalCount 0 — description omits count clause', () => {
    const { description } = buildRealEstateDetailMeta({
      ...base,
      summary: { totalCount: 0 },
    })
    expect(description).not.toMatch(/실거래 \d+건/)
    expect(description).toContain('주변 시세를 함께 확인하세요')
  })

  it('buildYear null — description omits "준공된 단지입니다"', () => {
    const { description } = buildRealEstateDetailMeta({
      ...base,
      buildYear: null,
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).not.toContain('준공된 단지입니다')
    expect(description).toContain('최근 거래가는 1억 700만원')
  })

  it('areaRange range — formats as min~max', () => {
    const { description } = buildRealEstateDetailMeta({
      ...base,
      areaRange: { min: 39, max: 59 },
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).toContain('전용 39~59㎡')
  })

  it('facilitySummary null — description omits "인근 ... 생활시설" but keeps 주변 시세', () => {
    const { description } = buildRealEstateDetailMeta({
      ...base,
      facilitySummary: null,
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).not.toContain('인근')
    expect(description).toContain('주변 시세를 함께 확인하세요')
  })

  it('all optionals missing — minimal description', () => {
    const { description } = buildRealEstateDetailMeta({
      buildingName: '새한A',
      region: { city: '광주', district: '북구' },
      propertyType: 'apt',
      transactionMode: 'sale',
      buildYear: null,
      areaRange: null,
      facilitySummary: null,
      summary: null,
    })
    expect(description).toBe('광주 북구 새한A 아파트 매매 실거래가. 주변 시세를 함께 확인하세요.')
  })

  it('rent mode — uses 전월세 label', () => {
    const { title, description } = buildRealEstateDetailMeta({
      ...base,
      transactionMode: 'rent',
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(title).toContain('전월세 실거래')
    expect(description).toContain('전월세 실거래 30건')
  })

  it('villa — uses 빌라 label', () => {
    const { title } = buildRealEstateDetailMeta({
      ...base,
      propertyType: 'villa',
      summary: null,
    })
    expect(title).toContain('빌라')
  })

  it('offitel — uses 오피스텔 label', () => {
    const { title } = buildRealEstateDetailMeta({
      ...base,
      propertyType: 'offitel',
      summary: null,
    })
    expect(title).toContain('오피스텔')
  })
})
```

### Step 2.2: 테스트 실패 확인

- [ ] **Run, expect FAIL**

```bash
cd frontend && npx vitest run tests/composables/useRealEstateDetailMeta.test.ts 2>&1 | tail -20
```

Expected: 모든 케이스 FAIL ("buildRealEstateDetailMeta is not a function").

### Step 2.3: composable 구현

- [ ] **Create `frontend/composables/useRealEstateDetailMeta.ts`**

```typescript
type PropertyType = 'apt' | 'villa' | 'offitel'
type TransactionMode = 'sale' | 'rent'

const PROPERTY_LABEL: Record<PropertyType, string> = {
  apt: '아파트',
  villa: '빌라',
  offitel: '오피스텔',
}

const TRANSACTION_LABEL: Record<TransactionMode, string> = {
  sale: '매매',
  rent: '전월세',
}

export interface DetailMetaInput {
  buildingName: string
  region: { city: string; district: string; dong?: string | null }
  propertyType: PropertyType
  transactionMode: TransactionMode
  summary: {
    totalCount?: number
    recentDeal?: { amount: number; dealDate: string }
  } | null
  buildYear?: number | null
  areaRange?: { min: number; max?: number } | null
  facilitySummary?: string | null
}

export interface DetailMetaResult {
  title: string
  description: string
}

function formatKoreanPrice(amountManwon: number): string {
  if (!Number.isFinite(amountManwon) || amountManwon <= 0) return ''
  const eok = Math.floor(amountManwon / 10000)
  const manwon = amountManwon % 10000
  if (eok > 0 && manwon > 0) {
    return `${eok}억 ${manwon.toLocaleString()}만원`
  }
  if (eok > 0) return `${eok}억원`
  return `${manwon.toLocaleString()}만원`
}

function formatArea(range: { min: number; max?: number } | null | undefined): string | null {
  if (!range || !Number.isFinite(range.min)) return null
  const min = Math.round(range.min)
  if (range.max !== undefined && Math.round(range.max) !== min) {
    return `${min}~${Math.round(range.max)}㎡`
  }
  return `${min}㎡`
}

function buildTitle(input: DetailMetaInput): string {
  const propertyLabel = PROPERTY_LABEL[input.propertyType]
  const transactionLabel = TRANSACTION_LABEL[input.transactionMode]
  const head = `${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래`

  const cityShort = (input.region.city || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const locParts = [cityShort, input.region.district, input.region.dong || '']
    .filter((p) => p && p.length > 0)
  if (locParts.length === 0) return head
  return `${head} · ${locParts.join(' ')}`
}

function buildDescription(input: DetailMetaInput): string {
  const propertyLabel = PROPERTY_LABEL[input.propertyType]
  const transactionLabel = TRANSACTION_LABEL[input.transactionMode]
  const cityShort = (input.region.city || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const regionLabel = [cityShort, input.region.district].filter(Boolean).join(' ')

  const totalCount = input.summary?.totalCount ?? 0
  const recentDeal = input.summary?.recentDeal
  const buildYear = input.buildYear
  const areaText = formatArea(input.areaRange)

  // 최소 케이스: 거래량 0
  if (totalCount === 0) {
    return `${regionLabel} ${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래가. 주변 시세를 함께 확인하세요.`
  }

  // 메인 절: "{region} {name} {type} {mode} 실거래 {N}건."
  const opening = `${regionLabel} ${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래 ${totalCount.toLocaleString()}건.`

  // 가격 + 준공 절
  const priceFragments: string[] = []
  if (recentDeal) {
    const priceText = formatKoreanPrice(recentDeal.amount)
    if (priceText) {
      priceFragments.push(`최근 거래가는 ${priceText}(${recentDeal.dealDate})`)
    }
  }
  if (buildYear) {
    priceFragments.push(`${buildYear}년 준공된 단지입니다`)
  }
  const priceSentence = priceFragments.length > 0
    ? `${priceFragments.join(', ')}.`
    : ''
  // priceFragments가 ["최근 거래가는 X(날짜)"]만 있으면 마지막에 "입니다" 강제
  // priceFragments가 ["...단지입니다"]만 있는 케이스 (recentDeal 없음) → '단지입니다' 가 마지막
  // → 단순 join 후 마침표면 "최근 거래가는 X" 만 있을 때 자연스럽지 않으므로 보정
  const priceSentenceFixed = (() => {
    if (priceFragments.length === 0) return ''
    if (priceFragments.length === 1 && recentDeal && !buildYear) {
      return `${priceFragments[0]}입니다.`
    }
    if (priceFragments.length === 1 && !recentDeal && buildYear) {
      return `${priceFragments[0]}.`
    }
    return `${priceFragments.join(', ')}.`
  })()

  // 면적 절
  const areaSentence = areaText
    ? `전용 ${areaText} 면적별 시세와 거래 내역, `
    : '면적별 시세와 거래 내역, '

  // 시설 + 마무리
  const closing = input.facilitySummary
    ? `${areaSentence}인근 ${input.facilitySummary}과 주변 시세를 함께 확인하세요.`
    : `${areaSentence}주변 시세를 함께 확인하세요.`

  return [opening, priceSentenceFixed, closing].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

export function buildRealEstateDetailMeta(input: DetailMetaInput): DetailMetaResult {
  return {
    title: buildTitle(input),
    description: buildDescription(input),
  }
}
```

### Step 2.4: 테스트 통과 확인

- [ ] **Run, expect PASS**

```bash
cd frontend && npx vitest run tests/composables/useRealEstateDetailMeta.test.ts 2>&1 | tail -20
```

Expected: 11/11 PASS. 실패하면 description 조립 로직(specifically priceSentenceFixed 분기)을 디버그 후 재실행.

### Step 2.5: 커밋

- [ ] **Commit**

```bash
git add frontend/composables/useRealEstateDetailMeta.ts frontend/tests/composables/useRealEstateDetailMeta.test.ts
git commit -m "feat(real-estate): 단지 상세 SEO 메타 생성 composable 신규

순수 함수 buildRealEstateDetailMeta. title/description을 데이터에서 합성.
빈 값(거래 0, dongName 없음, buildYear null 등) 모두 graceful fallback.
단위 테스트 11개."
```

---

## Task 3: `buildingName.vue`의 `useHead`가 composable 사용

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`

### Step 3.1: 기존 useHead 콜백 확인

- [ ] **Read current**

```bash
sed -n '558,611p' frontend/pages/real-estate/\[realEstateType\]/\[city\]/\[district\]/\[buildingName\].vue
```

기존 title/description 생성 로직 위치 확인.

### Step 3.2: `useHead` 콜백을 composable 호출로 교체

- [ ] **Modify `buildingName.vue:558-611`**

기존 useHead 콜백을 다음으로 교체:

```typescript
import { buildRealEstateDetailMeta } from '~/composables/useRealEstateDetailMeta'

useHead(() => {
  const tab = currentTab.value as 'sale' | 'rent'
  const cityFull = buildingInfo.value?.city || cityName
  const district = buildingInfo.value?.district || districtName
  const dong = buildingInfo.value?.dongName || null

  // 면적 범위: areaGroups에서 min/max
  let areaRange: { min: number; max?: number } | null = null
  if (areaGroups.value.length > 0) {
    const areas = areaGroups.value
      .map((g) => Number(g.exclusiveArea ?? g.area ?? 0))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (areas.length > 0) {
      const min = Math.min(...areas)
      const max = Math.max(...areas)
      areaRange = max > min ? { min, max } : { min }
    }
  }

  // 최근 거래
  let recentDeal: { amount: number; dealDate: string } | undefined
  const firstTx = transactions.value?.items?.[0]
  if (firstTx && firstTx.dealAmount) {
    recentDeal = {
      amount: Number(firstTx.dealAmount),
      dealDate: `${firstTx.dealYear}년 ${firstTx.dealMonth}월`,
    }
  }

  const { title, description } = buildRealEstateDetailMeta({
    buildingName: buildingName.value,
    region: { city: cityFull, district, dong },
    propertyType: propertyTypeParam,
    transactionMode: tab,
    summary: summary.value
      ? { totalCount: summary.value.totalCount, recentDeal }
      : null,
    buildYear: firstTx?.buildYear ?? null,
    areaRange,
    facilitySummary: facilitySummary.value,
  })

  // Canonical / OG
  const canonicalUrl = `${SITE_URL}${toRealEstateUrl({
    type: realEstateType,
    city: cityName,
    district: districtName,
    buildingName: buildingName.value,
  })}`

  const hasCoords = !!(buildingInfo.value?.lat && buildingInfo.value?.lng)
  const ogImage = buildOgImage(buildingInfo.value)
  const ogImageWidth = hasCoords ? '1024' : '1200'
  const ogImageHeight = hasCoords ? '536' : '630'

  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: ogImage },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: ogImage },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:image:width', content: ogImageWidth },
    { property: 'og:image:height', content: ogImageHeight },
  ]
  if (noindex.value) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }
  return {
    title,
    meta,
    link: [{ rel: 'canonical', href: canonicalUrl }],
  }
})
```

`firstTx.buildYear` 필드명은 `transactions.value` 모델 확인 후 정확한 이름으로 (없으면 `buildingInfo.value?.buildYear`로 fallback).

### Step 3.3: `buildingInfo` 타입에 dongName 추가

- [ ] **Modify type**

`frontend/composables/useRealEstate.ts` 또는 `frontend/types/realEstate.ts`의 `BuildingInfo` 인터페이스에:
```typescript
export interface BuildingInfo {
  // 기존 필드
  dongName?: string | null
}
```

### Step 3.4: 기존 페이지 테스트 실행

- [ ] **Run page test**

```bash
cd frontend && npx vitest run tests/pages/real-estate 2>&1 | tail -30
```

Expected: 기존 페이지 테스트 PASS (또는 description/title 어서션이 있으면 update 필요 — fail 시 해당 expect만 새 패턴으로 갱신).

### Step 3.5: lint + typecheck

- [ ] **Lint and typecheck**

```bash
cd frontend && npx nuxt prepare && npx tsc --noEmit -p . 2>&1 | tail -20
cd frontend && npm run lint 2>&1 | tail -10
```

Expected: 0 errors.

### Step 3.6: 커밋

- [ ] **Commit**

```bash
git add frontend/pages/real-estate/\[realEstateType\]/\[city\]/\[district\]/\[buildingName\].vue frontend/composables/useRealEstate.ts frontend/types/realEstate.ts
git commit -m "feat(real-estate): 단지 상세 페이지 useHead 가 신규 composable 사용

dongName, 거래량, 최근 거래가, 준공년도, 면적 범위, 생활시설을 한 곳에서 합성.
타이틀은 동/리까지 노출해 단지별 차별화. \"| 일상킷\" 후미 제거."
```

---

## Task 4: og-map `sanitizeLabel` 함수 + 단위 테스트

**Files:**
- Modify: `frontend/server/routes/og-map.get.ts`
- Test: `frontend/tests/server/og-map-sanitize.test.ts` (신규)

### Step 4.1: 실패 테스트 작성

- [ ] **Write failing test**

`frontend/tests/server/og-map-sanitize.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { sanitizeLabel } from '../../server/routes/og-map.get'

describe('sanitizeLabel', () => {
  it('한글 평문 그대로 유지', () => {
    expect(sanitizeLabel('새한A')).toBe('새한A')
  })
  it('파이프(|) 제거', () => {
    expect(sanitizeLabel('새한|A')).toBe('새한A')
  })
  it('콜론(:) 제거', () => {
    expect(sanitizeLabel('a:b')).toBe('ab')
  })
  it('연속 공백 1개로 압축', () => {
    expect(sanitizeLabel('a   b')).toBe('a b')
  })
  it('양쪽 공백 제거', () => {
    expect(sanitizeLabel('  공백  ')).toBe('공백')
  })
  it('21자 → 20자 자름', () => {
    const input = 'a'.repeat(21)
    expect(sanitizeLabel(input)).toHaveLength(20)
  })
  it('undefined → undefined', () => {
    expect(sanitizeLabel(undefined)).toBeUndefined()
  })
  it('빈 문자열 → undefined', () => {
    expect(sanitizeLabel('')).toBeUndefined()
  })
  it('공백만 → undefined', () => {
    expect(sanitizeLabel('   ')).toBeUndefined()
  })
})
```

### Step 4.2: 테스트 실패 확인

- [ ] **Run, expect FAIL**

```bash
cd frontend && npx vitest run tests/server/og-map-sanitize.test.ts 2>&1 | tail -15
```

Expected: import error "sanitizeLabel is not exported".

### Step 4.3: og-map.get.ts에 sanitizeLabel 추가 + label 사용 경로 교체

- [ ] **Modify `frontend/server/routes/og-map.get.ts`**

파일 상단에 export 함수 추가:
```typescript
export function sanitizeLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const cleaned = raw
    .replace(/[|:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
  return cleaned || undefined
}
```

기존 line 33의 `const label = query.label ? String(query.label).slice(0, 30) : undefined`를:
```typescript
const label = sanitizeLabel(query.label ? String(query.label) : undefined)
```

### Step 4.4: 테스트 통과 확인

- [ ] **Run, expect PASS**

```bash
cd frontend && npx vitest run tests/server/og-map-sanitize.test.ts 2>&1 | tail -15
```

Expected: 9/9 PASS.

### Step 4.5: 커밋

- [ ] **Commit**

```bash
git add frontend/server/routes/og-map.get.ts frontend/tests/server/og-map-sanitize.test.ts
git commit -m "fix(og-map): NCP markers spec 깨지는 label 문자 sanitize

| : 같은 NCP 구분자 제거, 연속 공백 압축, 20자 제한.
한글 단지명 그대로 통과시키되 spec 안전성 보장."
```

---

## Task 5: og-map `inlineFallback` — 다단계 302 제거

**Files:**
- Modify: `frontend/server/routes/og-map.get.ts`
- Modify: `frontend/server/utils/ogImage.ts` (필요 시 generator 시그니처 확장)
- Test: `frontend/tests/server/og-map.test.ts` (신규)

### Step 5.1: 실패 통합 테스트 작성

- [ ] **Write failing integration test**

`frontend/tests/server/og-map.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

vi.mock('#imports', () => ({
  useRuntimeConfig: () => ({ ncpMapClientId: 'test-id', ncpMapClientSecret: 'test-secret' }),
}))

let handler: any
beforeEach(async () => {
  fetchMock.mockReset()
  vi.resetModules()
  handler = (await import('../../server/routes/og-map.get')).default
})

function mockEvent(query: Record<string, string>) {
  const headers = new Map<string, string>()
  return {
    node: { req: { url: '/og-map?' + new URLSearchParams(query).toString() }, res: { setHeader: (k: string, v: string) => headers.set(k, v), statusCode: 200 } },
    context: {},
    __headers: headers,
  } as any
}

describe('og-map.get handler', () => {
  const baseQuery = { lat: '35.17', lng: '126.91', label: '새한A', category: 'apt', title: 'test', city: '광주', district: '북구' }

  it('NCP 성공 → PNG 200', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer })
    const event = mockEvent(baseQuery)
    const result = await handler(event)
    expect(result).toBeInstanceOf(Buffer)
    expect(event.__headers.get('Content-Type')).toBe('image/png')
  })

  it('NCP 4xx → inline fallback 200 (302 아님)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400 })
    const event = mockEvent(baseQuery)
    const result = await handler(event)
    expect(result).toBeTruthy()
    // 302 redirect 없이 직접 이미지 응답
    expect(event.node.res.statusCode).not.toBe(302)
    const ct = event.__headers.get('Content-Type')
    expect(['image/png', 'image/svg+xml']).toContain(ct)
  })

  it('NCP timeout → inline fallback 200', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ETIMEDOUT'))
    const event = mockEvent(baseQuery)
    const result = await handler(event)
    expect(result).toBeTruthy()
    expect(event.node.res.statusCode).not.toBe(302)
  })

  it('좌표 무효 → inline fallback 200', async () => {
    const event = mockEvent({ ...baseQuery, lat: '999', lng: '999' })
    const result = await handler(event)
    expect(result).toBeTruthy()
    expect(event.node.res.statusCode).not.toBe(302)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
```

NOTE: 실제 h3 event 모의는 단순화. 통합 테스트가 너무 복잡하면 — 이 작업은 핸들러를 export된 순수 함수 두 개(`callNcp`, `inlineFallback`)로 분리해서 각각 단위 테스트하는 패턴으로 대체 가능. Step 5.3에서 결정.

### Step 5.2: 테스트 실패 확인

- [ ] **Run, expect FAIL**

```bash
cd frontend && npx vitest run tests/server/og-map.test.ts 2>&1 | tail -20
```

Expected: 모두 FAIL (현재는 302 fallback이라).

### Step 5.3: `inlineFallback` 구현 + 기존 `fallbackRedirect` 제거

- [ ] **Refactor `frontend/server/routes/og-map.get.ts`**

전체 핸들러를 다음으로 교체:

```typescript
import { defineEventHandler, getQuery, setHeader } from 'h3'
import type { H3Event } from 'h3'
import { generateOgImageSvg } from '../utils/ogImage'
import { CATEGORY_META } from '~/types/facility'

const NAVER_API_BASE = 'https://maps.apigw.ntruss.com/map-static/v2/raster'
const MAP_WIDTH = 1024
const MAP_HEIGHT = 536
const DEFAULT_LEVEL = 16
const KOREA_LAT_MIN = 33
const KOREA_LAT_MAX = 39
const KOREA_LNG_MIN = 124
const KOREA_LNG_MAX = 131

export function sanitizeLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[|:]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20)
  return cleaned || undefined
}

const REAL_ESTATE_TO_OG_CATEGORY: Record<string, string> = {
  'apt-sale': 'apt', 'apt-rent': 'apt',
  'villa-sale': 'villa', 'villa-rent': 'villa',
  'offitel-sale': 'offitel', 'offitel-rent': 'offitel',
}
function normalizeOgCategory(raw: string): string {
  if (REAL_ESTATE_TO_OG_CATEGORY[raw]) return REAL_ESTATE_TO_OG_CATEGORY[raw]
  if (raw in CATEGORY_META) return raw
  if (raw === 'apt' || raw === 'villa' || raw === 'offitel') return raw
  return 'apt'  // 안전 기본값
}

async function inlineFallback(
  event: H3Event,
  query: { category?: string; title?: string; city?: string; district?: string },
): Promise<Buffer | string> {
  const category = normalizeOgCategory(String(query.category ?? 'apt'))
  const title = String(query.title ?? '')
  const city = query.city ? String(query.city) : undefined
  const district = query.district ? String(query.district) : undefined
  const svg = generateOgImageSvg({ category: category as any, title, city, district })
  try {
    const sharp = await import('sharp').then((m) => m.default)
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return png
  } catch {
    setHeader(event, 'Content-Type', 'image/svg+xml')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return svg
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event) as Record<string, string | undefined>

  const lat = Number.parseFloat(String(query.lat ?? ''))
  const lng = Number.parseFloat(String(query.lng ?? ''))
  const level = Number.parseInt(String(query.level ?? DEFAULT_LEVEL), 10)
  const label = sanitizeLabel(query.label ? String(query.label) : undefined)

  const validCoords =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= KOREA_LAT_MIN && lat <= KOREA_LAT_MAX &&
    lng >= KOREA_LNG_MIN && lng <= KOREA_LNG_MAX

  const config = useRuntimeConfig(event)
  const clientId = (config as any).ncpMapClientId
  const clientSecret = (config as any).ncpMapClientSecret

  if (!validCoords || !clientId || !clientSecret) {
    return inlineFallback(event, query)
  }

  const markerSpec = label
    ? `type:d|size:mid|pos:${lng} ${lat}|label:${label}`
    : `type:d|size:mid|pos:${lng} ${lat}`

  const params = new URLSearchParams({
    w: String(MAP_WIDTH),
    h: String(MAP_HEIGHT),
    center: `${lng},${lat}`,
    level: String(level),
    scale: '2',
    format: 'png',
    markers: markerSpec,
  })

  try {
    const response = await fetch(`${NAVER_API_BASE}?${params.toString()}`, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    })
    if (!response.ok) {
      console.warn('[og-map] NCP non-2xx', { status: response.status, lat, lng })
      return inlineFallback(event, query)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return buffer
  } catch (err) {
    console.warn('[og-map] NCP exception', { lat, lng, error: String(err) })
    return inlineFallback(event, query)
  }
})
```

기존 `fallbackRedirect` 함수, `sendRedirect` import 제거.

### Step 5.4: `generateOgImageSvg` 카테고리 매핑 확인

- [ ] **Verify SVG generator handles new categories**

```bash
grep -n "category" frontend/server/utils/ogImage.ts | head -20
```

만약 SVG 생성기가 `apt`/`villa`/`offitel` 외 카테고리를 받으면 깨지는 코드라면 → 위 `normalizeOgCategory`가 보호해주므로 변경 불필요. 깨지는지만 확인.

### Step 5.5: 테스트 통과 확인

- [ ] **Run, expect PASS**

```bash
cd frontend && npx vitest run tests/server/og-map.test.ts 2>&1 | tail -20
```

Expected: 4/4 PASS. mock 시그니처가 안 맞으면 그 부분만 조정.

### Step 5.6: 전체 frontend 서버 테스트 회귀 확인

- [ ] **Run server test suite**

```bash
cd frontend && npx vitest run tests/server 2>&1 | tail -30
```

Expected: 기존 통과 테스트 그대로, 신규 og-map 통합 4건 PASS, sanitize 9건 PASS.

### Step 5.7: 커밋

- [ ] **Commit**

```bash
git add frontend/server/routes/og-map.get.ts frontend/tests/server/og-map.test.ts
git commit -m "fix(og-map): NCP 실패 시 inline SVG/PNG 응답으로 다단계 302 제거

봇은 og:image에서 302를 잘 따라가지 않아 일부 단지의 OG 이미지가
누락되던 문제 해결. NCP 호출 실패 시 generateOgImageSvg를 직접
호출해 항상 200 + image/* 응답을 반환한다. 신규/옛 부동산 슬러그
모두를 normalizeOgCategory로 안전 매핑."
```

---

## Task 6: smoke verification 스크립트

**Files:**
- Create: `scripts/verify-og.sh`

### Step 6.1: 스크립트 작성

- [ ] **Create `scripts/verify-og.sh`**

```bash
#!/bin/bash
set -euo pipefail

BASE="${1:-https://ilsangkit.co.kr}"
declare -a URLS=(
  "$BASE/og-map?lat=35.17&lng=126.91&label=test&category=apt"
  "$BASE/og-map?lat=35.17&lng=126.91&label=%EC%83%88%ED%95%9CA&category=apt&city=%EA%B4%91%EC%A3%BC&district=%EB%B6%81%EA%B5%AC"
  "$BASE/og?category=apt&title=test"
  "$BASE/og?category=villa&title=test"
  "$BASE/og?category=offitel&title=test"
)

fail=0
for url in "${URLS[@]}"; do
  http=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  ct=$(curl -sI "$url" | awk -F': ' '/^[Cc]ontent-[Tt]ype/ {print $2}' | tr -d '\r')
  printf "%s  %-12s  %s\n" "$http" "$ct" "$url"
  if [ "$http" != "200" ]; then
    fail=1
  fi
done
exit "$fail"
```

```bash
chmod +x scripts/verify-og.sh
```

### Step 6.2: 로컬 dev 서버로 검증 (선택)

- [ ] **(Optional) Test against local dev**

```bash
# 별도 터미널에서 frontend dev 띄운 상태에서
./scripts/verify-og.sh http://localhost:3000
```

Expected: 모든 URL `200` + content-type `image/*`.

### Step 6.3: 커밋

- [ ] **Commit**

```bash
git add scripts/verify-og.sh
git commit -m "chore(scripts): OG 라우트 smoke 검증 스크립트

배포 후 verify-og.sh 실행해서 5개 OG URL이 200 + image/* 응답인지 확인.
실패 시 비-zero exit."
```

---

## Task 7: E2E 테스트 (Playwright, optional)

**Files:**
- Create: `frontend/tests/e2e/real-estate-detail-seo.spec.ts`

### Step 7.1: E2E spec 작성

- [ ] **Create test**

```typescript
import { test, expect } from '@playwright/test'

test('단지 상세 SEO 메타가 정상 출력된다', async ({ page }) => {
  // 실제로 데이터가 있는 단지를 선택 — 테스트 환경에 맞게 조정
  await page.goto('/real-estate/apt-sale/seoul/mapo/마포프레스티지자이')

  const title = await page.title()
  expect(title).toContain('마포프레스티지자이')
  expect(title).toContain('매매 실거래')
  expect(title).not.toContain('일상킷')

  const desc = await page.locator('meta[name="description"]').getAttribute('content')
  expect(desc).toBeTruthy()
  expect(desc!).toMatch(/실거래 (\d+|N)건/)
  expect(desc!).toContain('주변 시세를 함께 확인')

  const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content')
  expect(ogImage).toMatch(/^https?:\/\//)

  const ogResp = await page.request.get(ogImage!)
  expect(ogResp.status()).toBe(200)
  expect(ogResp.headers()['content-type']).toMatch(/^image\//)
})
```

### Step 7.2: 실행

- [ ] **Run E2E**

```bash
cd frontend && npx playwright test tests/e2e/real-estate-detail-seo.spec.ts 2>&1 | tail -20
```

Expected: 1/1 PASS. 단지 URL이 환경별로 다르면 fixture로 가용한 URL 동적 선택.

### Step 7.3: 커밋

- [ ] **Commit**

```bash
git add frontend/tests/e2e/real-estate-detail-seo.spec.ts
git commit -m "test(e2e): 단지 상세 SEO 메타 + og:image 200 응답 검증"
```

---

## Task 8: 통합 검증 + PR 생성

### Step 8.1: 전체 테스트 회귀

- [ ] **Run all tests**

```bash
cd backend && npm run test 2>&1 | tail -20
cd ../frontend && npm run test 2>&1 | tail -20
```

Expected: 모두 PASS, 추가된 테스트 케이스 포함.

### Step 8.2: build 확인

- [ ] **Build**

```bash
cd frontend && npx nuxt prepare && npx tsc --noEmit -p . 2>&1 | tail -20
cd ../backend && npm run build 2>&1 | tail -10
```

Expected: 0 errors.

### Step 8.3: 푸시 + PR

- [ ] **Push and create PR**

```bash
git push -u origin feat/real-estate-detail-seo
gh pr create --base develop --head feat/real-estate-detail-seo --title "feat(real-estate): 단지 상세 SEO 메타 재설계 + OG 라우트 다단계 302 제거" --body "$(cat <<'EOF'
## 요약

- 단지 상세 페이지의 title/description을 단지마다 차별화된 키워드 풍부 형태로 재설계
- `getBuildingInfo`에 대표 dongName 반환 추가
- OG 라우트(og-map)의 NCP 실패 시 다단계 302 fallback을 inline SVG/PNG 200 응답으로 변경
- og-map label sanitize로 NCP markers spec 안전성 보장

## 변경 요약

- title: \`{단지} {유형} {거래} 실거래 · {시도} {시군구} {동}\` ("| 일상킷" 제거)
- description: 문장형 ~140자, facilitySummary 활용, "주변 시세를 함께 확인하세요"
- og-map: NCP 실패 시 generateOgImageSvg 직접 호출 → 항상 200 image/*

## 검증

- backend test: 신규 dongName 테스트 2건 + 기존 회귀 없음
- frontend test: composable 11건 + sanitize 9건 + og-map 통합 4건 + 페이지 테스트
- smoke: scripts/verify-og.sh 5개 URL 모두 200

## 후속 작업

- 시도/시군구 허브 페이지 SEO 메타 (별도 PR)
- 좌표 없는 단지 지오코딩 백필 (별도 PR)

## 스펙

`docs/superpowers/specs/2026-05-22-real-estate-detail-seo-meta-design.md` (로컬 전용)
EOF
)"
```

### Step 8.4: CI 모니터링

- [ ] **Watch CI**

```bash
gh pr checks --watch
```

Expected: Test 워크플로우 통과 → Deploy to Cafe24 워크플로우 트리거.

### Step 8.5: 배포 후 smoke 실행

- [ ] **Post-deploy smoke**

배포 완료 후 (PM2 reload 끝나고):
```bash
./scripts/verify-og.sh https://ilsangkit.co.kr
```

Expected: 5개 URL 모두 200 + image/*.

### Step 8.6: 네이버 서치어드바이저 수집 요청

- [ ] **Request Naver re-crawl**

네이버 서치어드바이저 → 사이트 관리 → 웹페이지 수집 → 단지 상세 URL 5~10개 직접 입력해 수집 요청. 2~3일 후 색인 검사로 새 description 채택 여부 확인.

---

## Self-Review Notes

스펙 대비 커버리지:

| 스펙 요구사항 | Task |
|---|---|
| Title 패턴 (동 추가, `\| 일상킷` 제거) | Task 2 (composable) + Task 3 (페이지 통합) |
| Description 문장형 + facilitySummary + "주변 시세" | Task 2 + Task 3 |
| 빈 값 fallback 7케이스 | Task 2 단위 테스트 |
| `getBuildingInfo`에 dongName | Task 1 |
| og-map 다단계 302 제거 | Task 5 |
| og-map 한글 label sanitize | Task 4 |
| og-map 실패 로깅 | Task 5 (console.warn 포함) |
| `og.get.ts` VALID_CATEGORIES 변경 없음 | (의도적 비변경, plan에 명시) |
| Composable 단위 테스트 | Task 2 |
| sanitize 단위 테스트 | Task 4 |
| og-map 통합 테스트 | Task 5 |
| smoke 스크립트 | Task 6 |
| E2E (optional) | Task 7 |

Placeholder 없음. Type 일관성: `DetailMetaInput`은 Task 2에서 정의, Task 3에서 동일 형태로 호출. `sanitizeLabel`은 Task 4에서 정의 후 Task 5의 핸들러에서도 동일 이름 사용. `inlineFallback`은 Task 5 내부 함수.
