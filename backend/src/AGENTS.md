<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/src

## Purpose
Express 5 API의 실제 소스 코드. 레이어는 `routes → services → lib/prisma` 순서로 흐르고, 검증은 `schemas`(Zod), 공통 처리는 `middlewares`에 분리된다.

## Key Files
| File | Description |
|------|-------------|
| `app.ts` | Express 앱 생성 — 미들웨어 등록, 라우트 마운트, 에러 핸들러 |
| `server.ts` | `app.ts`를 import하여 포트 8000에 listen (엔트리포인트) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `routes/` | HTTP 라우트 핸들러 (see `routes/AGENTS.md`) |
| `services/` | 비즈니스 로직과 DB 접근 (see `services/AGENTS.md`) |
| `schemas/` | Zod 검증 스키마 (see `schemas/AGENTS.md`) |
| `scripts/` | CLI 동기화/시드/지오코딩 스크립트 (see `scripts/AGENTS.md`) |
| `middlewares/` | Express 미들웨어 (validate, rate limit, requestId) (see `middlewares/AGENTS.md`) |
| `lib/` | 하위 유틸 (prisma, errors, asyncHandler 등) (see `lib/AGENTS.md`) |
| `constants/` | 페이지네이션/지리/동기화 상수 (see `constants/AGENTS.md`) |
| `utils/` | 도메인 헬퍼 함수 (see `utils/AGENTS.md`) |
| `types/` | 공용 타입 (see `types/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **라우트 → 서비스 → prisma** 흐름 유지. 라우트에서 `prisma` 직접 호출 금지
- 새 카테고리 추가 시 `services/facilityService.ts`의 `CATEGORY_REGISTRY`에 등록해야 라우트 자동 활성화
- 모든 raw SQL에서 도시 필터는 `cityVariants` 양방향 매칭 (`IN (?, ?)`)

### Testing Requirements
- 서비스/라우트별로 `__tests__/`에 대응 테스트 파일 존재
- 실제 DB 필요한 테스트는 docker compose MySQL 사용

### Common Patterns
- Route: `router.get(path, validate(Schema, 'query'), asyncHandler(async (req, res) => { ... }))`
- Service: `export async function getXxx(params) { return prisma.xxx.findMany(...) }`
- Error throw: `throw new NotFoundError('...')`

## Dependencies

### Internal
- `../prisma/schema.prisma` — Prisma Client 생성 소스

### External
- `express@5`, `zod`, `@prisma/client`, `xml2js` (공공 XML API), `axios`
