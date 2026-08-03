# Internal API Base + SSR Fetch Resilience 설계

작성일: 2026-05-21
대상: `frontend/composables/`, `frontend/server/`, `frontend/pages/real-estate/`, `frontend/nuxt.config.ts`, `ecosystem.config.js`

## 배경

Nuxt 3 frontend가 SSR 시 backend API를 호출할 때 `https://ilsangkit.co.kr/api/...` (자기 자신의 공개 도메인)으로 외부망 round-trip을 한다. 이 구조는 다음 회로를 만든다.

```
SSR fetch → nginx → Nitro server (자기 자신) → /api/** routeRule proxy → backend (localhost:8000)
```

이 외부망 자기-호출이 cold-start, rate-limit cascade, 일시 네트워크 hiccup에 취약하다. fetch 한 번이 실패하면 다음 회로가 작동한다.

1. **부동산 상세 페이지**: `buildingInfo`가 null → `shouldNoindexRealEstateDetail()`이 true 반환 → `<meta robots="noindex, follow">` 박힌 HTML이 응답으로 나감
2. **메인 페이지**: `useHomeSubscriptions()`가 빈 배열 반환 → 청약 카드 그리드가 비어 있는 HTML 응답
3. **사이트맵**: `fetchRealEstateBuildings` 등이 빈 데이터 반환 → 빈 `<urlset>` 응답

이 응답은 Nitro route cache에 `swr` 윈도우 동안(메인 1시간, real-estate 5분, sitemap 24시간) 박혀서 그 동안 모든 요청자(특히 검색엔진 봇)에게 noindex/빈 데이터를 노출한다.

### 측정 증거

- **네이버 서치어드바이저 수집 수치** (export_chart):
  - 05.12~05.19: 일평균 27~30k 수집
  - **05.20: 15,557 (반토막), 05.21: 11,508 (추가 하락)**
  - 오류 수치는 17~24로 변동 없음 → 5xx가 아닌 "색인 가치 없음" 판정
- **색인 총수 05.18→05.19 같은 값(171,376)으로 정체**
- **운영 메인 페이지 청약 카드 누락** (05.21 16:22 KST 캡처): 요약 16건/15건은 표시, 카드 그리드는 비어 있음. SSR HTML에 `"접수중"`/`"접수예정"` 0회 매칭

### 이전 시도와 한계

2026-05-21에 다음 안전망 PR이 머지됐다가 hotspot 리디자인 revert(#313)에 휩쓸려 같이 롤백됐다.

- #311 메인 SWR 1h → 1min (출혈 윈도우 단축)
- #309 rate-limit read-only skip + max 상향 (429 cascade 차단)
- #307 home-dashboard partial-failure tolerance (에러 격리)

이들은 모두 자기-호출 실패의 "노출 시간/확률"을 줄이는 우회로다. 본 PR은 자기-호출 자체를 제거해 회로를 끊는다. 본 PR이 완료되면 위 3개 안전망은 부활 불필요.

## 목표

- SSR이 backend를 호출할 때 외부망(nginx)을 거치지 않고 loopback(`127.0.0.1:8000`)을 직접 사용한다.
- 모든 SSR fetch에 통일된 retry/backoff/timeout 정책을 적용한다.
- API base 해석을 단일 chokepoint(`useApiBase()` / `getInternalApiBase()`)로 통일한다.
- ESLint 규칙으로 raw `config.public.apiBase` 접근을 차단해 회귀를 방지한다.

## 비목표

- 클라이언트(브라우저) 측 fetch retry 추가 (사용자는 빠른 실패를 선호)
- backend 자체 안정성 개선 (rate limit, partial failure 등은 본 PR 범위 밖)
- 외부 API(Kakao, 공공데이터포털) 호출 안정화
- CDN/Edge 도입
- 이미 deindex된 URL의 수동 재크롤 요청 (별도 운영 액션)
- Nitro `swr` 캐시 시간 조정 (loopback이 안정되면 기존 1h/5m/24h 그대로 유지 가능)

## PR 분할 전략

이전 사고(#313 revert에 안전망 PR이 휩쓸려 나감)의 교훈을 살려 단일 거대 PR이 아닌 **3개 독립 PR**로 분할한다. 각 PR은 독립적으로 머지/revert 가능하며, 하나가 깨져도 나머지에 영향 없음.

### PR-A: 인프라 (변경 영향 없음, 안전한 선행 PR)

**파일 수**: ~5
**리스크**: 거의 0 (새 코드 추가만, 아직 호출되지 않음)
**내용**:
- `frontend/nuxt.config.ts` `runtimeConfig.internalApiBase` 추가
- `frontend/composables/useApiBase.ts` server 분기 로직 추가
- `frontend/server/utils/internalApiBase.ts` 신설 (boot log 포함)
- `frontend/server/utils/ssrFetch.ts` 신설
- `frontend/tests/utils/ssrFetch.test.ts`, `frontend/tests/composables/useApiBase.test.ts` 확장
- `frontend/.env.example` 업데이트
- `ecosystem.config.js`에 `NUXT_INTERNAL_API_BASE` env 추가

**머지 후 운영 작업**: ecosystem.config.js 반영 + `pm2 restart ilsangkit-web --update-env` + 부팅 로그 확인 (`pm2 logs ilsangkit-web | grep internalApiBase`)

**검증**: 부팅 로그에 `[internalApiBase] resolved: http://127.0.0.1:8000` 정상 출력. 동작 변화는 없음(아직 사용처 없음).

### PR-B: Server-side 마이그레이션 (사이트맵 + middleware + server routes)

**파일 수**: ~10
**리스크**: 중간 — 사이트맵 응답 변화 가능성
**의존성**: PR-A 머지 완료
**내용**:
- `frontend/server/utils/sitemap.ts` 8개 fetch 함수를 `ssrFetch` 기반으로 변환
- `frontend/server/routes/sitemap.xml.ts`, `sitemap/[...].ts`, `sitemap/static.xml.ts`, `rss.xml.ts`, `og.get.ts`, `og-map.get.ts` `apiBase` 인자 제거
- `frontend/server/middleware/real-estate-redirect.ts` 동일 패턴

**머지 후 검증**:
- `curl https://ilsangkit.co.kr/sitemap.xml` URL 수 변화 없는지
- `curl https://ilsangkit.co.kr/sitemap/real-estate-1.xml | wc -l` 정상 응답
- `pm2 logs ilsangkit-web | grep ssrFetch` final failure 0건

**revert 가능성**: 단독. PR-A는 사용 안 되더라도 그대로 둠.

### PR-C: Composable + 페이지 + ESLint (최대 디프)

**파일 수**: ~25 (composable 15 + 페이지 5 + 테스트 + ESLint config)
**리스크**: 가장 큼 — composable 호출 패턴 광범위 변경
**의존성**: PR-A 머지 완료 (PR-B와 병행 가능)
**내용**:
- composable ~15개의 `config.public.apiBase` → `useApiBase()` 교체
- 페이지 SSR `useAsyncData` 내부 fetch 정리 (대부분 composable 경유, 직접 `$fetch` 호출만 grep으로 확정 후 교체)
- `useFetch` 사용처 일괄 확인 + 처리
- `frontend/tests/setup.ts`에 `useApiBase` 글로벌 mock 추가
- 개별 composable 테스트 mock 정리
- ESLint `no-restricted-syntax` 룰 추가 + nuxt.config.ts에 `eslint-disable-next-line` 1줄

**머지 후 검증**:
- 메인 페이지 청약 카드 그리드 정상 렌더 (`curl https://ilsangkit.co.kr/ | grep -c "접수중\|접수예정"` > 0)
- 부동산 단지 상세 페이지 임의 샘플에 `noindex` 박힘 0건
- vitest 전체 통과

**revert 가능성**: 단독. PR-B 이미 머지된 상태에서 PR-C만 revert해도 사이트맵은 계속 정상.

### 머지 순서 / 타임라인 (참고)

```
Day 0: PR-A 머지 → 운영 env 반영 → 부팅 로그 확인 (영향 없음)
Day 1~2: PR-B 머지 → 사이트맵/middleware 변경 모니터링 (24h)
Day 3~5: PR-C 머지 → composable/페이지 전환, ESLint 활성화
Day 7~14: 측정 (네이버 수집 / GSC 색인 / SSR p95)
```

각 단계마다 회귀 발견 시 해당 PR만 revert하면 됨.

## 설계

### 1. 설정 레이어

#### 1-1. `frontend/nuxt.config.ts`

```ts
runtimeConfig: {
  // server-only: SSR이 backend를 호출할 때 쓰는 base
  internalApiBase:
    process.env.NUXT_INTERNAL_API_BASE
    || process.env.NUXT_PUBLIC_API_BASE
    || 'http://localhost:8000',
  public: {
    apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000',
    // ... 기존 public 필드 유지
  },
},
```

#### 1-2. 환경별 설정

| 환경 | `NUXT_INTERNAL_API_BASE` | `NUXT_PUBLIC_API_BASE` |
|---|---|---|
| 운영 (Cafe24) | `http://127.0.0.1:8000` | `https://ilsangkit.co.kr` |
| 로컬 dev | (미설정) | `http://localhost:8000` |
| CI | (미설정) | `http://localhost:8000` (vitest는 msw로 가로채므로 무관) |

운영 추가 작업:
- `ecosystem.config.js`의 `ilsangkit-web` 항목 `env_production`에 `NUXT_INTERNAL_API_BASE: 'http://127.0.0.1:8000'` 추가 (이 저장소가 이미 pm2 ecosystem.config.js를 운영 표준으로 사용 중)
- 배포 후 `pm2 restart ilsangkit-web --update-env`로 env 변경 반영

#### 1-3. `frontend/.env.example` 업데이트

```sh
# SSR-only: 서버 사이드에서 backend 직접 호출 시 사용 (loopback 권장)
# 미설정 시 NUXT_PUBLIC_API_BASE로 fallback
# 운영: http://127.0.0.1:8000
NUXT_INTERNAL_API_BASE=
```

### 2. API Base Resolver

#### 2-1. `useApiBase()` 확장 (composable, 클라이언트/SSR 양쪽)

```ts
// frontend/composables/useApiBase.ts
function trimTrailingSlash(v: string): string { return v.replace(/\/+$/, '') }

export function useApiBase(): string {
  const config = useRuntimeConfig()

  // SSR: internalApiBase 우선, 없으면 public.apiBase로 fallback
  if (import.meta.server) {
    const internal = trimTrailingSlash(String(config.internalApiBase || ''))
    if (internal) return internal
    return trimTrailingSlash(String(config.public.apiBase || ''))
  }

  // 클라이언트: 기존 로직 그대로 (mixed-content / localhost fallback)
  const rawBase = trimTrailingSlash(String(config.public.apiBase || ''))
  if (!rawBase) return ''
  if (rawBase.startsWith('/')) return rawBase
  try {
    const target = new URL(rawBase, window.location.origin)
    const isLocalTarget = ['localhost', '127.0.0.1', '0.0.0.0'].includes(target.hostname)
    const isMixedContent = window.location.protocol === 'https:' && target.protocol === 'http:'
    if (isLocalTarget || isMixedContent) return ''
    if (target.origin === window.location.origin) {
      return target.pathname === '/' ? '' : trimTrailingSlash(target.pathname)
    }
  } catch { return '' }
  return rawBase
}
```

#### 2-2. `getInternalApiBase()` (server/utils, composable 외부)

`frontend/server/utils/` 경로는 Nuxt composable auto-import가 적용되지 않으므로 별도 헬퍼:

```ts
// frontend/server/utils/internalApiBase.ts
import { useRuntimeConfig } from '#imports'

let bootLogged = false

export function getInternalApiBase(): string {
  const cfg = useRuntimeConfig()
  const resolved = String(cfg.internalApiBase || cfg.public.apiBase || 'http://localhost:8000')
    .replace(/\/+$/, '')

  // 첫 호출 시 1회만 로그: 운영에서 NUXT_INTERNAL_API_BASE 누락 시 fallback 즉시 감지 가능
  if (!bootLogged) {
    bootLogged = true
    const isFallback = !cfg.internalApiBase && process.env.NODE_ENV === 'production'
    const tag = isFallback ? '[internalApiBase] WARN: falling back to public.apiBase in production' : '[internalApiBase]'
    console.info(`${tag} resolved: ${resolved}`)
  }
  return resolved
}
```

**Silent fallback 방지**: `NUXT_INTERNAL_API_BASE`가 운영에서 누락되면 fallback으로 `https://ilsangkit.co.kr`(외부망 자기-호출)이 되어 PR 효과가 0이 된다. 첫 호출 시 1회 부팅 로그로 즉시 감지 가능하게 한다.

### 3. `ssrFetch` 헬퍼

#### 3-1. 시그니처

```ts
// frontend/server/utils/ssrFetch.ts
import { $fetch, type FetchOptions } from 'ofetch'
import { getInternalApiBase } from './internalApiBase'

export interface SsrFetchOptions<T> extends FetchOptions<'json'> {
  retries?: number       // default 2 (총 3회 시도)
  retryDelayMs?: number  // default 200 (지수 백오프 base)
  timeoutMs?: number     // default 5000
}

export async function ssrFetch<T>(
  path: string,
  opts?: SsrFetchOptions<T>,
): Promise<T>
```

#### 3-2. 정책

| 항목 | 값 |
|---|---|
| 최대 시도 | 3회 (retries: 2 디폴트) |
| 백오프 | 지수 + 지터: `base × 2^N + random(0..base)` ms (base 200) |
| 타임아웃 | 5초/시도 (호출부 override 가능) |
| 재시도 대상 | **명시적 connection error (`ECONNREFUSED`, `ECONNRESET`, `ENOTFOUND`)** + 502, 503, 504 |
| 비재시도 대상 | 400, 401, 403, 404, 408, 422, 429, 500 (4xx 및 서버 버그), **AbortError(timeout)** |
| Timeout 재시도 안 함 이유 | backend가 느리지만 살아있는 상황(DB 락, 6s 응답)에서 timeout 후 재시도하면 동일 요청 3배 폭주 → thundering herd로 backend 진짜로 죽음. timeout abort는 backend가 처리 중일 가능성이 높아 재시도가 부작용 큼. |
| 429 재시도 안 함 이유 | rate-limit 응답을 받았다는 건 backend가 의도적으로 거절한 것. 재시도해도 같은 결과 가능성 높음. loopback 전환 후엔 자기-호출이 rate-limit 대상 아니라 발생 자체가 드물어짐. |
| 절대 경로 처리 | `http://`/`https://` 시작 시 그대로 사용 |
| 상대 경로 처리 | `/api/...` 시 `getInternalApiBase()` prepend |
| 로깅 | 실패 시도마다 `console.warn`, 최종 실패는 `console.error` |

#### 3-3. 구현

```ts
const RETRIABLE_STATUS = new Set([502, 503, 504])
const RETRIABLE_CONNECTION_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'])

function isRetriable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false

  // AbortError (timeout) → 재시도 금지. backend 처리 중일 가능성 + thundering herd 위험
  const name = (err as { name?: string }).name
  if (name === 'AbortError') return false

  // HTTP 응답 받은 경우: 명시적 5xx만 재시도
  const status = (err as { status?: number; statusCode?: number }).status
              ?? (err as { statusCode?: number }).statusCode
  if (typeof status === 'number') return RETRIABLE_STATUS.has(status)

  // 응답 못 받은 connection error: 코드 화이트리스트
  const code = (err as { code?: string; cause?: { code?: string } }).code
            ?? (err as { cause?: { code?: string } }).cause?.code
  if (typeof code === 'string') return RETRIABLE_CONNECTION_CODES.has(code)

  // 알 수 없는 에러 형태 → 재시도 안 함 (보수적)
  return false
}

function backoffMs(attempt: number, base: number): number {
  return base * (2 ** attempt) + Math.floor(Math.random() * base)
}

export async function ssrFetch<T>(
  path: string,
  opts: SsrFetchOptions<T> = {},
): Promise<T> {
  const { retries = 2, retryDelayMs = 200, timeoutMs = 5000, ...fetchOpts } = opts
  const url = /^https?:\/\//.test(path) ? path : `${getInternalApiBase()}${path}`

  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await $fetch<T>(url, { ...fetchOpts, signal: controller.signal })
    } catch (err) {
      lastErr = err
      if (attempt === retries || !isRetriable(err)) {
        console.error(`[ssrFetch] final failure: ${url}`, err)
        throw err
      }
      console.warn(`[ssrFetch] attempt ${attempt + 1}/${retries + 1} failed: ${url}`, err)
      await new Promise(r => setTimeout(r, backoffMs(attempt, retryDelayMs)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}
```

### 4. Callsite 리팩터

#### 4-1. Composables (~15 파일)

대상: `useWasteSchedule.ts`, `useSubwayStation.ts`, `useFacilityYoutube.ts`, `useGuides.ts`, `usePublicRental.ts`, `useSubscription.ts`, `useRentalAnnouncements.ts`, `useRealEstate.ts`, `useHospitalDepartments.ts`, `useRegions.ts`, `useHomeDashboard.ts`, `useRegionFacilities.ts`, `useHomeSubscriptions.ts`, `useFacilityDetail.ts`, `useRealEstateHotspots.ts`, `useBlogReviews.ts`

변환 패턴:

```ts
// Before
const config = useRuntimeConfig()
const res = await $fetch(`${config.public.apiBase}/api/foo`, { ... })

// After
const apiBase = useApiBase()
const res = await $fetch(`${apiBase}/api/foo`, { ... })
```

composable은 SSR/CSR 양쪽에서 호출되므로 `ssrFetch`가 아닌 `useApiBase()` 교체만 적용. SSR 시 internalApiBase가 자동 적용된다.

#### 4-2. `frontend/server/utils/sitemap.ts`

각 fetch 함수의 manual retry 루프를 제거하고 `ssrFetch`로 위임. `apiBase` 인자 제거.

대상 함수: `fetchSitemapFacilities`, `fetchWasteSchedules`, `fetchRealEstateBuildings`, `fetchRealEstateCityDistrictHubs`, `fetchRegionCategories`, `fetchSitemapPageCounts`, `fetchSubwayStationsForSitemap`, `fetchSubscriptionsForSitemap`

변환 예시:

```ts
// Before
export async function fetchRealEstateBuildings(apiBase: string) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25_000)
    try {
      const res = await fetch(`${apiBase}/api/sitemap/real-estate-buildings`, { signal: controller.signal })
      // ... manual retry handling
    } catch (err) { ... }
  }
}

// After
export async function fetchRealEstateBuildings(): Promise<SitemapRealEstateBuilding[]> {
  try {
    const json = await ssrFetch<{ data: SitemapRealEstateBuilding[] }>(
      '/api/sitemap/real-estate-buildings',
      { timeoutMs: 25_000 },
    )
    const raw = json.data ?? []
    const data = raw.filter((item) => isValidBuildingName(item.buildingName))
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchRealEstateBuildings failed', err)
    return []
  }
}
```

#### 4-3. Server routes

대상: `frontend/server/routes/sitemap.xml.ts`, `frontend/server/routes/sitemap/[...].ts`, `frontend/server/routes/sitemap/static.xml.ts`, `frontend/server/routes/rss.xml.ts`, `frontend/server/routes/og.get.ts`, `frontend/server/routes/og-map.get.ts`

`apiBase` 인자 전달 제거 + `ssrFetch` 또는 위 utils 호출로 정리.

#### 4-4. Middleware — `frontend/server/middleware/real-estate-redirect.ts`

```ts
// Before
const apiBase = (process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:8000')
const lookup = await resolveBjdCode(bjdCode, (u) => $fetch(u), apiBase)

// After
const lookup = await resolveBjdCode(bjdCode, (path) => ssrFetch(path))
```

`resolveBjdCode` 시그니처에서 `apiBase` 인자 제거, fetcher는 path만 받음.

#### 4-5. 페이지 SSR fetch

대상:
- `pages/real-estate/index.vue` (라인 75~)
- `pages/real-estate/[realEstateType]/index.vue` (라인 227)
- `pages/real-estate/[realEstateType]/[city]/[district]/index.vue` (라인 190)
- `pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (라인 916)

이들 페이지의 `useAsyncData` 내부 fetch는 대부분 composable(`useRealEstate` 등)을 경유하므로 4-1로 자동 해결. 페이지에서 직접 `$fetch(\`${apiBase}/api/...\`)` 형태로 호출하는 부분만 식별해서 `useApiBase()`로 교체 (plan 단계에서 grep으로 확정).

**`useFetch` vs `$fetch` 커버리지 확인 필수**: 본 spec은 `$fetch` 사용처를 가정하지만 일부 composable이 `useFetch`(자동 data wrapper) 패턴을 쓸 수 있다. plan 단계에서 `grep -rn "useFetch(" frontend/composables frontend/pages` 로 식별 후 처리 방침 결정:
- `useFetch`의 첫 인자가 절대 URL 문자열이면 `useApiBase()` prepend로 동일 처리
- baseURL 옵션을 쓰는 경우 옵션 값을 `useApiBase()`로 교체

#### 4-6. `nuxt.config.ts` 상단 const

```ts
// 변경 없음 — CSP 도메인 주입 목적의 클라이언트 노출 URL
// eslint-disable-next-line no-restricted-syntax
const apiBase = process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'
```

이 변수는 CSP 헤더의 `connect-src ${apiBase}` 같은 곳에서 쓰이므로 그대로 둠. ESLint disable 코멘트 1줄 추가.

### 5. ESLint 회귀 차단

```js
// frontend/eslint.config.ts 또는 .eslintrc.cjs에 추가
{
  files: ['composables/**', 'pages/**', 'components/**'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector: "MemberExpression[object.property.name='public'][property.name='apiBase']",
      message: 'Use useApiBase() instead of accessing config.public.apiBase directly. SSR-safe base resolution lives there.',
    }],
  },
},
{
  files: ['server/**'],
  rules: {
    'no-restricted-syntax': ['error', {
      selector: "MemberExpression[object.property.name='public'][property.name='apiBase']",
      message: 'Use getInternalApiBase() from server/utils/internalApiBase.ts',
    }],
  },
},
```

예외 파일: `frontend/nuxt.config.ts`, `frontend/composables/useApiBase.ts`, `frontend/server/utils/internalApiBase.ts` (자체 정의/노출 책임). 해당 라인에 `eslint-disable-next-line` 추가.

ESLint 룰은 PR-C 내부에서 모든 위반을 0으로 만든 다음 같은 PR에 추가한다 (분리하면 회귀 위험).

### 6. 테스트

#### 6-1. 신규

- `frontend/tests/utils/ssrFetch.test.ts`
  - 성공 시 한 번에 반환
  - 408/429/502/503/504 retriable 케이스 — 시도 횟수 검증
  - 400/404/422 non-retriable 케이스 — 즉시 throw
  - 500 non-retriable — 즉시 throw
  - retries 소진 후 마지막 에러 throw
  - timeoutMs 초과 시 AbortError
  - 절대 URL일 때 base prepend 안 됨
  - 상대 path일 때 `getInternalApiBase()` prepend
  - 백오프 지터: 시도 간 delay가 base ≤ delay ≤ base×3 범위인지

#### 6-2. 기존 확장

- `frontend/tests/composables/useApiBase.test.ts`
  - `import.meta.server === true`일 때 `internalApiBase` 반환
  - `internalApiBase` 미설정 시 `public.apiBase`로 fallback
  - 클라이언트 케이스는 기존 그대로

- `frontend/tests/setup.ts`
  - `useApiBase` 글로벌 mock 추가 (`vi.fn(() => 'http://localhost:8000')` 디폴트)
  - 개별 composable 테스트가 raw `config.public.apiBase` mock에 의존하던 부분 정리

#### 6-3. 영향받는 기존 테스트

각 composable 테스트가 `useRuntimeConfig` mock으로 `apiBase`를 주입하던 부분 → `useApiBase` mock 사용으로 교체. 단순 검색-치환에 가깝다.

대상 (예상): `useFacilityDetail.test.ts`, `useFacilityYoutube.test.ts`, `useRegionFacilities-subway.test.ts`, `useBlogReviews.test.ts`, `useApiBase.test.ts`, `usePublicRental.test.ts`, `useRealEstateHotspots.test.ts`, `useRegions.test.ts`

### 7. 배포 절차

PR-A/B/C 각각 독립 배포. 공통 흐름:

1. PR 머지 후 GitHub Actions `Test` 워크플로우 통과 확인
2. `Deploy to Cafe24` 워크플로우 자동 트리거
3. **PR-A 머지 직후 1회만**: Cafe24 서버에서
   - `ecosystem.config.js`에 `NUXT_INTERNAL_API_BASE: 'http://127.0.0.1:8000'` 반영됐는지 확인
   - `pm2 restart ilsangkit-web --update-env` (env 변경분 반영)
   - 사전 sanity check: `curl http://127.0.0.1:8000/api/meta/home-dashboard | head -c 200` — backend가 loopback에서 응답하는지
   - 부팅 로그 확인: `pm2 logs ilsangkit-web --lines 100 | grep internalApiBase` — `[internalApiBase] resolved: http://127.0.0.1:8000` 정상 출력 (WARN fallback 아닌지)
4. **PR-B/C 머지 직후 캐시 정리** (옛 stale HTML 즉시 무효화):
   - `find /path/to/frontend/.output/server/.nuxt/cache/nitro/routes -name '*.json' -delete`
5. **검증** (PR별, 10분 이내):
   - PR-A 후: 부팅 로그만 확인 (동작 변화 없음)
   - PR-B 후: `curl https://ilsangkit.co.kr/sitemap.xml` URL 수 변화 없는지
   - PR-C 후: `curl https://ilsangkit.co.kr/` → 청약 카드 그리드 있는지, 부동산 단지 페이지 임의 1~3개 → `<meta robots>` 없는지(또는 `index, follow`)
   - 공통: `pm2 logs ilsangkit-web | grep ssrFetch` → final failure 0건
6. **PR-C 머지 24~48시간 후**: 네이버 서치어드바이저 수집 수치 회복 여부 확인

### 8. 롤백 절차

3개 PR이 독립이므로 문제 PR만 단독 revert. 이전 사고처럼 다른 작업이 휩쓸려 나가지 않게 hotspot UI 등과 절대 묶지 않음.

| 증상 | 롤백 대상 |
|---|---|
| backend 부하 증폭 (`ssrFetch` retry 폭주) | PR-A revert (PR-B/C는 의존하므로 같이 revert 또는 ssrFetch 호출부를 fallback 처리) |
| 사이트맵 빈 응답 회귀 | PR-B revert (PR-A는 유지) |
| composable hydration mismatch, ESLint CI 폭발 | PR-C revert (PR-A/B는 유지) |
| SSR latency p95 +500ms 이상 증가 | 원인 PR 식별 후 해당 revert |

롤백 방법:
- `git revert <merge-commit>` 해당 PR 단독 커밋
- PR-A revert 시 운영 서버 `NUXT_INTERNAL_API_BASE` env 제거 (없어도 fallback으로 동작하므로 필수 아님)

## 검증 기준 (PR 머지 후 1~2주)

| 지표 | 출처 | 기대 |
|---|---|---|
| 운영 메인 페이지 청약 카드 누락 사례 | 직접 모니터링 / 사용자 신고 | 0건 |
| 부동산 상세 페이지 `<meta robots="noindex">` 박힘 사례 | 임의 샘플 30개 curl 검사 | 0건 (단, `shouldNoindexRealEstateDetail`의 의도적 noindex는 제외) |
| backend `RATE_LIMIT_EXCEEDED` 로그 — 자기 호출 origin | `pm2 logs ilsangkit-api` | 0건 |
| SSR p95 응답 시간 | nginx / pm2 모니터 | -100~300ms |
| 네이버 서치어드바이저 일일 수집 수치 | 네이버 서치어드바이저 | 회복 추세 (2~4주, 보장 없음 — 네이버 crawl budget 회복은 opaque) |
| GSC Indexing > Pages 부동산 URL 색인률 | Google Search Console | 상승 |
| GSC Sitemaps 발견 URL 수 | GSC | 안정적 또는 ↑ |

## 위험과 완화

| 위험 | 완화 |
|---|---|
| pm2 cluster mode에서 `127.0.0.1:8000` 바인딩이 wildcard 아닐 경우 연결 실패 | backend가 `0.0.0.0:8000` 또는 별도 설정 없이 listen하는지 plan 단계 확인 후 진행. 운영에서 사전 `curl http://127.0.0.1:8000/api/health` 테스트 |
| 일부 composable이 SSR/CSR에서 다른 base를 요구하던 숨은 가정 | composable별 grep으로 base 사용 패턴 확인, 테스트 통과로 검증 |
| 부동산 상세 페이지의 `getTransactionStats` 등 헬퍼 위치가 composable 외부일 경우 4-5가 더 복잡해짐 | plan 단계에서 grep으로 확정. 헬퍼가 인라인이면 `ssrFetch` 직접 호출, composable이면 4-1로 자동 해결 |
| ESLint 룰 추가로 미발견 위반이 CI 폭발 | 본 PR 내부에서 위반 0건 만든 다음 룰 추가. 모든 변경을 한 PR에 묶음 |
| 클라이언트가 어떤 응답을 internalApiBase 기반으로 SSR된 줄 모르고 다시 호출하면 어떻게 되나 | client는 `public.apiBase`를 그대로 쓰므로 자동으로 외부망 호출 — 정상 |
| 운영 backend가 죽었을 때 loopback도 같이 실패하는 건 마찬가지 | 본 PR은 backend 자체 안정성을 다루지 않음. 별도 작업 (헬스체크, 자동 재시작 등) |
| `127.0.0.1:8000` 가정이 docker-compose 환경에서 깨짐 | docker-compose는 dev 전용. 미설정 → fallback이므로 영향 없음 |

## Out of scope

- backend rate-limit/partial-failure 안정성 (별도 작업)
- Naver/Google 수동 색인 재요청 (운영 액션)
- 외부 공공 API 호출 안정화
- 클라이언트 측 retry
- CDN/Edge 도입

## 참고

- 사고 발생 PR: #313 (revert), 그 이전의 #311/#309/#307 (롤백된 안전망)
- 측정 데이터: 네이버 서치어드바이저 export_chart 2026-05-12~21
- 관련 메모리: [Nitro 라우트 캐시 stale 이슈](../../../.claude/projects/-Users-leemyeongseok-projects-ilsangkit/memory/project_nitro_route_cache.md), [부동산 URL 리팩터 완료](../../../.claude/projects/-Users-leemyeongseok-projects-ilsangkit/memory/project_real_estate_indexing_crisis.md)
