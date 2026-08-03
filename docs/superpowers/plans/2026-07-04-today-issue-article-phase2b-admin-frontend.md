# 오늘의 이슈(/article) — Phase 2b: 어드민 프론트엔드 (로그인 + 대시보드) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Phase 2a의 어드민 백엔드(`/api/admin/*`)를 소비하는 **프론트 어드민 UI**를 구축한다 — 로그인 페이지, 초안 큐/검토/편집/발행 대시보드, 클라이언트 전용 인증 가드 미들웨어, robots.txt Disallow, Playwright E2E.

**Architecture:** 브라우저의 어드민 요청은 **same-origin `/api/admin/*`** 로 나가 Nitro `/api/**` proxy(`nuxt.config.ts:75`, h3 `proxyRequest`)를 통해 백엔드로 전달된다 — 이 프록시는 `Cookie`/`Set-Cookie`를 그대로 왕복시키므로 host-scoped `SameSite=Strict` `admin_session` 쿠키가 정상 동작한다. **핵심 제약: 어드민 fetch는 `useApiBase()`(브라우저에서 `''`=same-origin 반환)를 써야 하고, 인증 가드는 클라이언트 전용**(SSR loopback 호출은 브라우저 쿠키를 전달하지 않음)이어야 한다. 마크다운 미리보기는 `guide/[slug].vue`의 `marked`+`isomorphic-dompurify`+prose 블록을 재사용.

**Tech Stack:** Nuxt 3(SSR), Vue 3 `<script setup>`, TailwindCSS(+@tailwindcss/typography prose), `marked`+`isomorphic-dompurify`(설치됨), Vitest(happy-dom), Playwright.

## Global Constraints

- **Node 20 필수** — 모든 `npm`/`npx`/`vitest`/`playwright` 전에 `source ~/.nvm/nvm.sh && nvm use 20`. 시스템 기본 v25.5.0.
- **package-lock.json 삭제·재생성 금지.** 이 Phase는 **신규 의존성 없음**(marked/dompurify/@playwright 모두 설치됨) — `npm install` 실행 금지.
- **테스트는 `cd frontend`.** ESM.
- **SSR 가드 필수**: 브라우저 API(`document`/`window`)·쿠키 의존 로직은 `if (import.meta.server) return`로 클라이언트 가드. 인증 미들웨어는 클라이언트 전용.
- **어드민 fetch는 반드시 `useApiBase()` 사용**(`useRuntimeConfig().public.apiBase` 직접 사용 금지) → 브라우저에서 same-origin으로 나가 쿠키가 프록시를 통해 흐르게. `$fetch`는 same-origin에 쿠키 자동 전송(방어적으로 `{ credentials: 'include' }` 허용).
- **어드민 페이지는 `noindex,nofollow`**(`useSeoMeta({ robots: 'noindex, nofollow' })`) + `definePageMeta({ layout: false })`(사이트 크롬 없는 독립 화면) + robots.txt `Disallow: /admin`. 사이트맵엔 자동 미포함(명시 allowlist라 /admin 없음).
- 백엔드 응답 봉투는 `{ success, data }`. 에러는 `$fetch`가 throw(`err.data`/`err.status`) → UI에서 사용자 메시지 표시.
- 상태 변경 요청은 백엔드가 Origin 검사(CSRF) — same-origin이라 자동 통과. 별도 처리 불필요.

---

## File Structure

- **Create** `frontend/composables/useAdminAuth.ts` — login/logout/checkSession.
- **Create** `frontend/composables/useAdminArticles.ts` — list/get/update/publish/unpublish/reject/delete/generate/regenerate.
- **Create** `frontend/middleware/admin.ts` — 클라이언트 전용 인증 가드.
- **Create** `frontend/pages/admin/login.vue` — 로그인 폼.
- **Create** `frontend/pages/admin/index.vue` — 초안 큐 + 검토/편집/액션 대시보드.
- **Create** `frontend/components/admin/AdminArticleCard.vue`, `frontend/components/admin/AdminArticleEditor.vue` — 큐 카드 / 상세 편집·미리보기(대시보드 분해).
- **Modify** `frontend/public/robots.txt` — `Disallow: /admin` (Yeti + `*`).
- **Create** tests: `frontend/tests/composables/useAdminAuth.test.ts`, `useAdminArticles.test.ts`, `frontend/tests/middleware/admin.test.ts`, `frontend/tests/pages/admin-login.test.ts`, `frontend/tests/pages/admin-index.test.ts`, `frontend/tests/e2e/admin.spec.ts`.

---

## Task 1: 어드민 composables (useAdminAuth + useAdminArticles) — TDD

**Files:** Create both composables + `frontend/tests/composables/useAdminAuth.test.ts`, `useAdminArticles.test.ts`.

**Interfaces — Produces:**
- `useAdminAuth()` → `{ login(password):Promise<void>, logout():Promise<void>, checkSession():Promise<boolean> }`.
- `useAdminArticles()` → `{ list(params):Promise<Paginated>, get(id), update(id,patch), publish(id), unpublish(id), reject(id), remove(id), generate(body?), regenerate(id) }`.
- Types: `AdminArticleSummary`, `AdminArticleDetail`, `AdminArticleStatus = 'draft'|'published'|'rejected'`.

- [ ] **Step 1: 실패 테스트 — useAdminAuth** (`frontend/tests/composables/useAdminAuth.test.ts`)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAdminAuth } from '../../composables/useAdminAuth';

beforeEach(() => { vi.mocked($fetch).mockReset?.(); });

describe('useAdminAuth', () => {
  it('login: POST /api/admin/login with password', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { authenticated: true } });
    await useAdminAuth().login('secret');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/login');
    expect(opts).toMatchObject({ method: 'POST', body: { password: 'secret' } });
  });
  it('checkSession: true on 200, false on throw(401)', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { authenticated: true } });
    expect(await useAdminAuth().checkSession()).toBe(true);
    vi.mocked($fetch).mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }));
    expect(await useAdminAuth().checkSession()).toBe(false);
  });
  it('logout: POST /api/admin/logout', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: {} });
    await useAdminAuth().logout();
    expect(vi.mocked($fetch).mock.calls[0][0]).toContain('/api/admin/logout');
  });
});
```

- [ ] **Step 2: RED** — `source ~/.nvm/nvm.sh && nvm use 20 && cd frontend && npx vitest run tests/composables/useAdminAuth.test.ts` → FAIL.

- [ ] **Step 3: `useAdminAuth.ts` 구현**

```ts
export function useAdminAuth() {
  const apiBase = useApiBase();
  async function login(password: string): Promise<void> {
    await $fetch(`${apiBase}/api/admin/login`, { method: 'POST', body: { password }, credentials: 'include' });
  }
  async function logout(): Promise<void> {
    await $fetch(`${apiBase}/api/admin/logout`, { method: 'POST', credentials: 'include' }).catch(() => {});
  }
  async function checkSession(): Promise<boolean> {
    try {
      await $fetch(`${apiBase}/api/admin/session`, { credentials: 'include' });
      return true;
    } catch {
      return false;
    }
  }
  return { login, logout, checkSession };
}
```

- [ ] **Step 4: 실패 테스트 — useAdminArticles** (`tests/composables/useAdminArticles.test.ts`) — 케이스: `list` → `GET /api/admin/articles?...`(status/category/page/limit 쿼리)·`res.data` 반환; `publish(id)` → `POST /api/admin/articles/:id/publish`; `update(id, patch)` → `PATCH /api/admin/articles/:id` body=patch; `remove(id)` → `DELETE /api/admin/articles/:id`; `generate(body)` → `POST /api/admin/articles/generate`; `regenerate(id)` → `POST /api/admin/articles/:id/regenerate`. 각기 `{success,data}` 언랩. RED 확인.

- [ ] **Step 5: `useAdminArticles.ts` 구현** — `useGuides.ts` 미러(타입 상단, `const apiBase = useApiBase()`, `$fetch<{success,data:T}>` 후 `res.data`, 함수 객체 반환). 모든 호출에 `credentials:'include'`. `list`은 쿼리스트링 조립(`URLSearchParams`). 변경계열은 `method` 지정.

- [ ] **Step 6: GREEN** — 두 테스트 파일 통과. **Step 7: 커밋**
```bash
cd frontend && git add composables/useAdminAuth.ts composables/useAdminArticles.ts tests/composables/useAdminAuth.test.ts tests/composables/useAdminArticles.test.ts
git commit -m "feat(admin-ui): 어드민 인증·기사 composable (same-origin, 쿠키 왕복)"
```

---

## Task 2: 인증 가드 미들웨어 + 로그인 페이지 + robots — TDD

**Files:** Create `frontend/middleware/admin.ts`, `frontend/pages/admin/login.vue`, `frontend/tests/middleware/admin.test.ts`, `frontend/tests/pages/admin-login.test.ts`; Modify `frontend/public/robots.txt`.

**Interfaces — Consumes:** `useAdminAuth().checkSession/login`. Produces: `admin` named route middleware; `/admin/login` 페이지.

- [ ] **Step 1: 실패 테스트 — 미들웨어** (`tests/middleware/admin.test.ts`)
  - `import.meta.server`일 때 즉시 return(무동작). (테스트에서 `import.meta.server` 스텁 어려우면 클라이언트 경로만 검증.)
  - 클라이언트: `checkSession()` false면 `navigateTo('/admin/login')` 호출; true면 통과(undefined 반환). `useAdminAuth`를 `vi.mock`으로 스텁, `navigateTo`를 전역 스텁(설정 필요 — setup.ts에 없으면 테스트 로컬 `vi.stubGlobal('navigateTo', fn)`).

- [ ] **Step 2: RED** → FAIL.

- [ ] **Step 3: `middleware/admin.ts` 구현**
```ts
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return; // SSR loopback엔 브라우저 쿠키가 없음 — 클라이언트에서만 검사
  const ok = await useAdminAuth().checkSession();
  if (!ok) return navigateTo('/admin/login');
});
```

- [ ] **Step 4: 실패 테스트 — 로그인 페이지** (`tests/pages/admin-login.test.ts`, `@vue/test-utils` mount) — 비밀번호 입력+제출 시 `useAdminAuth().login(pw)` 호출; 성공 시 `navigateTo('/admin')`; 실패(throw) 시 에러 메시지 노출. `useAdminAuth` 스텁.

- [ ] **Step 5: RED** → FAIL.

- [ ] **Step 6: `pages/admin/login.vue` 구현** — `<script setup>`: `definePageMeta({ layout: false })`, `useSeoMeta({ robots: 'noindex, nofollow', title: '어드민 로그인' })`, `const password = ref('')`, `const error = ref('')`, `const loading = ref(false)`, `onSubmit`이 `await useAdminAuth().login(password.value)` → 성공 `navigateTo('/admin')`, catch 시 `error.value = '비밀번호가 올바르지 않거나 로그인할 수 없습니다'`. 최소 중앙 정렬 폼(Tailwind), 비밀번호 input(type=password)·제출 버튼·에러 표시.

- [ ] **Step 7: GREEN**(미들웨어+로그인).

- [ ] **Step 8: robots.txt에 Disallow 추가** — `frontend/public/robots.txt`의 **Yeti 블록**(line 13 `Disallow: /*_payload.json` 뒤)과 **`User-agent: *` 블록**(line 23 뒤) 양쪽에 `Disallow: /admin` 추가.

- [ ] **Step 9: 커밋**
```bash
cd frontend && git add middleware/admin.ts pages/admin/login.vue public/robots.txt tests/middleware/admin.test.ts tests/pages/admin-login.test.ts
git commit -m "feat(admin-ui): 클라이언트 인증 가드 + 로그인 페이지 + robots Disallow /admin"
```

---

## Task 3: 어드민 대시보드 (초안 큐 + 검토/편집/액션) — TDD

**Files:** Create `frontend/pages/admin/index.vue`, `frontend/components/admin/AdminArticleCard.vue`, `frontend/components/admin/AdminArticleEditor.vue`, `frontend/tests/pages/admin-index.test.ts`.

**Interfaces — Consumes:** `useAdminArticles()`. Reuses guide 마크다운 렌더.

- [ ] **Step 1: 실패 테스트 — 대시보드** (`tests/pages/admin-index.test.ts`) — `useAdminArticles` 스텁. 케이스:
  - 마운트 시 `list()` 호출, 반환된 초안들이 카드로 렌더(제목·카테고리·상태).
  - 상태 필터(draft/published/rejected/all) 전환 시 `list({status})` 재호출.
  - 카드 선택 시 `get(id)` 호출, 편집 영역에 제목/요약/본문 표시 + 마크다운 미리보기 렌더.
  - "발행" 클릭 → `publish(id)` 호출 후 목록 새로고침; "반려" → `reject(id)`; "삭제" → 확인 후 `remove(id)`; "저장" → `update(id, patch)`; "지금 생성" → `generate()`; "재생성" → `regenerate(id)`.
  - 발행/삭제 등 파괴적 액션은 확인(confirm) 게이트.

- [ ] **Step 2: RED** → FAIL.

- [ ] **Step 3: 컴포넌트 구현**
  - `pages/admin/index.vue`: `definePageMeta({ middleware: 'admin', layout: false })`, `useSeoMeta({ robots: 'noindex, nofollow', title: '오늘의 이슈 어드민' })`. 상태: `articles`, `selected`, `statusFilter`, `loading`, `error`. `load()`가 `useAdminArticles().list({ status, limit: 50 })` → `articles.value = res.items`. 좌측 큐(AdminArticleCard 리스트 + 상태 필터 칩 + "지금 생성" 버튼), 우측 상세(AdminArticleEditor). 액션 핸들러가 composable 호출 후 `load()` 재실행. 파괴적 액션은 `if (!confirm('...')) return`.
  - `components/admin/AdminArticleCard.vue`: props `article`(summary), emit `select`. 썸네일(`<img>` thumbnailUrl)·제목·카테고리·상태 뱃지·생성일.
  - `components/admin/AdminArticleEditor.vue`: props `article`(detail), emits `save/publish/unpublish/reject/delete/regenerate`. 제목·요약·키워드 input + 본문 `<textarea>`(마크다운) + **미리보기 패널**(guide 렌더 재사용):
    ```ts
    import { marked } from 'marked'; import DOMPurify from 'isomorphic-dompurify';
    const preview = computed(() => article.value?.content ? DOMPurify.sanitize(marked(draftContent.value) as string) : '');
    ```
    미리보기 div는 guide의 prose 클래스 문자열 재사용(`prose prose-slate max-w-none ...`). 액션 버튼들(발행/발행취소/반려/삭제/재생성/저장). "AI 작성 안내" 문구는 공개 페이지(Phase 3)에서 노출되므로 여기선 편집만.

- [ ] **Step 4: GREEN**. **Step 5: 전체 프론트 테스트·lint** — `cd frontend && npm run test && npm run lint` → 무회귀.

- [ ] **Step 6: 커밋**
```bash
cd frontend && git add pages/admin/index.vue components/admin/AdminArticleCard.vue components/admin/AdminArticleEditor.vue tests/pages/admin-index.test.ts
git commit -m "feat(admin-ui): 초안 큐 + 검토/편집/발행 대시보드 (마크다운 미리보기 재사용)"
```

---

## Task 4: Playwright E2E (로그인 → 검토 → 발행)

**Files:** Create `frontend/tests/e2e/admin.spec.ts`.

- [ ] **Step 1: E2E 스펙 작성** — `@playwright/test`. **전제**: 로컬 백엔드(:8000)가 `ADMIN_PASSWORD_HASH`(테스트 비밀번호 해시) + `OPENAI/NAVER`(생성 트리거용, 발행 플로우엔 불필요) 설정으로 실행 중. `chromium` 프로젝트로 스코프. 플로우:
  - `page.goto('/admin')` → 인증 없어 `/admin/login`으로 리다이렉트 확인.
  - 로그인 폼에 비밀번호 입력·제출 → `/admin` 대시보드 도달(쿠키는 same-origin `/api` 프록시로 설정, Playwright 컨텍스트가 유지).
  - 사전 seed된 draft(백엔드 `request.post`로 fixture 생성 또는 기존 draft) 선택 → 미리보기 확인 → "발행" → 상태가 published로 갱신.
  - **CI 안전**: 백엔드/`ADMIN_PASSWORD_HASH` 없으면 `test.skip`(env 가드) — `test.skip(!process.env.ADMIN_TEST_PASSWORD, '...')`.

- [ ] **Step 2: 로컬 실행 확인**(가능 시) — `cd frontend && npm run test:e2e -- admin.spec.ts`(백엔드 실행 + env 필요). CI 미포함일 수 있음(표준 test job은 vitest+build만) — 스킵 가드로 안전.

- [ ] **Step 3: 커밋**
```bash
cd frontend && git add tests/e2e/admin.spec.ts
git commit -m "test(admin-ui): 로그인→검토→발행 E2E (env 가드 스킵)"
```

---

## Self-Review (spec Phase 2 프론트 대비)

- 어드민 fetch same-origin(useApiBase) → 쿠키 프록시 왕복 → Task 1. ✅
- 클라이언트 전용 인증 가드(SSR loopback 쿠키 부재 회피) → Task 2 middleware. ✅
- 로그인/로그아웃/세션 UI → Task 1·2. ✅
- 초안 큐·미리보기(marked+DOMPurify 재사용)·편집·발행/발행취소/반려/삭제/재생성/지금생성 → Task 3. ✅
- 어드민 noindex + layout:false + robots Disallow /admin → Task 2·3. ✅
- E2E 로그인→검토→발행 → Task 4. ✅
- **Nitro 프록시 Cookie/Set-Cookie 왕복**: 조사로 확인(단순 proxy routeRule, h3 proxyRequest가 헤더 그대로 왕복, stripping 없음). E2E가 실증. ✅
- 신규 의존성 없음(marked/dompurify/playwright 설치됨) → lockfile 위험 없음. ✅

## Out of Scope (이 PR)
공개 `/article` 페이지·SEO·JSON-LD(=Phase 3). 마이그레이션·301(=Phase 4). cron(=Phase 5). 어드민 "지금 생성"의 prod 실동작은 서버 dist+키 필요(=Phase 5 배포 게이트, Phase 2a에서 이미 503/500 가드).

## Risks
- **프록시 쿠키 왕복**: 조사상 안전하나 실환경(nginx→Nitro→backend)은 E2E/배포에서 최종 실증 권장. prod에서 `NUXT_PUBLIC_API_BASE`가 별도 호스트를 가리키면 same-origin이 깨져 쿠키 실패 → **어드민은 same-origin 유지 필수**(useApiBase가 이미 보장).
- E2E는 백엔드+비밀번호 env 의존 → CI 표준 job 밖일 수 있음(스킵 가드). 유닛 테스트가 로직 커버.

## Phase 완료 기준(DoD)
- `npm run test`(frontend) green(신규 어드민 테스트 포함)·`npm run lint` 0 errors(Node 20).
- 로그인→대시보드 가드, 초안 목록·편집·발행/반려/삭제 액션이 유닛 테스트로 검증.
- `/admin` noindex + robots Disallow. 기존 스위트 무회귀. 공개 노출 없음(어드민 전용).
