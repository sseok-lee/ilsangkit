# 전남광주통합특별시 Region 정규화 구현 플랜 (v2 — 워크플로우 리뷰 34건 반영)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 광주/전남 이중저장(옛 city '광주'·'전남'+bjdCode 29/46 vs 신 '전남광주통합특별시'+12)을 정부 개편에 맞춰 `전남광주통합특별시`+`12xxx`로 전면 정규화하고, URL slug를 `jeonnamgwangju` 단일(flat 27 시군구)로 이관한다.

**Architecture:** expand-migrate-contract. **Phase A(Expand)**=신 slug·읽기맵·URL판정·301로직(플래그OFF)·sync-side 재드리프트 방지를 **전부** 배포(데이터·301 무변). **Phase B(Migrate)**=프로덕션 데이터 정규화(PK 청크 + sourceId 재코딩) → refreshSummary/summary 명시 DELETE → **말미에 301 선활성**. **Phase C(Contract)**=레거시 gwangju/jeonnam 코드·테스트 제거 + 사이트맵 재제출 + 재색인. 각 Phase = 1 PR(develop).

**Tech Stack:** Backend Express5/TS(ESM)/Prisma/MySQL8, Frontend Nuxt3, vitest. 운영 DB 직접 SQL(PK 기반 청크 UPDATE).

**Spec:** `docs/superpowers/specs/2026-07-20-realestate-region-normalization-design.md` (재검증 2026-07-21).

## Global Constraints

- **Node 20**. package-lock **재생성 금지**(`nvm use 20 && npm install`만). ESM 로컬 import는 `.js` 필수.
- **PR→develop, self-merge 금지, main 직접 커밋 금지.** Phase별 CI green 후 머지. main 승격은 develop→main PR.
- **정규화 목표값**: `city='전남광주통합특별시'`, `bjdCode` 접두 `12`(bjdCode 컬럼 있는 테이블), slug=`jeonnamgwangju`.
- **UX = Flat 단일**. 서브그룹핑 없음.
- **경기도 광주시(bjdCode 41·city 경기/경기도, district 광주시)는 절대 미변경.** normalizeRegionName은 city='광주'(광주광역시 단축)만 매핑, '광주시'는 district∈광주5구일 때만.
- **city 정규화 = 이름 통일. 행 dedup(옛명 행+신명 행 공존)은 범위 밖** — **단, D2 sourceId 재코딩 시 발생하는 unique 충돌 dedup은 이 스펙 범위(거래 정합성)**.
- **slug/맵 동기화 = 5곳 동시 갱신 필수**(누락이 리뷰 최상위 결함 S1의 근원):
  1. `backend/src/services/cityMapping.ts` — `CITY_SLUG_TO_FULL`/`CITY_SLUG_TO_SHORT`(**가드/역맵 소스**), `resolveCitySlug`, `buildRegionFilter`, `cityVariantList`
  2. `backend/src/lib/regionSlugs.ts` — `CITY_FULL_NAME_TO_SLUG`, `toCitySlug`
  3. `backend/src/lib/realEstateUrl.ts` — `toCitySlugByDistrict`
  4. `frontend/shared/regionSlugs.ts` — `CITY_SLUGS`(→`CITY_SLUG_MAP`), `REGIONS`(**flat 27 시군구**)
  5. `frontend/utils/realEstateUrl.ts` — `toCitySlugByDistrict`(미러)
- **운영 DB = PK id 목록 기반 청크 UPDATE**(비-sargable `LEFT(bjdCode,2)` 풀스캔 금지, [[project_realestate_date_filter_sargable]] 함정). **`max_execution_time`은 UPDATE에 무효** → 작은 오토커밋 배치 + 짧은 `innodb_lock_wait_timeout` + 배치 간 sleep + `SHOW PROCESSLIST` 모니터. 백업 테이블 선행.
- 27 시군구 이름 충돌 없음(광주 동/서/남/북/광산 vs 전남 22시군).

## 대상 테이블 (2026-07-21 실측)

**bjdCode 있음(12xxx 재코딩 대상) — 22테이블**: AptSaleTransaction, AptRentTransaction, VillaSaleTransaction, VillaRentTransaction, LandSaleTransaction, **OffitelSaleTransaction, OffitelRentTransaction**(D1: bjdCode 컬럼 존재·29/46 저장됨, schema:1167/1356), Aed, Childcare, Clothes, EvCharger, Hospital, Library, Market, Park, Parking, Pharmacy, School, Sports, Toilet, Wifi, AuctionItem(**하이브리드**: 빈-bjdCode 스냅샷 ~145행은 city만), Region.
**bjdCode 없음(city명만)**: SubwayStation, WasteSchedule.
**파생(refreshSummary + 명시 DELETE 필요 — S3: refresh만으론 옛코드 미소멸)**: RealEstateBuildingSummary, AuctionAreaSummary, LandAreaSummary.
**제외**: Subscription, SearchLog, Toilet_*_bak.

---

# Phase A — Expand (신 slug·읽기맵·URL판정·301로직·sync-side 전부 배포)

> PR-A. 데이터·URL 무변(301 플래그 OFF). 배포 후 신 URL(`/jeonnamgwangju/**`)·구 URL(`/gwangju`,`/jeonnam`) 모두 동작. 이후 sync가 옛명을 신명으로 정규화.

## Task A1: `normalizeRegionName` 공통 유틸

**Files:** Create `backend/src/lib/normalizeRegionName.ts`; Test `backend/__tests__/lib/normalizeRegionName.test.ts`

**Interfaces:** `export function normalizeRegionName(city: string, district?: string): { city: string; district: string }`; `export const JNGJ_CITY = '전남광주통합특별시'`; `export const JNGJ_DISTRICTS: Set<string>`(27); `export const GWANGJU_5GU: Set<string>`(동/서/남/북/광산구).

- [ ] **Step 1: 실패 테스트** — 광주/전남 변종→JNGJ, **신명+district concat**(`전남광주통합특별시영광군`→분리), **옛명+district concat**(R2: `전라남도영광군`→`{JNGJ,영광군}`), **경기도 광주시 불변**(`경기도`/`경기`+`광주시`→passthrough), `광주시`+비광주5구(예 `광주시`+`남양주`)→불변, 무관 지역 passthrough.

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeRegionName, JNGJ_CITY } from '../../src/lib/normalizeRegionName.js';
describe('normalizeRegionName', () => {
  it('광주/전남 변종 → JNGJ (district 유지)', () => {
    for (const c of ['광주','광주광역시']) expect(normalizeRegionName(c,'북구')).toEqual({city:JNGJ_CITY,district:'북구'});
    for (const c of ['전남','전라남도','전남광주']) expect(normalizeRegionName(c,'영광군')).toEqual({city:JNGJ_CITY,district:'영광군'});
  });
  it('신명+district concat 분리', () => {
    expect(normalizeRegionName('전남광주통합특별시영광군','')).toEqual({city:JNGJ_CITY,district:'영광군'});
  });
  it('옛명+district concat 분리 (R2)', () => {
    expect(normalizeRegionName('전라남도영광군','')).toEqual({city:JNGJ_CITY,district:'영광군'});
    expect(normalizeRegionName('광주광역시북구','')).toEqual({city:JNGJ_CITY,district:'북구'});
  });
  it('경기도 광주시 불변 (오염 방지)', () => {
    expect(normalizeRegionName('경기도','광주시')).toEqual({city:'경기도',district:'광주시'});
    expect(normalizeRegionName('경기','광주시')).toEqual({city:'경기',district:'광주시'});
    expect(normalizeRegionName('경기도광주시','')).toEqual({city:'경기도광주시',district:''}); // 오분리 안 됨
  });
  it('무관 지역 passthrough', () => {
    expect(normalizeRegionName('서울특별시','강남구')).toEqual({city:'서울특별시',district:'강남구'});
  });
});
```

- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — JNGJ 접두 concat 분리 → 옛 변종 접두(전라남도/전남/광주광역시/광주) strip 후 tail∈JNGJ_DISTRICTS면 분리(경기도광주시는 '경기도' strip이 목록에 없어 미해당) → 정규 통과 → 전남/광주 변종 매핑 → '광주시'는 district∈GWANGJU_5GU만 → passthrough.
- [ ] **Step 4: 통과 + tsc** — [ ] **Step 5: 커밋** `feat(region): normalizeRegionName(광주/전남→JNGJ, concat 교정, 경기광주 보호)`

## Task A2: sync-side 재드리프트 방지 (전 시설 소스 커버 — R1)

**Files:**
- Modify `backend/src/lib/addressParser.ts` — `parseAddress`·`extractCityDistrict`·`normalizeCity` **3함수 최종 단계에 normalizeRegionName 흡수**(Aed·Hospital·Pharmacy·Wifi 등 자동 상속). parseAddress 시도 인식에 `전남광주통합특별시` 추가(혼입 원천 차단).
- Modify `backend/src/services/csvParser.ts` — transform*Row **7곳**(toilet:442·clothes:592·parking:733·library:864·park:1154·school:1221·market:1292; "8곳"은 오기)에서 `normalizeRegionName(normalizedCity, district)` 적용. (transformSchoolRow는 dead path지만 방어적 적용.)
- Modify `backend/src/scripts/syncSchoolNeis.ts:133-145` — NEIS가 학교 **실소스**. `normalizeRegionName(normalizedCity, district)` 후 저장.
- Modify 자체 로컬 parseAddress 쓰는 sync: `childcareSyncService`·`evChargerSyncService`·`sportsSyncService`·`subwayDataSource` — city 세팅 직전 개별 적용.
- Test: `backend/__tests__/services/region-redrift.test.ts`(신규)

- [ ] **Step 1: 실패 테스트** — 각 경로 대표: (a) transformToiletRow('전라남도 영광군…')→city=JNGJ·district=영광군, (b) extractCityDistrict 경로(Aed '광주광역시 서구 …')→JNGJ, (c) normalizeCity 경로(Hospital '전남광주'/'광주광역시')→JNGJ, (d) syncSchoolNeis row→JNGJ, (e) 경기도 광주시 유지.
- [ ] **Step 2: 실패 확인** (현재 normalizeCity는 광주광역시→'광주'까지만, 통합 미반영)
- [ ] **Step 3: 구현** (위 삽입)
- [ ] **Step 4: 통과** — 기존 csvParser/transform/addressParser 테스트 전체 green + tsc
- [ ] **Step 5: 커밋** `fix(sync): 전 시설 소스 지역 정규화 삽입(addressParser 3함수+7 transform+NEIS+비-CSV)`

## Task A3: Region sync 정규화 + 옛코드 재생성 가드

**Files:** Modify `backend/src/scripts/syncRegion.ts`; Test `backend/__tests__/scripts/syncRegion.region.test.ts`

- [ ] **Step 1: 실패 테스트(모킹)** — 법정동 API가 `전남광주통합특별시`+code12만 줄 때 syncRegion이 city=`전남광주통합특별시` 저장, **bjdCode 29/46 upsert 0건**(옛코드 재생성 안 함) 단언.
- [ ] **Step 2: 구현** — city 저장에 normalizeRegionName 적용. 옛코드 삭제는 Phase B 담당(여기선 재생성만 방지).
- [ ] **Step 3: 통과 + tsc** — [ ] **Step 4: 커밋** `fix(region-sync): JNGJ 정규화 + 옛코드 재생성 가드`

## Task A4: 신 slug/읽기맵 등록 — frontend (S1 전진)

**Files:** Modify `frontend/shared/regionSlugs.ts`; Modify `frontend/pages/real-estate/[city]/index.vue`(suffix-strip 예외); Modify `frontend/server/middleware/real-estate-redirect.ts`(pass-through set); Test `frontend/tests/shared/regionSlugs.test.ts`

- [ ] **Step 1: 실패 테스트** — `CITY_SLUG_MAP['jeonnamgwangju']` truthy, `REGIONS['전남광주통합특별시'].length===27`(광주5구+전남22시군), suffix-strip이 `전남광주통합특별시`를 안 자름.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
  - `CITY_SLUGS['전남광주통합특별시']='jeonnamgwangju'`(→`CITY_SLUG_MAP` 자동 파생), `REGIONS['전남광주통합특별시']=[동구,서구,남구,북구,광산구, 목포시…신안군 (flat 27)]`.
  - `real-estate/[city]/index.vue:84` suffix-strip: `const cityFull = city==='전남광주통합특별시' ? city : city.replace(/(특별시|광역시|…)$/,'')` — 안 하면 '전남광주통합'으로 잘려 REGIONS·getComplexList 파손.
  - `real-estate-redirect.ts:33` `CITY_SLUGS_SET`에 `jeonnamgwangju` 포함(안 하면 `/real-estate/{type}/jeonnamgwangju`가 legacy detail 오인→404).
  - **gwangju/jeonnam 엔트리 유지**(C1에서 제거).
- [ ] **Step 4: 통과(frontend `npm run test`) + tsc** — [ ] **Step 5: 커밋** `feat(region): frontend jeonnamgwangju 등록(CITY_SLUGS·REGIONS flat27·suffix예외·pass-through)`

## Task A5: 신 slug/읽기맵 등록 — backend + URL판정 expand (S1·M2·T1)

**Files:** Modify `backend/src/services/cityMapping.ts`, `backend/src/lib/regionSlugs.ts`, `backend/src/lib/realEstateUrl.ts`, `frontend/utils/realEstateUrl.ts`; Test 해당 4 테스트파일

**Interfaces:**
- `CITY_SLUG_TO_FULL['jeonnamgwangju']='전남광주통합특별시'`, `CITY_SLUG_TO_SHORT['jeonnamgwangju']='전남광주통합특별시'`(축약명 없음). 역맵(SHORT_TO_SLUG/FULL_TO_SLUG) 자동 파생.
- `toCitySlug('전남광주통합특별시')==='jeonnamgwangju'`(regionSlugs `CITY_FULL_NAME_TO_SLUG`).
- `resolveCitySlug(bjdCode,'전남광주통합특별시')→{citySlug:'jeonnamgwangju'}` (code12 split 제거).
- `toCitySlugByDistrict('전남광주통합특별시', any)→'jeonnamgwangju'` (flat, GWANGJU_GU_NAMES split 제거) — backend+frontend 동일.
- `buildRegionFilter`·`cityVariantList`: city/slug가 '광주'/'전남'이면 variants에 '전남광주통합특별시' 포함(공유 헬퍼). ⚠️ **city-hub(district 없음)의 27구 오버매칭은 전환기(B~C) 한정 수용** — 리스크에 문서화.

- [ ] **Step 1: 테스트 — 기존 반전 + 신규(T1)**
  - **기존 교체**: `realEstateUrl.test.ts`(backend:143-160/frontend:100-111) 서구→gwangju·나주시→jeonnam 단언을 **jeonnamgwangju flat 기대값으로 전면 교체**(backend/frontend 동기). `cityMapping.test.ts:5-14`(12240→gwangju), `:50-54`(`.not.toContain('전남광주통합특별시')`)를 신 기대로 반전.
  - **신규 결정적 케이스**: `resolveCitySlug('12240','전남광주통합특별시').citySlug==='jeonnamgwangju'`; `toCitySlugByDistrict('전남광주통합특별시','북구')==='jeonnamgwangju'`; `buildRegionFilter('광주').city.in` **toContain** '전남광주통합특별시'; `buildRegionFilter('전남','영광군')` 포함; `cityVariantList('광주')` toContain '전남광주통합특별시'; 부산 서구 음성 회귀(무영향).
  - ⚠️ '광주'/'전남' 양성 단언은 A5~C1 한정 → C1 Step1에서 삭제/역전 명시.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — 위 등록·expand. `resolveCitySlug`의 `startsWith('12')`→name-based, **GWANGJU_GU_BJD 참조 제거 준비**(상수는 C1까지 유지 가능하나 분기 미사용). `toCitySlugByDistrict` split 제거. `buildRegionFilter`/`cityVariantList` 공유 규칙. Step3 구현과 Step1 테스트 **한 커밋**.
- [ ] **Step 4: 통과(backend+frontend) + tsc + lint 양쪽**
- [ ] **Step 5: 커밋** `feat(region): backend jeonnamgwangju 등록 + URL판정/필터 expand + 기존테스트 반전`

## Task A6: 검색 인덱스 별칭 (M1)

**Files:** Modify `backend/src/services/search/searchRegionIndex.ts`; Test 동 파일 테스트

- [ ] **Step 1: 실패 테스트** — 정규화(city=JNGJ만 존재) 후 `parseSearchQuery('광주 화장실').cityToken===JNGJ`, `'전남 약국'` 동일. (순수 시/도명 단독 토큰 회귀 방지.)
- [ ] **Step 2: 구현** — `buildRegionIndex`에서 `city===JNGJ`일 때 cityNames 별칭 `['광주','광주광역시','전남','전라남도','전남광주']→JNGJ` 등록.
- [ ] **Step 3: 통과 + tsc** — [ ] **Step 4: 커밋** `feat(search): JNGJ 지역 검색 별칭(광주/전남 시도명 매칭 유지)`
> ⚠️ searchRegionIndex는 TTL 1h 인메모리 — Phase B 후 즉시 반영엔 backend pm2 reload 필요(U3).

## Task A7: 301 리다이렉트 로직 (플래그 OFF) — 전 URL 형태 커버 (U1)

**Files:** Modify `frontend/server/middleware/redirects.ts`, `frontend/server/middleware/real-estate-redirect.ts`; Test `frontend/tests/server/*redirect*.test.ts`(함수 추출)

**Interfaces:** env `REGION_REORG_301`(기본 OFF). 순수함수 `resolveRegionReorgRedirect(pathname, search, flagOn): {target}|null` 추출해 단위 테스트.

- [ ] **Step 1: 실패 테스트(ON/OFF × 3형태)** —
  - 시설 지역: `/gwangju/서구/toilet`→`/jeonnamgwangju/서구/toilet`(district/category 불변).
  - **bare city hub**: `/gwangju`→`/jeonnamgwangju`(현 정규식 2세그+만 매칭 → 단일세그 분기 추가).
  - **부동산 NEW-format**: `/real-estate/apt-sale/gwangju/{district}/{building}`→`…/jeonnamgwangju/…`(byte-match, **real-estate-redirect.ts:222 pass-through보다 먼저** 호출).
  - flag OFF면 셋 다 301 안 됨. jeonnamgwangju 요청은 통과(VALID_CITIES/CITY_SLUGS_SET 포함, A4).
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — redirects.ts에 단일세그 `/^\/(gwangju|jeonnam)$/`분기 + 기존 2세그 매칭 확장(city∈{gwangju,jeonnam}→jeonnamgwangju). real-estate-redirect.ts에 `resolveRegionReorgCityRedirect`(segments[1]==='real-estate'&&len>=5&&segments[3]∈{gwangju,jeonnam}) line 222 앞 호출. 전부 `REGION_REORG_301==='1'` 가드. VALID_CITIES에 jeonnamgwangju.
- [ ] **Step 4: 통과 + tsc** — [ ] **Step 5: 커밋** `feat(region): 301 로직(플래그OFF)+jeonnamgwangju 수용 — 시설·부동산NEW·bare hub 커버`

## Task A8: Phase A 통합 검증 + PR-A

- [ ] **Step 1** — backend+frontend `npm run test`·`lint`·`tsc` 전부 green
- [ ] **Step 2: PR-A**(develop). 본문: expand 전체(신 slug·읽기맵·URL판정·검색별칭·301 OFF·sync-side). **데이터/URL 무변**. 검증: `/jeonnamgwangju/**` 200(현재 code12 데이터 소량이라도), `/api/area/jeonnamgwangju` 200, 기존 /gwangju·/jeonnam 정상, hospital·aed 재sync 1회 옛명 재유입 0.

---

# Phase B — Migrate (프로덕션 데이터 정규화 + 301 선활성)

> PR-B = 스크립트. 실행은 운영 DB 작업(사용자 승인). Phase A 배포 확인 후.

## Task B1: `adoptRegionReform.ts` (PK 청크 + sourceId 재코딩 + 하이브리드)

**Files:** Create `backend/src/scripts/adoptRegionReform.ts`(dry-run 기본 + `--apply`); Test `backend/__tests__/scripts/adoptRegionReform.test.ts`

**Interfaces (T2):** `export function planCityNormalization(rows, regionLookup: Map<string,string>): {id, table, fromCity, toCity, fromBjd, toBjd, fromSourceId?, toSourceId?}[]` — 순수함수. `regionLookup` = **static `district → 12xxx bjdCode` 27쌍 매핑표**(S4: JNGJ_DISTRICTS와 동일 소스에 bjdCode 병기, Region 존재 비의존). 스크립트 시작 시 **27쌍 완비 assert**.

- [ ] **Step 1: 실패 테스트(순수, 4케이스)** —
  - (a) 재코딩: `{bjdCode:'29140',city:'광주',district:'북구'}` → `{toCity:JNGJ, toBjd:'12110'(실제 매핑값), toSourceId: sourceId 2번째필드 29140→12110 치환}`
  - (b) district 매칭 실패 → skip + 리포트(planned에서 제외)
  - (c) 경기광주 `{bjdCode:'41610',city:'경기도',district:'광주시'}` → **EXCLUDE**(planned 부재) — Risks '경기 광주시 미변경' 커버
  - (d) bjdCode 없는/빈 행(Subway·Waste·Auction 스냅샷) → city만 변경, bjdCode·sourceId 불변
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현**
  - **정규화**: `normalizeRegionName`으로 city/district 교정.
  - **bjdCode 재코딩**: 옛 29/46 → district → `regionLookup` 신 12xxx. 매칭 실패 skip+로그.
  - **sourceId 재코딩(D2 근본 차단)**: `generateSourceId`가 bjdCode를 2번째 토큰으로 임베드(syncRealEstateBase:44-48, `[category, bjdCode, buildYear, …].join('-')`). sourceId의 **옛 bjdCode 토큰 전체를 신 bjdCode로 치환**(단순 `29→12` 접두 아님 — 29140→12110처럼 뒤3자리도 district 매핑으로 바뀜; row별 toBjd 값 사용). **unique 충돌 사전검사**: 치환된 sourceId가 이미 존재(신 sync가 넣은 것)면 → **옛 행 삭제(dedup)**; 없으면 → (city,bjdCode,sourceId) 동시 UPDATE.
  - **테이블별 apply(PK 청크 — D3)**: planCityNormalization이 낸 **id 목록**을 (toCity,toBjd,toSourceId)별 그룹핑 → `UPDATE {table} SET city=?,bjdCode=?[,sourceId=?] WHERE id IN (?,…)` 배치 1k~5k. **풀스캔·`LEFT(bjdCode,2)` WHERE 금지**. 배치 간 sleep + `SHOW PROCESSLIST` 모니터, 짧은 `innodb_lock_wait_timeout`. **`max_execution_time` 사용 금지(UPDATE 무효)**.
    - 22 bjdCode 테이블(Offitel 포함): city+bjdCode(+거래테이블은 sourceId) UPDATE.
    - AuctionItem **하이브리드(D4)**: `bjdCode=''` 스냅샷 → city만; bjdCode 행 → 재코딩.
    - Offitel: Apt/Villa/Land와 동일 재코딩(D1).
    - 2 bjdCode-없음(Subway·Waste): city만.
    - **Region**: (1) 옛 29/46 27행 **삭제** → (2) `(city,district)`·`(city,slug)` 중복 0 **assert** → (3) 신 12xxx 27행 city 보정 UPDATE. (@@unique 충돌 방지 순서 — S4.)
  - **레거시 ?bjdCode 폴백맵(U2)**: Region 삭제 **전** `oldBjd(29/46)→districtName` 27쌍 static 맵 캡처(파일 저장) → C의 detail 역조회 폴백에 사용. ⚠️ 단순 접두치환 금지, district 보존 매핑.
  - **백업**: 대상 행 `(id,city,bjdCode,sourceId)` → `_reform_bak2_{table}` + 파일 덤프. summary 3종도 `_reform_bak2_summary_*`.
- [ ] **Step 4: 순수함수 통과 + tsc + dist 빌드 확인** — [ ] **Step 5: 커밋** `feat(region): adoptRegionReform(PK청크+sourceId재코딩+dedup+하이브리드+백업)`

## Task B2: 프로덕션 dry-run → 게이트 검증 → apply

> 운영 실행(컨트롤러+사용자 승인).

- [ ] **Step 1: dry-run** — 테이블별 대상 건수·변종 잔여 0 예상·**district→신bjdCode 매칭 실패=0 게이트(0 아니면 중단)**·빈-bjdCode 스냅샷 수·sourceId 충돌(dedup 예정) 수 리포트. **경기광주(41) planned 부재 확인**.
- [ ] **Step 2: 백업 확인 → `--apply`** — PK 청크. 진행 로그·PROCESSLIST 모니터. **dry-run 대상건수 == apply 영향행수 게이트**.
- [ ] **Step 3: 데이터 검증** — 전 22+2 테이블 옛 변종 0, **부동산(Offitel 포함) bjdCode 29/46 = 0**, Region 27행(12xxx·JNGJ), 경기광주(41) 불변, sourceId 29/46 임베드 0.

## Task B3: summary DELETE+재생성 → 이중카운트 검증 → 301 선활성

- [ ] **Step 1: 파생 summary 명시 DELETE+재생성(S3)** — 백업(`_reform_bak2_summary_*`) 후:
  - `RealEstateBuildingSummary DELETE WHERE city IN ('광주','전남','광주광역시','전라남도','전남광주','광주시') OR LEFT(bjdCode,2) IN ('29','46')`
  - `LandAreaSummary`·`AuctionAreaSummary DELETE WHERE LEFT(bjdCode,2) IN ('29','46') OR city IN (변종)`
  - (경기광주 41·경기/경기도 미해당 — dry 확인) → `refreshRealEstateSummary`·land·auction 재생성.
- [ ] **Step 2: 이중카운트 검증(D2)** — sourceId 재코딩했으므로 원칙상 0이어야. reform 지역 12xxx 건물에 `COUNT(*) vs COUNT(DISTINCT dealYear,Month,Day,exclusiveArea,floor,dealAmount)` 비교 ≈ 1(이중 아님) 확인. 이상 시 dedup 잔여 조사.
- [ ] **Step 3: 301 선활성(S2 (a))** — apply+summary+검증 통과 **직후 같은 Cafe24 Deploy 파이프라인 배포로 `REGION_REORG_301=1`**(nginx auto-purge + pm2 reload로 인메모리 캐시 클리어 동반). window≈배포시간. `/gwangju/**`·`/jeonnam/**`(시설+부동산 NEW+bare hub) → 301 라이브 확인.
- [ ] **Step 4** — 검증: 개편 걸친 광주 아파트 상세 ≤5월+6월↑ 전체 표시. `/jeonnamgwangju/**` 200+데이터. PR-B 머지(실행 완료 후).

---

# Phase C — Contract (레거시 제거 + 사이트맵/재색인)

> PR-C. Phase B(301 이미 활성) 후. SEO 게이트.

## Task C1: 레거시 gwangju/jeonnam 코드·테스트 제거

**Files:** Modify `backend/src/services/cityMapping.ts`(GWANGJU_GU_BJD 삭제, CITY_SLUG_TO_FULL/SHORT gwangju·jeonnam 제거, resolveCitySlug/buildRegionFilter/cityVariantList 레거시 분기 제거), `backend/src/lib/realEstateUrl.ts`(GWANGJU_GU_NAMES·split 제거), `frontend/shared/regionSlugs.ts`·`frontend/utils/realEstateUrl.ts`(gwangju/jeonnam 제거), `realEstateHotspotService`·`localMarketService` 주석/로직 정정; Test 갱신

- [ ] **Step 1: 테스트 반전(T1 마무리)** — A5에서 넣은 '광주'/'전남' 양성 단언 **삭제/역전**, jeonnamgwangju만 유효. `CITY_SLUG_TO_FULL['jeonnamgwangju']==='전남광주통합특별시'`, gwangju/jeonnam 키 부재.
- [ ] **Step 2: 구현** — 위 제거. resolveCitySlug 순수 name-based. 타 지역 무영향 확인.
- [ ] **Step 3: 통과 + tsc + lint 양쪽** — [ ] **Step 4: 커밋** `refactor(region): 레거시 gwangju/jeonnam 제거(jeonnamgwangju 단일화)`

## Task C2: 사이트맵 재생성 + 301 확인

- [ ] **Step 1** — 301은 B3에서 이미 활성 → **활성 확인만**. C1 배포로 레거시 코드 제거 반영.
- [ ] **Step 2** — 사이트맵 재생성(jeonnamgwangju). **정적 사전생성 count-drop 가드(threshold 0.2)가 대량 slug 변경 차단 시 `Regen Sitemaps` workflow_dispatch force**(trash 이관 선례 [[project_naver_duplicate_content_recovery]]).
- [ ] **Step 3: 커밋/배포 기록**

## Task C3: 재색인 제출 + 라이브 검증(cache-bust)

- [ ] **Step 1** — GSC/네이버 사이트맵 재제출. IndexNow 신 URL 자동제출 확인.
- [ ] **Step 2: 라이브 체크리스트(U3 cache-bust)** — 옛 URL 301은 **`?_cb=랜덤`(X-Cache-Status MISS)**로 검증(직접 curl은 stale s-maxage 200 오염). 확인: 시설·부동산NEW·**bare hub** 301 byte-match, **색인 건물상세 hard 404 = 0**, 신 URL 200+데이터, 사이트맵 jeonnamgwangju 반영·gwangju/jeonnam 0, **홈 오늘의부동산 hotspot→jeonnamgwangju 클릭 200**, 검색 '광주 화장실'→JNGJ 스코프. 색인 추적 수 주.

## Task C4: PR-C + main 승격

- [ ] **Step 1** — PR-C CI green 머지 → A/B/C 전체 develop→main 승격 PR + Cafe24 배포 + 라이브 검증.

---

# 전체 검증

- **데이터**: 전 대상 테이블(Offitel·Auction 스냅샷 포함) 옛 변종 0, 부동산 bjdCode 29/46 0, **sourceId 29/46 임베드 0**, Region 27행, **파생 summary 3종 옛 변종 0 AND bjdCode 29/46 = 0**, **경기 광주시(41) 불변**.
- **이중카운트**: reform 12xxx 건물 거래 COUNT ≈ COUNT DISTINCT(이중 아님).
- **재드리프트**: hospital·aed·school 포함 시설 1회 재sync → 옛명 재유입 0.
- **URL/301**: 시설·부동산NEW·bare hub `/gwangju`·`/jeonnam` → `/jeonnamgwangju` 301, 신 URL 200+데이터, 색인 건물상세 hard 404 0.
- **검색**: '광주'/'전남' 시도명 단독 질의 → JNGJ 스코프 유지.
- **CI**: normalizeRegionName/cityMapping/regionSlugs/realEstateUrl(backend+frontend)/searchRegionIndex/adoptRegionReform 테스트 green.
- **재색인**: 사이트맵 jeonnamgwangju 반영, GSC/네이버 제출·색인 추적.

# 롤백

- 데이터: `_reform_bak2_*`(+summary)에서 city·bjdCode·sourceId 복원. dedup 삭제 행은 백업에서 재삽입.
- 코드: PR revert. 301: `REGION_REORG_301` OFF 재배포.

# 리스크

- **SEO/URL 이관(최대)**: #576~579 반전. expand(A)로 신 URL 선(先)라이브 → migrate(B) 말미 **301 즉시 활성**으로 window≈0 → contract(C) 재색인. 301 전수(시설·부동산NEW·bare hub)+사이트맵 재제출.
- **시설 read 경로 buildRegionFilter 미경유** → B→C 빈 페이지 위험을 **301 선활성(S2 a)**로 제거(read-path expand 대신).
- **비-sargable 풀스캔·가짜 안전장치** → PK id 청크 UPDATE, max_execution_time 미사용.
- **sourceId 미재코딩 시 이중카운트**(reform_june 전월판) → **B1 sourceId 재코딩+충돌 dedup**로 근본 차단.
- **12xxx Region 미보장·@@unique** → static 매핑표(존재 비의존)+삭제 후 중복0 assert.
- **경기 광주시 오염** → normalizeRegionName city='광주'만·'광주시'는 광주5구 한정, dry-run 41 부재 확인.
- **파생 summary 좀비** → refresh 아닌 명시 DELETE.
- **인메모리 캐시(hotspot/search TTL 1h)** → Phase B 후 pm2 reload. **라이브 검증 cache-bust 필수**.
- **city 정규화≠dedup**(옛명 행+신명 행 공존 시설 중복 상세)는 잔존 — 별도 후속(toilet 역병합 패턴).

# Self-Review 체크

- 신 slug/읽기맵 5곳이 **Phase A에 전부** 등록됐는가(C 아님). 경기 광주시 불변(테스트 (c)). resolveCitySlug flip과 읽기맵 등록이 같은 Phase인가. 301은 데이터 이관 **후** 즉시 활성인가(B3 Step3). PK id 청크인가(풀스캔·max_execution_time 없음). sourceId 재코딩+충돌 dedup 되는가. Region 삭제→중복0 assert→보정 순서. Offitel이 bjdCode 버킷인가. summary 명시 DELETE인가. 파생 summary·Auction 스냅샷·U2 폴백맵 커버. 기존 테스트 반전이 A5(넣기)·C1(빼기)로 명시됐는가. 재드리프트 삽입이 addressParser 3함수+7 transform+NEIS+비-CSV 전수인가.
