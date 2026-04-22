<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/facility

## Purpose
시설(15개 카테고리) 관련 리스트/카드/상세 컴포넌트. 상세 카테고리별 detail은 `details/` 서브디렉터리로 분리.

## Key Files
| File | Description |
|------|-------------|
| `FacilityCard.vue` | 카테고리 허브/검색 결과용 시설 카드 |
| `FacilityList.vue` | 시설 목록 (가상 스크롤/페이지네이션) |
| `FacilityDetail.vue` | 시설 상세 공용 래퍼 (카테고리별 Detail을 동적 import) |
| `FacilityFeatureCard.vue` | 시설 핵심 기능 강조 카드 |
| `FacilityRoadview.vue` | Kakao 로드뷰 임베드 |
| `OperatingStatusBadge.vue` / `OperatingStatusBanner.vue` | 운영 상태 표시 |
| `WasteScheduleCard.vue` | 쓰레기 배출 일정 카드 |
| `DetailRow.vue` | 상세 페이지 공용 행 레이아웃 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `details/` | 15개 카테고리별 상세 컴포넌트 (see `details/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **새 카테고리 추가 시**: `details/XxxDetail.vue` 추가 + `FacilityDetail.vue`의 매핑 업데이트
- 운영 상태는 `../../utils/facilityStatus.ts`의 계산 함수 사용
- 로드뷰는 클라이언트 전용 (SSR 가드)
- 카드 hover/focus는 키보드 접근성 고려

### Testing Requirements
- `tests/components/facility/FacilityCard.test.ts`, `FacilityList.test.ts`
- 카테고리별 detail 테스트는 `tests/components/facility/details/`

### Common Patterns
- `<DetailRow label="운영 시간" :value="..." />` 반복 구조
- `defineAsyncComponent`로 카테고리별 Detail lazy import

## Dependencies

### Internal
- `../../composables/useFacilityDetail.ts`, `useFacilityMeta.ts`, `useKakaoMap.ts`
- `../../utils/facilityStatus.ts`, `formatOperatingHours.ts`, `formatters.ts`
- `../common/`, `../map/`

### External
- Kakao Maps SDK
