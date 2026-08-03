# 통합 검색 복원 + `/search` 결과 페이지 리디자인 — 설계

- **작성일**: 2026-07-24
- **대상 브랜치**: `develop` (PR 경유, main 직접 금지)
- **목업**: https://claude.ai/code/artifact/e4c22afe-138d-44cd-9015-fd50232c4f34 (승인됨 2026-07-24)
- **관련 이력**: PR#617 「검색 재구성(컨텍스추얼 스코프 + 부동산 전용 /search)」 (merge `309b0acf`, 2026-07-23, **prod 라이브**)를 부분 되돌림

---

## 1. 배경 / 문제

현재 검색은 **컨텍스추얼(스코프) 방식**이다 (PR#617, prod 라이브):

- **헤더 검색**이 페이지마다 대상이 달라짐 — 시설 카테고리 페이지에선 그 카테고리 내부(`/{category}?keyword=`), 그 외에선 부동산(`/search`).
- **`/search`는 부동산 전용**으로 축소됨 (`useFacilitySearch` 제거, `search.vue` line 272). 시설은 검색되지 않음.
- 자동완성도 스코프별로 제안 그룹을 억제(`searchSuggestService`).

**목표**: 검색을 **다시 통합 검색**으로 되돌리고(헤더 어디서든 통합 `/search`로), **`/search` 결과 페이지를 리디자인**한다. 시설 + 부동산을 한 페이지에서 유형별로 보여준다.

**되돌림 제약**: PR#617은 develop·main 공통 조상이고 그 위에 10+ 커밋이 쌓여 있어 `git revert`는 불가. **손으로 부분 재통합**한다. 다행히 통합 검색의 **백엔드 두뇌(ngram FULLTEXT, 쿼리 파서, 지역 인덱스, 시노님)는 삭제가 아니라 적응**되어 있어, 대부분 프론트 재배선 + 결과 페이지 리디자인이다.

---

## 2. 목표 / 비목표

**목표**
- 헤더/홈 검색이 어디서든 통합 `/search?keyword=`로 이동.
- `/search`가 시설 + 부동산을 유형별 그룹 프리뷰로 표시(부동산 먼저 → 생활시설).
- 자동완성 통합 제안(지역 + 카테고리 + 건물명).
- 실제 디자인 토큰/카드 컴포넌트 재사용, 라이트 전용.

**비목표 (이번 범위 아님)**
- 시설+부동산을 서버에서 병합하는 **새 `/api/search/results` 엔드포인트** — 만들지 않음(프론트 팬아웃 사용).
- 결과 페이지 **SSR/색인화** — `/search`는 `noindex` 유지, 결과는 클라이언트 렌더 유지.
- 개별 시설명 자동완성(백엔드 v1 범위 밖), 지역 셀렉트 데이터소스 정리(선택적 후속).

---

## 3. 확정된 설계 결정

### A. 진입점 (통합 복원)
| # | 결정 | 근거 |
|---|---|---|
| A1 | **헤더 검색: 어디서든 `navigateTo('/search?keyword='+q)`** — `buildSearchDestination(scope, q)`·`:scope`·동적 placeholder 제거 | 통합 복원의 핵심. 페이지별 분기 제거 |
| A2 | **홈 히어로: `/search?keyword=`** — `:scope="{kind:'realestate'}"` 핀 제거 | 홈에서도 통합 진입 |
| A3 | **자동완성: 스코프 미전달** → 통합 제안(지역+카테고리+건물명). 백엔드 `searchSuggestService`의 `suppressCategory/suppressBuilding`를 항상 false(또는 scope 무시) | 통합 제안 복원. 코드가 이미 scope 없으면 전체 제안 |
| A4 | **`/{category}?keyword=` 시설 검색 페이지는 유지** | 시설 "더보기"의 드릴다운 목적지로 재활용 → 새 페이지드 시설목록 UI 불필요 |

### B. `/search` 결과 페이지 (통합 + 그룹 프리뷰)
| # | 결정 | 근거 |
|---|---|---|
| B1 | `keyword`로 **병렬 fetch**: 부동산 `useRealEstate().searchAll()` + 시설 `POST /api/facilities/search {grouped:true}` | 두 API 모두 유형별 건수 + 대표 top-3 반환 → **새 백엔드 0** |
| B2 | **렌더 순서: 부동산 먼저 → 생활시설** (도메인 헤더 + 구분선 + 총 건수) | 사용자 결정 |
| B3 | 각 유형 그룹 = `틴트 아이콘 + 라벨 + 건수` 헤더 + **대표 3개 카드** + `더보기 →` | 사용자 결정(대표 3개+더보기) |
| B4 | **부동산 더보기 → 인페이지 페이지드 목록**(기존 `getComplexList` 드릴다운 유지). **시설 더보기 → `/{category}?keyword=`**(A4) | 둘 다 기존 인프라 재활용 = 최소 변경. 비대칭 허용(사용자 확인) |
| B5 | 결과 0인 도메인 섹션 **숨김**. 둘 다 0이면 안내 빈 상태. 검색어 없으면 프리서치 빈 상태 | 빈 레인 노이즈 제거 |
| B6 | 히어로 문구 → **"통합 검색"**, placeholder `장소·단지명·시설명 검색`, 요약 한 줄(`생활시설 N · 부동산 M`) | 통합 정체성 복원 |
| B7 | 유형 정렬 — **생활시설: 결과 건수 desc**(가장 많이 매칭된 카테고리 먼저), **부동산: apt→villa→offitel 고정** | 시설 15종은 건수순이 유의미, 부동산 3종은 고정이 안정적 |
| B8 | 시설 카드 **거리 뱃지** — 좌표 기반 거리 계산 가능하면 표시(가까우면 코발트 강조), 불가하면 생략 | 실 검색이 좌표 기반이면 정보가치 有 (플랜에서 실데이터 확인) |

### C. 로깅 / 애널리틱스
| # | 결정 | 근거 |
|---|---|---|
| C1 | **검색 로깅은 `/search`에서 1회** — keyword + 통합 resultCount(시설 total + 부동산 total) | 통합 진입점이 단일 소스. `/popular`·`/suggest` 피드 자연 분포 회복 |
| C2 | `/{category}?keyword=` 드릴다운은 **재로깅 안 함** — 통합 후 이 페이지 진입 경로는 사실상 `/search` 더보기 뿐이므로, 기존 시설 페이지 `logSearch` 3사이트를 **제거**하고 로깅은 `/search`(C1)로 단일화 | 더보기는 새 검색이 아니라 네비게이션 → 중복 카운트 방지 |

### D. 유지해야 할 제약
- `/search` **`robots=noindex, follow`** 유지 (thin-content/중복 title 이력 → 색인화 금지)
- **4-segment `complexCardUrl`** 계약 유지 (`searchComplexCardUrl.test.ts` 회귀)
- **`/search?category=X` → `/{category}` 301** 유지 (SSR + onMounted 폴백)
- **기존 광고 슬롯** 배치 유지 (수익 정책은 사용자 소관)
- 결과는 **클라이언트 렌더**(`v-if=isMounted`) 유지 — 하이드레이션 미스매치 방지

---

## 4. 아키텍처 / 데이터 흐름

```
[헤더/홈 검색창] --q--> navigateTo('/search?keyword=q')
                                   |
                          /search (search.vue)
                                   |
              ┌────────────────────┴────────────────────┐
       useRealEstate().searchAll(q)          $fetch POST /api/facilities/search
       → GET /api/real-estate/search              {grouped:true, keyword:q}
       → {type,count,items(≤3)}[]                 → {categories:[{category,label,count,items(≤3)}], recovery}
              └────────────────────┬────────────────────┘
                          병렬 결과 병합(클라이언트)
                                   |
              ┌────────── 렌더 (부동산 먼저 → 생활시설) ──────────┐
       [부동산 도메인]                          [생활시설 도메인]
        apt/villa/offitel 그룹                   카테고리 그룹(건수 desc)
        각 top-3 ComplexCard + 더보기            각 top-3 FacilityCard + 더보기
        더보기→인페이지 페이지드                  더보기→/{category}?keyword=q
```

- 두 fetch는 독립 병렬. 하나 실패해도 다른 도메인은 렌더(부분 실패 허용, 기존 recovery 패턴 참고).
- 각 도메인 섹션은 `items.length > 0`일 때만 렌더.

### 컴포넌트 분해 (isolation)
`search.vue`가 940→636줄 이력이 있으므로, 재통합 시 파일 비대화를 피하려 **표시 단위를 컴포넌트로 분리**:
- `SearchDomainSection.vue` — 도메인 헤더 + 하위 그룹 슬롯 (부동산/생활시설 공통)
- `SearchResultGroup.vue` — 유형 그룹 1개: 아이콘/라벨/건수 헤더 + 대표 카드 슬롯 + 더보기 링크
- 카드는 기존 `ComplexCard.vue` / `FacilityCard.vue` 재사용(수정 없이)
- `search.vue`는 데이터 오케스트레이션(병렬 fetch, 병합, 빈/로딩 상태) + 부동산 인페이지 드릴다운만 담당

각 컴포넌트는 props로만 소통, 내부를 몰라도 사용 가능해야 함.

---

## 5. 변경 파일 (요약)

| 파일 | 변경 |
|---|---|
| `frontend/components/common/HeaderSearch.vue` | submit → 항상 `/search?keyword=`; scope/동적 placeholder 제거 (A1) |
| `frontend/pages/index.vue` | 홈 히어로 → `/search?keyword=`; realestate scope 핀 제거 (A2) |
| `frontend/composables/useSearchSuggest.ts` / `components/search/SearchAutocomplete.vue` | scope 미전달로 통합 제안 (A3) |
| `backend/src/services/search/searchSuggestService.ts` | scope suppress 해제(통합 제안) (A3) |
| `frontend/pages/search.vue` | **핵심** — `useFacilitySearch` 재도입, 병렬 fetch, 도메인 2섹션 렌더, 히어로 통합 문구, 요약 줄, 빈/로딩 상태 (B1~B8) |
| `frontend/components/search/SearchDomainSection.vue` *(신규)* | 도메인 섹션 |
| `frontend/components/search/SearchResultGroup.vue` *(신규)* | 유형 그룹 |
| `frontend/utils/searchScope.ts` | `buildSearchDestination` 미사용 → 정리/중립화 (제거 가능한지 참조 확인) |
| `frontend/pages/[category]/index.vue` | 드릴다운 진입 시 재로깅 억제(C2). 시설 키워드 검색 자체는 유지(A4) |
| `frontend/utils/searchLog.ts` | 통합 검색 로그 헬퍼(C1) |

**테스트 (기존 불변식이 현재 스코프 방식을 인코딩 → 갱신 필요)**
- `tests/pages/search.test.ts` — "no tablist / no 생활시설 / searchAll-only" 단언 → 통합 단언으로 교체
- `tests/pages/searchLog.test.ts` — `category:'realestate'` only → 통합 resultCount(C1)
- `tests/composables/useSearchSuggest.scope.test.ts` — 스코프 억제 → 통합 제안
- `tests/pages/categorySearchLog.test.ts` — 드릴다운 재로깅 억제(C2)
- `tests/utils/searchScope.test.ts` — `buildSearchDestination` 제거/중립화 반영
- `tests/pages/searchComplexCardUrl.test.ts` — 4-segment URL **유지 확인**(회귀)
- **신규**: `SearchResultGroup` / `SearchDomainSection` 컴포넌트 테스트, `/search` 통합 병렬 fetch·빈 도메인 숨김·부동산 먼저 순서 테스트

---

## 6. 구현 접근 (TDD)

사용자 선호 = 태스크 분리 + 테스트 먼저. 대략의 순서(상세는 writing-plans에서):

1. **진입점 통합** (A1·A2) — HeaderSearch/홈 히어로가 `/search?keyword=`로 가는 테스트 먼저 → 구현. 스코프 유틸 정리.
2. **자동완성 통합** (A3) — suggest 통합 제안 테스트 → 프론트/백엔드 수정.
3. **결과 페이지 데이터층** (B1) — `/search`가 시설+부동산 병렬 fetch·병합하는 테스트 → 구현.
4. **결과 페이지 표시층** (B2·B3·B7) — `SearchResultGroup`/`SearchDomainSection` 컴포넌트 테스트 → 구현 → `search.vue` 조립. 부동산 먼저.
5. **더보기 라우팅** (B4) + **빈/로딩 상태** (B5·B6) + **거리 뱃지** (B8, 실데이터 확인 후).
6. **로깅** (C1·C2).
7. 전체 `npm run test`(frontend+backend) + `npm run lint` 통과 확인, prod=main HEAD 대비 라이브 회귀 점검.

---

## 7. 리스크 / 게이트

- **prod 라이브 되돌림** — PR#617은 main 조상. 이 변경은 배포 시 prod에 반영됨. 머지 전 라이브 회귀(가로 넘침·og·타이틀·하이드레이션) 점검. **브라우저 DOM이 ground-truth**(Nitro 라우트캐시로 curl stale 가능).
- **SearchLog 분포 변화** — C1로 검색이 `/search`에 다시 모이면 `/popular`·`/suggest`가 바뀜. 사용자는 "구글 유입이 시설 페이지에 착지 → SearchLog 시설 편중"이 자연스럽다고 정정한 바 있음. 통합 진입이면 자연 분포로 회복 — 의도된 변화. 배포 후 `/popular` 관찰.
- **SEO** — `/search` noindex 유지(D). 색인화하면 thin-content 페널티 이력 재개방 위험. `/{category}?keyword=`도 noindex 유지.
- **하이드레이션** — 결과 클라이언트 렌더 유지(`isMounted`). 브라우저 API는 `import.meta.client` 가드.
- **타입 드리프트** — 부동산 grouped 런타임 `{type,count,items}`가 authoritative(`RealEstateGroupedResponse` 인터페이스는 stale). top-3 미리보기 건수(`searchAll`)와 페이지드 건수(`getComplexList`)는 독립 쿼리라 불일치 가능.
- **백엔드 empty-guard** — `realEstateService`는 건물명(≥2자)도 지역도 없으면 DB 접근 없이 `{categories:[]}` 반환 → 빈 쿼리 프리서치 상태는 기존과 동일.
- **거리 뱃지(B8)** — `POST /api/facilities/search {grouped}`가 좌표/거리를 주는지 플랜에서 확인. 없으면 뱃지 생략(목업의 거리는 예시).

---

## 8. 열린 후속 (별도)
- 지역 셀렉트가 **폐기물 스케줄 API**에서 city/district를 가져오는 이상한 재사용 — 전용 지역 소스로 정리(선택적).
- 개별 시설명 자동완성 — 백엔드 작업 필요(범위 밖).
- `searchScope.ts` 완전 제거 가능 여부 — 참조 0 확인 후.
