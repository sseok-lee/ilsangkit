# 부동산 매매/전월세 상세 차별화 (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 건물의 매매·전월세 상세 페이지를 모드별 텍스트로 구분하고 전월세 비중 지표를 추가해 GSC "중복-다른 표준"(4,303)을 해소한다.

**Architecture:** 라벨 규약을 순수 유틸로 분리(`realEstateDetailLabels.ts`)하고, 전·월세 비중 막대를 독립 컴포넌트(`RentRatioBar.vue`)로 만든다. 비중 데이터는 백엔드 `getBuildingInfo`에 건물-레벨 전세/월세 건수로 추가. 페이지는 유틸·컴포넌트를 호출만 한다. canonical/noindex/사이트맵 불변.

**Tech Stack:** Nuxt3/Vue3, Express5+Prisma(MySQL), Vitest, Node 20.

**스펙 대비 조정:**
- 독립 "평형" 섹션 없음 → 모드 제목은 **"시세 추이" + "거래 내역"** 두 SectionBlock heading에 적용.
- H1 별도 배지는 **eyebrow로 대체**(PageHero 결합 회피, eyebrow가 H1 바로 위라 시각적 동일).
- 전·월세 비중은 건물-레벨(`getBuildingInfo` / PR#366 `buildForBjdCode` 내부).

**브랜치:** `feat/real-estate-sale-rent-differentiation` (이미 develop 기준 생성됨).

---

### Task 1: 백엔드 getBuildingInfo 전세/월세 건수

**Files:**
- Modify: `backend/src/services/realEstateService.ts` (`BuildingInfo` interface, `buildForBjdCode`)
- Test: `backend/__tests__/services/realEstateServiceGetBuildingInfo.test.ts`

- [ ] **Step 1: 테스트 mock에 apt-rent 캡처 추가**

`realEstateServiceGetBuildingInfo.test.ts` 상단 `vi.hoisted` 블록에 rent/ sale count 목 추가하고, `vi.mock`의 `aptRentTransaction`·`aptSaleTransaction`에 연결한다.

```ts
const {
  mockAptSaleFindFirst, mockAptSaleAggregate, mockAptSaleGroupBy, mockAptSaleCount,
  mockAptRentFindFirst, mockAptRentAggregate, mockAptRentGroupBy, mockAptRentCount,
} = vi.hoisted(() => ({
  mockAptSaleFindFirst: vi.fn(), mockAptSaleAggregate: vi.fn(), mockAptSaleGroupBy: vi.fn(), mockAptSaleCount: vi.fn(),
  mockAptRentFindFirst: vi.fn(), mockAptRentAggregate: vi.fn(), mockAptRentGroupBy: vi.fn(), mockAptRentCount: vi.fn(),
}))
```

`vi.mock('../../src/lib/prisma.js', ...)` 안 모델 정의 교체:
```ts
aptSaleTransaction: { findFirst: mockAptSaleFindFirst, aggregate: mockAptSaleAggregate, groupBy: mockAptSaleGroupBy, count: mockAptSaleCount, findMany: vi.fn() },
aptRentTransaction: { findFirst: mockAptRentFindFirst, aggregate: mockAptRentAggregate, groupBy: mockAptRentGroupBy, count: mockAptRentCount, findMany: vi.fn() },
```

- [ ] **Step 2: 실패 테스트 작성 (rent 카운트 / sale 미포함)**

파일 맨 끝 describe 추가:
```ts
describe('getBuildingInfo - 전·월세 건수 (rent 전용, 건물-레벨)', () => {
  beforeEach(() => vi.clearAllMocks())

  const rentRecord = {
    buildingName: '래미안', bjdCode: '11680', city: '서울', district: '강남구', dongName: '역삼동',
    roadName: null, jibun: '1', buildYear: 2009, dealYear: 2024, dealMonth: 1, dealDay: 15,
    lat: 37.5, lng: 127.0, deposit: 120000, monthlyRent: 0, exclusiveArea: 84.8,
  }

  it('rent 타입이면 jeonseCount/wolseCount 를 건물-레벨로 채운다', async () => {
    mockAptRentFindFirst.mockResolvedValue(rentRecord)
    mockAptRentAggregate.mockResolvedValue({ _min: { exclusiveArea: 59.9 }, _max: { exclusiveArea: 114.8 } })
    mockAptRentGroupBy.mockResolvedValue([{ dongName: '역삼동', _count: { dongName: 5 } }])
    mockAptRentCount.mockResolvedValueOnce(7).mockResolvedValueOnce(3) // 전세, 월세

    const result = await getBuildingInfo('apt-rent', '11680', '래미안')

    expect(result?.jeonseCount).toBe(7)
    expect(result?.wolseCount).toBe(3)
    expect(mockAptRentCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bjdCode: '11680', buildingName: '래미안', rentType: '전세' } }),
    )
    expect(mockAptRentCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bjdCode: '11680', buildingName: '래미안', rentType: '월세' } }),
    )
  })

  it('sale 타입이면 카운트하지 않고 필드도 없다', async () => {
    mockAptSaleFindFirst.mockResolvedValue({ ...rentRecord, dealAmount: 250000 })
    mockAptSaleAggregate.mockResolvedValue({ _min: { exclusiveArea: 59.9 }, _max: { exclusiveArea: 114.8 } })
    mockAptSaleGroupBy.mockResolvedValue([{ dongName: '역삼동', _count: { dongName: 5 } }])

    const result = await getBuildingInfo('apt-sale', '11680', '래미안')

    expect(result?.jeonseCount).toBeUndefined()
    expect(result?.wolseCount).toBeUndefined()
    expect(mockAptSaleCount).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateServiceGetBuildingInfo.test.ts`
Expected: 새 2개 FAIL (jeonseCount undefined).

- [ ] **Step 4: BuildingInfo 인터페이스에 옵셔널 필드 추가**

`realEstateService.ts`의 `export interface BuildingInfo { ... }` 맨 끝(`lng: number | null;` 다음)에:
```ts
  /** rent 타입에서만 채워지는 건물-레벨 전세/월세 거래 건수 */
  jeonseCount?: number;
  wolseCount?: number;
```

- [ ] **Step 5: buildForBjdCode에서 rent 카운트 집계**

`buildForBjdCode` 안, `if (!latest) return null;` 다음, lat/lng 보정 위쪽에 추가:
```ts
    let jeonseCount: number | undefined
    let wolseCount: number | undefined
    if (!isSaleType(type)) {
      [jeonseCount, wolseCount] = await Promise.all([
        model.count({ where: { ...where, rentType: '전세' } }),
        model.count({ where: { ...where, rentType: '월세' } }),
      ])
    }
```
그리고 `return { ... }` 객체 끝(`lng: ...,` 다음)에 `jeonseCount, wolseCount,` 추가.

- [ ] **Step 6: 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateServiceGetBuildingInfo.test.ts`
Expected: 전부 PASS (기존 6 + 신규 2 + PR#366 2 = 10).

- [ ] **Step 7: 커밋**
```bash
git add backend/src/services/realEstateService.ts backend/__tests__/services/realEstateServiceGetBuildingInfo.test.ts
git commit -m "feat(real-estate): getBuildingInfo에 rent 건물-레벨 전세/월세 건수 추가"
```

---

### Task 2: 프론트 라벨 순수 유틸

**Files:**
- Create: `frontend/utils/realEstateDetailLabels.ts`
- Test: `frontend/tests/utils/realEstateDetailLabels.test.ts`

- [ ] **Step 1: 실패 테스트 작성**
```ts
import { describe, it, expect } from 'vitest'
import {
  getDetailEyebrow, getTrendSectionTitle, getTxSectionTitle,
} from '~/utils/realEstateDetailLabels'

describe('realEstateDetailLabels', () => {
  it('eyebrow는 모드별로 다르다', () => {
    expect(getDetailEyebrow('아파트', 'sale')).toBe('아파트 매매 실거래')
    expect(getDetailEyebrow('아파트', 'rent')).toBe('아파트 전세·월세 시세')
  })
  it('시세 추이 제목', () => {
    expect(getTrendSectionTitle('sale')).toBe('매매가 추이')
    expect(getTrendSectionTitle('rent')).toBe('전월세 시세 추이')
  })
  it('거래 내역 제목', () => {
    expect(getTxSectionTitle('sale')).toBe('매매 거래 내역')
    expect(getTxSectionTitle('rent')).toBe('전월세 거래 내역')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/utils/realEstateDetailLabels.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: 구현**
```ts
export type RealEstateDetailMode = 'sale' | 'rent'

export function getDetailEyebrow(label: string, mode: RealEstateDetailMode): string {
  return mode === 'sale' ? `${label} 매매 실거래` : `${label} 전세·월세 시세`
}
export function getTrendSectionTitle(mode: RealEstateDetailMode): string {
  return mode === 'sale' ? '매매가 추이' : '전월세 시세 추이'
}
export function getTxSectionTitle(mode: RealEstateDetailMode): string {
  return mode === 'sale' ? '매매 거래 내역' : '전월세 거래 내역'
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run tests/utils/realEstateDetailLabels.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**
```bash
git add frontend/utils/realEstateDetailLabels.ts frontend/tests/utils/realEstateDetailLabels.test.ts
git commit -m "feat(real-estate): 상세 모드별 라벨 순수 유틸 추가"
```

---

### Task 3: RentRatioBar 컴포넌트

**Files:**
- Create: `frontend/components/realEstate/RentRatioBar.vue`
- Test: `frontend/tests/components/realEstate/RentRatioBar.test.ts`

- [ ] **Step 1: 실패 테스트 작성**
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RentRatioBar from '~/components/realEstate/RentRatioBar.vue'

describe('RentRatioBar', () => {
  it('전세/월세 비율을 표시한다', () => {
    const w = mount(RentRatioBar, { props: { jeonseCount: 7, wolseCount: 3 } })
    expect(w.text()).toContain('전세 70%')
    expect(w.text()).toContain('월세 30%')
  })
  it('합계가 0이면 아무것도 렌더하지 않는다', () => {
    const w = mount(RentRatioBar, { props: { jeonseCount: 0, wolseCount: 0 } })
    expect(w.find('[data-testid="rent-ratio"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/RentRatioBar.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: 구현**
```vue
<template>
  <div v-if="total > 0" data-testid="rent-ratio">
    <div class="flex h-6 w-full overflow-hidden rounded-lg text-xs font-bold">
      <div class="flex items-center justify-center bg-primary text-white" :style="{ width: jeonsePct + '%' }">
        전세 {{ jeonsePct }}%
      </div>
      <div class="flex items-center justify-center bg-primary-100 text-primary-700" :style="{ width: (100 - jeonsePct) + '%' }">
        월세 {{ 100 - jeonsePct }}%
      </div>
    </div>
    <p class="mt-1 text-xs text-slate-500">최근 거래 기준 전세 {{ jeonseCount }}건 · 월세 {{ wolseCount }}건</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ jeonseCount?: number; wolseCount?: number }>(), {
  jeonseCount: 0,
  wolseCount: 0,
})

const total = computed(() => props.jeonseCount + props.wolseCount)
const jeonsePct = computed(() => (total.value === 0 ? 0 : Math.round((props.jeonseCount / total.value) * 100)))
</script>
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/RentRatioBar.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**
```bash
git add frontend/components/realEstate/RentRatioBar.vue frontend/tests/components/realEstate/RentRatioBar.test.ts
git commit -m "feat(real-estate): 전·월세 비중 막대 컴포넌트 추가"
```

---

### Task 4: 타입 + 페이지 통합

**Files:**
- Modify: `frontend/types/realEstate.ts` (`BuildingInfo`)
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
- Test: `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts` (기대값 갱신)

- [ ] **Step 1: BuildingInfo 타입에 필드 추가**

`frontend/types/realEstate.ts`의 `BuildingInfo` 인터페이스에:
```ts
  jeonseCount?: number
  wolseCount?: number
```

- [ ] **Step 2: 페이지 import + 모드/비중 computed 추가**

`[buildingName].vue` `<script setup>` import 구역에:
```ts
import { getDetailEyebrow, getTrendSectionTitle, getTxSectionTitle } from '~/utils/realEstateDetailLabels'
import RentRatioBar from '~/components/realEstate/RentRatioBar.vue'
```
`heroStats` 정의 위에 추가:
```ts
const rentRatioTotal = computed(
  () => (buildingInfo.value?.jeonseCount ?? 0) + (buildingInfo.value?.wolseCount ?? 0),
)
const rentRatioLabel = computed(() => {
  const j = buildingInfo.value?.jeonseCount ?? 0
  if (rentRatioTotal.value === 0) return '정보 없음'
  const jPct = Math.round((j / rentRatioTotal.value) * 100)
  return jPct >= 50 ? `전세 ${jPct}%` : `월세 ${100 - jPct}%`
})
```

- [ ] **Step 3: heroStats 모드 분기**

기존 `const heroStats = computed(() => { ... })` 본문을 교체:
```ts
const heroStats = computed(() => {
  const PLACEHOLDER = '정보 없음'
  const dealDate = buildingInfo.value?.latestDealYear && buildingInfo.value?.latestDealMonth
    ? `${buildingInfo.value.latestDealYear}년 ${buildingInfo.value.latestDealMonth}월`
    : PLACEHOLDER
  const area = { label: '전용면적', value: areaRange.value !== '-' ? areaRange.value : PLACEHOLDER }
  const recent = latestPrice.value !== '-' ? latestPrice.value : PLACEHOLDER
  if (currentTab.value === 'sale') {
    return [
      { label: '최근 매매가', value: recent },
      { label: '최근 거래일', value: dealDate },
      { label: '건축년도', value: buildingInfo.value?.buildYear ? `${buildingInfo.value.buildYear}년` : PLACEHOLDER },
      area,
    ]
  }
  return [
    { label: '최근 거래', value: recent },
    { label: '최근 거래일', value: dealDate },
    { label: '전·월세 비중', value: rentRatioLabel.value },
    area,
  ]
})
```

- [ ] **Step 4: 템플릿 — eyebrow / 섹션 제목 / RentRatioBar 배치**

`[buildingName].vue` 템플릿 수정:
- line 96 `:eyebrow="`${propertyMeta?.label ?? ''} 실거래가`"` →
  `:eyebrow="getDetailEyebrow(propertyMeta?.label ?? '', currentTab)"`
- line 159 `<SectionBlock heading="시세 추이" ...>` → `:heading="getTrendSectionTitle(currentTab)"`
- line 263 `<SectionBlock heading="거래 내역" ...>` → `:heading="getTxSectionTitle(currentTab)"`
- "시세 추이" SectionBlock 바로 위(line 158 부근, `<!-- Ad: 로드뷰 이후 -->`의 AdBanner 다음)에 비중 블록 추가:
```vue
      <SectionBlock
        v-if="currentTab === 'rent' && rentRatioTotal > 0"
        heading="전·월세 거래 비중"
        subtext="최근 거래의 전세·월세 구성입니다."
      >
        <RentRatioBar :jeonse-count="buildingInfo?.jeonseCount" :wolse-count="buildingInfo?.wolseCount" />
      </SectionBlock>
```
참고: `currentTab`은 computed(get/set)이며 템플릿에서 `currentTab` 사용 시 값(`'sale'|'rent'`)이 그대로 전달된다(get).

- [ ] **Step 5: 기존 detail 테스트 기대값 갱신**

Run: `cd frontend && grep -rn "최근 거래\b\|시세 추이\|거래 내역\|실거래가" tests/pages/real-estate/realEstateBuildingDetail.test.ts`
해당 문자열을 단언하는 케이스가 있으면 모드(sale/rent)에 맞는 새 라벨로 갱신:
- sale: '최근 매매가', '매매가 추이', '매매 거래 내역', eyebrow '… 매매 실거래'.

- [ ] **Step 6: 프론트 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/`
Expected: PASS (전부).

- [ ] **Step 7: 커밋**
```bash
git add frontend/types/realEstate.ts "frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue" frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts
git commit -m "feat(real-estate): 상세 페이지 매매/전월세 모드별 차별화(eyebrow·heroStats·섹션제목·전월세비중)"
```

---

### Task 5: 전체 회귀 + 린트

- [ ] **Step 1: 백엔드 전체**

Run: `cd backend && npm run test`
Expected: all green.

- [ ] **Step 2: 프론트 전체**

Run: `cd frontend && npm run test`
Expected: all green.

- [ ] **Step 3: 린트**

Run: `cd backend && npm run lint` 그리고 `cd frontend && npm run lint`
Expected: 0 errors.

---

### Task 6: PR

- [ ] **Step 1: dev 서버로 매매/전월세 페이지 before/after 스크린샷 (선택, 권장)**
- [ ] **Step 2: push + PR**
```bash
git push -u origin feat/real-estate-sale-rent-differentiation
gh pr create --base develop --title "feat(real-estate): 매매/전월세 상세 차별화로 중복 색인 해소" --body "<요약: 목적 중복 4,303, 신규 전월세 비중 1개 + 라벨 모드화, canonical 불변, 테스트 결과>"
```
- [ ] **Step 3: CI(test-backend/test-frontend) green 확인 → 머지 대기**

## 완료 기준
- 매매·전월세 페이지 eyebrow·두 섹션 제목·heroStats가 모드별로 다름.
- 전월세 페이지에 전·월세 비중 노출(데이터 있을 때, 합계 0이면 숨김).
- canonical/noindex/사이트맵 불변, 전 테스트 green, lint 0 error.
