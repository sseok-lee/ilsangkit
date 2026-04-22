<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/server/routes

## Purpose
Nitro 서버 라우트. 프런트엔드 밖에서 직접 서빙되는 사이트맵/RSS/OG 이미지 엔드포인트.

## Key Files
| File | Description |
|------|-------------|
| `og.get.ts` | `/og` — 동적 OG 이미지 생성 (페이지별 타이틀/카테고리) |
| `rss.xml.ts` | `/rss.xml` — 가이드/콘텐츠 RSS 피드 |
| `sitemap.xml.ts` | `/sitemap.xml` — 사이트맵 인덱스 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `sitemap/` | 청크 분할된 사이트맵 (see `sitemap/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- 파일명 컨벤션: `{path}.{method}.ts` (`og.get.ts` → GET `/og`)
- 응답 헤더 `Content-Type: application/xml` (사이트맵/RSS), `image/png` (OG)
- 캐시 헤더 설정 권장 (`setResponseHeader('Cache-Control', 'public, max-age=3600')`)
- Notepad 지적: 사이트맵이 82만 → 27만으로 축소됨 — 네이버 트렌드 기반 카테고리 우선순위 반영 완료

### Testing Requirements
- `tests/server/ogImage.test.ts`, `rss.test.ts`, `sitemap.test.ts`

### Common Patterns
- `defineEventHandler(async (event) => { ... })`
- XML 생성은 `../utils/sitemap.ts`, `rss.ts` 경유

## Dependencies

### Internal
- `../utils/` — sitemap/rss/og 생성 로직
- `../../utils/seoConstants.ts`

### External
- Nitro, `@vercel/og` 또는 satori
