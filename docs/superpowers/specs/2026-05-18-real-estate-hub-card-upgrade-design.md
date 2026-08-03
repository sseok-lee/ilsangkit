# 부동산 Hub 페이지 카테고리 카드 강화 — 설계

작성일: 2026-05-18
경로: `/real-estate`
범위: 카테고리 카드 섹션 단일 개편 (페이지 골격/FAQ/설명문/SEO 메타 등 나머지 유지)

## 배경

`/real-estate` hub 페이지는 부동산 카테고리의 루트 진입점이지만 현재 매우 빈약하다.

- 카테고리 카드 3개(아파트/빌라/오피스텔)만 노출되며 모두 `-sale` 링크
- 카드 내부에 정적 설명만 있고 라이브 데이터 신호 0
- 본문에 실거래 카운트/지역/단지 같은 어떤 동적 콘텐츠도 없음 → "thin content" 시그널
- 매매와 전월세 두 거래 유형을 모두 다루지만 hub에선 매매 링크만 노출(오해 유발)

최근 색인률 개선 작업(#264, #270)은 상세 페이지를 중심으로 진행되었으나 hub는 손대지 않았다. hub 자체의 색인 가치와 내부 링크 허브 가치를 회복하는 가장 가벼운 개입이 이번 작업의 목적이다.

## 목표

1. **SEO**: 본문에 라이브 수치 + 내부 링크 6개 노출. ItemList 스키마 확장.
2. **UX**: 매매/전월세 두 갈래를 한눈에 인지하고 한 번에 진입 가능.
3. **신뢰성**: "최근 30일 N건" 라이브 카운트로 데이터 활성도 시그널.

세 목표를 카드 섹션 강화만으로 동시에 달성한다.

## 비목표

- 인기 단지/지역 점프/최근 거래 피드/가격 추이 등 신규 위젯 추가는 본 작업에 포함하지 않는다.
- 페이지의 다른 섹션(PageHero, "부동산 실거래가란?", FAQ, DataSourceCard) 수정 없음.
- 색상 시스템, 타이포그래피, 공통 컴포넌트 변경 없음.

## 변경 범위

### 신규
- `backend/src/services/realEstateHubSummaryService.ts` — 6개 타입 30일 거래 건수 집계 + 메모리 캐시
- `backend/src/routes/realEstate.ts` 내부에 `GET /api/real-estate/hub-summary` 핸들러 추가

### 수정
- `frontend/components/realEstate/RealEstateCategoryCards.vue` — 6장 그리드 + 라이브 수치 표시
- `frontend/pages/real-estate/index.vue` — SSR fetch (`useAsyncData`) + ItemList 스키마 6개로 확장 + 자식에 props 전달

### 영향 없음
- DB 스키마, sync 파이프라인, 다른 페이지/컴포넌트, 라우팅, SEO 메타 태그.

## API 설계

```
GET /api/real-estate/hub-summary

Response 200:
{
  "success": true,
  "data": {
    "apt-sale":     { "last30dCount": 12431 },
    "apt-rent":     { "last30dCount":  8902 },
    "villa-sale":   { "last30dCount":  2103 },
    "villa-rent":   { "last30dCount":  4587 },
    "offitel-sale": { "last30dCount":   642 },
    "offitel-rent": { "last30dCount":  1180 }
  },
  "generatedAt": "2026-05-18T03:00:00.000Z"
}
```

### 집계 쿼리
6개 트랜잭션 테이블 각각:
```sql
SELECT COUNT(*) AS cnt
FROM <table>
WHERE dealYear * 100 + dealMonth >= <currentYYYYMM - 1>
```

- `dealDate` 컬럼이 일관되지 않을 수 있어 `dealYear`/`dealMonth` 조합 사용
- "최근 30일"은 운영 단순화를 위해 "현재 월 + 직전 월" 근사로 정의한다. 정확한 30일 이동창은 인덱스 활용도가 낮고, 사용자 인지상 차이가 미미.
- 6개 쿼리는 `Promise.all`로 병렬 실행

### 캐싱
- 단일 in-memory 캐시 객체: `{ data, expiresAt }`
- TTL 1시간. 갱신은 lazy(만료 후 첫 요청 시 재계산).
- 동시 요청 thunder herd 방지를 위해 in-flight Promise 공유 (`let inFlight: Promise<HubSummary> | null`)
- 프로세스 재시작 시 캐시 소실 허용. PM2 인스턴스별 독립 캐시여도 무방.

### 에러 처리
- DB 쿼리 실패 시 해당 타입만 `null` 반환 (`{ last30dCount: null }`)
- 6개 모두 실패하면 5xx, 일부 성공이면 200 + 부분 데이터
- 프론트는 `null`을 "데이터 동기화 중"으로 표시

## 프론트 설계

### `RealEstateCategoryCards.vue` props
```ts
interface CardEntry {
  type: 'apt-sale' | 'apt-rent' | 'villa-sale' | 'villa-rent' | 'offitel-sale' | 'offitel-rent'
  last30dCount: number | null
}

const props = defineProps<{ summaries?: CardEntry[] }>()
```

`summaries`가 없으면 모든 카드 수치 자리에 placeholder 렌더. SSR fetch 실패해도 카드 자체는 렌더링되어 링크 가치 유지.

### 카드 표시 항목
- 아이콘 (기존 `PROPERTY_TYPE_META[pt].iconImg` 재활용)
- 라벨: `아파트 매매`, `아파트 전월세` 등 (신규 라벨 상수)
- 거래유형 뱃지: `매매`(blue-100/blue-700) / `전월세`(amber-100/amber-700)
- 라이브 수치: `최근 30일 12,431건` (`tabular-nums`)
- 설명: 1-2줄, 기존 description 재활용 + 거래유형 보강

### 그리드
- 데스크톱(md+): `grid-cols-2 gap-4` → 2열 3행
- 모바일: `grid-cols-2 gap-3` → 2열 3행 (compact)
- 카드 패딩 모바일 축소 (`p-4` → `p-3`)

### 카드 순서
1. 아파트 매매
2. 아파트 전월세
3. 오피스텔 매매
4. 오피스텔 전월세
5. 빌라 매매
6. 빌라 전월세

(주택 유형 묶음 우선: 아파트 → 오피스텔 → 빌라. 거래 유형은 하위 정렬.)

### 링크
- `/real-estate/${type}` (예: `/real-estate/apt-sale`, `/real-estate/apt-rent`)
- `HardLink` 유지 (SSR 시 풀 페이지 네비게이션)

### SSR fetch
`index.vue`에서:
```ts
const { data: summary } = await useAsyncData(
  'real-estate-hub-summary',
  () => $fetch<HubSummaryResponse>(`${apiBase}/api/real-estate/hub-summary`),
  { default: () => null }
)
```

- 에러 시 `null` → 자식 컴포넌트가 placeholder 처리
- `useAsyncData` 키로 hydration mismatch 방지

## SEO 변경

### ItemList 스키마
기존 3개 → 6개로 확장:
```ts
setItemListSchema([
  { name: '아파트 매매',     url: '/real-estate/apt-sale' },
  { name: '아파트 전월세',   url: '/real-estate/apt-rent' },
  { name: '오피스텔 매매',   url: '/real-estate/offitel-sale' },
  { name: '오피스텔 전월세', url: '/real-estate/offitel-rent' },
  { name: '빌라 매매',       url: '/real-estate/villa-sale' },
  { name: '빌라 전월세',     url: '/real-estate/villa-rent' },
])
```

### 본문 시그널
- 카드 6개에 실측 수치 노출 → 정적 페이지 시그널 약화
- 내부 링크 6개 (모두 색인 대상 hub URL)

### 미변경
- `<title>`, `<meta description>`, canonical, OG, breadcrumb, Dataset 스키마는 그대로.

## 테스트

### 백엔드 (vitest)
- `realEstateHubSummaryService` 유닛 테스트
  - 6개 키 모두 반환
  - 캐시 hit/miss 동작 (TTL 만료)
  - in-flight 공유 (동시 호출 시 쿼리 1회)
  - 일부 쿼리 실패 시 해당 타입 null
- 라우트 테스트
  - 200 응답 스키마
  - 응답 캐시 hit 시 동일 `generatedAt`

### 프론트 (vitest)
- `RealEstateCategoryCards.test.ts`
  - `summaries` 없을 때 6장 카드 + placeholder
  - `summaries` 있을 때 수치 포맷팅 (`12,431`)
  - 매매/전월세 뱃지 렌더
  - `null` count 시 "데이터 동기화 중"
- `index.vue` 테스트는 기존 mock 패턴 따름

### 회귀
- 기존 부동산 hub 페이지 e2e/SEO 회귀 가드가 있다면 통과 확인

## 마이그레이션 / 롤백

- DB 스키마 변경 없음 → 마이그레이션 불필요
- 롤백은 PR 리버트 한 번으로 완전 복원
- 캐시 TTL/엔드포인트 라우팅 외 신규 운영 부담 없음

## 작업 분할 (TDD)

1. 백엔드 서비스 + 테스트 (`realEstateHubSummaryService`)
2. 백엔드 라우트 + 테스트
3. 프론트 컴포넌트 + 테스트 (`RealEstateCategoryCards`)
4. 프론트 페이지 fetch 결선 + 스키마 확장
5. 수동 검증 (dev 서버에서 카드 렌더, 수치 표시, 404 케이스)

각 단계 별도 커밋, 전체 1 PR.

## 오픈 이슈

없음. 모든 결정 사항 확정.
