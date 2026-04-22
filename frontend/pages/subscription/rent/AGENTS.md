<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/subscription/rent

## Purpose
임대(전월세) 청약 페이지 — 공급 유형별(`[type]`) 필터 + 전체 허브.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | `/subscription/rent/` 임대 청약 허브 |
| `[type].vue` | `/subscription/rent/[type]` 공급 유형별 목록 |

## For AI Agents

### Working In This Directory
- `subscriptionPublicRentType.test.ts` (`backend/__tests__/`)의 공공 임대 분류 로직과 일치
- 임대 유형: 공공임대, 행복주택, 청년임대 등 — 메타 파일로 동기화

### Testing Requirements
- backend 분류 테스트와 프론트 렌더링 테스트가 맞물림

### Common Patterns
- `RentalPriceStatsBox.vue`로 보증금/월세 통계 표시

## Dependencies

### Internal
- `../../../composables/useSubscription.ts`
- `../../../components/subscription/`, `../../../utils/subscriptionMeta.ts`, `formatDeposit.ts`

### External
- (없음)
