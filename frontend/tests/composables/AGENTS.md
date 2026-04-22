<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/composables

## Purpose
`composables/` 단위 테스트 — 9개 composable에 대응.

## Key Files
| File | Description |
|------|-------------|
| `useAnalytics.test.ts` | GA 이벤트 트래킹 |
| `useErrorHandler.test.ts` | 에러 처리 |
| `useFacilityDetail.test.ts` / `useFacilityMeta.test.ts` / `useFacilitySearch.test.ts` | 시설 composable |
| `useRealEstateMeta.test.ts` | 부동산 메타 |
| `useRegionFacilities.test.ts` / `useRegions.test.ts` | 지역 |
| `useStructuredData.test.ts` | JSON-LD 생성 |

## For AI Agents

### Working In This Directory
- Nuxt auto-import 함수는 `tests/setup.ts`에서 mock
- `$fetch`, `useRuntimeConfig` 글로벌 mock 활용
- 누락된 composable 테스트: `useGuides`, `useHomeSubscriptions`, `useKakaoMap`, `useRealEstate`, `useReviews`, `useSubscription`, `useWasteSchedule`

### Testing Requirements
- DB 불필요, 빠른 실행
- MSW 대신 `vi.mock('$fetch', ...)` 직접 모킹 위주

### Common Patterns
- `await useFacilitySearch().search(...)` 결과 검증
- readonly ref 반환 확인

## Dependencies

### Internal
- `../../composables/`

### External
- `vitest`, `@vue/test-utils`
