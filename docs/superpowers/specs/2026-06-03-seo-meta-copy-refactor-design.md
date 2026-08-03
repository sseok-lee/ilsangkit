# SEO 메타태그 · 화면 카피 · 용어 통일 리팩터 설계

- 작성일: 2026-06-03
- 대상: `frontend/` (Nuxt 3 SSR)
- 상태: 설계 확정, 구현 계획 대기

## 1. 배경 / 문제

전 페이지 메타태그 + 화면 카피를 감사한 결과, **로직은 잘 만들어져 있는데 페이지들이 그걸 안 쓰고 각자 손으로 짜면서 제각각 표류(drift)** 한 상태가 근본 원인으로 확인됨.

### 1.1 메타 카피 문제
- **좋은 카피가 죽은 코드**: `CATEGORY_SEO_TITLE` / `CATEGORY_SEO_DESCRIPTION`(키워드 완성형, `seoConstants.ts`)을 쓰는 `setCategoryMeta()`가 **테스트에서만 호출**되고 프로덕션 `<head>`에 닿지 않음. 라이브 카테고리 페이지는 페이지 내부의 빈약한 `buildCategorySeoTitle/Description`을 사용.
- **카테고리 카피 3벌 공존**: ① `CATEGORY_SEO_*`(완성형, 죽음) ② `buildCategorySeo*`(빈약, 실제 head) ③ `SEO_TITLES`/`SEO_DESCRIPTIONS`(CTR형, 화면 h1 전용). 가장 빈약한 ②만 검색엔진에 노출됨.
- **brand 누락**: 부동산 건물 상세(`buildRealEstateDetailMeta`)는 `| 일상킷` 미부착 — 최고가치 페이지에 브랜드 없음.
- **30자 초과 잘림**: 부동산/청약/공공임대공고/쓰레기/가이드 상세 — 이름+위치+상태+intent 꼬리표를 다 붙여 SERP에서 잘림.
- **빈약 description**: 정적 페이지(~20자), 카테고리/지역(~28자). 데이터 나열형(`A · B · C`), 반복(`정보…정보를`).
- **부동산 차별점 매몰**: 주변 생활시설(학교 N곳·병원 N곳)이 description 데이터엔 있으나 **문장 맨 뒤라 SERP에서 잘려 안 보임**.
- **불일치**: 구분자(`|` vs `-`), 도시명(`서울` vs `서울특별시`), about 더블브랜드(`일상킷 소개 | 일상킷`), 키워드 스터핑(`임대`×3).

### 1.2 화면 카피 / 용어 문제
- **빈 상태/로딩/에러 메시지 난립**: "결과 없음" 8+ 변형, 마침표 랜덤, `로딩 중...` vs `불러오는 중…` 약 50:50.
- **용어 스왑**: `/[city]`·`/[city]/[district]` H1만 "생활 정보", 나머지 사이트는 "생활시설".
- **인근 vs 주변 혼용**: `DetailNearby.vue`는 제목 "주변" / 부제 "인근 시설입니다"(한 컴포넌트 내 충돌).
- **CTA 띄어쓰기**: `전체 보기` vs `전체보기` vs `더보기` 혼재.
- **브레드크럼 라벨 표류**: `/subscription` → `청약`/`청약·임대`/`청약홈`/`청약 정보` 4가지. 부동산 → `부동산 실거래가` vs `부동산`.
- **제목 복합명사 띄어쓰기**: `기본정보`/`시설현황`(붙임) vs `역 정보`/`생활시설 현황`(띄움).
- **관련 네비 제목 4종**, `모집 공고` vs `모집공고`, `최고/최저 거래가` vs `최근 매매가`.
- **브랜드 부제 2종**: 타이틀 템플릿 `일상킷 - 내 주변 생활 편의 정보` vs 푸터 태그라인 `생활 속 필요한 공공시설 정보와 부동산 실거래가를 한 곳에서.`

## 2. 목표 / 비목표

### 목표
1. 메타 카피를 단일 소스화하고 품질 개선(키워드 완성형 head + 산문 desc + 30자 title).
2. raw `useHead` 페이지를 공통 게이트(`setMeta()` 계열)로 흡수 → 브랜드·구분자·canonical·og·twitter·locale 자동 통일 (네이버 og 누락도 동시 해결).
3. 화면 카피/메뉴/메시지 용어를 통일 규칙 아래 정리.
4. 변경 전부 기존/신규 테스트로 검증(TDD).

### 비목표 (별도 후속 — 본 spec 범위 밖)
- noindex/canonical/사이트맵 정합성 수정(부동산 구 허브 noindex-in-sitemap, 지하철 noindex 주석, 트레일링 슬래시 canonical, noindex+canonical 정책 통일·문서화).
- JSON-LD 스키마 보강(Article `publisher.logo`/`image`, Event/Article 날짜 ISO-8601, 비표준 타입 `ParkingFacility`/`RecyclingCenter`, RealEstateListing `offers` 의미, Organization `sameAs`).
- 단, 위 항목은 `## 8. 후속 과제`에 보존.
- 실제 "학군 배정" 데이터 수집/연동(현재는 반경 1km 학교 개수만 보유 → "인근 학교 N곳"으로 정직 표기).

## 3. 통일 규칙

### 3.1 메타 규칙
| ID | 규칙 |
|---|---|
| R1 브랜드 | 모든 `<head>` title 끝에 ` \| 일상킷` 단 1회. `-` 금지, 더블브랜드 금지. **헬퍼 한 곳에서만** 부착 |
| R2 도시명 | 어디서나 압축형(`서울`). `compactCityName()`/`shortCityName()` 일괄 적용. `서울특별시` 표기 박멸 |
| R3 title 길이 | **상세 페이지**: 핵심 명사구 + 브랜드 ≤ ~30자(한글) 하드캡, 키워드 나열은 description으로. **목록/카테고리 페이지**: "키워드 앞배치(front-load)" 원칙 — 핵심 키워드를 맨 앞에 두어 잘려도 우아하게 잘리도록. 30자 근접 목표하되 초과 허용 |
| R4 상세 title | `{고유명} {핵심} \| 일상킷`만. 위치·상태·intent 꼬리표는 description으로. 30자 초과 시 부가어구 자동 생략(길이 가드) |
| R5 desc | 50~80자 산문체 + 행동유도. `A · B · C` 나열/`정보…정보를` 반복 금지 |
| R6 카테고리 head/h1 분리 | head title=`CATEGORY_SEO_TITLE` **부활하되 군더더기 "지도에서" 제거**(예: `병원 찾기 - 근처 병원 진료과·진료시간을 지도에서 확인` → `병원 찾기 - 근처 병원 진료과·진료시간 확인`). 키워드 앞배치(R3) 적용. head desc=`CATEGORY_SEO_DESCRIPTION` 부활. h1=CTR형(`SEO_TITLES` 유지). 빈약한 `buildCategorySeo*` 삭제 |

### 3.2 용어 사전
| 개념 | 표준 | 비고 |
|---|---|---|
| 주변에 있는 일상시설(건물/단지 기준) | **주변 생활시설** | 섹션 제목과 통일. 위치(주변)+성격(생활시설) |
| 제품 카테고리로서의 시설 | **생활시설** | 네비/홈/카테고리 eyebrow. "주변" 강제 안 함 |
| 근접성 표현(제목/라벨층) | **주변** | `인근`/`근처`를 라벨·제목에서 "주변"으로. 단, 카테고리 설명 본문의 "내 주변"은 유지 |
| 부동산 데이터셋 | **실거래가** | (유지) |
| 가격 추이/추정 | **시세** | (유지) |
| 거래유형별 가격 | **매매가/전세가/월세가** | 건물 상세 요약블록 통일(`최고/최저 거래가` ↔ `최근 매매가` 정리) |
| 청약 우산 / 매수 / 임차 / LH공고 | **청약 / 분양 / 임대 / 모집공고** | (유지) `모집 공고`→`모집공고` |

지역 허브 페이지(`/[city]`, `/[city]/[district]`) H1은 **`{지역} 생활 정보` 유지**(확정). 이 페이지는 부동산 시세 + 생활시설을 함께 보여주는 허브라 "생활 정보"가 더 정확 — "생활시설"로 바꾸지 않음. (나머지 네비/홈/카테고리 eyebrow는 "생활시설" 유지.)

### 3.3 메시지 사전 (신규 `utils/uiMessages.ts`)
고정 상수로 통일, **마침표 없음**:
- 빈 상태(검색): `검색 결과가 없습니다`
- 빈 상태(필터 목록): `조건에 맞는 {대상}이 없습니다` (대상=청약/매물/가이드/단지/시설 등)
- 로딩: `불러오는 중…`
- 에러(fetch 실패): `데이터를 불러오는 중 오류가 발생했습니다`
- 404 본문: `요청한 정보를 찾을 수 없습니다`

### 3.4 띄어쓰기 / 구분자
- **복합명사 붙임 우선**: `전체보기`·`더보기`·`기본정보`·`시설현황`·`역정보`·`생활시설현황`.
- 화면 구분자: 메타 title 끝 브랜드=`|`(R1), 브레드크럼=`/`, 라벨 내 병렬=`·`(붙임).
- 브랜드 부제: 단일 `SITE_TAGLINE = '부동산 실거래가·청약·내 주변 생활정보'`(확정)로 통일. 타이틀 폴백(`일상킷 - {SITE_TAGLINE}`)·푸터 태그라인 양쪽이 공유. 주트래픽인 부동산을 앞세움 + 홈 title과 정렬. 단, "제목 끝 브랜드 suffix"(R1, `… | 일상킷`)와 "브랜드-부제 폴백 타이틀"은 서로 다른 구문 — 후자의 `-`는 R1과 무관하며 허용.

## 4. 카피 매핑 (before → after 요약)

전체 페이지 타입별 before→after는 대화 로그/부록 기준. 대표:

- **카테고리 head**: `병원 | 진료과·진료시간 | 일상킷` → `병원 찾기 - 근처 병원 진료과·진료시간 확인 | 일상킷`(완성형, "지도에서" 제거, 키워드 앞배치) + desc는 `CATEGORY_SEO_DESCRIPTION` 부활. h1은 `지금 문 연 병원 찾기 · 야간·주말 진료 실시간`(Set C) 유지. 기본 명사가 긴 카테고리(지하철역·전기차충전소·자동심장충격기·공공체육시설)는 30자 초과하나 키워드 앞배치로 우아하게 잘림.
- **시설 상세**: `서울대학교병원 | 서울 병원 진료과·진료시간 | 일상킷`(32자) → `서울대학교병원 | 서울 종로구 병원 | 일상킷`(~24자). desc 산문화. 긴 이름은 `{지역}{카테고리}` 자동 생략. 이름에 카테고리 포함 시(`~주차장`/`~도서관`) 중복 생략.
- **부동산 건물 상세**: `래미안대치팰리스 아파트 매매 실거래 · 서울 강남구`(브랜드X, 31자) → `래미안대치팰리스 매매 실거래가 | 일상킷`(~22자). 아파트는 "아파트" 생략, 빌라/오피스텔 유지(긴 이름은 가드로 생략).
- **부동산 desc 재배치**(아래 §5).
- **청약 임대**: `임대 청약 일정 - 공공임대·LH 임대 청약 정보 | 일상킷` → `임대 청약 일정 | 일상킷`(키워드는 desc로).
- **정적**: about `일상킷 소개 | 일상킷` → `서비스 소개 | 일상킷`. terms/privacy desc 보강.

## 5. 부동산 description 재배치 (핵심)

현재 `useRealEstateDetailMeta.ts:buildDescription()`는 `[opening][priceSentence][closing]` 순으로, 주변 생활시설을 **맨 뒤(closing)** 에 붙여 SERP에서 잘림.

변경:
- 순서 재배치: `{지역} {건물명} {타입} {거래} 실거래 N건, 최근 {가격}({날짜}). 주변 학교 N곳·병원 N곳 등 주변 생활시설과 전용 {면적} 면적별 시세를 함께 확인하세요.`
- 중간 압축: 준공년도·"거래 내역" 문구 제거로 길이 확보.
- 가격 분기: 매매=거래가 / 전세=보증금 / 월세=보증금+월세.
- 용어: `인근 … 생활시설` → `주변 … 주변 생활시설`(§3.2).

`[buildingName].vue` SSR `facilitySummarySSR` 생성부:
- `DISPLAY_CATS` 우선순위를 부동산 맥락에 맞게 재정렬: `school → hospital → park → childcare → sports → pharmacy` (현재 `school, childcare, park, sports, hospital, pharmacy`에서 병원이 잘려나가는 문제 해결).
- 표기 `학교 N곳` 유지(정직). `slice(0, 3)` 유지하되 우선순위 변경으로 학교·병원이 우선 노출.

## 6. 구조 변경

### 6.1 메타 단일 소스화
- `setCategoryMeta()`를 `pages/[category]/index.vue`에 **실제 연결**(head). 빈약한 `buildCategorySeoTitle/Description` 삭제. `SEO_TITLES`/`SEO_DESCRIPTIONS`는 h1 전용으로 주석 명시.
- `useFacilityMeta.test.ts`/`seoConstants.test.ts`(이미 Set A 검증)가 비로소 프로덕션과 일치.

### 6.2 raw useHead → setMeta 흡수
대상: `subway/index.vue`, `subway/[slug].vue`, `subscription/*`, `public-rental/*`, `real-estate/[type]/[city]/index.vue`·`[district]/index.vue`, `[city]/index.vue`, `[city]/[district]/index.vue`.
- 전부 `setMeta()`/`setRegionMeta()` 경유로 전환 → og:image/og:url/og:site_name/og:locale/twitter/canonical/브랜드/구분자 자동 통일.
- 부수효과로 1.x 감사의 og 누락(subway/index og:image 전무, subscription/[id] og:url 누락, 부동산 구 목록 site_name+locale 누락, 공공임대 공고 twitter 누락) 일괄 해소.

### 6.3 헬퍼 보강
- `useRealEstateDetailMeta.ts:buildTitle()`에 ` | 일상킷` 부착(R1) + 30자 길이 가드(R4) + 거래유형 키워드화.
- `setMeta()`에 길이 가드 옵션(상세 페이지 부가어구 자동 분리) + `og:image:alt` 추가(전 페이지 일괄 보강).
- 도시명 항상 `compactCityName()` 적용(R2).

### 6.4 화면 카피 단일 소스
- 신규 `utils/uiMessages.ts`: 빈상태/로딩/에러 사전(§3.3). 해당 문자열을 쓰는 컴포넌트/페이지를 상수 참조로 교체.
- `utils/seoConstants.ts`: `SITE_TAGLINE` 추가, 타이틀 템플릿(`app.vue`/`nuxt.config.ts`)·푸터(`AppFooter.vue`) 공유.
- 용어 치환: `인근`(라벨/제목층)→`주변`(`DetailNearby.vue` 부제 `인근 시설입니다`, `인근 공공임대 단지`, `인근 단지` 포함). 단 카테고리 설명 본문의 `내 주변`은 자연스러우므로 유지. `모집 공고`→`모집공고`. (지역 허브 H1 `생활 정보`는 유지 — §3.2.)
- 띄어쓰기 정리: `전체 보기`/`더 보기`→`전체보기`/`더보기`, 제목 복합명사 붙임(`기본정보`·`시설현황`·`역정보`·`생활시설현황`).
- 브레드크럼 단일화: `setBreadcrumbSchema`(name)와 `<Breadcrumb>`(label) 라벨을 한 소스에서 도출하도록 정리. `/subscription` 표준 라벨 = **`청약 정보`**(확정, 이미 schema name에 쓰이는 값). 부동산 하위 페이지도 `부동산 실거래가`로 통일(`부동산` 단독 표기 제거).
- 관련 네비 제목: `관련 탐색`(교차 카테고리 이동), `관련 정보`(가이드/에디토리얼)로 2종 정리. `이 지역 다른 카테고리`/`같은 지역 시설` 등 흡수.

## 7. 테스트 전략 (TDD)

- 카피는 먼저 테스트 갱신/추가 후 구현(프로젝트 TDD 선호).
- `seoConstants.test.ts`: `CATEGORY_SEO_TITLE`(30자 가드 포함)·`DESCRIPTION` 길이/키워드 검증 강화.
- `useFacilityMeta.test.ts`: `setCategoryMeta` 실제 연결 검증, `setMeta` 브랜드 1회/og:image:alt/30자 가드.
- 신규 `useRealEstateDetailMeta.test.ts`: 브랜드 부착, 30자 가드, 거래유형별 가격 분기, 주변 생활시설 앞배치.
- 신규 `uiMessages` 사용처 스냅샷/단위 테스트.
- 각 raw→setMeta 전환 페이지: og:url/canonical/twitter 존재 검증.
- backend/frontend `vitest run` 통과 + 기존 실패 테스트 즉시 수정(프로젝트 규약).

## 8. 후속 과제 (별도 spec/PR)
1. noindex/canonical/사이트맵 정합성: 부동산 구 허브 noindex-in-sitemap, 지하철 noindex 주석/실제 불일치, 지하철 목록 트레일링 슬래시 canonical, noindex+canonical 정책 단일화 + `noindex-canonical-policy.md` 복원.
2. JSON-LD: Article `publisher.logo`/`image` 필수화, Event/Article 날짜 ISO-8601 검증·변환, 비표준 타입(`ParkingFacility`/`RecyclingCenter`) 교정, RealEstateListing `offers`(평균가+InStock) 의미 재검토, Organization `sameAs`, library openingHours 정규화.
3. ~~학군 배정 데이터 수집/연동(진짜 "학군" 키워드용).~~ **결정(2026-06-03): 불필요.** 부동산 상세에 이미 `인근 학교 N곳`(school 1순위)·어린이집 실측 카운트가 노출됨. 학군(배정) 데이터는 별도 무거운 수집이 필요하고, 카운트만으로 "학군" 단어를 쓰면 과장이라 정직하게 "인근 학교"로 유지. "OO 학군" 검색 키워드 일부를 포기하는 트레이드오프는 수용.
4. apple-touch-icon 추가.

## 9. 작업 분할 (PR 단위 제안)
- PR1: 메타 단일 소스화 + 카테고리 head/h1 분리(§6.1) + 카피 개선(§4 시설/정적).
- PR2: 부동산 메타(브랜드/30자/desc 재배치/시설 우선순위)(§5, §6.3).
- PR3: raw useHead → setMeta 흡수(§6.2) — og 누락 일괄 해소.
- PR4: 화면 카피/용어/메시지 단일 소스(§6.4) + `uiMessages`/`SITE_TAGLINE`.

(각 PR은 main 직접 커밋 금지, CI 통과 후 머지 — 프로젝트 규약.)
