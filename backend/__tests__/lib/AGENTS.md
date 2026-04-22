<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/__tests__/lib

## Purpose
`src/lib/` 하위 유틸 테스트.

## Key Files
| File | Description |
|------|-------------|
| `asyncHandler.test.ts` | Promise reject → next(err) 전파 |
| `errors.test.ts` | NotFoundError/ValidationError/ConflictError 포맷 |
| `prisma.test.ts` | Prisma 싱글톤 (인스턴스 중복 방지) |
| `publicApiClient.test.ts` | 공공 API 클라이언트 (재시도/타임아웃) |
| `realEstateBuildingName.test.ts` | 건물명 정규화 (지번 ↔ 건물명) |
| `realEstateUrl.test.ts` | 부동산 URL 생성/파싱 왕복 테스트 |

## For AI Agents

### Working In This Directory
- `realEstateBuildingName`/`realEstateUrl` 테스트는 frontend 동형(`frontend/utils/`)과 케이스 동기화 권장
- Prisma 싱글톤 테스트는 모듈 재로드 시나리오 커버

### Testing Requirements
- 순수 함수 테스트라 빠름

### Common Patterns
- 예외 throw 검증: `expect(() => ...).toThrow(NotFoundError)`
- URL 왕복: `parse(build(x)) === x`

## Dependencies

### Internal
- `../../src/lib/`

### External
- `vitest`
