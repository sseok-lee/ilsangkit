# 공유 UX 컴포넌트 추출 설계 (Frontend Audit ⑤A)

- **작성일:** 2026-06-02
- **출처:** `docs/superpowers/specs/2026-06-02-frontend-improvement-audit.md` ⑤ (공유 EmptyState/LoadingSkeleton 부재)
- **슬라이스:** ⑤A — 공유 컴포넌트 추출. (지도/정렬·필터통일·헤더·차트a11y·깔때기링크는 별도 슬라이스)
- **분할:** 2 PR — **PR1 = EmptyState**, **PR2 = LoadingSkeleton**
- **원칙:** output-preserving 우선(이미 같은 모양 쓰는 곳에 적용). 동작/시각이 크게 바뀌는 곳은 제외(후속).
- **검증:** 단위 테스트 + 적용처 회귀 + build + lint. (로컬 시설 데이터 부재로 시각 curl 제한 — output-preserving이라 위험 낮음)

## 현황 (탐색 확인)

- 공유 `EmptyState`/`LoadingSkeleton` 없음. 빈 상태 ad-hoc ~32곳, 로딩(animate-pulse/spin) ~25곳 혼재.
- list/search 빈 상태는 대부분 "아이콘 원형 + 제목 + 설명 + (선택)CTA" 공통 형태. 카드 그리드 스켈레톤은 SubscriptionListView/PublicRentalListView/[category]/index/subway가 거의 동일.

## 보존 원칙

- 적용은 **현재와 시각적으로 동일/근사한 곳**부터. 단순 `<p>`만 있는 빈 상태(지역 그리드 등)에 아이콘을 새로 추가하는 시각 변경은 이번 범위 제외.
- 기존 `data-testid`(예: 일부 빈상태/스켈레톤) 보존.

---

# PR1 — EmptyState 컴포넌트

**대상:** `components/common/EmptyState.vue`(신규), 적용처(`pages/search.vue`, `pages/[category]/index.vue`, `pages/subway/index.vue`, `components/facility/FacilityList.vue`, `components/subscription/SubscriptionListView.vue`, `components/subscription/PublicRentalListView.vue`), 테스트.

## P1-1. EmptyState 컴포넌트
공통 빈 상태 모양을 캡처:
- props: `icon: string`(material-symbols 이름, 기본 `search_off`), `title: string`, `description?: string`
- 슬롯: 기본 슬롯(또는 `#action`) — CTA 버튼/링크용(있을 때만 렌더)
- 마크업: 기존 list/search 빈 상태의 표준형(원형 배경 아이콘 + 제목 + 설명 + 액션). 정확한 클래스는 구현 시 기존 `search.vue` 빈 상태에서 도출(출처: 적용처 중 가장 충실한 것).

## P1-2. 적용 (output-preserving)
각 적용처의 기존 빈 상태 블록을 `EmptyState`로 교체. 교체 후 렌더가 기존과 동일/근사한지 확인. 기존 CTA(예: "검색 초기화", "홈으로")는 슬롯으로 전달. 구조가 표준형과 크게 다른 곳(아이콘 없는 단순 `<p>`)은 **이번에 교체하지 않음**(후속).

## PR1 테스트
- `EmptyState` 단위: icon/title/description 렌더, action 슬롯 렌더/미렌더, 기본 icon.
- 적용처 회귀: 각 페이지의 빈 상태 테스트(있으면)가 기존 텍스트/CTA를 여전히 단언하도록 통과. 없으면 핵심 1곳(search 또는 SubscriptionListView)에 빈 상태 렌더 테스트 추가.

## PR1 커밋 분할
1. `feat(frontend): EmptyState 공유 컴포넌트 + 단위 테스트`
2. `refactor(frontend): list/search 빈 상태를 EmptyState로 교체(output-preserving)`

---

# PR2 — LoadingSkeleton 컴포넌트

**대상:** `components/common/LoadingSkeleton.vue`(신규), 적용처(카드 그리드 스켈레톤: `SubscriptionListView`, `PublicRentalListView`, `pages/[category]/index.vue`, `pages/subway/index.vue`), 테스트.

## P2-1. LoadingSkeleton 컴포넌트
- props: `variant: 'card-grid' | 'lines'`(기본 'card-grid'), `count?: number`(기본 6), `cols?`(card-grid 그리드 컬럼, 기본 3)
- 마크업: 기존 카드 그리드 펄스 스켈레톤(`grid ... gap-4` + `animate-pulse` 카드 N개)을 캡처. 'lines'는 단순 텍스트 라인 스켈레톤.

## P2-2. 적용 (output-preserving)
위 4개 적용처의 카드 그리드 스켈레톤을 `LoadingSkeleton variant="card-grid"`로 교체. 각 곳의 그리드 컬럼/카드 개수를 props로 맞춰 기존과 동일 출력. 카드 내부 구조가 특이한 곳(예: 라인 수가 다름)은 'card-grid' 기본형으로 근사하되, 크게 다르면 그 곳은 교체 제외(후속).

## PR2 테스트
- `LoadingSkeleton` 단위: card-grid가 count개 카드 렌더, cols 적용, lines variant 렌더.
- 적용처 회귀: 로딩 상태 테스트(있으면) 통과.

## PR2 커밋 분할
1. `feat(frontend): LoadingSkeleton 공유 컴포넌트 + 단위 테스트`
2. `refactor(frontend): 카드 그리드 스켈레톤을 LoadingSkeleton으로 교체`

---

## 비범위 (후속 슬라이스)

- `RegionCascadingDropdown` (필터 통일 — 청약/공공임대 자유텍스트→cascading 동작 변경 + 백엔드 지역 매칭 영향, 별도 설계).
- 차트 a11y(RentRatioBar/PriceTrendChart), 헤더 통일(faq h1 등), 깔때기 내부링크, 목록/지역 지도+정렬+내주변.
- 단순 `<p>` 빈 상태에 아이콘 추가(시각 변경) — 시각 검증 가능 시.
