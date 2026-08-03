# 토지 실거래가 페이지 설계 (Land Transaction Pages)

- **작성일**: 2026-06-04
- **상태**: 설계 승인 대기
- **범위**: 국토교통부 토지 매매 실거래가 데이터를 동(법정동) 단위 SEO 페이지로 추가
- **목적**: 검색 노출(롱테일) → 상세페이지 유입 → 애드센스 수익

## 1. 배경 & 목표

일상킷은 검색 유입으로 애드센스 수익을 내는 정보 사이트다. 현재 부동산은 6종(아파트·빌라·오피스텔 × 매매·전월세)을 다루며, 모두 **건물/단지 중심** UX다.

토지 매매 실거래가는 국토교통부가 기존 6종과 동일한 XML API 형태로 제공하므로 수집 파이프라인을 재사용할 수 있다. 다만 토지는 **건물/단지 개념이 없고 필지(지번) 단위**라, 기존 "단지 목록 → 건물 상세" 구조를 그대로 쓸 수 없다.

**핵심 목표**: 토지 검색의 본질인 **롱테일(동/읍면 단위 시세 검색)**을 색인 가능한 텍스트 페이지로 흡수해 검색 유입과 애드센스 노출을 극대화한다. 동시에 저품질 대량생산으로 도메인 품질이 강등되는 리스크를 차단한다.

### 수익 모델 관점

> 수익 ≈ 색인된 페이지 수 × 페이지당 검색 유입 × 페이지당 광고 노출

사용자는 "강남구 토지 시세"보다 **"OO동 땅값 평당"** 처럼 동/읍면 단위로 검색한다. 따라서 페이지 깊이가 곧 매출 상한이며, 동 단위까지 내려가야 롱테일을 잡는다.

### 벤치마크 분석 (왜 지도 우선이 아닌가)

| 사이트 | 방식 | 우리 전략 적합성 |
|---|---|---|
| 밸류맵 | 지도 우선(앱), 지적도+필지 실거래 | ❌ |
| 디스코 | 지도 우선(앱), 필지 일대 실거래·통계 | ❌ |
| 부동산플래닛 | 지도 우선(앱), 전 유형·지적편집도·AI추정가 | ❌ |
| 땅야 | 지도 우선(앱), 토지 실거래+매물 | ❌ |

이들은 전부 **지도 우선 SPA/앱**으로, 콘텐츠가 JS 렌더 뒤에 숨어 구글 텍스트 색인이 어렵다. 트래픽은 앱 설치+브랜드 검색 중심이며 "OO동 땅값" 롱테일 텍스트 검색에는 약하다. 또한 지적도 폴리곤·필지 지오코딩은 막대한 데이터·엔지니어링 비용(이들의 해자)이다.

→ **우리 포지셔닝은 정반대**: 이들이 비워둔 "색인 가능한 동 단위 텍스트 시세 페이지"를 가볍게 차지한다. 지도 깊이로 경쟁하지 않는다.

## 2. 설계 결정 요약

| 항목 | 결정 |
|---|---|
| 범위 | 토지 매매 실거래가만 (경매는 보류 — 4절 참조) |
| 묶음 단위 | 지역(법정동) 집계 |
| 페이지 깊이 | 동 단위까지 + 품질 게이트 |
| 단가 표기 | 평당가 주력 + ㎡당가 병기 (평 = 3.305㎡) |
| 헤드라인 평당가 | **지목 '대'(대지) 거래만**으로 산정 (도로·지분 오염 방지). 지목별 평당가는 분리 표기, 시계열도 대지 기준. 대지 거래 0건이면 null 폴백. (2026-06-04 실데이터 검토로 확정) |
| 지도 | 지역 중심 좌표 1개 (필지별 핀 없음) |
| 슬러그 | `land` (매매뿐이라 `-sale` 접미사 없음) |
| 코드 구조 | 토지 = 독립 모듈로 격리 |
| 보강 데이터 | 개별공시지가(실거래/공시 배율) + 지가변동률(지역 추세) + 용도지역 해설(정적) |

## 3. 아키텍처

### 3.1 격리 원칙

기존 6종은 건물/단지 중심(`getModel`·`complexes`·`building-info`·`area-groups`)이다. 지역 집계 중심인 토지를 이 레지스트리에 끼워 넣으면 `isSaleType` 같은 분기가 곳곳에 번져 결합도가 높아진다.

→ 토지는 **독립 모듈**로 분리한다:

- 백엔드: `landService.ts`, `routes/land.ts`, `schemas/land.ts` (기존 `realEstateService`와 분리)
- 프론트: `composables/useLand.ts`, `utils/landMeta.ts`, `pages/real-estate/land/**`
- sync: `scripts/syncLandSale.ts` — 단, `syncRealEstateBase.ts` 공통 유틸은 그대로 재사용
- 타입 일관성: `frontend/types/realEstate.ts`의 `RealEstateType` enum과 백엔드 `RealEstateTypeSchema`에 `land` 슬러그만 추가(프론트 허브 카드·메타 매핑용). 쿼리 로직은 공유하지 않는다.

### 3.2 데이터 흐름

```
국토부 토지 매매 API (getRTMSDataSvcLandTrade)
  → syncLandSale.ts (fetchRealEstateData + parseXmlResponse 재사용)
  → transformLandItem() → batchUpsert (sourceId 중복방지)
  → LandAreaSummary 갱신 (동별 집계 + isIndexable 플래그)

프론트 페이지 (SSR) → useLand.ts ($fetch)
  → /api/real-estate/land/* → landService.ts (집계 쿼리, serialize)
  → JSON 응답
```

## 4. 경매 (이번 스펙 범위 밖 — 향후 과제)

조사 결과 **법원경매의 합법·무료·실시간 데이터 소스는 존재하지 않는다**:

- 원본은 courtauction.go.kr(대법원)에만 있고 **공개 OpenAPI 미제공**.
- data.go.kr "법원경매"는 대부분 통계/파일성 자료거나 민간 가공 활용사례. 물건 단위 실시간 피드 없음.
- 사법정보공유포털(openapi.scourt.go.kr) 연계 API는 **소송 제출/사건진행 조회용**이며 경매 물건 데이터 미제공 + 법원행정처 개별 승인 필요.
- 프로그램 접근 경로: (A) CODEF/쿠콘 **유료 API**, (B) courtauction.go.kr **스크래핑**(취약·유지보수·ToS 회색지대) 뿐.

→ 경매는 출처(유료 예산 또는 스크래핑) 결정 후 **별도 브레인스토밍/스펙**으로 진행.

## 5. 데이터 모델 (Prisma)

### 5.1 `LandSaleTransaction` (신규)

토지 매매 API 필드 매핑:

| 필드 | 타입 | 출처(API) | 비고 |
|---|---|---|---|
| `id` | autoincrement | — | PK |
| `sourceId` | String @unique | 생성 | 중복방지 키 |
| `city` | String | 시군구 파생 | 시·도 |
| `district` | String | 시군구 | 구·군 |
| `bjdCode` | String | 지역코드(5자) | 법정동 코드 |
| `dongName` | String | 법정동 | |
| `jibun` | String? | 지번 | |
| `jimok` | String | 지목 | 대/전/답/임야 등 |
| `landUse` | String? | 용도지역 | 제2종일반주거지역 등 |
| `dealArea` | Decimal | 거래면적 | ㎡ |
| `shareDeal` | Boolean | 구분 | 지분거래 여부 |
| `dealAmount` | BigInt | 거래금액 | 만원 |
| `dealType` | String? | 거래유형 | 중개/직거래 |
| `dealYear` | Int | 년 | |
| `dealMonth` | Int | 월 | |
| `dealDay` | Int | 일 | |
| `cancelDealType` | String? | 해제여부 | |
| `cancelDealDay` | String? | 해제사유발생일 | |
| `createdAt`/`updatedAt`/`syncedAt` | DateTime | — | |

인덱스: `(bjdCode, dealYear, dealMonth)`, `(city, district)`, `(jimok)`, `(landUse)`, `(bjdCode, dongName)`.

> 좌표(lat/lng)는 저장하지 않는다. 지도는 지역 중심 좌표(Region 테이블 재사용)로 처리한다.

### 5.2 `LandAreaSummary` (집계 캐시)

SSR 속도와 사이트맵 품질 게이트를 위한 동별 집계 캐시. sync 후 갱신.

| 필드 | 타입 | 비고 |
|---|---|---|
| `bjdCode` + `dongName` | @@unique | |
| `city` / `district` | String | 필터·목록용 |
| `transactionCount` | Int | 누적 거래건수 |
| `recentCount` | Int | 최근 1년 거래건수 (게이트용) |
| `avgPricePerPyeong` | Decimal? | 평당가 평균 |
| `latestDealDate` | DateTime? | 최신 거래일 |
| `jimokBreakdown` | Json | 지목별 건수 분포 |
| `isIndexable` | Boolean | 품질 게이트 결과 (6.1 규칙) |

인덱스: `(city, district, transactionCount)`, `(isIndexable)`.

추가 집계 컬럼(보강 데이터용): `avgPriceRatio`(동 평균 실거래/공시 배율), `landPriceChangeRate`(상위 시군구 최근 지가변동률 캐시).

### 5.3 `LandPriceOfficial` (개별공시지가 캐시)

필지별 공시지가를 연도 단위로 캐싱해 실거래/공시 배율을 계산한다.

| 필드 | 타입 | 비고 |
|---|---|---|
| `pnu` + `stdrYear` | @@unique | PNU(19자리) + 기준연도 |
| `bjdCode10` | String | 10자리 법정동 코드 |
| `jibun` | String | 본번-부번 |
| `pricePerSqm` | BigInt | 공시지가(원/㎡) |

- **PNU 구성**: `법정동코드(10) + 필지구분(1: 1=토지/2=산) + 본번(4 zero-pad) + 부번(4 zero-pad)`.
- 실거래 API는 5자리 시군구코드 + 법정동명 + 지번을 주므로, **행안부 표준지역코드(StanReginCd, 기보유)** 로 법정동명 → 10자리 코드 매핑 후 지번을 본번/부번으로 분해(산 여부 포함)해 PNU 생성.
- 거래연도(`dealYear`)에 해당하는 공시지가를 매칭해 **배율 = 실거래 ㎡당가 / 공시 ㎡당가** 산출. 거래 행에 `officialPricePerSqm`, `priceRatio`를 비정규화 저장(쿼리 단순화).

### 5.4 `LandPriceIndex` (지가변동률 캐시)

| 필드 | 타입 | 비고 |
|---|---|---|
| `sigunguCode` + `year` + `month` | @@unique | 시군구 단위 월별 |
| `monthlyRate` | Decimal | 월별 지가변동률(%) |
| `cumulativeRate` | Decimal | 누계 변동률(%) |

- 출처: 한국부동산원 부동산통계 조회(전국지가변동률조사). 시군구 단위라 동 페이지는 상위 시군구 값을 사용.

> **용도지역 해설**은 별도 API/모델 없이 정적 레퍼런스(`utils/landUseGuide.ts`)로 처리한다.

## 6. SEO / 색인 / 수익

### 6.1 품질 게이트 (핵심)

동 페이지를 무제한 색인하면 거래 0~2건짜리 thin page가 양산돼 도메인 전체가 강등되고 기존 부동산 색인까지 타격받는다. 따라서:

- **색인 조건**: `recentCount >= 5` **OR** `transactionCount >= 10` → `isIndexable = true`.
  - (임계치는 튜닝 가능한 상수로 둔다. 초기값 위와 같음.)
- **indexable 동 페이지**: `<meta name="robots" content="index,follow">` + 사이트맵 포함.
- **미달 동 페이지**: 렌더·내부링크는 유지(사용자 도달 가능) + `noindex,follow` + 구 페이지로 `canonical` + 사이트맵 제외.
- 시·도/구·군 페이지는 항상 색인(상위 집계라 항상 콘텐츠 충분).

### 6.2 콘텐츠 두께 (색인되는 페이지는 "두껍게")

동 상세 페이지 구성:
1. 평당가 요약(평당 주력 + ㎡당 병기, 최근 N개월 추이/변동률)
2. **지역 지가변동률** (한국부동산원 시군구 월별/누계 추세) — 신뢰 콘텐츠
3. 거래내역 표 (지번·지목·면적·평당가·**실거래/공시 배율**·거래일, 페이지네이션, 지분거래 표시)
4. **실거래가 vs 공시지가 배율** 요약 (동 평균 배율 — 토지 핵심 지표)
5. 평당가 시계열 차트
6. 지목별 분포 (대/전/답/임야 …)
7. 용도지역별 분포 + **용도지역 해설**(건폐율·용적률·가능 건축물 — 정적 레퍼런스)
8. 인근 동 평당가 비교
9. 지역 중심 지도 1개
10. 자동생성 설명/FAQ (`landMeta.ts` — 지역명·지목·평당가·배율 변수 주입으로 유니크 텍스트 확보)

### 6.3 사이트맵 & 내부링크

- 사이트맵: 허브·시도·구군은 항상, 동은 `isIndexable`만.
- 내부링크: 허브 → 시도 → 구군 → 동 cascade. 기존 부동산 허브(`/real-estate/index.vue`)에 토지 카드 추가.
- 구조화 데이터·메타·OG는 기존 부동산 패턴 재사용.

### 6.4 광고

기존 AdBanner 배치 정책 그대로 유지. 페이지당 광고 개수·위치를 임의로 축소·표준화하지 않는다(수익 정책은 사용자 결정 사항).

## 7. 백엔드 컴포넌트

### 7.1 `scripts/syncLandSale.ts`
- API: `getRTMSDataSvcLandTrade` (국토부 1613000).
- `syncRealEstateBase.ts`의 `fetchRealEstateData`, `parseXmlResponse`, `generateSourceId`, `getAllLawdCodes`, `batchUpsert` 재사용.
- `transformLandItem(raw)`: 문자열 파싱, BigInt/Decimal 변환, `shareDeal` 불리언화, `sourceId` 생성.
- 후처리: `LandAreaSummary` 재집계(동별 count/recentCount/avgPricePerPyeong/jimokBreakdown/isIndexable).
- 트랜잭션 안전성: 노트패드 좀비 인시던트 교훈대로 배치 트랜잭션 + statement timeout 적용, per-item 루프 회피.

### 7.1b 보강 데이터 sync
- `scripts/syncLandPriceOfficial.ts` — 개별공시지가정보 API. 거래된 (PNU, dealYear) 집합에 대해서만 조회(전수 X)해 호출량 최소화. `LandPriceOfficial` upsert 후 해당 거래 행의 `officialPricePerSqm`/`priceRatio` 갱신.
- `scripts/syncLandPriceIndex.ts` — **한국부동산원 R-ONE 부동산통계정보시스템**(`reb.or.kr/r-one/portal/openapi`) 직접 호출. (data.go.kr 15134761은 R-ONE 포털로 리다이렉트되며 인증키도 **R-ONE 전용 키**를 별도 발급받음 → env `REB_RONE_API_KEY`.) 통계코드 기반 범용 API이므로: ① 통계목록에서 지가변동률조사 통계코드(STATBL_ID) 확인 → ② 시군구·월 조건으로 데이터 조회 → `LandPriceIndex` upsert.
- `utils/landUseGuide.ts` — 용도지역 해설 정적 데이터(코드/매핑, sync 불필요).

### 7.2 `services/landService.ts`
- `getRegionList({ city?, district?, page, limit })`: `LandAreaSummary` 기반 동별 목록(평당가·건수·최신일), `transactionCount` 정렬.
- `getRegionDetail({ bjdCode, dongName, months?, page, limit })`: 거래내역(페이지네이션, 실거래/공시 배율 포함) + 평당가 시계열 + 지목 분포 + 용도지역 분포(+해설) + 동 평균 공시 배율 + 상위 시군구 지가변동률 + 인근 동 비교.
- `serializeRow()`: BigInt/Decimal → Number (기존 `realEstateService` 패턴).
- 평당가 계산: `dealAmount(만원) / (dealArea / 3.305)` → 평당 만원. ㎡당 = `dealAmount / dealArea`.

### 7.3 `schemas/land.ts` (Zod) + `routes/land.ts`
- 모든 핸들러 `asyncHandler` 래핑 + `validate(Schema, 'query')`.
- 엔드포인트:
  - `GET /api/real-estate/land/regions` — 동별 목록(시/구 필터)
  - `GET /api/real-estate/land/region` — 동 상세(bjdCode + dongName)
  - `GET /api/real-estate/land/hub-summary` — 허브 통계(전국/시도 요약)
- 에러: `NotFoundError`/`ValidationError` 클래스 throw.

## 8. 프론트엔드 컴포넌트

### 8.1 라우팅

Nuxt는 정적 세그먼트(`land/`)가 동적(`[realEstateType]/`)보다 우선하므로, `pages/real-estate/land/**`를 만들면 `land` prefix에서 기존 동적 라우트를 자연스럽게 오버라이드한다(충돌 없음).

| 경로 | 페이지 | 색인 |
|---|---|---|
| `/real-estate/land/` | 허브(소개·시도 목록·FAQ) | 항상 |
| `/real-estate/land/[city]/` | 시·도(구·군 목록 + 평당가) | 항상 |
| `/real-estate/land/[city]/[district]/` | 구·군 상세(동 목록 + 거래내역 + 시계열 + 분포 + 지도) | 항상 |
| `/real-estate/land/[city]/[district]/[dong]` | 동 상세(6.2 구성) | `isIndexable`만 |

### 8.2 기타
- `composables/useLand.ts`: `getRegions`, `getRegionDetail`, `getHubSummary` ($fetch + apiBase).
- `utils/landMeta.ts`: 지역별 자동 메타/타이틀/설명/FAQ 생성(유니크 콘텐츠 + SEO 카피).
- `types/land.ts`: `LandTransaction`, `LandRegionSummary`, 지목/용도지역 타입.
- SSR 가드: 브라우저 API 접근 시 `import.meta.client` 가드(기존 규칙).

## 9. 선행 조건

- **토지 매매 API 활용신청 완료** (2026-06-04 확인) — 본 기능 블로커 해소.
  - 데이터셋: `15126466` 국토교통부_토지 매매 실거래가 자료
  - 오퍼레이션: `getRTMSDataSvcLandTrade` (REST/XML/무료/실시간)
  - 요청 변수: `LAWD_CD`(법정동 5자리) + `DEAL_YMD`(계약년월 6자리) — 기존 6종과 동일 패턴
  - 같은 data.go.kr 계정이므로 기존 `OPENAPI_SERVICE_KEY`로 호출 가능(첫 호출로 키 적용 여부만 확인).
- 정확한 응답 XML 태그명은 "토지 매매 실거래가 조회 기술문서.hwp"로 확정(sync 구현 시).

**보강 데이터 — 활용신청 완료:**
- **개별공시지가속성조회** (V-World, 개별공시지가정보) ✅ 인증키 신청 완료 — XML/JSON, 단위면적당 가격 속성. **도메인 등록형 별도 키** → env `VWORLD_API_KEY`. 등록 도메인에 `ilsangkit.co.kr` + 로컬 개발용 포함 확인. (WMS/WFS/기본현황 오퍼레이션은 미사용.)
- **지가변동률 — 한국부동산원 R-ONE** (`reb.or.kr/r-one/portal/openapi`) ✅ 인증키 신청 완료. data.go.kr 15134761은 R-ONE 포털로 리다이렉트되어 **별도 R-ONE 전용 키**를 발급받음 → env `REB_RONE_API_KEY` (기존 `OPENAPI_SERVICE_KEY`와 다름).
- 용도지역 해설은 정적 데이터라 신청 불필요.
- 신청 승인 전에는 토지 본 기능(5.1/거래내역/평당가)만 먼저 구현하고, 보강 데이터(공시지가·지가변동률)는 키 적용 후 단계적으로 붙일 수 있도록 모듈을 분리 설계한다.

## 10. 테스트 전략 (TDD)

테스트 먼저 작성 후 구현(태스크 분리). 커밋 전 백엔드/프론트 `vitest run` 통과 필수.

- 백엔드 단위: `transformLandItem`(필드 파싱·shareDeal·sourceId), 평당가 계산, 지분거래 필터, `serializeRow`(BigInt/Decimal), 집계/게이트(`isIndexable`) 로직, Zod 스키마 검증.
- 보강 데이터 단위: **PNU 생성**(법정동명→10자리 매핑, 본번/부번 분해, 산 여부), **실거래/공시 배율 계산**, 지가변동률 시군구 매칭, `landUseGuide` 조회.
- 백엔드 통합: `routes/land.ts` 엔드포인트(정상/검증실패/404).
- 프론트: 페이지 컴포넌트(허브/시도/구군/동), `useLand` 컴포저블, `landMeta` 생성, 품질 게이트에 따른 robots/canonical 렌더. `tests/setup.ts` mock 패턴 사용.

## 11. 향후 확장 후보 (스펙 범위 밖)

국토부가 동일 형태로 제공하며, 본 토지 모듈 패턴을 재사용해 추가 가능:

- 단독/다가구 매매·전월세 (주거, 수요 중)
- 상업업무용 부동산 매매 (상가·사무실, 창업·투자 수요)
- 공장·창고 등 부동산 매매 (산업, 니치)
- 경매 (4절 — 출처 결정 선행)

추천 우선순위(수요·난이도 균형): 토지(본 스펙) > 단독/다가구 > 상업업무용 > 공장·창고.

## 12. 영향받는 파일 (요약)

**백엔드**
- `prisma/schema.prisma` — `LandSaleTransaction`, `LandAreaSummary`, `LandPriceOfficial`, `LandPriceIndex` 추가
- `src/scripts/syncLandSale.ts` (신규)
- `src/scripts/syncLandPriceOfficial.ts` (신규, 공시지가)
- `src/scripts/syncLandPriceIndex.ts` (신규, 지가변동률)
- `src/services/landService.ts` (신규)
- `src/utils/landUseGuide.ts` (신규, 용도지역 해설 정적)
- `src/schemas/land.ts` (신규)
- `src/routes/land.ts` (신규) + 라우터 마운트
- `src/schemas/realEstate.ts` — `RealEstateTypeSchema`에 `land` 추가

**프론트엔드**
- `pages/real-estate/land/index.vue` / `[city]/index.vue` / `[city]/[district]/index.vue` / `[city]/[district]/[dong].vue` (신규)
- `composables/useLand.ts` (신규)
- `utils/landMeta.ts` (신규)
- `types/land.ts` (신규), `types/realEstate.ts` — `land` 슬러그 추가
- `pages/real-estate/index.vue` — 토지 카드 추가
- 사이트맵 server route — 토지 URL(게이트 반영) 추가
