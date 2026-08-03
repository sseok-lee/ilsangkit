# announcements 색인 위생 (PR1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 없는/만료 공공임대 모집공고가 200 OK로 색인되던 문제를 404로 차단하고, 마감 공고 noindex·반응형 head·목록/상세 구조화 데이터를 추가한다.

**Architecture:** `pages/public-rental/announcements/[pblancId].vue`에서 SSR fetch 후 `detail`이 없으면 `createError(404, fatal)`. `useHead`를 함수형으로 바꿔 `status==='closed'`면 `noindex,follow`+canonical 제거. 목록/상세에 `useStructuredData`의 ItemList·Breadcrumb 스키마 추가.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-02-indexing-quality-design.md` (PR1 섹션)

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). 작업 디렉터리 `frontend/`. 브랜치는 컨트롤러가 `feat/announcements-indexing`로 생성해 둠. 커밋 스테이징은 **명시 경로만** (절대 `git add -A` 금지 — 무관한 untracked 파일 다수).

---

## File Structure

- `frontend/pages/public-rental/announcements/[pblancId].vue` — (수정) 404 가드 + 함수형 useHead(closed noindex) + Breadcrumb 스키마
- `frontend/pages/public-rental/announcements/index.vue` — (수정) ItemList + Breadcrumb 스키마
- `frontend/tests/pages/announcements/announcementDetail.test.ts` — (신규) 404/closed/indexable/breadcrumb
- `frontend/tests/pages/announcements/announcementList.test.ts` — (신규) ItemList/breadcrumb

---

## Task 1: 상세 페이지 404 + 마감 noindex + 반응형 head

**Files:**
- Modify: `frontend/pages/public-rental/announcements/[pblancId].vue` (script `:154-236`)
- Test: `frontend/tests/pages/announcements/announcementDetail.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성** — `frontend/tests/pages/announcements/announcementDetail.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense, onErrorCaptured } from 'vue'
import DetailPage from '~/pages/public-rental/announcements/[pblancId].vue'

// 공유 가변 상태 — 테스트마다 detail 주입
const mockState = {
  detail: ref<any>(null),
  loading: ref(false),
  error: ref<string | null>(null),
  fetchDetail: vi.fn(async () => mockState.detail.value),
}
vi.mock('~/composables/useRentalAnnouncements', () => ({
  useRentalAnnouncements: () => mockState,
}))

const setBreadcrumbSchema = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema, setItemListSchema: vi.fn() }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { pblancId: 'PBLANC-1' } }),
}))

const useHeadMock = vi.fn()
vi.stubGlobal('useHead', useHeadMock)
const createErrorMock = vi.fn((opts: any) => {
  const err = new Error(opts.statusMessage || 'Error')
  ;(err as any).statusCode = opts.statusCode
  return err
})
vi.stubGlobal('createError', createErrorMock)

const stubs = {
  NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
  AdBanner: true,
}

function makeDetail(over: Record<string, any> = {}) {
  return {
    pblancId: 'PBLANC-1', pblancNm: '강남 행복주택 입주자 모집공고',
    status: 'ongoing', suplyInsttNm: 'LH', suplyTyNm: '행복주택',
    variants: [], matchedComplexes: [],
    beginDe: null, endDe: null, ...over,
  }
}

async function mountSuspended() {
  const wrapper = mount(
    defineComponent({
      setup() {
        onErrorCaptured(() => true)
        return () => h(Suspense, null, { default: () => h(DetailPage) })
      },
    }),
    { global: { stubs, config: { errorHandler: () => {} } } },
  )
  await flushPromises()
  return wrapper
}

function lastHead() {
  const arg = useHeadMock.mock.calls.at(-1)?.[0]
  return typeof arg === 'function' ? arg() : arg
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState.detail.value = null
  mockState.error.value = null
})

describe('announcements 상세 색인 위생', () => {
  it('없는/만료 공고(detail null)는 404를 던진다', async () => {
    mockState.detail.value = null
    await mountSuspended()
    expect(createErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    )
  })

  it('마감(closed) 공고는 robots noindex,follow + canonical 제거', async () => {
    mockState.detail.value = makeDetail({ status: 'closed' })
    await mountSuspended()
    const head = lastHead()
    expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
    expect(head.link ?? []).toHaveLength(0)
  })

  it('진행중 공고는 indexable(robots 없음) + canonical 유지 + Breadcrumb 스키마', async () => {
    mockState.detail.value = makeDetail({ status: 'ongoing' })
    await mountSuspended()
    const head = lastHead()
    expect(head.meta.some((m: any) => m.name === 'robots')).toBe(false)
    expect(head.link).toContainEqual({ rel: 'canonical', href: 'https://ilsangkit.co.kr/public-rental/announcements/PBLANC-1' })
    expect(setBreadcrumbSchema).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/announcements/announcementDetail.test.ts`
Expected: FAIL — 현재 404 가드 없음 + 정적 useHead(함수 아님)이라 `lastHead()`가 함수 호출 불가/robots 미존재.

- [ ] **Step 3: `[pblancId].vue` 스크립트 수정**

`frontend/pages/public-rental/announcements/[pblancId].vue`:

(a) import에 useStructuredData 추가 — 기존 `import { useRentalAnnouncements } ...` 다음 줄:
```ts
import { useStructuredData } from '~/composables/useStructuredData'
```

(b) `await fetchDetail(pblancId)` (현재 :179) 다음에 404 가드 + 스키마 setter 획득 추가:
```ts
await fetchDetail(pblancId)

// 없는/만료 공고 → 404 (에러 UI를 200 OK로 색인하던 것 차단)
if (!detail.value) {
  throw createError({ statusCode: 404, statusMessage: 'Announcement not found', fatal: true })
}

const { setBreadcrumbSchema } = useStructuredData()
```

(c) 정적 메타 블록(현재 :214-235, `const title = detail.value ? ...`부터 `useHead({ ... })`까지) 전체를 아래로 교체:
```ts
const canonicalUrl = `${SITE_URL}/public-rental/announcements/${encodeURIComponent(pblancId)}`

useHead(() => {
  const d = detail.value
  const title = d
    ? `${d.pblancNm} | 공공임대 모집공고 | 일상킷`
    : '공공임대 모집공고 | 일상킷'
  const description = d
    ? `${d.suplyInsttNm ?? '공공기관'}의 ${d.suplyTyNm ?? '공공임대'} 모집공고. 접수기간·공급세대수·관련 단지 정보를 확인하세요.`
    : '공공임대 모집공고 상세 정보입니다.'
  const isClosed = d?.status === 'closed'
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'article' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
  ]
  if (isClosed) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }
  return {
    title,
    meta,
    // noindex 페이지에서는 canonical 제거(신호 충돌 방지)
    link: isClosed ? [] : [{ rel: 'canonical', href: canonicalUrl }],
  }
})

// Breadcrumb JSON-LD
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '공공임대', url: '/public-rental' },
  { name: '모집공고', url: '/public-rental/announcements' },
  { name: detail.value.pblancNm, url: canonicalUrl },
])
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/announcements/announcementDetail.test.ts`
Expected: PASS (3 passed)

- [ ] **Step 5: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/public-rental/announcements/\[pblancId\].vue frontend/tests/pages/announcements/announcementDetail.test.ts
git commit -m "fix(frontend): announcements 없는/만료 공고 404 + 마감 noindex + reactive head + breadcrumb"
```

---

## Task 2: 목록 페이지 ItemList + Breadcrumb 스키마

**Files:**
- Modify: `frontend/pages/public-rental/announcements/index.vue` (script `:104-194`)
- Test: `frontend/tests/pages/announcements/announcementList.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성** — `frontend/tests/pages/announcements/announcementList.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import ListPage from '~/pages/public-rental/announcements/index.vue'

const mockState = {
  items: ref<any[]>([]),
  total: ref(0),
  totalPages: ref(1),
  loading: ref(false),
  error: ref<string | null>(null),
  fetchList: vi.fn(async () => {}),
}
vi.mock('~/composables/useRentalAnnouncements', () => ({
  useRentalAnnouncements: () => mockState,
}))

const setItemListSchema = vi.fn()
const setBreadcrumbSchema = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setItemListSchema, setBreadcrumbSchema }),
}))

vi.stubGlobal('useHead', vi.fn())

const stubs = {
  NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
  Pagination: { template: '<nav />' },
  PublicRentalFilterTabs: true,
}

async function mountSuspended() {
  const wrapper = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(ListPage) }) } }),
    { global: { stubs } },
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState.items.value = [
    { pblancId: 'A-1', pblancNm: '공고 A', status: 'ongoing', variantCount: 1, beginDe: null, endDe: null },
    { pblancId: 'B-2', pblancNm: '공고 B', status: 'ongoing', variantCount: 1, beginDe: null, endDe: null },
  ]
})

describe('announcements 목록 구조화 데이터', () => {
  it('Breadcrumb 스키마를 설정한다', async () => {
    await mountSuspended()
    expect(setBreadcrumbSchema).toHaveBeenCalled()
  })

  it('목록 항목으로 ItemList 스키마를 설정한다', async () => {
    await mountSuspended()
    expect(setItemListSchema).toHaveBeenCalledWith([
      { name: '공고 A', url: '/public-rental/announcements/A-1', position: 1 },
      { name: '공고 B', url: '/public-rental/announcements/B-2', position: 2 },
    ])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/announcements/announcementList.test.ts`
Expected: FAIL — 현재 페이지가 setItemListSchema/setBreadcrumbSchema 호출 안 함.

- [ ] **Step 3: `index.vue` 스크립트 수정**

`frontend/pages/public-rental/announcements/index.vue`:

(a) import에 useStructuredData 추가 — 기존 `import { useRentalAnnouncements } ...` 다음 줄:
```ts
import { useStructuredData } from '~/composables/useStructuredData'
```

(b) `await load()` (현재 :175) 다음에 스키마 호출 추가(정적 메타 `const title = ...` 위):
```ts
await load()

const { setItemListSchema, setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '공공임대', url: '/public-rental' },
  { name: '모집공고', url: '/public-rental/announcements' },
])
setItemListSchema(
  items.value.map((a, i) => ({
    name: a.pblancNm,
    url: `/public-rental/announcements/${encodeURIComponent(a.pblancId)}`,
    position: i + 1,
  })),
)
```
(`items`는 composable의 readonly ref — 읽기만 하므로 문제 없음. `encodeURIComponent`는 단순 영숫자 id면 동일 문자열 반환 — 테스트의 'A-1'은 그대로.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/announcements/announcementList.test.ts`
Expected: PASS (2 passed)

- [ ] **Step 5: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/public-rental/announcements/index.vue frontend/tests/pages/announcements/announcementList.test.ts
git commit -m "feat(frontend): announcements 목록/상세 ItemList·Breadcrumb 구조화 데이터"
```

---

## Task 3: 회귀 검증 + PR

**Files:** (없음 — 검증만)

- [ ] **Step 1: 두 신규 테스트 + 관련 회귀**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/pages/announcements/`
Expected: 5 passed.

- [ ] **Step 2: 프론트 lint**
Run: `cd frontend && npm run lint 2>&1 | tail -5`
Expected: 0 errors (사전 warning은 허용). 신규 unused import 발견 시 제거.

- [ ] **Step 3: 프론트 전체 테스트**
Run: `cd frontend && npm run test 2>&1 | tail -8`
Expected: 전체 PASS.

- [ ] **Step 4: SSR 빌드(타입/SSR 컴파일 게이트)**
Run: `cd frontend && npm run build 2>&1 | tail -10`
Expected: exit 0.
주의: 이미 떠 있는 dev 서버가 있으면 build가 `.nuxt`를 덮어써 dev가 깨질 수 있음 — build 후 dev는 재시작 필요(사용자에게 위임).

- [ ] **Step 5: 수동 SSR curl 검증(dev 서버 떠 있을 때)**

```bash
# 진행중 공고: indexable + Breadcrumb JSON-LD
ID=$(curl -s "http://localhost:8000/api/public-rental/announcements?status=ongoing&limit=1" | python3 -c "import sys,json;d=json.load(sys.stdin);i=d['data']['items'];print(i[0]['pblancId'] if i else 'NONE')")
curl -s "http://localhost:3000/public-rental/announcements/$ID" | grep -c 'BreadcrumbList'   # >=1
curl -s "http://localhost:3000/public-rental/announcements/$ID" | grep -c 'noindex'           # 0 (진행중)
# 없는 공고: 404
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:3000/public-rental/announcements/NONEXISTENT-ID-999"  # 404
# 목록: ItemList JSON-LD
curl -s "http://localhost:3000/public-rental/announcements" | grep -c 'ItemList'              # >=1
```
Expected: Breadcrumb>=1, noindex=0(진행중), 없는 공고 404, ItemList>=1.

- [ ] **Step 6: PR 생성**
```bash
git push -u origin feat/announcements-indexing
gh pr create --base develop --title "색인 위생: announcements 404/마감 noindex + 구조화 데이터" --body "audit ③ PR1. 없는/만료 공고 404, 마감 noindex,follow, reactive head, 목록/상세 ItemList·Breadcrumb."
```
CI 통과 확인 후 머지.

---

## Self-Review 결과

- **Spec coverage:** P1-1(404)=T1 / P1-2(closed noindex)=T1 / P1-3(reactive head)=T1 / P1-4(스키마: 상세 Breadcrumb=T1, 목록 ItemList+Breadcrumb=T2). 검증=T3.
- **Placeholder scan:** 모든 코드 단계 실제 코드 포함. curl의 `$ID`/NONEXISTENT는 런타임 값(의도적).
- **Type consistency:** `detail.value.status`(AnnouncementStatus, 'closed' 포함), `pblancNm`/`suplyInsttNm`/`suplyTyNm` 모두 상세 타입·템플릿에서 사용 확인. `setItemListSchema(items[{name,url,position}])` = search.vue 사용례와 동일. `setBreadcrumbSchema([{name,url}])` = guide/[slug] 사용례와 동일.
- **Out of scope:** PR2(ⓑⓒⓓⓔ)는 별도 plan.
