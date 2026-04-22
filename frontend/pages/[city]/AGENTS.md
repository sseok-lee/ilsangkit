<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/[city]

## Purpose
도시(시·도) 허브 페이지(`/[city]/`)와 하위 구·군 라우트 컨테이너.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 도시 허브 — 구/군 목록, 주요 카테고리 요약 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[district]/` | 구/군 허브 + 카테고리별 페이지 (see `[district]/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `city` slug → `서울특별시`/`서울` 양방향 매칭은 backend의 `buildRegionFilter()` 경유
- 프런트에서는 `../../shared/regionSlugs.ts`로 slug ↔ 한글명 변환
- 유효 city slug 검증 후 404 처리

### Testing Requirements
- `tests/pages/region.test.ts`

### Common Patterns
- `const { city } = useRoute().params`
- 빈 지역(데이터 없음)일 때는 안내 섹션 노출

## Dependencies

### Internal
- `../../composables/useRegions.ts`, `useRegionFacilities.ts`
- `../../components/region/`, `../../components/city/`
- `../../shared/regionSlugs.ts`

### External
- (없음)
