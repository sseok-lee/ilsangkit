<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/__tests__/routes

## Purpose
라우트 레벨 테스트. HTTP 요청/응답 통합 테스트가 위주이며 `src/routes/` 파일과 대응.

## Key Files
| File | Description |
|------|-------------|
| `area.test.ts` | `/api/area` 지역 요약 |
| `facilities.test.ts` | `/api/facilities` 목록/검색 |
| `facilityDetail.test.ts` | 시설 상세 |
| `facilityRegion.test.ts` | 지역 필터 (city variant 양방향 매칭 검증) |
| `evChargerStatus.test.ts` | 충전소 상태 |
| `meta.test.ts` / `meta-region-by-bjd.test.ts` | 메타 API, 법정동 코드 기반 |
| `sitemap.integration.test.ts` | 사이트맵 통합 테스트 |

## For AI Agents

### Working In This Directory
- `supertest`로 Express 앱 호출 권장
- 실제 DB 필요 시 docker compose MySQL 가동 (`npm run db:push`로 스키마 반영)
- 라우트 핸들러가 throw 한 에러가 전역 핸들러에서 올바른 `{ success, error: { code, message } }`로 변환되는지 확인

### Testing Requirements
- `npm run test` 또는 `npx vitest run __tests__/routes/<file>.test.ts`
- 422/404/409 에러 케이스 커버

### Common Patterns
- `describe('GET /api/xxx', () => { it('...', async () => { ... }) })`
- 응답 포맷: `expect(res.body).toEqual({ success: true, data: ... })`

## Dependencies

### Internal
- `../../src/routes/`, `../../src/services/`, `../../src/app.ts`

### External
- `vitest`, `supertest`
