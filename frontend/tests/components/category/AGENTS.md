<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/category

## Purpose
`components/category/` 테스트.

## Key Files
| File | Description |
|------|-------------|
| `CategoryChips.test.ts` | 가로 스크롤 칩 렌더/클릭 |
| `CategoryIntro.test.ts` | 카테고리 허브 인트로 |

## For AI Agents

### Working In This Directory
- `CategoryCards.test.ts` 누락 — 그리드 카드 테스트 추가 권장
- 글로벌 stub (`NuxtLink`) 활용

### Testing Requirements
- 카테고리 목록 순서/그룹 검증

### Common Patterns
- `FacilityCategory` 유니언 변경 시 재실행 필요

## Dependencies

### Internal
- `../../../components/category/`, `../../../types/facility.ts`

### External
- `vitest`, `@vue/test-utils`
