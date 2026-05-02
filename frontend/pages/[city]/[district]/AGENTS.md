<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/[city]/[district]

## Purpose
구/군 허브 페이지와 지역×카테고리 교차 페이지(`/[city]/[district]/[category]`).

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 구/군 허브 — 카테고리 요약, 근접 구/군 내비 |
| `[category].vue` | 지역×카테고리 결합 페이지 (`/강남구/toilet` 같은 URL) |

## For AI Agents

### Working In This Directory
- `district` slug는 시/도 + 구/군 조합으로 backend가 해석 — 양방향 city variant 매칭 필수
- `[category].vue`는 `FacilityCategory` 검증 + 지역 필터 적용
- 인접 지역 내비는 backend `metaService` 의존

### Testing Requirements
- `tests/pages/region.test.ts`, `category-cross-links.test.ts`

### Common Patterns
- `const { city, district, category } = useRoute().params`
- 메타 제목: "{district} {category명} - {city}"

## Dependencies

### Internal
- `../../../composables/useRegionFacilities.ts`, `useRealEstate.ts`
- `../../../components/region/`, `../../../components/facility/`, `../../../components/realEstate/`

### External
- (없음)
