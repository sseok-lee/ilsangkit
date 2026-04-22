<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/types

## Purpose
타입 가드/유틸 검증 테스트. 타입 자체는 컴파일에서 검증되므로 여기에는 런타임 타입 가드와 메타 배열/유니언 검증이 모인다.

## Key Files
| File | Description |
|------|-------------|
| `facility.test.ts` | `FacilityCategory` 유니언/CATEGORY_META 정합성 |
| `navGroups.test.ts` | 내비게이션 그룹 정의 |
| `realEstate.test.ts` | 부동산 slug 매핑 (`offitel` 철자 포함) |

## For AI Agents

### Working In This Directory
- 카테고리/부동산 추가 시 이 테스트가 실패하면 타입/메타 양쪽이 동기화되지 않았다는 신호
- `ALL_CATEGORIES`, `CATEGORY_GROUPS`, `CATEGORY_META` 교차 검증

### Testing Requirements
- 유니언 배열의 요소가 모두 메타에 존재하는지 확인

### Common Patterns
- `expect(Object.keys(CATEGORY_META).sort()).toEqual(ALL_CATEGORIES.sort())`

## Dependencies

### Internal
- `../../types/`

### External
- `vitest`
