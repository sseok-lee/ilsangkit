# 토지 실거래가 — Plan 2: Frontend Pages + SEO/Sitemap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`. Implementer subagents MAY read the referenced existing files to match conventions exactly (UI code mirrors neighbors rather than being fully inlined here).

**Goal:** 토지 동(법정동) 단위 SEO 페이지(허브→시도→구군→동)를 만들고, 품질 게이트(`isIndexable`)에 따라 사이트맵/색인을 제어한다.

**Architecture:** 토지는 region-aggregate 전용 모듈. 정적 `pages/real-estate/land/**` 디렉터리(동적 `[realEstateType]`보다 Nuxt 우선)에 자체 페이지를 두고, `useLand` 컴포저블이 Plan 1의 `/api/real-estate/land/{regions,region,hub-summary}`를 호출한다. 슬러그는 `land`(매매뿐, sale/rent 분기 없음). 기존 6종 건물 중심 페이지/슬러그(`apt-sale` 등)는 재사용하지 않는다.

**Tech Stack:** Nuxt 3 (SSR) + Vue 3 + TailwindCSS, Vitest(happy-dom) + @nuxt/test-utils, MSW.

**Spec:** `docs/superpowers/specs/2026-06-04-land-transaction-pages-design.md` (6절 SEO/게이트, 8절 프론트). 보강 데이터(공시지가/지가변동률/용도지역 해설)는 Plan 3.

**Branch:** `feature/land-transaction-pages` (Plan 1 백엔드가 이미 머지돼 있는 동일 브랜치에서 계속).

**의존:** Plan 1 백엔드 API가 동작해야 함(이미 완료, 강남구 실데이터 적재됨). dev 서버로 `/api/real-estate/land/*` 호출 가능.

---

## 확정 규칙 (모든 태스크 공통)

- **URL 구조** (정적 디렉터리):
  - `/real-estate/land/` — 허브
  - `/real-estate/land/[city]/` — 시·도 (city는 슬러그: `seoul` 등)
  - `/real-estate/land/[city]/[district]/` — 구·군 (district 슬러그)
  - `/real-estate/land/[city]/[district]/[dong]` — 동 상세 (dong은 한글 법정동명, NFC 정규화 + encode)
- **city/district 슬러그 변환**: 기존 헬퍼 재사용 — 프론트의 `toCitySlug`/`CITY_SLUG_MAP`(역방향), `toDistrictSlug`. 슬러그→한글명으로 변환해 API 호출(`useLand`에 한글 city/district 전달; 백엔드 `buildRegionFilter`가 변형 매칭).
- **API 응답 키**: `getRegionList` → `{items:[{bjdCode,dongName,city,district,transactionCount,recentCount,avgPricePerPyeong,latestDealDate,isIndexable,jimokBreakdown}], total,page,totalPages}`. `getRegionDetail` → `{items:[{id,jibun,jimok,landUse,dealArea,shareDeal,dealAmount,dealType,dealYear,dealMonth,dealDay,pricePerPyeong}], total,page,totalPages, jimokDistribution:[{jimok,count}], landUseDistribution:[{landUse,count}], priceTimeline:[{year,month,avgPricePerPyeong,count}]}`. `getHubSummary` → `{cities:[{slug,city,indexableDongCount,totalTransactions}], totalTransactions}`.
- **품질 게이트(색인)**: 동 상세 페이지는 API의 동 요약 `isIndexable === true`일 때만 `index`. false면 `<meta robots noindex,follow>` + canonical을 구 페이지로. 허브/시도/구군은 항상 index.
- **평당가 표기**: "평당 N만원" 주력. ㎡당 = 평당 / 3.305 병기. 숫자 포맷은 기존 유틸(천단위 콤마) 사용.
- **SSR 빈 데이터**: 데이터 없으면 기존 페이지처럼 `Cache-Control: no-store` 설정(타입 허브 페이지 패턴 참고).
- **광고**: 기존 AdBanner 컴포넌트를 기존 페이지와 동일 밀도로 배치(임의 축소 금지).

---

## Task 1: 프론트 타입 — types/land.ts

**Files:** Create `frontend/types/land.ts`; Test `frontend/tests/types/land.test.ts` (간단 타입가드/상수 테스트).

**Spec:** Plan 1 API 응답을 그대로 표현하는 인터페이스 + `LAND_SLUG = 'land'` 상수.

- [ ] **Step 1: 실패 테스트** — `frontend/tests/types/land.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { LAND_SLUG, isLandIndexable, type LandRegionSummary } from '~/types/land';

describe('land types', () => {
  it('LAND_SLUG는 land', () => { expect(LAND_SLUG).toBe('land'); });
  it('isLandIndexable: isIndexable 플래그 반영', () => {
    const r = { isIndexable: true } as LandRegionSummary;
    expect(isLandIndexable(r)).toBe(true);
    expect(isLandIndexable({ isIndexable: false } as LandRegionSummary)).toBe(false);
  });
});
```
- [ ] **Step 2:** `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/types/land.test.ts` → FAIL (module missing).
- [ ] **Step 3: 구현** — `frontend/types/land.ts`:
```typescript
export const LAND_SLUG = 'land' as const;

export interface LandRegionSummary {
  bjdCode: string;
  dongName: string;
  city: string;
  district: string;
  transactionCount: number;
  recentCount: number;
  avgPricePerPyeong: number | null;
  latestDealDate: string | null;
  isIndexable: boolean;
  jimokBreakdown: Record<string, number>;
}

export interface LandTransaction {
  id: number;
  jibun: string | null;
  jimok: string | null;
  landUse: string | null;
  dealArea: number | null;
  shareDeal: boolean;
  dealAmount: number;       // 만원
  dealType: string | null;
  dealYear: number;
  dealMonth: number;
  dealDay: number | null;
  pricePerPyeong: number | null; // 만원/평
}

export interface LandDistribution { jimok?: string; landUse?: string; count: number; }
export interface LandTimelinePoint { year: number; month: number; avgPricePerPyeong: number | null; count: number; }

export interface LandRegionListResult {
  items: LandRegionSummary[]; total: number; page: number; totalPages: number;
}
export interface LandRegionDetailResult {
  items: LandTransaction[]; total: number; page: number; totalPages: number;
  jimokDistribution: Array<{ jimok: string; count: number }>;
  landUseDistribution: Array<{ landUse: string; count: number }>;
  priceTimeline: LandTimelinePoint[];
}
export interface LandHubSummary {
  cities: Array<{ slug: string; city: string; indexableDongCount: number; totalTransactions: number }>;
  totalTransactions: number;
}

export function isLandIndexable(r: Pick<LandRegionSummary, 'isIndexable'>): boolean {
  return r.isIndexable === true;
}

// 평당 → ㎡당 환산 (병기용)
export function pyeongToSqm(pricePerPyeong: number | null): number | null {
  return pricePerPyeong == null ? null : Math.round((pricePerPyeong / 3.305) * 100) / 100;
}
```
- [ ] **Step 4:** vitest → PASS (2).
- [ ] **Step 5:** Commit `feat(land-fe): add frontend land types`.

---

## Task 2: 컴포저블 — composables/useLand.ts

**Files:** Create `frontend/composables/useLand.ts`; Test `frontend/tests/composables/useLand.test.ts`.
**Reference:** mirror `frontend/composables/useRealEstate.ts` (uses `useApiBase()` + `$fetch` + `URLSearchParams`, returns `res.data`).

- [ ] **Step 1: 실패 테스트** — mock `$fetch`, assert URL + params:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useLand } from '~/composables/useLand';

describe('useLand', () => {
  beforeEach(() => { (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } }); });

  it('getRegions: city/district/page 쿼리로 /regions 호출', async () => {
    const { getRegions } = useLand();
    await getRegions({ city: '서울특별시', district: '강남구', page: 2, limit: 20 });
    const url = (globalThis as any).$fetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/real-estate/land/regions');
    expect(url).toContain('city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C');
    expect(url).toContain('district=');
    expect(url).toContain('page=2');
  });

  it('getRegionDetail: bjdCode/dongName으로 /region 호출', async () => {
    const { getRegionDetail } = useLand();
    await getRegionDetail({ bjdCode: '11680', dongName: '역삼동', page: 1, limit: 20 });
    const url = (globalThis as any).$fetch.mock.calls[0][0] as string;
    expect(url).toContain('/api/real-estate/land/region');
    expect(url).toContain('bjdCode=11680');
    expect(url).toContain('dongName=');
  });

  it('getHubSummary: /hub-summary 호출', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { cities: [], totalTransactions: 0 } });
    const { getHubSummary } = useLand();
    await getHubSummary();
    expect((globalThis as any).$fetch.mock.calls[0][0]).toContain('/api/real-estate/land/hub-summary');
  });
});
```
- [ ] **Step 2:** vitest → FAIL.
- [ ] **Step 3: 구현** — mirror useRealEstate. Use `useApiBase()` for base. Functions: `getRegions({city?,district?,page,limit})`, `getRegionDetail({bjdCode,dongName,months?,page,limit})`, `getHubSummary()`. Build `URLSearchParams` (omit undefined), `$fetch<{success,data:T}>` → return `.data`. Return typed (`LandRegionListResult` etc. from `~/types/land`).
- [ ] **Step 4:** vitest → PASS (3).
- [ ] **Step 5:** Commit `feat(land-fe): add useLand composable`.

---

## Task 3: 메타/카피 — utils/landMeta.ts

**Files:** Create `frontend/utils/landMeta.ts`; Test `frontend/tests/utils/landMeta.test.ts`.
**Reference:** `frontend/utils/realEstateMeta.ts` (LABEL/description/FAQ shape) + `frontend/utils/realEstateMeta.ts` detail-meta builder if present.

Provide region-templated, unique SEO copy (피한다: 동일 문구 복붙). Functions:
- `LAND_META = { label:'토지', icon:'public', description:'전국 토지(임야·대지·전·답 등) 매매 실거래가를 지역별로…' }`
- `buildLandRegionTitle({city?,district?,dong?})` → e.g. `'역삼동 토지 시세·실거래가 | 강남구 | 일상킷'`, `'강남구 토지 실거래가 | 서울 | 일상킷'`, `'서울 토지 실거래가 | 일상킷'`, hub `'전국 토지 실거래가 | 일상킷'`.
- `buildLandRegionDescription({city?,district?,dong?,avgPricePerPyeong?,count?})` → 변수 주입 산문 (평당가/건수 포함, CTA).
- `LAND_FAQ: Array<{q;a}>` (토지 실거래가/지목/용도지역/평당가 관련 5문항).

- [ ] **Step 1: 실패 테스트** — assert title/description templating:
```typescript
import { describe, it, expect } from 'vitest';
import { buildLandRegionTitle, buildLandRegionDescription, LAND_FAQ, LAND_META } from '~/utils/landMeta';

describe('landMeta', () => {
  it('동 타이틀에 동·구·브랜드 포함', () => {
    const t = buildLandRegionTitle({ city: '서울', district: '강남구', dong: '역삼동' });
    expect(t).toContain('역삼동'); expect(t).toContain('강남구'); expect(t).toContain('일상킷');
  });
  it('허브 타이틀', () => { expect(buildLandRegionTitle({})).toContain('전국 토지'); });
  it('설명에 평당가/건수 주입', () => {
    const d = buildLandRegionDescription({ city:'서울', district:'강남구', dong:'역삼동', avgPricePerPyeong: 6587, count: 73 });
    expect(d).toContain('역삼동'); expect(d).toMatch(/6,?587|평당/); 
  });
  it('FAQ ≥4, META label 토지', () => { expect(LAND_FAQ.length).toBeGreaterThanOrEqual(4); expect(LAND_META.label).toBe('토지'); });
});
```
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS → **Step 5:** Commit `feat(land-fe): add landMeta copy/FAQ`.

---

## Task 4: 허브 페이지 — pages/real-estate/land/index.vue

**Files:** Create `frontend/pages/real-estate/land/index.vue`; Test `frontend/tests/pages/real-estate/landHub.test.ts`.
**Reference:** `frontend/pages/real-estate/index.vue` (useAsyncData hub-summary, useFacilityMeta/setMeta, useStructuredData breadcrumb+itemList).

Page behavior:
- SSR `useAsyncData('land-hub', () => useLand().getHubSummary())`.
- Render hero(LAND_META) + 시·도 카드 그리드 (cities: link `/real-estate/land/${slug}`, show indexableDongCount + totalTransactions) + LAND_FAQ + 데이터 출처 섹션(기존 컴포넌트 재사용).
- SEO: `setMeta({title: buildLandRegionTitle({}), description: LAND_META.description, path:'/real-estate/land'})`. Breadcrumb [홈, 부동산 실거래가(/real-estate), 토지(/real-estate/land)]. ItemList = cities links. Always index.
- AdBanner: 기존 허브와 동일 위치.

- [ ] **Step 1: 실패 테스트** (mirror `landHub` ~ `realEstateHub.test.ts`): component exists + breadcrumb/itemList schema called with `/real-estate/land` URLs.
- [ ] **Step 2:** FAIL → **Step 3:** implement page → **Step 4:** PASS → **Step 5:** Commit `feat(land-fe): land hub page`.

---

## Task 5: 시·도 페이지 — pages/real-estate/land/[city]/index.vue

**Files:** Create page; Test `frontend/tests/pages/real-estate/landCity.test.ts`.
**Reference:** `frontend/pages/real-estate/[realEstateType]/[city]/index.vue`.

Behavior:
- Read `route.params.city` (slug). Convert slug→한글명 via `CITY_SLUG_MAP` (frontend). 404 via `createError` if unknown.
- SSR `useAsyncData('land-city-'+slug, () => getRegions({ city: 한글명, page:1, limit:100 }))` → group items by `district`, render 구·군 카드 (link `/real-estate/land/${citySlug}/${districtSlug}`, aggregate count/avg). (구·군 집계: items를 district로 묶어 합산/가중평균.)
- SEO: title `buildLandRegionTitle({city})`, breadcrumb [홈, 부동산, 토지, {시도}]. Always index.
- Empty → no-store header (SSR) + 안내 문구.

- [ ] Steps 1–5 (TDD: component exists + breadcrumb called with city URL). Commit `feat(land-fe): land city page`.

---

## Task 6: 구·군 페이지 — pages/real-estate/land/[city]/[district]/index.vue

**Files:** Create page; Test `landDistrict.test.ts`.
**Reference:** `frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue`.

Behavior:
- Read city+district slugs → 한글명. 404 if unknown.
- SSR `getRegions({ city, district, page:1, limit:100 })` → 동 목록(평당가·건수·isIndexable). Render 동 카드 list (link `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dongName)}`), 평당가 desc 정렬. Show 평당가 + ㎡당 병기 + 거래건수. 비색인 동은 카드에 표시하되 `rel="nofollow"`는 불필요(내부링크 허용), 색인 제어는 동 페이지에서.
- SEO: title `buildLandRegionTitle({city,district})`, breadcrumb 5단계 [홈, 부동산, 토지, 시도, 구군]. Always index.

- [ ] Steps 1–5 (TDD: component exists + breadcrumb 5 crumbs + dong links). Commit `feat(land-fe): land district page`.

---

## Task 7: 동 상세 페이지 — pages/real-estate/land/[city]/[district]/[dong].vue (품질 게이트 핵심)

**Files:** Create page; Test `landDongDetail.test.ts`.
**Reference:** `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (useHead meta+canonical+noindex 패턴, breadcrumb 6단계).

Behavior:
- Read city/district slugs→한글명, `dong = decodeURIComponent(route.params.dong).normalize('NFC')`. Need `bjdCode`: derive from the district. **bjdCode 확보 방법**: call `getRegions({city,district,page:1,limit:100})` and find the item where `dongName === dong` → gives `bjdCode` + `isIndexable` + summary. If not found → 404.
- SSR `useAsyncData('land-dong-'+dong, ...)` loading: (a) the matching region summary (for bjdCode/isIndexable/avg), then (b) `getRegionDetail({bjdCode,dongName:dong,page:1,limit:20})`.
- Render: 평당가 요약(평당+㎡당, 거래건수, 최신거래일) · 거래내역 표(지번/지목/면적/평당가/거래일, 지분거래 뱃지) · 평당가 시계열(간단 차트 or 표) · 지목 분포 · 용도지역 분포 · (지역 중심 지도: 기존 useKakaoMap + Region 중심좌표 — 좌표 없으면 생략) · 자동생성 설명/FAQ(landMeta) · AdBanner(기존 상세와 동일).
- **SEO 게이트**: `const noindex = computed(() => !regionSummary.value?.isIndexable)`. useHead: title `buildLandRegionTitle({city,district,dong})`, description `buildLandRegionDescription({...,avgPricePerPyeong,count})`, og/canonical. If noindex → meta `robots: 'noindex, follow'` + canonical을 구 페이지(`/real-estate/land/${citySlug}/${districtSlug}`)로. Else canonical = self.
- Breadcrumb 6단계 [홈, 부동산, 토지, 시도, 구군, 동].

- [ ] **Step 1: 실패 테스트** (`landDongDetail.test.ts`): component exists; mock useRoute params; mock useLand to return a region with isIndexable=false → assert `useHead` 호출 인자에 `robots: 'noindex, follow'` 포함 + canonical이 구 페이지. Another case isIndexable=true → no noindex, canonical self. Breadcrumb 6 crumbs.
- [ ] **Step 2:** FAIL → **Step 3:** implement → **Step 4:** PASS → **Step 5:** Commit `feat(land-fe): land dong detail page with index gate`.

---

## Task 8: 허브 진입점 — 부동산 허브에 토지 카드/링크 추가

**Files:** Modify `frontend/pages/real-estate/index.vue` (ItemList에 토지 추가) + `frontend/components/realEstate/RealEstateCategoryCards.vue` (또는 별도 토지 카드 — land는 sale/rent 분기 없으므로 단일 "토지" 카드가 `/real-estate/land`로 링크). Update tests `frontend/tests/pages/real-estate/realEstateHub.test.ts`.

- 단일 토지 카드 추가(라벨 '토지', iconImg 'land', href `/real-estate/land`). RealEstateCategoryCards는 6종 sale/rent 구조라 land를 억지로 넣지 말 것 — 허브 페이지에 별도 "토지 실거래가" 카드/배너를 추가하거나, 카드 그리드 아래 링크 섹션으로.
- `setItemListSchema`에 `{ name:'토지 실거래가', url:'/real-estate/land' }` 추가.

- [ ] **Step 1:** Update `realEstateHub.test.ts` to assert itemList includes `/real-estate/land`. FAIL.
- [ ] **Step 2:** implement (add card/link + itemList entry). PASS.
- [ ] **Step 3:** Commit `feat(land-fe): link 토지 from real-estate hub`.

---

## Task 9: 사이트맵 — 토지 URL(품질 게이트 반영)

**Files:**
- Backend: add `frontend` sitemap data source. The frontend sitemap route (`frontend/server/routes/sitemap/[...].ts`) fetches from backend. Add a backend endpoint `GET /api/sitemap/land-regions` returning `{ cities:[{citySlug...}], districts:[...], dongs:[{city,district,dongName, isIndexable:true only}] }` — OR simplest: `GET /api/real-estate/land/sitemap` returning indexable dong rows + distinct city/district. Implement in `backend/src/routes/land.ts` + `landService` (`getSitemapEntries()`), TDD.
- Frontend: add a `land` category branch in `frontend/server/routes/sitemap/[...].ts` mirroring the `real-estate-hub` branch: always emit `/real-estate/land`, each city, each district; emit dong URLs ONLY for `isIndexable` rows. Use existing `toCitySlug`/`toDistrictSlug`.
- Register the new sitemap segment wherever the sitemap index lists categories.

**Reference:** `frontend/server/routes/sitemap/[...].ts` `real-estate-hub`/`real-estate` branches; `backend` sitemap service.

- [ ] **Step 1 (backend): TDD** — `landService.getSitemapEntries()` returns distinct cities/districts (all) + dongs where `isIndexable`. Test with mocked landAreaSummary.findMany. Route `GET /api/real-estate/land/sitemap` returns `{success,data}`. Route test.
- [ ] **Step 2 (frontend): TDD** — sitemap integration test (mirror `sitemap.integration.test.ts`) asserting land hub/city/district always present and a non-indexable dong is excluded while an indexable dong is included.
- [ ] **Step 3:** implement both → tests PASS.
- [ ] **Step 4:** Commit `feat(land): land sitemap entries gated by isIndexable`.

---

## Task 10: 전체 검증 — 프론트 test + lint + build, dev 스모크

**Files:** none (verification).

- [ ] **Step 1:** `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test` → all pass.
- [ ] **Step 2:** `npm run lint` → 0 errors.
- [ ] **Step 3:** `npm run build` (nuxt build) → success (SSR pages compile).
- [ ] **Step 4 (dev 스모크):** backend dev(8000) + frontend dev(3000) 기동 후:
  - `/real-estate/land` 200 + 시도 카드(서울) 노출
  - `/real-estate/land/seoul` 200 + 강남구 카드
  - `/real-estate/land/seoul/gangnam-gu` 200 + 동 목록(역삼동 등, 평당가)
  - `/real-estate/land/seoul/gangnam-gu/역삼동` 200 + 거래표/분포/시계열, `<meta name=robots>`가 isIndexable에 맞게(역삼동=index)
  - 거래 적은 동(가짜 or 실제 저거래 동) → noindex + canonical 구 페이지 확인 (view-source).
- [ ] **Step 5:** (커밋 없음 — 검증) 발견 이슈는 해당 태스크로 환원해 수정.

---

## Self-Review (작성자)
- **Spec 커버리지**: 8.1 라우팅(정적 land/ 우선)=구조 전체 · 6.2 콘텐츠 두께(거래표·시계열·지목/용도 분포·FAQ)=Task7 · 6.1 품질 게이트(noindex+canonical)=Task7 · 6.3 사이트맵 게이트=Task9 · 허브 진입=Task8 · 평당가 병기=Task1/3/7. **범위 밖(Plan3)**: 공시지가 배율·지가변동률·용도지역 해설·지도 고도화.
- **Explore 오결론 정정**: land는 `[realEstateType]` 재사용/`land-sale` 슬러그 금지 — 정적 `land/` + region 구조 사용.
- **타입 일관성**: `useLand` 반환 타입(types/land.ts) ↔ 페이지 사용 ↔ Plan 1 API 응답 키 일치.
- **알려진 리스크**: 동 상세가 bjdCode 확보 위해 getRegions를 한 번 더 호출(구 단위, limit 100) — 동 수가 100 초과하는 구는 거의 없음. 초과 시 페이지네이션 보강은 Plan 3.
