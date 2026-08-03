# 오늘의 이슈 — 정책 브리핑 트랙 P2(어드민) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 어드민이 `/admin`에서 정책 브리핑 트랙 생성을 직접 트리거하고, 목록에서 정책 글을 뱃지로 구분할 수 있게 한다.

**Architecture:** 기존 생성 트리거 엔드포인트(`POST /api/admin/articles/generate`)에 `track: 'news'|'policy'` 파라미터를 더해 P1의 `--track policy` CLI로 연결한다. 어드민 UI에는 기존 "지금 생성"(뉴스) 옆에 "정책 생성" 버튼을 추가하고, 목록 카드에 `articleType==='policy-brief'` 뱃지를 붙인다. 단일-플라이트 락·injection-safe spawn은 불변.

**Tech Stack:** Node 20, Express 5(TypeScript ESM), Zod, Vitest(백엔드); Nuxt 3 + Vue 3 + Vitest(happy-dom, 프론트).

## Global Constraints

- **Node 20 필수** — `nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **PR 워크플로우** — `develop`에서 브랜치 분기, main/develop 직접 커밋 금지, CI green 후 사용자 머지. 커밋 전 해당 앱(backend/frontend) `npm run test`·`npm run lint` 통과.
- **백엔드 ESM** — 로컬 import에 `.js` 확장자 필수.
- **track 값** — `'news' | 'policy'` (P1의 CLI `--track` 값과 일치). 기본 `'news'`.
- **뉴스 트랙 트리거 동작 불변** — 기존 "지금 생성"(뉴스) 경로·응답·테스트가 그대로 유지돼야 함.
- **단일-플라이트 락 + injection-safe spawn 불변** — `acquireGenerationLock`/`spawnGenerated`의 락·argv-배열 spawn 방식을 바꾸지 않는다(인자만 추가).
- **정책 키 프리플라이트** — track=policy면 `OPENAPI_SERVICE_KEY` 부재 시 503 `POLICY_API_NOT_CONFIGURED`. 뉴스는 기존대로 `OPENAI_API_KEY`+`NAVER_CLIENT_ID` 필요.
- **UI** — 뉴스 버튼: 라벨 "뉴스 생성", `data-testid="generate-button"`(기존 testid 유지). 정책 버튼: 라벨 "정책 생성", `data-testid="generate-policy-button"`. 뱃지는 `articleType==='policy-brief'`일 때만 "정책".
- **프론트 SSR 가드/테스트 셋업** — `frontend/tests/setup.ts`의 auto-import mock 패턴을 따른다.
- **작업 브랜치** — 예: `feat/today-issue-policy-track-p2` (develop 분기).

---

## File Structure

**수정**
- `backend/src/schemas/admin.ts` — `AdminGenerateSchema`에 `track` enum 추가(Task 1)
- `backend/src/routes/admin.ts` — `assertGenerationReady(track)`·`spawnGenerated(...,track)`·generate 핸들러(Task 1)
- `backend/__tests__/routes/adminGenerate.test.ts` — track 테스트 추가(Task 1)
- `frontend/composables/useAdminArticles.ts` — `AdminGenerateBody.track`(Task 2)
- `frontend/pages/admin/index.vue` — "정책 생성" 버튼 + `onGenerate(track)`(Task 2)
- `frontend/tests/composables/useAdminArticles.test.ts` — track body 테스트(Task 2)
- `frontend/tests/pages/admin-index.test.ts` — 정책 버튼 테스트(Task 2)
- `frontend/components/admin/AdminArticleCard.vue` — 정책 뱃지(Task 3)

**신규**
- `frontend/tests/components/admin/AdminArticleCard.test.ts` — 뱃지 테스트(Task 3)

---

## Task 1: 백엔드 — generate 엔드포인트 `track` 파라미터

**Files:**
- Modify: `backend/src/schemas/admin.ts:22-28` (`AdminGenerateSchema`)
- Modify: `backend/src/routes/admin.ts:45-56` (`assertGenerationReady`), `:60-77` (`spawnGenerated`), `:182-190` (generate 핸들러)
- Test: `backend/__tests__/routes/adminGenerate.test.ts`

**Interfaces:**
- Consumes: 기존 `acquireGenerationLock`, `AppError`, `spawn`, P1의 dist `generateArticle.js`(`--track policy` 지원).
- Produces: generate 엔드포인트가 body `{ count?, category?, track?: 'news'|'policy' }`를 받아 track=policy면 spawn argv에 `--track policy`를 추가. `assertGenerationReady(track)` 시그니처.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/routes/adminGenerate.test.ts`의 generate describe 블록에 아래 테스트들을 추가(기존 테스트는 수정하지 않음). 기존 `category 지정` 테스트(파일 내 존재)의 spawn-argv 패턴을 따른다:

```ts
  it('track=policy 지정 시 spawn args에 --track policy 포함', async () => {
    const res = await request(makeApp())
      .post('/api/admin/articles/generate')
      .set('Origin', ORIGIN)
      .send({ track: 'policy' });

    expect(res.status).toBe(202);
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('--track');
    expect(args[args.indexOf('--track') + 1]).toBe('policy');
    expect(res.body.data.track).toBe('policy');
  });

  it('track 미지정 시 기본 news — spawn args에 --track 없음', async () => {
    const res = await request(makeApp())
      .post('/api/admin/articles/generate')
      .set('Origin', ORIGIN)
      .send({ count: 1 });

    expect(res.status).toBe(202);
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).not.toContain('--track');
    expect(res.body.data.track).toBe('news');
  });

  it('track=policy인데 OPENAPI_SERVICE_KEY 없으면 503 POLICY_API_NOT_CONFIGURED', async () => {
    const prev = process.env.OPENAPI_SERVICE_KEY;
    delete process.env.OPENAPI_SERVICE_KEY;
    const res = await request(makeApp())
      .post('/api/admin/articles/generate')
      .set('Origin', ORIGIN)
      .send({ track: 'policy' });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('POLICY_API_NOT_CONFIGURED');
    if (prev !== undefined) process.env.OPENAPI_SERVICE_KEY = prev;
  });

  it('잘못된 track 값은 422', async () => {
    const res = await request(makeApp())
      .post('/api/admin/articles/generate')
      .set('Origin', ORIGIN)
      .send({ track: 'garbage' });
    expect(res.status).toBe(422);
  });
```

그리고 이 파일의 `beforeEach`에서 뉴스 경로 테스트가 깨지지 않도록 `process.env.OPENAPI_SERVICE_KEY`를 설정한다(기존 `OPENAI_API_KEY`/`NAVER_CLIENT_ID` 설정 줄 옆에 추가):

```ts
    process.env.OPENAPI_SERVICE_KEY = 'test-service-key';
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run __tests__/routes/adminGenerate.test.ts`
Expected: 신규 4개 FAIL(`track` 미지원 — argv에 `--track` 없음, 응답에 `track` 없음, 422 대신 통과 등)

- [ ] **Step 3: 스키마에 track 추가**

`backend/src/schemas/admin.ts`의 `AdminGenerateSchema`를 수정:

```ts
export const AdminGenerateSchema = z.object({
  count: z.coerce.number()
    .transform((n) => (Number.isFinite(n) ? Math.min(3, Math.max(1, Math.trunc(n))) : 3))
    .default(3),
  category: z.enum(GUIDE_CATEGORIES).optional(),
  track: z.enum(['news', 'policy']).default('news'),
});
```

- [ ] **Step 4: admin.ts 핸들러 수정**

`backend/src/routes/admin.ts`에서 세 곳을 수정.

4a. `assertGenerationReady`를 track-aware로(뉴스 동작 불변, 정책은 OPENAPI_SERVICE_KEY 요구):

```ts
async function assertGenerationReady(track: 'news' | 'policy' = 'news'): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new AppError(503, '생성 키가 설정되지 않았습니다', 'GENERATION_NOT_CONFIGURED');
  }
  if (track === 'policy') {
    if (!process.env.OPENAPI_SERVICE_KEY) {
      throw new AppError(503, '정책 생성 키(OPENAPI_SERVICE_KEY)가 설정되지 않았습니다', 'POLICY_API_NOT_CONFIGURED');
    }
  } else if (!process.env.NAVER_CLIENT_ID) {
    throw new AppError(503, '생성 키가 설정되지 않았습니다', 'GENERATION_NOT_CONFIGURED');
  }
  const scriptPath = path.resolve(__dirname, '../scripts/generateArticle.js'); // dist 기준(ts 소스 아님)
  if (!fs.existsSync(scriptPath)) {
    throw new AppError(500, '생성 스크립트를 찾을 수 없습니다(빌드 필요)', 'SCRIPT_MISSING');
  }
  const acquired = await acquireGenerationLock();
  if (!acquired) throw new ConflictError('이미 생성이 진행 중입니다');
  return scriptPath;
}
```

4b. `spawnGenerated`에 track 인자 추가(argv만 확장, spawn 방식 불변):

```ts
function spawnGenerated(scriptPath: string, count: number, category?: string, track: 'news' | 'policy' = 'news'): void {
  const args = [scriptPath, '--count', String(count)];
  if (category) args.push('--category', category);
  if (track === 'policy') args.push('--track', 'policy');
  try {
    const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore' });
    child.on('exit', () => {
      void releaseGenerationLock();
    });
    child.unref();
  } catch (err) {
    void releaseGenerationLock().catch(() => {});
    throw err;
  }
}
```

4c. generate 핸들러가 track을 읽어 전달(응답에 track 포함):

```ts
router.post('/articles/generate', requireAdmin, requireSameOrigin, adminGenerateRateLimiter, validate(AdminGenerateSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { count, category, track } = req.body as { count: number; category?: string; track: 'news' | 'policy' };
    const scriptPath = await assertGenerationReady(track);
    spawnGenerated(scriptPath, count, category, track);
    res.status(202).json({ success: true, data: { started: true, count, category: category ?? null, track } });
  })
);
```

> `regenerate` 핸들러(`/articles/:id/regenerate`)는 `assertGenerationReady()`를 인자 없이 호출 → 기본 `'news'`. 재생성은 뉴스 트랙 재생성이므로 변경하지 않는다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run __tests__/routes/adminGenerate.test.ts`
Expected: PASS (신규 4개 + 기존 뉴스/락/키/auth/rate-limit/regenerate 테스트 전부 green)

- [ ] **Step 6: 백엔드 게이트 + Commit**

Run: `cd backend && source ~/.nvm/nvm.sh && nvm use 20 && npm run lint && npm run build && npm run test`
Expected: lint 통과, build 성공, 전체 vitest green.

```bash
git add backend/src/schemas/admin.ts backend/src/routes/admin.ts backend/__tests__/routes/adminGenerate.test.ts
git commit -m "feat(admin): add track param to article generate endpoint"
```

---

## Task 2: 프론트 — "정책 생성" 버튼 + 트리거

**Files:**
- Modify: `frontend/composables/useAdminArticles.ts:38-41` (`AdminGenerateBody`)
- Modify: `frontend/pages/admin/index.vue:17-26` (버튼), `:321-335` (`onGenerate`)
- Test: `frontend/tests/composables/useAdminArticles.test.ts`, `frontend/tests/pages/admin-index.test.ts`

**Interfaces:**
- Consumes: Task 1의 generate 엔드포인트(track 지원). 기존 `useAdminArticles().generate(body)`.
- Produces: `AdminGenerateBody.track?: 'news' | 'policy'`. `/admin` 어드민에 `data-testid="generate-policy-button"` 버튼.

- [ ] **Step 1: 실패하는 테스트 작성**

1a. `frontend/tests/composables/useAdminArticles.test.ts`에 추가:

```ts
  it('generate: track=policy를 body로 전달', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { started: true, count: 3, category: null, track: 'policy' } });
    await useAdminArticles().generate({ track: 'policy' });
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/generate');
    expect(opts).toMatchObject({ method: 'POST', body: { track: 'policy' }, credentials: 'include' });
  });
```

1b. `frontend/tests/pages/admin-index.test.ts`에 추가(기존 `generateMock` 셋업 재사용). 기존 "지금 생성" 클릭 테스트 패턴을 따른다:

```ts
  it('"정책 생성" 클릭 시 generate({track:"policy"})를 호출', async () => {
    const wrapper = await mountAdmin();
    await wrapper.get('[data-testid="generate-policy-button"]').trigger('click');
    await flushPromises();
    expect(generateMock).toHaveBeenCalledWith({ track: 'policy' });
  });
```

> `mountAdmin`/`flushPromises`/`generateMock`은 이 테스트 파일에 이미 있는 헬퍼·mock을 그대로 쓴다(없으면 기존 "지금 생성" 테스트가 쓰는 것과 동일한 이름으로 참조). 기존 "지금 생성" 테스트는 수정하지 않는다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useAdminArticles.test.ts tests/pages/admin-index.test.ts`
Expected: 신규 2개 FAIL(`generate-policy-button` 없음 / track body 미전달)

- [ ] **Step 3: composable 타입 확장**

`frontend/composables/useAdminArticles.ts`의 `AdminGenerateBody`:

```ts
export interface AdminGenerateBody {
  count?: number
  category?: string
  track?: 'news' | 'policy'
}
```

`generate` 함수 본문은 body를 그대로 POST하므로 변경 불필요.

- [ ] **Step 4: admin/index.vue 버튼 + onGenerate 수정**

4a. 버튼 블록(현재 단일 "지금 생성")을 뉴스+정책 두 버튼으로 교체. 뉴스는 testid 유지(라벨만 "뉴스 생성"), 정책 버튼 신설:

```vue
<button
  v-if="tab === 'article'"
  type="button"
  data-testid="generate-button"
  :disabled="generating"
  class="px-3 py-2 rounded-md text-sm font-medium bg-primary text-white disabled:opacity-50"
  @click="onGenerate('news')"
>
  {{ generating ? '생성 중...' : '뉴스 생성' }}
</button>
<button
  v-if="tab === 'article'"
  type="button"
  data-testid="generate-policy-button"
  :disabled="generating"
  class="px-3 py-2 rounded-md text-sm font-medium bg-blue-600 text-white disabled:opacity-50"
  @click="onGenerate('policy')"
>
  {{ generating ? '생성 중...' : '정책 생성' }}
</button>
```

4b. `onGenerate`가 track을 받도록 수정(이벤트가 아니라 track 문자열을 명시 전달):

```ts
async function onGenerate(track: 'news' | 'policy' = 'news') {
  generating.value = true
  error.value = ''
  notice.value = ''
  try {
    await useAdminArticles().generate({ track })
    notice.value = track === 'policy'
      ? '정책 생성이 시작되었습니다. 적합한 신규 정책이 없으면 생성되지 않을 수 있습니다. 잠시 후 목록을 새로고침하세요.'
      : '생성이 시작되었습니다. 완료까지 30초~1분 걸릴 수 있으니 잠시 후 목록을 새로고침하세요.'
    await load()
  } catch {
    notice.value = ''
    error.value = GENERIC_ERROR
  } finally {
    generating.value = false
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useAdminArticles.test.ts tests/pages/admin-index.test.ts`
Expected: PASS (신규 2개 + 기존 "지금 생성"/탭 가시성 테스트 green)

- [ ] **Step 6: Commit**

```bash
git add frontend/composables/useAdminArticles.ts frontend/pages/admin/index.vue frontend/tests/composables/useAdminArticles.test.ts frontend/tests/pages/admin-index.test.ts
git commit -m "feat(admin): add 정책 생성 button for policy generation track"
```

---

## Task 3: 프론트 — 정책 뱃지(AdminArticleCard)

**Files:**
- Modify: `frontend/components/admin/AdminArticleCard.vue:18-26` (메타 행)
- Test: `frontend/tests/components/admin/AdminArticleCard.test.ts` (신규)

**Interfaces:**
- Consumes: `AdminArticleSummary.articleType`(이미 존재). 없음 새 prop.
- Produces: `articleType==='policy-brief'`일 때 "정책" 뱃지 렌더.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/components/admin/AdminArticleCard.test.ts` 신규 생성. 같은 폴더 `AdminGuideCard.test.ts`의 mount/stub 컨벤션을 그대로 따른다(전역 stub은 `tests/setup.ts`):

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AdminArticleCard from '../../../components/admin/AdminArticleCard.vue'

const base = {
  id: 'a1',
  slug: 'subscription-x',
  title: '청약 개편',
  category: 'subscription',
  status: 'draft' as const,
  articleType: 'news-brief',
  createdAt: '2026-07-07T00:00:00.000Z',
  updatedAt: '2026-07-07T00:00:00.000Z',
}

describe('AdminArticleCard — 정책 뱃지', () => {
  it('policy-brief면 "정책" 뱃지 노출', () => {
    const wrapper = mount(AdminArticleCard, { props: { article: { ...base, articleType: 'policy-brief' } } })
    expect(wrapper.text()).toContain('정책')
  })
  it('news-brief면 "정책" 뱃지 없음', () => {
    const wrapper = mount(AdminArticleCard, { props: { article: { ...base, articleType: 'news-brief' } } })
    expect(wrapper.text()).not.toContain('정책')
  })
})
```

> mount가 `AdminArticleCard`의 props/emits 요구로 실패하면, `AdminGuideCard.test.ts`가 쓰는 것과 동일한 방식(props 이름·전역 stub)으로 맞춘다. 카드가 요구하는 필수 prop이 `article` 하나임을 먼저 컴포넌트 `defineProps`로 확인.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/admin/AdminArticleCard.test.ts`
Expected: 첫 테스트 FAIL(뱃지 없음 — "정책" 미노출)

- [ ] **Step 3: 카드에 뱃지 추가**

`frontend/components/admin/AdminArticleCard.vue`의 메타 행(category + status 뱃지)에서 category span 다음에 정책 뱃지를 추가:

```vue
<div class="flex items-center gap-2 mb-1">
  <span class="text-xs font-medium text-muted">{{ article.category }}</span>
  <span
    v-if="article.articleType === 'policy-brief'"
    class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700"
  >정책</span>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
    :class="STATUS_CLASS[article.status]"
  >
    {{ STATUS_LABEL[article.status] }}
  </span>
</div>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/admin/AdminArticleCard.test.ts`
Expected: PASS (2/2)

- [ ] **Step 5: 프론트 게이트 + Commit**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run lint && npm run test`
Expected: lint 통과, 전체 vitest green.

```bash
git add frontend/components/admin/AdminArticleCard.vue frontend/tests/components/admin/AdminArticleCard.test.ts
git commit -m "feat(admin): show 정책 badge on policy-brief article cards"
```

---

## Self-Review (작성자 점검 완료)

**1. Spec 커버리지(§4.5)** — track 파라미터(Task 1), `POLICY_API_NOT_CONFIGURED` 프리플라이트(Task 1), spawn `--track`(Task 1), 어드민 track 트리거 버튼(Task 2), `policy-brief` 뱃지(Task 3). 단일-플라이트 락·injection-safe spawn 불변(인자만 추가).
**2. 플레이스홀더 스캔** — 없음. 모든 코드/테스트 전문 기재. 프론트 테스트 헬퍼 참조 지침은 기존 파일 컨벤션 준수 안내(TODO 아님).
**3. 타입 일관성** — `track: 'news'|'policy'`가 스키마·`assertGenerationReady`·`spawnGenerated`·핸들러·`AdminGenerateBody`·`onGenerate`에서 동일. 응답 `data.track` ↔ 테스트 assertion 일치. 뱃지 조건 `articleType==='policy-brief'` ↔ P1 저장값 일치.

---

## Execution Handoff

P2 완료 후 P3(공개 `/article`·SEO·배포·라이브 검증)는 별도 플랜(스펙 §8). P2는 어드민 전용이라 공개 노출·SEO 변화 없음.
