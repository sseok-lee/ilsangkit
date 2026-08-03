# ev-charger sync 견고화 (워크스트림 C) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 514k행 대용량 페이지네이션 ev-charger sync가 (1) 전체를 메모리에 누적하다 OOM 위험, (2) 한 페이지의 영구 실패(상류 502/504/타임아웃)에 전체가 throw되어 0건 저장되던 것을, **페이지별 증분 upsert(메모리 바운드+부분 내구성)** + **페이지 실패 skip-continue(all-or-nothing 제거)**로 견고화한다.

**Architecture:** `syncEvChargers`(evChargerSyncService.ts)가 `fetchEvChargerPage`(백오프 재시도 기존)로 전 페이지를 돌며 `allItems`에 누적 → 마지막에 dedup → 단일 `batchUpsertRaw`. 이 루프를 페이지별 즉시 upsert로 재구성하고, 페이지 fetch 실패를 루프 내 try/catch로 흡수한다.

**Tech Stack:** TS(ESM), Prisma, `batchUpsertRaw`, vitest.

## Global Constraints

- Node 20. package-lock 재생성 금지. ESM `.js`. PR→develop, self-merge 금지.
- sourceId=`statId-chgerId`(안정키), upsert 키=sourceId — **불변**. transform(`transformEvChargerItem`)·`fetchEvChargerPage`의 기존 백오프·다른 카테고리 **불변**.
- 페이지 간 전역 dedup은 upsert-by-sourceId가 대체(후행 페이지가 덮음) — 페이지 내 dedup만 유지.
- 페이지 영구 실패 시 **전체 throw 금지** — 로그+추적 후 다음 페이지 계속. 최종 상태: 실패 페이지 있으면 부분성공 표기, 과다 실패 시 failed.
- 환경변수 `EV_CHARGER_NUM_OF_ROWS`(기본1000)·`EV_CHARGER_FETCH_TIMEOUT_MS`(기본60s) 유지.

## Tasks

### Task 1: 증분 per-page upsert (메모리 바운드 + 부분 내구성)

**Files:** Modify `src/services/evChargerSyncService.ts`(`syncEvChargers` 루프). Test: `__tests__/services/evChargerSync.test.ts`(있으면 확장, 없으면 신규).

**Interfaces:** `syncEvChargers(): Promise<SyncStats>` 시그니처 불변.

- [ ] **Step 1: 실패 테스트/구조 테스트** — 루프가 페이지별로 upsert를 호출하는지(모킹) 또는 순수 헬퍼(페이지 items→rowsForUpsert 매핑)를 추출해 단위검증. 최소: `transformEvChargerItem` + 페이지 매핑이 sourceId 기준 페이지-내 dedup을 하는지.
- [ ] **Step 2: 구현**
  - `allItems` 전역 누적 **제거**. 페이지 루프를 `totalPages = Math.ceil(totalCount / NUM_OF_ROWS)` 기준 `for (let pageNo=1; pageNo<=totalPages; pageNo++)`로 재구성(현 `while(totalRecords<totalCount)` 대신 — skip 시 종료조건 안전).
  - 각 페이지: fetch → transform → **페이지 내 dedup(Map<sourceId>)** → 그 페이지 rows를 `rowsForUpsert` 매핑 → **즉시 `batchUpsertRaw('EvCharger', pageRows, 100, syncHistory.id, {exactStats,uniqueKey:'sourceId'})`** → newCount/updateCount를 stats에 **누적**. 페이지 처리 후 참조 해제(메모리 바운드).
  - stats.totalRecords/skippedRecords 페이지별 누적. 마지막 단일 upsert 블록 제거.
  - 성공 시 updateSyncHistory(status success, 누적 stats).
- [ ] **Step 3: 테스트 통과** + `npx vitest run __tests__/services/evChargerSync.test.ts` + `npx tsc --noEmit` clean
- [ ] **Step 4: 커밋** — `perf(ev-charger): 페이지별 증분 upsert(메모리 바운드+부분 내구성)`

### Task 2: 페이지 실패 skip-continue (all-or-nothing 제거)

**Files:** Modify `src/services/evChargerSyncService.ts`(T1의 루프). Test: 동일 파일.

- [ ] **Step 1: 실패 테스트** — 특정 페이지 fetch가 계속 throw할 때(모킹) sync가 **전체 throw 안 하고** 나머지 페이지를 upsert하며, 실패 페이지 수를 SyncStats/로그에 반영하는지 검증.
- [ ] **Step 2: 구현**
  - 페이지 루프 내 `fetchEvChargerPage` 호출을 try/catch로 감싸기. catch(=백오프 재시도 소진 후 영구실패): `console.error`로 페이지 로그 + `failedPages++` + `continue`(전체 throw 금지).
  - `failedPages`/`failedPageNos` 추적. 루프 종료 후: `failedPages===0` → status `success`; `0<failedPages<threshold`(예: totalPages의 20% 미만) → status `success`지만 errorMessage에 부분실패 페이지 기록(부분 성공); `failedPages≥threshold` 또는 첫 페이지 실패(totalCount 미확보) → status `failed`.
  - 첫 페이지(totalCount 파악용) 실패는 전체 진행 불가 → 기존처럼 실패 처리(단, 명확한 메시지).
  - `markDegradedResponse`류 기존 패턴 있으면 재사용.
- [ ] **Step 3: 테스트 통과** + `npx tsc --noEmit` clean
- [ ] **Step 4: 커밋** — `fix(ev-charger): 페이지 영구실패 skip-continue(부분성공 표기)`

### Task 3: 전체 검증 + PR

- [ ] **Step 1: 전체 테스트** — `npm run test` green, `npm run lint`, `tsc` 0
- [ ] **Step 2: PR 생성** — develop 대상. 본문: 증분 upsert(메모리·부분내구성)·skip-continue(부분성공)·상류 502/504 완화. 배포 후 ev-charger 재sync 시 SyncHistory success·newRecords/updatedRecords>0·실패페이지 로그 확인.

## Self-Review 체크

- allItems 전역 누적이 제거됐는가(페이지 처리 후 참조 해제). 페이지별 upsert가 sourceId 키로 되는가(전역 dedup 상실이 upsert로 커버되는가). 종료조건이 skip에도 안전한가(totalPages 기반). 페이지 영구실패가 전체 throw를 안 일으키는가. 첫 페이지 실패는 여전히 failed인가. 상태 판정(success/부분/failed) 임계가 합리적인가. transform·fetch 백오프·타 카테고리 불변인가.

## 리스크

- **전역 dedup 상실** → 페이지 경계 넘는 중복 statId-chgerId는 upsert가 덮음(정상). 페이지 내 dedup만으로 배치 내 중복 unique 위반 방지.
- **부분 성공의 의미** → 일부 페이지 누락 시 그 지역 충전소가 이번 run에 미갱신. 다음 run이 재시도(idempotent upsert). 로그로 가시화.
- **상류 완전 장애** → 여전히 대부분 실패 가능(코드로 못 고침). 단 부분성공으로 얻은 페이지는 영속·다음 run 이어감.
- ev-charger는 delYn(폐기) 필드 있음 — 증분 upsert가 삭제 반영을 바꾸지 않음(기존도 upsert-only, deleteMany 없음). 범위 밖.
