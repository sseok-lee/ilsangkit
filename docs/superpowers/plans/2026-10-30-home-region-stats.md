# 홈 지역 시세 통계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 "지금, 우리 동네 거래는"에 아파트 평당가·최고가 TOP 3 줄을 더하고, 그 아래 "요즘 거래가 늘어난 지역" 섹션을 새로 둔다(기존 "인기 지역" 삭제).

**Architecture:** 매일 03:00 수집 때 `refreshRegionMarketSummary` 스크립트가 아파트 매매 거래를 지역(전국/시·도/시군구)별로 집계해 `RegionMarketSummary` 테이블을 통째로 교체한다. 홈 API는 그 테이블만 읽는다(`home-market`에 `priceStats` 추가, 새 `rising-regions`). 프론트는 기존 `HomeMarketSection`에 줄을 더하고 새 `HomeRisingRegions` 컴포넌트를 둔다.

**Tech Stack:** Express 5 ESM + Prisma/MySQL 8, Nuxt 3 SSR + Vue 3 + Tailwind, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-home-region-stats-design.md`

## Global Constraints

- Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). lock 파일 재생성 금지.
- Backend ESM: 로컬 import 는 `.js` 확장자. 라우트는 `validate()` + `asyncHandler()`. 새 라우트는 `/:type` 라우트보다 위.
- 아파트 매매(`AptSaleTransaction`)만. 대상 거래: 취소 아님(`cancelDealDay`·`cancelDealType` 둘 다 NULL 또는 `''`), 직거래 아님(`dealType IS NULL OR dealType <> '직거래'`), `dealDay IS NOT NULL`, `exclusiveArea > 0`, `dealAmount > 0`, 계약일 < 오늘(KST).
- 평당가(만원/3.3m²) = `dealAmount / exclusiveArea × 3.3058`, 정수로 반올림.
- 기간(오늘 KST = T, 모두 계약일 기준, 양끝 포함): 최근 12개월 = T−365 ~ T−1, 그 전 12개월 = T−730 ~ T−366, 최근 구간 = T−60 ~ T−31, 직전 구간 = T−90 ~ T−61.
- 상수는 한 곳(`backend/src/constants/regionMarket.ts`): `RECENT_FROM_DAYS=60`, `RECENT_TO_DAYS=31`, `PREV_FROM_DAYS=90`, `PREV_TO_DAYS=61`, `MIN_RISING_VOLUME=20`, `MIN_PRICE_SAMPLE=20`, `TOP_DEALS_LIMIT=3`, `RISING_LIMIT=10`, `CAPITAL_CITY_SLUGS=['seoul','gyeonggi','incheon']`.
- 운영 DB 직접 집계 금지: 홈 API 는 `RegionMarketSummary` 만 읽는다.
- 화면 문구(정확히): 줄 라벨 "아파트 평당가 중간값", 변화율 "1년 전 대비", 목록 제목 "최고가 거래 TOP 3", 섹션 제목 "요즘 거래가 늘어난 지역", 탭 "전국"·"수도권"·"지방", 빈 탭 "이 기간 거래가 늘어난 지역이 없습니다", 출처 "국토교통부 아파트 매매 실거래가 · 직거래·취소 제외 · 일상킷 집계".
- 홈 섹션 순서: `HomeMarketSection` → `HomeRisingRegions` → 기존 `AdBanner` → `HomeSubscriptionSection` …. "인기 지역" 섹션 삭제. 광고 개수 변경 금지.
- 커밋 메시지 한국어, Conventional Commits.

## Review Focus

1. 요약 테이블이 비어 있음(배포 직후) → `priceStats` 는 `ok`+`null`, `rising-regions` 는 빈 `items`; 화면은 줄 숨김·빈 문구, 500 아님. (Task 4, 5, 6)
2. 시·도 단위 `광주`/`전남`/통합 slug, `서울특별시`/`서울` 혼재 → 홈이 보내는 slug 조합마다 요약 행이 존재하고 조회가 같은 행을 찾음. (Task 1, 3)
3. 그 전 12개월 표본 < 20 → `ppYoyPct` null, 화면에서 변화율만 숨김. (Task 2, 5)
4. 거래 수가 적은 지역(최근 19건) / 감소 지역 / 직전 0건 → 순위 제외. (Task 2)
5. 요약 계산 중간 실패 → 이전 행 그대로(부분 교체 없음), SyncHistory failed. (Task 3)

---

### Task 1: 스키마 + 지역 키 공용화

**Files:**
- Modify: `backend/prisma/schema.prisma` (새 모델)
- Create: `backend/prisma/migrations/202610300003_region_market_summary/migration.sql`
- Create: `backend/src/constants/regionMarket.ts` (Global Constraints 상수)
- Create: `backend/src/services/marketRegionResolver.ts`
- Modify: `backend/src/services/homeMarketService.ts` (resolveRegion/regionLookupCities/belongsToSelectedCity 를 새 파일로 이동해 import)
- Test: `backend/__tests__/services/marketRegionResolver.test.ts`

**Interfaces:**
- Produces:
  - Prisma `RegionMarketSummary { id Int @id @default(autoincrement()); scope String @db.VarChar(10) /* 'nation'|'city'|'district' */; citySlug String @default("") @db.VarChar(50); districtSlug String @default("") @db.VarChar(50); label String @db.VarChar(100); ppMedian12m Int?; ppMedianPrev12m Int?; dealCount12m Int; dealCountPrev12m Int; topDeals Json; volRecent Int; volPrev Int; recentFrom String @db.VarChar(10); recentTo String @db.VarChar(10); prevFrom String @db.VarChar(10); prevTo String @db.VarChar(10); computedAt DateTime; @@unique([scope, citySlug, districtSlug]); @@index([scope, volRecent]) }`
  - `resolveMarketRegion(input: { city?: string; district?: string }): Promise<ResolvedRegion>` — 기존 `resolveRegion` 과 동작 동일(같은 ValidationError).
  - `listMarketRegionKeys(): Promise<MarketRegionKey[]>` — 홈 지역 선택이 보낼 수 있는 모든 조합: `{scope:'nation', citySlug:'', districtSlug:'', label:'전국'}`, 시·도마다 `{scope:'city', citySlug, districtSlug:'', label, queryCity, districtLimit}`, 시군구마다 `{scope:'district', citySlug, districtSlug: Region.slug, label, queryCity, queryDistrict}`. 시·도 목록은 `CITY_SLUG_TO_FULL` 키.
  - `ResolvedRegion` 타입은 새 파일에서 export.

- [ ] **Step 1: 테스트 작성** — `marketRegionResolver.test.ts` (prisma.region.findMany mock):
  - `listMarketRegionKeys()` 첫 원소가 `{scope:'nation', citySlug:'', districtSlug:'', label:'전국'}`.
  - `gwangju` 시·도 키의 `districtLimit` 에는 `GWANGJU_GU_BJD` 구만, `jeonnam` 키에는 통합시 행 중 광주 구 제외만 들어간다.
  - 모든 district 키에 대해 `resolveMarketRegion({city: k.citySlug, district: k.districtSlug})` 의 `queryDistrict` 가 키의 `queryDistrict` 와 같다.
- [ ] **Step 2:** `npx vitest run __tests__/services/marketRegionResolver.test.ts` → FAIL(모듈 없음).
- [ ] **Step 3:** 모델·마이그레이션(`CREATE TABLE` + 유니크·인덱스, 기존 마이그레이션 SQL 스타일), 상수 파일, resolver 이동 + `listMarketRegionKeys` 구현. `npm run db:generate`, 로컬 DB에 `npx prisma migrate deploy`.
- [ ] **Step 4:** 새 테스트 + `__tests__/services/homeMarketService.test.ts` + `__tests__/routes/homeMarket.test.ts` PASS, `npx tsc --noEmit` 통과.
- [ ] **Step 5:** 커밋 `feat(home): 지역 시세 요약 테이블·지역 키 공용화`

### Task 2: 요약 계산 (순수 함수 + 집계 쿼리)

**Files:**
- Create: `backend/src/services/regionMarketSummaryService.ts`
- Test: `backend/__tests__/services/regionMarketSummaryService.test.ts`

**Interfaces:**
- Consumes: Task 1 `listMarketRegionKeys`, 상수.
- Produces:
  - `regionMarketWindows(todayKst: string): { last12: DateRange; prev12: DateRange; recent: DateRange; prev: DateRange }` (`DateRange = {from: string; to: string}` YYYY-MM-DD).
  - `median(values: number[]): number | null` (짝수 개면 두 가운데 평균 반올림, 빈 배열 null).
  - `yoyPct(cur: number | null, prev: number | null, prevCount: number): number | null` — prevCount < `MIN_PRICE_SAMPLE` 이거나 둘 중 null 이면 null, 아니면 `(cur/prev − 1) × 100` 소수 1자리.
  - `isRising(volRecent: number, volPrev: number): boolean` — `volRecent ≥ MIN_RISING_VOLUME && volPrev ≥ 1 && volRecent > volPrev`.
  - `computeRegionMarketSummaries(todayKst: string): Promise<RegionMarketSummaryRow[]>` — 키마다 한 행(Prisma create 입력 형태). `topDeals` 원소 = `{buildingName, bjdCode, dongName, jibun, area, amount, date, canonicalPath}` (최근 12개월 금액 내림차순 3건, canonicalPath 는 `attachRealEstateCanonicalPaths(..., 'apt-sale')`).
  - 쿼리 방식은 자유(지역별 쿼리 또는 GROUP BY 후 앱 매핑). 최근 24개월 범위 밖은 읽지 않는다.

- [ ] **Step 1: 테스트 작성:**
  - `regionMarketWindows('2026-10-30')` → `recent {from:'2026-08-31', to:'2026-09-29'}`, `prev {from:'2026-08-01', to:'2026-08-30'}`, `last12 {from:'2025-10-30', to:'2026-10-29'}`, `prev12 {from:'2024-10-30', to:'2025-10-29'}`.
  - `median([3,1,2])===2`, `median([1,2,3,4])===3`, `median([])===null`.
  - `yoyPct(7840, 7120, 25)===10.1`, `yoyPct(7840, 7120, 19)===null`, `yoyPct(null, 7120, 30)===null`.
  - `isRising(20,10)===true`, `isRising(19,5)===false`, `isRising(30,0)===false`, `isRising(25,25)===false`.
  - `computeRegionMarketSummaries` (prisma `$queryRaw*` mock): 직거래·취소 행이 SQL 조건에 포함되는지 생성된 SQL 문자열로 확인(`'직거래'`, `cancelDealDay`, `cancelDealType`, `dealDay IS NOT NULL`), 거래 0건 지역도 행이 생기고 `ppMedian12m:null, dealCount12m:0, topDeals:[]`.
- [ ] **Step 2:** 실행 → FAIL.
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** PASS + `tsc --noEmit`.
- [ ] **Step 5: 신고 지연 측정** — 로컬 DB(`docker compose` MySQL)에서 최근 6개월 계약분에 대해 `DATEDIFF(DATE(createdAt), 계약일)` 분포(30/45/60/90일 누적 비율)를 SQL 로 뽑아 리포트에 붙인다. 31일째 미신고 비율이 10%를 넘으면 리포트에 그 값을 적고 상수는 그대로 둔다(경계 변경은 컨트롤러 판단). 로컬 데이터가 일일 동기화 이력이 없어 의미 없으면 그렇다고 적는다.
- [ ] **Step 6:** 커밋 `feat(home): 지역 평당가·거래 증감 요약 계산`

### Task 3: 요약 갱신 스크립트 + 03:00 단계

**Files:**
- Modify: `backend/src/services/regionMarketSummaryService.ts` (`refreshRegionMarketSummaries` 추가)
- Create: `backend/src/scripts/refreshRegionMarketSummary.ts`
- Modify: `scripts/ops/sync-real-estate.sh` (Summary 단계 다음, subscription 앞)
- Test: `backend/__tests__/services/regionMarketSummaryService.test.ts` (추가)

**Interfaces:**
- Consumes: Task 2 `computeRegionMarketSummaries`.
- Produces: `refreshRegionMarketSummaries(todayKst?: string): Promise<SyncStats>` — `runSync('region-market', …)` 안에서 계산 전부 끝난 뒤 `prisma.$transaction([deleteMany(), createMany(rows)])`. 행 0개면 throw(삭제 안 함). `stats.totalRecords = rows.length`.

- [ ] **Step 1: 테스트:** 계산이 throw 하면 `deleteMany` 미호출; 0행이면 throw·`deleteMany` 미호출; 정상이면 `$transaction` 1회에 delete→create 순서.
- [ ] **Step 2:** FAIL 확인. **Step 3:** 구현. 스크립트는 `installRuntimeGuard({ maxMinutes: 14, name: 'refreshRegionMarket', prisma })` + 실행 시간·행 수 로그 + 실패 시 `process.exitCode = 1`, 끝에 `$disconnect`.
- [ ] **Step 4:** ops 단계 추가 — K-apt 단계와 같은 형태:
  ```bash
  echo "[step:region-market-start]"
  run_backend_node_timed 15m "$ACTIVE_BACKEND_DIR/dist/scripts/refreshRegionMarketSummary.js" \
    || echo "[warn] 지역 시세 요약 갱신 실패 (exit=$?) — region-market 이력 확인"
  echo "[step:region-market-end]"
  ```
  (`REAL_ESTATE_SYNC_EXIT` 는 건드리지 않는다.)
- [ ] **Step 5:** PASS. 로컬에서 `npx tsx src/scripts/refreshRegionMarketSummary.ts` 실행 → 걸린 시간·행 수·서울 강남구 행 값을 리포트에 적는다. `bash -n scripts/ops/sync-real-estate.sh` 통과.
- [ ] **Step 6:** 커밋 `feat(home): 지역 시세 요약 일일 갱신 단계`

### Task 4: API

**Files:**
- Modify: `backend/src/types/housingRedesign.ts`, `backend/src/services/homeMarketService.ts`, `backend/src/routes/realEstate.ts`, `backend/src/schemas/` (기존 HomeMarketQuerySchema 파일)
- Create: `backend/src/services/risingRegionsService.ts`
- Test: `backend/__tests__/routes/homeMarket.test.ts` (추가), `backend/__tests__/routes/risingRegions.test.ts`

**Interfaces:**
- Produces:
  - `HomeMarket.priceStats: SectionResult<RegionPriceStats | null>`; `RegionPriceStats { ppMedian: number; ppYoyPct: number | null; dealCount12m: number; topDeals: RegionTopDeal[]; computedAt: string }`; `RegionTopDeal { buildingName: string; bjdCode: string; dongName: string; jibun: string | null; area: string | null; amount: number; date: string; canonicalPath: string | null }`.
  - `GET /api/real-estate/rising-regions?scope=all|capital|nonCapital` (기본 all) → `{ success: true, data: RisingRegions }`; `RisingRegions { scope; window: DateRange; prevWindow: DateRange; computedAt: string | null; items: RisingRegion[] }`; `RisingRegion { label; citySlug; districtSlug; ppMedian: number | null; volRecent: number; volPrev: number; changePct: number }`.
  - 둘 다 메모리 캐시 10분(기존 home-market 캐시 패턴).

- [ ] **Step 1: 테스트:**
  - home-market: 요약 행이 있고 `dealCount12m≥20` → `priceStats.status==='ok'`·`data.ppMedian`; 행 없음 또는 `dealCount12m=19` → `{status:'ok', data:null}`; 요약 조회 throw → `{status:'error'}` 이고 다른 섹션(counts) 영향 없음.
  - `ppYoyPct` 는 Task 2 `yoyPct(ppMedian12m, ppMedianPrev12m, dealCountPrev12m)`.
  - rising-regions: `scope=capital` 은 seoul/gyeonggi/incheon 만, `nonCapital` 은 그 외; `isRising` false 행 제외; `changePct` 내림차순, 최대 10; 테이블 비면 `items:[]`, `computedAt:null`, 200; `scope=foo` → 422.
- [ ] **Step 2:** FAIL. **Step 3:** 구현. **Step 4:** PASS + `npm run lint` + `tsc --noEmit`.
- [ ] **Step 5:** 커밋 `feat(home): 평당가·거래 늘어난 지역 API`

### Task 5: "우리 동네 거래" 평당가 줄

**Files:**
- Modify: `frontend/types/housingRedesign.ts` (Task 4 타입 반영), `frontend/components/home/HomeMarketSection.vue`
- Test: `frontend/tests/components/home/HomeMarketSection.test.ts`

**Interfaces:**
- Consumes: `HomeMarket.priceStats` (Task 4).

- [ ] **Step 1: 테스트:**
  - `priceStats` ok → "아파트 평당가 중간값", "7,840만원", "1년 전 대비 +10.1%", "최고가 거래 TOP 3" 와 단지 3개(각 `canonicalPath` 링크) 렌더.
  - `ppYoyPct:null` → "1년 전 대비" 없음, 평당가는 있음.
  - `data:null` 또는 `status:'error'` → 새 줄 전체 미렌더(에러 문구 없음).
  - "자세히" 링크: 시군구 선택 시 `/real-estate/apt-sale/{city}/{district}`, 시·도만 `/real-estate/apt-sale/{city}`, 전국 `/real-estate/apt-sale` (기존 `toRealEstateListUrl` 등 URL 유틸 사용).
- [ ] **Step 2:** FAIL. **Step 3:** 구현 — 건수 카드 아래, 시안 ③ 배치(데스크톱 2열: 평당가 | TOP 3, 모바일 1열). 금액은 기존 `formatKoreanPrice`. 증감 색은 기존 토큰. 링크·버튼 높이 44px 이상.
- [ ] **Step 4:** PASS + `npm run lint`. **Step 5:** 커밋 `feat(home): 우리 동네 거래에 평당가·최고가 줄`

### Task 6: "요즘 거래가 늘어난 지역" 섹션 + 홈 배치

**Files:**
- Create: `frontend/composables/useRisingRegions.ts`, `frontend/components/home/HomeRisingRegions.vue`
- Modify: `frontend/pages/index.vue`, `frontend/types/housingRedesign.ts`
- Test: `frontend/tests/components/home/HomeRisingRegions.test.ts`, `frontend/tests/pages/index.test.ts`

**Interfaces:**
- Consumes: `GET /api/real-estate/rising-regions` (Task 4).
- Produces: `useRisingRegions()` → `{ scope: Ref<'all'|'capital'|'nonCapital'>, data, pending, error, setScope }` — SSR 은 `useAsyncData('home-rising:all')`, 탭 전환은 클라이언트 `$fetch`.

- [ ] **Step 1: 테스트:**
  - 항목 렌더: 순위·라벨·"평당가 5,280만"·"+34%"·링크 `/real-estate/apt-sale/seoul/seongdong-gu` 형태.
  - 데스크톱 10개, 모바일은 5개 후 "10위까지 더 보기" 버튼(클릭 시 10개).
  - 기간 문구 "{M}월 {D}일~{M}월 {D}일 계약, 직전 30일 대비" (`window` 로 생성).
  - `items:[]` → "이 기간 거래가 늘어난 지역이 없습니다".
  - API 실패 → 목록·탭 숨김, 제목과 시·도 칩은 렌더.
  - 시·도 칩은 항상 렌더(기존 "인기 지역"의 `CITY_LINKS` 그대로 재사용).
  - `index.test.ts`: "인기 지역" 문자열 없음; DOM 순서 `HomeMarketSection` → `HomeRisingRegions` → 첫 `AdBanner` → `HomeSubscriptionSection`; `AdBanner` 개수 변경 없음.
- [ ] **Step 2:** FAIL. **Step 3:** 구현 — 시안 ③(데스크톱)·③ 모바일. 탭 `role="group"` + `aria-pressed`, 높이 44px. 출처 문구(Global Constraints).
- [ ] **Step 4:** frontend `npm run test` 전체 + `npm run lint` PASS.
- [ ] **Step 5:** 커밋 `feat(home): 요즘 거래가 늘어난 지역 섹션`

### Task 7: 로컬 통합 확인

- [ ] **Step 1:** 로컬 백엔드·프론트 dev 서버(이미 떠 있으면 build 금지)에서 `/` 를 열어 두 줄이 실제 요약 데이터로 렌더되는지, 지역 바꾸면 평당가 줄이 바뀌는지, 탭 3개 동작을 확인하고 스크린샷(데스크톱·390px)을 리포트에 첨부.
- [ ] **Step 2:** backend·frontend 전체 `npm run test`, `npm run lint`, backend `npm run build` 통과 기록.
