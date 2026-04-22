<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/mocks

## Purpose
MSW 핸들러 테스트.

## Key Files
| File | Description |
|------|-------------|
| `handlers.test.ts` | `mocks/handlers/` 응답 포맷/에러 시나리오 |

## For AI Agents

### Working In This Directory
- MSW `setupServer()`로 node 환경에서 fetch 후 응답 검증
- 핸들러 추가 시 여기에 엔드포인트별 케이스 추가

### Testing Requirements
- 응답 타입이 `ApiResponse<T>` 포맷에 맞는지 확인

### Common Patterns
- `const server = setupServer(...handlers)` / `beforeAll(() => server.listen())` / `afterAll(() => server.close())`

## Dependencies

### Internal
- `../../mocks/handlers/`

### External
- `msw/node`, `vitest`
