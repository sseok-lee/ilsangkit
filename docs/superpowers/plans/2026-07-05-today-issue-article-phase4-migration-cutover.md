# 오늘의 이슈(/article) — Phase 4: 마이그레이션 + 301 컷오버 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 news 타입 가이드 38건을 발행된(published) `/article`로 이전하고, `/guide/[slug]` → `/article/[slug]` **301**을 발효시켜, 축적된 검색 자산을 중복 없이 승계한다. **코드**(동적 301 폴백 + 멱등 마이그레이션 스크립트)를 빌드·배포하고, **실제 마이그레이션 실행**은 배포 후 조율된 운영 단계로 수행한다.

**Architecture:** 컷오버 무중복 핵심은 **동적 301 폴백**: `/guide/[slug].vue`가 Guide-miss 시 published Article을 조회해 있으면 `navigateTo('/article/'+slug, {redirectCode:301})`. 이 코드를 **먼저 배포**(inert — Article이 guide slug와 매칭 안 되므로 무동작)한 뒤, 마이그레이션 스크립트가 **per-slug 트랜잭션**으로 `[Article insert(published) + Guide delete]`를 실행 → Guide 행이 삭제되는 순간 301이 활성화(어느 순간에도 같은 slug가 양쪽 200이 되지 않음). 이전 대상은 고정된 38건(신규 news 생성 없음 확인).

**Tech Stack:** Nuxt 3(SSR)·`navigateTo` redirect, Express·Prisma(`$transaction`·`$executeRaw`)·Node fs, Vitest.

## Global Constraints

- **Node 20 필수** — 모든 `npm`/`npx`/`vitest`/`db` 전에 `source ~/.nvm/nvm.sh && nvm use 20`.
- **package-lock.json 삭제·재생성 금지. 신규 의존성 없음.**
- **ESM**: 로컬 import `.js`. 백엔드 `cd backend`, 프론트 `cd frontend`.
- **마이그레이션은 프로덕션 데이터 변경** — 스크립트는 반드시 **dry-run 모드**(`--dry-run`) + **멱등성**(이미 이전된 slug 스킵) 제공. 실행은 배포 후 조율(운영 섹션).
- **필드 매핑(가짜 freshness 방지)**: articleType `news`→`news-brief`, `publishedAt=원 createdAt`, **`updatedAt`은 raw SQL로 원 createdAt 기입**(@updatedAt이 now()로 덮는 것 방지 — 이 사이트가 데인 패턴), viewCount 보존, category/title/slug/summary/content/keywords 그대로, sources=null, status='published'.
- **썸네일**: `guides/{slug}.webp` → `articles/{slug}.webp` 파일 복사(원본 삭제 아님, 복사). 원본 없으면 경고 후 계속(thumbnailUrl은 articles 경로로 재지정).
- **동적 301 폴백은 리다이렉트 경로에서 null guide로 하위 setMeta/schema가 crash하면 안 됨** — 하위 메타 호출을 guide 존재 가드로 감싼다.
- 컷오버 후 사이트맵은 **force 재생성** 필요(/guide 축소·/article 확장). count-drop 가드가 대량 축소(38건)를 막을 수 있으므로 `Regen Sitemaps` workflow_dispatch(force) 사용.

---

## File Structure

- **Modify** `frontend/pages/guide/[slug].vue` — Guide-miss 시 Article 조회 → 301 폴백.
- **Modify** `frontend/tests/pages/guide-*.test.ts`(있으면) 또는 Create `frontend/tests/pages/guide-article-301.test.ts` — 폴백 테스트.
- **Create** `backend/src/scripts/migrateNewsGuidesToArticles.ts` — 멱등 마이그레이션(dry-run).
- **Create** `backend/__tests__/scripts/migrateNewsGuidesToArticles.test.ts` — 매핑·트랜잭션·dry-run·멱등·썸네일 복사 테스트.
- **Modify** `backend/package.json` — `migrate:news-articles` 스크립트.

---

## Task 1: `/guide/[slug]` 동적 301 폴백 (배포 시 inert) — TDD

**Files:** Modify `frontend/pages/guide/[slug].vue`; Create/Modify test.

**Interfaces — Consumes:** `useArticles().fetchArticleBySlug`(published Article 반환, 미발행/부재 시 throw→catch로 null). Produces: guide-miss 시 `/article/{slug}` 301 또는 404.

- [ ] **Step 1: 실패 테스트** (`frontend/tests/pages/guide-article-301.test.ts`, `useAsyncData`/`useArticles`/`navigateTo`/`createError` 목):
  - guide 존재 → 정상 렌더(기존 동작 불변, navigateTo 미호출).
  - guide 없음 + Article 있음 → `navigateTo('/article/{slug}', { redirectCode: 301 })` 호출, createError 미호출.
  - guide 없음 + Article 없음 → `createError(404)`.
  (`navigateTo`/`createError`는 setup.ts에 전역 목 없으면 `vi.stubGlobal`로 스텁.)

- [ ] **Step 2: RED** → FAIL.

- [ ] **Step 3: 구현** — `frontend/pages/guide/[slug].vue`의 현재 블록(line 176-184):
  ```ts
  const { data: guide, status } = await useAsyncData(
    `guide-${slug.value}`,
    () => fetchGuideBySlug(slug.value),
  )
  if (!guide.value) {
    throw createError({ statusCode: 404, statusMessage: '가이드를 찾을 수 없습니다' })
  }
  ```
  를 다음으로 교체 (상단 import에 `import { useArticles } from '~/composables/useArticles'` 추가, `const { fetchArticleBySlug } = useArticles()` 선언):
  ```ts
  const { data: guide, status } = await useAsyncData(
    `guide-${slug.value}`,
    () => fetchGuideBySlug(slug.value),
  )
  if (!guide.value) {
    // 이전된 news 가이드: 같은 slug의 published Article이 있으면 /article로 영구(301) 이동.
    const migrated = await fetchArticleBySlug(slug.value).catch(() => null)
    if (migrated) {
      await navigateTo(`/article/${slug.value}`, { redirectCode: 301, replace: true })
    } else {
      throw createError({ statusCode: 404, statusMessage: '가이드를 찾을 수 없습니다' })
    }
  }
  ```
  **그리고 하위의 setMeta/setBreadcrumbSchema/setArticleSchema 등 guide.value.X를 참조하는 side-effect 호출 블록을 `if (guide.value) { ... }`로 감싼다**(리다이렉트 경로에서 guide.value=null인 채 실행되어 crash하는 것 방지). computed들은 이미 `if (!guide.value) return ''` 가드가 있어 안전.

- [ ] **Step 4: GREEN + 전체 프론트 테스트·lint** — 기존 guide 렌더 테스트 무회귀 확인(정상 guide는 동작 불변). **Step 5: 커밋** `feat(article): /guide/[slug] 이전 news→/article 301 동적 폴백 (컷오버 inert)`.

---

## Task 2: 멱등 마이그레이션 스크립트 (news 가이드 38 → published Article) — TDD

**Files:** Create `backend/src/scripts/migrateNewsGuidesToArticles.ts`, `backend/__tests__/scripts/migrateNewsGuidesToArticles.test.ts`; Modify `backend/package.json`.

**Interfaces — Produces:** `parseMigrateOptions(args)→{dryRun}`, `mapGuideToArticleData(guide)→ArticleCreateData`, `migrateNewsGuides({dryRun}):Promise<{migrated:number, skipped:number, thumbnailsCopied:number, failures:string[]}>`. npm `migrate:news-articles`.

- [ ] **Step 1: 실패 테스트** (mock `prisma.guide.findMany/delete`, `prisma.article.create/findUnique`, `prisma.$transaction`, `prisma.$executeRaw`, `fs/promises` copyFile/stat):
  - `mapGuideToArticleData`: articleType 'news'→'news-brief', publishedAt=createdAt, status='published', viewCount 보존, sources=null, slug/title/content/summary/category/keywords 복사, thumbnailUrl=`/api/images/articles/{slug}.webp`.
  - `migrateNewsGuides` dry-run: 대상 조회만, `article.create`/`guide.delete`/copyFile **미호출**, 예상 건수 반환.
  - 실제 실행: 각 guide에 대해 `$transaction([article.create, guide.delete])` 호출 + `$executeRaw`로 updatedAt=createdAt 세팅 + 썸네일 copyFile 호출.
  - **멱등성**: 이미 같은 slug의 Article이 존재하면 그 guide는 스킵(create/delete 안 함), skipped 카운트 증가.
  - 썸네일 원본 없음(stat/copy throw) → 경고, thumbnailsCopied 미증가, 하지만 마이그레이션은 계속(thumbnailUrl은 그대로 지정).
  - 결과 `{migrated, skipped, thumbnailsCopied, failures}` 반환.

- [ ] **Step 2: RED** → FAIL.

- [ ] **Step 3: 구현** `migrateNewsGuidesToArticles.ts`:
  ```ts
  import 'dotenv/config';
  import path from 'path';
  import { fileURLToPath } from 'url';
  import { copyFile, stat } from 'fs/promises';
  import prisma from '../lib/prisma.js';

  export interface MigrateOptions { dryRun: boolean; }
  export function parseMigrateOptions(args = process.argv.slice(2)): MigrateOptions {
    return { dryRun: args.includes('--dry-run') };
  }

  export function mapGuideToArticleData(g: { slug:string; title:string; content:string; summary:string; category:string; keywords:string|null; viewCount:number; createdAt:Date; }) {
    return {
      slug: g.slug, title: g.title, content: g.content, summary: g.summary,
      category: g.category, articleType: 'news-brief',
      keywords: g.keywords, viewCount: g.viewCount,
      thumbnailUrl: `/api/images/articles/${g.slug}.webp`,
      sources: undefined, // Json? → null; Prisma에서 미지정 시 null
      status: 'published', publishedAt: g.createdAt, createdAt: g.createdAt,
    };
  }

  function imagesDir(sub: string): string {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images');
    return path.join(uploadDir, sub);
  }

  export async function migrateNewsGuides(opts: MigrateOptions) {
    const guides = await prisma.guide.findMany({ where: { articleType: 'news' } });
    let migrated = 0, skipped = 0, thumbnailsCopied = 0; const failures: string[] = [];
    for (const g of guides) {
      const existing = await prisma.article.findUnique({ where: { slug: g.slug }, select: { id: true } });
      if (existing) { skipped++; continue; } // 멱등
      if (opts.dryRun) { migrated++; continue; }
      try {
        const data = mapGuideToArticleData(g);
        await prisma.$transaction([
          prisma.article.create({ data }),
          prisma.guide.delete({ where: { id: g.id } }),
        ]);
        // @updatedAt이 now()로 세팅되므로 원 createdAt으로 되돌림(가짜 freshness 방지)
        await prisma.$executeRaw`UPDATE Article SET updatedAt = ${g.createdAt} WHERE slug = ${g.slug}`;
        migrated++;
        // 썸네일 복사(원본 없으면 경고)
        try {
          const src = path.join(imagesDir('guides'), `${g.slug}.webp`);
          await stat(src);
          await copyFile(src, path.join(imagesDir('articles'), `${g.slug}.webp`));
          thumbnailsCopied++;
        } catch { console.warn(`썸네일 원본 없음/복사 실패: ${g.slug}`); }
      } catch (err) { failures.push(`${g.slug}: ${err instanceof Error ? err.message : err}`); }
    }
    return { migrated, skipped, thumbnailsCopied, failures };
  }

  async function main() {
    const opts = parseMigrateOptions();
    console.log(`[migrate] news 가이드 → Article ${opts.dryRun ? '(DRY-RUN)' : '(실행)'}`);
    const r = await migrateNewsGuides(opts);
    console.log(`[migrate] 결과: migrated=${r.migrated} skipped=${r.skipped} thumbnails=${r.thumbnailsCopied} failures=${r.failures.length}`);
    if (r.failures.length) console.error(r.failures.join('\n'));
  }
  if (import.meta.url === `file://${process.argv[1]}`) {
    main().then(()=>{process.exitCode=0;}).catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect().catch(()=>{}));
  }
  ```
  (articles 이미지 디렉터리 생성 보장: 필요 시 copyFile 전 `mkdir(imagesDir('articles'),{recursive:true})`.)

- [ ] **Step 4: `package.json`에 스크립트 추가** — `"migrate:news-articles": "tsx src/scripts/migrateNewsGuidesToArticles.ts"`.

- [ ] **Step 5: GREEN + 전체 백엔드 테스트·lint·tsc**. **Step 6: 커밋** `feat(article): news 가이드→published Article 멱등 마이그레이션 스크립트(dry-run·updatedAt raw)`.

---

## 운영 컷오버 Runbook (코드 아님 — 배포 후 조율 실행)

**전제**: Task 1·2 코드가 develop→main 머지·Cafe24 배포 완료(301 폴백 inert 라이브).

- [ ] **R1. DB 백업** — 프로덕션 MySQL 백업(38 guide 삭제 전 안전망). 데이터는 Article로 이동이라 유실 아니지만 권장.
- [ ] **R2. dry-run** — 서버 SSH: `node dist/scripts/migrateNewsGuidesToArticles.js --dry-run` → migrated=38 예상 확인.
- [ ] **R3. 실제 마이그레이션** — `node dist/scripts/migrateNewsGuidesToArticles.js` → migrated≈38·thumbnails≈38·failures=0 확인. 이 순간 각 삭제된 guide slug는 /guide→301→/article로 전환.
- [ ] **R4. 사이트맵 force 재생성** — `Regen Sitemaps` workflow_dispatch(force=true)(count-drop 가드 우회, /guide 축소·/article 확장).
- [ ] **R5. 수용 게이트 라이브 검증**:
  - 임의 이전 slug: `/guide/{slug}` → **301** → `/article/{slug}` → **200** (양쪽 동시 200 아님).
  - `/api/guides` total = 11(evergreen만), `/api/articles` total ≥ 38.
  - 서빙 사이트맵: `/article/{slug}` 존재, 이전된 `/guide/{slug}` 부재.
  - `/article/{slug}` canonical == 자기 URL.
  - 캐시 퍼지 필요 시(nginx/Nitro) 수행.
- [ ] **R6. (선택) 네이버 SA/구글 재제출** — 사이트맵·RSS 갱신 반영.

---

## Self-Review (spec §6 대비)

- 동적 301 폴백(inert 선배포 → 무중복 컷오버) → Task 1. ✅ (setup 리다이렉트 경로 null-guard 포함)
- per-slug 트랜잭션(insert+delete) + 멱등 + dry-run → Task 2. ✅
- 필드 매핑(news→news-brief·publishedAt=createdAt·**updatedAt raw=가짜freshness 방지**·viewCount 보존·sources null) → Task 2. ✅
- 썸네일 복사(guides→articles) → Task 2. ✅
- 사이트맵 force·수용 게이트 → 운영 Runbook. ✅
- 신규 의존성 없음. ✅

## Out of Scope
generateGuide news 생성 하드 제거(D3) — 현재 서버 crontab 없음 확인(비활성)이라 재오염 위험 없음. 필요 시 별도 소규모 작업. Phase 5(cron 자동화)는 별도.

## Risks
- **동적 폴백 SSR 리다이렉트**: navigateTo(redirectCode) 후 하위 setup이 null guide로 실행되지 않도록 guard 필수(Task 1). 리뷰서 SSR 동작 정밀 확인.
- **컷오버 실행은 프로덕션 데이터**: dry-run + 백업 + per-slug 트랜잭션 + 수용 게이트로 방어. 마이그레이션은 코드 배포 후 조율 실행.
- **사이트맵 count-drop 가드**: /guide 38건 축소가 가드에 막힐 수 있어 force 재생성 필수(trash 선례).

## Phase 완료 기준(DoD — 코드)
- 프론트/백엔드 `npm run test` green(신규 포함)·`lint` 0(Node 20).
- 301 폴백: 정상 guide 불변·이전 slug 301·부재 404 테스트. 마이그레이션: 매핑·트랜잭션·dry-run·멱등·썸네일 테스트.
- 기존 스위트 무회귀. (실제 컷오버 실행은 배포 후 운영 Runbook.)
