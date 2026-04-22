<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/real-estate/[realEstateType]/[city]/[district]

## Purpose
부동산 최종 상세 페이지 계층 — `/real-estate/[type]/[city]/[district]/` 허브와 `/[buildingName]` 상세.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 구/군 내 특정 부동산 타입 목록 허브 |
| `[buildingName].vue` | 건물명 상세 (실거래 테이블, 시계열 차트, 근처 시설) |

## For AI Agents

### Working In This Directory
- 전체 파라미터 조합: `realEstateType`, `city`, `district`, `buildingName`
- URL 왕복 검증: `../../../../../utils/realEstateUrl.ts`의 `buildUrl`/`parseUrl` 사용
- **Notepad 경고**: 빌라 경로는 `buildingName`이 지번 형태 — noindex 판별 적용
- SEO: `useRealEstateMeta`로 타이틀/설명/FAQ/JSON-LD 일괄 설정

### Testing Requirements
- `tests/pages/real-estate/buildingName.test.ts` (통합)
- `tests/pages/district-real-estate.test.ts`
- `tests/server/real-estate-redirect.test.ts` (미들웨어 연동)

### Common Patterns
- 404: 건물 정보 없음 → `throw createError({ statusCode: 404 })`
- 리다이렉트: 레거시 URL 수신 시 canonical로 301

## Dependencies

### Internal
- `../../../../../composables/useRealEstate.ts`, `useRealEstateMeta.ts`
- `../../../../../components/realEstate/`
- `../../../../../utils/realEstateUrl.ts`, `realEstateBuildingName.ts`, `realEstateNoindex.ts`

### External
- (없음)
