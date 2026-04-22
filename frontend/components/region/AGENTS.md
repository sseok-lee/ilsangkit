<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/region

## Purpose
지역(시/구) 허브 페이지(`/[city]/`, `/[city]/[district]/`)에서 사용되는 섹션 컴포넌트.

## Key Files
| File | Description |
|------|-------------|
| `DistrictSummaryCard.vue` | 구/군 요약 카드 (시설 카운트, 대표 가이드) |
| `NearbyDistrictsNav.vue` | 인접 구/군 내비 (지역 크로스링크) |

## For AI Agents

### Working In This Directory
- 지역 데이터는 `useRegionFacilities`, `useRegions` composable로 fetch
- 인접 지역은 backend `metaService.ts`의 지역 그래프 의존
- 내부링크는 SEO에 중요 — 인접 지역 링크로 크롤 경로 풍부화

### Testing Requirements
- `tests/components/region/DistrictSummaryCard.test.ts`, `NearbyDistrictsNav.test.ts`

### Common Patterns
- `defineProps<{ citySlug: string; districtSlug?: string }>()`

## Dependencies

### Internal
- `../../composables/useRegionFacilities.ts`, `useRegions.ts`
- `../../shared/regionSlugs.ts`

### External
- (없음)
