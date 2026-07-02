# 네이버 회복 2단계-B: TRASH 사이트맵 region 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]`.

**Goal:** 사이트맵의 개별 `/trash/[id]` URL(~8,882, 전부 301됨=크롤 낭비)을 제거하고, 색인 대상인 구·군 집계 URL `/[citySlug]/[districtSlug]/trash`(~250)로 교체한다. 크롤 예산 회수 + 집계 페이지 discovery.

**Architecture:** shared 순수 슬러그 유틸 1개(서버·클라 공용) + 백엔드 지역 groupBy 소스 + 프론트 Nitro 사이트맵(generator·index·fetch·static) 전환. 슬러그는 **반드시 기존 301 타겟(`buildTrashRegionPath`)과 byte-match** — 이게 correctness 핵심.

**Tech Stack:** Nuxt 3 Nitro server routes / Express 백엔드 / Prisma / Vitest (happy-dom), Node 20.

## Global Constraints
- **Node 20**: `source ~/.nvm/nvm.sh && nvm use 20` 후 npm/vitest. **package-lock 금지**.
- 프론트 테스트 `cd frontend`, 백엔드 `cd backend`.
- 브랜치 `fix/naver-trash-sitemap`(develop 기준). main/develop 직접 커밋 금지. 한국어 conventional commit.
- **불변식: 사이트맵 trash region URL === `/trash/[id]` 301 타겟 === 집계 페이지 canonical.** 세 개가 반드시 같은 슬러그.
- 개별 `/trash/[id]`는 이미 301(2-A)·집계 페이지는 이미 존재. 본 플랜은 사이트맵만.
- ESM: 백엔드 로컬 import에 `.js` 확장자.

---

### Task 1: 서버안전 shared `buildTrashRegionPath` 추출 (correctness 핵심)

**문제:** 현재 `frontend/utils/trashRegion.ts`의 `buildTrashRegionPath`는 `~/composables/useRegions`(top-level `import {ref,...} from 'vue'`)에 의존 → Nitro 서버 라우트에서 쓰기 취약. 사이트맵이 같은 슬러그를 생성하려면 순수(Vue無) 공용 유틸 필요.

**핵심 동치 요건:** district 슬러그가 `useRegions.generateSlug`와 **정확히 동일**해야 함(301이 그걸 씀). `generateSlug` 로직:
```
DISTRICT_SLUG_MAP[d] || d.replace(/[시군구]/g,'').replace(/[가-힣]/g,'').toLowerCase().replace(/\s+/g,'-')
```
(shared의 기존 `getDistrictSlug`는 폴백이 달라서 **쓰면 안 됨** — 미매핑 구에서 어긋남.)

**Files:**
- Modify: `frontend/shared/regionSlugs.ts` (순수 함수 추가; `CITY_FULL_NAME_TO_SLUG`·`CITY_SLUGS`·`DISTRICT_SLUG_MAP` 이미 여기 있음)
- Modify: `frontend/utils/trashRegion.ts` (shared 것을 재-export/위임 — 클라 import 경로 `~/utils/trashRegion` 유지)
- Test: `frontend/tests/shared/regionSlugs.test.ts` (신규) + 기존 `frontend/tests/utils/trashRegion.test.ts` 유지

- [ ] **Step 1: byte-match 회귀 테스트 먼저 (RED)**
`frontend/tests/shared/regionSlugs.test.ts` 생성 — shared `buildTrashRegionPath`가 기존 trashRegion 값과 동일함을 대표 지역으로 검증:
```ts
import { describe, it, expect } from 'vitest'
import { buildTrashRegionPath } from '~/shared/regionSlugs'

describe('shared buildTrashRegionPath', () => {
  it('정식 도명 → 슬러그 (라이브 검증값)', () => {
    expect(buildTrashRegionPath('경기도', '가평군')).toBe('/gyeonggi/gapyeong/trash')  // 2-A 라이브 확인값
    expect(buildTrashRegionPath('서울특별시', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('축약 도명', () => {
    expect(buildTrashRegionPath('서울', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('미해결 도시는 null', () => {
    expect(buildTrashRegionPath('없는도시', '강남구')).toBeNull()
  })
})
```
> 기대 슬러그는 실제 `CITY_FULL_NAME_TO_SLUG`/`CITY_SLUGS`/`DISTRICT_SLUG_MAP`에 맞춰 조정. 목적은 "301 타겟과 동일" 보장.

- [ ] **Step 2: 실패 확인** — `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/shared/regionSlugs.test.ts` → FAIL(함수 없음).

- [ ] **Step 3: shared에 순수 함수 구현**
`frontend/shared/regionSlugs.ts`에 추가(기존 `CITY_SLUGS`=`CITY_NAME_TO_SLUG` 소스, `CITY_FULL_NAME_TO_SLUG`, `DISTRICT_SLUG_MAP` 사용). district 슬러그는 **generateSlug와 동일 로직**:
```ts
/** useRegions.generateSlug와 동일한 district 슬러그 규칙 (순수·서버안전). */
export function trashDistrictSlug(district: string): string {
  return (
    DISTRICT_SLUG_MAP[district] ||
    district.replace(/[시군구]/g, '').replace(/[가-힣]/g, '').toLowerCase().replace(/\s+/g, '-')
  )
}

/** 쓰레기 배출 구·군 집계 경로. 301 타겟·canonical과 byte-match. citySlug 미해결 시 null. */
export function buildTrashRegionPath(city: string, district: string): string | null {
  const shortCity = city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const citySlug = CITY_FULL_NAME_TO_SLUG[city] || CITY_SLUGS[city] || CITY_SLUGS[shortCity]
  if (!citySlug) return null
  return `/${citySlug}/${trashDistrictSlug(district)}/trash`
}
```
> 주의: 기존 client `buildTrashRegionPath`는 `CITY_NAME_TO_SLUG`(=`CITY_SLUGS`)를 썼다. shared에서 `CITY_SLUGS` 직접 사용 — 동일 객체인지 확인(useRegions.ts:40 `CITY_NAME_TO_SLUG = SHARED_CITY_SLUGS`). 다르면 값 대조 테스트로 확정.

- [ ] **Step 4: client util 위임**
`frontend/utils/trashRegion.ts`를 shared 재-export로 축소(클라 동작 byte-identical 유지):
```ts
export { buildTrashRegionPath } from '~/shared/regionSlugs'
```
기존 `tests/utils/trashRegion.test.ts`가 그대로 통과해야 함(동작 불변 증명).

- [ ] **Step 5: GREEN + 무회귀**
`cd frontend && npx vitest run tests/shared/regionSlugs.test.ts tests/utils/trashRegion.test.ts` → PASS. `npm run lint` 0 new.

- [ ] **Step 6: 커밋** — `git commit -m "refactor: buildTrashRegionPath를 shared 순수 유틸로 추출 (서버·클라 슬러그 단일화)"`

---

### Task 2: 백엔드 waste schedule 지역 소스 + 사이트맵 노출

**Files:**
- Modify: `backend/src/services/wasteScheduleService.ts` (지역 distinct 조회 추가)
- Modify: `backend/src/services/sitemapService.ts` (지역 노출)
- Modify: `backend/src/routes/sitemap.ts` (엔드포인트)
- Test: `backend/__tests__/...`(기존 sitemap/wasteSchedule 테스트 위치 확인 후 추가)

**Interfaces (Produces):** `getWasteScheduleRegions(): Promise<{ city: string; district: string; updatedAt: Date }[]>` — distinct (city,district) + 그룹 max(updatedAt). 이미 있는 `groupBy(['city','district'])`(wasteScheduleService.ts:132) 재사용, `_max: { updatedAt: true }` 추가.

- [ ] **Step 1: 서비스 함수 (TDD)** — `getWasteScheduleRegions`를 groupBy로 구현. 기존 `getAllIds`(:186)는 유지(다른 용도 있으면). 테스트: mock/통합으로 distinct region 반환 검증.
- [ ] **Step 2: sitemapService/route 노출** — `sitemapService`에 regions 추가, `routes/sitemap.ts`에 엔드포인트(예: `GET /api/sitemap/waste-schedule-regions` → `{ regions: [{city,district,updatedAt}] }`). 기존 `/api/sitemap/waste-schedules`(개별 ids) 라우트는 남겨두되(다른 참조 확인) 프론트가 더는 trash sitemap에 안 씀.
- [ ] **Step 3: 검증 + 커밋** — `cd backend && npm run test && npm run lint && npm run build`. `git commit -m "feat: 사이트맵용 쓰레기 배출 구·군 지역 소스 추가 (getWasteScheduleRegions)"`

---

### Task 3: 프론트 사이트맵 trash → region URL 전환

**Files:**
- Modify: `frontend/server/utils/sitemap.ts` (`fetchWasteScheduleRegions()` 추가; 기존 `fetchWasteScheduleIds` 잔존 참조 정리)
- Modify: `frontend/server/routes/sitemap/[...].ts` (trash 브랜치 300-329행)
- Modify: `frontend/server/routes/sitemap.xml.ts` (인덱스 trash 청크 수: 88-96·152-160행)
- Modify: `frontend/server/utils/sitemapPolicy.ts` 및 `sitemap.ts`의 waste count 기준(필요 시)

- [ ] **Step 1: fetch 유틸** — `fetchWasteScheduleRegions()`가 `/api/sitemap/waste-schedule-regions`에서 `{city,district,updatedAt}[]` 반환(land/auction의 `fetchLandSitemap`/`fetchAuctionSitemap` 패턴·캐시 그대로).
- [ ] **Step 2: generator trash 브랜치 교체** — `sitemap/[...].ts`의 `category === 'trash'` 분기를 개별 id 대신 지역 URL 생성으로:
```ts
if (category === 'trash') {
  const regions = await fetchWasteScheduleRegions()
  const seen = new Set<string>()
  const urls: Parameters<typeof generateSitemapXml>[0] = []
  for (const r of regions) {
    const path = buildTrashRegionPath(r.city, r.district)   // ~/shared/regionSlugs
    if (!path || seen.has(path)) continue
    seen.add(path)
    urls.push({ loc: `${SITE_URL}${path}`, lastmod: formatDateForSitemap(r.updatedAt), changefreq: 'weekly', priority: 0.6 })
  }
  // 페이지네이션: region 수(~250)는 MAX_URLS_PER_SITEMAP 이하라 단일 청크. page>totalPages 404 유지.
  return generateSitemapXml(urls)  // (기존 청크 슬라이스 로직과 정합 — land/auction처럼 단일 반환)
}
```
`~/shared/regionSlugs`의 `buildTrashRegionPath` import 추가. 기존 하단 공통 시설 로직(322-327 `/${category}/${id}`)에서 trash가 빠지도록 분기.
- [ ] **Step 3: 인덱스(sitemap.xml.ts) trash 청크 수** — trash 페이지 수를 waste count(~8,882) 대신 region 수 기준으로 계산(88-96·152-160). region 수는 `fetchWasteScheduleRegions().length` 또는 backend count. 단일 청크면 `/sitemap/trash.xml`만.
- [ ] **Step 4: 검증** — `cd frontend && npm run lint && npm run test 2>&1 | tail -8`. dev로 `/sitemap/trash.xml` 스모크(개별 /trash/[id] 0건, `/citySlug/districtSlug/trash` 형태 확인). `git commit -m "fix: trash 사이트맵을 개별→구·군 집계 URL로 전환 (크롤예산 회수)"`

---

### Task 4: 정적 사전생성 반영 + 최종 검증

**Files:**
- Modify: `backend/src/scripts/generateSitemaps.ts` 및/또는 `frontend/server/utils/sitemapStatic.ts` (trash 정적 파일 생성이 region 기준이 되도록)
- 참고: [[project_sitemap_static_pregeneration]] — 디스크 우선 서빙 + 동적 폴백. 정적 생성물이 개별 URL이면 동적 전환이 무의미.

- [ ] **Step 1: 정적 생성 경로 확인·반영** — `generateSitemaps.ts`가 trash sitemap을 어떻게 만드는지 읽고, region 기준으로 생성되게 수정(동적 generator와 동일 소스/로직 재사용 확인). 정적/동적 출력이 **동일**해야 함.
- [ ] **Step 2: 전체 검증** — `cd frontend && npm run lint && npm run test && npm run build` + `cd backend && npm run test && npm run build`. 정적 생성 스크립트 dry-run(가능 시) 또는 dev 스모크로 trash 정적/동적 둘 다 region URL 확인.
- [ ] **Step 3: 커밋** — `git commit -m "fix: 사이트맵 정적 사전생성도 trash region URL 반영"`

---

## Self-Review
- **Spec coverage:** 개별 trash sitemap URL 제거 + region URL 추가(2-A 후속 Plan 2-B). 슬러그 3중 정합(사이트맵=301=canonical)을 Task 1 byte-match 테스트로 보증.
- **Placeholder scan:** Task 1은 완전 코드. Task 2·3·4는 기존 파일 구조를 구현자가 읽고 적용(앵커·인터페이스·패턴[land/auction] 명시).
- **Type consistency:** `buildTrashRegionPath(city,district):string|null`·`getWasteScheduleRegions():{city,district,updatedAt}[]`·`fetchWasteScheduleRegions()` 동일 시그니처로 Task 간 연결.

## 후속(범위 밖)
- 배포 후: 캐시퍼지 + 네이버 재제출(수정된 사이트맵). WIFI 허브(지역 색인 절반). measure 8~12주.
