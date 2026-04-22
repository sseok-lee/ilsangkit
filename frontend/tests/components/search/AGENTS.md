<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/search

## Purpose
`components/search/` 테스트.

## Key Files
| File | Description |
|------|-------------|
| `SearchInput.test.ts` | 입력 디바운스/자동완성 |
| `SearchFilters.test.ts` | 필터 변경 이벤트 |

## For AI Agents

### Working In This Directory
- 디바운스 테스트는 `vi.useFakeTimers()` + `vi.advanceTimersByTime()`
- URL 쿼리스트링 동기화는 페이지 테스트에서

### Testing Requirements
- 입력값 → emit된 payload 구조 검증

### Common Patterns
- `await wrapper.find('input').setValue('...')` 후 emit 확인

## Dependencies

### Internal
- `../../../components/search/`

### External
- `vitest`, `@vue/test-utils`
