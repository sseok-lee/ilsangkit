# 오늘의 이슈(/article) — Phase 3: 공개 페이지 + SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 발행된(published) 오늘의 이슈를 **공개**한다 — 공개 읽기 API(`/api/articles`), 목록 `/article`, 상세 `/article/[slug]`(마크다운 렌더·발행일·출처·AI 안내·내부링크·자기 canonical·`Article` JSON-LD), 사이트맵/RSS, 홈 "오늘의 이슈" 섹션. `draft`/`rejected`는 공개 안 함.

**Architecture:** 기존 GUIDE 공개 경로(`guideService`·`/guide`·`/guide/[slug]`·sitemap·rss·home)를 미러링하되, Article 차이를 반영: **`status:'published'` 필터**(guide는 `published:boolean`), **`orderBy publishedAt desc`**(guide는 createdAt), **datePublished=publishedAt**, **dateModified는 updatedAt이 publishedAt를 유의미하게 초과할 때만**(guide는 무조건). 카테고리 라벨/허브는 guide의 `getCategoryLabel` 폴백(CATEGORY_META→REAL_ESTATE_META→특수) 그대로 재사용(Article.category ∈ GUIDE_CATEGORIES). `setArticleSchema`(이미 `@type:Article`)·`setBreadcrumbSchema`·`setItemListSchema`·`<AdBanner>`(self-gating)·`setMeta`(self-canonical)·마크다운 렌더(marked+DOMPurify)·AI 안내 블록·3번째 `<h2>` 광고 분할 재사용.

**Tech Stack:** Express 5(ESM)·Prisma, Nuxt 3(SSR)·Vue 3, `marked`+`isomorphic-dompurify`(설치됨), Vitest+supertest.

## Global Constraints

- **Node 20 필수** — 모든 `npm`/`npx`/`vitest`/`db` 전에 `source ~/.nvm/nvm.sh && nvm use 20`. 시스템 기본 v25.5.0.
- **package-lock.json 삭제·재생성 금지. 신규 의존성 없음**(marked/dompurify 설치됨) — `npm install` 금지.
- **ESM**: 로컬 import `.js`. 백엔드 테스트 `cd backend`, 프론트 `cd frontend`.
- **공개 노출은 `status:'published'`만.** `draft`/`rejected`는 목록·상세·사이트맵·RSS 어디에도 노출 금지. 상세 slug가 미발행이면 404.
- **SEO 불변식(스펙 리뷰 반영)**:
  - `/article/[slug]`는 **자기-canonical**(`https://ilsangkit.co.kr/article/{slug}`) — `setMeta({path:'/article/'+slug})`가 기본 self-URL. /guide로 새지 않게.
  - JSON-LD는 **`Article`**(NewsArticle 아님) — `setArticleSchema` 그대로. `datePublished=publishedAt`.
  - **`dateModified`는 updatedAt이 publishedAt보다 유의미하게 클 때만**(임계값, 예: 60초). 미달 시 생략. OG `article:modified_time`도 동일 가드. (가짜 freshness 방지 — 이 사이트 이력.)
  - **출처(sources) 섹션은 값이 비면 렌더 안 함**(빈 v-if 블록이 중간 광고와 인접해 연속 노출 회귀 유발 금지).
  - og:image는 **정적 PNG**(`/og-image.png`), webp 썸네일 아님(guide 관례 동일).
  - 목록 필터는 **client-side chip**(`?category=` 라우트 파라미터 금지 — 크롤 가능 faceted URL 방지, guide와 동일).
- viewCount는 guide의 buffered-increment(60초 flush, 테스트 스킵) 미러.
- 광고는 `<AdBanner>`(self-gating via `useAdsPolicy`) 재사용, 개수·위치 guide 상세와 동일(임의 축소 금지).

---

## File Structure

- **Create** `backend/src/services/articleService.ts` — 공개 list/recent/detail(+viewCount 버퍼). `status:'published'`.
- **Create** `backend/src/routes/articles.ts` — `GET /api/articles`·`/recent`·`/:slug`.
- **Modify** `backend/src/app.ts` — `/api/articles` 라우터 등록.
- **Create** `frontend/composables/useArticles.ts` — fetchArticles/fetchRecentArticles/fetchArticleBySlug (공개, useGuides 미러).
- **Create** `frontend/pages/article/[slug].vue` — 상세.
- **Create** `frontend/pages/article/index.vue` — 목록.
- **Modify** `frontend/server/routes/sitemap/static.xml.ts` — `/article` + 발행 article URL 루프.
- **Create** `frontend/server/routes/article-rss.xml.ts` — 별도 RSS 피드.
- **Modify** `frontend/pages/index.vue` — 홈 "오늘의 이슈" 섹션.
- **Create** tests: backend `__tests__/services/articleService.test.ts`·`__tests__/routes/articles.test.ts`; frontend `tests/composables/useArticles.test.ts`·`tests/pages/article-detail.test.ts`·`tests/pages/article-index.test.ts`.

---

## Task 1: 백엔드 공개 Article API (articleService + route) — TDD

**Files:** Create `backend/src/services/articleService.ts`, `backend/src/routes/articles.ts`; Modify `backend/src/app.ts`; Test `backend/__tests__/services/articleService.test.ts`, `backend/__tests__/routes/articles.test.ts`.

**Interfaces — Produces:** `listArticles({page,limit,category?,categories?,articleType?})→{items,total,page,totalPages}`(published만·publishedAt desc), `listRecentArticles(limit)`, `getArticleBySlug(slug)→detail|null`(published만·viewCount 버퍼 증가), `flushArticleViewCounts()`. Routes `GET /api/articles`·`/recent`·`/:slug`.

- [ ] **Step 1: 실패 테스트 — articleService** (`__tests__/services/articleService.test.ts`, `guideService` 테스트 패턴 미러). 케이스:
  - `listArticles`가 `where.status==='published'`로 필터하고 `orderBy publishedAt desc`; category/categories 필터; `{items,total,page,totalPages}` 반환.
  - `getArticleBySlug`가 미발행(draft/rejected)이면 null; published면 detail 반환 + viewCount 버퍼 증가(반환 viewCount는 +1 낙관적).
  - `flushArticleViewCounts`가 버퍼를 `prisma.article.update increment`로 flush 후 clear.
  (prisma 목: `article.count/findMany/findUnique/update`.)

- [ ] **Step 2: RED** → FAIL.

- [ ] **Step 3: `articleService.ts` 구현** — `guideService.ts` 복사 후:
  - `articleViewBuffer` Map + `flushArticleViewCounts()`(prisma.article.update) + `if (process.env.NODE_ENV!=='test') setInterval(flush, 60_000)`.
  - `ARTICLE_SELECT`(id,title,slug,summary,category,articleType,thumbnailUrl,keywords,viewCount,publishedAt,createdAt).
  - `listArticles`: `where={ status:'published', ...categoryFilter, ...(articleType?{articleType}:{}) }`, `orderBy:{publishedAt:'desc'}`.
  - `listRecentArticles(limit)`: `where:{status:'published'}`, orderBy publishedAt desc.
  - `getArticleBySlug(slug)`: `findUnique({where:{slug}})`; `if(!a || a.status!=='published') return null`; 버퍼 증가; return `{...a, viewCount:a.viewCount+1}`.

- [ ] **Step 4: 실패 테스트 — 라우트** (`__tests__/routes/articles.test.ts`, supertest, 서비스 목 또는 prisma 목). `GET /api/articles`(published 목록·페이지네이션·category 필터), `GET /api/articles/recent?limit=`, `GET /api/articles/:slug`(published 200 / 미발행·부재 404 `{success:false,error:{code:'NOT_FOUND'}}`). slug Zod `/^[a-z0-9-]+$/`.

- [ ] **Step 5: RED** → FAIL. **Step 6: `articles.ts` 구현**(guides.ts 미러: Zod 스키마 + asyncHandler + `{success,data}`) + **app.ts 등록**(import + `app.use('/api/articles', articlesRouter)` line 76 근처).

- [ ] **Step 7: GREEN** 두 테스트 + **전체 백엔드 스위트·lint·tsc** 무회귀. **Step 8: 커밋** `feat(article): 공개 Article API (published 목록·상세·viewCount 버퍼)`.

---

## Task 2: `useArticles` 공개 composable — TDD

**Files:** Create `frontend/composables/useArticles.ts`, `frontend/tests/composables/useArticles.test.ts`.

**Interfaces — Produces:** `fetchArticles(params)`, `fetchRecentArticles(limit)`, `fetchArticleBySlug(slug)`; 타입 `ArticleSummary`/`ArticleDetail`(content/sources 포함).

- [ ] **Step 1: 실패 테스트** — `useGuides` 테스트 미러. `fetchArticles`→`GET ${apiBase}/api/articles?...`·`res.data`; `fetchArticleBySlug`→`/api/articles/:slug`·`res.data`; `fetchRecentArticles`→`/api/articles/recent?limit=`. (공개 API — `credentials` 불필요.)
- [ ] **Step 2: RED → 구현**(`useGuides.ts` 미러, `useApiBase()`, `$fetch<{success,data}>`→`res.data`). `ArticleDetail.sources: Array<{title:string;url:string}>|null`. **Step 3: GREEN + 전체 프론트 테스트·lint**. **Step 4: 커밋** `feat(article): useArticles 공개 composable`.

---

## Task 3: `/article/[slug]` 상세 (SEO 핵심) — TDD

**Files:** Create `frontend/pages/article/[slug].vue`, `frontend/tests/pages/article-detail.test.ts`.

**Consumes:** `useArticles().fetchArticleBySlug`. Reuses `useFacilityMeta().setMeta`, `useStructuredData().setArticleSchema/setBreadcrumbSchema`, `<AdBanner>`, guide 마크다운 렌더·AI 안내·3rd-h2 분할.

- [ ] **Step 1: 실패 테스트** (`tests/pages/article-detail.test.ts`, mount, `useArticles` 목). 케이스:
  - 발행 article이면 제목·본문(마크다운→HTML sanitized) 렌더 + 발행일 노출.
  - `!article`이면 `createError(404)`(useAsyncData 목이 null 반환 시).
  - **sources 있으면 출처 섹션 렌더, 없으면(null/[]) 미렌더**(빈 블록 없음).
  - `setArticleSchema`가 `datePublished=publishedAt`, url=`/article/{slug}`로 호출; **dateModified는 updatedAt≈publishedAt이면 생략, 유의미 초과면 포함**(임계 60초, 양 케이스 테스트).
  - `setMeta`가 `path:'/article/{slug}'`(self-canonical)·`type:'article'`로 호출.
  - AI 작성 안내 블록 존재.

- [ ] **Step 2: RED** → FAIL.

- [ ] **Step 3: `[slug].vue` 구현** (`guide/[slug].vue` 기반):
  - `useAsyncData(\`article-${slug}\`, ()=>fetchArticleBySlug(slug))`; `if(!article.value) throw createError({statusCode:404, statusMessage:'오늘의 이슈를 찾을 수 없습니다'})`.
  - `renderedContent = computed(()=> DOMPurify.sanitize(marked(article.value.content) as string))`; `contentParts`(3rd `<h2>` 분할) + `<AdBanner v-if="contentParts[1]"/>` + 말미 `<AdBanner/>`.
  - **발행일 노출**: `article.publishedAt` 포맷 표시.
  - **출처 섹션**: `<section v-if="sources && sources.length">` — `sources` 리스트(제목+링크). 비면 미렌더.
  - **AI 작성 안내** 블록(guide 123-132 복사).
  - **카테고리 라벨/링크**: guide의 `getCategoryLabel`/hub 폴백 재사용(CATEGORY_META→REAL_ESTATE_META→특수). 내부링크 CTA는 본문에 이미 포함(Phase 1 생성기).
  - **`dateModified` 가드**: `const modified = (new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime() > 60_000) ? article.updatedAt : undefined`.
  - `setMeta({ title:\`${title} | 오늘의 이슈\`, description: summary, path:\`/article/${slug}\`, type:'article', image:\`${SITE_URL}/og-image.png\` })`.
  - `setBreadcrumbSchema([{name:'홈',url:'/'},{name:'오늘의 이슈',url:'/article'},{name:title,url:\`/article/${slug}\`}])`.
  - `setArticleSchema({ headline:title, description:summary, datePublished: article.publishedAt, dateModified: modified, url:\`/article/${slug}\`, image: thumbnailUrl?…:undefined })`.
  - OG article times(raw useHead): `article:published_time=publishedAt`, `article:modified_time=modified||publishedAt`.

- [ ] **Step 4: GREEN + 전체 프론트 테스트·lint**. **Step 5: 커밋** `feat(article): /article/[slug] 상세 (자기 canonical·Article JSON-LD·출처·AI 안내)`.

---

## Task 4: `/article/index` 목록 — TDD

**Files:** Create `frontend/pages/article/index.vue`, `frontend/tests/pages/article-index.test.ts`.

- [ ] **Step 1: 실패 테스트** — `guide/index.vue` 패턴 미러. 마운트 시 `fetchArticles({page:1,limit:12})`; 카드 렌더(제목·카테고리·발행일); chip 필터 전환 시 `fetchArticles({categories})` 재호출(client-side, 라우트 파라미터 없음); 페이지네이션; `setMeta({path:'/article'})`·`setBreadcrumbSchema`·`setItemListSchema` 호출.
- [ ] **Step 2: RED → 구현**(`guide/index.vue` 미러): Breadcrumb + PageHero("오늘의 이슈") + 카테고리 chip(client activeChip) + 최신 카드 그리드(발행일순) + 빈 상태 + `<AdBanner>` + Pagination. 최신 1건 히어로 강조는 선택(간단히 목록 상단). SEO: `setMeta({title:'오늘의 이슈 | 일상킷', path:'/article'})`, breadcrumb, itemList. 카드 링크 `/article/{slug}`.
- [ ] **Step 3: GREEN + 전체 프론트 테스트·lint**. **Step 4: 커밋** `feat(article): /article 목록 (히어로·카테고리 필터·아카이브)`.

---

## Task 5: 사이트맵 + RSS + 홈 통합 — TDD

**Files:** Modify `frontend/server/routes/sitemap/static.xml.ts`, `frontend/pages/index.vue`; Create `frontend/server/routes/article-rss.xml.ts`; Test(가능 범위) sitemap/홈.

- [ ] **Step 1: 사이트맵** — `static.xml.ts`에 `/article` 리스트 URL + 발행 article 루프 추가(`/api/articles?limit=100&page=` 페이지네이션, `loc=${SITE_URL}/article/${slug}`, `lastmod=publishedAt`(ISO date), guide 루프와 동일 구조, `MAX` 캡). count-drop 가드는 추가에 무관(신규 URL 증가).
- [ ] **Step 2: RSS** — `article-rss.xml.ts` 신설(`/article-rss.xml`): `ssrFetch('/api/articles?limit=50')` → items(`link=…/article/${slug}`, `pubDate=publishedAt`) → `generateRssXml(items, { title:'일상킷 - 오늘의 이슈', link:'https://ilsangkit.co.kr/article', description:'…' })`. catch 시 빈 피드. `s-maxage=3600`.
- [ ] **Step 3: 홈** — `pages/index.vue`의 `Promise.allSettled`에 `/api/articles/recent?limit=4` 추가 → `recentArticles` computed → 생활 가이드 섹션(라인 148-198) 뒤에 "오늘의 이슈" 섹션(동일 카드 그리드, "더보기"→`/article`, `v-if="recentArticles.length"`).
- [ ] **Step 4: 테스트**(sitemap article URL 포함·홈 섹션 조건부 — 가능 범위) + 전체 프론트 테스트·lint. **Step 5: 커밋** `feat(article): 사이트맵·RSS·홈 오늘의 이슈 통합`.

---

## Self-Review (spec Phase 3 대비)

- 공개 API published만·publishedAt 정렬·viewCount 버퍼 → Task 1. ✅
- useArticles → Task 2. ✅
- 상세: 마크다운 렌더·발행일·**출처 hide-if-empty**·AI 안내·**자기 canonical**·**Article(NewsArticle 아님) JSON-LD·datePublished=publishedAt·dateModified 가드**·광고 3rd-h2·og 정적PNG → Task 3. ✅
- 목록: 히어로·client chip 필터(faceted URL 없음)·아카이브·breadcrumb/itemList → Task 4. ✅
- 사이트맵(published·lastmod=publishedAt)·별도 RSS·홈 섹션 → Task 5. ✅
- 카테고리 라벨은 guide `getCategoryLabel` 재사용(Article.category ∈ GUIDE_CATEGORIES) — 신규 맵 불필요. ✅
- 신규 의존성 없음. ✅

## Out of Scope (이 PR)
마이그레이션·38 news 가이드→/article 301 컷오버(=Phase 4). cron 자동화(=Phase 5). 어드민(완료). **주의: 이 Phase는 /article을 공개하지만 아직 발행된 article이 없을 수 있음**(어드민이 발행해야 노출) — 페이지는 빈 목록에도 안전해야 함(빈 상태 처리). Phase 4 컷오버가 38건을 published article로 채우면 콘텐츠가 참.

## Risks
- **빈 콘텐츠**: 발행 article 0건이면 /article·사이트맵·RSS가 빈 상태 — 정상(빈 상태 UI·빈 피드). Phase 4에서 채워짐.
- **가짜 freshness**: dateModified 가드 필수(안 하면 이 사이트가 데인 패턴 재발).
- **광고 인접 회귀**: 출처 섹션 hide-if-empty 필수.
- 배포 후 라이브 검증: /article/[slug] canonical==자기 URL, JSON-LD Article·datePublished, 사이트맵에 published만.

## Phase 완료 기준(DoD)
- 백엔드·프론트 `npm run test` green(신규 포함)·`lint` 0 errors(Node 20).
- /article·/article/[slug] 렌더·404·SEO 메타/JSON-LD/canonical·출처 hide-if-empty·광고, 사이트맵/RSS published만이 테스트로 검증.
- 기존 스위트 무회귀. draft/rejected 미노출.
