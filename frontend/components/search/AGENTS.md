<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/search

## Purpose
통합 검색 UI. `/search` 페이지와 헤더 글로벌 검색에서 사용.

## Key Files
| File | Description |
|------|-------------|
| `SearchInput.vue` | 검색 입력창 (자동완성/최근 검색어) |
| `SearchFilters.vue` | 검색 필터 (카테고리/지역/반경) |

## For AI Agents

### Working In This Directory
- `useFacilitySearch` composable로 검색 실행
- 디바운스 적용 (300ms 권장) — 타이핑 중 과도한 API 호출 방지
- URL 쿼리스트링과 동기화 (뒤로가기 지원)

### Testing Requirements
- `tests/components/search/SearchInput.test.ts`, `SearchFilters.test.ts`

### Common Patterns
- `v-model`로 상위에 상태 전달
- 필터는 객체 형태: `{ category, city, district, radius }`

## Dependencies

### Internal
- `../../composables/useFacilitySearch.ts`, `useRegions.ts`
- `../../types/facility.ts`

### External
- (없음)
