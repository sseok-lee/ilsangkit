<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/src/middlewares

## Purpose
Express 미들웨어. 요청 ID 부여, 보안 헤더, 레이트 리미트, Zod 스키마 검증.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | 배럴 export |
| `requestId.ts` | 각 요청에 uuid 부여 (로깅/에러 추적용) |
| `security.ts` | Helmet 기반 보안 헤더, CORS 설정 |
| `rateLimit.ts` | 레이트 리미트 (IP 기반) |
| `validate.ts` | Zod 스키마로 `req.query`/`req.params`/`req.body` 검증 — Express 5 read-only 이슈 때문에 `Object.defineProperty`로 교체 |

## For AI Agents

### Working In This Directory
- `validate(Schema, 'query' | 'params' | 'body')` 커링 형태 export
- 검증 실패 시 `ValidationError` throw (전역 에러 핸들러가 422 응답)
- Express 5는 `req.query` setter가 없어서 `Object.defineProperty(req, 'query', { value: parsed })` 패턴 사용
- 레이트 리미트는 IP 기반 — 프록시 환경에서는 `X-Forwarded-For` 신뢰 설정 필요
- CORS origin은 `CORS_ORIGIN` 환경변수 (콤마 구분)

### Testing Requirements
- `backend/__tests__/middlewares/<name>.test.ts`
- 실제 Express 앱 없이도 `(req, res, next)` 모의 객체로 테스트 가능

### Common Patterns
- `export function xxxMiddleware(options) { return (req, res, next) => { ... } }`

## Dependencies

### Internal
- `../lib/errors.ts` — ValidationError throw

### External
- `express@5`, `zod`, `helmet`, `cors`, `express-rate-limit`, `uuid`
