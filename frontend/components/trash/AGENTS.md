<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/trash

## Purpose
쓰레기 배출 섹션 UI. 다른 시설 카테고리와 달리 좌표 없는 지역 단위 일정 데이터(`WasteSchedule` 모델) 기반.

## Key Files
| File | Description |
|------|-------------|
| `RegionSelector.vue` | 시/군/구/동 선택기 (trash 전용 depth) |
| `ScheduleList.vue` | 요일별 배출 일정 |
| `WasteTypeSection.vue` | 쓰레기 유형(종량제/재활용/음식물/대형) 안내 |

## For AI Agents

### Working In This Directory
- **좌표 없음**: Kakao Map/반경 검색 로직 적용 금지 — 지역 단위 선택 UI만 제공
- 유형별 배출 방법은 `../../utils/wasteHowTo.ts` 상수
- `useWasteSchedule` composable로 일정 fetch

### Testing Requirements
- 현재 전용 테스트 없음 — `tests/pages/trash-detail.test.ts`가 간접 검증

### Common Patterns
- 요일은 0(일)-6(토) 또는 'monday'...'sunday' 문자열 — 백엔드 타입 확인
- 배출 시간 범위는 단순 문자열로 표시

## Dependencies

### Internal
- `../../composables/useWasteSchedule.ts`
- `../../utils/wasteHowTo.ts`

### External
- (없음)
