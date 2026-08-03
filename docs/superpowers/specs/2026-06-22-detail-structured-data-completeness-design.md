# 상세페이지 구조화 데이터 완전화 설계 (Detail-Page Structured-Data Completeness)

- 작성일: 2026-06-22
- 상태: 설계 확정 대기 (사용자 검토 → 구현 계획 작성)
- 범위: 상세(리프) 페이지 10종 — 시설 · 쓰레기 · 지하철 · 부동산 건물 · 토지 동 · 청약 · 공공임대 · 공공임대 공고 · 공매 · 가이드
- 동인: 경쟁 레퍼런스(ayo.pe.kr "찾아요!홈즈" · local.114-service.co.kr "타운커넥트" — 동일 운영사 CodeCraft Corp, AdSense `pub-1738081609565175`)의 사업장 상세 SEO 레시피를 ilsangkit 상세 전수와 ground-truth 대조한 결과
- 선행/관련: [2026-06-15-detail-section-ordering-design.md](./2026-06-15-detail-section-ordering-design.md) (T5 FAQ · T6 DataSourceSection 사다리), `project_naver_seo_og_image`, `project_title_intent_single_source`

---

## 1. 배경 — 경쟁 레퍼런스 분석 요약

ayo/n114는 ilsangkit과 동일한 "공공데이터 → 대량 프로그래매틱 페이지 → AdSense" 모델이며, 같은 운영사가 렌더링 방식만 달리해(ayo=React SPA+SSR head, n114=풀 SSR) 운영하는 site network다. 두 사이트의 사업장 상세 페이지 thin-content 회피 레시피 5요소:

1. 서버 자동생성 고유 title + meta description (업종/위치/상태 인텐트)
2. JSON-LD: `LocalBusiness` + `Dataset`(출처 provenance: `isBasedOn`/`sourceOrganization`/`citation`/`license`) + `WebPage` + `Organization`
3. 엔티티 고유 데이터(상호·주소·좌표·상태)를 라벨드 필드로 전개 + "주변·관련" 집계
4. 지도 임베드 + 본문 "정보 업데이트 YYYY-MM-DD" 가시 타임스탬프
5. canonical 자기참조

**ilsangkit은 1·3·5와 엔티티 스키마를 이미 경쟁사 이상으로 충족**(동적 FAQ·이용팁·YouTube·블로그후기·교차카테고리 집계·정교한 noindex 정책까지 보유). 빠진 것은 **2의 Dataset/provenance**와 **4의 신선도 신호**, 그리고 전수 감사로 드러난 **구조화 스키마 누락 버그 3건**이다.

---

## 2. 현황 매트릭스 (상세 10종 × 5기준, ground-truth)

| 페이지 (파일) | C1 제목 | 갭1 Dataset | 갭2 가시갱신 | dateMod(JSON-LD) | Breadcrumb | 엔티티스키마 |
|---|---|---|---|---|---|---|
| 시설 `[category]/[id].vue` | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ 카테고리별 |
| 쓰레기 `trash/[id].vue` | ✅ | ❌ | ❌ | ❌ | ✅ | GovernmentService |
| 지하철 `subway/[slug].vue` | ✅ | ❌ | ❌ | ❌ | **❌ 누락** | TrainStation |
| 부동산 건물 `…/[buildingName].vue` | ✅ | ❌ | ✅ | ❌ | ✅ | ✅ Place+Listing |
| 토지 동 `…/land/…/[dong].vue` | ✅ | ❌ | ❌ | ❌ | ✅ | **❌ 부재** |
| 청약 `subscription/[id].vue` | ✅ | ❌ | ❌ | ❌ | ✅ | Event |
| 공공임대 `public-rental/[type]/[id].vue` | ✅ | ❌ | ❌ | ❌ | ✅ | (목록형) |
| 공공임대 공고 `…/announcements/[pblancId].vue` | ✅ | ❌ | ❌ | ❌ | ✅ | **❌ Article/Event 누락** |
| 공매 `auction/item/[cltrMngNo].vue` | ✅ | ❌ | ❌ | ❌ | ✅ | (물건) |
| 가이드 `guide/[slug].vue` | ✅ | ➖ 비대상 | ❌ 작성일만 | ✅ | ✅ | Article |

핵심 사실:
- **갭1(Dataset/provenance)**: `setDatasetSchema()`를 호출하는 상세 페이지 **0/10**. 홈·목록·허브에만 존재 (`useStructuredData.ts:768-822`).
- **갭2(가시 타임스탬프)**: **2/10만 기구현**(시설 `[id].vue:204`·부동산건물 `[buildingName].vue:391`이 `DataSourceSection`에 `:last-sync-date` 전달). 8종 누락 — 그중 6종은 `DataSourceSection`을 이미 렌더(prop만 비어있음), 공고는 컴포넌트 자체 없음.
- **dateModified(JSON-LD)**: 가이드 1종만 보유(`setArticleSchema`).
- **출처 데이터 준비됨**: `utils/dataSource.ts`의 `resolveDataSource({domain, category})`가 facility(subway 포함)·real-estate(토지 포함)·subscription·public-rental·auction 5개 도메인을 이미 커버 + 테스트(`dataSource.test.ts`) 존재.

---

## 3. 목표 / 비목표

### 목표
- **갭1**: 공공데이터 기반 상세 9종에 출처 `Dataset` + provenance(`isBasedOn`/`sourceOrganization`/`citation`/`license`/`dateModified`) JSON-LD 추가 → E-E-A-T · AI 검색(GEO) 인용성 · thin 방어.
- **갭2**: 가시 "정보 업데이트 YYYY-MM-DD" 타임스탬프 — 미구현분 연결(즉시 6종 + 공고 컴포넌트 신규 1종; 가이드는 작성일·`article:modified_time` 기구현으로 별도) + JSON-LD `dateModified`.
- **버그 3건**: 지하철 `BreadcrumbList` · 공고 `Article`/`Event` · 토지 엔티티 스키마 보강.

### 비목표 (이 스펙에서 다루지 않음)
- **중복색인(clothes thin-content 면제 · trash noindex)** — 관심사가 URL/콘텐츠 dedup이라 별도 소형 스펙으로 분리.
- **가이드 thin content 보강** — 콘텐츠/방향 결정이라 사용자 판단으로 보류.
- **AdSense Auto Ads 도입 / slot ID 분리** — 수익 정책 영역(사용자 결정). 본 스펙은 광고 불변.
- 토지·쓰레기 지도 임베드 — 단일 대표 좌표 부재(데이터 구조 제약), 후속 검토.

---

## 4. 설계

### 4.1 갭1 — Dataset/provenance ("A 보정형" 구조)

**구조 결정**: 단일 레코드 상세 페이지에서 **엔티티 스키마(Place/LocalBusiness/Event/…)를 페이지 주체로 그대로 유지**하고, 원본 공공데이터셋을 **별도 `Dataset` 노드**로 추가한다. `Dataset`의 `name`은 **원본 컬렉션명**(예: "전국 공중화장실 표준데이터")으로 두어 "페이지=데이터셋" 오해를 피한다. (WebPage 노드 신규 도입안(B)은 10종 전역에 새 노드 타입을 추가해 표면적이 커서 기각. 경쟁사도 LocalBusiness+Dataset을 병행하므로 A가 정합.)

**`setDatasetSchema()` 확장** (`composables/useStructuredData.ts:768-822`):
기존 시그니처에 옵션 추가 —
- `dateModified?: string` → 출력 `dataset.dateModified` (이 레코드의 `updatedAt`, KST `YYYY-MM-DD`)
- `datePublished?: string` → `dataset.datePublished` (가능 시 `createdAt`)
- `isBasedOn?: string` → 원본 데이터셋 URL (`DataSourceInfo.url`)
- `sourceOrganization` → `{ '@type':'Organization', name: provider }` (이미 `creator`로 있으나 `sourceOrganization`도 명시)
- `citation` → `{ '@type':'Dataset', name: datasetName, url, publisher: {name: provider} }`

> 기존 `creator`/`distribution`/`license`/`publisher` 출력은 유지(하위호환). 홈·목록의 기존 호출은 신규 옵션 미전달로 동작 불변.

**페이지별 호출** (인덱서블 상세에서만):
```
const src = resolveDataSource({ domain, category })   // 이미 존재
if (src && !isNoindex) setDatasetSchema({ name: src.datasetName, description, url: route.path,
  sources: [src], isBasedOn: src.url, sourceOrganization: src.provider, dateModified: kst(record.updatedAt) })
```

| 페이지 | domain | 비고 |
|---|---|---|
| 시설 / 지하철 | `facility` | subway는 facility 도메인에 매핑 확인됨 |
| 부동산 건물 / 토지 | `real-estate` | `REAL_ESTATE_DATASETS`에 토지 실거래가 포함 |
| 청약 | `subscription` | |
| 공공임대 / 공고 | `public-rental` | |
| 공매 | `auction` | |
| **가이드** | — | **Dataset 비대상**. 자체 편집 콘텐츠이므로 기존 `Article`의 `author`/`publisher`(Organization) provenance를 점검·보강 |

**정합성 가드**:
- **noindex/thin 페이지에는 Dataset 미출력** — 각 페이지의 기존 noindex 판정(`isFacilityNoindex`, `shouldNoindexRealEstateDetail`, 토지 `isIndexable`, 공매 cancelled, 공고 closed 등) 재사용.
- BigInt/Decimal · 날짜 직렬화: 부동산 `serializeRow()` 컨텍스트에서 `updatedAt`을 ISO/KST 문자열로 안전 변환.

### 4.2 갭2 — 신선도(freshness)

**가시 타임스탬프** — `components/common/DataSourceSection.vue`(`:last-sync-date` prop 이미 지원)에 페이지별 갱신일 연결:
- 즉시 연결(6종, prop만 채움): 쓰레기 · 지하철 · 토지 · 청약 · 공공임대 · 공매. 데이터 소스:
  - 시설계열/지하철/쓰레기: `facility|waste` 동기화 `updatedAt`(또는 sync-status). 쓰레기는 `details.dataCreatedDate`/`lastModified`도 활용.
  - 부동산/토지: real-estate sync-status `updatedAt`("최신 거래일"과 구분 — 페이지 갱신일).
  - 청약/공공임대/공고: 각 레코드 `updatedAt`(API 응답에 존재).
  - 공매: auction `updatedAt`.
- 컴포넌트 신규(1종): 공공임대 공고 `announcements/[pblancId].vue`에 `DataSourceSection` 추가.
- 포맷: 기존 `formatKstDate()`(`utils/formatters.ts`)로 `YYYY-MM-DD`.

**JSON-LD `dateModified`**: 4.1의 `Dataset.dateModified`로 일괄 해결 + 엔티티 스키마에도 가능 시 `dateModified` 부여. 가이드는 기구현(`article:modified_time`) 유지.

### 4.3 버그 3건 (구조화 스키마 누락 보강)

- **지하철 — `BreadcrumbList` 누락**: `subway/[slug].vue`가 UI `<Breadcrumb>`만 렌더하고 `setBreadcrumbSchema()` 미호출. 다른 9종과 동일하게 `breadcrumbItems` 경로로 `setBreadcrumbSchema()` 호출 추가.
- **공고 — `Article`/`Event` 누락**: `announcements/[pblancId].vue`가 `meta type='article'`이나 스키마는 `BreadcrumbList` 1개뿐. 접수기간(`receptionStart`/`End`) 있으면 `setEventSchema`, 없으면 `setArticleSchema(datePublished=공고일, dateModified=updatedAt)`.
- **토지 — 엔티티 스키마 부재**: `land/…/[dong].vue`가 breadcrumb+FAQ만. 단일 대표 좌표가 없으므로 좌표 없는 minimal `Place`(`addressLocality=동`) 또는 `Dataset`(국토교통부 토지 실거래가)을 `mainEntity`로 추가.

---

## 5. 구현 단계 (PR 분할)

> "CI green ≠ 운영 정상" 교훈(`project_live_verify_frontend_gotchas`) — 작고 라이브검증 가능한 단위로 끊는다. PR-B·C는 PR-A 머지 후 병렬 가능.

| PR | 내용 | 리스크 | 검증 |
|---|---|---|---|
| **PR-A 기반** | `setDatasetSchema` provenance/date 옵션 확장 + (필요 시) 헬퍼. 순수 composable. | 낮음 (페이지 동작 무변경) | 단위테스트 |
| **PR-B 롤아웃** | 갭1(Dataset 9종) + 갭2(가시 타임스탬프 8종 · dateModified). 핵심 기능. | 중 (SSR head 변화) | 타입별 SSR HTML 불변식 + 리치결과 |
| **PR-C 스키마 버그** | 지하철 Breadcrumb · 공고 Article/Event · 토지 엔티티. 독립 정정. | 낮음 | per-page JSON-LD 스냅샷 |

모든 PR은 develop 경유 · CI 통과 후 머지(`feedback_pr_workflow`). 백엔드 변경 없음(전부 프론트 `useStructuredData.ts` + 상세 page/컴포넌트).

---

## 6. 테스트 전략 (TDD)

- **단위**: `useStructuredData` — Dataset에 `isBasedOn`/`sourceOrganization`/`citation`/`dateModified`가 옵션대로 출력되는지; 미전달 시 기존 출력 불변(하위호환). `resolveDataSource` 도메인 매핑이 9종 전부 non-null 반환(가이드 제외).
- **페이지별 JSON-LD 스냅샷**: 10종 각각이 기대 `@type` 집합을 출력(지하철 Breadcrumb 포함, 공고 Article/Event 포함, 토지 엔티티 포함).
- **SSR 불변식(라이브검증 회귀 방지)**: noindex 페이지에 Dataset 미출력 · 단일 h1 유지 · 광고(AdBanner/CoupangBanner) 개수·위치 불변.
- **회귀 가드**: 기존 구조화/메타 테스트 green 유지. 커밋 전 `cd frontend && npm run test` (`feedback_test_verification`).

---

## 7. 리스크 / 주의

- **Nitro 라우트 캐시**: SSR head 변경이 캐시 페이지에 반영 안 될 수 있음 → 배포·검증 시 `.nuxt/cache/nitro/routes` 인지(`project_nitro_route_cache`).
- **단일 레코드 Dataset 의미론**: `name`을 원본 컬렉션명으로 고정해 "페이지=데이터셋" 오해 방지(§4.1).
- **noindex ↔ Dataset 정합**: 색인 안 되는 페이지에 dataset 선언 금지 — 기존 noindex 판정 재사용.
- **부동산 날짜 직렬화**: BigInt/Decimal/Date를 문자열로 안전 변환(`serializeRow` 컨텍스트).
- **운영 반영은 main 승격 시** + 라이브 검증(SSR HTML 불변식 + 리치결과 테스트).

---

## 8. 미해결 / 후속 (별도 트랙)

- **중복색인 별도 스펙**: clothes thin-content 면제를 동적 FAQ 개수 기준 noindex로 교체(HIGH) + trash 상세 noindex 또는 동적콘텐츠(MEDIUM). 지역목록 근사중복은 GSC `crawled-not-indexed` 관찰 후 판단(보류).
- **가이드 thin content**: 관련 시설/지역 위젯 삽입 등 — 콘텐츠 결정(사용자).
- **토지/쓰레기 지도**: 동 중심 좌표/경계 중심점 제공 시 정적 지도 임베드 검토(데이터 의존).
