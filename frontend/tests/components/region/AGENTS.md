<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/region

## Purpose
`components/region/` 테스트.

## Key Files
| File | Description |
|------|-------------|
| `DistrictSummaryCard.test.ts` | 구/군 요약 카드 |
| `NearbyDistrictsNav.test.ts` | 인접 구/군 내비 |

## For AI Agents

### Working In This Directory
- 지역 slug 변환 동작은 `tests/utils/` 쪽이 책임
- 여기서는 renderable 확인 위주

### Testing Requirements
- NuxtLink stub 통한 링크 href 검증

### Common Patterns
- mock 지역 데이터 fixture

## Dependencies

### Internal
- `../../../components/region/`, `../../../shared/regionSlugs.ts`

### External
- `vitest`, `@vue/test-utils`
