<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/__tests__/middlewares

## Purpose
Express 미들웨어 테스트.

## Key Files
| File | Description |
|------|-------------|
| `requestId.test.ts` | 요청 UUID 부여 |
| `security.test.ts` | Helmet/CORS 헤더 |
| `rateLimit.test.ts` | 레이트 리미트 |
| `validate.test.ts` | Zod 검증 + Express 5 read-only 쿼리 교체 |

## For AI Agents

### Working In This Directory
- `(req, res, next)` 모의 객체로 미들웨어 호출
- `validate` 테스트는 Express 5 `req.query` setter 없음 이슈를 커버 — `Object.defineProperty` 교체 동작 확인

### Testing Requirements
- DB 불필요, 빠른 테스트

### Common Patterns
- `const next = vi.fn(); middleware(req, res, next); expect(next).toHaveBeenCalled()`
- 에러 전파: `expect(next).toHaveBeenCalledWith(expect.any(ValidationError))`

## Dependencies

### Internal
- `../../src/middlewares/`

### External
- `vitest`
