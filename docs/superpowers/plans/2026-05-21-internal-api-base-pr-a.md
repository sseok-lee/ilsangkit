# PR-A: internalApiBase Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SSR이 backend를 호출할 때 쓸 인프라(`runtimeConfig.internalApiBase` + `useApiBase()` server 분기 + `getInternalApiBase()` 헬퍼 + `ssrFetch()` retry/backoff 헬퍼)를 신설한다. 어떤 호출부도 변경하지 않으므로 머지 후 동작 변화 없음.

**Architecture:** 새 파일 2개 + 기존 파일 4개 수정. TDD 사이클로 각 컴포넌트 검증. PR-A 머지 후 PR-B/C가 이 인프라를 호출하기 시작한다.

**Tech Stack:** Nuxt 3, Vitest, ofetch (`$fetch`), TypeScript ESM

**Spec:** `docs/superpowers/specs/2026-05-21-internal-api-base-ssr-resilience-design.md`

---

## File Structure

**Create:**
- `frontend/server/utils/internalApiBase.ts` — server-only base URL resolver with boot log
- `frontend/server/utils/ssrFetch.ts` — retry/backoff wrapper around `$fetch` for SSR
- `frontend/tests/utils/ssrFetch.test.ts` — unit tests for retry policy

**Modify:**
- `frontend/composables/useApiBase.ts` — add `import.meta.server` branch returning `internalApiBase`
- `frontend/tests/composables/useApiBase.test.ts` — add server-side test cases
- `frontend/nuxt.config.ts` — add `runtimeConfig.internalApiBase`
- `frontend/.env.example` — document `NUXT_INTERNAL_API_BASE`
- `ecosystem.config.js` — add `NUXT_INTERNAL_API_BASE` in `env_production` of `ilsangkit-web`

**Responsibility split:**
- `internalApiBase.ts`: URL 해석 + boot log. 외부에 결과 URL string 반환만 한다.
- `ssrFetch.ts`: HTTP retry + timeout + backoff. URL 해석은 `internalApiBase.ts`에 위임한다.
- `useApiBase.ts`: composable 진입점. server/client 분기. server에서는 `internalApiBase` 우선.

---

## Pre-flight

- [ ] **Step 0: Switch to Node 20 + verify tree clean**

```bash
nvm use 20
cd /Users/leemyeongseok/projects/ilsangkit
git status
git checkout develop && git pull origin develop
git checkout -b feat/internal-api-base-pr-a
```

Expected: `nothing to commit, working tree clean`, on new branch `feat/internal-api-base-pr-a`.

- [ ] **Step 0.5: Verify baseline tests pass**

```bash
cd frontend && npx vitest run tests/composables/useApiBase.test.ts
```

Expected: all 3 existing tests PASS.

---

## Task 1: Add `runtimeConfig.internalApiBase` to nuxt.config.ts

**Files:**
- Modify: `frontend/nuxt.config.ts` (runtimeConfig block, ~line 169)

- [ ] **Step 1: Read current runtimeConfig block to find exact insertion point**

```bash
sed -n '165,185p' frontend/nuxt.config.ts
```

Expected output shows `runtimeConfig: { public: { ... } }` structure.

- [ ] **Step 2: Add `internalApiBase` field (server-only, outside `public`)**

Edit `frontend/nuxt.config.ts`:

```ts
  runtimeConfig: {
    // server-only: SSR이 backend를 호출할 때 쓰는 base. 운영에선 loopback 권장.
    internalApiBase:
      process.env.NUXT_INTERNAL_API_BASE
      || process.env.NUXT_PUBLIC_API_BASE
      || 'http://localhost:8000',
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000',
      kakaoMapKey: process.env.NUXT_PUBLIC_KAKAO_MAP_KEY || '',
      gaId: process.env.NUXT_PUBLIC_GA_ID || '',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://ilsangkit.co.kr',
      disableMsw: process.env.NUXT_PUBLIC_DISABLE_MSW === 'true'
    },
  },
```

- [ ] **Step 3: Verify nuxt.config.ts type-checks**

```bash
cd frontend && npx nuxt prepare && npx tsc --noEmit -p . 2>&1 | head -30
```

Expected: no TypeScript errors. (`nuxt prepare` regenerates `.nuxt/types`.)

- [ ] **Step 4: Commit**

```bash
git add frontend/nuxt.config.ts
git commit -m "feat(frontend): add internalApiBase to runtimeConfig

서버 사이드 SSR이 backend를 호출할 때 쓸 별도 base를 runtimeConfig에 추가.
NUXT_INTERNAL_API_BASE 미설정 시 NUXT_PUBLIC_API_BASE로 fallback.

Spec: docs/superpowers/specs/2026-05-21-internal-api-base-ssr-resilience-design.md (PR-A)"
```

---

## Task 2: Update `.env.example` with `NUXT_INTERNAL_API_BASE`

**Files:**
- Modify: `frontend/.env.example`

- [ ] **Step 1: Append documentation block to `.env.example`**

Edit `frontend/.env.example`, append at the end:

```sh

# SSR-only: 서버 사이드에서 backend 직접 호출 시 사용 (loopback 권장)
# 미설정 시 NUXT_PUBLIC_API_BASE 로 fallback
# 운영: http://127.0.0.1:8000
# 로컬 dev: 미설정 (NUXT_PUBLIC_API_BASE 로 fallback)
NUXT_INTERNAL_API_BASE=
```

- [ ] **Step 2: Commit**

```bash
git add frontend/.env.example
git commit -m "docs(frontend): document NUXT_INTERNAL_API_BASE in .env.example"
```

---

## Task 3: Update `ecosystem.config.js` with internal base for production

**Files:**
- Modify: `ecosystem.config.js` (`ilsangkit-web` app, `env_production`)

- [ ] **Step 1: Read current ilsangkit-web env_production block**

```bash
sed -n '25,45p' ecosystem.config.js
```

Expected: shows `ilsangkit-web` block with `env_production: { NODE_ENV: 'production', PORT: 3000 }`.

- [ ] **Step 2: Add `NUXT_INTERNAL_API_BASE` to `env_production`**

Edit `ecosystem.config.js`, modify the `ilsangkit-web` `env_production` block:

```js
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        NUXT_INTERNAL_API_BASE: 'http://127.0.0.1:8000'
      },
```

- [ ] **Step 3: Commit**

```bash
git add ecosystem.config.js
git commit -m "chore(deploy): set NUXT_INTERNAL_API_BASE=http://127.0.0.1:8000 in production

frontend SSR이 backend(localhost:8000)를 loopback으로 직접 호출하도록 설정.
배포 후 pm2 restart ilsangkit-web --update-env 필요."
```

---

## Task 4: Create `getInternalApiBase()` helper (TDD)

**Files:**
- Create: `frontend/server/utils/internalApiBase.ts`
- Create: `frontend/tests/utils/internalApiBase.test.ts`

### Cycle 4.1: returns configured internalApiBase

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/utils/internalApiBase.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseRuntimeConfig = vi.fn()
vi.mock('#imports', () => ({ useRuntimeConfig: mockUseRuntimeConfig }))

describe('getInternalApiBase', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // module-level bootLogged 상태를 리셋하기 위해 dynamic import
    vi.resetModules()
  })

  it('runtimeConfig.internalApiBase 값을 반환한다', async () => {
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: 'http://127.0.0.1:8000',
      public: { apiBase: 'https://ilsangkit.co.kr' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    expect(getInternalApiBase()).toBe('http://127.0.0.1:8000')
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
cd frontend && npx vitest run tests/utils/internalApiBase.test.ts
```

Expected: FAIL with `Cannot find module '~/server/utils/internalApiBase'`.

- [ ] **Step 3: Create minimal implementation**

Create `frontend/server/utils/internalApiBase.ts`:

```ts
import { useRuntimeConfig } from '#imports'

export function getInternalApiBase(): string {
  const cfg = useRuntimeConfig()
  return String(cfg.internalApiBase || cfg.public.apiBase || 'http://localhost:8000')
    .replace(/\/+$/, '')
}
```

- [ ] **Step 4: Run test to verify PASS**

```bash
cd frontend && npx vitest run tests/utils/internalApiBase.test.ts
```

Expected: 1 test passes.

### Cycle 4.2: trims trailing slashes

- [ ] **Step 5: Add test for trailing slash trimming**

Append to `frontend/tests/utils/internalApiBase.test.ts`:

```ts
  it('trailing slash를 제거한다', async () => {
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: 'http://127.0.0.1:8000///',
      public: { apiBase: '' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    expect(getInternalApiBase()).toBe('http://127.0.0.1:8000')
  })
```

- [ ] **Step 6: Run test — should already PASS** (existing implementation handles it)

```bash
cd frontend && npx vitest run tests/utils/internalApiBase.test.ts
```

Expected: 2 tests pass.

### Cycle 4.3: falls back to public.apiBase

- [ ] **Step 7: Add fallback test**

Append:

```ts
  it('internalApiBase 미설정 시 public.apiBase 로 fallback', async () => {
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: '',
      public: { apiBase: 'https://ilsangkit.co.kr' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    expect(getInternalApiBase()).toBe('https://ilsangkit.co.kr')
  })

  it('둘 다 미설정 시 http://localhost:8000 으로 fallback', async () => {
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: '',
      public: { apiBase: '' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    expect(getInternalApiBase()).toBe('http://localhost:8000')
  })
```

- [ ] **Step 8: Run — should PASS**

```bash
cd frontend && npx vitest run tests/utils/internalApiBase.test.ts
```

Expected: 4 tests pass.

### Cycle 4.4: boot log + production warn fallback

- [ ] **Step 9: Add boot log tests**

Append:

```ts
  it('첫 호출 시 부팅 로그를 1회 출력한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: 'http://127.0.0.1:8000',
      public: { apiBase: '' },
    })
    const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
    getInternalApiBase()
    getInternalApiBase()
    getInternalApiBase()
    expect(infoSpy).toHaveBeenCalledTimes(1)
    expect(infoSpy.mock.calls[0][0]).toMatch(/\[internalApiBase\].*resolved: http:\/\/127\.0\.0\.1:8000/)
    infoSpy.mockRestore()
  })

  it('production 환경에서 internalApiBase 미설정이면 WARN을 출력한다', async () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    mockUseRuntimeConfig.mockReturnValue({
      internalApiBase: '',
      public: { apiBase: 'https://ilsangkit.co.kr' },
    })
    try {
      const { getInternalApiBase } = await import('~/server/utils/internalApiBase')
      getInternalApiBase()
      expect(infoSpy.mock.calls[0][0]).toMatch(/WARN.*falling back/)
    } finally {
      process.env.NODE_ENV = originalEnv
      infoSpy.mockRestore()
    }
  })
```

- [ ] **Step 10: Run test to verify FAIL**

```bash
cd frontend && npx vitest run tests/utils/internalApiBase.test.ts
```

Expected: 2 new tests FAIL (no logging implemented yet).

- [ ] **Step 11: Update implementation to add boot log**

Replace `frontend/server/utils/internalApiBase.ts`:

```ts
import { useRuntimeConfig } from '#imports'

let bootLogged = false

export function getInternalApiBase(): string {
  const cfg = useRuntimeConfig()
  const resolved = String(cfg.internalApiBase || cfg.public.apiBase || 'http://localhost:8000')
    .replace(/\/+$/, '')

  if (!bootLogged) {
    bootLogged = true
    const isFallback = !cfg.internalApiBase && process.env.NODE_ENV === 'production'
    const tag = isFallback
      ? '[internalApiBase] WARN: falling back to public.apiBase in production'
      : '[internalApiBase]'
    console.info(`${tag} resolved: ${resolved}`)
  }
  return resolved
}
```

- [ ] **Step 12: Run all tests to verify PASS**

```bash
cd frontend && npx vitest run tests/utils/internalApiBase.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 13: Commit**

```bash
git add frontend/server/utils/internalApiBase.ts frontend/tests/utils/internalApiBase.test.ts
git commit -m "feat(frontend): add getInternalApiBase server util with boot log

SSR 자기-호출을 loopback으로 라우팅하기 위한 base URL resolver.
첫 호출 시 1회 부팅 로그 출력 — 운영에서 silent fallback 즉시 감지 가능.

Spec: docs/superpowers/specs/2026-05-21-internal-api-base-ssr-resilience-design.md"
```

---

## Task 5: Extend `useApiBase()` with server-side branching (TDD)

**Files:**
- Modify: `frontend/composables/useApiBase.ts`
- Modify: `frontend/tests/composables/useApiBase.test.ts`

### Cycle 5.1: SSR returns internalApiBase

- [ ] **Step 1: Write the failing test**

Append to `frontend/tests/composables/useApiBase.test.ts`:

```ts
  describe('SSR (import.meta.server)', () => {
    const originalServer = (import.meta as any).server

    beforeEach(() => {
      ;(import.meta as any).server = true
    })

    afterEach(() => {
      ;(import.meta as any).server = originalServer
    })

    it('SSR에선 internalApiBase 를 반환한다', () => {
      mockUseRuntimeConfig.mockReturnValue({
        internalApiBase: 'http://127.0.0.1:8000',
        public: { apiBase: 'https://ilsangkit.co.kr' },
      })
      expect(useApiBase()).toBe('http://127.0.0.1:8000')
    })

    it('SSR에서 internalApiBase 미설정 시 public.apiBase 로 fallback', () => {
      mockUseRuntimeConfig.mockReturnValue({
        internalApiBase: '',
        public: { apiBase: 'https://ilsangkit.co.kr' },
      })
      expect(useApiBase()).toBe('https://ilsangkit.co.kr')
    })

    it('SSR에서 internalApiBase trailing slash 정규화', () => {
      mockUseRuntimeConfig.mockReturnValue({
        internalApiBase: 'http://127.0.0.1:8000/',
        public: { apiBase: '' },
      })
      expect(useApiBase()).toBe('http://127.0.0.1:8000')
    })
  })
```

Note: `afterEach` import 필요. 파일 상단 import line에 추가:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
```

- [ ] **Step 2: Run tests — new 3개 FAIL**

```bash
cd frontend && npx vitest run tests/composables/useApiBase.test.ts
```

Expected: 3 new tests FAIL (server branch not implemented). 기존 3개는 PASS.

- [ ] **Step 3: Implement server branching in useApiBase**

Replace `frontend/composables/useApiBase.ts`:

```ts
function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Resolve a safe API base for both SSR and browser environments.
 *
 * - SSR returns `internalApiBase` (loopback) so backend calls skip nginx round-trip.
 *   Falls back to `public.apiBase` if `internalApiBase` not configured.
 * - Browsers fall back to same-origin `/api` proxy when the configured base points to
 *   localhost or would cause mixed-content requests on HTTPS.
 */
export function useApiBase(): string {
  const config = useRuntimeConfig()

  if (import.meta.server) {
    const internal = trimTrailingSlash(String((config as any).internalApiBase || ''))
    if (internal) return internal
    return trimTrailingSlash(String(config.public.apiBase || ''))
  }

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
  } catch {
    return ''
  }

  return rawBase
}
```

- [ ] **Step 4: Run all useApiBase tests**

```bash
cd frontend && npx vitest run tests/composables/useApiBase.test.ts
```

Expected: 6 tests pass (3 기존 + 3 신규).

- [ ] **Step 5: Commit**

```bash
git add frontend/composables/useApiBase.ts frontend/tests/composables/useApiBase.test.ts
git commit -m "feat(frontend): branch useApiBase to internalApiBase on SSR

SSR import.meta.server 시 runtimeConfig.internalApiBase 우선 반환.
미설정 시 기존대로 public.apiBase로 fallback.
클라이언트 동작은 변경 없음.

Spec: docs/superpowers/specs/2026-05-21-internal-api-base-ssr-resilience-design.md"
```

---

## Task 6: Create `ssrFetch` — happy path (TDD)

**Files:**
- Create: `frontend/server/utils/ssrFetch.ts`
- Create: `frontend/tests/utils/ssrFetch.test.ts`

### Cycle 6.1: success returns parsed JSON

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/utils/ssrFetch.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetch = vi.fn()

vi.mock('ofetch', () => ({
  $fetch: mockFetch,
}))

vi.mock('~/server/utils/internalApiBase', () => ({
  getInternalApiBase: () => 'http://127.0.0.1:8000',
}))

import { ssrFetch } from '~/server/utils/ssrFetch'

describe('ssrFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('성공 시 응답을 그대로 반환한다', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, data: { items: [1, 2] } })
    const result = await ssrFetch('/api/foo')
    expect(result).toEqual({ ok: true, data: { items: [1, 2] } })
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('상대 경로에 internalApiBase를 prepend 한다', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    await ssrFetch('/api/foo')
    expect(mockFetch.mock.calls[0][0]).toBe('http://127.0.0.1:8000/api/foo')
  })

  it('절대 URL은 그대로 사용한다', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    await ssrFetch('https://external.example.com/api/x')
    expect(mockFetch.mock.calls[0][0]).toBe('https://external.example.com/api/x')
  })
})
```

- [ ] **Step 2: Run test — 3개 FAIL**

```bash
cd frontend && npx vitest run tests/utils/ssrFetch.test.ts
```

Expected: FAIL — `Cannot find module '~/server/utils/ssrFetch'`.

- [ ] **Step 3: Minimal implementation**

Create `frontend/server/utils/ssrFetch.ts`:

```ts
import { $fetch, type FetchOptions } from 'ofetch'
import { getInternalApiBase } from './internalApiBase'

export interface SsrFetchOptions<T = unknown> extends FetchOptions<'json'> {
  retries?: number
  retryDelayMs?: number
  timeoutMs?: number
}

const RETRIABLE_STATUS = new Set([502, 503, 504])
const RETRIABLE_CONNECTION_CODES = new Set(['ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'])

function isRetriable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = (err as { name?: string }).name
  if (name === 'AbortError') return false
  const status = (err as { status?: number; statusCode?: number }).status
              ?? (err as { statusCode?: number }).statusCode
  if (typeof status === 'number') return RETRIABLE_STATUS.has(status)
  const code = (err as { code?: string; cause?: { code?: string } }).code
            ?? (err as { cause?: { code?: string } }).cause?.code
  if (typeof code === 'string') return RETRIABLE_CONNECTION_CODES.has(code)
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
      return await $fetch<T>(url, { ...fetchOpts, signal: controller.signal }) as T
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

- [ ] **Step 4: Run — 3 tests PASS**

```bash
cd frontend && npx vitest run tests/utils/ssrFetch.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/server/utils/ssrFetch.ts frontend/tests/utils/ssrFetch.test.ts
git commit -m "feat(frontend): add ssrFetch with internalApiBase URL resolution

상대 경로는 getInternalApiBase() prepend, 절대 URL은 그대로 사용.
재시도/타임아웃 정책은 후속 cycle에서 검증.

Spec: docs/superpowers/specs/2026-05-21-internal-api-base-ssr-resilience-design.md"
```

---

## Task 7: `ssrFetch` retry on connection error (TDD)

**Files:**
- Modify: `frontend/tests/utils/ssrFetch.test.ts`

- [ ] **Step 1: Add test for ECONNREFUSED retry**

Append to `frontend/tests/utils/ssrFetch.test.ts`:

```ts
  it('ECONNREFUSED 발생 시 retries 만큼 재시도하고 성공 시 결과 반환', async () => {
    const connErr = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })
    mockFetch
      .mockRejectedValueOnce(connErr)
      .mockRejectedValueOnce(connErr)
      .mockResolvedValueOnce({ ok: true })

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('cause.code 가 connection error 인 경우도 재시도한다', async () => {
    const wrappedErr = Object.assign(new Error('fetch failed'), {
      cause: { code: 'ECONNRESET' },
    })
    mockFetch.mockRejectedValueOnce(wrappedErr).mockResolvedValueOnce({ ok: true })

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await promise

    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('재시도 모두 실패하면 마지막 에러를 throw 한다', async () => {
    const connErr = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' })
    mockFetch.mockRejectedValue(connErr)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(5000)

    await expect(promise).rejects.toThrow('ECONNREFUSED')
    expect(mockFetch).toHaveBeenCalledTimes(3) // 1 + 2 retries
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('final failure'), connErr)

    errorSpy.mockRestore()
    warnSpy.mockRestore()
  })
```

- [ ] **Step 2: Run tests — should already PASS** (구현은 이미 retry 지원)

```bash
cd frontend && npx vitest run tests/utils/ssrFetch.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/utils/ssrFetch.test.ts
git commit -m "test(ssrFetch): connection error retry behavior"
```

---

## Task 8: `ssrFetch` retry on 502/503/504 (TDD)

**Files:**
- Modify: `frontend/tests/utils/ssrFetch.test.ts`

- [ ] **Step 1: Add tests for retriable 5xx**

Append:

```ts
  it.each([502, 503, 504])('status %i 일 때 재시도한다', async (status) => {
    const httpErr = Object.assign(new Error(`HTTP ${status}`), { status })
    mockFetch.mockRejectedValueOnce(httpErr).mockResolvedValueOnce({ ok: true })

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(await promise).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('statusCode 필드(ofetch 변종)도 인식한다', async () => {
    const httpErr = Object.assign(new Error('HTTP 502'), { statusCode: 502 })
    mockFetch.mockRejectedValueOnce(httpErr).mockResolvedValueOnce({ ok: true })

    const promise = ssrFetch('/api/foo', { retryDelayMs: 10 })
    await vi.advanceTimersByTimeAsync(1000)

    expect(await promise).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
```

- [ ] **Step 2: Run — PASS**

```bash
cd frontend && npx vitest run tests/utils/ssrFetch.test.ts
```

Expected: 10 tests pass (6 + 4 신규: `it.each` 3 + 1).

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/utils/ssrFetch.test.ts
git commit -m "test(ssrFetch): retry on 502/503/504"
```

---

## Task 9: `ssrFetch` does NOT retry on non-retriable errors (TDD)

**Files:**
- Modify: `frontend/tests/utils/ssrFetch.test.ts`

- [ ] **Step 1: Add tests for non-retriable cases**

Append:

```ts
  it.each([400, 401, 403, 404, 408, 422, 429, 500])(
    'status %i 일 때 재시도하지 않고 즉시 throw 한다',
    async (status) => {
      const httpErr = Object.assign(new Error(`HTTP ${status}`), { status })
      mockFetch.mockRejectedValue(httpErr)

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(ssrFetch('/api/foo', { retryDelayMs: 10 })).rejects.toMatchObject({ status })
      expect(mockFetch).toHaveBeenCalledTimes(1)

      errorSpy.mockRestore()
    },
  )

  it('AbortError(timeout 등)는 재시도하지 않는다', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    mockFetch.mockRejectedValue(abortErr)

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(ssrFetch('/api/foo', { retryDelayMs: 10 })).rejects.toMatchObject({ name: 'AbortError' })
    expect(mockFetch).toHaveBeenCalledTimes(1)

    errorSpy.mockRestore()
  })

  it('알 수 없는 에러 형태는 재시도하지 않는다 (보수적)', async () => {
    mockFetch.mockRejectedValue(new Error('unknown'))

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(ssrFetch('/api/foo', { retryDelayMs: 10 })).rejects.toThrow('unknown')
    expect(mockFetch).toHaveBeenCalledTimes(1)

    errorSpy.mockRestore()
  })
```

- [ ] **Step 2: Run — PASS**

```bash
cd frontend && npx vitest run tests/utils/ssrFetch.test.ts
```

Expected: 20 tests pass (10 + 8 from it.each + 2 단일).

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/utils/ssrFetch.test.ts
git commit -m "test(ssrFetch): non-retriable error matrix (4xx, 429, 500, AbortError)"
```

---

## Task 10: `ssrFetch` timeout abort (TDD)

**Files:**
- Modify: `frontend/tests/utils/ssrFetch.test.ts`

- [ ] **Step 1: Add timeout test**

Append:

```ts
  it('timeoutMs 초과 시 AbortError 로 reject 한다', async () => {
    let abortedFlag = false
    mockFetch.mockImplementation((_url: string, opts: { signal?: AbortSignal }) => {
      return new Promise((_, reject) => {
        opts.signal?.addEventListener('abort', () => {
          abortedFlag = true
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
        })
      })
    })

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const promise = ssrFetch('/api/slow', { timeoutMs: 100, retries: 0 })
    await vi.advanceTimersByTimeAsync(150)

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    expect(abortedFlag).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(1) // AbortError 는 재시도 안 함

    errorSpy.mockRestore()
  })
```

- [ ] **Step 2: Run — PASS**

```bash
cd frontend && npx vitest run tests/utils/ssrFetch.test.ts
```

Expected: 21 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/utils/ssrFetch.test.ts
git commit -m "test(ssrFetch): timeoutMs triggers AbortController signal"
```

---

## Task 11: `ssrFetch` backoff timing (TDD)

**Files:**
- Modify: `frontend/tests/utils/ssrFetch.test.ts`

- [ ] **Step 1: Add backoff timing test**

Append:

```ts
  it('재시도 간 지수 백오프 + 지터 (base 100 → 100~200ms, 200~400ms)', async () => {
    const connErr = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' })
    mockFetch
      .mockRejectedValueOnce(connErr)
      .mockRejectedValueOnce(connErr)
      .mockResolvedValueOnce({ ok: true })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const startTime = Date.now()
    const promise = ssrFetch('/api/foo', { retryDelayMs: 100, retries: 2 })

    // 첫 실패 후: 100 ≤ delay < 200 (base × 2^0 + jitter[0,base])
    await vi.advanceTimersByTimeAsync(200)
    // 두 번째 실패 후: 200 ≤ delay < 400 (base × 2^1 + jitter[0,base])
    await vi.advanceTimersByTimeAsync(400)

    const result = await promise
    expect(result).toEqual({ ok: true })
    expect(mockFetch).toHaveBeenCalledTimes(3)
    expect(warnSpy).toHaveBeenCalledTimes(2)

    warnSpy.mockRestore()
  })
```

- [ ] **Step 2: Run — PASS**

```bash
cd frontend && npx vitest run tests/utils/ssrFetch.test.ts
```

Expected: 22 tests pass.

- [ ] **Step 3: Commit**

```bash
git add frontend/tests/utils/ssrFetch.test.ts
git commit -m "test(ssrFetch): exponential backoff with jitter timing"
```

---

## Task 12: 통합 검증

**Files:** (검증 전용 — 변경 없음)

- [ ] **Step 1: 전체 frontend vitest 실행**

```bash
cd frontend && npm run test 2>&1 | tail -30
```

Expected: all tests PASS, no skipped errors. 신규 추가된 22+6+3 = 31개 테스트가 합산된 결과 표시.

- [ ] **Step 2: ESLint 통과 확인**

```bash
cd frontend && npm run lint 2>&1 | tail -20
```

Expected: no errors. (이번 PR엔 ESLint 룰 추가는 없음 — PR-C에서)

- [ ] **Step 3: 빌드 통과 확인**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: build success. 새 import 경로(`~/server/utils/internalApiBase`, `~/server/utils/ssrFetch`)가 정상 resolve 되어야 함.

- [ ] **Step 4: dev 서버 부팅 시 internalApiBase 로그 출력 확인 (수동)**

```bash
cd frontend && npm run dev &
sleep 8
curl -s http://localhost:3000/ > /dev/null
# 로그 확인
sleep 2
ps aux | grep "nuxt dev" | grep -v grep
```

기대 동작: `useApiBase()`가 어디서든 호출되면 부팅 로그가 나오는데, **PR-A 시점엔 아무도 useApiBase()를 server context에서 호출하지 않음** → 로그 0회 정상.

수동으로 internalApiBase가 동작하는지 확인하고 싶다면 dev server 안에서 server route 하나에서 호출해보는 테스트 가능 (skip 가능, PR-B에서 자연스럽게 검증됨).

`pkill -f "nuxt dev"`로 dev 서버 종료.

- [ ] **Step 5: 변경 파일 최종 리뷰**

```bash
git log --oneline develop..HEAD
git diff develop..HEAD --stat
```

Expected: 6~7개 커밋, 변경 파일:
- `frontend/nuxt.config.ts`
- `frontend/.env.example`
- `ecosystem.config.js`
- `frontend/composables/useApiBase.ts`
- `frontend/server/utils/internalApiBase.ts` (신규)
- `frontend/server/utils/ssrFetch.ts` (신규)
- `frontend/tests/composables/useApiBase.test.ts`
- `frontend/tests/utils/internalApiBase.test.ts` (신규)
- `frontend/tests/utils/ssrFetch.test.ts` (신규)

---

## Task 13: PR 생성

- [ ] **Step 1: 브랜치 push**

```bash
git push -u origin feat/internal-api-base-pr-a
```

- [ ] **Step 2: PR 본문 작성용 요약**

GitHub PR 생성 시 본문에 포함:

```markdown
## Goal

SSR 자기-도메인 호출 회로를 끊는 작업(PR-A/B/C 시리즈)의 1단계 인프라 PR.
이 PR만으로는 동작 변화 없음 — 새 컴포넌트가 어디서도 아직 호출되지 않는다.

## 변경 내용

- `runtimeConfig.internalApiBase` 추가
- `getInternalApiBase()` server util — boot log 포함
- `useApiBase()` SSR 분기 추가 (`import.meta.server` → `internalApiBase`)
- `ssrFetch()` 헬퍼 — connection error + 502/503/504만 재시도, AbortError/429/500은 즉시 throw
- `ecosystem.config.js`에 `NUXT_INTERNAL_API_BASE=http://127.0.0.1:8000` 추가

## 테스트

- vitest: 신규 테스트 28~30개
- 기존 테스트 회귀 없음

## 배포 체크리스트

- [ ] PR 머지 후 Cafe24 배포 워크플로우 실행
- [ ] 서버에서 `pm2 restart ilsangkit-web --update-env`
- [ ] `pm2 logs ilsangkit-web --lines 100 | grep internalApiBase` — `[internalApiBase] resolved: http://127.0.0.1:8000` 확인
- [ ] WARN 메시지(`falling back`)가 출력되면 env 미반영 → ecosystem 파일 확인

## 의존 / 후속

- 후속: PR-B (사이트맵 + middleware), PR-C (composable + 페이지 + ESLint)
- Spec: 로컬 `docs/superpowers/specs/2026-05-21-internal-api-base-ssr-resilience-design.md`
```

- [ ] **Step 3: CI 통과 + 리뷰 대기**

GitHub Actions `Test` 워크플로우 통과 확인.

리뷰 통과 시 머지 → 배포 → 부팅 로그 확인 → PR-B 시작.

---

## Self-Review Notes

**Spec coverage 매핑:**
- 스펙 §1 설정 레이어 → Task 1, 2, 3 ✓
- 스펙 §2-1 useApiBase 확장 → Task 5 ✓
- 스펙 §2-2 getInternalApiBase → Task 4 ✓ (boot log 포함)
- 스펙 §3 ssrFetch (정책 표 + 구현 + isRetriable) → Task 6-11 ✓
- 스펙 §6 테스트 — 신규 ssrFetch.test.ts + useApiBase.test 확장 → Task 4, 5, 6-11 ✓
- 스펙 §7 배포 절차 PR-A 부분 (env 반영, sanity check, 부팅 로그 확인) → Task 13 ✓

**스펙에서 PR-A 범위 밖이라 본 plan에서 다루지 않는 항목:**
- composable 호출부 교체 → PR-C
- 사이트맵 utils 변환 → PR-B
- ESLint 룰 추가 → PR-C
- `useFetch` 사용처 grep → PR-C
- 통합 smoke 검증 (`curl https://ilsangkit.co.kr/` 등) → PR-C 배포 후
