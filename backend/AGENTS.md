<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend

## Purpose
Express 5 + TypeScript (ESM) API 서버. MySQL 8을 Prisma ORM으로 조작하며 공공데이터 API를 동기화해 프론트엔드에 서빙한다. 포트 8000. 프로세스 매니저는 PM2 (`ilsangkit-backend`).

## Key Files
| File | Description |
|------|-------------|
| `package.json` | 스크립트(`dev`, `build`, `test`, `db:*`, `lint`)와 의존성 |
| `tsconfig.json` | TypeScript 빌드 설정 (ESM, `module: NodeNext`) |
| `vitest.config.ts` | Vitest 단위 테스트 설정 (Node 환경) |
| `eslint.config.js` | ESLint flat config |
| `SYNC.md` | 공공데이터 동기화 스크립트 실행 가이드 |
| `study-fcm-by-alvin-*.json` | Google Indexing API 서비스 계정 키 (gitignored, `.env`의 `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`로 참조) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | API 구현 소스 (see `src/AGENTS.md`) |
| `prisma/` | Prisma 스키마와 시드 (see `prisma/AGENTS.md`) |
| `__tests__/` | Vitest 단위/통합 테스트 (see `__tests__/AGENTS.md`) |
| `data/` | 원본 CSV/JSON 데이터 (동기화 입력, gitignore 권장) |
| `dist/` | `tsc` 빌드 산출물 (gitignore) |
| `coverage/` | 테스트 커버리지 리포트 (gitignore) |

## For AI Agents

### Working In This Directory
- **ESM 필수**: 모든 로컬 import에 `.js` 확장자 — `import prisma from '../lib/prisma.js';`
- **asyncHandler 래핑**: 모든 라우트 핸들러는 `asyncHandler(async (req, res) => ...)`로 감싼다 (`src/lib/asyncHandler.ts`)
- **에러는 throw**: `res.status().json()` 대신 `NotFoundError`/`ValidationError`/`ConflictError` 클래스 throw
- **Express 5 주의**: `req.query`/`req.params` read-only — validate 미들웨어에서 `Object.defineProperty`로 교체
- **BigInt/Decimal 직렬화**: 부동산 응답은 `serializeRow()` 필수 (`src/services/realEstateService.ts`)

### Testing Requirements
- `npm run test` — 전체 Vitest
- `npx vitest run __tests__/path/to/file.test.ts` — 단일 파일
- Prisma 관련 테스트는 로컬 MySQL(`docker compose up -d`) 필요

### Common Patterns
- Category Registry 추상화 (`src/services/facilityService.ts`의 `CATEGORY_REGISTRY`)
- City Variant Matching (`서울특별시`/`서울` 혼재 — `CITY_SLUG_TO_FULL`/`CITY_SLUG_TO_SHORT`)
- Sync Pipeline: `runSync` + `batchUpsert` (500건 배치)
- Zod 스키마로 요청 검증 → 실패 시 422 자동 응답

## Dependencies

### Internal
- `frontend/` — API 소비자 (Nuxt에서 `/api/**`로 프록시)

### External
- `express@5`, `prisma`, `@prisma/client`, `zod`
- `tsx`, `vitest`, `eslint`
- Public APIs: 공공데이터포털, 국토교통부 실거래가, NEIS
