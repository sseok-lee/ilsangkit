<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/__tests__/scripts

## Purpose
CLI 스크립트 테스트. 동기화 orchestrator, 부동산 동기화 6종, 지오코딩, 가이드 생성, 런타임 가드를 커버.

## Key Files
| File | Description |
|------|-------------|
| `syncAll.test.ts` | 전체 동기화 orchestrator (순서/에러 전파) |
| `syncAptSale.test.ts` / `syncAptRent.test.ts` / `syncVillaSale.test.ts` / `syncVillaRent.test.ts` / `syncOffitelSale.test.ts` / `syncOffitelRent.test.ts` | 부동산 실거래가 6종 |
| `syncPublicRent.test.ts` | 공공임대 |
| `geocodeRealEstate.test.ts` | 부동산 주소 → 좌표 |
| `generateGuide.test.ts` | 가이드 자동 생성 |
| `_runtimeGuard.test.ts` | 런타임 환경 검증 |

## For AI Agents

### Working In This Directory
- 실제 API 호출 없이 XML/JSON fixture로 테스트
- Prisma mock 필수 — 실제 DB 쓰기 방지
- `process.env` 재설정은 `beforeEach`에서 초기화

### Testing Requirements
- 부동산 동기화는 수량/거래/전월세 파싱 변환 로직 중심

### Common Patterns
- XML fixture는 테스트 파일 또는 `__fixtures__/` 디렉터리에 보관
- Mock 응답은 실제 공공 API 응답 형태 유지

## Dependencies

### Internal
- `../../src/scripts/`, `../../src/services/syncRealEstateBase.ts`, `baseSyncService.ts`

### External
- `vitest`
