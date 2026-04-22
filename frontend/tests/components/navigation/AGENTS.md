<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/navigation

## Purpose
`components/navigation/` 테스트.

## Key Files
| File | Description |
|------|-------------|
| `Breadcrumb.test.ts` | 브레드크럼 렌더/JSON-LD 주입 |

## For AI Agents

### Working In This Directory
- `items` props 빈 배열/단일 항목/여러 단계 케이스 커버
- 접근성(`aria-label="breadcrumb"`) 확인

### Testing Requirements
- JSON-LD 구조는 `useStructuredData` mock으로 검증

### Common Patterns
- 마지막 항목은 링크 없이 렌더

## Dependencies

### Internal
- `../../../components/navigation/Breadcrumb.vue`

### External
- `vitest`, `@vue/test-utils`
