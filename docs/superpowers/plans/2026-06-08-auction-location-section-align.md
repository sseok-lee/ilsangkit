# 공매 상세 위치 섹션 정렬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공매 물건 상세의 `AuctionMap.vue` 위치 섹션을 부동산 건물 상세의 "위치와 로드뷰" 섹션과 시각·구조적으로 일치시킨다 (`FacilityMap`/`FacilityRoadview` 재사용 + 길찾기 드롭다운).

**Architecture:** 단일 컴포넌트(`AuctionMap.vue`) 전면 재작성. raw `useKakaoMap`(initMap/addMarkers/initRoadview) 직접 호출과 이모지 캡션 라벨을 제거하고, 부동산 상세가 쓰는 `FacilityMap` + `FacilityRoadview` 컴포넌트를 재사용한다. 헤딩/서브텍스트/박스 스타일/로드뷰 미제공 안내가 자동으로 부동산과 일치한다. `#right` 슬롯에 길찾기(카카오/네이버) 드롭다운만 추가한다. 페이지(`[cltrMngNo].vue`)는 props 시그니처가 그대로라 변경 없음.

**Tech Stack:** Nuxt 3 + Vue 3 (`<script setup>`) + TailwindCSS, Vitest + @vue/test-utils (happy-dom). Node 20 (`nvm use 20`).

**참고 spec:** `docs/superpowers/specs/2026-06-08-auction-location-section-align-design.md`

> **Note:** `docs/`는 이 저장소에서 gitignore 처리됨 → spec/plan 문서는 로컬 보관, 커밋 대상 아님. 구현 커밋은 `frontend/` 파일만 포함한다.

---

### Task 1: AuctionMap 위치 섹션 부동산 정렬

기존 컴포넌트는 raw `useKakaoMap`을 쓰고 테스트도 그 mock에 의존한다. 새 컴포넌트는 `FacilityMap`/`FacilityRoadview`를 재사용하므로, 테스트를 자식 컴포넌트 stub 기반으로 교체한 뒤 컴포넌트를 재작성한다. 단일 기능 커밋(테스트+컴포넌트 동시).

**Files:**
- Modify (rewrite): `frontend/components/auction/AuctionMap.vue`
- Modify (rewrite): `frontend/tests/components/auction/AuctionMap.test.ts`
- 참고 only (변경 없음): `frontend/components/map/FacilityMap.vue`, `frontend/components/facility/FacilityRoadview.vue`, `frontend/components/common/SectionBlock.vue`, `frontend/pages/auction/item/[cltrMngNo].vue`

- [ ] **Step 1: 실패하는 테스트로 교체**

`frontend/tests/components/auction/AuctionMap.test.ts` 전체를 아래로 교체:

```ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionMap from '~/components/auction/AuctionMap.vue';

// FacilityMap/FacilityRoadview/ClientOnly 는 stub — AuctionMap 자체 마크업만 검증
const stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { name: 'FacilityMap', template: '<div data-testid="facility-map" />' },
  FacilityRoadview: { name: 'FacilityRoadview', template: '<div data-testid="facility-roadview" />' },
};

const mountMap = (props = {}) =>
  mount(AuctionMap, { props: { lat: 37.5, lng: 127.0, address: '강남구', ...props }, global: { stubs } });

describe('AuctionMap', () => {
  it('헤딩 "위치와 로드뷰" + data-testid 유지', () => {
    const w = mountMap();
    expect(w.text()).toContain('위치와 로드뷰');
    expect(w.find('[data-testid="auction-map"]').exists()).toBe(true);
  });

  it('FacilityMap / FacilityRoadview 재사용', () => {
    const w = mountMap();
    expect(w.find('[data-testid="facility-map"]').exists()).toBe(true);
    expect(w.find('[data-testid="facility-roadview"]').exists()).toBe(true);
  });

  it('이모지 라벨(🗺️/🛣️)을 더 이상 쓰지 않음', () => {
    const w = mountMap();
    expect(w.text()).not.toContain('🗺️');
    expect(w.text()).not.toContain('🛣️');
  });

  it('길찾기 드롭다운 토글 → 카카오/네이버 링크 노출', async () => {
    const w = mountMap();
    expect(w.text()).not.toContain('카카오맵으로 길찾기'); // 초기 닫힘
    const trigger = w.findAll('button').find((b) => b.text().includes('길찾기'));
    expect(trigger).toBeTruthy();
    await trigger!.trigger('click');
    expect(w.text()).toContain('카카오맵으로 길찾기');
    expect(w.text()).toContain('네이버맵으로 길찾기');
  });

  it('카카오맵 길찾기 클릭 시 window.open 호출', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const w = mountMap();
    await w.findAll('button').find((b) => b.text().includes('길찾기'))!.trigger('click');
    await w.findAll('button').find((b) => b.text().includes('카카오맵으로 길찾기'))!.trigger('click');
    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('map.kakao.com'), '_blank');
    openSpy.mockRestore();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null 2>&1
npx vitest run tests/components/auction/AuctionMap.test.ts
```
Expected: FAIL — 기존 컴포넌트는 헤딩이 `위치`이고 이모지 라벨을 쓰며 FacilityMap/FacilityRoadview를 렌더하지 않음 (`위치와 로드뷰` 미포함, `facility-map` 미존재 등).

- [ ] **Step 3: AuctionMap.vue 재작성**

`frontend/components/auction/AuctionMap.vue` 전체를 아래로 교체:

```vue
<!-- frontend/components/auction/AuctionMap.vue — 부동산 상세 "위치와 로드뷰"와 동일 컴포넌트/스타일 재사용 -->
<script setup lang="ts">
import { ref } from 'vue'
import FacilityMap from '~/components/map/FacilityMap.vue'
import FacilityRoadview from '~/components/facility/FacilityRoadview.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

const props = defineProps<{ lat: number; lng: number; address?: string }>()

const label = props.address ?? '위치'

// FacilityMap :facilities 형태 (부동산 buildingMarker와 동일 shape)
const marker = {
  id: 'auction',
  name: label,
  category: 'parking',
  address: null,
  roadAddress: null,
  lat: props.lat,
  lng: props.lng,
  city: '',
  district: '',
} as any

const showNavDropdown = ref(false)

// 부동산 상세와 동일한 길찾기 URL 패턴
const kakaoMapUrl = `https://map.kakao.com/link/to/${encodeURIComponent(label)},${props.lat},${props.lng}`
const naverMapUrl = `https://map.naver.com/v5/directions/-/${props.lng},${props.lat},${encodeURIComponent(label)}/-/walk`

function openNavigation(url: string) {
  window.open(url, '_blank')
  showNavDropdown.value = false
}
</script>

<template>
  <SectionBlock data-testid="auction-map" heading="위치와 로드뷰" subtext="지도와 로드뷰로 주변을 바로 확인할 수 있습니다.">
    <template #right>
      <div class="hidden md:flex items-center gap-1">
        <div class="relative">
          <button
            class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded-lg hover:bg-primary-50"
            @click="showNavDropdown = !showNavDropdown"
          >
            <span class="material-symbols-outlined text-[18px]">directions</span>
            길찾기
            <span class="material-symbols-outlined text-[14px]">expand_more</span>
          </button>
          <div v-if="showNavDropdown" class="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
            <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
              <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
            </button>
            <div class="h-px bg-slate-100"></div>
            <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
              <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- 지도 + 로드뷰 반반(데스크톱), 모바일 세로 적층. 공매는 모바일 지도 히어로가 없으므로 지도에 hidden md:block 미적용 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="rounded-xl border border-line overflow-hidden h-[200px] md:h-[300px]">
        <ClientOnly>
          <FacilityMap :center="{ lat, lng }" :facilities="[marker]" :level="3" />
        </ClientOnly>
      </div>
      <div class="roadview-wrapper rounded-xl border border-line overflow-hidden h-[200px] md:h-[300px]">
        <FacilityRoadview :lat="lat" :lng="lng" />
      </div>
    </div>
    <p v-if="address" class="mt-2 text-caption text-slate-500">{{ address }}</p>
  </SectionBlock>
</template>

<style scoped>
/* 부동산 상세와 동일 — FacilityRoadview를 300px 래퍼 높이에 맞춤 */
.roadview-wrapper :deep(> div) { height: 100% !important; }
.roadview-wrapper :deep(> div > div) { height: 100% !important; }
</style>
```

- [ ] **Step 4: 테스트 통과 확인**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null 2>&1
npx vitest run tests/components/auction/AuctionMap.test.ts
```
Expected: PASS (5개 테스트 통과).

- [ ] **Step 5: 린트**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null 2>&1
npm run lint
```
Expected: 에러 없음 (신규 경고 없음).

- [ ] **Step 6: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/auction/AuctionMap.vue frontend/tests/components/auction/AuctionMap.test.ts
git commit -m "style(auction): align item-detail 위치 section with 부동산 — reuse FacilityMap/FacilityRoadview, drop emoji labels, add 길찾기 dropdown"
```

---

### Task 2: 회귀 확인 (전체 프론트 테스트 1회)

위치 섹션 변경이 다른 테스트에 영향 없는지 확인.

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 프론트 테스트 실행**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null 2>&1
npm run test
```
Expected: 전체 PASS. 만약 기존에 깨져 있던 테스트가 있으면 본 변경과 무관함을 확인하고, 본 변경으로 새로 깨진 테스트가 있으면 즉시 수정 후 Task 1 Step 6에 amend 커밋.

---

## Self-Review

**1. Spec coverage:**
- 컴포넌트 교체(FacilityMap/FacilityRoadview) → Task 1 Step 3 ✓
- 이모지 라벨 제거 → Step 3(마크업) + Step 1(테스트 단언) ✓
- 헤딩 `위치와 로드뷰` + subtext → Step 3 ✓
- 박스 스타일(rounded-xl/border-line/h-200~300px) + `.roadview-wrapper` scoped CSS → Step 3 ✓
- 로드뷰 미제공 안내 자동 일치 → FacilityRoadview 재사용으로 자동 충족 ✓
- 길찾기(카카오/네이버) 드롭다운만, 공유 버튼 제외 → Step 3 (`#right`에 길찾기만) ✓
- 모바일 지도 노출(hidden md:block 미적용) → Step 3 주석 명시 ✓
- 페이지 변경 없음 → Files에 "변경 없음" 명시, props 시그니처 `{lat,lng,address}` 유지 ✓
- 테스트 갱신 → Task 1 Step 1 ✓
- Node 20 검증 → Step 4/5, Task 2 ✓

**2. Placeholder scan:** TBD/TODO/“적절히 처리” 없음. 모든 코드 블록 완전 기재 ✓

**3. Type consistency:** props `{ lat:number; lng:number; address?:string }` 일관. `marker` shape는 FacilityMap `:facilities`(FacilitySearchItem 유사) 호환 확인됨. `openNavigation(url:string)`/`kakaoMapUrl`/`naverMapUrl`/`showNavDropdown` 명칭 테스트·구현 일치 ✓
