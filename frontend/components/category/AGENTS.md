<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/category

## Purpose
카테고리 허브/내비게이션 진입점 UI. 홈과 카테고리 허브 페이지의 주 탐색 컴포넌트.

## Key Files
| File | Description |
|------|-------------|
| `CategoryCards.vue` | 카테고리 그리드 카드 (홈/카테고리 허브용) |
| `CategoryChips.vue` | 가로 스크롤 카테고리 칩 (컴팩트 내비) |
| `CategoryIntro.vue` | 카테고리 허브 상단 인트로 (설명/데이터 출처) |

## For AI Agents

### Working In This Directory
- 카테고리 메타는 `../../types/facility.ts`의 `CATEGORY_GROUPS`/`CATEGORY_META` 참조
- 색상/아이콘은 `../../utils/categoryColors.ts`, `categoryIcons.ts` 경유
- 새 카테고리 추가 시 이 컴포넌트들은 자동 반영됨 (CATEGORY_GROUPS만 업데이트하면 됨)

### Testing Requirements
- `tests/components/category/` — `CategoryChips.test.ts`, `CategoryIntro.test.ts`

### Common Patterns
- `CATEGORY_GROUPS`를 `v-for`로 순회
- 각 카테고리 링크는 `/[category]/` 경로

## Dependencies

### Internal
- `../../types/facility.ts`, `../../utils/categoryColors.ts`, `categoryIcons.ts`, `categoryDescriptions.ts`, `dataSource.ts`
- `../common/CategoryIcon.vue`

### External
- (없음)
