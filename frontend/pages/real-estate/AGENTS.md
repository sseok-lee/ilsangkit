<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/real-estate

## Purpose
부동산 실거래가/단지 섹션. 전국 허브 + 6개 카테고리(`apt-sale`, `apt-rent`, `villa-sale`, `villa-rent`, `offitel-sale`, `offitel-rent`)별 라우트.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 부동산 섹션 허브 — 카테고리 카드 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[propertyType]/` | 카테고리 허브/건물 상세 (레거시 경로 유지) (see `[propertyType]/AGENTS.md`) |
| `[realEstateType]/` | 신규 계층 경로 (`/real-estate/[type]/[city]/[district]/...`) (see `[realEstateType]/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **부동산 slug 주의**: `offitel` (오피스텔) — `officetel` 아님
- **URL 리다이렉트**: 레거시 경로는 `server/middleware/real-estate-redirect.ts`가 301 리다이렉트
- **Notepad 메모**: 부동산 색인 위기 — 빌라 buildingName이 지번 형태. noindex 판별 `../../utils/realEstateNoindex.ts` 적용
- URL 생성/파싱은 `../../utils/realEstateUrl.ts`

### Testing Requirements
- `tests/pages/real-estate-hub.test.ts`

### Common Patterns
- `useRealEstateMeta` composable로 메타/FAQ/설명 일괄 설정
- 거래 데이터는 BigInt/Decimal 직렬화된 형태로 수신

## Dependencies

### Internal
- `../../composables/useRealEstate.ts`, `useRealEstateMeta.ts`
- `../../components/realEstate/`
- `../../utils/realEstateUrl.ts`, `realEstateMeta.ts`, `realEstateNoindex.ts`
- `../../types/realEstate.ts`

### External
- (없음)
