# 데이터 동기화 가이드

모든 명령어는 `cd backend` 후 실행.

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
npm run sync:trash        # 쓰레기배출 (공공데이터 API, OPENAPI_SERVICE_KEY 필요)
npm run sync:childcare    # 어린이집 (childcare.go.kr API, CHILDCARE_*_API_KEY 필요)
npm run sync:ev-charger   # 전기차충전소 (공공데이터 API)
npm run sync:sports       # 체육시설 (공공데이터 API)
```

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

`sync:school:geocode` 는 `lat IS NULL` 인 행만 본다. 학교가 이전해 주소가 바뀐 경우
좌표는 갱신되지 않으므로 필요하면 해당 행의 좌표를 비우고 다시 돌려야 한다.

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
