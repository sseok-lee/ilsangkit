<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/src/types

## Purpose
백엔드 공용 타입. API 응답 포맷, 카테고리 enum, 시설/지역 DTO를 선언.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | 배럴 export |
| `api.ts` | `ApiResponse<T>`, `ApiError` 공통 타입 |
| `category.ts` | `FacilityCategory` union, `ALL_CATEGORIES` 배열 |
| `facility.ts` | 시설 DTO (프론트엔드 응답 타입과 일치) |
| `region.ts` | 지역(city/district) 타입 |

## For AI Agents

### Working In This Directory
- **새 카테고리 추가 시**: `category.ts`의 `FacilityCategory` union + `ALL_CATEGORIES` 배열
- 프론트엔드 `frontend/types/`와 키/유니언 일치해야 함 (드리프트 주의)
- Prisma에서 생성된 타입을 직접 import하지 말고 DTO로 분리해 노출

### Testing Requirements
- 타입 자체는 컴파일 단계에서 검증
- 사용처 테스트가 타입을 간접 검증

### Common Patterns
- `as const` 배열 → `typeof` union 추출
- `Pick<>`, `Omit<>`으로 DTO 파생

## Dependencies

### Internal
- `../schemas/` — Zod `z.infer`로 일부 타입 파생 가능

### External
- (없음)
