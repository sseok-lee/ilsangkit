# 시설 가이드 생성 — Phase 2 (프론트) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 어드민이 가이드 초안을 `/admin`에서 검토·발행/삭제하고, 가이드 상세 SEO 날짜가 `publishedAt`을 반영하도록 프론트를 구현한다.

**Architecture:** Phase 1 백엔드가 노출하는 `/api/admin/guides*`(published boolean·publishedAt)와 `publishedAt` 필드를 소비. `/admin`에 **탭(오늘의 이슈 | 생활 가이드)**을 추가하고 가이드용 composable/카드/에디터를 신설(에디터는 Article용을 린 복제 — 가이드는 status enum·regenerate·reject 상태가 없음). Nuxt 3 SSR, 클라이언트 전용 어드민 가드는 기존 미들웨어 그대로 상속.

**Tech Stack:** Nuxt 3 + Vue 3 + TailwindCSS · Vitest(happy-dom) · `$fetch`/`useApiBase`.

## Global Constraints

- Phase 1 백엔드가 이미 develop에 있음(#514). 백엔드 API 셰이프: `GET/PATCH /api/admin/guides`, `/:id`, `POST /:id/publish|unpublish|reject`, `DELETE /:id`. 목록 응답 `{ items, total, page, totalPages }`, 각 item은 `published: boolean`·`publishedAt: string|null`(status enum 아님)·`sources` **없음**.
- 모든 어드민 fetch는 `credentials: 'include'` + `{ success, data }`에서 `res.data` unwrap. `useApiBase()` 사용(하드코딩 금지).
- 가이드는 `published` boolean만 있음 → 프론트 composable에서 `status: published ? 'published' : 'draft'`로 **파생**(rejected 없음). 상태 필터는 전체/초안/발행됨 3개.
- 가이드 에디터에는 **재생성·반려 버튼 없음**(가이드는 AI 재생성 트리거 없음, reject 상태 없음). 삭제만 파괴적 액션.
- 어드민 페이지는 `useSeoMeta({ robots: 'noindex, nofollow' })` 유지. 어드민 가드는 기존 `middleware/admin.ts`(클라이언트 전용) 그대로.
- SSR 가드: 브라우저 API(`confirm` 등)는 클릭 핸들러(클라이언트)에서만 호출되므로 추가 가드 불필요.
- `[slug].vue`의 `dateModified`는 **변경 금지**(`updatedAt`). `datePublished`/`article:published_time`만 `publishedAt || createdAt`으로.
- 모든 변경 PR 경유(develop). TDD. Node 20. `npm install` 금지·package-lock 불변.
- `data-testid` 컨벤션 유지: 탭 `tab-article`/`tab-guide`, 카드 `admin-guide-card`, 에디터 버튼 `save-button`/`publish-button`/`unpublish-button`/`delete-button`, 필터 `guide-filter-<value>`.

## File Structure

**신규**
- `frontend/composables/useAdminGuides.ts`
- `frontend/components/admin/AdminGuideCard.vue`
- `frontend/components/admin/AdminGuideEditor.vue`
- `frontend/tests/composables/useAdminGuides.test.ts`
- `frontend/tests/components/admin/AdminGuideCard.test.ts`
- `frontend/tests/components/admin/AdminGuideEditor.test.ts`

**수정**
- `frontend/composables/useGuides.ts` — `GuideDetail`에 `publishedAt`.
- `frontend/pages/guide/[slug].vue` — `datePublished`/`article:published_time`를 `publishedAt || createdAt`.
- `frontend/pages/admin/index.vue` — 탭 + 가이드 패널/핸들러.
- `frontend/tests/pages/admin-index.test.ts` (있으면 확장, 없으면 신규) — 탭 전환·가이드 로드.
- 가이드 상세 SEO 테스트: 기존 `frontend/tests/pages/*guide*` 또는 `article-detail.test.ts` 패턴 미러(신규 `guide-detail-published-at.test.ts`).

---

### Task 1: 가이드 상세 SEO `publishedAt` 반영

**Files:**
- Modify: `frontend/composables/useGuides.ts`
- Modify: `frontend/pages/guide/[slug].vue` (275, 291행)
- Test: `frontend/tests/pages/guide-detail-published-at.test.ts` (신규)

**Interfaces:**
- Produces: `GuideDetail`에 `publishedAt: string | null`.

- [ ] **Step 1: `GuideDetail`에 필드 추가.** `useGuides.ts`의 `GuideDetail`:

```typescript
export interface GuideDetail extends GuideSummary {
  content: string
  published: boolean
  publishedAt: string | null // ADD — 백엔드가 non-null(폴백 createdAt) 반환, 타입은 nullable
  updatedAt: string
}
```

- [ ] **Step 2: 실패 테스트 작성.** 기존 가이드 상세/301 테스트(`frontend/tests/pages/` 내 `guide-article-301.test.ts` 등)와 `tests/setup.ts`의 mock 패턴을 먼저 읽고, 이를 미러해 `guide-detail-published-at.test.ts`를 작성한다. 핵심: `fetchGuideBySlug`가 `publishedAt`(≠`createdAt`)을 반환하도록 mock하고, `useStructuredData`(또는 `setArticleSchema`) mock이 `datePublished === publishedAt`으로 호출됐는지 단언. `publishedAt`이 `null`이면 `createdAt`으로 폴백함도 단언.

```typescript
// 골자(정확한 mount/mock 보일러플레이트는 sibling 테스트에서 미러):
// - useAsyncData/$fetch mock → guide { createdAt:'2026-01-01...', publishedAt:'2026-03-01...' , ... }
// - setArticleSchema spy가 { datePublished:'2026-03-01...' }로 호출됐는지 expect
// - article:published_time meta도 publishedAt인지(useHead mock 인자 검사)
// - 두번째 케이스: publishedAt:null → datePublished === createdAt
```

- [ ] **Step 3: 실패 확인.** `cd frontend && nvm use 20 && npx vitest run tests/pages/guide-detail-published-at.test.ts` → FAIL.

- [ ] **Step 4: `[slug].vue` 수정.** 275행과 291행만 변경(`dateModified`·나머지 불변):

```typescript
// useHead meta (275행)
      { property: 'article:published_time', content: guide.value.publishedAt || guide.value.createdAt },
// setArticleSchema (291행)
    datePublished: guide.value.publishedAt || guide.value.createdAt,
```

- [ ] **Step 5: 통과 확인.** 같은 vitest 명령 → PASS.

- [ ] **Step 6: 커밋.**
```bash
git add frontend/composables/useGuides.ts frontend/pages/guide/[slug].vue frontend/tests/pages/guide-detail-published-at.test.ts
git commit -m "feat(guide): 가이드 상세 datePublished를 publishedAt으로(폴백 createdAt)"
```

---

### Task 2: `useAdminGuides` composable

**Files:**
- Create: `frontend/composables/useAdminGuides.ts`
- Test: `frontend/tests/composables/useAdminGuides.test.ts`

**Interfaces:**
- Produces:
  - `type AdminGuideStatus = 'draft' | 'published'`
  - `interface AdminGuideSummary { id; title; slug; summary; category; articleType; thumbnailUrl: string|null; keywords: string|null; published: boolean; status: AdminGuideStatus; publishedAt: string|null; viewCount: number; createdAt: string; updatedAt: string }`
  - `interface AdminGuideDetail extends AdminGuideSummary { content: string }`
  - `interface AdminGuidePatch { title?; summary?; keywords?: string|null; content? }`
  - `useAdminGuides()` → `{ list, get, update, publish, unpublish, reject, remove }`

> 백엔드는 `published` boolean만 반환한다. 이 composable이 `status: published ? 'published' : 'draft'`로 파생해 카드/에디터가 쓰게 한다. 목록의 `status` 필터는 `?published=true|false`로 매핑.

- [ ] **Step 1: 실패 테스트 작성.** 기존 `frontend/tests/composables/*useAdminArticles*`(있으면)와 `tests/setup.ts`의 `$fetch` mock 패턴을 읽고 미러. `useAdminGuides.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAdminGuides } from '~/composables/useAdminGuides'

const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useApiBase', () => 'http://api.test')
  fetchMock.mockReset()
})

describe('useAdminGuides.list', () => {
  it('published:false 아이템을 status:draft로 파생', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { items: [
      { id: 'g1', title: 't', slug: 's', summary: 'x', category: 'toilet', articleType: 'howto', thumbnailUrl: null, keywords: null, published: false, publishedAt: null, viewCount: 0, createdAt: 'c', updatedAt: 'u' },
    ], total: 1, page: 1, totalPages: 1 } })
    const res = await useAdminGuides().list()
    expect(res.items[0].status).toBe('draft')
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/admin/guides', expect.objectContaining({ credentials: 'include' }))
  })
  it('status 필터를 published 쿼리로 매핑', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1, totalPages: 1 } })
    await useAdminGuides().list({ status: 'published' })
    expect(fetchMock.mock.calls[0][0]).toContain('published=true')
    await useAdminGuides().list({ status: 'draft' })
    expect(fetchMock.mock.calls[1][0]).toContain('published=false')
  })
})

describe('useAdminGuides mutations', () => {
  it('publish는 POST + credentials, status 파생', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { id: 'g1', published: true, publishedAt: 'p', content: 'c', title: 't', slug: 's', summary: 'x', category: 'toilet', articleType: 'howto', thumbnailUrl: null, keywords: null, viewCount: 0, createdAt: 'c', updatedAt: 'u' } })
    const d = await useAdminGuides().publish('g1')
    expect(d.status).toBe('published')
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/api/admin/guides/g1/publish', expect.objectContaining({ method: 'POST', credentials: 'include' }))
  })
})
```
> `$fetch`/`useApiBase` mock 방식이 `tests/setup.ts`에 이미 전역 등록돼 있으면 `stubGlobal` 대신 그 방식을 따른다(sibling 테스트 확인).

- [ ] **Step 2: 실패 확인.** `cd frontend && npx vitest run tests/composables/useAdminGuides.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: 구현.** `frontend/composables/useAdminGuides.ts`:

```typescript
export type AdminGuideStatus = 'draft' | 'published'

interface RawGuide {
  id: string; title: string; slug: string; summary: string; category: string
  articleType: string; thumbnailUrl: string | null; keywords: string | null
  published: boolean; publishedAt: string | null; viewCount: number
  createdAt: string; updatedAt: string; content?: string
}

export interface AdminGuideSummary {
  id: string; title: string; slug: string; summary: string; category: string
  articleType: string; thumbnailUrl: string | null; keywords: string | null
  published: boolean; status: AdminGuideStatus; publishedAt: string | null
  viewCount: number; createdAt: string; updatedAt: string
}
export interface AdminGuideDetail extends AdminGuideSummary { content: string }
interface PaginatedAdminGuides { items: AdminGuideSummary[]; total: number; page: number; totalPages: number }
export interface AdminGuidePatch { title?: string; summary?: string; keywords?: string | null; content?: string }

function toSummary(g: RawGuide): AdminGuideSummary {
  return {
    id: g.id, title: g.title, slug: g.slug, summary: g.summary, category: g.category,
    articleType: g.articleType, thumbnailUrl: g.thumbnailUrl, keywords: g.keywords,
    published: g.published, status: g.published ? 'published' : 'draft', publishedAt: g.publishedAt,
    viewCount: g.viewCount, createdAt: g.createdAt, updatedAt: g.updatedAt,
  }
}
function toDetail(g: RawGuide): AdminGuideDetail {
  return { ...toSummary(g), content: g.content ?? '' }
}

export function useAdminGuides() {
  const apiBase = useApiBase()

  async function list(params: { status?: AdminGuideStatus; category?: string; page?: number; limit?: number } = {}): Promise<PaginatedAdminGuides> {
    const query = new URLSearchParams()
    if (params.status) query.set('published', params.status === 'published' ? 'true' : 'false')
    if (params.category) query.set('category', params.category)
    if (params.page) query.set('page', String(params.page))
    if (params.limit) query.set('limit', String(params.limit))
    const qs = query.toString()
    const url = `${apiBase}/api/admin/guides${qs ? `?${qs}` : ''}`
    const res = await $fetch<{ success: boolean; data: { items: RawGuide[]; total: number; page: number; totalPages: number } }>(url, { credentials: 'include' })
    return { ...res.data, items: res.data.items.map(toSummary) }
  }
  async function get(id: string): Promise<AdminGuideDetail> {
    const res = await $fetch<{ success: boolean; data: RawGuide }>(`${apiBase}/api/admin/guides/${id}`, { credentials: 'include' })
    return toDetail(res.data)
  }
  async function update(id: string, patch: AdminGuidePatch): Promise<AdminGuideDetail> {
    const res = await $fetch<{ success: boolean; data: RawGuide }>(`${apiBase}/api/admin/guides/${id}`, { method: 'PATCH', body: patch, credentials: 'include' })
    return toDetail(res.data)
  }
  async function publish(id: string): Promise<AdminGuideDetail> {
    const res = await $fetch<{ success: boolean; data: RawGuide }>(`${apiBase}/api/admin/guides/${id}/publish`, { method: 'POST', credentials: 'include' })
    return toDetail(res.data)
  }
  async function unpublish(id: string): Promise<AdminGuideDetail> {
    const res = await $fetch<{ success: boolean; data: RawGuide }>(`${apiBase}/api/admin/guides/${id}/unpublish`, { method: 'POST', credentials: 'include' })
    return toDetail(res.data)
  }
  async function reject(id: string): Promise<{ deleted: boolean }> {
    const res = await $fetch<{ success: boolean; data: { deleted: boolean } }>(`${apiBase}/api/admin/guides/${id}/reject`, { method: 'POST', credentials: 'include' })
    return res.data
  }
  async function remove(id: string): Promise<{ deleted: boolean }> {
    const res = await $fetch<{ success: boolean; data: { deleted: boolean } }>(`${apiBase}/api/admin/guides/${id}`, { method: 'DELETE', credentials: 'include' })
    return res.data
  }
  return { list, get, update, publish, unpublish, reject, remove }
}
```

- [ ] **Step 4: 통과 확인.** `cd frontend && npx vitest run tests/composables/useAdminGuides.test.ts` → PASS.

- [ ] **Step 5: 커밋.**
```bash
git add frontend/composables/useAdminGuides.ts frontend/tests/composables/useAdminGuides.test.ts
git commit -m "feat(guide): useAdminGuides composable(published→status 파생)"
```

---

### Task 3: `AdminGuideCard` + `AdminGuideEditor` 컴포넌트

**Files:**
- Create: `frontend/components/admin/AdminGuideCard.vue`
- Create: `frontend/components/admin/AdminGuideEditor.vue`
- Test: `frontend/tests/components/admin/AdminGuideCard.test.ts`, `frontend/tests/components/admin/AdminGuideEditor.test.ts`

**Interfaces:**
- Consumes: `AdminGuideSummary`, `AdminGuideDetail`, `AdminGuidePatch` from `~/composables/useAdminGuides`.
- Produces:
  - `AdminGuideCard` props `{ guide: AdminGuideSummary; selected?: boolean }`, emits `{ select: [id: string] }`.
  - `AdminGuideEditor` props `{ guide: AdminGuideDetail }`, emits `{ save: [patch: AdminGuidePatch]; publish: []; unpublish: []; delete: [] }` (재생성/반려 없음).

- [ ] **Step 1: 실패 테스트 작성.** 기존 `frontend/tests/components/admin/AdminArticleCard.test.ts`/`AdminArticleEditor.test.ts`(있으면)를 읽고 미러. `AdminGuideCard.test.ts`: draft/published 배지 라벨·`select` emit. `AdminGuideEditor.test.ts`: 저장 시 `save`가 patch(제목/요약/키워드/본문)로 emit·`publish`/`delete` emit·마크다운 미리보기 렌더·재생성/반려 버튼 **없음**(`find('[data-testid="regenerate-button"]').exists()` false).

- [ ] **Step 2: 실패 확인.** `cd frontend && npx vitest run tests/components/admin/AdminGuideCard.test.ts tests/components/admin/AdminGuideEditor.test.ts` → FAIL.

- [ ] **Step 3: `AdminGuideCard.vue` 구현** (AdminArticleCard 미러, 상태 2종·thumbnail src는 AdminArticleCard와 동일 처리):

```vue
<template>
  <button
    type="button"
    data-testid="admin-guide-card"
    class="w-full text-left flex gap-3 p-3 rounded-lg border transition-colors"
    :class="selected ? 'border-primary bg-primary/5' : 'border-line bg-white hover:border-primary/30'"
    @click="$emit('select', guide.id)"
  >
    <div class="shrink-0 w-16 h-16 rounded-md bg-slate-100 overflow-hidden">
      <img v-if="guide.thumbnailUrl" :src="guide.thumbnailUrl" :alt="guide.title" class="w-full h-full object-cover">
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-xs font-medium text-muted">{{ guide.category }}</span>
        <span
          class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
          :class="STATUS_CLASS[guide.status]"
        >{{ STATUS_LABEL[guide.status] }}</span>
      </div>
      <h3 class="text-sm font-semibold text-slate-900 truncate">{{ guide.title }}</h3>
      <p class="text-xs text-muted mt-1">{{ guide.category }} · {{ guide.articleType }}</p>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { AdminGuideSummary } from '~/composables/useAdminGuides'

withDefaults(defineProps<{ guide: AdminGuideSummary; selected?: boolean }>(), { selected: false })
defineEmits<{ select: [id: string] }>()

const STATUS_LABEL: Record<string, string> = { draft: '초안', published: '발행됨' }
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
}
</script>
```
> 주의: `AdminArticleCard.vue`가 thumbnail `:src`에 apiBase를 붙이는지 확인하고 동일하게 처리(가이드 thumbnailUrl은 `/api/images/guides/*.webp` 상대경로, `/api/**` 프록시로 브라우저에서 로드됨).

- [ ] **Step 4: `AdminGuideEditor.vue` 구현** (AdminArticleEditor 린 복제 — 재생성/반려 버튼 제거, 상태 2종):

```vue
<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-3">
      <span
        class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
        :class="STATUS_CLASS[guide.status]"
      >{{ STATUS_LABEL[guide.status] }}</span>
      <span class="text-xs text-muted">{{ guide.category }} · {{ guide.articleType }}</span>
    </div>

    <div>
      <label for="admin-guide-title" class="block text-xs font-medium text-muted mb-1">제목</label>
      <input id="admin-guide-title" v-model="draftTitle" type="text" data-testid="editor-title"
        class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
    </div>
    <div>
      <label for="admin-guide-summary" class="block text-xs font-medium text-muted mb-1">요약</label>
      <textarea id="admin-guide-summary" v-model="draftSummary" rows="2" data-testid="editor-summary"
        class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
    </div>
    <div>
      <label for="admin-guide-keywords" class="block text-xs font-medium text-muted mb-1">키워드 (쉼표 구분)</label>
      <input id="admin-guide-keywords" v-model="draftKeywords" type="text" data-testid="editor-keywords"
        class="w-full rounded-md border border-line px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <div>
        <label for="admin-guide-content" class="block text-xs font-medium text-muted mb-1">본문 (마크다운)</label>
        <textarea id="admin-guide-content" v-model="draftContent" rows="18" data-testid="editor-content"
          class="w-full rounded-md border border-line px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
      </div>
      <div>
        <span class="block text-xs font-medium text-muted mb-1">미리보기</span>
        <div
          data-testid="editor-preview"
          class="border border-line rounded-md p-3 min-h-[20rem] max-h-[32rem] overflow-y-auto prose prose-slate max-w-none prose-headings:font-bold prose-h2:text-2xl prose-h2:mt-7 prose-h2:mb-3 prose-h2:pb-2 prose-h2:border-b prose-h2:border-line-2 prose-h3:text-lg prose-h3:mt-5 prose-p:leading-relaxed prose-p:text-ink prose-li:leading-relaxed prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-strong:text-strong prose-ul:my-3 prose-ol:my-3"
          v-html="preview"
        />
      </div>
    </div>

    <div class="flex flex-wrap gap-2 pt-2 border-t border-line">
      <button type="button" data-testid="save-button" class="px-3 py-2 rounded-md text-sm font-medium bg-primary text-white" @click="$emit('save', patch)">저장</button>
      <button type="button" data-testid="publish-button" class="px-3 py-2 rounded-md text-sm font-medium bg-emerald-600 text-white" @click="$emit('publish')">발행</button>
      <button type="button" data-testid="unpublish-button" class="px-3 py-2 rounded-md text-sm font-medium bg-slate-200 text-slate-700" @click="$emit('unpublish')">발행취소</button>
      <button type="button" data-testid="delete-button" class="px-3 py-2 rounded-md text-sm font-medium bg-red-50 text-red-700 ml-auto" @click="$emit('delete')">삭제</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'isomorphic-dompurify'
import type { AdminGuideDetail, AdminGuidePatch } from '~/composables/useAdminGuides'

const props = defineProps<{ guide: AdminGuideDetail }>()
defineEmits<{ save: [patch: AdminGuidePatch]; publish: []; unpublish: []; delete: [] }>()

const STATUS_LABEL: Record<string, string> = { draft: '초안', published: '발행됨' }
const STATUS_CLASS: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700',
  published: 'bg-emerald-50 text-emerald-700',
}

const draftTitle = ref('')
const draftSummary = ref('')
const draftKeywords = ref('')
const draftContent = ref('')

watch(() => props.guide, (guide) => {
  draftTitle.value = guide.title
  draftSummary.value = guide.summary
  draftKeywords.value = guide.keywords ?? ''
  draftContent.value = guide.content
}, { immediate: true })

const preview = computed(() => DOMPurify.sanitize(marked(draftContent.value || '') as string))
const patch = computed<AdminGuidePatch>(() => ({
  title: draftTitle.value,
  summary: draftSummary.value,
  keywords: draftKeywords.value.trim() === '' ? null : draftKeywords.value,
  content: draftContent.value,
}))
</script>
```

- [ ] **Step 5: 통과 확인.** 두 컴포넌트 테스트 → PASS.

- [ ] **Step 6: 커밋.**
```bash
git add frontend/components/admin/AdminGuideCard.vue frontend/components/admin/AdminGuideEditor.vue frontend/tests/components/admin/AdminGuideCard.test.ts frontend/tests/components/admin/AdminGuideEditor.test.ts
git commit -m "feat(guide): 어드민 가이드 카드·에디터(린, 재생성/반려 없음)"
```

---

### Task 4: `/admin` 탭 통합

**Files:**
- Modify: `frontend/pages/admin/index.vue`
- Test: `frontend/tests/pages/admin-index.test.ts` (있으면 확장, 없으면 신규)

**Interfaces:**
- Consumes: `useAdminGuides`, `AdminGuideCard`, `AdminGuideEditor`, `AdminGuideSummary/Detail/Patch/Status`.

> 기존 오늘의 이슈(article) 패널·상태·핸들러는 **그대로 유지**. 탭 상태를 추가하고, article 패널은 `v-if="tab==='article'"`, 가이드 패널은 `v-else`로 감싼다. "지금 생성" 버튼은 article 탭에서만.

- [ ] **Step 1: 실패 테스트 작성.** 기존 admin 페이지 테스트가 있으면 확장, 없으면 `tests/pages/admin-login.test.ts`/`article-index.test.ts` 및 `tests/setup.ts` 패턴을 미러해 `admin-index.test.ts` 신규. 검증: (a) 기본 탭=article, (b) `tab-guide` 클릭 시 `useAdminGuides().list`가 호출되고 `admin-guide-card`가 렌더, (c) 가이드 선택→발행 클릭 시 `useAdminGuides().publish` 호출(confirm mock `true`), (d) article 탭에서만 `generate-button` 노출. `useAdminGuides`/`useAdminArticles`/`confirm`을 mock.

- [ ] **Step 2: 실패 확인.** `cd frontend && npx vitest run tests/pages/admin-index.test.ts` → FAIL.

- [ ] **Step 3: 구현 — 템플릿.** `admin/index.vue` `<template>` 변경:
  1. `<header>`의 `<h1>`을 탭 토글로 교체(또는 h1 아래 탭 행 추가). "지금 생성" 버튼에 `v-if="tab === 'article'"`.
  2. article `aside`+`section`을 `<template v-if="tab === 'article'">`로 감싸고, 그 뒤 `<template v-else>`에 가이드 `aside`+`section` 추가.

```html
    <header class="bg-white border-b border-line px-4 py-3 flex items-center justify-between">
      <div class="flex items-center gap-1">
        <button
          v-for="t in TABS" :key="t.value" type="button"
          :data-testid="`tab-${t.value}`"
          class="px-3 py-1.5 rounded-md text-sm font-semibold transition-colors"
          :class="tab === t.value ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'"
          @click="onTabChange(t.value)"
        >{{ t.label }}</button>
      </div>
      <button
        v-if="tab === 'article'"
        type="button" data-testid="generate-button" :disabled="generating"
        class="px-3 py-2 rounded-md text-sm font-medium bg-primary text-white disabled:opacity-50"
        @click="onGenerate"
      >{{ generating ? '생성 중...' : '지금 생성' }}</button>
    </header>
```

가이드 패널(article `aside`/`section` 블록을 `<template v-if="tab==='article'"> ... </template>`로 감싼 뒤, `<template v-else>`에 추가):

```html
      <template v-else>
        <aside class="md:w-96 shrink-0 flex flex-col gap-3">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="f in GUIDE_FILTERS" :key="f.value" type="button"
              :data-testid="`guide-filter-${f.value}`"
              class="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
              :class="guideStatusFilter === f.value ? 'bg-primary text-white' : 'bg-white border border-line text-slate-600'"
              @click="onGuideFilterChange(f.value)"
            >{{ f.label }}</button>
          </div>
          <p v-if="error" data-testid="error" role="alert" class="text-sm text-red-600">{{ error }}</p>
          <p v-if="loading" data-testid="loading" class="text-sm text-muted">불러오는 중...</p>
          <div v-else class="flex flex-col gap-2">
            <AdminGuideCard
              v-for="g in guides" :key="g.id" :guide="g"
              :selected="selectedGuide?.id === g.id" @select="onSelectGuide"
            />
            <p v-if="guides.length === 0" class="text-sm text-muted text-center py-8">가이드가 없습니다</p>
          </div>
        </aside>
        <section class="flex-1 bg-white rounded-lg border border-line p-4">
          <AdminGuideEditor
            v-if="selectedGuide" :guide="selectedGuide"
            @save="onSaveGuide" @publish="onPublishGuide" @unpublish="onUnpublishGuide" @delete="onDeleteGuide"
          />
          <p v-else class="text-sm text-muted text-center py-20">왼쪽에서 가이드를 선택하세요</p>
        </section>
      </template>
```
> `<div class="flex-1 max-w-7xl ...">` 컨테이너 안에서 article `aside`+`section`을 `<template v-if="tab === 'article'">`로 감싸고 위 `<template v-else>`를 형제로 둔다.

- [ ] **Step 4: 구현 — 스크립트.** `admin/index.vue` `<script setup>`에 추가(기존 article 로직 불변):

```typescript
import AdminGuideCard from '~/components/admin/AdminGuideCard.vue'
import AdminGuideEditor from '~/components/admin/AdminGuideEditor.vue'
import type { AdminGuideSummary, AdminGuideDetail, AdminGuideStatus, AdminGuidePatch } from '~/composables/useAdminGuides'

type AdminTab = 'article' | 'guide'
const TABS: { value: AdminTab; label: string }[] = [
  { value: 'article', label: '오늘의 이슈' },
  { value: 'guide', label: '생활 가이드' },
]
type GuideStatusFilter = AdminGuideStatus | 'all'
const GUIDE_FILTERS: { value: GuideStatusFilter; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'draft', label: '초안' },
  { value: 'published', label: '발행됨' },
]

const tab = ref<AdminTab>('article')
const guides = ref<AdminGuideSummary[]>([])
const selectedGuide = ref<AdminGuideDetail | null>(null)
const guideStatusFilter = ref<GuideStatusFilter>('all')
const guidesLoaded = ref(false)

async function loadGuides() {
  loading.value = true
  error.value = ''
  try {
    const params: { status?: AdminGuideStatus; limit: number } = { limit: 50 }
    if (guideStatusFilter.value !== 'all') params.status = guideStatusFilter.value
    guides.value = (await useAdminGuides().list(params)).items
    guidesLoaded.value = true
  } catch {
    error.value = GENERIC_ERROR
  } finally {
    loading.value = false
  }
}

function onTabChange(value: AdminTab) {
  tab.value = value
  error.value = ''
  if (value === 'guide' && !guidesLoaded.value) loadGuides()
}
function onGuideFilterChange(value: GuideStatusFilter) {
  guideStatusFilter.value = value
  loadGuides()
}
async function onSelectGuide(id: string) {
  error.value = ''
  try { selectedGuide.value = await useAdminGuides().get(id) } catch { error.value = GENERIC_ERROR }
}
async function onSaveGuide(patch: AdminGuidePatch) {
  if (!selectedGuide.value) return
  try { selectedGuide.value = await useAdminGuides().update(selectedGuide.value.id, patch); await loadGuides() }
  catch { error.value = GENERIC_ERROR }
}
async function onPublishGuide() {
  if (!selectedGuide.value) return
  if (!confirm('이 가이드를 발행하시겠습니까?')) return
  try { selectedGuide.value = await useAdminGuides().publish(selectedGuide.value.id); await loadGuides() }
  catch { error.value = GENERIC_ERROR }
}
async function onUnpublishGuide() {
  if (!selectedGuide.value) return
  try { selectedGuide.value = await useAdminGuides().unpublish(selectedGuide.value.id); await loadGuides() }
  catch { error.value = GENERIC_ERROR }
}
async function onDeleteGuide() {
  if (!selectedGuide.value) return
  if (!confirm('이 가이드를 삭제하시겠습니까? 되돌릴 수 없습니다.')) return
  try { await useAdminGuides().remove(selectedGuide.value.id); selectedGuide.value = null; await loadGuides() }
  catch { error.value = GENERIC_ERROR }
}
```
> `loading`/`error`/`GENERIC_ERROR`는 기존 것 재사용. `onMounted(load)`는 그대로(article 탭 초기 로드). 가이드는 첫 탭 전환 시 lazy-load.

- [ ] **Step 5: 통과 확인 + 전체 프론트 테스트.** 실행: `cd frontend && npx vitest run tests/pages/admin-index.test.ts` → PASS. 이어 `npm run test && npm run lint` 전체 green 확인(기존 실패 시 즉시 수정).

- [ ] **Step 6: 커밋.**
```bash
git add frontend/pages/admin/index.vue frontend/tests/pages/admin-index.test.ts
git commit -m "feat(guide): /admin 생활 가이드 탭 통합(목록·검토·발행/삭제)"
```

---

## Phase 2 완료 후

- develop PR → CI green → 사용자 머지.
- 이어서 **Phase 3(운영) 런북**: `npm run generate:guide:drafts -- --dry-run`으로 확인 → 실제 배치 생성(24개 초안) → `/admin` 생활 가이드 탭에서 검토·발행 → main 승격·Cafe24 배포 → 라이브 검증(가이드 상세 SSR·HowTo/FAQ JSON-LD·canonical·publishedAt).

## Self-Review 체크

- Spec 커버리지: publishedAt 소비(T1)·composable(T2)·컴포넌트(T3)·탭 통합(T4). ✅
- 플레이스홀더: 컴포넌트/composable 전체 코드 제공. 페이지 테스트·상세 SEO 테스트는 sibling 미러 지시(구체 단언 명시). ✅
- 타입 일관성: `AdminGuideStatus`/`AdminGuideSummary`/`AdminGuideDetail`/`AdminGuidePatch` composable↔카드↔에디터↔페이지 일치. status는 composable 파생. 에디터 emit에 regenerate/reject 없음. ✅
