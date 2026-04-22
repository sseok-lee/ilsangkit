<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/[category]

## Purpose
15개 시설 카테고리(`toilet`, `parking`, `school` 등)의 허브/상세 페이지. 동적 라우트 `category` 파라미터로 카테고리 판별.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 카테고리 허브 (`/[category]/`) — 상위 지역 진입 + 카테고리 설명/FAQ |
| `[id].vue` | 시설 상세 (`/[category]/[id]`) — FacilityDetail 컴포넌트 렌더 |

## For AI Agents

### Working In This Directory
- 유효한 카테고리 검증: `FacilityCategory` union에 포함되지 않으면 `throw createError({ statusCode: 404 })`
- `useSeoMeta`/`useHead`로 카테고리별 메타 — `useFacilityMeta` composable 활용
- 구조화 데이터(JSON-LD) 주입: `useStructuredData`

### Testing Requirements
- `tests/pages/category.test.ts`, `detail.test.ts`, `facility-detail-links.test.ts`

### Common Patterns
- `const { category } = useRoute().params` — 타입 좁히기 필요
- 404 처리는 페이지 상단에서

## Dependencies

### Internal
- `../../composables/useFacilitySearch.ts`, `useFacilityDetail.ts`, `useFacilityMeta.ts`
- `../../components/facility/`, `../../components/facility/details/`
- `../../types/facility.ts`

### External
- (없음)
