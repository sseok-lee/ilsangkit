<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/pages/real-estate

## Purpose
부동산 상세 페이지 통합 테스트.

## Key Files
| File | Description |
|------|-------------|
| `buildingName.test.ts` | `[buildingName].vue` 렌더/URL/404/noindex |

## For AI Agents

### Working In This Directory
- URL 왕복 (build → parse → match) 검증
- 빌라 `buildingName`이 지번 형태일 때 noindex 메타 삽입 검증 (Notepad 메모: 색인 위기 대응)
- Mock 거래 fixture는 수량/거래/전월세 모두 커버

### Testing Requirements
- 대응 서버 리다이렉트 테스트(`tests/server/real-estate-redirect.test.ts`)와 함께 확인

### Common Patterns
- `vi.mock('~/composables/useRealEstate', ...)` 로 데이터 주입

## Dependencies

### Internal
- `../../../pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
- `../../../utils/realEstateNoindex.ts`, `realEstateUrl.ts`

### External
- `vitest`, `@vue/test-utils`
