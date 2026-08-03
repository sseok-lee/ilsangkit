# 오늘의 이슈 (/article) 설계 문서

> 작성일: 2026-07-04
> 상태: 설계 확정 대기 (브레인스토밍 산출물). 4-렌즈 적대적 리뷰(SEO·보안·아키텍처·완결성) 반영 완료. 구현 계획은 writing-plans에서 Phase별로 별도 생성.

## Goal

일상킷에 **"오늘의 이슈"(`/article`)** 콘텐츠 스트림을 신설한다. 기존 뉴스 생성 파이프라인을 이 스트림 전용 엔진으로 정식 분리하고, **초안 생성 → 어드민 검토 → 발행**의 사람-개입(human-in-the-loop) 워크플로우를 붙여, 사람이 한 번 거른 시의성 콘텐츠만 라이브 색인에 올린다.

**한 줄 요약:** 뉴스 훅으로 유입을 만들고, 일상킷의 실데이터로 연결하는 "뉴스 훅 + 유틸리티 다리" 콘텐츠를, 어드민 검토를 거쳐 발행한다.

---

## Background & Context

브레인스토밍 중 발견: 요청된 기능의 상당 부분이 이미 존재한다.

- **`backend/src/scripts/generateGuide.ts`** (919줄) — 네이버 뉴스 트렌드 발굴 → 뉴스·블로그 리서치 → OpenAI(`gpt-4o-mini`) 2단계 글 생성 → `gpt-image-1` 썸네일 → DB 저장. 이미 뉴스·정책 전용 편집 계약(`news-brief`/`policy-explainer`/`living-impact`/`data-update`/`how-to-check` + AI슬롭 방지·출처 우선순위·상대날짜 금지)을 갖고 있다.
- **`Guide` 모델 + `/api/guides` + `/guide`·`/guide/[slug]`** — 마크다운(`marked` + `isomorphic-dompurify`) 렌더, "AI 작성 안내" 배너, JSON-LD Article 스키마, 중간 광고 삽입까지 완비. `Guide`는 DB 컬럼으로 `title/slug/content/summary/category/articleType/thumbnailUrl/keywords/published/viewCount/createdAt/updatedAt`을 모두 저장(라이브 API 확인).
- `openai ^6.25.0`, `bcryptjs ^3.0.3`, `express-rate-limit ^8.3.1` 설치됨. **`jsonwebtoken`·`cookie-parser`·`cwebp`는 없음**(신규 필요).

라이브 코퍼스 확인(2026-07-03): **가이드 전체 49건 중 news 타입 38건(78%)**, 최신 글이 당일 생성. 즉 `/guide`는 사실상 대부분 "오늘의 이슈"였다. 이 프로젝트는 "새 엔진 신설"보다 **기존 뉴스 파이프라인의 정식 분리 + 자동화 + 사람 검토 게이트 추가**에 가깝다.

### 이 사이트의 제약 (메모리 기반)
- **중복/얇은/스테일 콘텐츠 SEO 이력**: 네이버 노출 -83%, noindex 사고, 크롤 예산 낭비, 가짜 lastmod, crawled-but-not-indexed 만성. 새 콘텐츠 스트림은 이 실패모드를 특히 경계.
- **크롤 예산 병목**: GSC 발견율 ~42%. 병목은 크롤예산 × 색인수율. 저품질 대량 발행은 머니 페이지(부동산·시설)의 크롤 예산을 갉아먹음.
- **PR 기반**: 모든 변경 PR 경유, main 직접 커밋 금지, CI 통과 후 머지.
- **TDD 선호**, **데이터 수집 최대화**(소스 전량 저장).
- **Node 20 필수**, ESM(`.js` 확장자), **package-lock.json 삭제·재생성 금지**(Node 20에서 기존 lock 유지한 채 `npm install`).
- Express 5 query/params read-only(→ `validate.ts`가 `Object.defineProperty`로 이미 처리).
- **AdBanner 배치 정책은 사용자 결정** — 임의 축소 금지. **광고는 조건부 아닌 항상-렌더 블록에 앵커**(빈 v-if 섹션이 광고 사이에 끼면 연속 노출 회귀).
- **썸네일 함정**: 현재 코드는 ImageMagick `convert` 의존이고 실패 시 **PNG를 `.webp`로 그대로 저장**(Safari 거부). `cwebp`는 레포·서버에 미확인.

---

## 확정된 설계 결정 (브레인스토밍 + 리뷰 반영)

| # | 결정 | 상태 | 근거 |
|---|---|---|---|
| D1 | **별개 콘텐츠 스트림** (가이드와 분리) | ✅ 사용자 확정 | 시의성·상시 콘텐츠 코퍼스 분리, 중복 방지 |
| D2 | **카테고리 밀착 "뉴스 훅 + 유틸리티 다리"** | ✅ 사용자 확정 | 넓은 뉴스는 도메인 권위상 못 이김 → 얇은 미색인. 사이트 실데이터 연결이 유일한 해자 |
| D3 | **역할 재정의**: `/guide`=상시 how-to only, `/article`=시의성 뉴스/정책 only. **news 생성 경로는 generateGuide에서 하드 제거**(옵션 아님) | ✅ 사용자 확정 (하드제거는 리뷰 반영) | D1을 실제로 지키는 필수 짝 결정. soft 제거 시 news 재유입 위험 |
| D4 | **초안 → 어드민 검토 → 발행** (자동 발행 없음) | ✅ 사용자 확정 | AI 콘텐츠 SEO 리스크를 사람이 색인 전 흡수 |
| D5 | **아카이브 유지 + GSC 기반 stale noindex** (자동 만료·삭제는 없음, 단 8주+ crawled-but-not-indexed는 noindex로 색인 레이스에서 제외) | ✅ 사용자 확정(예방적 noindex) | "no noindex ever"는 크롤예산 병목 사이트에 과소무장. 예방적 통제 추가 |
| D6 | **발행일 UI 노출 + 본문은 절대날짜만** | ✅ 확정 | 신선도 신호는 UI/스키마로, 본문은 안 썩게 |
| D7 | **`Article` 스키마 (NewsArticle 아님) + 자기-canonical** | ✅ 확정(canonical은 리뷰 반영) | NewsArticle은 뉴스 퍼블리셔 심사 유발. 301된 /guide로 canonical 새는 것 방지 |
| D8 | **불투명 서버 세션**(MySQL 세션 + 랜덤 세션ID 쿠키). JWT 대신 채택 | 🔧 리뷰 반영(JWT→DB세션) | 로그아웃·유출 시 진짜 revocable. jsonwebtoken 의존 회피 |
| D9 | **신규 `Article` Prisma 모델** | ✅ 확정 | 검토 상태·발행일 분리·출처는 `published:boolean`으론 부족 |
| D10 | **하루 후보 3건** 생성, 사람이 선별 발행 | ✅ 기본값(확장 가능) | 홍수 방지. 색인 건강하면 확장 |

---

## Architecture

### 1. 데이터 모델

`backend/prisma/schema.prisma`에 신규 모델 추가:

```prisma
model Article {
  id           String    @id @default(cuid())
  title        String    @db.VarChar(200)
  slug         String    @unique @db.VarChar(200)
  content      String    @db.LongText          // 마크다운 원문
  summary      String    @db.VarChar(500)
  category     String    @db.VarChar(50)       // GUIDE_CATEGORIES 중 하나
  articleType  String    @db.VarChar(20)       // news-brief|policy-explainer|living-impact|data-update|how-to-check
  thumbnailUrl String?   @db.VarChar(500)
  keywords     String?   @db.VarChar(500)
  sources      Json?                           // [{title,url,publisher,date}] 리서치 출처 전량
  status       String    @default("draft")     // draft | published | rejected
  viewCount    Int       @default(0)
  publishedAt  DateTime?                        // 어드민 발행 시점 (draft/rejected는 null)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([status, publishedAt])
  @@index([category])
  @@index([slug])
  @@index([articleType])
}
```

- `status`: draft(생성 직후) | published(어드민 발행) | rejected(어드민 반려—숨김·보관, 재생성 dedup용). **세 상태 모두 엔드포인트로 도달 가능해야 함**(§2).
- `sources`: 데이터 수집 최대화 원칙에 따라 리서치에 실제 사용한 출처 전량(≤~20건).
- `viewCount`: **dead 아님** — §5의 조회수 증가 경로로 연결. 마이그레이션 시 원 Guide viewCount 보존.
- `publishedAt`: 발행 순 정렬·`datePublished`·사이트맵 lastmod의 단일 소스.

**크로스 테이블 slug 충돌 방지**: `Article.slug`는 Article 내 unique이지만, 생성기·마이그레이션은 **Guide.slug와도 충돌하지 않도록** 교차 확인(충돌 시 suffix). 동일 slug가 /guide·/article 양쪽 200이 되는 근접중복 방지. 테스트 포함.

### 2. 라우트 & API

**공개 프론트엔드:** `/article`(목록), `/article/[slug]`(상세)
**어드민 프론트엔드:** `/admin/login`, `/admin`(초안 큐+검토)

**공개 백엔드 API** (`backend/src/routes/articles.ts`, `asyncHandler`+Zod `validate`):
- `GET /api/articles` — `status='published'`만, 페이지네이션, `category`/`articleType` 필터, `publishedAt DESC`
- `GET /api/articles/:slug` — published 상세 (아니면 404). 조회수 버퍼 증가(§5).

**어드민 백엔드 API** (`backend/src/routes/admin.ts`, `requireAdmin` 필수. 아래 §4 보안):
- `POST /api/admin/login` `{password}` → 세션 생성 + 쿠키
- `POST /api/admin/logout` → 세션 DB 무효화 + 쿠키 삭제
- `GET /api/admin/session` — 세션 유효성(프론트 가드)
- `GET /api/admin/articles` — 초안 포함 전체, status 필터
- `GET /api/admin/articles/:id`
- `PATCH /api/admin/articles/:id` — 제목·요약·키워드·본문 편집 (sanitize 예외 대상, §4)
- `POST /api/admin/articles/:id/publish` — status=published, publishedAt=now()(최초 1회만)
- `POST /api/admin/articles/:id/unpublish` — status=draft
- `POST /api/admin/articles/:id/reject` — status=rejected (숨김·보관; 공개·재생성에서 제외)
- `DELETE /api/admin/articles/:id` — 하드 삭제 + 썸네일 파일 안전 정리(§4)
- `POST /api/admin/articles/:id/regenerate` — 해당 초안 reject + 동일 category로 새 후보 1건 생성(in-place 아님)
- `POST /api/admin/articles/generate` `{count?, category?}` → 단일-플라이트 락 하에 백그라운드 생성 잡, 202 (또는 진행 중이면 409)

### 3. 생성 엔진

`backend/src/scripts/generateArticle.ts` — 기존 `generateGuide.ts`의 뉴스 경로를 포크·재점화.

- **공유 코어 추출** → `backend/src/services/articleGenerationCore.ts`:
  - 추출 대상: `discoverTrendingKeyword`, `researchByKeyword`(이미 export), `generateArticleMeta`·`generateSectionBody`·`generateThumbnail`(**현재 private → export화 필요**).
  - 오케스트레이션(‑recent-title dedup `getRecentTitles`, 내부링크 `buildInternalLinks`)은 **Guide에 결합**돼 있으므로 Article 전용으로 재작성. **dedup는 Guide+Article 교차 조회**(마이그레이션된 news 포함)로 중복 키워드 회피.
- **저장**: `Article` upsert, `status:'draft'`, `publishedAt:null`. **자동 발행 절대 없음.**
- **출처 캡처**: 리서치에 사용한 네이버 뉴스/블로그 결과를 `{title,url,publisher,date}`로 `sources`에 전량 기록.
- **품질 게이트 승계**: `validateInfoArticleQuality`(길이·금지 AI슬롭·상대날짜) 실패 시 draft 저장 안 함.
- **썸네일 (리뷰 반영 — 함정 회피)**:
  - 현재 `execFileSync('convert', …)` + catch에서 PNG-as-webp 폴백은 **제거**. 폴백을 "PNG 저장" 대신 **명시적 throw**(썸네일 실패=초안 미생성)로 변경.
  - 인코딩은 **서버에 실제 존재가 확인된 바이너리**로. **Cafe24 서버 cwebp/convert 설치 여부는 Phase 1 착수 전 실측 필요**(Open Q3). 미설치 시 (a) 서버 프로비저닝(libwebp 설치) 또는 (b) 생성을 CI/로컬에서 수행하고 이미지 SCP — 둘 중 하나를 확정.
- **입력 검증**: CLI `--count`(정수, 1..3 clamp)·`--category`(`isGuideCategory` allowlist). `GUIDE_CATEGORIES` 라운드로빈(가중치는 Open Q1에서 확정).
- **가이드 생성기 역할 변경 (D3, 하드)**: `generateGuide.ts`에서 **뉴스 트렌드 생성 경로 완전 제거**. `generateGuide`가 news/policy 계열 articleType을 방출할 수 없음을 **테스트로 강제**. 뉴스 생성 책임은 전부 `generateArticle.ts`.

### 4. 어드민 (인증 + 생성 트리거) — 보안 (리뷰 대폭 반영)

라이브 색인 사이트에 콘텐츠를 발행하는 권한 → defacement·스팸 주입(SEO 오염) 공격면. obscurity 아닌 실제 인증.

**세션 (불투명 DB 세션):**
- `POST /api/admin/login {password}` → env `ADMIN_PASSWORD_HASH`와 **bcrypt 비교**. **fail-closed**: `ADMIN_PASSWORD_HASH` 미설정 시 서버 기동 실패(또는 로그인 항상 거부). `bcrypt.compare(pw, undefined)` falsey 경로 방지.
- 성공 시 **랜덤 세션ID(≥256bit)** 생성 → `AdminSession` 테이블(만료 `expiresAt` 8–24h, revocable) 저장 → 쿠키에 세션ID만: **httpOnly · Secure(prod) · SameSite=Strict · host-scoped(Domain 미설정) · Path=/**.
- `requireAdmin` 미들웨어: 쿠키 세션ID → DB 조회 → 만료·무효 시 401. 모든 `/api/admin/*`(login 제외) 적용.
- `logout`: 세션 행 삭제(진짜 revoke) + 쿠키 만료.
- 쿠키 파싱: `cookie-parser` 추가(또는 수동 파싱). JWT/jsonwebtoken **불필요**(DB 세션 채택).

**브루트포스 (리뷰 blocker 반영):**
- **기존 rateLimit 미들웨어 재사용 금지** — loopback(127.0.0.1) 스킵이 있어 prod에서 백엔드가 loopback 바인딩이면 **모든 요청이 스킵**되어 무력화. 또한 XFF depth(nginx+Nitro=2 vs `trust proxy 1`) 불일치로 client IP가 loopback으로 붕괴하거나 공격자가 `X-Forwarded-For: 127.0.0.1`로 자기-면제 가능.
- 로그인 전용 **loopback 스킵 없는 별도 리미터**(예: 5회/15분) + **계정 단위 실패 잠금**(단일 관리자이므로 IP 비의존 카운터/락아웃) → IP 신뢰에 의존하지 않음. `trust proxy` 실제 홉 수 재정합 + `req.ip`가 nginx→Nitro→backend 관통해 진짜 client IP를 반영하는지 테스트.

**sanitizeInput 예외 (리뷰 major 반영):**
- 글로벌 `sanitizeInput`(DOMPurify, 모든 body 문자열에서 태그 제거)이 (a) 로그인 password를 훼손해 bcrypt 불일치·공간 축소, (b) 마크다운 본문(`<` 포함)을 저장 시 손상시킴.
- **어드민 라우터를 글로벌 sanitizeInput 앞에 마운트**하거나 경로 allowlist로 예외. password는 **어떤 HTML sanitizer도 통과 금지**. 본문은 출력 시점(공개 상세의 marked+DOMPurify)에서만 정화. `<` 포함 password·content 왕복 불변 테스트.

**생성 트리거 (리뷰 major 반영 — 자원/비용/풀 고갈 방지):**
- `POST /api/admin/articles/generate`: **Zod 검증** — `count` 정수 1..3 clamp, `category` `z.enum(GUIDE_CATEGORIES)`(`isGuideCategory` allowlist 재사용). 값은 discrete spawn 배열 인자로만 전달(shell/exec 금지, 보간 금지).
- **단일-플라이트 락**(DB 행/PID 파일): 동시 생성 1건만, 중복 요청 409. generate 전용 레이트리밋(시간당 소수). 총 일일 실행 상한.
- spawn: `process.execPath`(nvm PATH 이슈 회피) + `{detached:true, stdio:'ignore'}` + `child.unref()`. **dev(tsx src) vs prod(dist) 경로 분기** — dev는 dist 없음. spawn 전 `dist/scripts/generateArticle.js` 존재 확인(없으면 500).
- 자식은 **짧은 수명 Prisma client** 사용(요청 풀과 경쟁 금지 — P2024 풀 고갈=과거 noindex 사고 원인).
- **키 프로비저닝 (리뷰 반영)**: spawn 자식과 API 프로세스는 **서버 `backend/.env`의 `OPENAI_API_KEY`/`NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`에 의존**. ecosystem/deploy는 이 키를 서버에 안 넣음 → 부재 시 자식 즉사(조용한 실패). generate는 **키 부재 시 202 대신 503**(프리플라이트). 서버 .env 키 존재를 Phase 2 전제 체크리스트로.

**CSRF (리뷰 major 반영):**
- SameSite=Strict만으론 부족(서브도메인/XSS same-site 취급). 모든 상태 변경 어드민 라우트에 **Origin/Referer allowlist 검사**(교차 출처 거부)를 1차 통제로, SameSite=Strict는 방어심화.
- **Nitro `/api/**` 프록시가 요청 Cookie를 백엔드로 전달하고 백엔드 Set-Cookie(Secure/SameSite 속성)를 브라우저로 되돌리는지 통합 테스트로 검증**(h3 프록시가 Set-Cookie를 strip/rewrite하는 알려진 케이스).

**어드민 노출 (리뷰 반영):**
- `robots.txt`에 **`Disallow: /admin`**(Yeti·* 블록 양쪽) + `/admin`·`/admin/login` 모두 `noindex,nofollow` + 사이트맵 제외.
- **확정(D-Q2)**: nginx에서 `/admin`·`/api/admin`에 **outer HTTP Basic** 한 겹 추가 → 공격자가 앱 로그인에 도달조차 못 하게, 앱 비밀번호가 유일 장벽이 되지 않게. IP allowlist는 오너의 "어디서든(모바일) 접근" 요구와 충돌해 미채택. 별도 Basic 자격(`ADMIN_BASIC_USER`/`ADMIN_BASIC_PASS`)은 앱 비밀번호와 별개.

**DELETE 썸네일 경로 안전:**
- 삭제 경로는 **저장된 레코드에서만** 유도, `path.basename` 후 고정 articles 디렉터리에 resolve, 그 안에 있는지 assert 후 unlink(경로 탈출 방지). raw client 문자열 unlink 금지.

**어드민 UI:**
- `frontend/pages/admin/login.vue`, `frontend/pages/admin/index.vue`(초안 큐+검토). 렌더 미리보기(marked+DOMPurify 재사용) + 제목·요약·키워드·본문(마크다운 textarea) 편집 + 발행/발행취소/반려/삭제/재생성 + "지금 후보 생성"(백그라운드, 폴링). `frontend/middleware/admin.ts`가 `GET /api/admin/session`으로 가드.

### 5. 공개 페이지 & SEO

- **`/article`** (`pages/article/index.vue`): 최신 히어로 + 카테고리 필터(**client-side activeChip, `?category=` 라우트 파라미터 금지** — 크롤 가능 faceted URL 방지) + 발행일순 아카이브. 홈 "오늘의 이슈" 섹션(`RecentGuides` 패턴).
- **`/article/[slug]`** (`pages/article/[slug].vue`): 가이드 상세 렌더 재사용(marked+DOMPurify+prose) + **발행일 노출** + **출처 섹션** + "AI 작성 안내" 배너 + 사이트 데이터 내부링크 CTA.
  - **출처 섹션 빈 값 처리 (리뷰 반영)**: `sources` null/빈 배열이면 **섹션 자체를 렌더 안 함**(빈 v-if 블록이 중간 광고와 인접해 연속 노출 회귀 유발 금지). 마이그레이션된 38건은 sources=null이므로 이 경로가 즉시 유효.
  - **광고**: 가이드 상세 중간 광고(3번째 `<h2>` 분할) 재사용. `useAdsPolicy` 게이팅. 광고는 항상-렌더 블록에 앵커.
- **canonical (리뷰 반영)**: `/article/[slug]`는 **자기-canonical**(`https://ilsangkit.co.kr/article/{slug}`)을 article path 기준으로 명시. /guide로 새지 않게. 컷오버 후 라이브 검증(canonical==자기 URL).
- **스키마**: JSON-LD `Article`(NewsArticle 아님) + `datePublished`=publishedAt. **`dateModified`는 진짜 편집이 있을 때만**(updatedAt이 publishedAt보다 유의미하게 클 때). 마이그레이션 행의 가짜 freshness 방지(§6). BreadcrumbList. `useStructuredData` 재사용.
- **조회수**: 가이드의 buffered viewCount(60초 flush) 패턴 미러 또는 공유. `GET /api/articles/:slug`에서 증가.
- **composable**: `composables/useArticles.ts`(`useGuides.ts` 미러).
- **이미지 서빙**: 기존 `/api/images/*` 정적 서빙 재사용 + `articles/` 서브디렉터리. **라우트가 임의 서브패스를 서빙하는지 확인**(아니면 Phase 1에 추가).
- **사이트맵**: `/article` URL을 published만, `lastmod`=publishedAt로. 볼륨상 `static.xml.ts`에 추가(가이드와 동일 위치). `sitemapPolicy.ts` 갱신.
- **RSS (리뷰 반영)**: 현재 `rss.xml.ts`는 `/guide` 링크·"생활 가이드" 제목으로 `/api/guides`만 fetch. 마이그레이션 후 38건이 빠짐. **별도 `/article` RSS 피드(자체 channel/link/title) 신설** 권장, 네이버 SA 제출 피드 갱신. /article 아이템을 /guide 채널에 섞지 않음.

### 6. 마이그레이션 & 진짜 원자적 컷오버 (리뷰 blocker 2건 반영)

**필드 매핑** (Guide는 아래 컬럼을 모두 저장 — 라이브 확인):

| Guide | → Article | 비고 |
|---|---|---|
| title/slug/content/summary/category/keywords/viewCount | 동일 복사 | slug는 Guide 삭제와 동시 이전이라 충돌 없음 |
| articleType `'news'` | `'news-brief'` | 구 4-값 enum → 신 5-값. 기본 news-brief(원하면 `inferInfoArticleType` 재추론) |
| thumbnailUrl | `assets/images/articles/{slug}.webp`로 **파일 복사 후 재지정** | 원본 guides/ 파일은 삭제 후 orphan → 반드시 복사 |
| createdAt | createdAt **및** publishedAt **및** updatedAt | **updatedAt은 raw SQL로 원 createdAt 기입**(`@updatedAt` 자동 now() 우회) → dateModified==datePublished, 가짜 freshness 방지 |
| (published=true) | status=`published` | |
| — | sources=null | 상세는 빈 sources 시 섹션 미렌더 |

**진짜 원자적 컷오버 — per-slug 무중복 보장:**

1. **Phase 3에서 선(先) 배포(inert)**: `/article` 공개 라우트·`/api/articles`·Article 사이트맵(빈)·**`/guide/[slug]` 동적 폴백**을 미리 라이브. 동적 폴백 = `pages/guide/[slug].vue`가 Guide-miss 시 **`throw createError(404)` 대신** Article 조회 → 있으면 **`navigateTo('/article/'+slug, { redirectCode: 301 })`**, 없으면 404. 이 시점엔 Article이 guide slug와 매칭 안 되므로 폴백은 발동 안 함(inert).
2. **Phase 4 마이그레이션(단일 스크립트, per-slug 트랜잭션)**: 각 slug에 대해 `[Article insert(published) + Guide delete]`를 **한 트랜잭션**으로. 트랜잭션 커밋 순간, /guide/[slug]는 Guide-miss→Article-found→**301**로 전환되고 /article/[slug]가 200. **어느 순간에도 같은 slug가 양쪽 200이 되지 않음.** 썸네일 파일 복사도 이 루프에서.
3. **사이트맵 강제 재생성 (리뷰 blocker 반영)**: 디스크 사이트맵은 count-drop 가드(threshold 0.2)에 막힐 수 있고 배포 regen은 force가 없음 → **`Regen Sitemaps` workflow_dispatch(force=true)**를 컷오버 단계에서 명시 실행. (주: 가이드는 전용 sitemap이 아니라 `static.xml`의 대형 region-category URL 집합에 섞여 있어 38건 제거는 ~1-4%로 가드 미저촉 가능성이 높지만, /article 신규 청크·전체 스왑의 all-or-nothing 특성상 force+검증을 안전판으로 강제.)
4. **컷오버 수용 게이트(가정 아님)**: 배포 후 라이브 검증 — (a) 임의 이전 slug가 /guide·/article 양쪽 200이 아님(정확히 /guide→301, /article→200), (b) 서빙 사이트맵(`X-Sitemap-Source: static`)에 /article URL 존재·38개 /guide URL 부재, (c) /article/[slug] canonical==자기 URL. 통과 전엔 컷오버 미완료로 간주.

**정적 301 맵은 비채택**(선배포 시 Article 없는데 301되어 404 창 발생). **동적 폴백이 primary.** 리다이렉트 파일 경로 참고: 전역 선처리는 `frontend/server/middleware/redirects.ts`(server/routes 아님), 단 본 건은 페이지-레벨 navigateTo가 정답.

### 7. 자동화

- **GitHub Actions cron**(`sync-real-estate.yml` 패턴, **독립 워크플로우** `generate-articles.yml` 권장 — daily sync 예산과 격리): 매일 밤 SSH → `node dist/scripts/generateArticle.js --count 3` → **후보 초안 3건**(발행 안 함). `concurrency: cafe24-db`, `timeout` 래핑, `OPENAI_API_KEY`/`NAVER_*` **GitHub Secret + 서버 .env 양쪽** 필요.
- **count 단일 소스**: CLI `--count` 기본값 3(D10). cron·어드민 모두 이를 상속. 어드민 허용 범위 1..3.
- **기존 news 생성 정체 확인 (리뷰 반영 — Open Q4)**: 레포엔 generateGuide 스케줄이 없는데 당일 news 가이드가 생성됨 → **Cafe24 서버 crontab(VCS 밖) 의심**. Phase 1 착수 전 서버 crontab 실측, generateGuide 스케줄 있으면 제거/교체(안 그러면 D3 깨지고 /guide 재오염).

---

## 편집 계약 (Editorial Contract)

D2 강제: 모든 오늘의 이슈는 **최소 1개 사이트 카테고리에 페그 + 사이트 도구로 연결**(내부링크는 광고 CTA 아닌 "다음 확인 행동"). 기존 info-article 계약(출처 우선순위: 공식 발표/공고문 > 공공기관 > 언론보도 > 블로그, 자료 없는 수치·일정·조건 생성 금지, 정책·청약·임대 조건은 공고문 확인 병기, 상대날짜 금지·절대날짜 허용, AI슬롭 금지어·긴 문단 금지·결론 우선) 승계.

---

## Error Handling

- **생성 실패**(길이·금지어·썸네일 인코딩): draft 저장 안 함, 로그. cron은 실패해도 다음 후보 계속.
- **어드민 API**: `asyncHandler` + 에러 클래스(`NotFoundError`404, `ValidationError`422, `ConflictError`409(생성 중복)). 인증 실패 401. 키 부재 503.
- **발행 검증**: publish 시 필수(title/summary/content/thumbnail) 검증, 미충족 422.

## Testing Strategy (TDD)

- **백엔드 vitest**: 생성 계약(타입 추론·길이·금지어·출처 캡처·**generateGuide가 news 방출 불가**·**cross-table slug 충돌**), `articleService`(published 필터·정렬·조회수), `requireAdmin`(유효/만료/무효 세션), 로그인 리미터(**loopback 비스킵**·계정 잠금), sanitize 예외(`<` 포함 password/content 왕복 불변), generate 검증(count clamp·category allowlist·단일-플라이트 409), DELETE 경로 탈출 방지.
- **프론트 vitest**: `/article` 목록·상세(빈 sources 미렌더·canonical 자기 URL·JSON-LD datePublished/dateModified 규칙), 어드민 가드.
- **통합**: Nitro 프록시 Cookie/Set-Cookie 왕복. **Playwright E2E**: 로그인→검토→편집→발행→/article 노출.
- 커밋 전 백엔드/프론트 `npm run test`+`lint` 통과 필수.

---

## 단계(PR) 구성

각 Phase는 이전에 의존, **각 Phase가 자체 writing-plans 구현 계획**을 가짐. **Phase 4는 반드시 Phase 3(=/article 공개+동적 폴백 배포) 이후에만 발효.**

- **Phase 0 — 프리플라이트(코드 아님, 확인 태스크)**: (a) 서버 crontab에 generateGuide 스케줄 유무, (b) Cafe24 서버 cwebp/convert 설치 유무, (c) 서버 backend/.env에 OPENAI/NAVER 키 유무. 결과에 따라 후속 Phase 조정.
- **Phase 1 — 백엔드 기반**: `Article` 모델·`AdminSession` 모델 + 공유 코어 추출(+export화) + `generateArticle.ts`(draft 생성·출처·cross-table slug·썸네일 throw 정책) + generateGuide news 경로 하드 제거. 테스트.
- **Phase 2 — 어드민**: DB 세션 인증(fail-closed·전용 리미터·계정 잠금) + cookie-parser + sanitize 예외 + Origin/Referer CSRF + 어드민 API(publish/unpublish/reject/regenerate/generate 단일-플라이트·Zod·안전 spawn) + 어드민 UI + robots.txt Disallow. 테스트 + E2E + 키/프록시 통합 검증.
- **Phase 3 — 공개 & SEO(inert 컷오버 준비)**: `/article`·`/article/[slug]`(빈 sources 미렌더·자기 canonical) + `useArticles` + JSON-LD + `/article` RSS + Article 사이트맵 청크 + 홈 통합 + **`/guide/[slug]` 동적 폴백(navigateTo 301)**. 테스트.
- **Phase 4 — 마이그레이션·컷오버**: per-slug 트랜잭션 마이그레이션(38건, updatedAt raw·썸네일 복사·viewCount 보존) + `Regen Sitemaps` force + **4가지 수용 게이트 라이브 검증**.
- **Phase 5 — 자동화**: `generate-articles.yml` cron(하루 3건 초안) + Secret·서버 .env 등록.

---

## Out of Scope (YAGNI)

다중 관리자·RBAC / 댓글·소셜 백엔드 / WYSIWYG(마크다운 textarea로 충분) / 자동 발행(D4 배제) / 넓은 생활 정책·뉴스(D2 배제) / 오래된 이슈 자동 삭제(D5, noindex만).

## Risks & Open Questions (사용자 확인 필요)

**Risks:**
- **컷오버 원자성**: Phase 4는 per-slug 트랜잭션 + 사이트맵 force + 4수용게이트로만 발효. 중간 상태 크롤 시 일시 중복.
- **cwebp/키/crontab 미확인**: Phase 0 프리플라이트로 해소 못 하면 초안 0건·D3 붕괴 등 조용한 실패.
- **AI 콘텐츠 품질·크롤 예산**: 사람 게이트가 1차 방어. 대량 발행 지양.

**Resolved (사용자 확정):**
- **Q1 (SEO 방향)** ✅ **예방적 noindex** — 8주+ crawled-but-not-indexed는 noindex로 색인 레이스 제외(D5).
- **Q2 (보안 posture)** ✅ **nginx outer HTTP Basic** — 어디서든 접근 유지 + 방어심화(§4).

**Phase 0 프리플라이트에서 실측 (오너 지식/서버 접근 필요):**
- **Q3 (운영)**: Cafe24 서버에 **cwebp/convert 설치 여부**. 없으면 서버 설치 vs CI·로컬 생성+SCP 중 확정.
- **Q4 (운영)**: **매일 news 가이드를 생성하는 서버 crontab 존재 여부**(오너만 앎). 있으면 컷오버 전 제거·교체(안 하면 D3 붕괴).

**범위 인지 (확인 요망):**
- **Q5**: 마이그레이션으로 **`/guide`가 49→11페이지로 축소**됨(78% 이동). 동의 여부.
