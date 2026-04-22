<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/__tests__

## Purpose
백엔드 Vitest 테스트. `src/` 구조를 그대로 반영한 서브디렉터리(`routes`, `services`, `schemas`, `scripts`, `middlewares`, `lib`)로 배치한다.

## Key Files
| File | Description |
|------|-------------|
| `app.test.ts` | Express 앱 부팅/에러 핸들러 통합 테스트 |
| `crossCategoryMap.test.ts` | 카테고리 간 매핑 로직 테스트 |
| `rentalPriceStats.test.ts` | 전월세 가격 통계 계산 테스트 |
| `subscriptionPublicRentType.test.ts` | 공공 임대 청약 유형 분류 테스트 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `routes/` | 라우트 레벨 테스트 (see `routes/AGENTS.md`) |
| `services/` | 서비스 레벨 테스트 (see `services/AGENTS.md`) |
| `schemas/` | Zod 스키마 테스트 (see `schemas/AGENTS.md`) |
| `scripts/` | 동기화 스크립트 테스트 (see `scripts/AGENTS.md`) |
| `middlewares/` | 미들웨어 테스트 (see `middlewares/AGENTS.md`) |
| `lib/` | lib 유틸 테스트 (see `lib/AGENTS.md`) |
| `fixtures/` | (비어 있음 — 테스트 fixture 자리) |

## For AI Agents

### Working In This Directory
- `npm run test` 또는 `npx vitest run __tests__/path/file.test.ts`
- 테스트 파일명은 `*.test.ts`
- Prisma가 필요한 테스트는 MySQL 컨테이너 실행 전제 — CI는 GitHub Actions MySQL 서비스 컨테이너 사용
- Mock은 주로 `vi.mock('../src/lib/prisma.js', ...)` 패턴

### Testing Requirements
- 커밋 전 전체 테스트 통과 필수
- 부분 실행 시 부모 서비스/라우트 변경 여부 검증

### Common Patterns
- `describe`/`it` 구조, Kor/En 혼용 허용
- 서비스는 mocked Prisma, 라우트는 supertest 활용 가능
- 공공 XML API 호출 테스트는 `__mocks__` 또는 `vi.spyOn(publicApiClient, ...)`

## Dependencies

### Internal
- `../src/` 모든 레이어
- `../prisma/schema.prisma` — 타입 참조용

### External
- `vitest`, `supertest` (선택적)
