# 부동산 시 허브 주요 단지 카드 (⑤ 깔때기 PR2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부동산 시 허브에 "주요 단지" 카드 섹션을 SSR로 추가해 type→city→단지 직행 동선과 내부링크를 보강한다.

**Architecture:** `getComplexList(type, cityName, …, 1, 6)`을 `await useAsyncData`로 SSR 패칭, `ComplexCard` 그리드로 렌더. 데이터 없거나 실패면 섹션 미렌더. 기존 인트로·구/군 그리드는 불변.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-03-funnel-pr2-city-complex-cards-design.md`

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). `frontend/`. 브랜치 `feat/city-complex-cards`. 커밋 명시 경로만(절대 `git add -A` 금지).

## 확인된 사실
- `getComplexList(type: RealEstateType, city?, district?, buildingName?, page=1, limit=15): Promise<ComplexListResponse>`. `ComplexListResponse = { items: ComplexInfo[]; total; page; totalPages }`.
- `ComplexInfo = { buildingName, bjdCode, dongName, city, district, latestPrice, transactionCount, lat, lng, lastDealYear, lastDealMonth, buildYear }`.
- `ComplexCard` props `complex/propertyType/tab/minTransactionCount?` — `HardLink v-if="isRenderable"`(유효 buildingName + city&&district 필요), 4-segment `toRealEstateUrl` 링크.
- 시 허브 script: `realEstateTypeParam`(`apt-sale`), `citySlugParam`(`seoul`), `cityName`(한글), `propertyTypePart`(`apt`)/`tabPart`(`sale`), `typeLabel`. 현재 useAsyncData 없음(정적). 기존 `import { ... RealEstatePropertyType, TransactionMode } from '~/types/realEstate'`.
- 템플릿: PageHero → intro `<section>` → 구/군 `<SectionBlock>` → `<AdBanner />` → `<DataSourceSection>`.
- 기존 테스트 `tests/pages/real-estate/realEstateCityHub.test.ts`가 이 페이지를 마운트(인트로 단언).

---

## Task 1: 주요 단지 섹션 추가 + 테스트

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/index.vue` (script + template)
- Test: `frontend/tests/pages/real-estate/realEstateCityHub.test.ts` (케이스 추가)

- [ ] **Step 1: 실패 테스트 추가** — `frontend/tests/pages/real-estate/realEstateCityHub.test.ts`
먼저 기존 파일을 읽어 mount 헬퍼/stubs/mock(useRoute, useStructuredData, createError, useSeoMeta/useHead)을 확인. 그 헬퍼를 재사용해 아래 케이스 추가(useAsyncData를 override해 주요 단지 주입):
```ts
it('주요 단지 섹션을 ComplexCard로 렌더한다', async () => {
  ;(globalThis as any).useAsyncData = vi.fn((_k: string, _h: () => Promise<unknown>) => {
    const data = ref<any>([
      { buildingName: '강남타워', bjdCode: '11680', dongName: '역삼동', city: '서울특별시', district: '강남구', latestPrice: 120000, transactionCount: 12, lat: 37.5, lng: 127.0, lastDealYear: 2026, lastDealMonth: 5, buildYear: 2015 },
    ])
    return Object.assign(Promise.resolve({ data }), { data, pending: ref(false), error: ref(null), refresh: vi.fn() })
  })
  const wrapper = await mountCityHub() // 기존 헬퍼명에 맞춰 호출
  expect(wrapper.text()).toContain('주요 단지')
  expect(wrapper.text()).toContain('강남타워')
})
```
(주: `ref`/`vi` import 및 기존 헬퍼명/마운트 방식은 파일에 맞춰 조정. ComplexCard는 stub하지 말고 실제 렌더 — HardLink/NuxtLink는 setup.ts 전역 stub. 단언 핵심은 "주요 단지" 헤딩 + 단지명 렌더. 기존 인트로 테스트는 그대로 통과해야 함 — 전역 useAsyncData mock이 null 반환해도 아래 Step3의 `?? []` 가드로 섹션만 숨고 인트로는 정상.)

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateCityHub.test.ts` → 신규 케이스 FAIL.

- [ ] **Step 3: script 수정** — `pages/real-estate/[realEstateType]/[city]/index.vue`
import 추가:
```ts
import ComplexCard from '~/components/realEstate/ComplexCard.vue'
import { useRealEstate } from '~/composables/useRealEstate'
import type { RealEstateType } from '~/types/realEstate'
```
(`RealEstatePropertyType`/`TransactionMode` import이 이미 있으면 같은 import 라인에 `RealEstateType` 추가; 중복 import 금지.)

`districts` computed 부근(스크립트 하단, setMeta/구조화 데이터 호출 전 또는 후 — top-level await 허용)에 추가:
```ts
const { getComplexList } = useRealEstate()
const { data: topComplexesData } = await useAsyncData(
  `re-city-complexes-${realEstateTypeParam}-${citySlugParam}`,
  () =>
    getComplexList(realEstateTypeParam as RealEstateType, cityName, undefined, undefined, 1, 6)
      .then((r) => r.items)
      .catch(() => [] as import('~/types/realEstate').ComplexInfo[]),
  { default: () => [] as import('~/types/realEstate').ComplexInfo[] },
)
const topComplexes = computed(() => topComplexesData.value ?? [])
```
(`computed(() => ... ?? [])`로 전역 mock이 null 반환해도 안전 — 기존 테스트 보호.)

- [ ] **Step 4: template 수정**
구/군 `</SectionBlock>` 다음, `<AdBanner />` 앞에 삽입:
```vue
      <SectionBlock
        v-if="topComplexes.length > 0"
        :subtext="`${cityName} ${typeLabel} 거래가 활발한 단지`"
      >
        <template #heading>
          <h2 class="text-display-3 text-slate-900">주요 단지</h2>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComplexCard
            v-for="c in topComplexes"
            :key="`${c.buildingName}-${c.bjdCode}`"
            :complex="c"
            :property-type="propertyTypePart"
            :tab="tabPart"
          />
        </div>
      </SectionBlock>
```

- [ ] **Step 5: 통과 확인**
Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateCityHub.test.ts` → 전체 PASS(기존 인트로 + 신규 주요단지).

- [ ] **Step 6: lint + 커밋**
Run: `cd frontend && npx eslint pages/real-estate/\[realEstateType\]/\[city\]/index.vue` → 0 new errors.
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/real-estate/\[realEstateType\]/\[city\]/index.vue frontend/tests/pages/real-estate/realEstateCityHub.test.ts
git commit -m "feat(frontend): 부동산 시 허브에 주요 단지 카드 섹션(SSR) 추가"
```

---

## Task 2: 회귀 검증 + SSR curl + PR

- [ ] **Step 1: 관련 테스트 + lint**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/pages/real-estate && npm run lint 2>&1 | tail -5`
Expected: PASS / 0 errors.

- [ ] **Step 2: 전체 테스트**
Run: `cd frontend && npm run test 2>&1 | tail -8` → 전체 PASS.

- [ ] **Step 3: SSR 빌드**
Run: `cd frontend && npm run build 2>&1 | tail -8` → exit 0.

- [ ] **Step 4: SSR curl(dev + 데이터 있을 때)**
```bash
curl -s "http://localhost:3000/real-estate/apt-sale/seoul" | grep -oc '주요 단지'                       # >=1 (데이터 있으면)
curl -s "http://localhost:3000/real-estate/apt-sale/seoul" | grep -oc 'href="/real-estate/apt-sale/seoul/'  # >=1 (단지 4-segment 링크)
```
Expected: 데이터 있으면 주요 단지 + 단지 링크 SSR 포함. (백엔드 데이터 없으면 섹션 미렌더 — 단위테스트로 검증됨.)

- [ ] **Step 5: PR**
```bash
git push -u origin feat/city-complex-cards
gh pr create --base develop --title "깔때기 보강 ⑤ PR2: 부동산 시 허브 주요 단지 카드" --body "audit ⑤ 깔때기 PR2. real-estate 시 허브에 getComplexList(type,city,…,6) SSR 패칭 + ComplexCard 그리드 '주요 단지' 섹션 추가 → type→city→단지 직행. 데이터 없으면 섹션 미렌더(인트로·구/군 정상). 4-segment 단지 직링크로 내부링크/색인 강화."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** SSR 패칭=T1 Step3 / 렌더=Step4 / 빈·에러 미렌더=`v-if topComplexes.length>0` + `?? []` + catch / 배치(구/군 다음)=Step4. 검증=T2.
- **Placeholder scan:** 코드 단계 실제 코드. 테스트의 "기존 헬퍼명/마운트 방식 조정"은 기존 파일 의존 지시(정당).
- **Type consistency:** `getComplexList(realEstateTypeParam as RealEstateType, cityName, …)` → `.items: ComplexInfo[]`. `topComplexes` computed(ComplexInfo[]). `ComplexCard` props(complex/propertyType=propertyTypePart/tab=tabPart). 모두 일치.
- **위험:** 정적 페이지에 SSR 패칭 추가 — `?? []`/catch/default로 null·실패 안전, 기존 테스트 보호. ComplexCard는 ④에서 city/district 가드 추가됨(시 허브 단지엔 둘 다 있음).
- **Out of scope:** 정렬 UI/페이지네이션, getComplexList 변경, ComplexCard 변경.
