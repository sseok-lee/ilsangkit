<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/mocks/data

## Purpose
MSW 핸들러가 참조할 목업 데이터. 카테고리/시설/지역 샘플을 분리해 핸들러 로직과 분리 유지.

## Key Files
| File | Description |
|------|-------------|
| `facilities.ts` | 시설 샘플 데이터 (여러 카테고리, 여러 지역) |

## For AI Agents

### Working In This Directory
- 데이터는 프로덕션 스키마와 동일한 구조 유지 — 타입 빠지면 런타임 오류
- 지나치게 많은 데이터 대신 케이스별(정상/빈 데이터/에러) 대표 샘플

### Testing Requirements
- 데이터 자체 테스트 없음 — 핸들러 테스트에서 간접 검증

### Common Patterns
- `export const MOCK_FACILITIES = [ ... ] as const`
- 도메인 타입 어노테이션 유지

## Dependencies

### Internal
- `../../types/facility.ts`

### External
- (없음)
