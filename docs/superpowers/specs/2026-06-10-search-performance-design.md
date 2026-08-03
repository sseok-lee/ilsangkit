# 통합 검색 성능 개선 설계 (Phase 3-성능)

날짜: 2026-06-10
범위: **백엔드 검색 응답속도만.** 결과 페이지 구성/디자인 개편은 별도 후속 spec으로 분리(사용자 결정 Q1=A).

## 1. 문제 정의 (실측, 로컬 Docker MySQL 8.0.44)

| 키워드 | facilities grouped | real-estate searchAll |
|---|---|---|
| 강남 | 0.7~1.6s | 0.4s |
| 래미안 | 2.5s | 0.5s |
| 화장실 | 2.8~5.8s | **17~22s** |

원인 (코드 확인 완료):

1. **부동산 17~22s**: `realEstateService.searchAll()`(realEstateService.ts:727-788)이 키워드가 순수 카테고리어("화장실")라 freeText가 비면 **필터 없이 거래 원본 테이블을 groupBy** — AptRentTransaction 277만 행 × 6타입. 결과도 무의미(임의 건물 3개).
2. **생활시설 2.8~5.8s**: `facilityService.searchGrouped()`(facilityService.ts:297-379)가 `parsed.categoryToken`을 **사용하지 않고** 항상 14개 카테고리 전체를 count. "화장실"이면 nameText=''라 **조건 없는 전 테이블 count**.
3. **freeText 2.5s**: `buildKeywordFilter()`(facilityService.ts:151-160)가 name/address/roadAddress 3필드 `LIKE '%kw%'`(비-sargable) — 14테이블 병렬 풀스캔.
4. 부동산 인기검색 "화장실" 클릭(방금 출시한 Phase 2)이 정확히 1번 최악 경로를 탐.

목표: **워밍업 후 로컬 기준 어떤 키워드든 검색 API 합산 p95 ~1초.**

## 2. 결정 사항 (사용자 확정)

- Q1: **성능 먼저** (페이지 구성/디자인은 후속 spec)
- Q2: **백엔드 응답속도만** (프론트 부분렌더·캐시 인프라 제외)
- Q3: **순수 카테고리 키워드는 부동산 검색 스킵** (freeText도 지역도 없을 때만)
- 접근: **하이브리드 = 쿼리 구조 다이어트(S1·S2) + FULLTEXT ngram(S3)**. S3 포함 확정.

## 3. 설계

### S1. 부동산 `searchAll` 재작성

**파일**: `backend/src/services/realEstateService.ts` `searchAll()`

1. **스킵 규칙**: 파서 결과 `freeText`가 비고 `effectiveCity/effectiveDistrict`도 없으면 DB 접근 없이 `{ results: [], totalCount: 0 }` 즉시 반환.
   - "래미안"(freeText) → 실행. "강남 화장실"(지역 있음) → 실행. "화장실"(둘 다 없음) → 스킵.
2. **데이터 소스 교체**: 거래 테이블 groupBy(6) + count(6) → **`RealEstateBuildingSummary`** findMany take 3 + count (타입당 2쿼리).
   - 필요 필드 전부 보유: buildingName, bjdCode, city, district, dongName, buildYear, latestPrice, latestDealYear/Month, transactionCount.
   - 인덱스 커버: `[type, buildingName]`(startsWith), `[type, city, district, transactionCount]`(지역).
   - 정렬: `transactionCount desc` (기존 groupBy take 3은 사실상 임의 → 의미 개선).
   - 응답 형태(JSON shape) 불변 — 프론트 무수정.
3. BigInt(latestPrice) 직렬화: 기존 `serializeRow()` 패턴 사용.

예상: 17~22s → 스킵 시 0, 실행 시 수십 ms.

### S2. 생활시설 파서 스코핑

**파일**: `backend/src/services/facilityService.ts` `searchGrouped()`

- `parsed.categoryToken`이 있으면 **해당 카테고리 1개만** count+fetch. 나머지 13개는 DB 접근 없이 `count:0, items:[]`.
- WasteSchedule(trash) 조회도 categoryToken이 `trash`일 때만 (categoryToken이 다른 값이면 스킵, **없으면 현행처럼 조회**).
- categoryToken 없으면(순수 freeText/지역) 현행 전 카테고리 유지 — 이 경로는 S3가 책임.
- 응답 형태 불변(카테고리 배열에 count>0만 들어가는 기존 규약 그대로).

예상: "화장실" 2.8~5.8s → 수십 ms (toilet 테이블 1개, 키워드 필터 없는 count+take3).

### S3. FULLTEXT ngram 인덱스 (freeText 경로)

**대상**: 14개 시설 테이블 `(name, address, roadAddress)` + WasteSchedule `(targetRegion, emissionPlace)`.
(ev-charger는 자체 `$queryRaw` 경로 — 동일 원리로 EvCharger 테이블에도 적용하되 기존 쿼리에 MATCH 조건만 교체.)

1. **인덱스 생성**: `ALTER TABLE x ADD FULLTEXT INDEX ft_x_search (name, address, roadAddress) WITH PARSER ngram;`
   - 로컬 MySQL 8.0.44: ngram ACTIVE, token_size=2 확인 완료.
   - **운영 Cafe24 MySQL**: 배포 전 `SHOW PLUGINS` 확인 단계 필수 (MySQL 8 기본 내장이라 가능성 높음).
2. **쿼리 교체**: `buildKeywordFilter()`의 contains OR 3개 → raw `MATCH(name,address,roadAddress) AGAINST(? IN BOOLEAN MODE)`.
   - 패턴: 카테고리별 raw 쿼리 2개(① `SELECT id ... LIMIT 3`, ② `SELECT COUNT(*)`) → `findMany({ where: { id: { in: ids } } })`로 기존 select/매핑 로직 재사용. 카테고리별 필드 차이 흡수, 정확한 카운트 유지. (flat `search()`는 LIMIT/OFFSET으로 페이지네이션)
   - 검색어 이스케이프: BOOLEAN MODE 연산자(`+-><()~*"@`) 제거 후 `"문구"` 구문 검색으로 전달(2글자 미만은 ngram 매칭 한계 → 기존 LIKE 폴백).
   - region 필터는 MATCH와 AND 결합 (`city IN (?,?)` variant 패턴 유지).
3. **`prisma db push` 호환 (핵심 제약)**: Prisma는 `WITH PARSER ngram`을 표현 못 하고, CI 배포가 `db push`라 미선언 인덱스 드랍 위험.
   - 해법: schema.prisma에 `@@fulltext([name, address, roadAddress])` 선언(+ `fullTextIndex` preview feature) → push가 "인덱스 존재"로 인식해 보존. 실제 인덱스는 마이그레이션 SQL로 ngram 파서 포함 생성. 인덱스명을 Prisma 기대명과 일치시킴.
   - **선행 검증 태스크(게이트)**: 로컬에서 ngram 인덱스 수동 생성 → `prisma db push` 실행 → 인덱스가 보존되고 파서가 ngram으로 유지되는지 확인. **실패 시 S3 보류, S1+S2만 1차 출시** (freeText ~2초 잔존 수용, 별도 해법 재설계).
4. flat `search()`(단일 카테고리 검색)도 동일 헬퍼로 교체 — `/[category]` 페이지 검색도 함께 빨라짐.

### S4. 검증 기준

- **회귀**: 백엔드 vitest 전체 green. 검색 API 응답 JSON shape 불변 (기존 route 테스트 + shape 스냅샷 테스트 추가).
- **단위 테스트**: ① 부동산 스킵 규칙(카테고리만/지역만/freeText만/혼합 4케이스) ② 카테고리 스코핑(1테이블만 호출 — prisma mock 호출 검증) ③ MATCH 검색어 이스케이프 ④ 2글자 미만 LIKE 폴백.
- **성능 실측**(로컬, 워밍업 1회 후 curl 3회 평균): `화장실` facilities <0.3s + RE 0건 즉시, `래미안` 합산 <1s, `강남` 합산 <0.5s. PR 본문에 before/after 표 기재.
- **운영 배포 후**: 동일 키워드 재실측, 메모리에 기록.

## 4. 범위 밖 (후속)

- 결과 페이지 구성/디자인 개편 (다음 brainstorming)
- 프론트 부분 렌더, 검색 결과 캐싱 인프라
- 탭/카테고리/페이지 URL 상태화 (디자인 개편 spec에서 다룸)

## 5. 리스크

| 리스크 | 대응 |
|---|---|
| 운영 MySQL ngram 미지원 | 배포 전 SHOW PLUGINS 확인. 미지원 시 S3 보류 게이트 |
| db push가 ngram 인덱스 드랍 | S3 선행 검증 태스크 게이트 (실패 시 S1+S2만) |
| ngram 매칭이 LIKE와 상이 (검색 결과 변화) | 대표 키워드 결과 동등성 테스트, 2글자 미만 LIKE 폴백 |
| FULLTEXT 인덱스 빌드 시간 (Wifi 7.8만 등) | 테이블당 수초~수십초 수준, 배포 시 1회. 마이그레이션 순차 실행 |
| summary 테이블이 거래 원본과 불일치 | summary는 sync 파이프라인이 유지 — 기존 suggest/complexes도 동일 소스라 신규 리스크 아님 |
