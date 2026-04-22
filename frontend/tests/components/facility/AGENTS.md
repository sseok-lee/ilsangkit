<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/facility

## Purpose
`components/facility/` 테스트. 카드/목록 + 상세 카테고리 9종 포함.

## Key Files
| File | Description |
|------|-------------|
| `FacilityCard.test.ts` | 시설 카드 렌더/링크 |
| `FacilityList.test.ts` | 목록 페이지네이션/빈 상태 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `details/` | 카테고리별 Detail 컴포넌트 테스트 (see `details/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `FacilityDetail`, `FacilityFeatureCard`, `FacilityRoadview`, `DetailRow`, `OperatingStatusBadge`/`Banner`, `WasteScheduleCard` 테스트 누락 — 추가 권장
- 카드 클릭 시 올바른 경로로 이동하는지 확인

### Testing Requirements
- 필수 props 누락 시 경고 발생하지 않는지 확인

### Common Patterns
- 운영 상태 계산 고정: `vi.setSystemTime()`로 시간 고정

## Dependencies

### Internal
- `../../../components/facility/`, `../../../composables/`, `../../../utils/facilityStatus.ts`

### External
- `vitest`, `@vue/test-utils`
