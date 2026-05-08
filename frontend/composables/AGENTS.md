<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-05-07 -->

# frontend/composables

## Purpose
Nuxt auto-import composable 함수. 데이터 fetch, 상태 관리, 외부 SDK(Kakao Map, Analytics, MSW) 통합을 담당한다. 모든 composable은 `useXxx` 네이밍. 시설, 부동산, 청약, 공공임대, 가이드, 쓰레기 등 각 도메인별 데이터 로드 함수 제공.

## Key Files
| File | Description |
|------|-------------|
| `useAnalytics.ts` | GA4 이벤트 트래킹 |
| `useApiBase.ts` | API 베이스 URL 유틸 |
| `useErrorHandler.ts` | 에러 toast/로깅 통합 처리 |
| `useFacilityDetail.ts` | 단일 시설 상세 fetch |
| `useFacilityMeta.ts` | 시설 페이지 메타/FAQ 생성 |
| `useFacilitySearch.ts` | 시설 검색 (키워드/지역/반경) |
| `useGuides.ts` | 가이드 목록/상세 fetch |
| `useHomeSubscriptions.ts` | 홈 청약 섹션 데이터 로드 |
| `useKakaoMap.ts` | Kakao Map SDK 로드/지도 인스턴스 생성 |
| `usePublicRental.ts` | 공공임대주택 검색/상세 fetch |
| `useRealEstate.ts` | 부동산 거래/건물 목록 fetch |
| `useRealEstateMeta.ts` | 부동산 페이지 메타 생성 |
| `useRegionFacilities.ts` | 특정 지역의 시설 집계 |
| `useRegions.ts` | 전국 시/도/군/구 리스트 |
| `useRentalAnnouncements.ts` | 공공임대 공고/뉴스 fetch |
| `useStructuredData.ts` | JSON-LD 구조화 데이터 생성 |
| `useSubscription.ts` | 청약 상세 fetch |
| `useWasteSchedule.ts` | 쓰레기 배출 스케줄 (좌표 없는 지역 단위 데이터) |

## For AI Agents

### Working In This Directory
- **반드시 `useRuntimeConfig().public.apiBase` 사용** — 하드코딩된 `http://localhost:8000` 금지
- 반환 ref는 `readonly()`로 감싸 외부 변경 차단
- SSR 시 `useAsyncData(key, () => $fetch(...))` 패턴으로 상태 중복 방지
- `useKakaoMap`은 클라이언트 전용 — `if (!import.meta.client) return` 가드 필수

### Testing Requirements
- 테스트는 `tests/composables/`에 매칭
- `$fetch`, `useRuntimeConfig`, `useAsyncData` 글로벌 mock은 `tests/setup.ts` 참조

### Common Patterns
- `async function loadXxx()` 내부에서 `$fetch` 호출
- 에러는 `useErrorHandler` 경유
- `computed`로 파생 상태 노출

## Dependencies

### Internal
- `../types/` — API 응답 타입
- `../utils/` — 포매팅, URL 생성
- `../server/utils/` — SSR 공유 로직 (일부)

### External
- Kakao Maps JavaScript SDK (CDN, `NUXT_PUBLIC_KAKAO_MAP_KEY`)
- Nuxt 3 composable API
