<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/server/routes/sitemap

## Purpose
사이트맵 청크 라우트. 50K URL 제한을 넘는 대량 사이트맵을 청크로 분할하여 서빙한다.

## Key Files
| File | Description |
|------|-------------|
| `[...].ts` | 동적 청크 (`/sitemap/xxx.xml`) — catch-all |
| `static.xml.ts` | 정적 페이지 사이트맵 (about, privacy, faq 등) |

## For AI Agents

### Working In This Directory
- 청크 하나당 50,000 URL 미만 유지 (Google 권장)
- Notepad에 "사이트맵 82만 → 27만 축소" 메모 — 중복/저가치 URL 제거 지속 권장
- 부동산 색인 위기 (Notepad): 83K URL 중 17개만 색인됨 — 빌라 buildingName이 지번 "(535-3)" 형태 문제 + apt/offitel 거의 색인 안됨 → 이 라우트의 반영 여부 점검
- `lastmod`, `changefreq`, `priority` 설정

### Testing Requirements
- `tests/server/sitemap.test.ts` — 청크 응답 검증

### Common Patterns
- catch-all 파라미터: `const { slug } = getRouterParams(event)` (배열)

## Dependencies

### Internal
- `../../utils/sitemap.ts` — 사이트맵 XML 생성
- backend `/api/sitemap` — URL 집계 제공

### External
- Nitro
