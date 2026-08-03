# 통합 검색 Phase 2 — 자동완성 설계

- 작성일: 2026-06-10
- 상태: 설계 합의 완료 → 구현 플랜 대기
- 선행: Phase 1(검색 두뇌+헤더검색+0건회복) develop 머지 완료. spec `2026-06-09-unified-search-upgrade-design.md`
- 목업: `docs/superpowers/mockups/2026-06-10-search-autocomplete.html`

## 1. 배경 / 목표

Phase 1에서 헤더 상주 검색창(데스크톱 인라인 / 모바일 오버레이)과 검색 두뇌(파서)를 출시했고, **자동완성은 Phase 2로 이월**했다. 이번에 검색창 포커스 시 드롭다운으로 **추천(지역·카테고리·건물명) + 최근/인기검색**을 제공한다.

목표: 입력 부담을 줄이고(타이핑 중 바로 목적지 제시), 빈 입력 상태에서도 다음 행동을 유도해 검색 진입률·전환율을 높인다.

핵심: Phase 1의 자산(파서·지역인덱스·동의어맵·`RealEstateBuildingSummary` 인덱스)을 그대로 재사용한다.

## 2. 스코프 (확정)

| 항목 | 결정 |
| --- | --- |
| 추천 종류 | **지역 + 카테고리 + 건물명** (전부 인덱스 기반). 개별 시설명 제외 |
| 인기검색 소스 | **정적 큐레이션 먼저 + 로깅 동시 시작**. 데이터 쌓이면 집계로 자동 전환(백엔드만 변경) |
| 적용 위치 | **HeaderSearch(데스크톱+모바일)** + **메인 히어로(index.vue)**. `/search` 입력창은 제외 |
| 최근검색 | localStorage, 클라 전용, 최대 8개 |

### 제외 (YAGNI / 후속)

- 개별 시설명 추천(14개 시설 테이블 키입력당 스캔 — 좀비쿼리 위험)
- 오타 교정 / 퍼지 매칭
- `/search` 결과 페이지 입력창 자동완성
- SearchLog 집계 대시보드/분석 UI
- 고급 랭킹(매칭 하이라이트 외)

## 3. 아키텍처 — 백엔드 (신규)

### 3.1 `GET /api/search/suggest?q=` (`searchSuggestService.ts`)

q를 기존 `parseSearchQuery`로 분석 후 섹션별 추천을 합성해 반환한다.

응답 형태:
```ts
interface SuggestItem {
  type: 'region' | 'category' | 'building';
  label: string;          // 표시 텍스트
  sublabel?: string;      // 보조 텍스트(시/도, 거래건수 등)
  // 라우팅용 구조화 데이터(프론트가 슬러그 변환):
  city?: string;          // 정식 city명
  district?: string;
  category?: string;      // FacilityCategory 슬러그
  buildingName?: string;
  bjdCode?: string;
  reType?: string;        // 건물: apt-sale 등 대표 type
}
interface SuggestResponse { items: SuggestItem[] }
```

- **지역**: 지역 인덱스에서 q 접두 매칭(시/구). 정식 city명 + district 반환.
- **카테고리**: 동의어맵에서 q 매칭 → category. 파서가 지역도 인식했으면 city/district 결합.
- **건물명**: `RealEstateBuildingSummary` `buildingName startsWith q`, `transactionCount` 내림차순 top N(예: 5). 인덱스 `[type, buildingName]` / `[type, transactionCount]` 활용. `serializeRow`로 BigInt 직렬화.

**성능 가드 (필수, notepad의 MySQL 좀비쿼리 회피):**
- 건물명은 **`startsWith`만**(sargable). `contains` 금지.
- q 최소 길이 가드(건물 조회는 `q.length >= 2`).
- `LIMIT` 작게(섹션당 ≤ 5). 14개 시설 테이블 스캔 금지.
- 클라이언트 디바운스 200ms.
- 스키마: `z.object({ q: z.string().max(50) })`, rate-limit 적용(`searchRateLimiter` 재사용).

### 3.2 `POST /api/search/log`

키워드 검색이 **`/search`에서 결과로 확정될 때** `SearchLog`에 비동기(fire-and-forget) 기록한다. 헤더/히어로/추천의 "그대로 검색"·최근·인기는 모두 `/search`로 이동하므로 이 한 지점이 단일 chokepoint가 된다. (지역/카테고리/건물 추천 선택은 엔티티 페이지로 직행 — 키워드 검색이 아니므로 SearchLog 비대상, GA `search_suggest_select`로만 추적.)

- **기존 `SearchLogSchema`(`backend/src/schemas/search.ts`) 재사용**: `{ sessionId(length 32), keyword?, category?, city?, district?, lat?, lng?, resultCount(required) }`.
- `/search`에서 결과 확정 시 `resultCount` 포함해 기록(데이터 품질 확보).
- `validate(SearchLogSchema, 'body')` + rate-limit. insert 후 즉시 200. 실패해도 사용자 흐름 영향 없음(프론트는 응답 무시).
- 목적: 인기검색 집계 데이터 축적.

### 3.3 `GET /api/search/popular`

- **기존 `PopularSearchQuerySchema` 재사용**: `{ limit(1~20, default 10), period('day'|'week'|'month', default 'week') }`.
- `SearchLog`에서 `period` 기간 내 keyword별 count 집계 → top `limit` 반환.
- 데이터 부족(distinct keyword < 임계치, 예: 10)이면 **정적 큐레이션 목록 fallback**.
- 응답: `{ items: Array<{ keyword: string }>, source: 'aggregated' | 'static' }`
- 지금은 static 반환, 데이터 쌓이면 백엔드 내부에서 aggregated로 자동 전환(프론트 무변경).
- 인메모리 캐시(예: 10분)로 집계 쿼리 비용 억제.

### 3.4 라우트 등록

- **신규 `backend/src/routes/search.ts`**: suggest/log/popular 핸들러를 모아 `app.use('/api/search', searchRouter)`로 등록(`backend/src/app.ts`).
- suggest용 쿼리 스키마는 `schemas/search.ts`에 **`SuggestQuerySchema = z.object({ q: z.string().max(50) })`** 추가.

정적 큐레이션 목록(v1): `화장실`, `주차장`, `아파트 실거래가`, `약국`, `도서관`, `공원`, `전기차 충전소`, `병원` (운영 중 조정 가능).

## 4. 아키텍처 — 프론트엔드 (신규)

### 4.1 `useSearchSuggest.ts` (composable)

- `suggest(q)`: 디바운스(200ms) `$fetch('/api/search/suggest')`. `readonly` items 반환.
- 최근검색: localStorage(`ilsangkit:recentSearches`) read/add/remove/clear. 최대 8, 중복 제거, 최신순. **모든 접근 `import.meta.client` 가드.**
- 인기검색: `$fetch('/api/search/popular')` 1회 로드(캐시).
- sessionId: localStorage(`ilsangkit:sid`)에 **32자 hex**(`crypto.randomUUID()`의 `-` 제거 = 32자) 생성/재사용. SearchLogSchema의 `length(32)` 충족.
- `logSearch({ keyword, resultCount, ... })`: `POST /api/search/log` fire-and-forget(에러 무시). **`/search` 결과 페이지에서 결과 확정 시 호출**(resultCount 확보). 헤더/히어로 submit 자체는 로깅하지 않음(/search로 이동해 거기서 로깅).

### 4.2 `SearchAutocomplete.vue`

- props: `variant`(헤더/오버레이 표시 차이 흡수), `modelValue`(입력값), 이벤트 `select`/`submit`.
- 빈 입력: 최근검색 리스트(개별 삭제 + 전체 삭제) + 인기검색 칩.
- 입력 중(디바운스 후): suggest 섹션(지역/카테고리/건물) + 맨 아래 "그대로 검색" 행.
- 키보드: ↑↓ 항목 이동, Enter 선택/검색, Esc 닫기. ARIA `combobox` + `listbox` + `aria-activedescendant`.
- SSR 가드: 드롭다운은 클라에서만 열림. 초기 렌더 mismatch 방지.

### 4.3 항목 클릭 동작 (Phase 1 슬러그 변환 재사용: `CITY_FULL_NAME_TO_SLUG`, `DISTRICT_SLUG_MAP`)

- **지역**: district 있으면 `/{citySlug}/{districtSlug}`, 시만이면 `/{citySlug}`
- **카테고리**: 지역 인식 시 `/{citySlug}/{districtSlug}/{category}`, 아니면 `/{category}`
- **건물**: `/real-estate/{reType}/{encodeURIComponent(buildingName)}?bjdCode={bjdCode}`
- **그대로 검색 / 최근 / 인기**: `/search?keyword={q}`
- 선택 시 `useSearchSuggest.addRecent(라벨)` + GA `search_suggest_select`(type 포함). 키워드 검색 로깅(`logSearch`)은 `/search` 도착 후 결과 확정 시점에서 일괄 처리(§3.2).

### 4.4 통합 위치

- `HeaderSearch.vue`: 데스크톱 인라인 입력 → 아래 absolute 드롭다운. 모바일 오버레이 → 입력창 아래 동일 리스트. 기존 `variant` 구조 유지.
- `index.vue` 메인 히어로 입력창 → 동일 `SearchAutocomplete` 적용.
- `/search` 입력창은 미적용(범위 외).

## 5. 계측 (GA)

기존 `useAnalytics` 패턴 재사용.

| 이벤트 | 시점 |
| --- | --- |
| `search_suggest_select` (신규) | 추천 항목 클릭(type 포함: region/category/building) |
| `search_executed` (기존) | 검색 실행(그대로 검색/최근/인기 포함) |

## 6. 테스트

작업 전후 `nvm use 20` 후 백/프론트 `vitest run`. 기존 실패 테스트도 즉시 수정.

- **백엔드**:
  - `searchSuggestService`: 지역/카테고리/건물명 분기, startsWith 가드(q<2 건물 조회 안 함), LIMIT
  - `popular`: 데이터 부족 시 static fallback, 충분 시 aggregated
  - `log`: `SearchLogSchema` 검증 + insert(prisma 모킹)
  - 라우트 등록: `/api/search` 마운트 확인
- **프론트**:
  - `useSearchSuggest`: 디바운스, 최근검색 CRUD(최대 8·중복·삭제), SSR 가드, sessionId 생성
  - `SearchAutocomplete`: 빈/입력 상태 렌더, 섹션 표시, 키보드 내비, 클릭 라우팅(슬러그 변환)
  - `HeaderSearch` 통합: 데스크톱/모바일 자동완성 노출

## 7. 위험 / 주의

- **suggest 성능**: 키입력당 쿼리 — 디바운스 200ms + `startsWith` + 인덱스 + 작은 LIMIT. 좀비 트랜잭션 회피.
- **popular 집계 비용**: 인메모리 캐시(10분)로 억제.
- **SSR/hydration**: 드롭다운 클라 전용, localStorage 접근 `import.meta.client` 가드.
- **모바일 오버레이**: 키보드 표시 시 리스트 스크롤, 포커스 유지.
- **규칙 준수**: Express 5 query read-only, ESM `.js` import, BigInt `serializeRow`, City Variant 매칭, 아이콘 추가 시 nuxt.config 알파벳 정렬 + `.nuxt` 캐시 클리어.

## 8. 영향 파일 (참고)

- 신규: `backend/src/services/search/searchSuggestService.ts`, `backend/src/services/search/searchPopularService.ts`(집계+static fallback), `backend/src/routes/search.ts`, `frontend/composables/useSearchSuggest.ts`, `frontend/components/search/SearchAutocomplete.vue`
- 수정: `backend/src/app.ts`(`/api/search` 등록), `backend/src/schemas/search.ts`(`SuggestQuerySchema` 추가 — 기존 `SearchLogSchema`/`PopularSearchQuerySchema`는 재사용), `frontend/components/common/HeaderSearch.vue`, `frontend/pages/index.vue`, `frontend/pages/search.vue`(결과 확정 시 `logSearch`), `frontend/utils/analyticsConstants.ts`(이벤트 상수), `frontend/composables/useAnalytics.ts`(트래커)
