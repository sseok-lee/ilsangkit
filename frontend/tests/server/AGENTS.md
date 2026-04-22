<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/server

## Purpose
Nitro 서버 라우트/미들웨어/유틸 테스트. SSR 서빙 기능의 안정성을 보증.

## Key Files
| File | Description |
|------|-------------|
| `ogImage.test.ts` | `/og` OG 이미지 생성 |
| `rss.test.ts` | `/rss.xml` 피드 |
| `sitemap.test.ts` | `/sitemap.xml` 인덱스 |
| `real-estate-redirect.test.ts` | 부동산 리다이렉트 미들웨어 |
| `real-estate-redirect-regex.test.ts` | 정규식 리다이렉트 패턴 |

## For AI Agents

### Working In This Directory
- Nitro 이벤트 핸들러 테스트: `(event)` 모의 객체 생성 또는 `createEvent(nodeReq, nodeRes)` 패턴
- XML 응답은 문자열 포함/형식 검증 (`includes`, DOMParser 파싱)
- 정규식 테스트는 edge case 위주 (파라미터 보존, 비매칭)

### Testing Requirements
- 사이트맵 생성은 backend `/api/sitemap` mock 필요
- OG 이미지는 실제 렌더링 결과 버퍼 검사보다 속성/메타 검증

### Common Patterns
- `defineEventHandler`의 export 구조 확인
- `sendRedirect` 호출 인자/상태코드 검증

## Dependencies

### Internal
- `../../server/routes/`, `../../server/middleware/`, `../../server/utils/`

### External
- `vitest`, Nitro 내부 이벤트 API
