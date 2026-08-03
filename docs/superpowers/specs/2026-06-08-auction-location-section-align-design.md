# 공매 상세 위치 섹션을 부동산 상세와 일치 — 설계

- 날짜: 2026-06-08
- 브랜치: `feature/auction-pages`
- 대상 파일: `frontend/components/auction/AuctionMap.vue` (단일 컴포넌트), 테스트 `frontend/tests/components/auction/AuctionMap.test.ts`

## 배경 / 문제

공매 물건 상세(`pages/auction/item/[cltrMngNo].vue`)의 `위치` 섹션(`AuctionMap.vue`)이
부동산 건물 상세(`pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`)의
`위치와 로드뷰` 섹션과 시각·구조가 달라 일관성이 깨진다. 특히 공매 쪽은:

- 이모지 캡션 라벨(`🗺️ 지도` / `🛣️ 로드뷰`)을 사용 — 부동산엔 없음 (AI 슬롭성 노이즈)
- `useKakaoMap`을 직접 호출하는 자체 구현 — 부동산은 `FacilityMap` + `FacilityRoadview` 재사용
- 박스 스타일(`rounded-lg`, `bg-slate-100`, `h-64`) / 로드뷰 미제공 안내(이모지) 불일치
- 헤딩 `위치`(서브텍스트 없음) vs `위치와 로드뷰` + 서브텍스트
- 우측 길찾기 액션 없음

## 결정 (사용자 확정)

- **맞춤 범위**: 컴포넌트 재사용 방식 (raw `useKakaoMap` → `FacilityMap` + `FacilityRoadview`)
- **우측 액션**: 길찾기(카카오맵/네이버맵) 드롭다운만 추가. 공유 버튼은 제외(공매는 링크 공유 수요 낮음)
- **모바일 상단 지도 히어로**: 제외 (full parity 아님)

## 변경 상세 — `frontend/components/auction/AuctionMap.vue`

전면 재작성. 최종 형태:

### 헤딩
```
SectionBlock heading="위치와 로드뷰"
  subtext="지도와 로드뷰로 주변을 바로 확인할 수 있습니다."
```

### 우측 슬롯 (`#right`, `hidden md:flex`)
길찾기 드롭다운만. 부동산 동일 패턴:
- 카카오맵 길찾기: `https://map.kakao.com/link/to/${encodeURIComponent(label)},${lat},${lng}`
- 네이버맵 길찾기: `https://map.naver.com/v5/directions/-/${lng},${lat},${encodeURIComponent(label)}/-/walk`
- `label`은 건물명 대신 `props.address`(없으면 `'위치'`) 사용
- 상태: `showNavDropdown = ref(false)`, 함수 `openNavigation(url)` → `window.open(url, '_blank')` 후 드롭다운 닫기
- 아이콘/마크업은 부동산 `#right` 슬롯의 길찾기 부분만 그대로 차용 (공유 버튼 부분 제외)

### 본문 레이아웃
```
<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
  <!-- 지도: 모바일에서도 노출 (hidden md:block 붙이지 않음) -->
  <div class="rounded-xl border border-line overflow-hidden h-[200px] md:h-[300px]">
    <ClientOnly>
      <FacilityMap :center="{ lat, lng }" :facilities="[marker]" :level="3" />
    </ClientOnly>
  </div>
  <!-- 로드뷰 -->
  <div class="roadview-wrapper rounded-xl border border-line overflow-hidden h-[200px] md:h-[300px]">
    <FacilityRoadview :lat="lat" :lng="lng" />
  </div>
</div>
<p v-if="address" class="mt-2 text-caption text-slate-500">{{ address }}</p>
```

`marker`는 기존 객체 형태 재사용 (FacilityMap `:facilities` 와 호환 확인됨):
```
{ id: 'auction', name: address ?? '위치', category: 'parking',
  address: null, roadAddress: null, lat, lng, city: '', district: '' }
```

### scoped CSS (부동산과 동일 — FacilityRoadview를 300px 래퍼에 맞춤)
```
.roadview-wrapper :deep(> div) { height: 100% !important; }
.roadview-wrapper :deep(> div > div) { height: 100% !important; }
```

### 제거 대상
- 이모지 라벨 `<p>🗺️ 지도</p>` / `<p>🛣️ 로드뷰</p>`
- `useKakaoMap`의 `initMap` / `addMarkers` / `initRoadview` 직접 호출 및 관련 `onMounted` / `mapEl` / `roadviewEl` / `roadviewAvailable` ref
- 자체 로드뷰 미제공 플레이스홀더(이모지 🛣️) — `FacilityRoadview`가 `visibility_off` 아이콘 + "이 위치의 로드뷰를 지원하지 않습니다"로 자동 처리

## 부동산과 의도적으로 다른 점

- 지도에 `hidden md:block`을 붙이지 않는다. 부동산은 모바일 상단 240px 지도 히어로가 별도로 있어 섹션 내 지도를 모바일에서 숨기지만, 공매는 그 히어로가 없으므로 섹션 내 지도가 유일한 지도 → 모바일에서도 노출해야 한다.
- 공유 버튼 미포함.

## 페이지(`[cltrMngNo].vue`) 변경

없음. `<AuctionMap v-if="item.lat != null && item.lng != null" :lat :lng :address>` 호출은 그대로 유지(props 시그니처 불변).

## 테스트 — `frontend/tests/components/auction/AuctionMap.test.ts`

- 이모지 라벨(`🗺️ 지도` / `🛣️ 로드뷰`) 단언 제거
- `FacilityMap` / `FacilityRoadview` 컴포넌트 스텁으로 렌더되는지 확인
- 헤딩 `위치와 로드뷰` 노출 확인
- 길찾기 드롭다운 토글 동작(클릭 시 `showNavDropdown` 토글, 카카오/네이버 링크 존재) 확인
- 기존에 검증하던 SectionBlock(`data-testid="auction-map"`) 렌더 유지

## 검증 절차 (Node 20)

```
cd frontend
nvm use 20
npx vitest run tests/components/auction/AuctionMap.test.ts
npm run lint
```

기존 다른 테스트 회귀 없는지 필요 시 `npm run test` 전체 1회.

## 범위 밖 (YAGNI)

- 모바일 상단 지도 히어로 / 전체화면 지도 오버레이
- 공유 버튼 및 공유 로직
- 길찾기 클릭 애널리틱스(`trackDirectionsClick`) — 필요해지면 후속으로 추가
