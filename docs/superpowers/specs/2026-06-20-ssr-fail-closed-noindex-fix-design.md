# SSR fail-closed noindex 회귀 수정 설계

- **작성일**: 2026-06-20
- **상태**: 설계 (구현 전)
- **관련**: 네이버 서치어드바이저 "meta robots로 색인에서 제외된 페이지" 6/18~6/19 급증 (~+5,800), `.omc/notes/noindex-canonical-policy.md`, `docs/superpowers/specs/2026-05-21-internal-api-base-ssr-resilience-design.md`

---

## 1. 문제 (Problem)

네이버 서치어드바이저에서 "meta robots로 색인 제외" 페이지 수가 **6/18 22:00 ~ 6/19 03:00** 사이 약 **+5,800** 급증했다. 진단 결과:

- 제외 URL의 **99.7%가 부동산 상세페이지**(apt-sale·villa-rent·apt-rent 등). 건물명은 전부 정상 단지명(`에이스아크로빌3차`, `동래래미안아이파크`, `e편한세상신촌4단지` …)으로 지번 패턴이 아니다.
- 네이버 URL 검사: **응답 OK(200) · 수집 완료 · 색인 허용 "아니오"** → 페이지가 200을 주면서 HTML 안에 `noindex`를 담아 보냈다.
- 현재(낮) 동일 URL 60개 무작위 샘플 → **전부 `index, follow`** 로 복구. 즉 영구 정책 noindex가 아니라 **그 시간대에만 발생한 일시 오탐**.
- noindex 판정 코드는 4월 이후 무변경.

### 1.1 근본 원인 (Root Cause)

부동산 상세페이지의 noindex는 두 갈래로 발화한다(`frontend/utils/realEstateNoindex.ts:22-27`):
1. 건물명이 지번 패턴(`INVALID_BUILDING_NAME`) → noindex (정상 정책)
2. `loaded && !hasBuildingInfo` → "없는 건물"로 간주 → noindex

정상 단지명이므로 (1)은 아니다. **(2)가 SSR fetch 실패로 잘못 발화**했다. 핵심은 `frontend/composables/useRealEstate.ts:95-110`:

```ts
async function getBuildingInfo(type, bjdCode, buildingName): Promise<BuildingInfo | null> {
  const query = new URLSearchParams({ bjdCode, buildingName })
  try {
    const res = await $fetch<{ success: boolean; data: BuildingInfo }>(
      `${apiBase}/api/real-estate/${type}/building-info?${query.toString()}`)
    return res.data
  } catch {
    return null   // ← 404든 500이든 timeout이든 전부 null로 뭉갬
  }
}
```

- 백엔드는 **진짜 없는 건물 → 404**(`backend/src/routes/realEstate.ts:146-150` `NotFoundError`), **DB/내부 장애 → 500**(`backend/src/app.ts` fallthrough)으로 명확히 구분한다.
- `$fetch`(ofetch)는 비-2xx에 `FetchError`를 throw하며 `.status`/`.statusCode`를 들고 온다. GET은 5xx면 자동 1회 재시도까지 한다(404는 안 함).
- 그런데 위 `catch { return null }`이 이 status 신호를 **파괴**한다. 그 결과 SSR 호출부(`[buildingName].vue:980-992`)의 `Promise.allSettled`는 항상 `fulfilled(null)` — **일시 장애와 "없는 건물"을 영영 구분 못 함** → 무조건 `noindex`.

그리고 페이지는 데이터 부재 시 404/5xx를 던지지 않으므로(`[buildingName].vue`의 404는 459/471/477번 라인의 **URL 파라미터 검증** 전용), **HTTP 200 + `noindex`** 가 그대로 나간다. 네이버 검사 결과(200 OK + 색인허용 아니오)와 정확히 일치한다.

### 1.2 트리거 (별도 — 본 수정과 독립) — 서버 SSH 읽기전용 확인 (2026-06-20)

직접 원인은 **백엔드 Prisma 커넥션 풀 고갈 + 일시 DB 접속 실패**로 확인됐다. (읽기전용 확인, 서버 파일/프로세스 무수정.)

- **백엔드 PM2 로그** (`ilsangkit-backend-error.log`, +out.log 합산):
  - `Timed out fetching a new connection from the connection pool` (**P2024 풀 고갈**) = **117,942건 (out.log 합산 264,058)** — 압도적 주범, 만성.
  - `Can't reach database server at localhost:3306` (**P1001**) = **3,691건 (합산 4,823)** — 배포/재시작 순간 DB 불통.
- **프론트 PM2 로그** (`ilsangkit-frontend-error.log`): SSR 내부 API **fetch timeout = 390,820건**. 대표 URL `127.0.0.1:8000/api/meta/home-dashboard`, `/api/meta/sync-status`, `/api/sitemap/page-counts`. → **SSR→백엔드 경로가 대량으로 timeout**임을 직접 입증.
- **크롤은 24시간 균일** (nginx, Yeti+Googlebot+bingbot 합산 ~1,300–1,900/시). "새벽에만 온다"가 아니라 **상시 크롤이 장애 순간에 걸린 URL을 `200+noindex`로 저장**. nginx 공개응답은 대부분 200(프론트가 백엔드 에러를 삼킴 — §1.1 구조 입증).
- **MySQL**: `max_connections=151`, `wait_timeout=120`, **`slow_query_log` OFF**(어떤 쿼리가 풀을 오래 잡았는지 직접 확인 불가). error log에 재시작 흔적 `2026-06-19T18:53Z`(KST 06-20 03:53).

**보정해야 할 추론 (정직하게 명시):**
1. **`building-info` 특정 API 실패는 로그에 0건** — `getBuildingInfo`의 `catch{return null}`가 삼켜서 안 남는 것. "실패 안 함"이 아니라 **코드상 필연 추론**. 단 같은 SSR→백엔드 경로의 timeout 390,820건이 토대를 뒷받침.
2. **6/18 저녁 배포로의 정확한 시각 귀속은 미확정** — PM2 로그에 라인별 timestamp가 없어 GitHub Actions/deploy 로그를 병행해야 고정 가능. (배포 KILL/reload가 `Can't reach database`의 유력 출처라는 정황은 유지.)
3. **풀 크기는 이미 상향됨** — 현재 `.env` `connection_limit=30, pool_timeout=200`. 과거 로그엔 13/10→15/5→25/15→30/20 흔적. "풀이 작았다"는 **과거 기준 사실**, 현재는 이미 30. → §7 처방이 "풀 키우기"에서 **`pool_timeout` 정상화 + 슬로우 쿼리 제거**로 이동.

> **본 수정의 핵심 전제**: 트리거가 무엇이든(배포·크롤버스트·sync·일시 DB락), **SSR이 일시 장애를 영구 `noindex` 신호로 굳히면 안 된다.** 트리거 제거(Approach B)는 로그 확정 후 별도 phase로 다룬다.

---

## 2. 목표 / 비목표

### 목표
1. **일시 SSR 장애 시 절대 `noindex`를 내보내지 않는다** (fail-open). `noindex`는 *적극적 증거*(지번 패턴, 또는 백엔드 404 확정)에만.
2. 일시 장애 시 **soft 503 + `cache-control: no-store`** 로 응답해 크롤러가 기존 색인을 유지하고 재방문하게 한다. 실제 사용자는 본문 렌더 + 클라이언트 refetch로 정상 표시.
3. 같은 fail-closed 안티패턴을 가진 **4개 페이지 일괄 수정**(공유 헬퍼).
4. 이미 오탐 noindex로 찍힌 ~5,800 URL **회복 조치**(캐시 퍼지 + 사이트맵 재제출 + 수집요청).

### 비목표
- 백엔드/DB 부하 원인 제거(Approach B) — 본 PR 범위 밖. 로그 확정 후 별도(§7).
- 무중단 배포(pm2 cluster) 전환 — Approach B 후보, 본 PR 밖.
- 지번 패턴 noindex 정책 변경 — 그대로 유지(적극적 증거이므로 옳음).

---

## 3. 영향 범위 (Blast Radius)

워크플로우 조사 결과, **일시 SSR 실패 → fail-closed noindex** 패턴을 가진 페이지:

| # | 페이지 | 현재 동작 | 판정 |
|---|---|---|---|
| 1 | 부동산 건물 상세 `[realEstateType]/[city]/[district]/[buildingName].vue` | `getBuildingInfo` catch→null → `!hasBuildingInfo` → noindex | **수정** |
| 2 | 지역 허브 `/[city]/index.vue` | `.catch(()=>null)`(:140) → `isNoindex = cityData===null`(:201) | **수정** |
| 3 | 지역 허브 `/[city]/[district]/index.vue` | `.catch(()=>null)`(:114) → `isNoindex = areaData===null`(:191) | **수정** |
| 4 | 부동산 지역목록 `[realEstateType]/[city]/[district]/index.vue` | `useAsyncData(getComplexList)` throw → data null → `total===0`(:307) → noindex | **수정** |

**안전(변경 불필요):**
- 시설 상세 `[id].vue`, 공매 물건/지역, 토지 동(`[dong].vue`), 공공임대 → 실패 시 **404 throw**(fail-closed지만 noindex가 아니라 404라 색인 삭제 신호 아님; 일시 404는 크롤러가 재시도).
- 지역 `[category]` → `computeAreaNoindex`가 `summaryCount === undefined`면 indexable(**이미 fail-open**, `areaNoindex.ts:14,19`).

---

## 4. 설계 (Approach A — fail-open + soft 503)

### 4.1 공유 유틸 `frontend/utils/ssrIndexability.ts` (신규, 순수·테스트 가능)

```ts
export interface SsrIndexabilityInput {
  /** 적극적 증거로 색인 부적합이 "확정"됐는가 (지번 패턴 등). true면 무조건 noindex. */
  positiveNoindex?: boolean
  /** SSR fetch가 일시 실패(reject/5xx/timeout/network)했는가. true면 절대 noindex 안 함. */
  fetchFailed: boolean
  /** fetch 성공 + 엔티티가 진짜 비어있음(백엔드 404/빈 결과 확정). */
  confirmedEmpty: boolean
}

/** noindex를 내보낼지 결정. 일시 실패(fetchFailed)면 항상 fail-open(false). */
export function shouldNoindexSsr(input: SsrIndexabilityInput): boolean {
  if (input.positiveNoindex) return true   // 지번 등 확정 증거
  if (input.fetchFailed) return false       // 일시 장애 → 절대 deindex 안 함
  return input.confirmedEmpty               // 진짜 없음 → 기존 정책대로 noindex
}
```

### 4.2 degraded 응답 마킹 (공유)

기존 코드 패턴(`real-estate/land/[city]/index.vue:126-131`, 홈 `index.vue:330-332`)에 맞춰, **서버에서만** soft 503 + no-store를 설정한다. throw 대신 `setResponseStatus`를 써서 `[buildingName].vue:519`의 fragile unmount/error.vue 경로를 건드리지 않는다.

```ts
// composables/useDegradedResponse.ts (신규) 또는 각 페이지 인라인
export function markDegradedResponse(statusCode = 503) {
  if (!import.meta.server) return
  const event = useRequestEvent()
  if (!event) return
  setResponseStatus(event, statusCode)
  setResponseHeader(event, 'cache-control', 'no-store')  // SWR 캐시 우회 필수
}
```

> **왜 no-store가 필수인가**: `nuxt.config.ts`의 routeRules에서 `/real-estate/** : swr 300`, 도시 허브 `/seoul/** 등 : swr 1800`. no-store 없이 503을 내보내면 Nitro가 degraded 응답을 5~30분 캐시해 모든 방문자(+크롤러)에게 서빙할 위험이 있다. 정상 200 응답은 그대로 swr 캐시를 유지한다(성능 회귀 없음).

### 4.3 `frontend/composables/useRealEstate.ts` — `getBuildingInfo` 수정

```ts
} catch (err) {
  const status = (err as { statusCode?: number; status?: number })?.statusCode
             ?? (err as { status?: number })?.status
  if (status === 404) return null   // 진짜 없는 건물 → 정상 null
  throw err                          // 5xx/timeout/network/undefined → 일시 장애로 전파
}
```

- `status === undefined`(연결 거부·완전 다운 등 응답 없는 경우)는 throw로 떨어져 **일시 장애로 취급**(올바름).
- 400/422(검증 오류)도 이론상 throw되지만, 이 라우트는 정상 호출 시 404/200/5xx만 나므로 실무상 무관(필요 시 `status < 500 && status !== 404 ? return null` 추가 검토 — 구현 단계 결정).

### 4.4 `frontend/utils/realEstateNoindex.ts` — `fetchFailed` 반영

```ts
export interface RealEstateNoindexInput {
  buildingName: string
  loaded: boolean
  hasBuildingInfo: boolean
  fetchFailed: boolean   // 신규
}

export function shouldNoindexRealEstateDetail(input: RealEstateNoindexInput): boolean {
  return shouldNoindexSsr({
    positiveNoindex: INVALID_BUILDING_NAME.test(input.buildingName),
    fetchFailed: input.fetchFailed,
    confirmedEmpty: input.loaded && !input.hasBuildingInfo,
  })
}
```

수정 후 `noindex`가 발화하는 경우는 **(a) 지번 패턴**, **(b) 백엔드가 404로 확정한 없는 건물** 뿐. 일시 장애는 절대 noindex 안 됨.

### 4.5 `[buildingName].vue` SSR 로더 — `fetchFailed` 추적

`useAsyncData` 로더(`975-1024`)에서 building-info 경로의 **일시 장애**를 `infoFetchFailed: boolean`으로 모아 반환한다. 신호 출처는 두 곳이며 규칙은 하나다 — **"transient는 전파, not-found(404)만 삼킨다"**:

1. **allSettled의 `infoResult`** (`992`): 4.3 적용 후 `getBuildingInfo`는 404→`fulfilled(null)`, transient→`rejected`. 따라서 `infoResult.status === 'rejected'` === 일시 장애.
2. **`resolveBuildingContext`** (`943-971`)의 primed-building 경로: 현재 두 `try/catch`(getComplexList `951-959`, fallback getBuildingInfo `961-968`)가 **모든** 에러를 삼킨다. 4.3 적용 후엔 **404/not-found만 삼키고 transient는 rethrow**하도록 바꾼다. loader가 `resolveBuildingContext()`를 `try/catch`로 감싸 transient를 잡으면 `infoFetchFailed=true` + 빈 컨텍스트(`bjdCode:''`)로 계속 렌더.

```ts
// loader 내부
let infoFetchFailed = false
let ctx
try { ctx = await resolveBuildingContext() }
catch { infoFetchFailed = true; ctx = { bjdCode: '', building: null } }
// ... allSettled ...
if (infoResult.status === 'rejected') infoFetchFailed = true
return { ...기존, infoFetchFailed }
```

watch(`1027-1043`)에서 `buildingInfo.value`, `statsLoading/txLoading=false`와 함께 `fetchFailed.value = data.infoFetchFailed` 세팅. noindex computed(`524-530`)는 `fetchFailed`를 인자로 전달. 서버에서 `fetchFailed`면 `markDegradedResponse()` 호출. 클라이언트 refetch(`1039-1048`)는 그대로 유지(실사용자 자동 치유).

> `noindex`가 false가 되면 기존 코드가 canonical을 자동 복원한다(`617-625`, noindex-canonical-policy 일관). 별도 처리 불필요.

### 4.6 지역 허브 2종 (`/[city]/`, `/[city]/[district]/`)

`.catch(()=>null)` 인라인 제거 → `useAsyncData`의 `error`/`status`로 실패 판별.

```ts
const { data: response, error } = await useAsyncData(`city-area-${city.value}`,
  () => $fetch<any>(`/api/area/${encodeURIComponent(city.value)}`))   // .catch 제거

const fetchFailed = computed(() => !!error.value)
const cityData = computed(() => response.value?.data ?? null)
const isNoindex = computed(() => shouldNoindexSsr({
  fetchFailed: fetchFailed.value,
  confirmedEmpty: !fetchFailed.value && cityData.value === null,
}))
// 서버에서 fetchFailed면 markDegradedResponse()
```

(`/[city]/[district]/index.vue:114,191`도 동일 패턴 적용.)

### 4.7 부동산 지역목록 (`[realEstateType]/[city]/[district]/index.vue`)

`useAsyncData(getComplexList)`(`194`)의 `error`를 캡처. `error`면 일시 장애(503+fail-open), 아니면 `total===0`은 **진짜 빈 구역**이므로 thin-content noindex 유지(정당).

```ts
const { data: ssrData, error } = await useAsyncData(`re-region-...`, () => getComplexList(...))
const fetchFailed = computed(() => !!error.value)
// watch(:304): const isNoindex = shouldNoindexSsr({
//   fetchFailed: fetchFailed.value,
//   confirmedEmpty: !fetchFailed.value && totalComplexes.value === 0,
// })
// 서버 fetchFailed면 markDegradedResponse()
```

---

## 5. 테스트 전략

### 단위 (vitest)
- `ssrIndexability.shouldNoindexSsr` 진리표: `positiveNoindex:true`→**true**(fetchFailed·confirmedEmpty 무관, 적극 증거 우선); `fetchFailed:true` & `positiveNoindex:false`→**false**(회귀 핵심); `confirmedEmpty:true` & 나머지 false→**true**; 전부 false→**false**.
- `realEstateNoindex.shouldNoindexRealEstateDetail`: 지번명→true; 정상명+fetchFailed→**false**(회귀 핵심); 정상명+loaded+!hasBuildingInfo+!fetchFailed→true; loaded=false→false.
- `useRealEstate.getBuildingInfo`: `$fetch` mock이 `FetchError(status 404)` throw→`null`; `status 500`/`undefined` throw→**rethrow**; 정상→data.

### 통합/컴포넌트
- `[buildingName].vue` SSR: building-info **500** → robots `index`(noindex 아님) + 응답 503 + `cache-control: no-store`; building-info **404** → `noindex,follow` + 200; **성공** → `index` + 200 + canonical 존재.
- 지역 허브/지역목록: fetch 실패 → noindex 미발화 + 503; 빈 구역(목록) → noindex 유지.

### 기존 테스트
- `feedback_test_verification`: 커밋 전 backend/frontend `vitest run` 전체 통과. 기존 noindex 관련 테스트(있으면) 시그니처 변경 반영.

---

## 6. 회복 조치 (이미 찍힌 ~5,800 URL)

순서:
1. **수정 배포**(develop→main 승격, PR 기반).
2. **샘플 검증**: 영향 URL 30~60개를 Yeti UA로 curl → `index, follow` + canonical(또는 데이터 cold 시 503) 확인. (운영 라이브 검증 — `feedback_verify_ground_truth`.)
3. **캐시 퍼지**: Nitro route cache(`.nuxt/cache/nitro/routes/...` / 서버 캐시) + nginx proxy_cache(`/var/cache/nginx/ilsangkit`) 퍼지 → stale `200+noindex` HTML 즉시 제거(`project_nitro_route_cache`, `project_home_autoads_hydration`의 퍼지 절차 참조).
4. **재제출**: GSC 사이트맵 재제출 + 네이버 서치어드바이저 사이트맵 재제출. 상위 가치 URL은 **URL 수집요청**(네이버) / URL 검사 색인요청(GSC)으로 직접 재크롤 유도.
5. **모니터링**: 네이버 일별 "meta robots 제외" 수 + 수집량, GSC 색인 커버리지를 **1~2주** 추적.

> 사이트맵 `lastmod`는 이미 `getWeekStartDate()`로 주간 자동 전진(`sitemap.ts:175`)하므로 수동 bump는 저가치(크롤 힌트일 뿐, 캐시된 200+noindex를 덮지 못함). 수정+캐시퍼지+재크롤이 본질적 회복 레버.

---

## 7. Approach B — 백엔드/배포 회복력 (로그 게이트, 후속)

본 PR(A)로 SEO 피해는 트리거와 무관하게 차단되지만, **백엔드 Prisma 커넥션 풀 고갈**(§1.2 확증, 본질 원인)은 반드시 별도로 고쳐야 한다. 운영 로그 빈도(2026-06-20):

```
117,942  "Timed out fetching a new connection"  → P2024 풀 고갈 (압도적 주범, 만성)
  3,691  "Can't reach database"                 → P1001 배포/재시작 순간 DB 불통
```

크롤은 24시간 균일(~900/시)이므로 "버스트 대응"이 아니라 **풀이 동시성을 못 받치는 만성 문제**다. 한 달간 색인제외 곡선(69k→80.5k)이 꾸준히 오른 것과 일치 — 만성 P2024가 부동산 페이지를 지속 오탐 noindex해 왔고 6/18 배포가 마지막 점프를 만듦.

**현재 설정 (SSH 확인):** `.env` `connection_limit=30, pool_timeout=200` · MySQL `max_connections=151, wait_timeout=120, slow_query_log OFF`. → 풀 크기는 이미 상향돼 있으므로 본질은 **"풀 점유시간"과 "실패시 매달림"**이다.

**B 처방 (우선순위순):**
1. **`pool_timeout` 정상화 (200s → ~10s 기본)**. 200초는 비정상적으로 길다 — 풀 고갈 시 백엔드 요청이 최대 200초 매달려 in-flight가 쌓이고 프론트 SSR timeout(390,820건)을 악화. 빨리 실패(P2024)시켜 처닝을 줄이는 게 더 건강(A가 그 실패를 fail-open으로 받으므로 SEO 피해 없음).
2. **풀(30)을 오래 점유하는 슬로우 쿼리 제거**. 프론트 timeout 대표 URL(`/api/meta/home-dashboard`, `/api/sitemap/page-counts`, `/api/meta/sync-status`)과 notepad zombie 이슈가 가리키는 곳: `refreshSummary` 장기 트랜잭션, 사이트맵 `page-counts`/`maxUpdatedAt` 집계, summary 집계, `$queryRaw` GROUP BY(ev-charger statId·부동산 groupBy). `MAX_EXECUTION_TIME`/statement timeout + 인덱스·쿼리 최적화.
3. **`slow_query_log` ON** (`long_query_time≈1`). 현재 OFF라 "어떤 쿼리가 풀을 잡는지" 직접 확인 불가 — 2번을 데이터로 좁히기 위한 선행.
4. **배포 커넥션 처닝 완화**. `deploy.yml`의 `prisma db push` 전 60초+ 쿼리 KILL + `pm2 reload`(fork 재시작)가 `Can't reach database`(3,691건)의 유력 출처. 무중단 reload(pm2 cluster rolling) 검토.
5. **`connection_limit=30` 유지**(추가 상향은 2번 해결 후 판단). `max_connections=151` 헤드룸은 sync 스크립트·studio 몫을 빼도 충분 — 풀 크기보다 **점유시간**이 병목.
6. **관측성**: **PM2 로그 timestamp 활성화**(`ecosystem.config.js` `time:true`)로 향후 장애 시각 귀속 가능하게. (이번 6/18 귀속이 PM2만으론 불가했던 이유.)

> B는 A와 독립적으로 진행 가능하나 **만성 SEO 손실의 본질**이므로 우선순위 높음. A(프론트 fail-open)는 이 모든 백엔드 장애를 SEO 관점에서 무해화하는 안전망이고, B는 장애 자체의 빈도/지속을 줄인다 — 둘 다 필요.

---

## 8. 롤아웃 & 리스크

- **PR 기반**(`feedback_pr_workflow`): develop 머지 → CI green → main 승격. main 직접 커밋 금지.
- **리스크 — soft 503 부작용**: 실사용자가 일시 장애 창에 들어오면 본문은 렌더되나 HTTP 상태가 503. 브라우저는 503 본문도 정상 렌더하고 클라이언트 refetch가 데이터를 채우므로 체감 영향 미미. 모니터링/분석이 503을 에러로 집계할 수 있음(허용 가능, 빈도 낮음).
- **리스크 — `error` 노출**: 지역 허브에서 `.catch` 제거 후 `useAsyncData` error가 Nuxt 전역 에러로 전파되지 않도록(렌더는 계속) `error` ref만 읽고 throw하지 않음.
- **리스크 — region 목록 빈 구역**: 진짜 0건 구역은 계속 noindex(의도). fetch 실패와 혼동하지 않도록 `error` 기준 분기 필수.
- **되돌리기**: 페이지별 변경이 독립적이라 부분 롤백 가능. 공유 헬퍼는 순수 함수라 위험 낮음.

---

## 9. 변경 파일 요약

**신규**: `frontend/utils/ssrIndexability.ts`, `frontend/composables/useDegradedResponse.ts`(또는 인라인), 각 단위 테스트.
**수정**:
- `frontend/composables/useRealEstate.ts` (getBuildingInfo)
- `frontend/utils/realEstateNoindex.ts` (fetchFailed 인자)
- `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (SSR 로더·noindex·degraded)
- `frontend/pages/[city]/index.vue`
- `frontend/pages/[city]/[district]/index.vue`
- `frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue`
**불변**: `frontend/utils/areaNoindex.ts`(이미 fail-open), `frontend/utils/realEstateBuildingName.ts`(지번 규칙 유지), 백엔드(이미 404/500 구분 — 변경 불필요).

---

## 10. 검증 / 성공 판정 (Verification & Success Criteria)

"정말 나아졌나"를 추측 아닌 **측정**으로 닫는다. 단, **"색인 제외 해제 ≠ 색인 등록 ≠ 검색 노출"** — 본 작업이 보장하는 것은 색인 **자격 회복**과 **출혈 정지**까지다.

### 배포 전 (CI/로컬)
- §5 단위·통합 테스트 전부 green. 특히 `정상명 + fetchFailed → noindex 미발화` 회귀 가드.

### 배포 직후 (라이브 — `feedback_verify_ground_truth`)
- 영향 URL 30~60개를 Yeti UA로 curl → **`index, follow` + canonical 존재**(또는 데이터 cold면 `503` + `cache-control: no-store`). **noindex 0건**.
- 가능하면 building-info 실패를 의도 재현(백엔드 일시 중단)해 `503 + index`(noindex 아님) 확인.
- Nitro/nginx 캐시 퍼지 후 스냅샷이 갱신됐는지 확인.

### 1~2주 모니터링
- **네이버 SC** "meta robots로 색인 제외" 일별 추이가 **하락/평탄화**로 전환(즉시 0 아님 — 재크롤 속도 의존).
- **백엔드 PM2** `Timed out fetching a new connection` 빈도 (B 적용 후) **급감**.
- GSC/네이버 색인 커버리지 추세.

### 성공 판정 (닫기 기준)
1. 샘플에서 **신규 noindex 오탐 = 0** (A 효과 확정).
2. "meta robots 제외" 곡선 **하락 전환** (회복 효과).
3. 풀 타임아웃 에러율 목표치 이하 (B 효과 — A와 별도 PR이면 그 배포 후).

> 2·3은 네이버 재크롤·크롤예산에 의존하므로 시간차 존재. 1은 배포 즉시 확인 가능한 1차 성공 신호.
