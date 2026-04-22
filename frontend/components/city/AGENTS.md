<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/city

## Purpose
도시 허브 페이지(`/[city]/`)에서 사용되는 섹션 컴포넌트.

## Key Files
| File | Description |
|------|-------------|
| `RecentGuides.vue` | 해당 도시 관련 최근 가이드 목록 |

## For AI Agents

### Working In This Directory
- `useGuides` composable로 지역 필터링된 가이드 fetch
- SSR 친화적 구현 — `useAsyncData` 사용

### Testing Requirements
- `tests/components/` 상위 — 현재 city 전용 테스트는 없으나 페이지 테스트(`tests/pages/region.test.ts`)가 간접 검증

### Common Patterns
- `defineProps<{ citySlug: string }>()`
- 가이드 없으면 섹션 자체 숨김

## Dependencies

### Internal
- `../../composables/useGuides.ts`, `../../utils/seoConstants.ts`

### External
- (없음)
