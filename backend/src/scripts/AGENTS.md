<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-05-07 -->

# backend/src/scripts

## Purpose
CLI 스크립트 모음. 공공데이터 동기화 (`sync*.ts`), 지오코딩 (`geocode*.ts`), 시드 (`seed*.ts`), 런타임 가드 (`_runtimeGuard.ts`), 유지보수 (`fixRegionSlugs.ts`, `refreshRealEstateSummary.ts`). `npx tsx src/scripts/<name>.ts`로 실행.

## Key Files
| File | Description |
|------|-------------|
| `README.md` | 동기화 스크립트 실행 순서/옵션 가이드 |
| `syncAll.ts` | 15개 시설 + 부동산 전체 동기화 orchestrator |
| `syncToilet.ts`/`syncPark.ts`/`syncSchool.ts`/... | 카테고리별 동기화 (총 20+개 스크립트) |
| `syncAptSale.ts`/`syncAptRent.ts`/`syncVillaSale.ts`/`syncVillaRent.ts`/`syncOffitelSale.ts`/`syncOffitelRent.ts` | 부동산 실거래가 동기화 (6종) |
| `syncSubscription.ts` | 청약 동기화 |
| `syncSchoolNeis.ts`/`syncSchoolDepartment.ts`/`syncSchoolEnrollment.ts`/`mergeSchoolNeis.ts` | 학교 NEIS 다단계 동기화 |
| `syncRegion.ts` | 지역 마스터 데이터 |
| `geocodeRealEstate.ts`/`geocodeSchool.ts`/`geocodeSubscriptions.ts` | 주소 → 좌표 지오코딩 |
| `seedHospitalDetail.ts`/`seedSubscription.ts` | 상세 정보 시드 |
| `refreshRealEstateSummary.ts` | 요약 갱신 |
| `submitIndexing.ts` | Google IndexNow/Search Console 색인 요청 |
| `generateGuide.ts` | 가이드 콘텐츠 자동 생성 |
| `loadTest.ts` | API 부하 테스트 |
| `_runtimeGuard.ts` / `_checkBuildings.ts` / `_checkGeocode.ts` | 런타임 검증/점검 (밑줄 접두어는 내부 유틸) |

## For AI Agents

### Working In This Directory
- **새 카테고리 동기화 스크립트는 `syncToilet.ts`를 템플릿으로** — `baseSyncService.runSync()` + `batchUpsert()` 패턴
- 부동산은 `syncRealEstateBase.ts` 공통 유틸 재사용
- `SyncHistory`로 상태 추적 (running → success/failed)
- 배치 크기 500건 (`../constants/sync.ts`의 상수)
- API 타임아웃 30초
- **MySQL Zombie 방지** (Notepad 지적): 장기 트랜잭션 피하기 + SIGTERM 핸들러 + statement timeout
- 스크립트 시작 시 `_runtimeGuard.ts`로 env/DB 연결 검증

### Testing Requirements
- 대응 테스트: `backend/__tests__/scripts/<name>.test.ts`
- XML fixture, Prisma mock 기반 단위 테스트 위주
- 실제 API 호출은 `OPENAPI_SERVICE_KEY` 환경변수 필요

### Common Patterns
```typescript
async function main() {
  await runSync('toilet', async (historyId) => {
    const rows = await fetchFromPublicApi();
    await batchUpsert(prisma.toilet, rows, { sourceId: true });
  });
}
main().catch(console.error);
```

## Dependencies

### Internal
- `../services/baseSyncService.ts`, `syncRealEstateBase.ts`
- `../services/publicApiClient.ts`, `neisApiClient.ts`
- `../lib/prisma.js`, `../lib/csvParser.ts`

### External
- `tsx` (실행기), `xml2js`, `axios`
- 공공데이터포털, 국토교통부, NEIS API
