# P0 성능·안정성 세트 — 광고 CLS · SSR 워터폴 · 동기화 N+1

**작성일:** 2026-05-27
**대상 브랜치:** develop
**저자:** Claude (브레인스토밍 협업) + sksdlaudtjr@gmail.com

---

## 1. 요약

ilsangkit 코드베이스 종합 감사 결과 가장 ROI가 큰 세 가지 성능·안정성 항목을 한 spec으로 묶어 단계별로 정비한다. 새 추상화·인프라·라이브러리를 도입하지 않고, 기존 컴포넌트·헬퍼를 확장하는 비파괴 변경으로 진행한다.

- **Phase 1 (광고 CLS)**: `AdBanner.vue`에 `sizing="fixed"` prop을 추가해 시설 상세 페이지 상위 4 광고 슬롯의 누적 레이아웃 시프트를 제거한다. AdSense 페이지 품질 신호 개선으로 RPM 상승 기대.
- **Phase 2 (SSR 워터폴)**: 시설 상세·홈·부동산 상세 3 페이지의 다중 `useAsyncData` 직렬 호출을 `Promise.allSettled`로 병렬화한다. LCP 100~250ms 단축 + 부분 실패 내성 확보.
- **Phase 3 (동기화 N+1)**: toilet/childcare/market/sports/ev-charger 5개 sync 서비스가 건당 `findUnique + upsert` 2 쿼리를 발생시키는 패턴을 기존 `batchUpsertRaw` 단일 SQL로 교체한다. 약 99만 쿼리/사이클 → 약 1만 쿼리, sync wall-time 10~40× 가속.

세 Phase는 서로 독립적이며 각각 단일 atomic PR로 들어간다. 권장 진행 순서는 Phase 1 → 2 → 3.

## 2. 배경

### 감사 결과 (2026-05-27 4-agent 코드베이스 감사)

| 영역 | 발견 | 근거 |
|---|---|---|
| 안정성 | 좀비 인시던트 대응 4/5 완료, internalApiBase 마이그레이션 완료. 잔여 회귀는 `useHead` TDZ, sitemap cold-start 등 *재발 패턴* | 80 커밋 중 SSR/sitemap/OG 관련 fix 12건. internalApiBase 40 파일 일관 적용 확인 |
| 성능 | 시설 상세 페이지 3-step 직렬 useAsyncData, 광고 6슬롯 모두 `auto` 포맷 → CLS 0.10~0.25 | `pages/[category]/[id].vue:350-695`, `components/ads/AdBanner.vue:140-152` |
| 백엔드 | 5개 facility sync가 N+1 패턴 → 약 99만 쿼리/사이클. `batchUpsertRaw`는 이미 구현되어 있지만 부동산 sync만 사용 중 | `services/toiletSyncService.ts:49-139`, `services/baseSyncService.ts:190` |

### 사용자 정책 메모 (memory에서 인용)

- AdBanner 슬롯 수·위치 임의 변경 금지 (`feedback_adbanner_placement`)
- PR 기반 워크플로우, main 직접 커밋 금지 (`feedback_pr_workflow`)
- 작업 후 backend/frontend vitest run 필수 (`feedback_test_verification`)
- 부동산 URL 절대 변경 금지 — 색인 완료 (`project_real_estate_indexing_crisis`)

## 3. 목표 / 비목표

### 목표
- 시설 상세 페이지 CLS p75 < 0.10 ("Good")
- 시설 상세·홈·부동산 상세 LCP p75 -50~250ms
- 5개 facility sync wall-time 10× 이상 가속
- SyncHistory 통계 정확성 유지 (휴리스틱 → 정확)
- 모든 변경 atomic PR, 단일 `git revert`로 복구 가능

### 비목표
- 광고 슬롯 수·위치 변경 (사용자 정책)
- 부동산 URL·라우트·사이트맵 변경 (색인 보호)
- 새 컴포넌트/composable/abstraction 도입
- 새 인프라/APM/모니터링 도구
- 좀비 인시던트 5번째 대응(`statement_timeout` 강제) — 별 spec
- 동기화 체크포인트/dead-letter queue — 별 spec
- `index.vue`·real-estate 외 다른 워터폴 페이지 — 측정 후 후속 PR

---

## 4. Phase 1 — 광고 CLS

### 4.1 현 상태

`AdBanner.vue`는 `adFormat='auto'` + `fullWidthResponsive='true'` 기본값을 사용. 부모는 포맷별 `min-height`로 빈 공간만 예약(`.ad-banner--auto: 100px`, 모바일 250px). AdSense가 min-height보다 큰 광고를 채울 때 70px 이상의 shift 발생.

`pages/[category]/[id].vue`의 광고 슬롯 6개:

| 줄 | 컨텍스트 | viewport (모바일) | 분류 |
|---|---|---|---|
| 134 | Hero 직하 | fold-in | 상위·in-content |
| 149 | BasicInfo↔FacilityStatus | fold 직하 | 상위·in-content |
| 155 | Details↔Map | mid | 상위·in-content |
| 163 | Roadview↔Nearby | mid | 상위·in-content |
| 190 | Nearby 이후 | fold-below | 하단 잉여 |
| 259 | Desktop sidebar sticky | desktop only | 하단 잉여 |

`index.vue`의 광고 3개(`:97, :105, :206`)는 모두 mid/lower fold-below.

### 4.2 변경

**1) AdBanner.vue 확장 (비파괴)**

신규 prop 2개 추가, 기본값은 기존 동작 유지:

```ts
sizing?: 'fixed' | 'min'   // default 'min'
fixedHeight?: number       // default undefined
```

`sizing="fixed"`일 때:
- `<ins>` 인라인 style에 `width:100%; height:${fixedHeight}px` 명시
- `data-full-width-responsive="false"` 강제
- `adFormat`은 `'rectangle' | 'horizontal' | 'vertical'` 중 하나 명시 필수 (dev warn)

dev-only 경고: `sizing="fixed"`에 `adFormat='auto'` 또는 `fixedHeight` 누락 시 console.warn.

**2) 호출부 변경 — `pages/[category]/[id].vue`의 상위 4 슬롯만**

```diff
- <AdBanner />
+ <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />
```

`:134, :149, :155, :163` 4곳에 적용. `:190, :259` 및 `index.vue` 슬롯은 변경 없음.

**3) min-height 보정**

`.ad-banner--auto` 모바일 min-height 250 → 280으로 조정해 fixed 슬롯과 일치. desktop은 그대로.

### 4.3 높이 선정 근거

- **rectangle 280px**: AdSense medium rectangle(300×250)과 large rectangle(336×280) 모두 수용. 폭은 컨테이너 100%.
- **horizontal 90px**: leaderboard(728×90) 정식. 본 Phase는 미사용.

### 4.4 회귀 위험과 방어

| 위험 | 가능성 | 방어 |
|---|---|---|
| unfilled collapse는 fixed에서도 일어남 → CLS 0 미달성 | 中 | fill rate ≥90% 슬롯에선 무시 가능. 측정 후 후속 검토 |
| AdSense RPM 하락 | 中 | 7일 추적, -5% 초과 시 호출부 prop 제거로 즉시 롤백 |
| Fixed slot에 작은 광고 채워질 때 빈 padding | 低 | medium/large rectangle 모두 280 안에 들어감 |

### 4.5 테스트

**Vitest** (`frontend/tests/components/ads/AdBanner.test.ts` 확장):
```ts
it('sizing="fixed"일 때 ins 높이가 인라인 스타일로 박힌다', () => {
  const wrapper = mount(AdBanner, {
    props: { sizing: 'fixed', adFormat: 'rectangle', fixedHeight: 280 }
  })
  const ins = wrapper.find('ins.adsbygoogle')
  expect(ins.attributes('style')).toContain('height:280px')
  expect(ins.attributes('data-full-width-responsive')).toBe('false')
  expect(ins.attributes('data-ad-format')).toBe('rectangle')
})

it('sizing 미지정 시 기존 동작 유지', () => {
  const wrapper = mount(AdBanner)
  const ins = wrapper.find('ins.adsbygoogle')
  expect(ins.attributes('data-ad-format')).toBe('auto')
  expect(ins.attributes('data-full-width-responsive')).toBe('true')
})
```

**Playwright E2E 1건** (`frontend/tests/e2e/ad-cls.spec.ts` 신규):
```ts
test('/[category]/[id] 페이지의 누적 CLS가 0.05 미만', async ({ page }) => {
  await page.goto('/parking/<seed-id>')
  const cls = await page.evaluate(() => new Promise(resolve => {
    let total = 0
    new PerformanceObserver(list => {
      for (const e of list.getEntries() as any[]) if (!e.hadRecentInput) total += e.value
    }).observe({ type: 'layout-shift', buffered: true })
    setTimeout(() => resolve(total), 5000)
  }))
  expect(cls).toBeLessThan(0.05)
})
```

### 4.6 출시 신호

| 시점 | 지표 | 임계 |
|---|---|---|
| 머지 직후 | PSI Lab CLS (`/`, `/parking`, `/parking/<id>`) | 시설 상세 < 0.05 |
| 24h | AdSense 페이지 RPM | -5% 이내 |
| 7일 | CrUX 필드 데이터 CLS p75 (시설 상세) | < 0.10 |
| 7일 | GSC 핵심 웹 지표 — CLS 양호 URL | 증가 추세 |

**Phase 2 GO 조건**: 7일 시점 시설 상세 CLS p75 < 0.10 + RPM 회귀 없음.

### 4.7 롤백

호출부 4곳에서 `sizing="fixed" ad-format="rectangle" :fixed-height="280"` prop 제거(또는 `git revert`). 부수효과 없음.

---

## 5. Phase 2 — SSR 워터폴

### 5.1 현 상태

세 페이지가 top-level `await useAsyncData()`를 다회 호출 → SSR 직렬:

| 파일 | fetch | 의존성 |
|---|---|---|
| `pages/[category]/[id].vue:350` | facility | critical, 404 gate |
| `pages/[category]/[id].vue:376` | youtube | SSR에서 JSON-LD VideoList 사용 (필수 SSR) |
| `pages/[category]/[id].vue:691` | sync-status | decorative (lastSyncDate 표시) |
| `pages/index.vue:291` | home-dashboard | critical, hero·JSON-LD ItemList |
| `pages/index.vue:340` | recent-guides | decorative (생활 가이드 섹션) |
| `pages/real-estate/.../[buildingName].vue:955` | ssrData | critical, 404 gate |
| `pages/real-estate/.../[buildingName].vue:743` | sync-status | decorative |

3-step / 2-step 직렬 각 100~150ms × 단계 → 누적 200~450ms.

### 5.2 변경 정책

**공통 패턴 (3 페이지 동일 적용):**
1. critical fetch는 그대로 단일 `useAsyncData`, 404 gate 유지
2. secondary fetch들은 단일 `useAsyncData` 안에서 `Promise.allSettled`로 묶음
3. 각 secondary 실패 시 해당 데이터만 null/빈배열, 페이지는 정상 렌더
4. 모든 secondary `$fetch`에 `signal: AbortSignal.timeout(8000)` 추가

새 composable 추상화는 만들지 않음. 각 페이지에 인라인 패턴.

### 5.3 `pages/[category]/[id].vue` 변경

```ts
// critical — 변경 없음 (404 gate)
const { data: facilityResponse, status, error: fetchError } = await useAsyncData(
  `facility-${cat}-${id}`,
  () => $fetch<...>(`/api/facilities/${cat}/${id}`),
  { lazy: true }
)
if (import.meta.server && fetchError.value) { /* 404 gate 그대로 */ }

// secondary — youtube + sync-status 병렬
const { data: secondaryResponse } = await useAsyncData(
  `facility-secondary-${cat}-${id}`,
  async () => {
    const apiBase = useApiBase()
    const signal = AbortSignal.timeout(8000)
    const [youtubeR, syncR] = await Promise.allSettled([
      $fetch<...>(`${apiBase}/api/facilities/${cat}/${id}/youtube?ssr=1`, { signal }),
      $fetch<...>(`${apiBase}/api/meta/sync-status`, { signal }),
    ])
    return {
      youtube: youtubeR.status === 'fulfilled' ? youtubeR.value.data : null,
      syncStatus: syncR.status === 'fulfilled' ? syncR.value.data : null,
    }
  },
  { lazy: true, default: () => ({ youtube: null, syncStatus: null }) }
)

const ssrVideos = computed(() => secondaryResponse.value?.youtube?.videos ?? [])
const lastSyncDate = computed(() => {
  if (!facility.value) return null
  return formatKstDate(secondaryResponse.value?.syncStatus?.[facility.value.category] ?? null)
})
```

기존 `youtubeSsrResponse`, `syncStatusResponse` ref 및 그 사용처(`setVideoListSchema(...)`, `lastSyncDate` computed)는 secondaryResponse 기반으로 교체.

### 5.4 `pages/index.vue` 변경

home-dashboard와 recent-guides는 의존성 없음 → 완전 병렬.

```ts
const apiBase = useApiBase()
const { data: pageData } = await useAsyncData(
  'home-page',
  async () => {
    const signal = AbortSignal.timeout(8000)
    const [dashR, guidesR] = await Promise.allSettled([
      $fetch<...>(`${apiBase}/api/meta/home-dashboard`, { signal }),
      $fetch<...>(`${apiBase}/api/guides/recent`, { query: { limit: 4 }, signal }),
    ])
    return {
      dashboard: dashR.status === 'fulfilled' ? dashR.value.data : null,
      recentGuides: guidesR.status === 'fulfilled' ? guidesR.value.data : [],
    }
  },
  { default: () => ({ dashboard: null, recentGuides: [] }) }
)

// 빈 hero 색인 차단
if (import.meta.server && !pageData.value?.dashboard) {
  throw createError({ statusCode: 503, statusMessage: 'Home data temporarily unavailable' })
}

const dashboard = computed(() => pageData.value?.dashboard ?? null)
const recentGuides = computed(() => pageData.value?.recentGuides ?? [])
```

`useHomeDashboard()` composable은 본 페이지에선 호출 안 함. 다른 곳에서 사용하면 유지.

### 5.5 `pages/real-estate/.../[buildingName].vue` 변경

```ts
// critical — 변경 없음
const { data: ssrData, error: ssrError } = await useAsyncData('ssrData', ...)
if (ssrError.value) { /* 404 gate 그대로 */ }

// secondary — 현재는 sync-status 단일이지만 패턴 일관성·확장성 위해 동일 형태
const { data: secondaryResponse } = await useAsyncData(
  'real-estate-secondary',
  async () => {
    const apiBase = useApiBase()
    const signal = AbortSignal.timeout(8000)
    const [syncR] = await Promise.allSettled([
      $fetch<...>(`${apiBase}/api/meta/sync-status`, { signal }),
    ])
    return { syncStatus: syncR.status === 'fulfilled' ? syncR.value.data : null }
  },
  { default: () => ({ syncStatus: null }) }
)
```

**URL·라우트·사이트맵 변경 없음.** 파일 내부 fetch 로직만 수정.

### 5.6 에러 모델

| 케이스 | 동작 |
|---|---|
| critical 200 | 정상 렌더 |
| critical 404/422 | `createError(404)` (기존 그대로) |
| critical 5xx | `createError(503)` (index.vue 신규) |
| secondary 1개 실패 | 해당 데이터만 null/빈배열, 페이지 정상 |
| secondary 전체 실패 | 페이지 정상, 부가 섹션 미표시 |
| secondary 8s timeout | AbortSignal로 자동 reject → null fallback |

### 5.7 회귀 위험과 방어

| 위험 | 가능성 | 방어 |
|---|---|---|
| `useAsyncData` key 변경으로 hydration 데이터 매핑 깨짐 | 中 | 새 key는 신규, 기존 key는 깨끗하게 제거 |
| `Promise.allSettled` fulfilled value 구조 오해 | 中 | TypeScript strict + Playwright 시나리오 |
| 503 응답으로 봇 retry 폭주 | 低 | 503은 정상 retry 신호, 백엔드 회복 시 즉시 정상화 |
| 8s timeout이 정상 응답까지 자름 | 低 | 백엔드 p99 < 1s, 8s는 충분한 여유 |

### 5.8 테스트

**Playwright E2E 3건** (`frontend/tests/e2e/ssr-resilience.spec.ts` 신규):
```ts
test('youtube API 실패해도 시설 상세 페이지가 정상 렌더된다', async ({ page, context }) => {
  await context.route('**/api/facilities/*/*/youtube*', route => route.abort())
  const res = await page.goto('/parking/<seed-id>')
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('sync-status API 실패해도 시설 상세 페이지가 정상 렌더된다', async ({ page, context }) => {
  await context.route('**/api/meta/sync-status', route => route.abort())
  const res = await page.goto('/parking/<seed-id>')
  expect(res?.status()).toBe(200)
})

test('home-dashboard API 실패 시 503 응답', async ({ page, context }) => {
  await context.route('**/api/meta/home-dashboard', route => route.abort())
  const res = await page.goto('/')
  expect(res?.status()).toBe(503)
})
```

기존 Vitest에서 `useAsyncData` mock이 호출 횟수에 의존하면 해당 setup 업데이트.

### 5.9 출시 신호

| 시점 | 지표 | 임계 |
|---|---|---|
| 머지 직후 | SSR 응답시간 (PM2/backend access log) | p50 -100~200ms |
| 24h | PSI Lab LCP (홈, 시설 상세, 부동산 상세) | 각 -50ms 이상 |
| 5일 | CrUX 필드 LCP p75 | "Good" URL 비율 증가 |
| 5일 | GSC 핵심 웹 지표 LCP | 양호 URL 수 증가 |
| 5일 | 홈 페이지 503 응답률 | < 0.1% |

**Phase 3 GO 조건**: 5일 시점 LCP 회귀 없음 + 503 비율 정상.

### 5.10 롤백

`git revert <phase-2-merge>`. 각 페이지의 `useAsyncData` 분리·인라인 패턴이라 revert 한 번으로 완전 환원.

---

## 6. Phase 3 — 동기화 N+1

### 6.1 현 상태

5개 facility sync(toilet/childcare/market/sports/ev-charger)가 batch 콜백 안에서 건당 2 쿼리:

```ts
async (item) => {
  const existing = await prisma.<model>.findUnique({ where: { sourceId } })   // 1
  await prisma.<model>.upsert({ where, update, create })                       // 2
  return existing ? 'updated' : 'new'
}
```

| sync | 건수 | 현 쿼리 | 변경 후 |
|---|---:|---:|---:|
| ev-charger | ~490k | ~980k | ~9.8k |
| toilet | ~3k | ~6k | ~60 |
| childcare | ~1k | ~2k | ~20 |
| market | ~1k | ~2k | ~20 |
| sports | ~0.8k | ~1.6k | ~16 |
| **합계** | ~496k | **~991k** | **~9.9k** |

`batchUpsertRaw`(`baseSyncService.ts:190`)는 이미 구현되어 부동산 sync에서 사용 중. facility sync로 확대 적용.

### 6.2 변경

**1) `batchUpsertRaw`에 `exactStats` 옵션 추가**

기존 ROW_COUNT 휴리스틱은 "동일 값 재입력" 케이스에서 newCount를 잘못 잡음(SyncHistory 정확성 저하). 정확 모드 추가:

```ts
export interface BatchUpsertRawOptions {
  /** 통계 정확 집계 (배치당 1 SELECT 추가). 기본 false */
  exactStats?: boolean;
  /** 정확 통계 시 unique key. 기본 'sourceId' */
  uniqueKey?: string;
}

export async function batchUpsertRaw<T extends Record<string, unknown>>(
  tableName: string,
  items: T[],
  batchSize: number = SYNC.BATCH_SIZE,
  syncHistoryId?: number,
  options: BatchUpsertRawOptions = {}
): Promise<{ newCount: number; updateCount: number }> {
  const { exactStats = false, uniqueKey = 'sourceId' } = options;

  for (배치마다) {
    let preExistingKeys: Set<unknown> | null = null;
    if (exactStats) {
      const keys = batch.map(item => item[uniqueKey]);
      const rows = await prisma.$queryRawUnsafe<...>(
        `SELECT \`${uniqueKey}\` FROM \`${tableName}\` WHERE \`${uniqueKey}\` IN (...)`,
        ...keys
      );
      preExistingKeys = new Set(rows.map(r => r[uniqueKey]));
    }

    // ... 기존 INSERT ... ON DUPLICATE KEY UPDATE ...

    let newInBatch, updatedInBatch;
    if (preExistingKeys) {
      updatedInBatch = batch.filter(item => preExistingKeys!.has(item[uniqueKey])).length;
      newInBatch = batch.length - updatedInBatch;
    } else {
      updatedInBatch = Math.max(0, affectedRows - batch.length);
      newInBatch = batch.length - updatedInBatch;
    }
  }
}
```

비용: 배치당 1 SELECT (인덱스 사용, IN clause). 100건 배치 <5ms. ev-charger 4,900배치 × 5ms = 25초 — 전체 sync 시간 대비 무시 가능.

기존 호출자(부동산 sync)는 옵션 미지정 → 동작 변경 없음.

**2) 5개 facility sync 서비스 리팩터**

대표 예시 (toiletSyncService.ts):

```ts
// 변환 단계
const rowsForUpsert = uniqueToilets.map(t => ({
  id: `toilet-${t.sourceId}`,
  name: t.name,
  // ... 30+ 필드 ...
  sourceId: t.sourceId,
  dataDate: t.dataDate,
  createdAt: new Date(),   // SKIP_UPDATE_COLS로 update 시 보호됨
  updatedAt: new Date(),
  syncedAt: new Date(),
}));

// 업서트 단계
const { newCount, updateCount } = await batchUpsertRaw(
  'Toilet',                  // Prisma 모델명 = MySQL 테이블명
  rowsForUpsert,
  100,
  syncHistory.id,
  { exactStats: true, uniqueKey: 'sourceId' }
);
```

### 6.3 5개 서비스 적용 체크리스트

| 서비스 | 모델명 | uniqueKey | 비고 |
|---|---|---|---|
| toiletSyncService | `Toilet` | `sourceId` | 표준 |
| childcareSyncService | `Childcare` | `sourceId` | 표준 |
| marketSyncService | `Market` | `sourceId` | 표준 |
| sportsSyncService | `Sports` | `sourceId` | 표준 |
| evChargerSyncService | `EvCharger` | `sourceId` | sourceId 값이 이미 `statId-chgerId` 합성 (schema.prisma `@unique`). 다른 모델과 동일 패턴 |

### 6.4 회귀 위험과 방어

| 위험 | 가능성 | 방어 |
|---|---|---|
| 모델별 컬럼 schema.prisma 불일치 → INSERT 실패 | 中 | 변환 결과 첫 1건을 dev에서 dry-run으로 검증 |
| ev-charger sourceId 합성 변환 누락 | 低 | 기존 `transformEvChargerRow`가 이미 `statId-chgerId`로 sourceId 합성 (확인 완료). 변환 변경 불필요 |
| timestamp 컬럼 NOT NULL 위반 | 中 | 변환에서 명시적 `new Date()` 주입 |
| BigInt/Decimal 컬럼 type 오류 | 低 | facility 모델은 BigInt/Decimal 거의 없음. 부동산 sync는 이미 검증됨 |
| 단일 PR에 5개 sync 변경 → 비대 | 中 | commit 분리, ev-charger를 마지막 commit |

### 6.5 PR 안 commit 분해

1. `batchUpsertRaw`에 `exactStats` 옵션 + 테스트 추가
2. toiletSyncService 리팩터 + 테스트 갱신
3. childcareSyncService 리팩터
4. marketSyncService 리팩터
5. sportsSyncService 리팩터
6. evChargerSyncService 리팩터

회귀 발생 시 `git bisect`로 즉시 원인 commit 식별.

### 6.6 테스트

**Vitest 신규** (`backend/__tests__/services/baseSyncService.batchUpsertRaw.exactStats.test.ts`):
```ts
describe('batchUpsertRaw with exactStats', () => {
  it('정확 통계 모드는 사전 SELECT로 new/updated를 구분한다', async () => {
    await prisma.toilet.create({ data: { id: 't-1', sourceId: 'TEST-1', name: '기존', /* ... */ } });
    const rows = [
      { id: 't-1', sourceId: 'TEST-1', name: '수정', /* ... */ },
      { id: 't-2', sourceId: 'TEST-2', name: '신규', /* ... */ },
    ];
    const { newCount, updateCount } = await batchUpsertRaw(
      'Toilet', rows, 100, undefined, { exactStats: true, uniqueKey: 'sourceId' }
    );
    expect(newCount).toBe(1);
    expect(updateCount).toBe(1);
  });

  it('동일 값 재입력도 updated로 정확히 집계', async () => {
    await prisma.toilet.create({ data: { id: 't-1', sourceId: 'TEST-1', name: '동일', /* ... */ } });
    const rows = [{ id: 't-1', sourceId: 'TEST-1', name: '동일', /* ... */ }];
    const { newCount, updateCount } = await batchUpsertRaw(
      'Toilet', rows, 100, undefined, { exactStats: true, uniqueKey: 'sourceId' }
    );
    expect(newCount).toBe(0);
    expect(updateCount).toBe(1);
  });
});
```

각 sync 서비스의 기존 Vitest mock이 `prisma.<model>.upsert`에 의존하면 mock 갱신.

### 6.7 출시 신호

| 시점 | 지표 | 임계 |
|---|---|---|
| 머지 직후 | `npx tsx src/scripts/syncToilet.ts` wall-time | 이전 대비 10× 단축 |
| ev-charger 1회 수동 실행 | wall-time, MySQL CPU 피크 | 수십분→수분, CPU 피크 50% 미만 |
| 1주 자동 sync 후 | SyncHistory `newRecords + updatedRecords + skippedRecords = totalRecords` | 정확 일치 |
| 1주 후 | MySQL slow query log | 100ms 초과 쿼리 감소 |

### 6.8 롤백

`git revert <phase-3-merge>`. 다음 sync 사이클부터 원래 코드. **이미 DB에 들어간 데이터는 보존됨** (upsert는 멱등). 데이터 정합성 깨짐 케이스는 별도 검증 필요 — 그래서 commit 분리가 중요.

---

## 7. 횡단 관심사

### 7.1 테스트 전략 요약

| 레벨 | Phase 1 | Phase 2 | Phase 3 |
|---|---|---|---|
| Unit (Vitest) | AdBanner sizing prop | — | batchUpsertRaw exactStats |
| Integration | — | — | 쿼리 카운트 단언 (옵션) |
| E2E (Playwright) | CLS < 0.05 | secondary abort 3건 | — |
| 회귀 | AdBanner 기존 테스트 | useAsyncData mock 갱신 | sync mock 갱신 |
| 수동 | PSI Lab | PSI Lab + GSC | sync wall-time |

총 신규 테스트 코드 약 250줄.

CI 게이트 (각 PR):
```bash
cd backend && npm run lint && npm run test
cd frontend && npm run lint && npm run test
cd frontend && npm run test:e2e -- <new-specs>  # Phase 1·2만
```

### 7.2 측정 인프라

새 도구 도입 없음. 기존 신호로 충분:
- PageSpeed Insights (lab CLS/LCP)
- Google Search Console 핵심 웹 지표 (필드 데이터, 7일 지연)
- AdSense 대시보드 (RPM/CTR)
- PM2 / 서버 access log (SSR 응답시간)
- `SyncHistory` 테이블 (sync 통계)
- MySQL slow query log / `top` (DB CPU)

### 7.3 롤백 플레이북

| Phase | 롤백 트리거 | 액션 |
|---|---|---|
| 1 | AdSense RPM 7일 -10% 이상, CLS 측정값 예상과 반대 | `git revert <merge>` 또는 호출부 4곳 prop 제거 |
| 2 | 503 비율 0.5% 초과(백엔드 정상인데), SSR 응답시간 회귀 | `git revert <merge>` — 3 페이지 직렬 형태 복구 |
| 3 | sync 데이터 정합성 깨짐, MySQL 에러 | sync 중단 + `git revert <merge>`. 다음 사이클부터 원복 |

각 Phase 단일 PR → 단일 revert로 완전 복구.

### 7.4 진행 순서

```
Phase 1 (CLS) ──┐
                ├── 서로 독립
Phase 2 (SSR) ──┘
                
Phase 3 (N+1) ── 1·2와 완전 독립 (backend-only)
```

권장: 1 → 2 → 3 (사용자 영향 가시화 순). 강제 아님.

---

## 8. 출시 / 측정 게이트 종합

```
[Phase 1 머지]
  ├ 머지 직후: PSI Lab CLS 측정
  ├ 24h: AdSense RPM 점검 (-5% 이내)
  └ 7일: CrUX p75 CLS < 0.10 → [Phase 2 GO]

[Phase 2 머지]
  ├ 머지 직후: SSR 응답시간 p50 -100ms
  ├ 24h: PSI Lab LCP 각 페이지 -50ms
  └ 5일: CrUX p75 LCP "Good" 비율 증가 + 503 < 0.1% → [Phase 3 GO]

[Phase 3 머지]
  ├ 머지 직후: toilet sync wall-time 10× 단축
  ├ ev-charger 수동: wall-time 분단위, CPU < 50%
  └ 1주: SyncHistory 통계 정확 일치
```

게이트 미달 시 다음 Phase 보류 + 원인 진단.

---

## 9. 위험·완화 종합

| 영역 | 가장 큰 위험 | 1차 방어 | 2차 방어 |
|---|---|---|---|
| Phase 1 | AdSense RPM 하락 | dev test mode로 동작 검증 | 7일 추적 + 호출부 prop 제거로 즉시 롤백 |
| Phase 2 | 503 응답으로 봇 retry 폭주 | AbortSignal.timeout 8s | `git revert` 후 즉시 배포 |
| Phase 3 | 모델별 컬럼 schema.prisma 불일치 | 변환 결과 dev 1건 dry-run | commit 분리 + git bisect |

공통: 각 Phase 단일 PR → 단일 revert.

---

## 10. Out-of-scope 종합

- 광고 슬롯 수·위치·종류 변경
- `index.vue` 광고 슬롯 fixed 전환 (Phase 1 측정 후 후속)
- 부동산 URL·라우트·사이트맵·메타·JSON-LD 변경
- 새 composable/component/abstraction 도입
- 새 인프라/APM/Sentry/모니터링 도구
- 다른 sync 서비스 (real-estate 외)
- 좀비 인시던트 5번째 대응 (`statement_timeout` 강제) — 별 spec
- 동기화 체크포인트/dead-letter queue — 별 spec
- `useHead` TDZ ESLint 룰 — 별 spec (재발방지 묶음)
- sitemap cold-start warmup 보강 — 별 spec
- `useApiBase` ESLint 룰 — 별 spec
- 대형 파일 분해 (`csvParser.ts`, real-estate building detail .vue) — 별 spec

---

## 11. 후속 / 별 spec 목록

본 spec 머지 후 검토할 항목:

1. **재발 방지 묶음** (`useHead` TDZ + `useApiBase` ESLint + sitemap cold-start) — P1 분류, 1주 작업
2. **좀비 인시던트 5번째 대응** (`statement_timeout` DATABASE_URL 검증) — 30분 작업
3. **동기화 체크포인트 + dead-letter queue** — 1주 작업, Phase 3 안정화 후
4. **CSV parser 모듈 분해** — 1일 작업, 신 카테고리 추가 용이성
5. **sync script base 추출** (`main().catch()` 보일러플레이트 통합) — 1일 작업
6. **시설 상세 페이지 컴포넌트 테스트** — 1일 작업, 리팩터 안전망
7. **3-병렬 워터폴** (Phase 2 후속, facility까지 병렬화) — Phase 2 측정 후 결정
8. **index.vue 광고 fixed 전환** — Phase 1 측정 후 결정
