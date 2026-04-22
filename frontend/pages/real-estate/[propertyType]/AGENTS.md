<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/real-estate/[propertyType]

## Purpose
부동산 카테고리(`propertyType`) 허브와 건물명 상세 페이지. 레거시 경로 구조.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | `/real-estate/[propertyType]/` — 카테고리 목록/검색 |
| `[buildingName].vue` | `/real-estate/[propertyType]/[buildingName]` — 건물 상세 |

## For AI Agents

### Working In This Directory
- `propertyType` 유효성: `apt-sale`, `apt-rent`, `villa-sale`, `villa-rent`, `offitel-sale`, `offitel-rent` 중 하나
- `buildingName`은 URL-encoded 한글/영문 혼합 — 정규화는 `../../utils/realEstateBuildingName.ts` 사용
- **Notepad 경고**: 빌라 `buildingName`이 지번 "(535-3)" 형태로 색인 위기 — 빌라 경로는 noindex 고려
- 신규 경로(`[realEstateType]/`)로 리다이렉트 대상이 많음 — 미들웨어 확인

### Testing Requirements
- `tests/pages/real-estate/buildingName.test.ts`

### Common Patterns
- `const { propertyType, buildingName } = useRoute().params`
- URL 파싱 실패 시 404

## Dependencies

### Internal
- `../../../composables/useRealEstate.ts`
- `../../../utils/realEstateUrl.ts`, `realEstateBuildingName.ts`, `realEstateNoindex.ts`

### External
- (없음)
