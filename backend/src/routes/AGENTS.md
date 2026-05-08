<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-05-07 -->

# backend/src/routes

## Purpose
Express 5 라우트 핸들러. 각 파일은 도메인별 엔드포인트 그룹(`/api/facilities`, `/api/real-estate` 등)을 담당하며 `app.ts`에서 마운트된다.

## Key Files
| File | Description |
|------|-------------|
| `area.ts` | `/api/area` — 지역(시/구) 요약, 지역별 시설 카운트 |
| `facilities.ts` | `/api/facilities` — 15개 시설 카테고리 목록/상세/검색 |
| `guides.ts` | `/api/guides` — 카테고리/지역 가이드 콘텐츠 |
| `meta.ts` | `/api/meta` — 카테고리/지역 메타, 지역별 통계 |
| `publicRental.ts` | `/api/public-rental` — 공공임대 매물 목록/상세 |
| `publicRentalAnnouncement.ts` | `/api/public-rental-announcement` — 공공임대 공고 목록/상세 |
| `realEstate.ts` | `/api/real-estate` — 부동산 거래/건물 목록, 상세, 시계열 |
| `sitemap.ts` | `/api/sitemap` — 사이트맵 청크, 총 URL 수 |
| `subscription.ts` | `/api/subscription` — 청약 목록/상세, 공급 유형 분류 |
| `transit.ts` | `/api/transit` — 대중교통 정보 |
| `wasteSchedules.ts` | `/api/waste-schedules` — 쓰레기 배출 일정 (좌표 없는 지역 단위) |

## For AI Agents

### Working In This Directory
- **모든 핸들러는 `asyncHandler()` 래핑 필수**: `router.get('/', validate(Schema, 'query'), asyncHandler(async (req, res) => {...}))`
- **직접 prisma 호출 금지** — 반드시 `services/`의 함수 경유
- **에러는 throw**: `NotFoundError`, `ValidationError`, `ConflictError` (전역 에러 핸들러가 포매팅)
- **응답 포맷**: `{ success: true, data, meta }` 일관성 유지
- Zod 스키마 검증은 `../schemas/`에서 import

### Testing Requirements
- 대응 테스트: `backend/__tests__/routes/<name>.test.ts` (supertest 사용 권장)
- 통합 테스트에서 DB 필요 시 MySQL 컨테이너 가동

### Common Patterns
- GET 목록: `validate(ListQuery, 'query')`
- GET 상세: `validate(DetailParams, 'params')`
- POST: `validate(Body, 'body')`
- 도시 필터는 `buildRegionFilter()` 사용 (양방향 city variant 매칭)

## Dependencies

### Internal
- `../services/` — 비즈니스 로직
- `../schemas/` — 요청 검증
- `../middlewares/validate.ts`, `../lib/asyncHandler.ts`, `../lib/errors.ts`

### External
- `express@5`
