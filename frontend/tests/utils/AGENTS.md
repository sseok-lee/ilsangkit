<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/utils

## Purpose
`utils/` 순수 함수 테스트 — 포매팅/URL/SEO 상수/카테고리 설명 등.

## Key Files
| File | Description |
|------|-------------|
| `categoryDescription.test.ts` | 카테고리 설명 생성 |
| `formatDeposit.test.ts` | 보증금/월세 포매팅 |
| `realEstateBuildingName.test.ts` | 건물명 정규화 (frontend/backend 동형 유지 확인) |
| `realEstateUrl.test.ts` | URL 생성/파싱 왕복 |
| `seoConstants.test.ts` / `seoConstants-related.test.ts` | SEO 상수 |
| `seoHelpers.test.ts` | 메타/JSON-LD 생성 헬퍼 |

## For AI Agents

### Working In This Directory
- **DRY-가드**: `realEstateBuildingName`/`realEstateUrl`는 backend 동형 테스트 (`backend/__tests__/lib/`)와 케이스 매칭
- 순수 함수 테스트 — 빠른 실행 (<100ms)
- SEO 상수 변경 시 `seoConstants-related.test.ts`로 파급 영향 확인

### Testing Requirements
- 경계값/빈 입력/긴 문자열 케이스

### Common Patterns
- `expect(buildUrl(x)).toBe(expected)`
- 왕복: `expect(parseUrl(buildUrl(x))).toEqual(x)`

## Dependencies

### Internal
- `../../utils/`

### External
- `vitest`
