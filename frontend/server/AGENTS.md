<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/server

## Purpose
Nitro 서버 사이드 기능. Nuxt에 내장된 서버에서 실행되어 사이트맵/RSS/OG 이미지 동적 생성, URL 리다이렉트, 호스트 정규화를 담당한다.

## Key Files
(루트에는 파일이 없으며 모두 서브디렉터리에 존재)

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `middleware/` | Nitro 미들웨어 (리다이렉트, canonical host, 410 Gone) (see `middleware/AGENTS.md`) |
| `routes/` | Nitro 라우트 (`/sitemap.xml`, `/rss.xml`, `/og`) (see `routes/AGENTS.md`) |
| `utils/` | 서버 공용 유틸 (sitemap, rss, og 이미지 생성) (see `utils/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- Nitro는 Node.js 런타임 — 브라우저 API 사용 불가
- `defineEventHandler((event) => { ... })` 패턴
- 쿼리 파싱은 `getQuery(event)`, 파라미터는 `getRouterParams(event)`
- `sendRedirect(event, url, code)` 로 리다이렉트 (기본 302, 영구는 301)
- 사이트맵이 크므로(80만 → 27만 축소됨) 스트리밍 응답 고려

### Testing Requirements
- 테스트는 `tests/server/`에 위치 — `ogImage`, `rss`, `sitemap`, `real-estate-redirect-regex`, `real-estate-redirect` 커버
- Regex 리다이렉트는 반드시 케이스별 단위 테스트

### Common Patterns
- 리다이렉트 우선순위: `canonical-host` → `gone` → `real-estate-redirect` → `redirects`
- 사이트맵은 `routes/sitemap/[...].ts` catch-all로 청크 분할
- OG 이미지는 `@vercel/og` 또는 satori 기반

## Dependencies

### Internal
- `../composables/` 일부 공유 (utils)
- `../utils/` SEO 상수

### External
- Nitro, `h3` 이벤트 핸들러
