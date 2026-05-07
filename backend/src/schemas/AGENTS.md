<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-05-07 -->

# backend/src/schemas

## Purpose
Zod 검증 스키마. 라우트가 `validate` 미들웨어로 사용하며, 검증 실패 시 422 `ValidationError` 자동 throw.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | 배럴 export |
| `common.ts` | 공용 스키마 (페이지네이션, 좌표, 반경 등) |
| `facility.ts` | 시설 리스트/상세/검색 요청 스키마 |
| `publicRental.ts` | 공공임대 매물 스키마 |
| `publicRentalAnnouncement.ts` | 공공임대 공고 스키마 |
| `realEstate.ts` | 부동산 스키마 + `RealEstateTypeSchema` enum (`apt-sale`, `villa-rent`, `offitel-sale` 등) |
| `search.ts` | 통합 검색 스키마 |
| `subscription.ts` | 청약 스키마 |
| `wasteSchedule.ts` | 쓰레기 배출 일정 스키마 |

## For AI Agents

### Working In This Directory
- **새 카테고리 추가 시**: `facility.ts`의 유니언/enum에 추가
- **부동산 추가 시**: `realEstate.ts`의 `RealEstateTypeSchema` enum에 추가 (`offitel` 철자 주의, `officetel` 아님)
- 페이지네이션 기본값은 `common.ts` 상수 재사용 (DEFAULT_PAGE=1, DEFAULT_LIMIT=20, MAX_LIMIT=100)
- Korea 좌표 범위: lat 33-39, lng 124-131 (`../constants/geo.ts` 참조)

### Testing Requirements
- 대응 테스트: `backend/__tests__/schemas/<name>.test.ts`
- 케이스: 유효 입력, 경계값, 타입 불일치, 필수 누락

### Common Patterns
- `z.object({ ... })` + `.strict()` 또는 `.passthrough()` 명시
- `z.coerce.number()` — 쿼리스트링 문자열 → 숫자
- enum은 `z.enum(['a', 'b'] as const)` + 파생 타입 `z.infer<typeof>`

## Dependencies

### Internal
- `../constants/` — 제한값 상수
- `../middlewares/validate.ts` — 소비자

### External
- `zod`
