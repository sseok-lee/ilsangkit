# 데이터 동기화 가이드

모든 명령어는 `cd backend` 후 실행.

## 공공임대: 마이홈 + LH

`OPENAPI_SERVICE_KEY`에 두 서비스의 활용 승인이 필요하다.
- 마이홈 공공주택 모집공고: https://www.data.go.kr/data/15108420/openapi.do
- LH 임대공고: https://www.data.go.kr/data/15058530/openapi.do (임대주택 06 + 주거복지 13)

```bash
npm run sync:public-rental               # API 조회·정규화만, DB/동기화 이력 변경 없음
npm run sync:public-rental -- --write    # Subscription 저장 + sub-public-rent 동기화 이력
```

처음 배포하기 전에 대상 DB에 `prisma/sql/20260922_public_rental.sql`을 한 번 적용하고
`npm run db:generate` 및 빌드를 수행한다. 기존 공고를 유지하는 컬럼·인덱스 추가다.
저장 대상은 `.env`의 `DATABASE_URL`이므로 로컬 검증 시 localhost:3307/ilsangkit을 사용한다.
일일 `sync-real-estate.yml`에 공공임대 단계가 포함되며 수동 동기화와 동시 실행하지 않는다.

`PUBLIC_RENT` 소스로 기존 청약홈 임대 공고와 함께 제공한다. LH panId와 마이홈
정정 전 공고 ID를 이용해 중복을 병합하고, 기존 상세 URL은 유지한다. 대체된 URL은
새 공고 정보를 반환하고 목록·사이트맵에서 제외한다. 제목 유사도로 합치지 않는다.
공고별 여러 지역·공급조건은 `publicRental.supplies`에 보존하고 각 지역으로 검색한다.
공고를 한 건물로 간주하는 지오코딩은 하지 않는다.

마이홈 공급별 실제 접수기간이 모두 동일할 때만 공고의 접수기간으로 사용한다.
LH 목록의 게시일·게시종료일을 접수기간으로 해석하지 않는다. 접수일이 불명확하면
`unknown`(일정 확인 필요), 원천에서 접수마감이 확인되면 `closed`로 제공한다.
보증금·월임대료는 원 단위의 원천 최저금액이며 0/미제공은 `null`(원문 확인)이다.
두 API 조회를 모두 완료한 뒤 저장하므로 한 원천 실패 시 공고를 부분 갱신하지 않는다.
DB 저장 중 실패하면 완료된 공고는 남고 이력은 실패로 기록된다. 재실행은 기존 ID를 갱신한다.
현재 응답에 없는 과거 공고는 삭제하지 않으며 SH/GH 등 전국 모든 기관의 포함을 보장하지 않는다.

---

## 통합 동기화

```bash
npm run sync:facilities                        # 전체 시설 동기화 (15개 카테고리)
npm run sync:facilities -- --only toilet,wifi   # 특정 카테고리만
npm run sync:facilities -- --skip wifi          # 특정 카테고리 제외
```

포함 카테고리: toilet, trash, wifi, clothes, hospital, pharmacy, parking, aed, library, park, school, market, childcare, ev-charger, sports

---

## 시설 개별 동기화

### CSV 기반
```bash
npm run sync:toilet       # 공공화장실
npm run sync:wifi         # 무료와이파이
npm run sync:clothes      # 의류수거함
npm run sync:parking      # 공영주차장
npm run sync:library      # 공공도서관
npm run sync:park         # 공원
npm run sync:market       # 전통시장
npm run sync:aed          # 자동심장충격기 (공공데이터 API)
npm run sync:regions      # 지역(시/군/구) 데이터
```

### API 기반
```bash
npm run sync:trash        # 쓰레기배출 후보 준비 (OPENAPI_SERVICE_KEY + WASTE_* 참조 파일 필요)
npm run sync:childcare    # 어린이집 (childcare.go.kr API, CHILDCARE_*_API_KEY 필요)
npm run sync:ev-charger   # 전기차충전소 (공공데이터 API)
npm run sync:sports       # 체육시설 (공공데이터 API)
```

쓰레기 배출정보는 수집 직후 바로 공개하지 않는다. 먼저 후보 generation과 검토 리포트를 만들고,
리포트의 `reportHash`와 현재 공개 generation을 확인한 뒤 별도 명령으로 포인터만 발행한다.

```bash
npm run sync:trash -- \
  --reference-path=./data/waste/reference.json \
  --reference-manifest-path=./data/waste/manifest.json \
  --reference-checksums-path=./data/waste/checksums.json \
  --report-out=./data/waste/review-report.json

npm run waste:publish -- \
  --generation-id=<prepared-id> \
  --approval-report-hash=<report-hash> \
  --expected-base=<active-id|none>
```

`sync:facilities -- --only trash`도 같은 후보 준비만 수행한다. `--dry-run`은 통합 명령에서
`--only trash --dry-run` 조합만 허용한다. 기존 `sync:trash --approval-report-hash`와
`--expected-base`는 더 이상 수집 명령에서 받지 않는다.

### 병원/약국
```bash
npm run seed:hospital-detail  # 병원 상세정보 (건강보험심사평가원 API)
```

---

## 학교 동기화 (NEIS API)

**NEIS 가 학교의 단일 소스다.** 표준데이터(전국초중등학교위치표준데이터) CSV·tn_ API 는
쓰지 않는다 — referenceDate 2026-03-20 에 멈춰 2026 인천 행정구역 개편을 반영하지 않는다
(제물포·영종·서해·검단구 0건). 그 값으로 지역을 쓰면 채택한 신설구가 되돌아간다.

환경 변수: `NEIS_API_KEY` 필요 (https://open.neis.go.kr)

```bash
npm run sync:school              # 학교 기본정보 (sync:facilities에 포함)
npm run sync:school:enrollment   # 학년별 학급(반) 수
npm run sync:school:department   # 고등학교 계열 정보
npm run sync:school:geocode      # 좌표 없는 학교 카카오 geocoding (KAKAO_REST_API_KEY 필요)
```

### 실행 순서

`sync:school` 을 먼저 돌린다. 자식 데이터는 `neisEduCode`(교육청) + `neisSchoolCode`(학교)
쌍으로 조회하므로, 새로 연결된 학교는 `sync:school` 이 `neisEduCode` 를 채운 뒤에야
학급·계열이 붙는다.

```bash
npm run sync:school
npm run sync:school:enrollment
npm run sync:school:department
npm run sync:school:geocode
```

`sync:school:geocode` 는 두 가지를 대상으로 잡는다:

1. 좌표가 없는 행 — 신규 학교
2. `geocodedAddress`(좌표를 만든 주소)와 현재 주소가 달라진 행 — 학교 이전

`syncAll` 의 카테고리 순서가 `school` → `school-geocode` 라 한 번의 실행 안에서 닫힌다.
주소가 바뀌면 바로 다음 단계가 재지오코딩한다.

`geocodedAddress` 가 NULL 인 행은 건드리지 않는다. 표준데이터 CSV 의 측량 좌표라
카카오 도로명 중심점보다 정확한 경우가 많다 — 2026-09-09 실측에서 200m 초과 95건을
학교명 키워드 검색으로 교차검증하니 32건은 저장 좌표가 더 정확했다(평택고는 주소
지오코딩이 1,746m 벗어남, 인천 석정로 165 는 5개교가 한 주소라 단지 입구로 찍힘).

```bash
# 일회성: 기존 좌표의 출처를 현재 주소로 기록해 이후 변경을 감지할 수 있게 한다
npx tsx src/scripts/geocodeSchool.ts --backfill-geocoded-address
```

지오코딩에 실패해도 기존 좌표는 남긴다. 비우면 카카오가 못 찾는 주소(실측 73건)에서
지도가 아예 사라진다.

### 은퇴한 스크립트

| 스크립트 | 은퇴 이유 |
|---|---|
| `sync:school:merge` | NEIS 를 학교명만으로 매칭해(`Map.set(n.name, n)`) 940행에 남의 학교 코드를 박았다. 동명 학교가 1,069개 이름·2,615행이라 이름 단독 매칭은 성립하지 않는다 (#789) |
| `sync:school:csv` | 표준데이터 CSV 로 School 12,014행을 덮어써 신원을 2026-03-20 값으로 되돌린다 |

표준데이터 CSV(`prisma/data/school.csv`)는 `reconcileSchoolNeisRows` 의 학교ID ↔ NEIS 코드
매핑 입력으로만 남아 있다. 읽기 전용이다.

---

## 부동산 동기화 (국토교통부 API)

환경 변수: `OPENAPI_SERVICE_KEY` 필요

### 데이터 수집
```bash
npm run sync:apt-sale       # 아파트 매매
npm run sync:apt-rent       # 아파트 전월세
npm run sync:villa-sale     # 빌라 매매
npm run sync:villa-rent     # 빌라 전월세
npm run sync:offitel-sale   # 오피스텔 매매
npm run sync:offitel-rent   # 오피스텔 전월세
```

### 좌표 보강
```bash
npm run sync:geocode-real-estate  # 카카오 geocoding (KAKAO_REST_API_KEY 필요)
```

순서: sale geocoding → rent에 좌표 복사 → rent geocoding
(geocodeRealEstate.ts가 내부적으로 이 순서를 처리)

---

## 프로덕션 주기적 동기화 전체 순서

```bash
# 1. 시설 전체 (학교 포함, 15개 카테고리)
npm run sync:facilities

# 2. 학교 부가 데이터
npm run sync:school:enrollment
npm run sync:school:department

# 3. 부동산 데이터 수집
npm run sync:apt-sale
npm run sync:apt-rent
npm run sync:villa-sale
npm run sync:villa-rent
npm run sync:offitel-sale
npm run sync:offitel-rent

# 4. 부동산 좌표 보강
npm run sync:geocode-real-estate
```

---

## 필요 환경 변수 요약

| 변수 | 용도 | 출처 |
|------|------|------|
| `OPENAPI_SERVICE_KEY` | 공공데이터 API (trash, aed 등) | data.go.kr |
| `KAKAO_REST_API_KEY` | 주소→좌표 geocoding | developers.kakao.com |
| `NEIS_API_KEY` | 학교 정보 (NEIS) | open.neis.go.kr |
| `CHILDCARE_BASIC_API_KEY` | 어린이집 기본정보 | api.childcare.go.kr |
| `CHILDCARE_LIST_API_KEY` | 어린이집 목록 | api.childcare.go.kr |
| `OPENAI_API_KEY` | 가이드 콘텐츠 생성 | platform.openai.com |

쓰레기 후보 준비용 선택 값:

```bash
WASTE_REFERENCE_PATH=
WASTE_REFERENCE_MANIFEST_PATH=
WASTE_REFERENCE_CHECKSUMS_PATH=
WASTE_REPORT_OUT=
WASTE_AREA_DISCOVERY_ENABLED=
```

## Waste area discovery W10 rollback and publication notes

Waste area discovery publication is pointer-based. Rollback should move `WastePublication.activeGenerationId` back to a previously published, complete generation through the guarded rollback path; do not delete waste area tables, staged rows, revision rows, coverage rows, or source history as a rollback mechanism. Table deletion would destroy auditability and can break older source/detail URLs.

If staged writes have already begun, keep runtime write flags enabled until the staged generation is either marked failed or the pointer transaction is completed/rolled back. Turning flags off midway can strand a partially staged generation and make operator recovery ambiguous. After the staged operation is closed, disable write flags again if publication is not continuing.

For a stale approved report hash or base-generation mismatch, rerun the read-only builder/review and approve a fresh report hash instead of forcing the pointer. The W10 publication path intentionally retries only MySQL 1213 deadlock during pointer publication, then lets the expected-base guard return 409.

Targeted cache handling for waste routes should preserve the production no-store rules for `/trash`, `/trash/**`, and city/district trash routes. If a live dev/server process still serves a stale legacy redirect, treat it as a running-build/cache limitation and verify with a fresh isolated SSR build rather than deleting application data or service DB rows.

## Real estate summary V2 preparation and validation

Address-level summary V2 preparation is a guarded write path. Operators must set `REAL_ESTATE_WRITE_LOCK_DIR` to a local writable lock directory before running any summary writer or verification command. Batch knobs are optional: `SUMMARY_BATCH_PAUSE_MS` accepts `0..10000`, and `SUMMARY_BATCH_TIMEOUT_MS` accepts `1000..1800000`. `SUMMARY_BATCH_MAX_ROWS` accepts `1..50000` (default `25000`) and targets the source rows in each city/bjdCode batch. A single bjdCode stays together even when it exceeds this target, preserving complete building histories; inspect the logged `sourceRows` and elapsed time on production before raising limits. Summary-only codes are also processed to remove stale rows. Each batch publishes its summary, rent split, and URL mappings atomically. A failed city result can contain committed rows from its successful batches; failed batches retain their previous rows.

Prepare V2 once and review the JSON report before switching readers:

```bash
npm run summary:prepare-v2 -- --report-out=/absolute/path/summary-v2-prepare-report.json
npm run summary:verify-v2 -- --report-out=/absolute/path/summary-v2-verify-report.json
```

The prepare command acquires the shared real-estate write lock, marks the singleton state `preparing`, refreshes complete type/city batches into `RealEstateBuildingSummaryV2`, validates V2 against the six source transaction tables, and sets state `ready` only when validation is complete. If state is already `ready`, prepare verifies the existing run and does not rebuild V2.

Stale lock recovery is explicit and token-checked; there is no automatic TTL recovery:

```bash
npx tsx src/scripts/recoverRealEstateWriteLock.ts --token <owner-token-from-owner.json>
```
