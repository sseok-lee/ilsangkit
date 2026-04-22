<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/subscription

## Purpose
`components/subscription/` 테스트 — 통계 박스 커버.

## Key Files
| File | Description |
|------|-------------|
| `RentalPriceStatsBox.test.ts` | 전월세 통계 박스 |

## For AI Agents

### Working In This Directory
- **누락**: `SubscriptionCard`, `SubscriptionListView`, `SpecialSupplyCard`, `HomeSubscriptionSection`, `TimelineItem` 테스트 — 확장 권장
- 청약 유형 분류 동작은 backend 테스트 기준으로 프론트 렌더링 확인

### Testing Requirements
- 보증금/월세 포매팅은 `tests/utils/formatDeposit.test.ts`가 책임

### Common Patterns
- 통계 fixture: min/max/avg 샘플 활용

## Dependencies

### Internal
- `../../../components/subscription/`, `../../../utils/subscriptionMeta.ts`

### External
- `vitest`, `@vue/test-utils`
