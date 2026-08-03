# 공매 상세 — 주변 편의시설 설계

**작성일:** 2026-06-08
**상태:** 설계 확정 → 구현 계획 대기
**브랜치:** `feature/auction-pages` (기존)

---

## 1. 목표 (Goal)

공매 물건 상세 페이지에 **반경 1km 내 주변 생활 인프라**(지하철·병원·약국·학교·어린이집·공원)를 보여줘 입지 판단을 돕고, 색인 콘텐츠 깊이를 늘려 SEO·체류시간·애드센스를 강화한다. 우리만 보유한 시설 DB를 활용하는 차별화 포인트(경쟁사 ayo 미제공).

이미 절반 구현됨: 표시 컴포넌트 `AuctionNearbyFacilities.vue` 존재, 반경검색 서비스(`getNearbyFacilities`, `findNearbyStations`) 존재, 물건 좌표는 geocoding으로 확보 완료.

## 2. 범위 (Scope)

### 포함
- 카테고리 6종: **지하철역, 병원(hospital), 약국(pharmacy), 학교(school), 어린이집(childcare), 공원(park)**
- 반경 **1km**, 카테고리당 **최근접 3개** + 거리(m)
- 백엔드 `getItemDetail` 응답에 `nearbyFacilities` 추가 (SSR 단일 응답 → 색인 HTML 포함)
- 프론트: 우측 컬럼 **"같은 지역 물건" 아래** 배치, 빈 카테고리/전부 없음 시 숨김

### 제외
- 나머지 시설(화장실·쓰레기·와이파이·의류수거함·AED·도서관·EV충전·체육·전통시장·주차장) — 입지 신호 약함
- 시설 지도 마커 표기(현재 지도는 물건 위치만) — 후속
- 좌표 없는 물건 — 호출 스킵(섹션 미표시)

## 3. 데이터 흐름

```
getItemDetail(cltrMngNo)
  └ item.lat/lng 있으면 → 병렬 조회:
      · subwayService.findNearbyStations(lat, lng, 1000) → top3
      · facilityService.getNearbyFacilities(cat, lat, lng, 1000) for cat in [hospital,pharmacy,school,childcare,park] → 각 top3
  └ nearbyFacilities: NearbyFacility[] 반환 (category, categoryLabel, name, distance)
```

- 기존 서비스 재사용. `getNearbyFacilities`는 거리 계산·정렬·radius 필터 내장, `findNearbyStations`는 지하철 전용(별도 데이터셋).
- 각 카테고리 결과를 `slice(0,3)`로 제한, distance(m) 포함.
- 카테고리 라벨은 `CATEGORY_*_LABEL` 또는 하드코딩 매핑(지하철역/병원/약국/학교/어린이집/공원).

## 4. 백엔드 (`auctionService.ts`)

`getItemDetail` 확장:
```ts
export interface NearbyFacility {
  category: string;       // 'subway' | 'hospital' | ...
  categoryLabel: string;  // '지하철역' | '병원' | ...
  name: string;
  distance: number;       // m (반올림)
}
// getItemDetail 반환에 nearbyFacilities: NearbyFacility[] 추가 (좌표 없으면 [])
```

- `computeNearbyFacilities(lat, lng)` 헬퍼: 6개 소스 병렬(`Promise.all`) → 각 top3 → flat. 카테고리 순서 고정(지하철→병원→약국→학교→어린이집→공원).
- 각 소스 호출은 try/catch로 격리(한 카테고리 실패해도 나머지 반환).
- item에 lat/lng 없으면 `nearbyFacilities: []`.
- serializeRow 영향 없음(별도 배열).

## 5. 프론트엔드

- `types/auction.ts`: `NearbyFacility` 인터페이스 + `AuctionItemDetailResult`에 `nearbyFacilities: NearbyFacility[]` 추가.
- `AuctionNearbyFacilities.vue`: 기존 props `facilities: Array<{category,name,distance?}>` 사용. **categoryLabel을 표시에 쓰도록 prop 확장**(`category` 코드 대신 라벨 노출) + 카테고리별 그룹 헤더(선택). 빈 배열이면 `v-if`로 숨김(이미 그렇게 동작).
- `pages/auction/item/[cltrMngNo].vue`: 우측 컬럼에서 **"같은 지역 물건" 아래**에 `<AuctionNearbyFacilities :facilities="data.nearbyFacilities" />` 추가.

## 6. 성능

- top3 × 6 = 가벼운 bounding-box 쿼리(서비스 내장), 1km 한정. 좌표 없으면 스킵.
- SSR 1회 응답에 포함 → 추가 클라 요청 없음.

## 7. 테스트

- 백엔드: `computeNearbyFacilities`/`getItemDetail` — 카테고리별 top3 제한·distance·좌표없음→[] (prisma/service mock).
- 프론트: `AuctionNearbyFacilities` — 렌더(라벨·거리), 빈 배열 숨김.

## 8. 리스크

- 군 단위 임야·전·답은 반경 내 시설 없음 → 섹션 자동 숨김(정상).
- 지하철 데이터는 수도권·광역시 위주 → 지방은 지하철 항목 비는 게 정상.
