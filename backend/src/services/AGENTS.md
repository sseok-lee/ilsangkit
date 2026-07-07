<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-05-07 -->

# backend/src/services

## Purpose
비즈니스 로직과 DB 접근 레이어. 카테고리 추상화(`CATEGORY_REGISTRY`), 공공데이터 동기화 공통 파이프라인(`baseSyncService`), 도메인별 서비스가 모여있다. **핫패스**: `realEstateService.ts` (103회 수정).

## Key Files
| File | Description |
|------|-------------|
| `facilityService.ts` | 시설 공통 CRUD + `CATEGORY_REGISTRY` 추상화 (핵심) |
| `categoryRegistry.ts` | 카테고리 등록/해석 |
| `cityMapping.ts` | `CITY_SLUG_TO_FULL`/`CITY_SLUG_TO_SHORT` 변환 |
| `realEstateService.ts` | 부동산 거래/건물명 정규화/통계 |
| `realEstateSummaryService.ts` | 부동산 집계(`refreshSummary` — MySQL zombie 이슈 주의) |
| `syncRealEstateBase.ts` | 부동산 동기화 공통 유틸 (XML 파싱, 배치 upsert) |
| `baseSyncService.ts` | 시설 동기화 공통 유틸 (`runSync`, `batchUpsert` 500건) |
| `*SyncService.ts` | 카테고리별 동기화 서비스 (toilet, park, school, aed, hospital 등) |
| `publicApiClient.ts` | 공공데이터포털 API HTTP 클라이언트 |
| `neisApiClient.ts` | NEIS 교육부 API 클라이언트 |
| `evChargerService.ts` | 충전소 `statId` GROUP BY raw query |
| `subscriptionService.ts` | 청약 분류/필터링 |
| `viewCountService.ts` | 조회수 카운팅 |
| `geocodingService.ts` | Kakao 지도 API 역지오코딩 |
| `indexNowService.ts` | IndexNow 검색엔진 색인 제출 |
| `sitemapService.ts` / `metaService.ts` / `guideService.ts` / `areaService.ts` / `areaSummaryService.ts` / `wasteScheduleService.ts` / `facilityStatsService.ts` | 각 도메인 서비스 |

## For AI Agents

### Working In This Directory
- **새 카테고리 추가의 시작점**: `facilityService.ts`의 `CATEGORY_REGISTRY` — `model()`, `listFields`, `detailFields` 3개 키 작성
- **City Variant**: 지역 필터 시 반드시 `buildRegionFilter()` 혹은 `cityVariants` 양방향 매칭 (raw query는 `IN (?, ?)`)
- **`realEstateService.ts`의 `refreshSummary()`**: Notepad 지적대로 장기 트랜잭션 + 루프 upsert로 buffer pool 잠금 이슈 있음 — 수정 시 배치 트랜잭션 + statement timeout + SIGTERM 핸들러 + Prisma pool 설정 고려
- **BigInt/Decimal 직렬화**: 부동산 응답은 `serializeRow()` 필수 (JSON 호환)
- **ESM `.js` 확장자**: 모든 로컬 import

### Testing Requirements
- `backend/__tests__/services/` 대응 — 대부분 서비스는 Prisma mock 기반
- 동기화 서비스는 XML fixture 활용

### Common Patterns
- `export async function getXxx(params)` 함수 네이밍
- Prisma client는 `../lib/prisma.js`에서 import (싱글톤)
- 에러는 서비스 레벨에서 throw (라우트에서 캐치 금지)

## Dependencies

### Internal
- `../lib/prisma.js` — Prisma Client 싱글톤
- `../lib/errors.js`, `../lib/publicApiClient.js`, `../lib/csvParser.js`
- `../schemas/` — 내부 검증 시
- `../prisma/schema.prisma` (타입)

### External
- `@prisma/client`, `axios`, `xml2js`, Kakao Local API
