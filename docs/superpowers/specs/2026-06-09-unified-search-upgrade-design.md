# 통합 검색 업그레이드 설계 (Phase 1)

- 작성일: 2026-06-09
- 상태: 설계 합의 완료 → 구현 플랜 대기
- 목업: `docs/superpowers/mockups/2026-06-09-unified-search.html`

## 1. 배경 / 목표

메인 검색바 → `/search` 로 이어지는 통합 검색을 발전시킨다. 표면적 동기는 "검색 페이지 개선"이지만, 사용자의 실제 관심사는 **이탈률 감소**다.

솔직한 진단: `/search`는 noindex이고 메인 검색바를 통해서만 도달한다. 트래픽 다수(SEO 착지 방문자)는 통합 검색을 볼 일이 없으므로, **검색 페이지 품질만으로는 이탈을 잡기 어렵다.** 이탈은 두 군데서 샌다.

- **(A) 유입 착지 이탈**: 구글/네이버에서 상세 페이지에 바로 와서 한 페이지만 보고 나감. 검색창을 거치지 않음.
- **(B) 검색 후 이탈**: 검색했는데 결과가 안 나와서("강남 래미안" → 0건) 나감.

데이터(GA 분석)는 아직 없어 어느 누수가 큰지 불확실하다. 따라서 **둘을 함께 공략하면서 GA로 계측을 시작**하는 설계로 간다.

핵심 통찰: 자동완성·결과·0건회복이 전부 **하나의 "검색 두뇌"(쿼리 파서 + 매칭)**를 공유한다. 두뇌를 먼저 세우면 나머지가 그 위에 얹힌다.

## 2. 스코프 결정 (확정)

| 항목 | 결정 |
| --- | --- |
| 1차 베팅 | 검색 두뇌(①) + 어디서나 검색 진입(②) 함께. 단 **자동완성 UI/엔드포인트는 Phase 2로 이월** |
| 검색 대상 범위 | **현재 유지**: 시설 15개 + 부동산 6개 + 쓰레기(WasteSchedule). 청약·공매·토지·지하철 미포함 |
| 검색창 배치 | **글로벌 헤더 상주**(모든 페이지). 메인은 히어로 검색창이 주인공이고, **스크롤로 히어로가 화면 밖으로 나가면 헤더 검색창 등장** |
| `/search` 색인 | **noindex 유지** (SEO 신호 충돌 방지, 기존 정책 일치) |

### Phase 1 (이번 spec) 범위

- 백엔드 검색 두뇌: 쿼리 파서, 시설 다중토큰 매칭, 부동산 매칭 확장, 0건 회복 페이로드
- 헤더 상주 **일반 검색 입력창**(자동완성 아님) — 데스크톱 인라인 / 모바일 아이콘→전체화면 오버레이
- 메인 스크롤-등장 헤더 검색창
- `/search` 0건·부분0건 회복 UX
- GA 계측

### Phase 2 (이월)

- `GET /api/search/suggest` 엔드포인트
- `SearchAutocomplete.vue` + `useSearchSuggest.ts`
- 최근 검색(localStorage) / 인기 검색
- `search_suggest_select` GA 이벤트

### 명시적 제외 (YAGNI)

- 청약·공매·토지·지하철·가이드 검색 편입
- 오타 교정(퍼지 매칭)
- 동적 인기검색 집계 인프라
- `/search` indexable 전환
- 착지 페이지 능동 추천("이 지역 다른 시설") — 별도 spec 후보

## 3. 아키텍처 — 검색 두뇌 (백엔드)

### 3.1 `searchQueryParser.ts` (신규, 단일 소스)

입력 키워드를 토큰으로 분해한다.

```
parseSearchQuery("강남 래미안")
  → { cityToken: null, districtToken: "강남구", categoryToken: null, freeText: "래미안" }

parseSearchQuery("서울 화장실")
  → { cityToken: "서울특별시", districtToken: null, categoryToken: "toilet", freeText: "" }
```

- **지역 인식**: 기존 `cityMapping`(`CITY_SLUG_TO_FULL`/`SHORT`) + 구/군 이름 리스트로 토큰 매칭. "강남"→`강남구`, "서울"→`서울특별시`. 시/도·축약명 양형태 모두 매칭(기존 City Variant 규칙 준수).
- **카테고리 인식**: 동의어 맵으로 토큰→카테고리. `CATEGORY_META`에 `synonyms: string[]` 필드 추가(예: `toilet: ['화장실','공중화장실']`, `pharmacy: ['약국']`, `parking: ['주차','주차장']`). 단일 소스는 `frontend/types/facility.ts`이나, 백엔드 파서가 쓸 수 있게 동의어 맵은 백엔드에도 상수로 둔다(또는 공유 위치). **구현 시 중복 정의 최소화 방안 확정.**
- **freeText**: 지역·카테고리로 소비되지 않은 나머지. 건물명/시설명 부분일치에 사용.

### 3.2 시설 검색 강화 (`facilityService`)

- `buildKeywordFilter`/`searchGrouped`가 **파서 토큰을 사용**하도록 변경.
  - 지역 토큰 → `city`/`district` 필터(기존 `buildRegionFilter` 활용, IN 변형 매칭).
  - 카테고리 토큰 → 검색 스코프(해당 카테고리 우선/한정).
  - freeText → `name`/`address`/`roadAddress` 부분일치.
- 결과: "서울 화장실"이 통짜 `contains` 실패 대신 **지역+카테고리로 정상 동작**.
- 쓰레기(WasteSchedule)는 기존대로 별도 처리(좌표 없는 일정), 파서의 지역 토큰만 반영.

### 3.3 부동산 검색 강화 (`realEstateService.searchAll`)

- 현재 `buildingName: { startsWith: keyword }`(앞글자만, 주소 매칭 없음) → 개선:
  - freeText → `buildingName` **`contains`**(또는 토큰 `startsWith`) + `dongName` 매칭.
  - 지역 토큰 → `city`/`district` 필터.
  - 결과: "강남 래미안"이 **지역(강남)+이름(래미안)**으로 정상 동작.
- **성능**: 무거운 `groupBy` 풀스캔을 피하기 위해 카운트/대표건은 `RealEstateBuildingSummary` 테이블(인덱스 `[type, buildingName]`, `[type, city, district, transactionCount]`) 활용. `serializeRow`로 BigInt/Decimal 직렬화.
- **주의(notepad)**: MySQL 좀비 사고 = 장시간 트랜잭션. 검색 쿼리는 인덱스 + LIMIT으로 가볍게, statement timeout 의식.

### 3.4 0건 회복 페이로드

facility + 부동산 결과가 모두 0이면, 응답에 **회복 추천**을 포함:

- 파서가 **지역을 인식**했으면 → 그 지역의 인기 카테고리 링크(예: `강남구 화장실` → `/seoul/gangnam/toilet`).
- 파서가 **카테고리만 인식**했으면 → `/{category}`로 유도 + "지역을 좁혀보세요".
- **아무것도 못 잡으면** → 정적 인기 카테고리(현행 유지) + 홈.

추천 지역 페이지 경로는 기존 지역 라우트(`/[city]/[district]/[category]`) 컨벤션을 따른다. 인기 카테고리 목록은 v1에서 정적 큐레이션.

## 4. 프론트엔드

### 4.1 헤더 상주 검색 입력창 (`AppHeader.vue`)

- **데스크톱**: 기존 "검색" 링크 → 인라인 입력창(자동완성 아님). 타이핑→Enter→`navigateTo('/search?keyword=...')`.
- **모바일**: 헤더엔 **검색 아이콘**만. 탭하면 **전체화면 검색 오버레이**(입력창 + 닫기). 좁은 헤더 레이아웃 충돌 방지.
- 453줄 공용 헤더 + 모바일 메뉴의 기존 nav/포커스 트랩 로직을 **보존**(회귀 주의).

### 4.2 메인 스크롤-등장 (`index.vue` / 헤더 연동)

- 메인 라우트에선 헤더 검색창이 초기엔 숨김. **히어로 영역이 뷰포트를 벗어나면 헤더 검색창 등장**(반대면 숨김).
- 구현: `IntersectionObserver`로 히어로 sentinel 관측 또는 scroll 위치. **SSR 가드 필수**(`import.meta.client`), hydration mismatch 방지(초기 상태는 항상 숨김으로 SSR/클라이언트 일치).
- 메인 외 페이지에선 헤더 검색창 항상 표시.

### 4.3 메인 히어로 검색바

- 기존 히어로 검색바는 유지. 헤더 검색창과 **동일한 라우팅 동작**으로 일원화(중복 로직 제거). 자동완성 없는 일반 입력.

### 4.4 `/search` 결과 페이지

- 매칭은 백엔드 두뇌가 처리(대부분 자동). 페이지는 **noindex 유지**.
- **0건 회복 UI**: 검색어 되짚는 메시지 + (지역 인식 시) 지역 추천 칩 + fallback 인기 칩. 기존 `EmptyState` 확장.
- **부분0건**: 한쪽(예: 시설)만 0이면 전체를 0건 화면으로 덮지 않고, 해당 탭/섹션에 작은 안내만 표시하고 다른쪽 결과는 정상 노출.

## 5. 계측 (GA)

기존 `useAnalytics` 패턴 사용. 어느 누수가 진짜인지 며칠 내 학습.

| 이벤트 | 시점 |
| --- | --- |
| `search_submit` | 검색 실행(헤더/히어로/검색페이지) |
| `search_result_click` | 결과 항목 클릭 |
| `search_zero_result` | 0건 발생(검색어 포함) |

(Phase 2에서 `search_suggest_select` 추가)

지표: 검색 진입률 · 0건율 · 검색→클릭 전환율 → 다음 우선순위(자동완성 vs 데이터 수집) 결정.

## 6. 테스트

작업 전후 `nvm use 20` 후 백엔드/프론트 `vitest run`(메모리 정책). 기존 실패 테스트도 즉시 수정.

- **백엔드(vitest)**:
  - `searchQueryParser` 단위: 다중토큰 분해 케이스("강남 래미안", "서울 화장실", "래미안", "강남구", 미인식)
  - 강화된 facility 검색: 지역+카테고리, 지역+freeText
  - 강화된 부동산 `searchAll`: 지역+이름, contains 매칭, 카운트(summary 테이블)
  - 0건 회복 페이로드: 지역 인식/카테고리만/미인식 분기
- **프론트(vitest)**:
  - 헤더 검색 입력창: 라우팅, 모바일 오버레이 토글
  - 메인 스크롤-등장: SSR 가드(초기 숨김), 등장/숨김 전이
  - `/search` 0건/부분0건 렌더

## 7. 위험 / 주의

- **suggest 성능**: (Phase 2) 키 입력당 쿼리 — 인덱스+LIMIT, 좀비 트랜잭션 회피. Phase 1엔 해당 없음.
- **부동산 검색 성능**: `contains`/`groupBy` 비용 — summary 테이블 + 인덱스로 가볍게.
- **공용 헤더 회귀**: 기존 nav/포커스 트랩/모바일 메뉴 테스트 보존.
- **Hydration**: 메인 스크롤-등장 초기 상태 SSR/클라이언트 일치, 검색 결과 영역 `isMounted` 가드 유지.
- **규칙 준수**: Express 5 query read-only, ESM `.js` import, BigInt 직렬화(`serializeRow`), City Variant 양형태 매칭.

## 8. 카테고리/동의어 추가 시 영향 파일 (참고)

- `frontend/types/facility.ts` — `CATEGORY_META.synonyms` 신규 필드
- 백엔드 파서용 동의어 맵 위치(중복 최소화 방안은 구현 단계 확정)
- `backend/src/services/facilityService.ts`, `realEstateService.ts` — 파서 연동
- `frontend/components/common/AppHeader.vue`, `frontend/pages/index.vue`, `frontend/pages/search.vue`
