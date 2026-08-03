# 일상킷 전체 페이지 개선 감사 (Frontend Improvement Audit)

- **작성일:** 2026-06-02
- **범위:** `frontend/` 전체 페이지(36개) × 전 관점(UX/디자인·SEO/색인·성능·전환/수익·일관성)
- **방법:** 5개 영역(홈/검색/정적, 시설/지역, 부동산, 청약/공공임대/지하철, 전역 일관성) 병렬 읽기 전용 감사
- **상태:** 감사 완료 / 미실행 — 항목별로 spec → plan → 구현으로 진행 예정

> 핵심 결론: 개별 페이지의 치명적 버그보다 **"공통 패턴이 페이지마다 제각각 구현돼 생기는 일관성 붕괴"**가 가장 큰 문제. 좋은 공유 컴포넌트(`DataSourceCard`, schema.org 매핑, `Pagination`)는 이미 있으나 **호출 방식이 페이지마다 달라** 사용자가 체감하는 불일치가 발생.

---

## ① 데이터 출처 표기 불일치 (사용자 명시 요청 · 최우선)

공유 컴포넌트 `components/common/DataSourceCard.vue` + 단일 레지스트리 `utils/dataSource.ts`는 이미 존재. 문제는 호출 규칙 비표준.

| 페이지 유형 | 출처 | 기준일 | 동기화일 | 근거 / 비고 |
|---|---|---|---|---|
| 시설 목록 `[category]/index.vue` | ✅ | ✗ | ✗ | `:279-280` 기관명만 |
| 시설 상세 `[category]/[id].vue` | ✅ | ✅ | ✅ | `:193-202`, `DetailContextLinks.vue:82` 가장 충실 |
| 쓰레기 상세 `trash/[id].vue` | ✅ | ✅ | ✗ | `:179-182` 기준일만 |
| 부동산 단지 상세 `[buildingName].vue` | ⚠️ | ✗ | ✅ | `:393` **`v-if="lastSyncDate"` — 동기화일 없으면 출처 전체 사라짐** |
| 지역 페이지군 `[city]/`, `[district]/`, `[district]/[category]` | ❌ | — | — | grep 0건 — **색인 대상 실데이터인데 출처 전무** |
| 검색 / 가이드 상세 / 청약 sale·rent / 공고 | ❌ | — | — | dead-end |

**근본 원인**
1. **지역 페이지군 출처 0건** — 공공누리 출처표시 의무·신뢰감 손상. 푸터(`AppFooter.vue:65`) "데이터셋별 출처는 각 상세페이지 참조" 약속과 모순.
2. **`[buildingName].vue:393` `v-if="lastSyncDate"`** — 동기화일 없으면 출처 통째로 숨겨지는 버그성 동작.
3. **라벨 용어 혼용** — "데이터 정보"(`DataSourceCard.vue:5`) vs "데이터 출처"(페이지) vs "출처"(푸터). childcare만 본문에 기준일 중복(`DetailBasicInfo.vue:559-562`). KOGL 유형은 15개 전부 미기입(`dataSource.ts:21-22` "확인 후 채울 것" 미완).
4. **제공기관 3경로 표현** — (1)DataSourceCard (2)하드코딩 텍스트(`index.vue:217`) (3)인라인 키-값(`real-estate/index.vue:100`).

**제안:** 페이지 타입별(목록/상세/지역) DataSourceCard 호출을 표준화한 래퍼(`<FacilityDataSource :category :facility?>`) — ① 출처 무조건 노출(`v-if` 제거) ② 지역 페이지군 삽입 ③ dataDate/lastSyncDate 가능한 한 항상 전달 ④ 라벨 "데이터 출처"로 통일 ⑤ about 출처 테이블(`about.vue:104-273`)도 `dataSource.ts` 단일 소스화.

---

## ② SSR 누락 — 색인·체감속도 직격 (높음)

| 위치 | 문제 | 제안 |
|---|---|---|
| `guide/[slug].vue:102-108` | `RelatedGuides`가 `<ClientOnly>` — 가이드 내부링크가 SSR HTML에 없음 | `useAsyncData` SSR 패칭 |
| `PublicRentalListView.vue:128` | `onMounted` 클라 전용 — 공공임대 목록이 SSR에 없음(SubscriptionListView는 SSR) | `useAsyncData`로 통일 |
| `search.vue:88-394` | 결과 전체가 `isMounted` 가드 뒤 CSR-only — 항상 깜빡임 | 키워드 진입 시 SSR 프리페치 |
| `[category]/[id].vue:937-952` | 주변 시설이 클라 전용 watch — 색인 손실 + CLS | SSR allSettled 합류 |

---

## ③ 색인 품질 위험 (높음)

| 위치 | 문제 | 제안 |
|---|---|---|
| `announcements/[pblancId].vue:179` | composable이 에러를 삼켜(`useRentalAnnouncements.ts:66-69`) 없는/만료 공고가 200 OK로 색인 | `createError(404, fatal)` |
| `announcements/[pblancId].vue:214` | 마감(closed) 공고에 gone/noindex 전무 | `status==='closed'` → `noindex,follow` |
| `announcements/[pblancId].vue:222` | `useHead` 비반응형 — fallback 제목 굳음 | `useHead(() => ({...}))` 함수형 |
| `[district]/[category].vue:356-359` | noindex 판정이 클라 fetch 전 `[]` 시점이라 오작동 위험 | SSR 주입 `summary.count`로 판정 |
| `real-estate/[city]/index.vue` | 6타입 × 17시 = 102개 thin-content 허브가 항상 indexable | 요약 텍스트 또는 noindex |
| `composables/useRealEstateMeta.ts` | 미사용 죽은 코드 + 폐기된 2-segment canonical(`:21,:55`) → 재사용 시 색인 회귀 | 파일 삭제 |
| canonical 누락 | 홈 `index.vue`·`subway/[slug]`·`trash/[id]`·`faq`·about/terms/privacy/contact | `seoHelpers` 공통 헬퍼 |
| FAQPage JSON-LD 누락 | `real-estate/index.vue`, `[realEstateType]/index.vue`, `faq` 가시 FAQ에 미연결(빌더 `useStructuredData.ts:602` 존재) | `setFaqSchema` 호출 |
| 구조화데이터 누락 | `subway/index.vue`(목록), `announcements/index.vue`·`[pblancId].vue` ItemList/Breadcrumb 없음 | 스키마 추가 |
| `guide/index.vue:148-160` | 가이드 목록 ItemList/Blog 스키마 없음 | ItemList 추가 |
| `ComplexCard.vue:90-92` | legacy `?tab=&bjdCode=` 2-segment 폴백 URL 잔존 | 4-segment 강제 또는 미렌더 |
| canonical 생성 깊이 불일치 | type 허브(`[realEstateType]/index.vue:253`)만 문자열 직조, 나머지는 4-segment 유틸 | 유틸 통일 |

---

## ④ 카테고리 상세 렌더링 구조 — 일관성 붕괴 진원지 (높음)

CLAUDE.md는 카테고리별 `details/*Detail.vue`를 의도했으나, 실제로는 `details/`에 `EvChargerDetail.vue` 1개뿐. 나머지 14개는:
- `DetailBasicInfo.vue`(731줄, 14블록 `v-if`)
- `DetailFacilityStatus.vue`(813줄, 14블록 `v-if`)
- `[category]/[id].vue`의 `desktopHeroStats` 80줄 거대 switch(`:535-603`)

**드러난 불일치**
- **운영시간 3종**: hospital/aed는 요일별 표 + ★오늘 강조(`DetailBasicInfo.vue:344-378`), pharmacy는 같은 데이터인데 단순 행(`:607-637`, 빈약).
- **카드 스타일 2종**: school/market/childcare/sports는 회색 그리드 칩, 나머지 label-value 행.
- **"정보 없음" 정책 2종**: parking/library 항상 노출(과다), childcare/clothes 값 있는 것만.
- **heroStats else 폴백**: 신규 카테고리 누락 시 조용히 전화만 표시.

**제안:** 공통 프리미티브(label-value 행 / 요일별 표 / "정보없음" 정책 / 데이터기준일 위치) 위에 카테고리별 컴포넌트로 분해. **보존 대상: schema.org 타입 매핑(`useStructuredData.ts:113-131`), DataSourceCard** — 이미 충실.

---

## ⑤ UX · 전환 동선 (중간)

- **목록·지역 페이지 지도/정렬 부재** — `FacilityMap`이 상세에만(`[id].vue:33,97,214`). "내 주변 찾기" 동선이 목록에서 끊김. 정렬(가까운순/운영중/이름순) 없음.
- **깔때기 중간 단절** — `[city]/index.vue`에 카테고리 진입 링크 없음(구/군 그리드만), 부동산 city 허브에 단지 카드 없음(type→building 3홉 강제).
- **공유 EmptyState/LoadingSkeleton 부재** — 18개 페이지 ad hoc. 로딩 패턴 스피너·스켈레톤 4종 혼재.
- **지역 필터 3종** — subway만 cascading 구/군 드롭다운(`subway/index.vue:25-59`), 청약·공공임대는 자유 텍스트(오타·매칭 실패 위험).
- **차트/막대 접근성** — `RentRatioBar.vue:3-9` 0%일 때 라벨 깨짐 + `aria-label` 없음. `PriceTrendChart.vue` SSR 빈 영역(skeleton 없음).
- **헤더 3종** — PageHero / StaticPageHeader / PublicRentalDetailHeader h1 타이포 불일치. `faq.vue`만 StaticPageHeader 미사용(raw h1).

---

## ⑥ 위생 이슈 (낮음)

- 죽은 import/코드: `HomeMarketStats`(home), `ComplexCard`·`SearchFilters`(search), `subscription/[id].vue:456` 연결 안 된 `pending`, `public-rental/[type]/[id].vue:6-8` 도달 불가 에러 폴백.
- `category:'toilet'` 마커 하드코딩 핵: `subscription/[id].vue:475`, `PublicRentalDetailView.vue:104`.
- 용어 혼용: status 라벨("접수중/모집중/청약중/진행중"), breadcrumb 라벨("청약·임대"/"청약 정보"/"공공임대").
- `index.vue:388-398` quickFacilities 9개인데 grid `md:grid-cols-8` — 9번째 외톨이 줄바꿈.
- `AdBanner.vue:138` 라우트 변경마다 재요청 — 검색 쿼리 변경 시 과호출 점검.
- `StaticPageHeader.vue:11` 이모지 📅 → material-symbols로 교체(브랜드 정합).

> 주: 광고 배치 관련 항목은 모두 **축소 제안이 아니라 배치 불일치 인지 차원**. 광고 개수/위치는 사용자 결정 사항(메모리 `feedback_adbanner_placement`).

---

## 📋 추천 실행 순서 (Top 7)

1. **데이터 출처 표준화** — 지역 페이지 삽입 + `[buildingName].vue:393` `v-if` 제거 + 래퍼 통일 *(요청 항목)*
2. **announcements 404/410 + 마감 noindex** — 색인 오염 즉시 차단
3. **SSR 누락 4곳 복구** — RelatedGuides · 공공임대목록 · 검색 · 주변시설
4. **부동산 thin-content 방어 + 죽은 `useRealEstateMeta.ts` 삭제** — 색인 회귀 방어
5. **카테고리 상세 렌더링 리팩터** — 일관성 진원지 해소
6. **공유 EmptyState/LoadingSkeleton + canonical 헬퍼 추출**
7. **목록·지역 지도/정렬 + 깔때기 내부링크 보강**

---

## 강점 (회귀 시 보존할 것)

- schema.org 카테고리별 타입 매핑(geo·PostalAddress·OpeningHours 포함) — 충실.
- `page≥2` noindex+canonical 제거 정책 — 일관 적용(`[category]/index.vue:576` 등).
- `useApiBase`가 internalApiBase 루프백으로 SSR 자기-도메인 색인 회귀 방어 — 유지.
- `Pagination` 공유 컴포넌트 12곳 일관 사용, h1 단일성·img alt·landmark 양호.
