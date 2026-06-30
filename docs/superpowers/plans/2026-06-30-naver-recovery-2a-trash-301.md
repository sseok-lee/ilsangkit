# 네이버 회복 2단계-A: TRASH 개별페이지 301 집계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 중복 메타로 색인되던 개별 `/trash/[id]` 페이지(~8,882개, 74% 중복 title·desc)를 구·군 단위 집계 페이지 `/[city]/[district]/trash`(이미 존재, index,follow, 고유 메타)로 **301 리다이렉트**하고, 내부 링크를 집계 페이지로 정리한다.

**Architecture:** 프론트(Nuxt 3)만. (1) 도시·구 한글명 → 집계 페이지 경로(`/[citySlug]/[districtSlug]/trash`)를 만드는 순수 util `buildTrashRegionPath` 추가(단위테스트), (2) `pages/trash/[id].vue` SSR에서 데이터 확정 후 그 경로로 `navigateTo(..., { redirectCode: 301 })`, (3) `WasteScheduleCard`/JSON-LD가 더 이상 `/trash/[id]`를 가리키지 않도록 집계 페이지로 변경. 백엔드·DB·사이트맵 변경 없음.

**Tech Stack:** Nuxt 3 / Vue 3 / TypeScript, Vitest (happy-dom).

## Global Constraints
- Node 20: `source ~/.nvm/nvm.sh && nvm use 20` 후 npm/vitest. package-lock 금지.
- 프론트 테스트: `cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run <file>`.
- 브랜치 `fix/naver-trash-aggregate`(develop 기준). main/develop 직접 커밋 금지. 커밋 메시지 한국어 conventional.
- 집계 단위는 **구·군**(`/[city]/[district]/trash` 기존 페이지 재사용), 개별 페이지는 **301**(사용자 결정). emissionPlace 기반 개별 유니크화는 채택하지 않음.
- 사이트맵의 개별 `/trash/[id]` 제거 + region-trash 추가는 **본 플랜 범위 밖**(후속 Plan 2-B: 서버사이드 슬러그 변환 필요). 본 PR 이후에도 사이트맵은 개별 URL을 잠시 더 나열하지만, 그 URL들은 301이라 중복 색인은 발생하지 않음.

---

### Task 1: `buildTrashRegionPath` util + SSR 301 리다이렉트

**Files:**
- Create: `frontend/utils/trashRegion.ts`
- Test: `frontend/tests/utils/trashRegion.test.ts`
- Modify: `frontend/pages/trash/[id].vue` (useAsyncData 직후 — 현재 244-254행에서 fetch, `data` computed 사용처는 313행 `trashRegionLink`)

**Interfaces:**
- Consumes: `CITY_NAME_TO_SLUG`, `generateSlug` from `~/composables/useRegions` (기존 export; `pages/trash/[id].vue:189`에서 이미 import).
- Produces: `buildTrashRegionPath(city: string, district: string): string | null` — 한글 시/구명 → `/${citySlug}/${districtSlug}/trash`. citySlug 미해결 시 `null`.

- [ ] **Step 1: util 실패 테스트 작성**

`frontend/tests/utils/trashRegion.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildTrashRegionPath } from '~/utils/trashRegion'

describe('buildTrashRegionPath', () => {
  it('정식 시도명 + 구명을 슬러그 경로로 변환', () => {
    expect(buildTrashRegionPath('서울특별시', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('축약 시도명도 매핑된다', () => {
    expect(buildTrashRegionPath('서울', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('알 수 없는 도시는 null', () => {
    expect(buildTrashRegionPath('없는도시', '강남구')).toBeNull()
  })
})
```
> 참고: 기대 슬러그 값('seoul','gangnam')은 실제 `CITY_NAME_TO_SLUG`/`generateSlug`/`DISTRICT_SLUG_MAP`에 맞춰 확인할 것. 값이 다르면 기대값을 실제 출력에 맞게 조정(슬러그 매핑은 기존 데이터 — util 로직만 검증하는 게 목적).

- [ ] **Step 2: 실패 확인**
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/trashRegion.test.ts
```
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: util 구현**

`frontend/utils/trashRegion.ts`:
```ts
import { CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'

/**
 * 쓰레기 배출 개별 레코드(한글 시/구명)를 구·군 단위 집계 페이지 경로로 변환한다.
 * 기존 trash 상세의 지역 링크와 동일한 슬러그 규칙. citySlug 미해결 시 null.
 */
export function buildTrashRegionPath(city: string, district: string): string | null {
  const shortCity = city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const citySlug = CITY_NAME_TO_SLUG[city] || CITY_NAME_TO_SLUG[shortCity]
  if (!citySlug) return null
  return `/${citySlug}/${generateSlug(district)}/trash`
}
```

- [ ] **Step 4: 통과 확인**
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/utils/trashRegion.test.ts
```
Expected: PASS (값 조정 후).

- [ ] **Step 5: 상세 페이지 SSR 301 추가**

`frontend/pages/trash/[id].vue`에서, `useAsyncData`(현재 244-254행)로 받은 스케줄을 노출하는 `data` computed(=`scheduleResponse.value?.data`; 313행 `trashRegionLink`가 `data.value.city`로 사용) **바로 다음**에 추가:
```ts
import { buildTrashRegionPath } from '~/utils/trashRegion'
// ...
// 구·군 단위 집계 페이지로 301 집계 (개별 trash 상세는 중복 메타 → 색인 통합)
const trashRegionPath = computed(() => data.value ? buildTrashRegionPath(data.value.city, data.value.district) : null)
if (import.meta.server && trashRegionPath.value) {
  await navigateTo(trashRegionPath.value, { redirectCode: 301 })
}
```
규칙:
- `data.value`가 없을 때(없는 id/404)는 리다이렉트하지 않고 **기존 404 처리 그대로**.
- `buildTrashRegionPath`가 `null`(슬러그 미해결)이면 리다이렉트하지 않고 기존 페이지 렌더(안전 폴백).
- `import.meta.server` 가드로 SSR에서 301 응답. 클라이언트 내비게이션도 `navigateTo`가 동일 처리.
- 정확한 `data` computed 정의 위치를 파일에서 확인 후 그 아래에 삽입(중복 선언 금지). `navigateTo`는 Nuxt auto-import.

- [ ] **Step 6: 빌드/타입 검증 + 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run lint && npx vitest run tests/utils/trashRegion.test.ts
```
Expected: lint 0 new errors, util 테스트 통과. (페이지 리다이렉트는 레포 관례상 page 단위테스트 없음 — 빌드/리뷰로 검증, 런타임 301은 PR/staging 확인.)
```bash
git add frontend/utils/trashRegion.ts frontend/tests/utils/trashRegion.test.ts frontend/pages/trash/[id].vue
git commit -m "fix: trash 개별 상세를 구·군 집계 페이지로 301 리다이렉트 (중복 메타 색인 통합)"
```

---

### Task 2: 내부 링크를 집계 페이지로 정리 (301 홉·죽은 링크 제거)

`WasteScheduleCard`가 `/trash/[id]`를 가리키면 클릭 시 301 홉이 생긴다(특히 집계 페이지 위 카드는 자기 페이지로 되돌아감). 카드 링크와 JSON-LD를 집계 페이지로 바꾼다.

**Files:**
- Modify: `frontend/components/facility/WasteScheduleCard.vue` (현재 3행 `:to="'/trash/' + region.id"`)
- Modify: `frontend/pages/[city]/[district]/[category].vue` (현재 422행 JSON-LD ItemList `url: '/trash/${s.id}'`)

**Interfaces:**
- Consumes: `buildTrashRegionPath` (Task 1).

- [ ] **Step 1: WasteScheduleCard 링크 변경**

`frontend/components/facility/WasteScheduleCard.vue`를 읽고, `:to`를 개별 상세가 아니라 집계 페이지로 변경. `region`이 city/district를 갖는지 확인 후:
```vue
<!-- before: :to="'/trash/' + region.id" -->
<NuxtLink :to="buildTrashRegionPath(region.city, region.district) ?? ('/trash/' + region.id)" ...>
```
- `region`에 `city`/`district`가 없으면(요약 객체) 어디서 채워 넘기는지 확인하고, 없으면 부모(`RegionTrashSchedule.vue`/`[category]/index.vue`/`pages/[city]/[district]/[category].vue`)에서 city/district를 prop으로 전달하도록 보강. 폴백(`?? '/trash/'+id`)은 안전망(폴백 시 301로 처리됨).
- `buildTrashRegionPath`를 `<script setup>`에서 import.
- 집계 페이지(`/[city]/[district]/trash`) 위에서는 카드가 자기 페이지를 가리키게 되는데, 이는 무해(동일 URL). UX상 카드가 그 지역의 상세 일정을 충분히 보여주는지 확인 — 부족하면 카드가 자체적으로 일정(요일/시간)을 표시하도록 보강(별도 큰 변경 필요 시 DONE_WITH_CONCERNS로 보고).

- [ ] **Step 2: JSON-LD ItemList URL 정리**

`frontend/pages/[city]/[district]/[category].vue` 422행 부근의 ItemList 스키마에서 `url: '/trash/${s.id}'`를 읽고, 개별 페이지가 더 이상 캐논이 아니므로:
- 각 항목 `url`을 집계 페이지(`buildTrashRegionPath(s.city, s.district)` 또는 현재 페이지 canonical)로 바꾸거나, 개별 url 필드를 제거(name/position 유지). 구조를 읽고 가장 자연스러운 쪽 선택(전 항목이 동일 URL이 되면 url 제거가 깔끔).

- [ ] **Step 3: 빌드/검증 + 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run lint && npx vitest run 2>&1 | tail -8
```
Expected: lint 0 new errors, 전체 vitest 무회귀.
```bash
git add frontend/components/facility/WasteScheduleCard.vue frontend/pages/[city]/[district]/[category].vue
git commit -m "fix: trash 카드·JSON-LD를 구·군 집계 페이지로 연결 (개별 301 홉 제거)"
```

---

## Self-Review
- **Spec coverage:** 스펙 §4.2 TRASH + 사용자 결정(구·군 재사용·301) 구현. 사이트맵 region-trash는 §범위 밖(Plan 2-B). emissionPlace 유니크화는 미채택(결정대로).
- **Placeholder scan:** Task 1은 완전 코드. Task 2는 컴포넌트 내부 구조를 구현자가 읽고 적용(의도·앵커·사용할 util 명시) — 빈 자리표 아님.
- **Type consistency:** `buildTrashRegionPath(city, district): string|null` 시그니처가 util·page·card에서 일관.

## 후속
- **Plan 2-B (사이트맵)**: 개별 `/trash/[id]` 사이트맵 제거 + region-trash URL 추가(백엔드 regions API 재사용 + 서버사이드 슬러그 변환 — `useRegions` 슬러그를 server route에서 쓰려면 plain util로 추출 필요).
- 이후 WIFI 허브 · parking/clothes · 운영(캐시퍼지+재제출) · Part D.
