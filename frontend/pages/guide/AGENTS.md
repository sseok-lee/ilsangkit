<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/guide

## Purpose
가이드 페이지. SEO 트래픽을 위한 정보성 콘텐츠 (카테고리/지역별 가이드 글). backend `generateGuide.ts`로 생성.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | `/guide/` — 가이드 목록 |
| `[slug].vue` | `/guide/[slug]` — 가이드 상세 |

## For AI Agents

### Working In This Directory
- `useGuides` composable로 fetch
- 구조화 데이터: `Article` JSON-LD — `useStructuredData` composable
- 내부링크: `RelatedGuides` 컴포넌트로 연관 가이드 노출 (SEO 크롤 경로 강화)
- slug는 kebab-case — backend 생성 규칙과 일치

### Testing Requirements
- `tests/pages/guide-detail-links.test.ts`

### Common Patterns
- `useAsyncData(key, () => $fetch('/api/guides/' + slug))`
- 404 처리: 가이드 없음 → `throw createError`

## Dependencies

### Internal
- `../../composables/useGuides.ts`, `useStructuredData.ts`
- `../../components/guide/RelatedGuides.vue`, `../../components/city/RecentGuides.vue`

### External
- (없음)
