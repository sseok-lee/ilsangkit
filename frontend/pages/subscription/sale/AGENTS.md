<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/subscription/sale

## Purpose
매매(분양) 청약 페이지 — 공급 유형별(`[type]`) 필터 + 전체 허브.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | `/subscription/sale/` 매매 청약 허브 |
| `[type].vue` | `/subscription/sale/[type]` 공급 유형별 목록 (예: 일반공급/특별공급) |

## For AI Agents

### Working In This Directory
- `[type]` 유효값은 `../../../utils/subscriptionMeta.ts`의 매핑 참조
- 유효하지 않은 type은 404

### Testing Requirements
- 통합 테스트 수준에서 라우트/필터 검증

### Common Patterns
- `useRoute().params.type`으로 유형 식별

## Dependencies

### Internal
- `../../../composables/useSubscription.ts`, `useHomeSubscriptions.ts`
- `../../../components/subscription/`, `../../../utils/subscriptionMeta.ts`

### External
- (없음)
