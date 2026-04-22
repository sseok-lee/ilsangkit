<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/types

## Purpose
프론트엔드 공용 TypeScript 타입 정의. API 응답, 시설/부동산 도메인, 리뷰/청약 구조를 선언한다.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | 배럴 export |
| `api.ts` | API 응답 공통 타입 (`ApiResponse<T>`, 에러 포맷) |
| `facility.ts` | `FacilityCategory` 유니언, `CATEGORY_GROUPS`, `CATEGORY_META`, `CATEGORY_DATA_PORTAL_URL`, 시설 레코드 타입 |
| `realEstate.ts` | 부동산 타입/slug 매핑, 거래/임대 enum |
| `review.ts` | 리뷰 레코드/입력 타입 |
| `subscription.ts` | 청약 레코드/공급 유형 타입 |

## For AI Agents

### Working In This Directory
- **새 카테고리 추가 시 `facility.ts`가 시작점** — `FacilityCategory` union, `CATEGORY_GROUPS`, `CATEGORY_META`, `CATEGORY_DATA_PORTAL_URL` 4종 업데이트
- 부동산 추가 시 `realEstate.ts`의 slug 매핑 (`officetel` 아닌 `offitel` 주의)
- Backend 응답 타입과 일치 — backend의 Prisma 타입에서 직접 import하지 않고 DTO로 분리

### Testing Requirements
- `tests/types/facility.test.ts`, `navGroups.test.ts`, `realEstate.test.ts` — 타입 가드/변환 로직 검증

### Common Patterns
- 유니언 타입은 `as const` 배열로 선언 → `typeof` 추출
- 공용 DTO는 backend `src/types/`와 키 일치

## Dependencies

### Internal
- `../composables/`, `../components/`, `../pages/` 전역 사용

### External
- (없음 — 순수 타입 선언)
