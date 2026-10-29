# 건축물대장 수집·연결·표시 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 건축HUB 전국 대용량 파일(표제부·총괄표제부·전유공용면적)을 스트리밍으로 수집해, K-apt 단지 정보가 없는 아파트·빌라·오피스텔 상세에 "단지/건물 정보" 섹션·요약 줄·description·JSON-LD 를 붙인다.

**Architecture:** 백엔드는 `hubFileSource`(목록·다운로드) → `zipLineReader`(스트리밍 줄 읽기) → `buildingRegisterParser`(줄 → 행) → `buildingRegisterSync`(저장·교체·오피스텔 호수 집계) 로 수집하고, 상세 개요에서 `findBuildingRegister`(지번 키 → 건물명 필터 → 요약) 를 `complex` 가 null 일 때만 부른다. 프런트는 K-apt 단지 정보와 같은 자리에 새 섹션을 놓고, 기존 meta·JSON-LD 입력에 대장 값을 넘긴다.

**Tech Stack:** Express 5 + TypeScript(ESM, `.js` import), Prisma/MySQL 8, Vitest, Nuxt 3. 새 의존성 `yauzl`(+`@types/yauzl`) 1개.

**Spec:** `docs/superpowers/specs/2026-10-29-building-register-design.md`

## Global Constraints

- Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). 의존성 추가는 package-lock 유지한 채 `npm install yauzl @types/yauzl` (lock 삭제 금지).
- 업무코드는 반드시 `03`(건축물대장): 표제부 `0303`, 총괄표제부 `0302`, 전유공용면적 `0306`. `04`(폐쇄말소대장) 금지.
- 파일 형식: zip 안 txt 1개, UTF-8, 구분자 `|`, 머리글 없음. 열 번호는 스펙 §4.2(1부터).
- zip 은 디스크에 받고 처리 후 항상 삭제. 엔트리를 통째로 메모리에 올리는 방식(`adm-zip` 등) 금지. 운영 실행은 `node --max-old-space-size=512`.
- DB 쓰기 500행 배치. 교체: 새 `sourceMonth` 로 다 쓴 뒤 성공 시에만 이전 월 행 삭제(시군구 단위로 나눠 삭제).
- 운영 DB 에 전국 일괄 GROUP BY·정렬 금지 — 시군구 단위 인덱스 조회.
- 매칭이 애매하면 null(표시 안 함). 대장 조회 실패는 상세에 영향 없음(try/catch → null).
- `complex`(K-apt)가 있으면 대장 조회 자체를 하지 않는다.
- 표시 숫자 형식: "216세대", "오피스텔 471호", "1994년 11월 (33년차)", "세대당 0.95대". 축약 금지.
- 표제부·총괄표제부는 저장 행의 원본 열 전부를 `raw` JSON(레이아웃 열 이름 키)으로 저장.
- 광고(AdBanner) 개수·위치 변경 금지. 커밋 메시지 한국어. `docs/` 는 `git add -f`.

## Review Focus

1. 표제부 줄 끝에 `|` 가 하나 더 붙어 열 수가 레이아웃+1 로 오는 경우 → 정상 행으로 읽어야 한다(오류 비율에 넣지 않음). Task 3 테스트로 고정.
2. 같은 관리PK 가 파일에 두 번 나오는 경우 → 뒤 행으로 덮어쓰고 오류로 세지 않는다. Task 5 테스트로 고정.
3. 상세 동 이름이 "수성동4가"·"오송읍 서평리"·"서평리" 처럼 대장 동 이름과 토큰 수가 다를 때 → 전체 일치 먼저, 없으면 마지막 토큰. Task 6 테스트로 고정.
4. 지번에 표제부가 있는데 주거 행이 0개(근생 건물 등) → null, 빈 섹션 아님. Task 6 테스트로 고정.
5. 오피스텔 호수 집계가 아직 없는 지번(3개월 주기 사이 신축) → `offitelUnitCount` null 이고 표제부 호수로 대체하지 않으며, 다른 값(층·승인일)은 보여 준다. Task 6 테스트로 고정.

---

## File Structure

Backend (`backend/`)
- `prisma/schema.prisma`, `prisma/migrations/202610300001_building_register/migration.sql` — 5개 모델
- `src/services/hubFileSource.ts` — 건축HUB 목록 파싱·세션·목적기록·다운로드(디스크)
- `src/lib/zipLineReader.ts` — zip 첫 엔트리를 줄 단위 async iterator 로
- `src/services/buildingRegisterParser.ts` — 열 레이아웃·줄 파서·저장 필터·동 이름 추출·오피스텔 판정
- `src/services/buildingRegisterUnitCounter.ts` — 대상 지번 오피스텔 호실 집계
- `src/services/buildingRegisterSync.ts` — 수집 오케스트레이션(runSync)
- `src/scripts/syncBuildingRegister.ts`, `package.json` script `sync:building-register`
- `src/services/buildingRegisterMatcher.ts` — 상세 → 대장 연결·요약
- `src/types/housingRedesign.ts`, `src/services/realEstateDetailService.ts` — 개요 필드
- `scripts/ops/sync-building-register.sh`, `backend/SYNC.md`

Frontend (`frontend/`)
- `types/housingRedesign.ts` — `BuildingRegisterInfo`
- `utils/buildingRegister.ts` — 요약 줄·표 행·섹션 제목
- `components/realEstate/BuildingRegisterSection.vue`
- `pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`, `composables/useRealEstateDetailMeta.ts`, `composables/useStructuredData.ts`

---

### Task 1: 스키마·마이그레이션

**Files:**
- Modify: `backend/prisma/schema.prisma` (KaptSourceFile 모델 근처에 추가)
- Create: `backend/prisma/migrations/202610300001_building_register/migration.sql`

**Interfaces:**
- Produces (Prisma 모델·테이블 이름):
  - `BuildingRegisterTitle` — `mgmPk String @id @db.VarChar(33)`, `sggCode Char(5)`, `bjdongCode Char(5)`, `platGbCd Char(1)`, `bun Char(4)`, `ji Char(4)`, `bldNm String?`, `dongNm String?`, `regstrGbCd Char(1)`, `regstrKindCd Char(1)`, `mainAtchGbCd Char(1)`, `mainPurpsCd String?`, `mainPurpsCdNm String?`, `etcPurps String? @db.VarChar(500)`, `hhldCnt Int?`, `fmlyCnt Int?`, `hoCnt Int?`, `grndFlrCnt Int?`, `ugrndFlrCnt Int?`, `elevatorCnt Int?`, `parkingCnt Int?`(4종 합), `useAprDay String? @db.Char(8)`, `strctCdNm String?`, `sourceMonth Char(7)`(`YYYY-MM`, 파일 제목의 대상 월), `raw Json`; `@@index([sggCode, bjdongCode, platGbCd, bun, ji])`, `@@index([sourceMonth])`
  - `BuildingRegisterRecap` — 같은 지번 키 + `mgmPk @id`, `bldNm`, `mainPurpsCdNm`, `hhldCnt`, `fmlyCnt`, `hoCnt`, `mainBldCnt Int?`, `totPkngCnt Int?`, `useAprDay`, `sourceMonth`, `raw Json`; 같은 인덱스 2개
  - `BuildingRegisterUnitCount` — `id autoincrement`, 지번 키 5개, `bldNm String @db.VarChar(200)`(빈 이름은 ''), `dongNm String @db.VarChar(100)`(없으면 ''), `offitelUnits Int`, `totalUnits Int`, `sourceMonth`; `@@unique([sggCode, bjdongCode, platGbCd, bun, ji, bldNm, dongNm, sourceMonth])`
  - `BuildingRegisterDong` — `sggCode`, `bjdongCode`, `dongName String @db.VarChar(50)`; `@@id([sggCode, dongName, bjdongCode])`
  - `BuildingRegisterSourceFile` — `taskCode String @id @db.VarChar(4)`('0303'|'0302'|'0306'), `sourceMonth Char(7)`, `fileId String`, `rowCount Int`, `skippedCount Int`, `syncedAt DateTime @updatedAt`

- [ ] **Step 1:** 모델 추가 후 `cd backend && npx prisma validate` → "The schema ... is valid". `prisma format` 이 다른 모델을 바꾸면 그 변경은 버린다.
- [ ] **Step 2:** `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` 로 SQL 생성(로컬 DB 필요 시 `--shadow-database-url`), 새 테이블 5개 CREATE 만 있는지 확인 후 migration.sql 저장.
- [ ] **Step 3:** 로컬 적용 `npx prisma migrate deploy && npx prisma migrate status` → "Database schema is up to date". `npm run db:generate`.
- [ ] **Step 4:** Commit `feat(building-register): 건축물대장 테이블 5종 마이그레이션`

### Task 2: 건축HUB 목록·다운로드 (`hubFileSource.ts`)

**Files:**
- Create: `backend/src/services/hubFileSource.ts`
- Test: `backend/__tests__/services/hubFileSource.test.ts`

**Interfaces:**
- Produces:
  - `type HubTaskCode = '0303' | '0302' | '0306'`
  - `interface HubFileEntry { taskSe: string; taskCode: string; title: string; sourceMonth: string /* 'YYYY-MM' from "(2026년 09월)" */; fileId: string }`
  - `parseHubFileList(html: string): HubFileEntry[]`
  - `extractHubCsrf(html: string): string | null` — `<input type="hidden" name="_csrf" value="...">`
  - `openHubSession(fetchFn?): Promise<{ cookie: string; csrf: string; entries: HubFileEntry[] }>` — 목록 1~3쪽(`?pageIndex=N`)을 읽어 03 업무 행이 모두 나올 때까지
  - `findHubFile(entries, taskCode: HubTaskCode): HubFileEntry | null` — `taskSe === '03'` 인 것만
  - `downloadHubFile(session, entry, destPath: string, fetchFn?): Promise<{ bytes: number }>` — 목적 기록 POST(`/portal/opn/lps/idx-srvc-hstry-insert.do`, `opnLgcptTaskSeCd`, `opnTaskCd`, `opnPrcusePrpsCd=1`, 헤더 `X-CSRF-TOKEN`) 후 `POST /cmm/fms/fileOpnDown.do` (`srvrFileNm`, `_csrf`) 응답 body 를 `pipeline(Readable.fromWeb(body), createWriteStream(destPath))`. Content-Disposition 파일명이 `건축물대장_` 를 포함하지 않으면(폐쇄말소 등) 에러. 타임아웃 30분.
- 상수: `BASE='https://www.hub.go.kr'`, 목록 `/portal/opn/lps/idx-lgcpt-pvsn-srvc-list.do`, UA 는 `kaptFileSource.ts` 의 USER_AGENT 와 같은 값.

- [ ] **Step 1: 실패 테스트** — 픽스처 HTML(실제 목록에서 잘라 온 두 행 형태):
```ts
const ROW = (se: string, cd: string, title: string, id: string) =>
  `<button onclick="javascript:fnLgcptPop('${se}','${cd}','${title}','국토교통부/녹색건축과')">설명</button>` +
  `<button onclick="fnDownloadPop('${se}','${cd}','${id}')">전체 다운로드</button>`;
it('03 업무 행을 대상 월과 함께 읽는다', () => {
  const html = ROW('04','0403','표제부 (2026년 09월)','OPN1') + ROW('03','0303','표제부 (2026년 09월)','OPN2');
  expect(findHubFile(parseHubFileList(html), '0303')).toEqual({ taskSe: '03', taskCode: '0303', title: '표제부 (2026년 09월)', sourceMonth: '2026-09', fileId: 'OPN2' });
});
it('폐쇄말소(04)만 있으면 null', () => { /* ROW('04','0403',...) 만 → findHubFile(...,'0303') === null */ });
it('csrf 추출', () => expect(extractHubCsrf('<input type="hidden" name="_csrf" value="ab-12" />')).toBe('ab-12'));
it('다운로드 파일명이 건축물대장이 아니면 실패', async () => { /* fetch mock: 목적기록 200, 다운로드 200 + content-disposition filename=%EA%B5%AD..._%ED%8F%90%EC%87%84... → rejects /건축물대장/ */ });
it('다운로드는 디스크로 흘려 쓴다', async () => { /* body = ReadableStream('a|b\n') → 파일 내용 'a|b\n', bytes 4 */ });
```
- [ ] **Step 2:** `npx vitest run __tests__/services/hubFileSource.test.ts` → FAIL (모듈 없음)
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** Commit `feat(building-register): 건축HUB 대용량 목록·다운로드`

### Task 3: 스트리밍 zip 줄 읽기 + 줄 파서

**Files:**
- Create: `backend/src/lib/zipLineReader.ts`, `backend/src/services/buildingRegisterParser.ts`
- Test: `backend/__tests__/lib/zipLineReader.test.ts`, `backend/__tests__/services/buildingRegisterParser.test.ts`
- Modify: `backend/package.json`, `package-lock.json` (`yauzl`, `@types/yauzl`)

**Interfaces:**
- Produces:
  - `readZipLines(zipPath: string): AsyncGenerator<string>` — yauzl `open(path, { lazyEntries: true })`, 첫 파일 엔트리의 `openReadStream` 을 `readline.createInterface({ input, crlfDelay: Infinity })` 로. 끝줄 개행 없어도 나옴, `\r` 제거, 빈 줄 건너뜀.
  - `TITLE_COLUMNS: readonly string[]`(77), `RECAP_COLUMNS`(64), `UNIT_COLUMNS`(39) — 레이아웃 열 이름(스펙 §4.2 / 운영 레이아웃 XML 그대로, 예 `'관리_건축물대장_PK'`)
  - `splitRow(line: string, expected: number): string[] | null` — `|` 분리 후 길이가 `expected` 면 그대로, `expected+1` 이고 마지막이 '' 이면 마지막 제거, 그 외 null
  - `interface ParcelKey { sggCode: string; bjdongCode: string; platGbCd: string; bun: string; ji: string }`, `parcelKeyString(k: ParcelKey): string` (`'11650|10800|0|1337|0002'`)
  - `parseTitleRow(cols: string[], sourceMonth: string): TitleRow` (Prisma `BuildingRegisterTitle` create 입력과 같은 모양, 숫자 빈 값 → null, `raw` = 열이름→값)
  - `parseRecapRow(cols, sourceMonth): RecapRow`, `parseUnitRow(cols): UnitRow { key: ParcelKey; bldNm: string; dongNm: string; hoNm: string; isExclusive: boolean; isOffitel: boolean }`
  - `shouldKeepTitle(row: TitleRow): boolean` — `regstrGbCd === '2'` 또는 `mainPurpsCd` 가 `02000` 계열(앞 2자리 '02')
  - `isOffitelPurpose(mainNm: string | null, etc: string | null): boolean` — 둘 중 하나에 `오피스텔`
  - `dongNamesFromPlatPlc(platPlc: string): string[]` — 끝의 지번 토큰(`\d+(-\d+)?번지`, `산\s*\d+…`, `외 N필지` 포함) 앞 토큰을 보고 `[마지막 토큰]`, 마지막 토큰이 `리`로 끝나고 그 앞이 `읍|면`으로 끝나면 `['서평리', '오송읍 서평리']`

- [ ] **Step 1: 실패 테스트**
```ts
// zipLineReader: adm-zip(이미 devDep)로 테스트 zip 생성 — 'a|1\r\nb|2\n\nc|3' → ['a|1','b|2','c|3']
// 100,000줄 zip 을 읽어도 결과 길이 100000 (스트리밍 동작 확인)
const RECAP = '1050115|1|일반|1|총괄표제부|1|신대장|대구광역시 수성구 수성동4가 1125-14번지|대구광역시 수성구 들안로77길 27 (수성동4가)||27260|10600|0|1125|0014||||0|272604238182|10602|0|27|0|0|78.73|0|202.1|202.1|0|01000|단독주택|주택, 소매점|0|3|2|1|1|0|0|0|0|0|0|0|0|0|||||||||0||0|0||0||0|20221126';
it('총괄 실제 행 64열', () => {
  const r = parseRecapRow(splitRow(RECAP, 64)!, '2026-09');
  expect(r).toMatchObject({ mgmPk: '1050115', sggCode: '27260', bjdongCode: '10600', platGbCd: '0', bun: '1125', ji: '0014', mainPurpsCdNm: '단독주택', hhldCnt: 0, fmlyCnt: 3, mainBldCnt: 2, sourceMonth: '2026-09' });
  expect(r.raw['대지_위치']).toBe('대구광역시 수성구 수성동4가 1125-14번지');
});
it('끝에 | 가 하나 더 있으면 정상', () => expect(splitRow(RECAP + '|', 64)).toHaveLength(64));
it('열 수가 다르면 null', () => expect(splitRow('a|b', 64)).toBeNull());
it('동 이름', () => {
  expect(dongNamesFromPlatPlc('대구광역시 수성구 수성동4가 1125-14번지')).toEqual(['수성동4가']);
  expect(dongNamesFromPlatPlc('충청북도 청주시 흥덕구 오송읍 서평리 123번지')).toEqual(['서평리', '오송읍 서평리']);
  expect(dongNamesFromPlatPlc('경기도 성남시 분당구 야탑동 산 12-3번지')).toEqual(['야탑동']);
  expect(dongNamesFromPlatPlc('서울특별시 서초구 서초동 1337-2번지 외 1필지')).toEqual(['서초동']);
});
it('저장 필터', () => {
  expect(shouldKeepTitle({ regstrGbCd: '2', mainPurpsCd: '14000' } as TitleRow)).toBe(true);
  expect(shouldKeepTitle({ regstrGbCd: '1', mainPurpsCd: '02003' } as TitleRow)).toBe(true);
  expect(shouldKeepTitle({ regstrGbCd: '1', mainPurpsCd: '01000' } as TitleRow)).toBe(false);
});
it('오피스텔 판정', () => {
  expect(isOffitelPurpose('오피스텔', '오피스텔(업무시설)')).toBe(true);
  expect(isOffitelPurpose('업무시설', '업무시설(오피스텔)')).toBe(true);
  expect(isOffitelPurpose('소매점', '제1종근린생활시설(소매점)')).toBe(false);
});
// 표제부: 77열 픽스처 1줄(대장구분 2, 세대수 32, 지상 4, 승용 0+비상용 0, 주차 4종 1/2/3/4) → parkingCnt 10, elevatorCnt 0
```
- [ ] **Step 2:** `npx vitest run __tests__/lib/zipLineReader.test.ts __tests__/services/buildingRegisterParser.test.ts` → FAIL
- [ ] **Step 3:** `npm install yauzl @types/yauzl` (Node 20, lock 유지) 후 구현
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** Commit `feat(building-register): 스트리밍 zip 줄 읽기와 대장 줄 파서`

### Task 4: 오피스텔 호수 집계

**Files:**
- Create: `backend/src/services/buildingRegisterUnitCounter.ts`
- Test: `backend/__tests__/services/buildingRegisterUnitCounter.test.ts`

**Interfaces:**
- Consumes: `UnitRow`, `ParcelKey`, `parcelKeyString` (Task 3)
- Produces: `class OffitelUnitCounter { constructor(targets: Set<string>); add(row: UnitRow): void; results(sourceMonth: string): UnitCountRow[] }` — `UnitCountRow` = `BuildingRegisterUnitCount` create 입력(id 제외). 대상이 아니거나 공용(`isExclusive=false`) 행은 무시. 호실 = `(dongNm, hoNm)` 중복 제거, 한 호실에 오피스텔 행이 하나라도 있으면 오피스텔. 그룹 = (지번 키, bldNm, dongNm).

- [ ] **Step 1: 실패 테스트** — 아크로텔 축소판: 지번 `11650|10800|0|1337|0002`, 오피스텔 호실 471개(각 전유 2행씩), 소매점 67, 학원 2, 공용 행 100개, 대상 아닌 지번 행 50개 →
```ts
expect(counter.results('2026-09')).toEqual([{ sggCode: '11650', bjdongCode: '10800', platGbCd: '0', bun: '1337', ji: '0002', bldNm: '아크로텔 강남역', dongNm: '', offitelUnits: 471, totalUnits: 540, sourceMonth: '2026-09' }]);
```
  그리고 "같은 호실에 소매점 행 + 오피스텔 행 → 오피스텔 1호" 케이스.
- [ ] **Step 2:** `npx vitest run __tests__/services/buildingRegisterUnitCounter.test.ts` → FAIL
- [ ] **Step 3:** 구현 (Map<groupKey, Map<unitKey, boolean>>)
- [ ] **Step 4:** PASS
- [ ] **Step 5:** Commit `feat(building-register): 전유공용면적 오피스텔 호실 집계`

### Task 5: 수집 오케스트레이션 + 스크립트 + 운영 스크립트

**Files:**
- Create: `backend/src/services/buildingRegisterSync.ts`, `backend/src/scripts/syncBuildingRegister.ts`, `scripts/ops/sync-building-register.sh`
- Modify: `backend/package.json` (`"sync:building-register": "tsx src/scripts/syncBuildingRegister.ts"`), `backend/SYNC.md`
- Test: `backend/__tests__/services/buildingRegisterSync.test.ts`

**Interfaces:**
- Consumes: Task 2·3·4 전부
- Produces:
  - `interface BuildingRegisterSyncOptions { force?: boolean; forceUnits?: boolean; workDir?: string; fetchFn?: typeof fetch; now?: Date }`
  - `interface DatasetResult { taskCode: HubTaskCode; status: 'updated' | 'unchanged' | 'not-due'; sourceMonth: string | null; rows: number; skipped: number }`
  - `syncBuildingRegister(options?): Promise<{ results: DatasetResult[]; maxRssMb: number }>` — `runSync('building-register', …)` 안에서:
    1. `openHubSession` → 0302·0303 각각: 저장된 `BuildingRegisterSourceFile.sourceMonth` 와 같으면 `unchanged`(force 면 진행)
    2. 다운로드(`workDir`, 기본 `os.tmpdir()/building-register`) → `readZipLines` → `splitRow` → 파싱 → 표제부는 `shouldKeepTitle` 통과만 → 500행 배치 `batchUpsertRaw`(uniqueKey `mgmPk`, 같은 배치 안 중복 PK 는 뒤 행만). 표제부에서 `dongNamesFromPlatPlc(raw['대지_위치'])` 로 `BuildingRegisterDong` 행 모음(Set 으로 중복 제거 후 배치 upsert).
    3. 건너뛴 줄 비율 > 1% → throw(교체 안 함)
    4. 성공 시 이전 `sourceMonth` 행 삭제: 저장된 시군구 목록(`SELECT DISTINCT sggCode … WHERE sourceMonth = ?` — sourceMonth 인덱스) 별로 `DELETE … WHERE sggCode=? AND sourceMonth<>?`
    5. 0306: 저장된 sourceMonth 가 없거나, 새 sourceMonth 가 저장값보다 3개월 이상 뒤일 때(`monthDiff(new, saved) >= 3`)만, 아니면 `not-due`. 대상 지번 = 표제부 테이블에서 시군구별로 `mainPurpsCdNm LIKE '%오피스텔%' OR etcPurps LIKE '%오피스텔%'` 지번 키 → Set. 줄마다 `OffitelUnitCounter.add` → 결과 저장 → 이전 월 삭제(4와 같은 방식).
    6. 각 데이터셋 끝에 `BuildingRegisterSourceFile` upsert, zip 삭제(`finally`).
    7. `maxRssMb = process.resourceUsage().maxRSS / 1024` 를 결과와 로그에 남김.
  - `monthDiff(a: string, b: string): number` ('YYYY-MM')
- 스크립트: `syncKapt.ts` 와 같은 모양, 인자 `--force`, `--force-units`. 출력 `[building-register] 0303: updated (2026-09, N행, 건너뜀 M) · 최대 메모리 X MB`.
- 운영 스크립트: `sync-real-estate.sh` 1~50행의 경로·env·배포잠금 패턴을 따른다. 같은 `$RUN_DIR/real-estate-sync.lock` 을 `flock -n` 으로 잡고 못 잡으면 `[skip] 부동산 동기화 실행 중` 출력 후 exit 0. 실행: `timeout --kill-after=30s 3h node --max-old-space-size=512 --env-file "$BACKEND_ENV_FILE" "$ACTIVE_BACKEND_DIR/dist/scripts/syncBuildingRegister.js"`. 헤더 주석에 cron 예: `30 6 * * * /home/project2/scripts/ops/sync-building-register.sh >> …/building-register.log 2>&1` (cron 등록은 이 PR 에서 하지 않음 — 배포 단계).
- SYNC.md: 데이터 출처·주기(매일 확인, 표제부·총괄 매월, 전유공용면적 3개월)·수동 실행·메모리 상한 한 절.

- [ ] **Step 1: 실패 테스트** (prisma·hubFileSource·zipLineReader 를 `vi.mock`; `kaptSyncService.test.ts` 와 같은 방식)
  - `저장 월과 같으면 다운로드하지 않는다` → 0303·0302 `unchanged`, `downloadHubFile` 미호출
  - `새 월이면 저장 후 이전 월을 시군구별로 지운다` → 삭제 쿼리가 sggCode 별로 호출, SourceFile upsert `{ taskCode: '0303', sourceMonth: '2026-09', rowCount, skippedCount }`
  - `같은 PK 가 두 번 나오면 뒤 행으로 저장하고 오류로 세지 않는다` (Review Focus 2)
  - `건너뛴 줄이 1% 를 넘으면 실패하고 이전 행을 지우지 않는다` → rejects, 삭제 미호출
  - `전유공용면적은 3개월 지나야 받는다` → 저장 '2026-07', 새 '2026-09' → `not-due`; 저장 '2026-06' → `updated`; 저장 없음 → `updated`
  - `실패해도 zip 을 지운다`
  - `monthDiff('2026-09','2026-06') === 3`, `monthDiff('2027-01','2026-11') === 2`
- [ ] **Step 2:** `npx vitest run __tests__/services/buildingRegisterSync.test.ts` → FAIL
- [ ] **Step 3:** 구현 + 스크립트 + 운영 스크립트(`bash -n scripts/ops/sync-building-register.sh` 통과) + SYNC.md
- [ ] **Step 4:** PASS, `npm run build` 통과
- [ ] **Step 5: 로컬 실데이터 수집** — `npm run sync:building-register -- --force --force-units` (로컬 MySQL). 기록: 데이터셋별 행 수·건너뜀·소요 시간·최대 메모리. 최대 메모리가 512MB 를 넘으면 원인부터 고친다(Global Constraints). 결과를 ledger 와 PR 설명에 남긴다.
- [ ] **Step 6:** Commit `feat(building-register): 월간 수집·교체·운영 스크립트`

### Task 6: 상세 → 대장 연결 (`buildingRegisterMatcher.ts`)

**Files:**
- Create: `backend/src/services/buildingRegisterMatcher.ts`
- Modify: `backend/src/types/housingRedesign.ts` (`BuildingRegisterInfo` — 스펙 §8 그대로)
- Test: `backend/__tests__/services/buildingRegisterMatcher.test.ts`

**Interfaces:**
- Consumes: `parseParcel`, `normalizeComplexName`, `isNameMatch`, `formatApprovalDate` (`kaptComplexMatcher.ts`), `isOffitelPurpose`, `ParcelKey` (Task 3)
- Produces:
  - `interface RegisterMatchInput { kind: 'residential' | 'offitel'; sggCode: string; primaryAddress: { dongName: string; jibun: string | null } | null; addresses: Array<{ dongName: string; jibun: string | null }>; buildingName: string }`
  - `findBuildingRegister(input): Promise<BuildingRegisterInfo | null>` — 순서: primaryAddress → 실패/0건이면 addresses 각각; 서로 다른 결과(지번 키가 다름)를 가리키면 null.
  - `resolveBjdongCode(sggCode, dongName): Promise<string | null>` — `BuildingRegisterDong` 에서 전체 이름 일치 → 없으면 마지막 토큰; 코드 1개일 때만
  - `selectRegisterRows(kind, titles, units, buildingName): { titles; units } | null` (순수) — 스펙 §6.2·6.3
  - `summarizeRegister(kind, picked, recap | null, sourceMonth, unitSourceMonth): BuildingRegisterInfo | null` (순수) — 스펙 §7. 결과에 표시할 값이 하나도 없으면 null.

- [ ] **Step 1: 실패 테스트**
  - 순수 `selectRegisterRows`:
    - 야탑동 177: 9개 동 "대원빌라3단지"(세대 32,16,24,40,16,16,24,16,32) + 경비실·지하주차장(세대 0, 주용도 공동주택) + 근린상가동, 상세 이름 "목련마을자영빌라" → 9개 동 채택
    - 이름 2종류("탑마을(경향)" 5동, "탑마을(선경)" 4동), 상세 "탑마을(경향)" → 5동만; 상세 "탑마을" → null(포함 매칭이 2종류)
    - 주거 행 0개(근생만) → null (Review Focus 4)
    - residential 인데 오피스텔 행만 → null; 빌라 상세에 세대>0 행 + 오피스텔(주거용) 행 → 세대>0 행만
  - 순수 `summarizeRegister`:
    - 야탑동 177 → `{ kind: 'residential', householdCount: 216, dongCount: 9, topFloor: 4, basementFloors: <픽스처 값>, useApprovalDate: '1994-11-…', purposes: ['연립주택'], … }`
    - 동 1개 → `dongCount: 1`
    - 총괄 1개 + 이름 1종류 → 세대수·주차는 총괄 값; 이름 필터가 걸린 경우 총괄 무시
    - offitel + 집계 471 → `offitelUnitCount: 471`, `unitSourceMonth: '2026-09'`; 집계 없음 → `offitelUnitCount: null` 이고 `topFloor` 등은 그대로 (Review Focus 5)
    - 승강기 0 → `elevatorCount: 0`(null 아님)
  - DB 경로(`prisma.$queryRaw` mock): `resolveBjdongCode` — '수성동4가' 전체 일치, '오송읍 서평리' → 전체 없으면 '서평리', 코드 2개면 null (Review Focus 3); `findBuildingRegister` — 지번 파싱 실패(`가-240`)면 null, 주소 후보 둘이 다른 지번 결과면 null.
- [ ] **Step 2:** `npx vitest run __tests__/services/buildingRegisterMatcher.test.ts` → FAIL
- [ ] **Step 3:** 구현 — 지번 조회는 `(sggCode, bjdongCode, platGbCd, bun, ji)` 인덱스로 표제부·총괄·호수 3쿼리를 `Promise.all`, 최신 `sourceMonth` 행만(`BuildingRegisterSourceFile` 값 사용).
- [ ] **Step 4:** PASS
- [ ] **Step 5:** Commit `feat(building-register): 상세-건축물대장 연결과 요약`

### Task 7: 상세 개요에 연결

**Files:**
- Modify: `backend/src/services/realEstateDetailService.ts` (`getDetailOverview` 반환에 `buildingRegister`), `backend/src/types/housingRedesign.ts` (`DetailOverview.buildingRegister: BuildingRegisterInfo | null`)
- Test: `backend/__tests__/services/realEstateDetailOverview.test.ts`

**Interfaces:**
- Consumes: `findBuildingRegister` (Task 6)
- Produces: `DetailOverview.buildingRegister`. `complex` 가 null 일 때만 `findDetailBuildingRegister(type, identity, building, addresses)` 호출 — kind 는 `isOffitelType(type) ? 'offitel' : 'residential'`. try/catch → `console.warn('[realEstateDetail] 건축물대장 조회 실패', …)` 후 null.

- [ ] **Step 1: 실패 테스트**
  - `K-apt 단지가 있으면 대장을 조회하지 않는다` (apt-sale, findKaptComplex → 단지) → `findBuildingRegister` 미호출, `buildingRegister: null`
  - `K-apt 가 없으면 대장 값을 싣는다` (villa-sale) → 호출 인자 `kind: 'residential'`
  - `오피스텔은 offitel 로 조회한다`
  - `대장 조회가 실패해도 개요는 나온다` → reject → `buildingRegister: null`, 개요 정상
- [ ] **Step 2:** `npx vitest run __tests__/services/realEstateDetailOverview.test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 백엔드 전체 `npm run test && npm run lint && npm run build` → 모두 통과
- [ ] **Step 5:** Commit `feat(building-register): 상세 개요에 건축물대장 정보 추가`

### Task 8: 프런트 표시 유틸·섹션 컴포넌트

**Files:**
- Modify: `frontend/types/housingRedesign.ts` (`BuildingRegisterInfo`, `DetailOverview.buildingRegister?: BuildingRegisterInfo | null`)
- Create: `frontend/utils/buildingRegister.ts`, `frontend/components/realEstate/BuildingRegisterSection.vue`
- Test: `frontend/tests/utils/buildingRegister.test.ts`, `frontend/tests/components/realEstate/BuildingRegisterSection.test.ts`

**Interfaces:**
- Produces:
  - `registerSectionTitle(r): '단지 정보' | '건물 정보'` — `dongCount >= 2` 이면 단지
  - `registerUnitsText(r): string | null` — residential `"216세대"`, offitel `"오피스텔 471호"`
  - `buildRegisterFactsLine(r): string` — `216세대 · 9개 동 · 최고 4층 · 1994년 사용승인` (동수 1이면 동 항목 생략, 값 없는 항목 생략)
  - `buildRegisterInfoRows(r, today: Date): Array<{ label; value }>` — 스펙 §9 표: `세대수 · 동수`(동 1이면 라벨 "세대수"/"호수"), `층수`("최고 4층 · 지하 1층", 지하 0 → "지하 없음"), `사용승인`(`complexInfo.ts` 의 연차 형식 재사용), `주차`("206면 · 세대당 0.95대", offitel 은 "호당"), `승강기`(0 → "없음", n → "n대"), `용도 · 구조`
  - `registerApprovalYear(r): number | null`
  - 섹션 props: `register: BuildingRegisterInfo`. 부제 `건축물대장 · 2026년 9월 기준`(sourceMonth null 이면 "건축물대장"). 출처 문구는 스펙 §9 그대로(offitel 은 `오피스텔 호수는 호별 용도 기준(상가 제외), 2026년 9월 기준` 추가). 레이아웃은 `ComplexInfoSection.vue` 의 표 부분과 같은 마크업·클래스.
- [ ] **Step 1: 실패 테스트** — 야탑동 177 값으로 `buildRegisterFactsLine` = `'216세대 · 9개 동 · 최고 4층 · 1994년 사용승인'`; offitel 1동 → `'오피스텔 471호 · 최고 20층 · 2016년 사용승인'`; 행 표(승강기 0 → '없음', 세대당 0.95대, 지하 0 → '지하 없음', 값 없는 줄 없음); `registerSectionTitle` 1동/9동; 컴포넌트: 제목·부제·행 수·오피스텔 출처 문구 렌더. 컴포넌트 테스트는 `ref`/`computed` 명시 import 규칙(직접 mount).
- [ ] **Step 2:** `cd frontend && npx vitest run tests/utils/buildingRegister.test.ts tests/components/realEstate/BuildingRegisterSection.test.ts` → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** PASS
- [ ] **Step 5:** Commit `feat(building-register): 건물 정보 섹션과 표시 유틸`

### Task 9: 상세 페이지·SEO 연결

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`, `frontend/composables/useRealEstateDetailMeta.ts`, `frontend/composables/useStructuredData.ts`
- Test: `frontend/tests/composables/useRealEstateDetailMeta.test.ts`, `frontend/tests/composables/useStructuredData.test.ts`

**Interfaces:**
- Consumes: Task 8 유틸
- Produces:
  - 페이지: `buildingRegister = computed(() => complexInfo.value ? null : detailOverview.value?.buildingRegister ?? null)`. 헤더 요약 줄 분기에 `v-else-if="buildingRegister && registerFactsLine"` 추가(링크 `#complex-info`, 텍스트 `registerSectionTitle + ' ›'`). 바로가기 메뉴 같은 자리. 섹션은 `ComplexInfoSection` 바로 아래 `v-else-if` 로 같은 `id="complex-info"`·같은 order 클래스. 광고 위치 불변.
  - meta 입력 `complex` 를 `{ householdCount: number | null; useApprovalYear: number | null; unitsText?: string | null }` 로 확장: `unitsText` 가 있으면 세대수 대신 그 문구(예 `오피스텔 471호`). 대장일 때 `{ householdCount: residential ? r.householdCount : null, useApprovalYear: registerApprovalYear(r), unitsText: registerUnitsText(r) }`.
  - JSON-LD `complex` 옵션에 `offitelUnitCount?: number | null` 추가 → PropertyValue `offitelUnitCount`. 대장일 때 `{ householdCount, offitelUnitCount, dongCount, topFloor, useApprovalDate, totalParking }` 를 넘긴다(`numberOfAccommodationUnits` 는 기존 규칙대로 householdCount 만).
- [ ] **Step 1: 실패 테스트** — description: 대장 residential → 사실 절 `216세대, 전용 57㎡, 1994년 사용승인.`; offitel → `오피스텔 471호, …`; JSON-LD: offitel → additionalProperty 에 `offitelUnitCount` 471, `numberOfAccommodationUnits` 없음.
- [ ] **Step 2:** 해당 테스트 실행 → FAIL
- [ ] **Step 3:** 구현
- [ ] **Step 4:** 프런트 전체 `npm run test && npm run lint` 통과, `npx nuxi prepare` 후 타입 오류 없음 (dev 서버가 떠 있으면 `npm run build` 금지 — 대신 CI 에 맡김)
- [ ] **Step 5: 로컬 확인** — 로컬 백엔드(Task 5 로컬 수집 데이터) + 프런트 dev 로 서초동아(apt-sale, K-apt 없음), 목련마을자영빌라(K-apt 있음 → 대장 섹션 없음), 아크로텔 강남역(offitel, 471호) SSR HTML 에 섹션·description·JSON-LD 확인.
- [ ] **Step 6:** Commit `feat(building-register): 상세 페이지에 건물 정보 연결`

---

## 배포 (계획 실행 후, 단계마다 사용자 확인)

1. develop PR → CI → 머지.
2. 운영 백업 → 마이그레이션 `202610300001_building_register` 적용 → `migrate status` up to date.
3. main 승격 → 배포.
4. 운영 수동 수집 1회(`--force --force-units`) — 진행·최대 메모리 감시, 행 수 기록.
5. cron 등록(06:30 KST).
6. 운영 측정(읽기 전용, 동시 4 이하): 유형별 연결률, 상세 개요 응답 시간, SSR HTML 3종, SEO 카나리.
