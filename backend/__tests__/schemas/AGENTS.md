<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/__tests__/schemas

## Purpose
Zod 스키마 테스트. 유효/무효 입력을 검증하여 API 입력 계약을 보증한다.

## Key Files
| File | Description |
|------|-------------|
| `common.test.ts` | 페이지네이션, 좌표, 반경 검증 |
| `facility.test.ts` | 시설 스키마 |
| `realEstate.test.ts` | `RealEstateTypeSchema` enum + 거래/임대 검증 |
| `search.test.ts` | 통합 검색 스키마 |
| `subscription.test.ts` | 청약 스키마 |

## For AI Agents

### Working In This Directory
- 케이스 매트릭스: 유효 입력 / 경계값 / 타입 불일치 / 필수 누락 / 추가 필드 (strict 모드 확인)
- 에러 응답은 Zod `safeParse`의 `error.issues`로 검증

### Testing Requirements
- 빠른 테스트 (DB 필요 없음)

### Common Patterns
- `expect(Schema.safeParse(input).success).toBe(true/false)`
- `expect(result.data).toEqual(expected)`

## Dependencies

### Internal
- `../../src/schemas/`

### External
- `vitest`, `zod`
