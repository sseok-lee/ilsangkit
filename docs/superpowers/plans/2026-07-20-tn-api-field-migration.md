# TN 표준데이터 API 필드명 마이그레이션 (워크스트림 A) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** clothes·parking·library·park·market 5개 카테고리의 수집을 복구한다 — data.go.kr TN 표준데이터 API가 옛 한글 필드명에서 영문 필드명으로 전환돼 `transform*Row`가 전량 null을 반환하던 것을, 영문 API 필드명으로 매핑을 교체해 정상 수집시킨다.

**Architecture:** 각 카테고리는 `syncXFromApi`(서비스) → `PublicApiClient.fetchAllPages`(영문 JSON 아이템) → `transformXRow`(csvParser.ts) → `batchUpsertRaw` 흐름. 수리 지점은 `src/services/csvParser.ts`의 `*CSVRow` 인터페이스 + `transform*Row` 함수(한글 키 읽기 → 영문 키). + clothes·parking·library 서비스의 API URL `http://`→`https://`(현재 매 요청 301).

**Tech Stack:** Express5/TS(ESM), Prisma, vitest. 좌표는 API가 제공(지오코딩 불필요).

## Global Constraints

- Node 20. package-lock 재생성 금지. ESM 로컬 import `.js`. PR→develop, self-merge 금지.
- 좌표 유효성 검증(KOREA_BOUNDS)·sourceId 생성 로직·DB 스키마·`batchUpsertRaw`·`transformAndDedupe` **불변** — 필드 접근 키만 교체.
- city/district: clothes·library는 API의 명시 시도/시군구 필드 사용; parking·park·market은 `rdnmadr`(도로명주소)를 기존 `parseAddress` + `normalizeCityName`으로 파싱(현행 유지).
- 각 transform은 순수함수 — 테스트는 실제 API 응답 형태의 샘플 아이템으로 단위 검증.
- **개편 명칭(전남광주통합특별시) 정규화는 이 플랜 범위 밖** — 필드명만 고친다.

## 5종 필드 매핑 (현재 한글 키 → 새 API 영문 키)

**parking** (`transformParkingRow` L698, `ParkingCSVRow` L128): 주차장관리번호→`prkplceNo`, 주차장명→`prkplceNm`, 소재지도로명주소→`rdnmadr`, 소재지지번주소→`lnmadr`, 위도→`latitude`, 경도→`longitude`, 주차장구분→`prkplceSe`, 주차장유형→`prkplceType`, 주차구획수→`prkcmprt`, 주차기본요금→`basicCharge`, 주차기본시간→`basicTime`, 추가단위요금→`addUnitCharge`, 추가단위시간→`addUnitTime`, 1일주차권요금→`dayCmmtkt`, 월정기권요금→`monthCmmtkt`, 전화번호→`phoneNumber`, 결제방법→`metpay`, 특기사항→`spcmnt`, 장애인전용주차구역보유여부→`pwdbsPpkZoneYn`, 급지구분→`feedingSe`, 부제시행구분→`enforceSe`, 운영요일→`operDay`, 요금정보→`parkingchrgeInfo`, 1일주차권요금적용시간→`dayCmmtktAdjTime`, 관리기관명→`institutionNm`, 데이터기준일자→`referenceDate`, 제공기관코드→`insttCode`, 제공기관명→`insttNm`. `buildParkingOperatingHours`(L674) 시간필드: 평일운영시작/종료→`weekdayOperOpenHhmm`/`weekdayOperColseHhmm`, 토요일→`satOperOperOpenHhmm`/`satOperCloseHhmm`, 공휴일→`holidayOperOpenHhmm`/`holidayCloseOpenHhmm`.

**clothes** (`transformClothesRow` L563, `ClothesCSVRow` L11): 관리번호→`mngNo`, 설치장소명→`instlPlcNm`, 시도명→`ctpvNm`, 시군구명→`sggNm`, 소재지도로명주소→`lctnRoadNmAddr`, 소재지지번주소→`lctnLotnoAddr`, 위도→`lat`, **경도→`lot`**(주의: longitude 아님), 관리기관명→`mngInstNm`, 관리기관전화번호→`mngInstTelno`, 데이터기준일자→`dataCrtrYmd`, 상세위치→`dtlPstn`, 제공기관코드→`insttCode`, 제공기관명→`insttNm`. (city/district는 `ctpvNm`/`sggNm` 직접 — parseAddress 불필요, 현행 로직 유지.)

**library** (`transformLibraryRow` L835, `LibraryCSVRow` L167): 도서관명→`lbrryNm`, 시도명→`ctprvnNm`, 시군구명→`signguNm`, 소재지도로명주소→`rdnmadr`, 위도→`latitude`, 경도→`longitude`, 도서관유형→`lbrrySe`, 휴관일→`closeDay`, 평일운영시작/종료→`weekdayOperOpenHhmm`/`weekdayOperColseHhmm`, 토요일→`satOperOperOpenHhmm`/`satOperCloseHhmm`, 공휴일→`holidayOperOpenHhmm`/`holidayCloseOpenHhmm`, 열람좌석수→`seatCo`, 자료수(도서)→`bookCo`, 자료수(연속간행물)→`pblictnCo`, 자료수(비도서)→`noneBookCo`, 대출가능권수→`lonCo`, 대출가능일수→`lonDaycnt`, 도서관전화번호→`phoneNumber`, 홈페이지주소→`homepageUrl`, 운영기관명→`operInstitutionNm`, 부지면적→`plotAr`, 건물면적→`buldAr`, 데이터기준일자→`referenceDate`, 제공기관코드→`insttCode`, 제공기관명→`insttNm`.

**park** (`transformParkRow` L1114, `ParkCSVRow` L912): 관리번호→`manageNo`, 공원명→`parkNm`, 소재지도로명주소→`rdnmadr`, 소재지지번주소→`lnmadr`, 위도→`latitude`, 경도→`longitude`, 공원면적→`parkAr`, 공원구분→`parkSe`, 공원보유시설(운동시설)→`mvmFclty`, (유희시설)→`amsmtFclty`, (편익시설)→`cnvnncFclty`, (교양시설)→`cltrFclty`, (기타시설)→`etcFclty`, 지정고시일→`appnNtfcDate`, 관리기관명→`institutionNm`, 전화번호→`phoneNumber`, 데이터기준일자→`referenceDate`, 제공기관코드→`insttCode`, 제공기관명→`insttNm`.

**market** (`transformMarketRow` L1254, `MarketCSVRow` L1016): 시장명→`mrktNm`, 소재지도로명주소→`rdnmadr`, 소재지지번주소→`lnmadr`, 위도→`latitude`, 경도→`longitude`, 시장유형→`mrktType`, 시장개설주기→`mrktEstblCycle`, 점포수→`storNumber`, 취급품목→`trtmntPrdlst`, 사용가능상품권→`useGcct`, 홈페이지주소→`homepageUrl`, 공중화장실보유여부→`pblicToiletYn`, 주차장보유여부→`prkplceYn`, 개설연도→`estblYear`, 전화번호→`phoneNumber`, 데이터기준일자→`referenceDate`, 제공기관코드→`insttCode`, 제공기관명→`insttNm`.

---

### Task 1: parking 필드 마이그레이션 (worked example — 나머지 동일 패턴)

**Files:**
- Modify: `src/services/csvParser.ts` — `ParkingCSVRow`(L128), `transformParkingRow`(L698), `buildParkingOperatingHours`(L674 부근)
- Modify: `src/services/parkingSyncService.ts:96` — `http://`→`https://`
- Test: `__tests__/services/csvParser.parking.test.ts` (신규; 기존 `__tests__/services/csvParser.test.ts`도 계속 green 유지)

**Interfaces:** `transformParkingRow(row: ParkingCSVRow): TransformedParking | null` — 반환 타입 `TransformedParking` 불변. `ParkingCSVRow`를 위 매핑의 영문 키로 재정의.

- [ ] **Step 1: 실패 테스트 작성** — 실제 API 형태 샘플로 transform 성공 검증

```ts
import { describe, it, expect } from 'vitest';
import { transformParkingRow } from '../csvParser.js';

const sample = {
  prkplceNo: '355-2-000029', prkplceNm: '산동우항공원 공영주차장',
  prkplceSe: '공영', prkplceType: '노외',
  rdnmadr: '경상북도 구미시 신당4로1길 56', lnmadr: '경상북도 구미시 산동읍 신당리 2017',
  prkcmprt: '233', latitude: '36.15387449', longitude: '128.4316946',
  basicTime: '30', basicCharge: '300', addUnitTime: '10', addUnitCharge: '100',
  institutionNm: '구미시', phoneNumber: '054-480-6543', referenceDate: '2024-01-01',
  insttCode: 'B551014', insttNm: '구미시',
} as any;

describe('transformParkingRow (영문 API 필드)', () => {
  it('영문 필드 아이템을 정상 변환한다', () => {
    const r = transformParkingRow(sample);
    expect(r).not.toBeNull();
    expect(r!.name).toBe('산동우항공원 공영주차장');
    expect(r!.city).toBe('경북');
    expect(r!.district).toBe('구미시');
    expect(r!.lat).toBeCloseTo(36.15387449, 5);
    expect(r!.lng).toBeCloseTo(128.4316946, 5);
    expect(r!.capacity).toBe(233);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인** — `npx vitest run __tests__/services/csvParser.parking.test.ts` → 현재 한글 키 읽어 `name=''`→null 반환으로 FAIL
- [ ] **Step 3: 구현** — `ParkingCSVRow` 인터페이스를 위 매핑의 영문 키로 재정의하고, `transformParkingRow`·`buildParkingOperatingHours`의 모든 `row['한글']`을 대응 영문 키로 교체. 좌표/sourceId/parseAddress 로직·반환 구조 불변. `parkingSyncService.ts:96` URL을 `https://`로.
- [ ] **Step 4: 테스트 통과 확인** — 위 명령 PASS
- [ ] **Step 5: 커밋** — `git add -A && git commit -m "fix(parking): TN API 영문 필드명 마이그레이션"`

### Task 2: clothes 필드 마이그레이션

**Files:** Modify `src/services/csvParser.ts`(`ClothesCSVRow` L11, `transformClothesRow` L563); `src/services/clothesSyncService.ts:79` `http://`→`https://`. Test: `csvParser.clothes.test.ts`.

- [ ] **Step 1: 실패 테스트** — 샘플(실API): `{mngNo, instlPlcNm:'의류수거함', ctpvNm:'광주', sggNm:'서구', lctnRoadNmAddr:'... 서구 ...', lctnLotnoAddr:'...', lat:'35.15', lot:'126.85', mngInstNm, mngInstTelno, dataCrtrYmd, insttCode, insttNm}`. 기대: name/city/district/lat/lng 정상. **경도는 `lot`에서 읽어야 함.**
- [ ] **Step 2: 실패 확인** — `npx vitest run __tests__/services/csvParser.clothes.test.ts`
- [ ] **Step 3: 구현** — `ClothesCSVRow`·`transformClothesRow` 영문 키 교체(위 clothes 매핑). city/district는 `ctpvNm`/`sggNm` 직접 사용, 경도는 `lot`. URL https화.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `fix(clothes): TN API 영문 필드명 마이그레이션 (경도=lot)`

### Task 3: library 필드 마이그레이션

**Files:** Modify `csvParser.ts`(`LibraryCSVRow` L167, `transformLibraryRow` L835); `librarySyncService.ts:91` `http://`→`https://`. Test: `csvParser.library.test.ts`.

- [ ] **Step 1: 실패 테스트** — 샘플: `{lbrryNm:'○○도서관', ctprvnNm:'광주', signguNm:'북구', rdnmadr:'...', latitude:'35.18', longitude:'126.9', seatCo:'100', bookCo:'50000', phoneNumber, referenceDate, insttCode, insttNm}`. 기대: name/city/district/lat/lng/seatCount/bookCount 정상.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — `LibraryCSVRow`·`transformLibraryRow` 영문 키 교체(위 library 매핑). city/district는 `ctprvnNm`/`signguNm`. URL https화.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `fix(library): TN API 영문 필드명 마이그레이션`

### Task 4: park 필드 마이그레이션

**Files:** Modify `csvParser.ts`(`ParkCSVRow` L912, `transformParkRow` L1114). URL 이미 https(변경 없음). Test: `csvParser.park.test.ts`.

- [ ] **Step 1: 실패 테스트** — 샘플: `{manageNo, parkNm:'○○공원', parkSe:'근린공원', rdnmadr:'전남광주통합특별시 목포시 ...', lnmadr:'...', latitude:'34.8', longitude:'126.4', parkAr:'12000', institutionNm, phoneNumber, referenceDate, insttCode, insttNm}`. 기대: name/city(parseAddress)/district/lat/lng 정상.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — `ParkCSVRow`·`transformParkRow` 영문 키 교체(위 park 매핑). city/district는 `rdnmadr` parseAddress(현행).
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `fix(park): TN API 영문 필드명 마이그레이션`

### Task 5: market 필드 마이그레이션

**Files:** Modify `csvParser.ts`(`MarketCSVRow` L1016, `transformMarketRow` L1254). URL 이미 https. Test: `csvParser.market.test.ts`.

- [ ] **Step 1: 실패 테스트** — 샘플: `{mrktNm:'○○시장', mrktType:'상설시장', rdnmadr:'...', lnmadr:'...', latitude:'35.1', longitude:'126.9', storNumber:'50', estblYear:'1980', phoneNumber, referenceDate, insttCode, insttNm}`. 기대: name/city/district/lat/lng/storeCount 정상.
- [ ] **Step 2: 실패 확인**
- [ ] **Step 3: 구현** — `MarketCSVRow`·`transformMarketRow` 영문 키 교체(위 market 매핑). city/district는 `rdnmadr` parseAddress.
- [ ] **Step 4: 통과 확인**
- [ ] **Step 5: 커밋** — `fix(market): TN API 영문 필드명 마이그레이션`

### Task 6: 전체 검증 + PR

- [ ] **Step 1: 전체 테스트** — `npm run test` (백엔드) green, `npm run lint`, `tsc` 0
- [ ] **Step 2: 스모크(선택, 스테이징/로컬)** — 각 `syncXFromApi` 1페이지만 실행해 transform 성공률>0·좌표 유효 확인 (프로덕션 대량 재sync는 배포 후 daily 창)
- [ ] **Step 3: PR 생성** — develop 대상, 5종 카테고리 수집 복구 요약

## Self-Review 체크

- 각 카테고리 인터페이스 필드명이 transform 접근 키와 일치하는가(TS 컴파일). 좌표 필드(clothes=lat/lot, 나머지=latitude/longitude) 정확한가. city 도출 경로(clothes/library=명시필드, parking/park/market=parseAddress) 유지됐는가. http→https는 clothes/parking/library만.
