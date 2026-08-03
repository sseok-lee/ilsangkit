# 사이트맵 정적 사전생성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자식 sitemap을 크롤 타임에 DB로 동적 생성하지 않고, daily sync 때 디스크에 정적 XML로 구워두고 Nitro가 그 파일을 즉시 반환(없으면 동적 폴백)하게 만들어 Googlebot의 cold fanout 502/타임아웃을 제거한다.

**Architecture:** 별도 백엔드 스크립트 `generateSitemaps.ts`가 기존 Nitro 동적 라우트를 `?__regen=<token>`으로 순차 호출 → 응답을 `${SITEMAP_DIR}.tmp/`에 저장 → 개수 회귀 가드 통과 시 atomic rename으로 `${SITEMAP_DIR}/` 교체. Nitro의 sitemap 라우트 3종은 핸들러 맨 위에서 디스크 파일을 우선 반환하고, 파일이 없거나 regen 요청이면 기존 동적 로직으로 폴백한다. URL·XML 내용·robots.txt는 불변.

**Tech Stack:** Nuxt 3 / Nitro (h3) 프론트엔드, Express + TypeScript(ESM) 백엔드, Node 20 global fetch, Vitest, `node:fs/promises`.

**핵심 불변식:**
- URL 구조·파일명·robots.txt·`<loc>`/`lastmod`/`changefreq`/`priority` 모두 그대로.
- `SITEMAP_DIR` 미설정 시 reader는 항상 동적 폴백(= 오늘 동작). 로컬/CI에서 행동 변화 없음.
- `SITEMAP_REGEN_TOKEN` 미설정 시 regen 비활성(fail-safe).
- 모든 실패 모드(파일 없음/검증 실패/가드 거부/생성 에러) → 동적 폴백 또는 "어제 파일 유지". `runGeneration`은 실패를 **throw하지 않고 `{ok:false, error}` 반환** → "생성 실패 시 기존 유지" 운영 의미와 일치.

**스펙 대비 변경점 (외부 리뷰 반영):**
1. **regen 게이트는 쿼리(`?__regen=`)가 아니라 HTTP 헤더 `X-Sitemap-Regen-Token`** 으로 전달. 쿼리 토큰은 nginx access log/PM2 로그에 평문 노출될 수 있어 헤더로 변경. loopback 게이트는 nginx 프록시가 모든 요청을 127.0.0.1로 보여 무의미하므로 제외 — 시크릿 헤더 토큰이 단일 게이트. 토큰이 유출돼 외부가 호출해도 "오늘의 동적 라우트 1회 실행"과 동일 부하.
2. **PM2 env 주입은 `ecosystem.config.js`가 아니라 deploy.yml 셸에서 export.** 실측: deploy.yml은 `pm2 start .output/server/index.mjs --name ilsangkit-frontend`로 직접 기동하고 `pm2 reload ilsangkit-frontend --update-env`로 갱신 — `ecosystem.config.js`(이름도 `ilsangkit-web`로 다름)를 쓰지 않음. 따라서 ecosystem 편집은 프로덕션 frontend에 무효. 토큰은 deploy 셸 env로 주입해야 `--update-env`가 picks up.
3. **"atomic rename" 표현 정정:** 디렉토리 2-rename은 각 rename은 atomic이나 전체 교체엔 dir이 잠깐 사라지는 창이 있음. 폴백이 있어 비치명적이며, 그 창에서는 동적 폴백으로 강등. 문서/구현 모두 "기존 유지 + 짧은 교체 창은 동적 폴백"으로 기술(완전 atomic 필요 시 versioned dir + symlink 교체가 정석이나 YAGNI).

---

## File Structure

**신규**
- `frontend/server/utils/sitemapStatic.ts` — reader 측 디스크 서빙 유틸 (경로 매핑/sanitize, regen 판별, 파일 서빙).
- `frontend/tests/server/sitemapStatic.test.ts` — 위 유틸 단위 테스트.
- `backend/src/scripts/generateSitemaps.ts` — writer 측 생성 스크립트 (순수 헬퍼 + IO 오케스트레이터).
- `backend/__tests__/scripts/generateSitemaps.test.ts` — 순수 헬퍼 + 가드 + atomic swap 단위 테스트.

**수정**
- `frontend/server/routes/sitemap.xml.ts` — 핸들러 맨 위 early static-serve.
- `frontend/server/routes/sitemap/[...].ts` — query strip + early static-serve.
- `frontend/server/routes/sitemap/static.xml.ts` — 핸들러 맨 위 early static-serve.
- `frontend/nuxt.config.ts` — sitemap routeRules `swr` 제거.
- `.github/workflows/deploy.yml` — frontend reload 앞 env export + 워밍 뒤 생성 1회.
- `.github/workflows/sync-real-estate.yml` — sync 끝에 생성 스텝(+secret 마스킹) + zombie 패턴.

> `ecosystem.config.js`는 **수정하지 않는다** — deploy.yml이 그 파일을 쓰지 않고 직접 `pm2 start --name ilsangkit-frontend`로 기동하므로 무효. env는 deploy 셸에서 export.

**건드리지 않음:** `sitemapService.ts`, `facilityService.getAllIds()`, 백엔드 `/api/sitemap/*`, `sitemap.ts`(유틸), `sitemapPolicy.ts`.

---

## Task 1: reader 경로 매핑 + regen 판별 (순수 함수)

**Files:**
- Create: `frontend/server/utils/sitemapStatic.ts`
- Test: `frontend/tests/server/sitemapStatic.test.ts`

`event.path`는 query string을 포함할 수 있다(`/sitemap/toilet.xml?__regen=x`). 순수 함수로 분리해 h3 의존 없이 테스트한다.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/server/sitemapStatic.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { resolveSitemapFile, isRegenRequest } from '../../server/utils/sitemapStatic'

describe('resolveSitemapFile', () => {
  const DIR = '/srv/sitemaps'

  it('인덱스 경로를 파일로 매핑', () => {
    expect(resolveSitemapFile('/sitemap.xml', DIR)).toBe('/srv/sitemaps/sitemap.xml')
  })

  it('자식 경로를 서브디렉토리 파일로 매핑', () => {
    expect(resolveSitemapFile('/sitemap/toilet.xml', DIR)).toBe('/srv/sitemaps/sitemap/toilet.xml')
  })

  it('query string을 제거하고 매핑', () => {
    expect(resolveSitemapFile('/sitemap/toilet.xml?__regen=abc', DIR)).toBe('/srv/sitemaps/sitemap/toilet.xml')
  })

  it('.xml이 아니면 null', () => {
    expect(resolveSitemapFile('/sitemap/toilet', DIR)).toBeNull()
    expect(resolveSitemapFile('/robots.txt', DIR)).toBeNull()
  })

  it('경로 탈출(../) 시도는 null', () => {
    expect(resolveSitemapFile('/sitemap/../../etc/passwd.xml', DIR)).toBeNull()
    expect(resolveSitemapFile('/sitemap/%2e%2e/secret.xml', DIR)).toBeNull()
  })
})

// h3 getHeader/setHeader를 stub: 전달된 event.headers에서 헤더를 읽는다.
vi.mock('h3', () => ({
  getHeader: (event: { headers?: Record<string, string> }, name: string) => event.headers?.[name.toLowerCase()],
  setHeader: vi.fn(),
}))

// 헤더를 담은 최소 event
const ev = (headers: Record<string, string> = {}) => ({ headers }) as any

describe('isRegenRequest', () => {
  const ENV = process.env
  beforeEach(() => { process.env = { ...ENV } })
  afterEach(() => { process.env = ENV })

  it('토큰 일치 시 true', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest(ev({ 'x-sitemap-regen-token': 'secret123' }))).toBe(true)
  })

  it('토큰 불일치 시 false', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest(ev({ 'x-sitemap-regen-token': 'wrong' }))).toBe(false)
  })

  it('토큰 env 미설정 시 항상 false(regen 비활성)', () => {
    delete process.env.SITEMAP_REGEN_TOKEN
    expect(isRegenRequest(ev({ 'x-sitemap-regen-token': 'anything' }))).toBe(false)
  })

  it('헤더 없으면 false', () => {
    process.env.SITEMAP_REGEN_TOKEN = 'secret123'
    expect(isRegenRequest(ev({}))).toBe(false)
  })
})
```
> `vi.mock('h3')`는 파일 상단(import 위)에 hoist된다. Task 2에서 `tryServeStaticSitemap` 테스트 추가 시 이 mock의 `setHeader`(no-op)·`getHeader`를 그대로 활용한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/server/sitemapStatic.test.ts`
Expected: FAIL — `resolveSitemapFile`/`isRegenRequest` is not a function (모듈 없음).

- [ ] **Step 3: 최소 구현**

`frontend/server/utils/sitemapStatic.ts`:
```typescript
import { readFile } from 'node:fs/promises'
import { getHeader, setHeader, type H3Event } from 'h3'

/** regen 토큰을 전달하는 HTTP 헤더 (쿼리 노출 방지). */
export const REGEN_TOKEN_HEADER = 'x-sitemap-regen-token'

/** SITEMAP_DIR env. 미설정이면 빈 문자열 → 디스크 서빙 비활성(동적 폴백). */
export function getSitemapDir(): string {
  return (process.env.SITEMAP_DIR || '').replace(/\/+$/, '')
}

/** 요청 path(쿼리 포함 가능)를 SITEMAP_DIR 하위 파일 경로로 매핑. 안전하지 않으면 null. */
export function resolveSitemapFile(reqPath: string, dir: string): string | null {
  const pathname = reqPath.split('?')[0]
  if (!pathname.endsWith('.xml')) return null
  // 디코드 후 '..' 또는 비정상 문자 차단
  let decoded: string
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes('..') || decoded.includes('\0')) return null
  // 허용: /sitemap.xml, /sitemap/<name>.xml  (영숫자/하이픈만)
  if (!/^\/sitemap(\/[a-z0-9-]+)?\.xml$/.test(decoded)) return null
  return `${dir}${decoded}`
}

/** X-Sitemap-Regen-Token 헤더가 SITEMAP_REGEN_TOKEN과 일치하는지. 토큰 미설정 시 항상 false. */
export function isRegenRequest(event: H3Event): boolean {
  const token = process.env.SITEMAP_REGEN_TOKEN
  if (!token) return false
  return getHeader(event, REGEN_TOKEN_HEADER) === token
}

/**
 * 디스크에 사전생성된 sitemap이 있으면 그 내용을 반환(+content-type 설정), 없으면 null.
 * null 반환 시 호출부는 기존 동적 로직으로 폴백한다.
 */
export async function tryServeStaticSitemap(event: H3Event): Promise<string | null> {
  const dir = getSitemapDir()
  if (!dir) return null
  const filePath = resolveSitemapFile(event.path || '', dir)
  if (!filePath) return null
  try {
    const xml = await readFile(filePath, 'utf-8')
    setHeader(event, 'Content-Type', 'application/xml')
    setHeader(event, 'X-Sitemap-Source', 'static')
    return xml
  } catch {
    return null
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/server/sitemapStatic.test.ts`
Expected: PASS (모든 케이스).

- [ ] **Step 5: 커밋**

```bash
git add frontend/server/utils/sitemapStatic.ts frontend/tests/server/sitemapStatic.test.ts
git commit -m "feat(sitemap): 디스크 서빙 유틸(경로 매핑/regen 판별) 추가"
```

---

## Task 2: 라우트 3종에 디스크 우선 서빙 연결

**Files:**
- Modify: `frontend/server/routes/sitemap.xml.ts:23-24`
- Modify: `frontend/server/routes/sitemap/[...].ts:94-104`
- Modify: `frontend/server/routes/sitemap/static.xml.ts:40-41`
- Test: `frontend/tests/server/sitemapStatic.test.ts` (Task 1 파일에 통합 테스트 추가)

regen은 헤더(`X-Sitemap-Regen-Token`) 기반이라 쿼리가 붙지 않지만, `[...].ts`는 `event.path` 마지막 세그먼트를 `.endsWith('.xml')`로 검사하므로(`104`행) 혹시 모를 쿼리에 대비해 **query strip을 방어적으로** 먼저 적용한다. early static-serve가 헤더 regen이 아닐 때만 동작한다.

- [ ] **Step 1: 통합 테스트 작성 (디스크 우선 + 폴백)**

`frontend/tests/server/sitemapStatic.test.ts` 끝에 추가:
```typescript
import { vi } from 'vitest'
import * as fsp from 'node:fs/promises'
import { tryServeStaticSitemap } from '../../server/utils/sitemapStatic'

describe('tryServeStaticSitemap', () => {
  const ENV = process.env
  beforeEach(() => { process.env = { ...ENV }; vi.restoreAllMocks() })
  afterEach(() => { process.env = ENV })

  function fakeEvent(path: string) {
    const headers: Record<string, string> = {}
    return { path, node: { res: { setHeader: (k: string, v: string) => { headers[k] = v } } }, __headers: headers } as any
  }

  it('SITEMAP_DIR 미설정이면 null(동적 폴백)', async () => {
    delete process.env.SITEMAP_DIR
    expect(await tryServeStaticSitemap(fakeEvent('/sitemap/toilet.xml'))).toBeNull()
  })

  it('파일 있으면 내용 반환', async () => {
    process.env.SITEMAP_DIR = '/srv/sitemaps'
    vi.spyOn(fsp, 'readFile').mockResolvedValue('<?xml version="1.0"?><urlset/>' as any)
    const out = await tryServeStaticSitemap(fakeEvent('/sitemap/toilet.xml'))
    expect(out).toContain('<urlset')
  })

  it('파일 없으면(ENOENT) null(동적 폴백)', async () => {
    process.env.SITEMAP_DIR = '/srv/sitemaps'
    vi.spyOn(fsp, 'readFile').mockRejectedValue(Object.assign(new Error('no'), { code: 'ENOENT' }))
    expect(await tryServeStaticSitemap(fakeEvent('/sitemap/parking.xml'))).toBeNull()
  })
})
```
> 참고: `setHeader`(h3)는 `event.node.res.setHeader`를 호출하므로 fake event에 그 형태를 둔다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/server/sitemapStatic.test.ts`
Expected: FAIL — `tryServeStaticSitemap`의 `setHeader`가 fake event에서 동작하지 않거나 mock 미연결로 실패(아직 라우트 미수정이지만 이 단위 테스트는 유틸만 검증하므로, mock 형태가 맞으면 통과할 수도 있음 → 통과 시 Step 3로).

- [ ] **Step 3: `sitemap.xml.ts` 수정 (index)**

`frontend/server/routes/sitemap.xml.ts` 상단 import에 추가:
```typescript
import { isRegenRequest, tryServeStaticSitemap } from '../utils/sitemapStatic'
```
핸들러 본문 시작(`23`행 `export default defineEventHandler(async (event) => {` 직후, `setHeader`보다 먼저)에 삽입:
```typescript
  if (!isRegenRequest(event)) {
    const cached = await tryServeStaticSitemap(event)
    if (cached !== null) return cached
  }
```

- [ ] **Step 4: `[...].ts` 수정 (query strip + 자식 디스크 서빙)**

`frontend/server/routes/sitemap/[...].ts` 상단 import에 추가:
```typescript
import { isRegenRequest, tryServeStaticSitemap } from '../../utils/sitemapStatic'
```
핸들러 시작(`94`행 직후)에 디스크 서빙 + query strip 삽입. 기존 `95-97`행:
```typescript
  // URL path에서 slug 추출: /sitemap/wifi-1.xml → wifi-1
  const path = event.path || ''
  const lastSegment = path.split('/').pop() || ''
```
를 다음으로 교체:
```typescript
  if (!isRegenRequest(event)) {
    const cached = await tryServeStaticSitemap(event)
    if (cached !== null) return cached
  }

  // URL path에서 slug 추출 (query string 제거: ?__regen 등). /sitemap/wifi-1.xml → wifi-1
  const path = (event.path || '').split('?')[0]
  const lastSegment = path.split('/').pop() || ''
```

- [ ] **Step 5: `static.xml.ts` 수정**

`frontend/server/routes/sitemap/static.xml.ts` 상단 import에 추가:
```typescript
import { isRegenRequest, tryServeStaticSitemap } from '../../utils/sitemapStatic'
```
핸들러 시작(`40`행 직후, `setHeader`보다 먼저)에 삽입:
```typescript
  if (!isRegenRequest(event)) {
    const cached = await tryServeStaticSitemap(event)
    if (cached !== null) return cached
  }
```

- [ ] **Step 6: 전체 sitemap 테스트 통과 확인 (회귀 없음)**

Run: `cd frontend && npx vitest run tests/server/sitemap.test.ts tests/server/sitemapStatic.test.ts`
Expected: PASS — 기존 sitemap 테스트(폴백 경로 = 옛 동작) + 신규 테스트 모두 통과.

- [ ] **Step 7: 커밋**

```bash
git add frontend/server/routes/sitemap.xml.ts "frontend/server/routes/sitemap/[...].ts" frontend/server/routes/sitemap/static.xml.ts frontend/tests/server/sitemapStatic.test.ts
git commit -m "feat(sitemap): 라우트 3종 디스크 우선 서빙 + 동적 폴백"
```

---

## Task 3: sitemap routeRules의 SWR 제거

**Files:**
- Modify: `frontend/nuxt.config.ts:124-125`

디스크 읽기가 origin이 되어 무거운 이유가 사라졌고, regen 후 즉시 반영되려면 Nitro 레벨 SWR 캐시(최대 24h 잔존)를 없애야 한다.

- [ ] **Step 1: routeRules 수정**

`frontend/nuxt.config.ts`의 `124-125`행:
```typescript
      '/sitemap.xml': { swr: 86400 },
      '/sitemap/**': { swr: 86400 },
```
를 다음으로 교체(SWR 제거, 명시적 no-store는 두지 않고 라우트가 직접 서빙):
```typescript
      // sitemap은 디스크 정적 파일을 직접 서빙(없으면 동적 폴백)하므로 Nitro SWR 캐시 불필요.
      // SWR 유지 시 재생성 후에도 최대 24h 구버전이 잔존하므로 제거한다.
      '/sitemap.xml': { headers: { 'cache-control': 'public, max-age=3600' } },
      '/sitemap/**': { headers: { 'cache-control': 'public, max-age=3600' } },
```

- [ ] **Step 2: nuxt prepare로 설정 유효성 확인**

Run: `cd frontend && npx nuxi prepare`
Expected: 에러 없이 완료 (routeRules 타입 유효).

- [ ] **Step 3: 커밋**

```bash
git add frontend/nuxt.config.ts
git commit -m "perf(sitemap): SWR 제거 — 디스크 서빙으로 origin 비용 소멸, 재생성 즉시 반영"
```

---

## Task 4: 생성 스크립트의 순수 헬퍼 (파싱/카운트/가드)

**Files:**
- Create: `backend/src/scripts/generateSitemaps.ts` (헬퍼만 먼저, export)
- Test: `backend/__tests__/scripts/generateSitemaps.test.ts`

IO 없는 순수 함수부터 TDD로 만든다: 인덱스에서 자식 URL 추출, `<loc>` 개수 세기, 개수 회귀 가드 평가.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/scripts/generateSitemaps.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { parseChildLocs, countLocs, evaluateCountGuard } from '../../src/scripts/generateSitemaps.js'

describe('parseChildLocs', () => {
  it('sitemapindex에서 모든 <loc> 추출', () => {
    const xml = `<?xml version="1.0"?>
<sitemapindex>
  <sitemap><loc>https://ilsangkit.co.kr/sitemap/static.xml</loc></sitemap>
  <sitemap><loc>https://ilsangkit.co.kr/sitemap/toilet.xml</loc><lastmod>2026-06-10</lastmod></sitemap>
</sitemapindex>`
    expect(parseChildLocs(xml)).toEqual([
      'https://ilsangkit.co.kr/sitemap/static.xml',
      'https://ilsangkit.co.kr/sitemap/toilet.xml',
    ])
  })
})

describe('countLocs', () => {
  it('urlset의 <loc> 개수', () => {
    const xml = '<urlset><url><loc>a</loc></url><url><loc>b</loc></url></urlset>'
    expect(countLocs(xml)).toBe(2)
  })
  it('loc 없으면 0', () => {
    expect(countLocs('<urlset></urlset>')).toBe(0)
  })
})

describe('evaluateCountGuard', () => {
  const threshold = 0.2 // -20%
  it('첫 실행(old 비어있음)은 통과', () => {
    const r = evaluateCountGuard({}, { 'sitemap/toilet.xml': 100 }, threshold)
    expect(r.ok).toBe(true)
  })
  it('임계 이내 변동은 통과', () => {
    const r = evaluateCountGuard({ 'sitemap/toilet.xml': 100 }, { 'sitemap/toilet.xml': 85 }, threshold)
    expect(r.ok).toBe(true)
  })
  it('임계 초과 급감은 거부', () => {
    const r = evaluateCountGuard({ 'sitemap/toilet.xml': 100 }, { 'sitemap/toilet.xml': 50 }, threshold)
    expect(r.ok).toBe(false)
    expect(r.regressions).toContainEqual({ file: 'sitemap/toilet.xml', old: 100, next: 50 })
  })
  it('old에 있던 파일이 사라지면 거부', () => {
    const r = evaluateCountGuard({ 'sitemap/toilet.xml': 100 }, {}, threshold)
    expect(r.ok).toBe(false)
  })
  it('신규 파일(old 없음)은 통과 사유 아님', () => {
    const r = evaluateCountGuard({}, { 'sitemap/new.xml': 5 }, threshold)
    expect(r.ok).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/scripts/generateSitemaps.test.ts`
Expected: FAIL — 모듈/함수 없음.

- [ ] **Step 3: 헬퍼 구현 (파일 상단에)**

`backend/src/scripts/generateSitemaps.ts` (헬퍼 부분):
```typescript
/** sitemapindex XML에서 자식 sitemap의 <loc> URL 목록 추출 */
export function parseChildLocs(indexXml: string): string[] {
  const locs: string[] = []
  const re = /<loc>([^<]+)<\/loc>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(indexXml)) !== null) {
    locs.push(m[1].trim())
  }
  return locs
}

/** urlset/sitemapindex XML의 <loc> 개수 */
export function countLocs(xml: string): number {
  const matches = xml.match(/<loc>/g)
  return matches ? matches.length : 0
}

export interface CountGuardResult {
  ok: boolean
  regressions: { file: string; old: number; next: number }[]
}

/**
 * 직전 생성본(old) 대비 새 생성본(next)이 특정 파일에서 threshold 이상 급감하거나
 * old에 있던 파일이 사라지면 거부한다. old에 없던 신규 파일은 통과.
 */
export function evaluateCountGuard(
  oldCounts: Record<string, number>,
  nextCounts: Record<string, number>,
  threshold: number,
): CountGuardResult {
  const regressions: { file: string; old: number; next: number }[] = []
  for (const [file, old] of Object.entries(oldCounts)) {
    const next = nextCounts[file] ?? 0
    if (next < old * (1 - threshold)) {
      regressions.push({ file, old, next })
    }
  }
  return { ok: regressions.length === 0, regressions }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/scripts/generateSitemaps.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add backend/src/scripts/generateSitemaps.ts backend/__tests__/scripts/generateSitemaps.test.ts
git commit -m "feat(sitemap): 생성 스크립트 순수 헬퍼(파싱/카운트/회귀가드) + 테스트"
```

---

## Task 5: 생성 스크립트 IO 오케스트레이터 (fetch → tmp → atomic swap)

**Files:**
- Modify: `backend/src/scripts/generateSitemaps.ts`
- Test: `backend/__tests__/scripts/generateSitemaps.test.ts`

순수 헬퍼를 엮어 실제 생성을 수행하는 `runGeneration()`을 만든다. fetch와 SITEMAP_DIR을 주입 가능하게 해 tmp 디렉토리로 통합 테스트한다.

- [ ] **Step 1: 통합 테스트 작성**

`backend/__tests__/scripts/generateSitemaps.test.ts`에 추가:
```typescript
import { runGeneration } from '../../src/scripts/generateSitemaps.js'
import { mkdtemp, readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function mockFetcher(map: Record<string, string>) {
  return async (url: string, _headers?: Record<string, string>) => {
    const path = new URL(url).pathname
    const body = map[path]
    if (body === undefined) return { ok: false, status: 404, text: async () => '' }
    return { ok: true, status: 200, text: async () => body }
  }
}

const INDEX = `<?xml version="1.0"?><sitemapindex>
  <sitemap><loc>https://ilsangkit.co.kr/sitemap/static.xml</loc></sitemap>
  <sitemap><loc>https://ilsangkit.co.kr/sitemap/toilet.xml</loc></sitemap>
</sitemapindex>`
const STATIC = '<?xml version="1.0"?><urlset><url><loc>https://ilsangkit.co.kr/about</loc></url></urlset>'
const TOILET = '<?xml version="1.0"?><urlset><url><loc>https://ilsangkit.co.kr/toilet/1</loc></url><url><loc>https://ilsangkit.co.kr/toilet/2</loc></url></urlset>'

describe('runGeneration', () => {
  it('인덱스+자식을 디스크에 atomic 저장, .counts.json 기록', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'smap-'))
    const result = await runGeneration({
      dir,
      base: 'http://127.0.0.1:3000',
      token: 'tok',
      threshold: 0.2,
      fetcher: mockFetcher({
        '/sitemap.xml': INDEX,
        '/sitemap/static.xml': STATIC,
        '/sitemap/toilet.xml': TOILET,
      }),
    })
    expect(result.ok).toBe(true)
    expect(await readFile(join(dir, 'sitemap.xml'), 'utf-8')).toContain('<sitemapindex')
    expect(await readFile(join(dir, 'sitemap', 'toilet.xml'), 'utf-8')).toContain('/toilet/2')
    const counts = JSON.parse(await readFile(join(dir, '.counts.json'), 'utf-8'))
    expect(counts['sitemap/toilet.xml']).toBe(2)
  })

  it('자식 fetch 실패 시 교체 안 함(기존 유지)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'smap-'))
    await writeFile(join(dir, 'sitemap.xml'), '<existing/>')
    const result = await runGeneration({
      dir, base: 'http://127.0.0.1:3000', token: 'tok', threshold: 0.2,
      fetcher: mockFetcher({ '/sitemap.xml': INDEX /* 자식 없음 → 404 */ }),
    })
    expect(result.ok).toBe(false)
    expect(await readFile(join(dir, 'sitemap.xml'), 'utf-8')).toBe('<existing/>')
  })

  it('개수 회귀 가드 거부 시 교체 안 함', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'smap-'))
    await mkdir(join(dir, 'sitemap'), { recursive: true })
    await writeFile(join(dir, '.counts.json'), JSON.stringify({ 'sitemap/toilet.xml': 1000, 'sitemap/static.xml': 1 }))
    await writeFile(join(dir, 'sitemap', 'toilet.xml'), '<old-big/>')
    const result = await runGeneration({
      dir, base: 'http://127.0.0.1:3000', token: 'tok', threshold: 0.2,
      fetcher: mockFetcher({ '/sitemap.xml': INDEX, '/sitemap/static.xml': STATIC, '/sitemap/toilet.xml': TOILET }),
    })
    expect(result.ok).toBe(false)
    expect(result.regressions?.length).toBeGreaterThan(0)
    expect(await readFile(join(dir, 'sitemap', 'toilet.xml'), 'utf-8')).toBe('<old-big/>')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/scripts/generateSitemaps.test.ts`
Expected: FAIL — `runGeneration` 없음.

- [ ] **Step 3: 오케스트레이터 + CLI 엔트리 구현**

`backend/src/scripts/generateSitemaps.ts`에 추가(헬퍼 아래). **핵심: 예측 가능한 실패(fetch 실패·검증 실패·가드 거부)는 throw하지 않고 `{ok:false, error}`를 반환**해 "생성 실패 시 기존 파일 유지" 의미와 맞춘다. import는 실제로 쓰는 것만(`readdir` 등 미사용 import 금지 — 백엔드 `noUnusedLocals`로 빌드 실패):
```typescript
import { mkdir, writeFile, readFile, rm, rename } from 'node:fs/promises'
import { join, dirname } from 'node:path'

type Fetcher = (url: string, headers: Record<string, string>) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>

export interface GenerationOptions {
  dir: string
  base: string
  token: string
  threshold: number
  fetcher?: Fetcher
}

export interface GenerationResult extends CountGuardResult {
  error?: string
}

const REGEN_TOKEN_HEADER = 'X-Sitemap-Regen-Token'

/** loc URL → SITEMAP_DIR 기준 상대 파일 경로. https://host/sitemap/toilet.xml → sitemap/toilet.xml */
function locToRelPath(loc: string): string {
  return new URL(loc).pathname.replace(/^\/+/, '')
}

function isValidXml(body: string): boolean {
  return body.trimStart().startsWith('<?xml')
}

export async function runGeneration(opts: GenerationOptions): Promise<GenerationResult> {
  const fetcher: Fetcher = opts.fetcher ?? ((url, headers) => fetch(url, { headers }) as unknown as ReturnType<Fetcher>)
  const headers = { [REGEN_TOKEN_HEADER]: opts.token }
  const fail = (error: string): GenerationResult => ({ ok: false, regressions: [], error })

  const tmp = `${opts.dir}.tmp`
  await rm(tmp, { recursive: true, force: true })
  await mkdir(tmp, { recursive: true })

  // 1) 인덱스
  const idxRes = await fetcher(`${opts.base}/sitemap.xml`, headers)
  if (!idxRes.ok) { await rm(tmp, { recursive: true, force: true }); return fail(`index fetch failed: ${idxRes.status}`) }
  const indexXml = await idxRes.text()
  if (!isValidXml(indexXml)) { await rm(tmp, { recursive: true, force: true }); return fail('index not valid xml') }

  const nextCounts: Record<string, number> = { 'sitemap.xml': countLocs(indexXml) }
  const files: { rel: string; body: string }[] = [{ rel: 'sitemap.xml', body: indexXml }]

  // 2) 자식들 — 순차(동시성 1)
  for (const loc of parseChildLocs(indexXml)) {
    const rel = locToRelPath(loc)
    const res = await fetcher(`${opts.base}${new URL(loc).pathname}`, headers)
    if (!res.ok) { await rm(tmp, { recursive: true, force: true }); return fail(`child fetch failed ${rel}: ${res.status}`) }
    const body = await res.text()
    if (!isValidXml(body)) { await rm(tmp, { recursive: true, force: true }); return fail(`child not valid xml: ${rel}`) }
    nextCounts[rel] = countLocs(body)
    files.push({ rel, body })
  }

  // 3) tmp에 기록
  for (const f of files) {
    const dest = join(tmp, f.rel)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, f.body, 'utf-8')
  }

  // 4) 개수 회귀 가드
  let oldCounts: Record<string, number> = {}
  try {
    oldCounts = JSON.parse(await readFile(join(opts.dir, '.counts.json'), 'utf-8'))
  } catch { /* 첫 실행 */ }

  const force = process.env.SITEMAP_FORCE_SWAP === '1'
  const guard = evaluateCountGuard(oldCounts, nextCounts, opts.threshold)
  if (!guard.ok && !force) {
    await rm(tmp, { recursive: true, force: true })
    return guard
  }

  await writeFile(join(tmp, '.counts.json'), JSON.stringify(nextCounts, null, 2), 'utf-8')

  // 5) 교체: dir → dir.old → 삭제, tmp → dir.
  // 각 rename은 atomic이나 두 rename 사이에 dir이 잠깐 사라지는 창이 있다.
  // 그 창에 들어온 요청은 reader가 동적 폴백으로 강등하므로 안전하다(완전 atomic 아님).
  const old = `${opts.dir}.old`
  await rm(old, { recursive: true, force: true })
  try {
    await rename(opts.dir, old)
  } catch { /* dir 없음(첫 실행) */ }
  await rename(tmp, opts.dir)
  await rm(old, { recursive: true, force: true })

  return guard
}

// --- CLI 엔트리 ---
const isMain = process.argv[1] && process.argv[1].endsWith('generateSitemaps.js')
if (isMain) {
  const dir = process.env.SITEMAP_DIR
  const token = process.env.SITEMAP_REGEN_TOKEN
  const base = process.env.SITEMAP_REGEN_BASE || 'http://127.0.0.1:3000'
  const threshold = Number(process.env.SITEMAP_COUNT_DROP_THRESHOLD || '0.2')
  if (!dir || !token) {
    console.error('[generateSitemaps] SITEMAP_DIR / SITEMAP_REGEN_TOKEN 필요 — 생성 생략')
    process.exit(1)
  }
  runGeneration({ dir, token, base, threshold })
    .then((r) => {
      if (!r.ok) {
        console.error('[generateSitemaps] 실패/거부 — 기존 sitemap 유지:', r.error || JSON.stringify(r.regressions))
        process.exit(2)
      }
      console.log('[generateSitemaps] 완료 — 디스크 sitemap 갱신')
    })
    .catch((err) => {
      // 예기치 못한 IO 예외만 여기로 — 역시 기존 파일은 보존됨(tmp만 손상)
      console.error('[generateSitemaps] 예외 — 기존 sitemap 유지:', err?.message || err)
      process.exit(3)
    })
}
```
> 모든 예측 가능한 실패는 `tmp` 정리 후 `{ok:false, error}` 반환 → 기존 `dir`은 손대지 않음. Task 5 테스트의 `expect(result.ok).toBe(false)` 가정과 일치.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/scripts/generateSitemaps.test.ts`
Expected: PASS (모든 케이스).

- [ ] **Step 5: 빌드 확인 (ESM 컴파일)**

Run: `cd backend && npm run build`
Expected: 에러 없이 `dist/scripts/generateSitemaps.js` 생성.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/scripts/generateSitemaps.ts backend/__tests__/scripts/generateSitemaps.test.ts
git commit -m "feat(sitemap): 생성 스크립트 IO 오케스트레이터(fetch→tmp→atomic swap+가드)"
```

---

## Task 6: 환경변수 + 워크플로우 트리거 연결

**Files:**
- Modify: `.github/workflows/deploy.yml` (frontend reload 앞 env export + 워밍 뒤 생성)
- Modify: `.github/workflows/sync-real-estate.yml` (생성 스텝 + zombie 패턴)

설정·CI 변경이라 자동 테스트보다 수동 검증 중심. `SITEMAP_REGEN_TOKEN`은 운영 시크릿 — 실제 값은 **GH Secret**에 두고 코드엔 `${{ secrets.* }}` 참조만.

**중요(외부 리뷰 반영):** 실측 결과 deploy.yml은 `ecosystem.config.js`를 쓰지 않고 `pm2 start .output/server/index.mjs --name ilsangkit-frontend`로 직접 기동하며 `pm2 reload ilsangkit-frontend --update-env`(deploy.yml:137)로 갱신한다. 따라서 **frontend(reader)가 토큰을 받으려면 deploy 셸에서 export 한 뒤 `--update-env`가 그 env를 주입**해야 한다. ecosystem.config.js 편집은 프로덕션에 무효이므로 하지 않는다. (regen은 헤더 `X-Sitemap-Regen-Token` 기반이므로 토큰이 쿼리/로그에 남지 않음.)

- [ ] **Step 1: deploy.yml — frontend reload 앞에 env export**

`.github/workflows/deploy.yml`에서 frontend 블록(`pm2 describe ilsangkit-frontend`, `135`행 부근) **바로 앞**에 삽입. 이 export는 같은 SSH 스크립트 블록의 이후(reload + 워밍 + 생성)까지 유지된다:
```bash
            # 사이트맵 정적 서빙: reader(frontend)와 생성 스크립트가 쓰는 env.
            # --update-env 가 이 셸 env 를 frontend 프로세스에 주입하므로 reload 전에 export.
            export SITEMAP_DIR="/home/project2/sitemaps"
            set +x   # 토큰 로그 노출 방지 (이미 set -x 라면)
            export SITEMAP_REGEN_TOKEN="${{ secrets.SITEMAP_REGEN_TOKEN }}"
            set -x
            export SITEMAP_REGEN_BASE="http://127.0.0.1:3000"
```
> deploy.yml에 `set -x`가 없으면 `set +x`/`set -x` 두 줄은 생략 가능(있으면 유지). `pm2 reload ilsangkit-frontend --update-env`(137행)가 이 토큰을 frontend에 주입한다.

- [ ] **Step 2: deploy.yml — 워밍 루프 뒤 생성 1회**

`[warmup] sitemap 워밍 완료`(약 `205`행) 직후에 추가. Step 1의 export가 이미 이 셸에 살아 있으므로 재선언 불필요(경로만 보장):
```bash
            # 배포 직후 1회 정적 sitemap 생성 (첫 롤아웃·SITEMAP_DIR 비어있을 때 대비).
            # SITEMAP_DIR 은 배포에 지워지지 않으므로 평소엔 이미 채워져 있고, 여기선 최신화 목적.
            # 실패/가드거부 시 비제로 exit 하지만 기존 파일은 보존되므로 배포는 실패시키지 않는다.
            echo "[deploy] 사이트맵 정적 생성"
            ( cd /home/project2/backend && timeout --kill-after=30s 10m node dist/scripts/generateSitemaps.js ) \
              || echo "[WARN] 배포 후 사이트맵 생성 실패/스킵 (exit=$?)"
```

- [ ] **Step 3: sync 워크플로우 — 생성 스텝 추가**

`.github/workflows/sync-real-estate.yml`의 `[step:google-indexing-end]` 직후, `좀비 청소`(`[step:post-kill]`) **앞**에 추가. 이 워크플로우는 `set -x`(28행)이므로 토큰 export는 반드시 `set +x`로 감싼다:
```bash
            # --- 사이트맵 정적 파일 재생성 -------------------------------
            # 동기화로 데이터가 갱신됐으니 디스크 sitemap 을 새로 굽는다.
            # 실패/가드거부 시 기존 파일 유지(크롤러 영향 없음).
            echo "[step:sitemap-gen-start]"
            echo "--- 사이트맵 정적 재생성 ---"
            export SITEMAP_DIR="/home/project2/sitemaps"
            export SITEMAP_REGEN_BASE="http://127.0.0.1:3000"
            set +x
            export SITEMAP_REGEN_TOKEN="${{ secrets.SITEMAP_REGEN_TOKEN }}"
            set -x
            timeout --kill-after=30s 10m node dist/scripts/generateSitemaps.js \
              || echo "[WARN] 사이트맵 재생성 실패/스킵 (exit=$?)"
            echo "[step:sitemap-gen-end]"
```
> 이 블록은 다른 sync 스텝과 동일한 `cd backend` 컨텍스트(`dist/scripts/...` 경로 유효) 안에 있어야 한다.

- [ ] **Step 4: sync 워크플로우 — zombie 방어선에 생성 스크립트 추가**

`kill_sync_zombies()`(약 `39`행) 내부의 프로세스 패턴 목록에 `generateSitemaps`도 포함시킨다(SSH 중단 시 잔여 프로세스 정리). 기존 함수가 `pkill -f "dist/scripts/sync"` 류 패턴을 쓰면 `dist/scripts/generateSitemaps` 패턴을 한 줄 추가:
```bash
              pkill -f "dist/scripts/generateSitemaps" 2>/dev/null || true
```
> 기존 패턴 스타일(예: 특정 스크립트명 나열 vs 와일드카드)에 맞춰 추가. 와일드카드(`dist/scripts/`)로 이미 커버되면 변경 불필요 — 함수 본문 확인 후 결정.

- [ ] **Step 5: 사람 작업 체크리스트 (시크릿/디렉토리) — PR 노트에 기재**

코드 외 운영 작업(머지/배포 전):
1. GitHub repo Secrets에 `SITEMAP_REGEN_TOKEN` 추가(랜덤 32+ 문자).
2. 서버 `/home/project2/sitemaps` 디렉토리 생성 + frontend/backend 프로세스 쓰기·읽기 권한 확인.
3. 첫 배포 시 deploy.yml의 `--update-env`가 토큰을 주입하는지 확인(`pm2 env <id> | grep SITEMAP`). 만약 frontend가 ecosystem이 아닌 다른 방식으로 떠 있어 `--update-env`가 안 먹으면 `pm2 restart ilsangkit-frontend --update-env`를 export 이후 1회 수동 실행.
4. **프로세스명 불일치 확인:** `ecosystem.config.js`는 `ilsangkit-web`/`ilsangkit-api`, deploy.yml은 `ilsangkit-frontend`/`ilsangkit-backend`. 실제 `pm2 list`로 운영 프로세스명을 확인하고, 토큰이 그 프로세스에 들어갔는지 검증.

- [ ] **Step 6: YAML 문법 검증**

Run: `cd /Users/leemyeongseok/projects/ilsangkit && python3 -c "import yaml; [yaml.safe_load(open(f)) for f in ['.github/workflows/sync-real-estate.yml','.github/workflows/deploy.yml']]; print('yaml ok')"`
Expected: `yaml ok`.

- [ ] **Step 7: 커밋**

```bash
git add .github/workflows/sync-real-estate.yml .github/workflows/deploy.yml
git commit -m "chore(sitemap): deploy 셸 env 주입 + sync·deploy 생성 트리거(secret 마스킹)"
```

---

## Task 7: 전체 검증 + 로컬 동치 확인 + PR

**Files:** 없음 (검증/통합)

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd backend && npm run test`
Expected: PASS (신규 generateSitemaps 포함, 회귀 없음).

- [ ] **Step 2: 프론트 전체 테스트 + lint**

Run: `cd frontend && npm run test && npm run lint`
Expected: PASS.

- [ ] **Step 3: 로컬 동치 검증 (동적 vs 디스크 byte-diff)**

로컬에서 백엔드(8000)+프론트(3000)를 띄운 상태에서:
```bash
# 1) 동적 출력 저장 (regen 우회 없이 현재 동작)
curl -s "http://localhost:3000/sitemap/toilet.xml" > /tmp/dyn-toilet.xml
# 2) SITEMAP_DIR 설정 후 생성 스크립트로 디스크 파일 굽기
export SITEMAP_DIR=/tmp/smap SITEMAP_REGEN_TOKEN=localtok SITEMAP_REGEN_BASE=http://localhost:3000
cd backend && node dist/scripts/generateSitemaps.js
# 3) 디스크 파일 vs 동적 출력 비교
diff <(cat /tmp/smap/sitemap/toilet.xml) /tmp/dyn-toilet.xml && echo "IDENTICAL"
```
Expected: `IDENTICAL` (또는 lastmod 날짜만 차이 — 생성 시점 today 차이는 허용, `<loc>` 목록은 동일해야 함).
> 주의: 로컬 Nitro에 `SITEMAP_REGEN_TOKEN=localtok`이 설정돼 있어야 regen이 동적 경로를 탄다. 안 되면 `isRegenRequest`가 false라 디스크(빈 상태)를 읽어 폴백 → 동적. 토큰 일치 시 강제 동적.

- [ ] **Step 4: 디스크 우선 서빙 동작 확인**

`/tmp/smap`이 채워진 상태에서 Nitro에 `SITEMAP_DIR=/tmp/smap`로 재기동 후:
```bash
curl -sI "http://localhost:3000/sitemap/toilet.xml" | grep -i x-sitemap-source
```
Expected: `x-sitemap-source: static` (디스크 서빙 확인). 파일 삭제 후 다시 호출하면 헤더 없음(동적 폴백).

- [ ] **Step 5: PR 생성 (develop 타겟)**

```bash
git push -u origin feat/sitemap-static-pregeneration
gh pr create --base develop --head feat/sitemap-static-pregeneration \
  --title "feat: 사이트맵 정적 사전생성 — Googlebot cold fanout 502 제거" \
  --body "스펙: docs/superpowers/specs/2026-06-11-sitemap-static-pregeneration-design.md (로컬)

## 배경
GSC에서 /sitemap.xml 인덱스는 성공이나 '읽은 사이트맵' 0행 — 자식 sitemap이 크롤 타임 동적 DB 생성(부동산 6-테이블 UNION cold 8~11s)이라 Googlebot 동시 fetch 시 502/타임아웃 → 자식 미수집. 네이버는 정상.

## 변경
- Nitro sitemap 라우트 3종: 디스크 정적 파일 우선 서빙 + 동적 폴백
- backend generateSitemaps.ts: daily sync/배포 때 ?__regen으로 정적 XML 생성(atomic swap + 개수 회귀 가드)
- SWR 제거, SITEMAP_DIR/TOKEN env, sync·deploy 트리거

## 불변
URL·XML·robots.txt 그대로. 재등록 불필요. 모든 실패 → 동적 폴백/어제 파일 유지. 네이버 무영향.

## 배포 전 사람 작업
- GH Secret SITEMAP_REGEN_TOKEN 등록 + 서버 PM2 env 동기화 (Task 6 Step 5)"
```
Expected: PR 생성, CI 트리거.

- [ ] **Step 6: CI green 확인 후 머지**

Run: `gh pr checks --watch`
Expected: 모든 체크 통과. 통과 후 develop 머지(스쿼시).

---

## Self-Review

**1. Spec coverage:**
- 정적 사전생성 + 디스크 서빙 → Task 1,2,5 ✓
- 폴백 동적 → Task 2 (SITEMAP_DIR 미설정/파일 없음) ✓
- `?__regen` 게이트 → Task 1 (토큰), 스펙의 loopback은 의도적 제외(헤더에 사유 명시) ✓
- atomic rename → Task 5 ✓
- 개수 회귀 가드 → Task 4,5 ✓
- SWR 제거 → Task 3 ✓
- env/workflow 트리거 → Task 6 ✓
- 로컬 byte-diff 동치 검증 → Task 7 Step 3 ✓
- 테스트 전략(단위/회귀) → Task 1,2,4,5,7 ✓
- 성공지표/롤백은 운영 항목(스펙 7,8장) — 코드 작업 아님, PR 노트로 위임 ✓

**2. Placeholder scan:** 모든 코드 스텝에 실제 코드/명령/기대출력 포함. TBD/TODO 없음. 시크릿만 env/Secret로 위임(의도적, placeholder 아님).

**3. Type consistency:**
- `resolveSitemapFile(reqPath, dir)`, `isRegenRequest({path})`, `tryServeStaticSitemap(event): string|null` — Task 1 정의 = Task 2 사용 일치 ✓
- `parseChildLocs`/`countLocs`/`evaluateCountGuard(old,next,threshold)→{ok,regressions}` — Task 4 정의 = Task 5 사용 일치 ✓
- `runGeneration(opts)→CountGuardResult`, opts `{dir,base,token,threshold,fetcher}` — Task 5 정의 = 테스트 사용 일치 ✓
- `locToRelPath` → `sitemap/toilet.xml`, reader `resolveSitemapFile` → `${dir}/sitemap/toilet.xml` — 동일 경로 규약 ✓
