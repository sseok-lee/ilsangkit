<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/subscription

## Purpose
청약 섹션 UI. 공공주택/민간분양/특별공급 청약 카드와 타임라인.

## Key Files
| File | Description |
|------|-------------|
| `SubscriptionCard.vue` | 청약 단위 카드 |
| `SubscriptionListView.vue` | 청약 목록 뷰 (필터/정렬) |
| `SpecialSupplyCard.vue` | 특별공급 전용 카드 |
| `HomeSubscriptionSection.vue` | 홈 페이지 청약 섹션 |
| `TimelineItem.vue` | 청약 일정 타임라인 항목 |
| `RentalPriceStatsBox.vue` | 전월세 임대료 통계 박스 |

## For AI Agents

### Working In This Directory
- 청약 유형 분류는 `../../utils/subscriptionMeta.ts`와 backend의 `subscriptionUtils.ts` 동형 유지
- 일정은 `접수시작/종료 ~ 당첨자발표` 형태 타임라인
- 홈 노출은 `useHomeSubscriptions` composable 사용

### Testing Requirements
- `tests/components/subscription/RentalPriceStatsBox.test.ts`
- 추가 컴포넌트 테스트 확장 권장

### Common Patterns
- 날짜 포매팅은 `../../utils/formatters.ts`
- 청약 유형 배지 색상은 메타에서 결정

## Dependencies

### Internal
- `../../composables/useSubscription.ts`, `useHomeSubscriptions.ts`
- `../../types/subscription.ts`
- `../../utils/subscriptionMeta.ts`, `formatDeposit.ts`

### External
- (없음)
