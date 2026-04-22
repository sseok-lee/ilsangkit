<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/integration

## Purpose
여러 레이어를 엮는 통합 테스트.

## Key Files
| File | Description |
|------|-------------|
| `real-estate-nfc.test.ts` | 부동산 NFC (근접 시설 cross-sell) 통합 |

## For AI Agents

### Working In This Directory
- 작은 단위 테스트로 커버 안 되는 시나리오 — 여러 composable/컴포넌트/페이지를 함께 렌더
- MSW 활용 가능 (네트워크 계약 검증)

### Testing Requirements
- 실행 시간은 단위보다 길다 — 필요 시 `test:coverage`에서 제외 고려

### Common Patterns
- 전체 페이지 렌더 + 상호작용 + 상태 검증

## Dependencies

### Internal
- 다수 `../../` 레이어

### External
- `vitest`, `@vue/test-utils`, MSW
