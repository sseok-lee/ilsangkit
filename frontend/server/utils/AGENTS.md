<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/server/utils

## Purpose
Nitro 서버 공용 유틸. 사이트맵/RSS/OG 이미지의 생성 로직을 추출하여 라우트가 얇게 유지되도록 한다.

## Key Files
| File | Description |
|------|-------------|
| `sitemap.ts` | 사이트맵 XML 빌더 |
| `rss.ts` | RSS 2.0 XML 빌더 |
| `ogImage.ts` | OG 이미지 생성 (satori/@vercel/og) |

## For AI Agents

### Working In This Directory
- Nitro 전용 — `defineEventHandler` 밖에서 호출 가능 (테스트 용이성)
- OG 이미지는 폰트 embedding 필요 — Pretendard 서브셋 사용 고려
- 사이트맵 생성은 스트리밍 가능한 형태로 유지

### Testing Requirements
- `tests/server/ogImage.test.ts`, `rss.test.ts`, `sitemap.test.ts`

### Common Patterns
- 순수 함수 유지 — 외부 입력을 인자로 받고 결과 반환

## Dependencies

### Internal
- `../../utils/seoConstants.ts`, `realEstateUrl.ts`

### External
- `@vercel/og` 또는 `satori`
