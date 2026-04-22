<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/common

## Purpose
`components/common/` 테스트 (일부는 상위에 배치됨 — AppHeader/AppFooter/BaseButton/BaseCard는 `tests/components/` 루트).

## Key Files
| File | Description |
|------|-------------|
| `DataSourceCard.test.ts` | 데이터 출처 카드 |
| `ErrorBoundary.test.ts` | Vue 에러 경계 |

## For AI Agents

### Working In This Directory
- `PageHero`, `SectionBlock`, `Pagination`, `SearchBar`, `StatusBadge`, `CategoryIcon` 테스트 누락 — 커버리지 확장 권장
- `ErrorBoundary`는 자식 컴포넌트 throw 시나리오 필요

### Testing Requirements
- 렌더/props/slot 검증

### Common Patterns
- `mount(Component, { slots: { default: '<p>child</p>' } })`

## Dependencies

### Internal
- `../../../components/common/`

### External
- `vitest`, `@vue/test-utils`
