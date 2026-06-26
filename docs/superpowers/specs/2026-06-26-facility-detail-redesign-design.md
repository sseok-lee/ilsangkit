# 시설 상세페이지 UI 구조 재설계 — 설계 문서

- 날짜: 2026-06-26
- 범위: 15개 시설 카테고리(`toilet, trash, wifi, clothes, parking, aed, library, hospital, pharmacy, park, school, market, childcare, ev-charger, sports`) 상세페이지 **레이아웃 완전 재설계**, **모바일 + 데스크톱 모두**
- 비범위: 부동산·지하철·청약·공매·토지·공공임대 상세페이지(별도 이니셔티브), 사용자 리뷰/평점 시스템 신설, `trash` 상세페이지 신설
- 방향(승인됨): **A안 — 레코드 완전전개 + 컨텍스트 스파인**

---

## 1. 배경 & 문제 정의

사용자 인식: "시설 상세페이지가 카테고리별로 비어 보인다." 1차 가설은 "데이터 자체가 적다"였으나, 코드/스키마/생성기/경쟁사 4축 감사 결과 **가설이 부분적으로 틀렸다**:

**감사 근거(ground-truth):**
- 진짜 thin(의미 필드 ≤3)한 카테고리는 **`clothes`, `trash` 2개뿐.** `trash`는 좌표·상세페이지 자체가 없음(별도 `WasteSchedule`).
- 경계(≈6): `wifi, sports, aed, pharmacy`. (`aed`/`pharmacy`는 요일별 시간 매트릭스가 raw 컬럼 수만 부풀림 — 실제는 ~6~7 개념)
- **사실은 rich**: `toilet`(~18~30), `parking`(~16), `hospital`(~30 + departments[]), `childcare`(~20), `library`(~14), `ev-charger`(~16). medium: `school, market, park`.
- 즉 대부분 카테고리는 **데이터가 있는데 상세페이지가 일부만 렌더**(presentation gap). 예: `toilet`은 변기 수 매트릭스·비상벨/위치·CCTV·기저귀교환대/위치·장애인/아동 변기 수·정화방식·관리기관 등 풍부하나 화면엔 일부만.
- **더 나쁜 문제 = 슬롭 패딩.** 빈자리를 채우던 3종이 모두 카테고리 단위 고정 텍스트라 같은 카테고리 수천 페이지가 **바이트 단위 동일**:
  - `buildFacilityIntro` — `{name}은 {district}에 위치한 {category}입니다` mad-lib 1줄(정보 0).
  - `generateDynamicTips` — dynamic이 비면 정적 3~5줄(카테고리 전역 동일).
  - `generateDynamicFAQ` — dynamic 외 4~5개가 정적, **동일 FAQPage JSON-LD가 페이지마다 중복 방출**(대량 중복 스키마 = thin-content/doorway 리스크).
  - `heroStats`만 정직하게 비면 비움(슬롭 아님 — 유지).
- 경쟁사 `local.114-service.co.kr`(라이브 확인) 승리 레시피 = 정확히 반대: ① 엔티티 고유 title/desc ② provenance JSON-LD 스택 ③ **모든 공공필드 라벨-값 카드 전개('정보 없음' 정직표기)** ④ 주변 동종시설 집계(내부링크 메시) ⑤ 보이는 '데이터 출처 · 최종 업데이트 YYYY-MM-DD'.

**결론(재정의된 문제):** 진짜 레버는 "콘텐츠 제조"가 아니라 **(a) 이미 있는 진짜 필드를 전부 꺼내고, (b) 슬롭 패딩을 걷어내고, (c) 위치·지역 컨텍스트로 둘러싸기.** 이는 "슬롭 금지" 제약과 정확히 일치한다.

**목표(우선순위 = 균형):** 사용자 유용성 · SEO/색인 · 광고 수익을 균형. 단, 슬롭·가짜 콘텐츠로 채우는 것은 절대 금지.

---

## 2. 설계 원칙

1. **레코드 완전전개.** 카테고리의 모든 의미 공공필드를 그룹 라벨-값으로 노출. 빈 값은 `정보 없음`으로 정직 표기(필드셋이 정의된 rich/medium 한정 — 아래 4.2 규칙).
2. **degrade to empty, never to boilerplate.** 진짜 콘텐츠 임계를 못 넘는 섹션은 **렌더하지 않음.** 고정 보일러플레이트로 채우지 않는다.
3. **컨텍스트 스파인.** thin일수록 위치·인근·지역통계(전부 실데이터·내부링크)가 페이지를 지탱.
4. **단일 h1.** 렌더된 한 화면당 h1 하나(현재 모바일 `MobileDetailHeader` literal h1 / 데스크톱 `PageHero` `title-tag="div"` 패턴 유지).
5. **광고 슬롯 불변.** 페이지당 광고 개수·위치는 수익 정책 — 축소·표준화·이동 금지. **현 구현의 슬롯 개수·위치를 그대로 보존**(섹션 경계 배치). 사다리 표의 `[광고]`는 위치 예시이며, 정확한 개수·슬롯은 현 페이지에서 1:1 이관한다.
6. **SSR-first.** 색인 대상 본문은 서버 렌더. 현 영상/블로그는 client-only-on-intersection이라 크롤 가치 0 → SEO 무게로 의존 금지. 브라우저 API는 `import.meta.client` 가드(hydration mismatch 방지).
7. **light-only 실용 미니멀리즘.** 코발트 `#2450DC` 강조 + 중성색. 그라데이션/글래스/네온으로 thin을 가리지 않음.
8. **실시간 상태는 `ev-charger` 전용.** 타 카테고리에 "실시간 운영상태"를 발명하지 않음(정적 `operatingHours` 문자열만).
9. **외부 블로그를 사용자 리뷰로 오라벨 금지.** Naver 블로그는 제3자 콘텐츠로 명시.

---

## 3. 새 페이지 골격 (섹션 사다리)

의미 순서는 모바일·데스크톱 **동일**, 렌더링만 다름.

| 단 | 섹션 | 핵심 내용 | 변화 |
|----|------|----------|------|
| T0 | **헤더** | h1(이름) · eyebrow(카테고리) · 상태칩(영업중/24h, 데이터 있을때) · 핵심 stat칩 ≤4 · 액션[전화·주소복사·공유·길찾기] | 헤더 stat칩이 "구별 사실" 담당 |
| — | ~~핵심요약 1줄~~ | **삭제** | 헤더 칩과 중복 + thin서 슬롭 회귀 → 폐기 |
| | [광고] | rectangle | 보존 |
| T1 | **★ 스펙 그리드** | 모든 공공필드 → 카테고리별 그룹 라벨-값 카드. 빈값 `정보 없음`. 자유텍스트(비고·취급품목·시설목록)도 여기 | **신규 핵심.** 기존 `DetailBasicInfo`+`DetailFacilityStatus` 대체 |
| | [광고] | compact | 보존 |
| T2 | **위치 · 길찾기** | 지도 + 로드뷰 + 가는 법(지하철/버스 거리) + 가까운 동종시설 N개 | 격상(교통·대안 1급화) |
| | [광고] | compact | 보존 |
| T3 | **지역 컨텍스트** | 이 구 동종시설 N곳 · 비교통계("N곳 중 M곳이 24h") · 인근 자치구 메시 | 격상 |
| T4 | **관련 탐색** | 교차카테고리 주변시설 · 관련 카테고리 pills · 가이드(있을때만) | 유지(정리) |
| T5 | (조건부) **영상·블로그** | gated. 가능하면 SSR화. 블로그=Naver 명시 | 라벨 정정 |
| | [광고] | compact | 보존 |
| T6 | **FAQ** | facility-specific Q&A만. 없으면 섹션·FAQPage JSON-LD 둘 다 생략 | 고정 FAQ/팁 폐기 |
| T7 | **데이터 출처 · 최종 업데이트** | 보이는 provenance + freshness(`syncedAt`/`SyncHistory`). Dataset/WebPage JSON-LD 미러 | 신규(가시화) |

**데스크톱 차이:**
- 우측 **sticky 사이드바**(현 패턴 유지): 큰 정사각 지도 + 액션 카드(공유·길찾기 카카오/네이버) + 사이드바 광고 + 쿠팡 배너.
- 본문 T2 "위치·길찾기"는 큰 지도 **중복 제거** → 로드뷰 + 교통 + 가까운 대안만.
- T1 스펙 그리드는 폭 활용 **2열**(변기 표 등 넓은 블록은 전체폭 span).
- 헤더에 데스크톱 hero stat 4칸.

---

## 4. 컴포넌트 상세

### 4.1 헤더 (재사용)
- 모바일 `components/common/MobileDetailHeader.vue`(literal h1), 데스크톱 `components/common/PageHero.vue`(`title-tag="div"`). 기존 컴포넌트 유지.
- stat칩 = `buildHeroStats`(실데이터, 없으면 빈 배열 — 정직). 슬롭 산문 인트로는 PageHero `description` 슬롯에서 제거.

### 4.2 ★ 스펙 그리드 (신규 핵심 컴포넌트)
새 컴포넌트(가칭 `components/facility/detail/DetailSpecGrid.vue`)가 `DetailBasicInfo` + `DetailFacilityStatus`를 대체.

**구동 방식 — 카테고리별 필드 그룹 레지스트리.** 프론트에 `category → fieldGroups[]` 설정을 둔다(가칭 `utils/facilitySpecGroups.ts`). 각 group = `{ heading, render: 'kv' | 'table', fields: [{ key, label, format?, kind? }] }`. 값 출처는 detail 응답의 `details{}`(이미 `CATEGORY_REGISTRY.detailFields` 전체 제공).

**표기 규칙:**
- `kind:'flag'`(boolean) → 값이 true일 때 `설치됨`/`있음`(+ 위치 필드 결합 예: 비상벨 "남·여 화장실"), false/undefined → 해당 행 **생략**(불리언 부재를 '정보 없음'으로 떠벌리지 않음).
- `kind:'value'`(텍스트/숫자) → 값 있으면 표기, 빈 값이면 **`정보 없음`**(rich/medium의 핵심 필드에 한함 — 페이지를 정직하게 채움).
- `render:'table'` → 수치 매트릭스(예: 화장실 변기 현황 남/여 × 대/소/장애인/아동)를 표로.
- 자유텍스트 필드(공원 시설목록, 시장 취급품목, 화장실/주차장 비고 등)는 별도 group의 긴 텍스트 row로.

**rich vs thin 처리(동일 컴포넌트, 데이터로 분기):**
- rich/medium: 정의된 그룹 전체 렌더, 빈 핵심필드는 `정보 없음`.
- thin(`clothes`): 토대 필드셋이 작으므로 **있는 만큼만**(설치위치·관리기관·연락처·운영기관·자료기준일 등 4~5행). **강제 `정보 없음` 행을 만들지 않음.**

**카테고리별 그룹 정의(대표 예시 — 나머지는 동일 패턴으로 `detailFields`에서 도출):**
- `toilet`: ① 변기 현황(table: 남/여 × 대변기·소변기·장애인·어린이대·어린이소) ② 안전·편의(flag: CCTV, 비상벨+위치, 기저귀교환대+위치, 장애인화장실) ③ 운영·관리(개방형태·소유구분·정화방식·설치/개보수·관리기관·연락처·운영시간).
- `parking`: ① 요금(table/kv: 기본요금·기준시간·추가요금·일일최대·월정기) ② 운영(운영시간·운영요일·결제수단) ③ 구조·구분(주차장종류·구획·총면수·장애인주차) ④ 비고(자유텍스트).
- `hospital`: ① 진료시간(요일 매트릭스→표) ② 병상(일반/중환자/응급/분만/격리/멸균 등 inventory 표) ③ 의료진(총·전문/일반/인턴/레지던트/간호) ④ 진료과(departments[] 칩) ⑤ 운영(종별·설립구분·주차·홈페이지·연락처).
- `library`: ① 운영시간(평일/토/공휴) ② 장서(도서·연속간행물·비도서·대출가능권수/일수) ③ 좌석·규모 ④ 운영기관·연락처·홈페이지.
- `childcare`: ① 정원/현원 ② 연령별 학급/원아(표) ③ 교직원(역할별) ④ 시설(보육실수/면적·놀이터·CCTV·통학차량) ⑤ 운영(유형·인가일·대표자·연락처·홈페이지·특이사항).
- `ev-charger`(station 단위): ① 충전기(타입·출력·방식·전력타입, 커넥터별) ② **실시간 상태(`ev-charger` 전용)** ③ 운영(운영기관·연락처·이용시간·주차무료·이용제한) ④ 위치 상세(층·제조사).
- `wifi`(경계): SSID·설치위치(+상세)·서비스제공자·관리기관·연락처.
- `clothes`(thin): 설치위치·관리기관·연락처·운영기관·자료기준일. (강제행 없음)
- 나머지(`aed, pharmacy, park, school, market, sports`): 각 `detailFields`에서 동일 규칙으로 그룹 도출. 요일 시간 매트릭스(aed/pharmacy)는 "운영시간" 단일 표로 축약.

### 4.3 위치 · 길찾기
- 지도(`FacilityMap`) + 로드뷰(`FacilityRoadview`) — 모바일 인라인 220px / 데스크톱은 사이드바 큰 지도 + 본문 로드뷰.
- **가는 법(교통):** 가까운 지하철역 + 실거리 — 기존 `GET /api/transit/nearby?lat&lng&radius`(실 `SubwayStation` DB). 도보 환산은 가까울 때만 "도보 N분", 멀면 거리만(정직).
- **가까운 동종시설 N개:** 기존 same-category 검색(`POST /api/facilities/search` lat/lng/radius+category, Haversine). 각 항목 자체 URL → 내부링크.
- **좌표 없는 시설**(예외): 지도·교통·인근 생략, 주소·상세위치만. (전국 `clothes` 87%는 좌표 보유; 무좌표는 floor 케이스)

### 4.4 지역 컨텍스트
- 기존 `GET /api/area/:city/:district/:category/summary`: 총 수, 30일 순증, `lastSyncedAt`, 비교 highlights(%), 인근 자치구(`nearbyDistricts`, **0건 제외** 필터).
- **비교통계 framing**은 실집계 사실만("강동구 화장실 167곳 중 장애인 101곳(60%)"). 산문 부풀림 금지.
- highlights 정의는 현재 6개(`toilet/parking/pharmacy/library/aed/childcare`)만 존재. **실 구별 컬럼이 있는 카테고리에 한해서만** 확장(예: `school` 설립구분, `market` 주차/화장실 보유). `wifi/clothes`처럼 구별 컬럼이 없으면 count-only(슬롭 금지).

### 4.5 관련 탐색
- 교차카테고리 주변시설(`GET /api/facilities/:cat/:id/nearby`, `CROSS_CATEGORY_MAP`, hide-when-empty) + 관련 카테고리 pills(`CATEGORY_META`) + 지역 부동산 시세 링크(구 단위) + 가이드(`/api/guides?category=`, **카테고리별 실제 건수 확인 후, 0이면 생략**).

### 4.6 (조건부) 영상·블로그
- gated 유지(영상 ≥2, 블로그 ≥3, 미달 시 섹션 생략). **블로그 라벨을 "리뷰"가 아닌 "관련 블로그(Naver)"로 정정.**
- (과제) 현재 client-only-on-intersection → 가능하면 SSR/하이드레이션으로 본문 크롤 가치 확보. 본 재설계 필수는 아니며 SEO 무게로 의존하지 않음(원칙 6).

### 4.7 FAQ
- **facility-specific Q&A만** `generateDynamicFAQ`의 dynamic 부분에서 생성(실 필드 기반). 정적 fill·고정 팁 폐기.
- dynamic Q&A가 0이면 **FAQ 섹션과 FAQPage JSON-LD 둘 다 생략**(중복 스키마 제거).

### 4.8 데이터 출처 · 최종 업데이트
- 가시 라인: "데이터 출처 · 최종 업데이트 YYYY년 M월 D일" + 제공기관 + 실제 운영상태 상이 가능 고지. `syncedAt`/`SyncHistory.completedAt` 사용.
- JSON-LD 미러: Dataset/WebPage provenance(`isBasedOn` 공공데이터 URL, `sourceOrganization`, `dateModified`, KOGL license). 이전 감사 갭(Dataset 0/10, freshness 2/10) 해소. 기존 `resolveDataSource`/`DataSourceSection` 재사용.

---

## 5. 슬롭 제거 목록 (구체)

| 대상 | 파일 | 조치 |
|------|------|------|
| 산문 인트로 1줄 | `composables/useFacilityMeta.ts` `buildFacilityIntro` | PageHero description에서 제거(메타 description은 유지 가능) |
| 고정 팁 5 | `utils/dynamicTips.ts` + `utils/categoryDescriptions.ts` `CATEGORY_TIPS` | 정적 fallback 폐기. dynamic(실필드)만, 없으면 섹션 생략 |
| 고정 FAQ + 중복 JSON-LD | `utils/dynamicFAQ.ts` + `utils/categoryFAQ.ts` | 정적 fill 폐기. dynamic만, 0이면 섹션+스키마 생략 |
| viewCount 온페이지 | detail 응답 | 페이지 노출 금지(내부 정렬 키로만) |

---

## 6. 데이터 / 엔드포인트

**전부 기존 엔드포인트로 충족(신규 백엔드 최소):**
- detail(`/api/facilities/:cat/:id`), same-category(`/api/facilities/search`), cross(`/api/facilities/:cat/:id/nearby`), 교통(`/api/transit/nearby`), 지역(`/api/area/.../summary`), 가이드(`/api/guides`), 영상/블로그(기존).

**선택적 신규(필요 시 별도 작업으로 분리):**
- 일부 카테고리 area `highlights` 정의 확장(실 구별 컬럼 보유한 것만).
- per-facility 비교통계 경량 endpoint("이 시설은 구내 24h N곳 중 하나").

---

## 7. 제약 & 불변식 (회귀 방지)

- 단일 h1(렌더 화면당 1개). 광고 슬롯 수·위치 보존(현 구현 기준 1:1 이관, 임의 변경 금지). SSR-first + `import.meta.client` 가드.
- **Tailwind order 함정:** 임의값 `order-[13+]` JIT 미생성 → `order-1`~`order-12`만 사용(과거 PR #429 회귀).
- **멀티루트 컴포넌트 함정:** `DataSourceSection.vue` 등 멀티루트는 class fall-through 버림 → 레이아웃 클래스는 wrapper div로.
- 모바일 지도/로드뷰 220px(`utils/mapMedia.ts`/`mapMedia` 상수). nuxt.config 머티리얼 심볼 서브셋 알파벳 정렬 + 변경 시 `.nuxt`/`.output` 삭제.
- 직접 mount 테스트 컴포넌트는 `ref/watch` 명시 import(auto-import 의존 시 CI ReferenceError).

---

## 8. 구조화 데이터

- `FacilitySchema`(name/address/geo/phone/hours), `BreadcrumbList`, `VideoList`(영상 ≥2일 때), `FAQPage`(**facility-specific dynamic이 있을 때만**), **Dataset/WebPage provenance**(provenance+freshness 갭 해소).

---

## 9. 비범위 (YAGNI)

- 사용자 리뷰/평점 시스템(데이터·모델·라우트 없음 → 발명 금지).
- 실시간 상태 일반화(`ev-charger` 외 금지).
- `trash` 상세페이지 신설(별도).
- 부동산/지하철/청약/공매/토지/공공임대 상세(이번 범위 아님 — 단, 동일 원칙 후속 적용 가능).

---

## 10. 롤아웃 (구현 계획 입력)

권장 단계(실제 분할은 구현 플랜에서 확정):
1. **프레임워크:** `DetailSpecGrid` + `facilitySpecGroups` 레지스트리 + 골격 재배치(헤더→스펙→위치→지역→관련→FAQ→출처) + 슬롭 제거 + provenance 가시화. exemplar 카테고리(`toilet` rich, `clothes` thin)로 검증.
2. **나머지 카테고리 그룹 정의** 채우기(13종) + 카테고리별 가드 테스트(단일 h1·광고 개수·order≤12·FAQ 0시 스키마 부재).
3. (선택) area highlights 확장 / 영상·블로그 SSR화.

PR 기반 워크플로우(develop 대상, CI 통과 후 머지). 운영 반영은 main 승격 시. 커밋 전 backend/frontend `vitest run`.

## 11. 성공 지표

- thin/경계 카테고리(`clothes, wifi, sports, aed, pharmacy`) 코어 색인률 추이(8~12주).
- 중복 `FAQPage` 스키마 방출 제거(고유 FAQ 페이지 비율).
- 페이지당 고유(facility-unique) 콘텐츠 비중 상승, 카테고리 전역 동일 텍스트 제거.
- 스크롤 깊이·광고 노출 유지/개선(슬롯 불변 전제).
