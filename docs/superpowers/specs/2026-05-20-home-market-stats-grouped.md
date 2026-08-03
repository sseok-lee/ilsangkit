# 오늘의 부동산 시장 카드 — 부동산 타입별 그룹화 (3 카드 × 3 행)

- 작성일: 2026-05-20
- 영향 영역: `backend/src/services/metaService.ts`, `backend/src/types/homeDashboard.ts`, `frontend/components/home/HomeMarketStats.vue`, `frontend/composables/useHomeDashboard.ts`

## 1. 배경

직전 작업(PR #287)에서 통계 카드를 6개 슬롯으로 확장했으나 카드별 정보 밀도가 낮고 부동산 타입 간 비교가 어려웠다. 사용자는 한 카드 안에서 한 타입의 매매·전세·월세를 한눈에 비교하고 싶어한다.

## 2. 변경 결과

3 카드 × 3 행 그리드.

- 카드: 아파트 / 오피스텔 / 빌라
- 행: 매매 / 전세 / 월세
- 각 행 데이터: 평균가 · 거래량 · 전주 대비 변동률
- 데이터 0건 셀: 가격/거래량/변동률 모두 `—` 표시, 행 자체는 유지 (레이아웃 안정)
- 각 행 독립 클릭: 매매 행 → `/real-estate/{type}-sale`, 전세/월세 행 → `/real-estate/{type}-rent`
- 데스크톱 3컬럼, 모바일 1컬럼 stack

## 3. 백엔드

### 신규 슬롯 (3개 추가, 총 9개)

| key | 데이터 |
|---|---|
| `villa-rent-jeonse` | VillaRentTransaction WHERE rentType='전세' · AVG(deposit) · 만원 |
| `villa-rent-wolse` | VillaRentTransaction WHERE rentType='월세' · AVG(monthlyRent) · 만원/월 |
| `offitel-rent-wolse` | OffitelRentTransaction WHERE rentType='월세' · AVG(monthlyRent) · 만원/월 |

### 변경 파일

**`backend/src/types/homeDashboard.ts`**
```typescript
key:
  | 'apt-sale' | 'apt-rent-jeonse' | 'apt-rent-wolse'
  | 'villa-sale' | 'villa-rent-jeonse' | 'villa-rent-wolse'
  | 'offitel-sale' | 'offitel-rent-jeonse' | 'offitel-rent-wolse';
```

**`backend/src/services/metaService.ts`**
- 3개 헬퍼 추가: `aggregateVillaRentJeonseRange`, `aggregateVillaRentWolseRange`, `aggregateOffitelRentWolseRange`
- 기존 `aggregateRentWolseRange` (현재 apt rent wolse 전용)는 일반화하거나 같은 패턴 복제 — 일관성을 위해 복제 권장 (raw SQL 테이블명이 하드코딩됨)
- `getRealEstateTrends()`가 9개 슬롯 반환, `Promise.all`에 18개 호출 (9 current + 9 prev)
- 응답은 평면 배열 유지

### 응답 구조 (변경 최소)

```typescript
realEstateTrends: RealEstateTrend[]  // length 9
```

평면 배열 유지 — 프론트에서 `propertyType` 추출해 그룹핑.

## 4. 프론트엔드

### `frontend/composables/useHomeDashboard.ts`
- `RealEstateTrend.key` union 9개로 확장 (백엔드와 lockstep)

### `frontend/components/home/HomeMarketStats.vue` (재작성)

**Props**: `{ trends: RealEstateTrend[] }` 그대로.

**그룹핑 유틸**:
```typescript
const PROPERTY_TYPES = [
  { id: 'apt', label: '아파트', icon: 'apartment', baseRoute: 'apt' },
  { id: 'offitel', label: '오피스텔', icon: 'corporate_fare', baseRoute: 'offitel' },
  { id: 'villa', label: '빌라', icon: 'house', baseRoute: 'villa' },
] as const

const TXN_ROWS = [
  { id: 'sale', label: '매매', urlSuffix: 'sale' },
  { id: 'jeonse', label: '전세', urlSuffix: 'rent' },
  { id: 'wolse', label: '월세', urlSuffix: 'rent' },
] as const

function findTrend(trends, propertyType, txnType) {
  const key = txnType === 'sale'
    ? `${propertyType}-sale`
    : `${propertyType}-rent-${txnType}`
  return trends.find(t => t.key === key) ?? null
}
```

**렌더**: 3개 카드를 `v-for` PROPERTY_TYPES. 각 카드 안에 3행을 `v-for` TXN_ROWS. 각 행은 `HardLink` `/real-estate/{baseRoute}-{urlSuffix}`.

**행 표시**:
- 라벨 (매매/전세/월세) — w-12 또는 w-10 좌측 고정
- 평균가 (`formatPriceManwon`)
- 거래량 (toLocaleString + '건')
- 변동률 — 화살표 + 색상 (기존 패턴 그대로). `|pct|<0.05` 면 `—`

**행 호버**: `hover:bg-primary/5` 배경.

**0 셀**: `null trend` 면 행은 표시되되 모든 값 `—`. 행 클릭은 여전히 가능 (목록 페이지에 들어가면 거래 0인 화면).

**섹션 헤더**: 기존 `오늘의 부동산 시장` 제목 + 부제 그대로. 우측 "전체 보기 →" 도 유지.

### 그리드

```vue
<div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
```

## 5. 엣지 케이스

- **trends 길이 < 9**: 누락 슬롯은 `findTrend()` null 반환 → 행 전체 `—`. 카드는 계속 렌더.
- **모든 슬롯 0건**: 카드는 렌더되고 데이터만 `—`. 섹션 자체는 `v-if="trends.length > 0"` 가드 유지 (백엔드 응답 자체가 빈 경우만 미렌더).
- **신규 아이콘 `house`**: 이미 `nuxt.config.ts` icon_names 에 있음 (PR #287에서 확인). 추가 작업 불필요.

## 6. 테스트

**Backend (`backend/__tests__/services/homeDashboard.test.ts`)**
- mock 12 → 18로 확장 (9 슬롯 × current/prev)
- 결과 배열 길이 9 검증
- 신규 3 슬롯 (`villa-rent-jeonse`, `villa-rent-wolse`, `offitel-rent-wolse`) 정상 계산 검증

**Frontend (`frontend/tests/components/home/HomeMarketStats.test.ts`)**
- `fullTrends` 9개로 확장
- "renders 3 property cards" — 아파트/오피스텔/빌라 3 카드 검증
- "renders 3 rows per card" — 각 카드에 매매/전세/월세 행
- "row links navigate to correct URL" — 매매 행 href ⊃ `apt-sale`, 전세 행 href ⊃ `apt-rent`
- "missing slot renders dashes" — trends에 일부 슬롯 누락 시 `—` 표시
- 기존 "renders nothing when trends empty" 유지

## 7. 범위 외

- 카드 헤더 합계 표기 (예: "총 4,541건")
- 행별 추가 메트릭 (최고가, 단지 수 등)
- 카드 간 비교 시각화 (차트 등)
- Villa-sale-area 같은 면적별 평균
