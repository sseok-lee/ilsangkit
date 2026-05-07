<!-- Generated: 2026-04-22 | Updated: 2026-05-07 -->

# ilsangkit

## Purpose
일상 생활에 필요한 생활 편의시설(화장실, 주차장, 약국, AED 등 15개 카테고리), 부동산 실거래가·청약 정보, 그리고 공공임대주택 정보를 통합 제공하는 정보성 웹사이트. Nuxt 3 SSR 프론트엔드 + Express 5 API 백엔드 + MySQL 8 + Prisma 구조로, 공공데이터 API를 동기화하여 서비스한다. 프로덕션 도메인: `ilsangkit.co.kr`.

## Key Files
| File | Description |
|------|-------------|
| `CLAUDE.md` | Claude Code 에이전트용 아키텍처/관례 안내 |
| `GEMINI.md` | Gemini 협업용 지침 |
| `package.json` | 루트 워크스페이스 메타 (실제 설치는 frontend/backend 개별) |
| `docker-compose.yml` | 로컬 MySQL 8 (localhost:3307) 실행 정의 |
| `ecosystem.config.js` | PM2 프로세스 매니저 설정 (프로덕션) |
| `lighthouserc.js` | Lighthouse CI 설정 |
| `PRD_SEO.md` / `TASKS_SEO.md` / `SEO_STRATEGY_REPORT.md` / `GEO-AUDIT-REPORT.md` | SEO/GEO 기획·감사 문서 |
| `*.html` / `*.png` | 페이지 리디자인 제안서, 와이어프레임, 스크린샷 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `backend/` | Express 5 API 서버 + Prisma (see `backend/AGENTS.md`) |
| `frontend/` | Nuxt 3 SSR 앱 (see `frontend/AGENTS.md`) |
| `docs/` | 기획·전략·마이그레이션 문서 (see `docs/AGENTS.md`) |
| `specs/` | YAML 명세 (API/화면/도메인/컴포넌트) (see `specs/AGENTS.md`) |
| `scripts/` | 루트 쉘 스크립트 (Lighthouse, SEO 검증) (see `scripts/AGENTS.md`) |
| `assets/` | 루트 공용 에셋 |

## For AI Agents

### Working In This Directory
- **Node 20 필수**: `nvm use 20` 후 `npm install`. Node 25 사용 시 lock 파일 불일치로 CI 실패
- **package-lock.json 삭제 후 재생성 금지**: 기존 lock 파일 유지 채 설치할 것 (oxc-parser 등 native binding 이슈 방지)
- **PR 기반 워크플로우**: main 직접 커밋 금지, CI 통과 후 머지
- **TDD 선호**: 테스트 먼저 작성 후 구현
- **커밋 전**: backend/frontend 양쪽 `npm run test` 실행 (기존 실패 테스트도 즉시 수정)

### Testing Requirements
- Backend: `cd backend && npm run test` (vitest, Node 환경)
- Frontend: `cd frontend && npm run test` (vitest, happy-dom) + `npm run test:e2e` (Playwright)
- Lint: 양쪽에서 `npm run lint`

### Common Patterns
- ESM 사용 (backend에서 로컬 import는 `.js` 확장자 필수)
- Conventional Commits (`feat(scope):`, `fix(scope):`, `perf(sync):` 등)
- 카테고리 추가 시 수정 파일은 `CLAUDE.md` 참조

## Dependencies

### External
- Nuxt 3, Vue 3, Pinia, TailwindCSS
- Express 5, Prisma, Zod
- MySQL 8 (Docker), PM2
- 공공데이터포털 API, 국토교통부 실거래가 API, NEIS 교육부 API

<!-- MANUAL: 아래는 수동 작성 섹션 — 재생성 시 보존됨 -->

# Repository Guidelines

## Project Structure & Module Organization

This is a two-package TypeScript application. `frontend/` contains the Nuxt 3/Vue 3 SSR app: pages in `frontend/pages`, components in `frontend/components`, composables in `frontend/composables`, Nitro routes in `frontend/server`, public assets in `frontend/public`, and tests in `frontend/tests`. `backend/` contains the Express 5 API: routes in `backend/src/routes`, services in `backend/src/services`, schemas in `backend/src/schemas`, Prisma files in `backend/prisma`, sync scripts in `backend/src/scripts`, and tests in `backend/__tests__`. Root files cover Docker, Lighthouse, and CI.

## Build, Test, and Development Commands

Use Node 20 (`nvm use`) and install dependencies in each package.

```bash
docker compose up -d          # start local MySQL on localhost:3307
cd backend && npm run dev     # API server on port 8000
cd frontend && npm run dev    # Nuxt dev server on port 3000
cd backend && npm run build   # compile backend TypeScript
cd frontend && npm run build  # build Nuxt SSR app
```

Run `npm run lint`, `npm run test`, and `npm run test:coverage` in the changed package. Frontend E2E tests use `cd frontend && npm run test:e2e`.

## Coding Style & Naming Conventions

Both packages use TypeScript, ESLint, and Prettier with 2-space indentation and single quotes. Frontend omits semicolons; backend requires them. Backend is ESM, so local imports need `.js` extensions, for example `import prisma from '../lib/prisma.js';`. Use PascalCase Vue components, `useThing.ts` composables, `thingService.ts` services, and `*.test.ts` tests.

## Testing Guidelines

Vitest is the unit test runner. Backend tests run in Node under `backend/__tests__/**/*.test.ts`; frontend tests run in `happy-dom` with setup in `frontend/tests/setup.ts`. Place tests near the matching domain, such as `frontend/tests/composables/useFacilitySearch.test.ts` or `backend/__tests__/services/facilityService.test.ts`. Add Playwright coverage under `frontend/tests/e2e` for browser layout or interaction.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits with optional scopes, for example `fix(guide): ...`, `perf(sync): ...`, and `refactor: ...`. Use concise subjects that describe the user-visible or maintenance impact. Pull requests should include a short summary, linked issue when available, test commands run, and screenshots or Lighthouse notes for UI, SEO, or performance changes.

## Security & Configuration Tips

Do not commit real secrets. Start from `backend/.env.example` and `frontend/.env.example`; local database defaults are documented in `docker-compose.yml`. Run Prisma changes from `backend/` and prefer `npm run db:migrate` for schema changes that should be preserved.
