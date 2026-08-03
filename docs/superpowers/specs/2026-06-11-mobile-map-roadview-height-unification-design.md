# 모바일 지도/로드뷰 높이 통일 (A안)

- **작성일**: 2026-06-11
- **범위**: 프론트엔드, 모바일 한정 (데스크톱 픽셀 불변)
- **목표**: 전 상세페이지에서 지도뷰와 로드뷰의 모바일 높이를 단일 표준값으로 통일하고, 단일 소스로 중앙화해 재발을 방지한다.

## 문제 정의

모바일 상세페이지에서 지도뷰(Kakao Map)와 로드뷰(Kakao Roadview)의 높이가 페이지마다, 그리고 같은 페이지 안에서도 어긋나 보인다.

현재 모바일 실측값:

| 페이지 | 모바일 지도 | 모바일 로드뷰 | 불일치 |
|--------|-----------|-------------|--------|
| 시설(facility) | 220px | 200px | 20px |
| 지하철(subway) | 220px | 200px | 20px |
| 부동산(real-estate) | 220px | 200px | 20px |
| 청약(subscription) | 240px | 200px | **40px** |
| 공매(auction) | 200px | 200px | 일치 |

데스크톱은 대부분 300px로 이미 일치(시설·지하철은 사이드바 `aspect-square` 지도만 있고 로드뷰 없음 — 구조가 다름).

### 근본 원인

1. `frontend/components/facility/FacilityRoadview.vue:3` 가 자기 높이 `h-[200px] md:h-[240px]` 를 하드코딩 → 부모가 220px를 줘도 200px로 표시.
2. 각 상세페이지가 지도/로드뷰 래퍼 높이를 **각자 직접** 박음(220/240/200 혼재). 단일 소스가 없어 계속 어긋난다.
3. auction/real-estate/subscription은 `.roadview-wrapper :deep(> div){height:100%!important}` 로 로드뷰를 부모 높이에 강제로 맞추는 우회책을 부분 적용 중. 시설·지하철은 이 우회책이 없어 `FacilityRoadview` 기본 높이(200)가 그대로 노출됨.

## 설계 원칙

> **로드뷰는 높이를 스스로 정하지 않고 부모가 정한다. 그 부모 높이는 단일 상수에서 온다.**

- 모바일 표준 높이: **220px** (가장 많은 페이지가 쓰는 지도 높이)
- 데스크톱 표준 높이: **300px** (기존 유지)

## 변경 사항

### 변경 1 — 공유 상수 신설

신규 파일 `frontend/utils/mapMedia.ts`:

```ts
/** 상세페이지 지도·로드뷰 공통 높이 (모바일 220 / 데스크톱 300) */
export const DETAIL_MAP_MEDIA_HEIGHT = 'h-[220px] md:h-[300px]'
```

- 단일 소스 오브 트루스. 향후 높이 조정은 이 한 줄만 수정.
- **구현 시 확인사항**: Tailwind content 글롭에 `utils/**` 가 포함되는지 검증. 미포함 시 JIT가 `h-[220px]`/`md:h-[300px]` 클래스를 생성하도록 `tailwind.config` content를 보강한다. (참고: 동일 리터럴이 이미 real-estate 템플릿에 존재하여 사실상 생성되지만, 상수 파일이 유일한 출처가 되는 경우를 대비한 안전망 점검.)

### 변경 2 — FacilityRoadview를 부모 채움(`h-full`)으로

`frontend/components/facility/FacilityRoadview.vue:3`

- `h-[200px] md:h-[240px]` → `h-full`
- 효과: 로드뷰가 항상 부모 래퍼 높이를 따름. auction/real-estate/subscription의 `:deep()` override가 하던 일을 컴포넌트 기본 동작으로 승격.
- 기존 `:deep()` override 블록은 **중복이 되지만 리스크 최소화를 위해 그대로 유지**한다(`h-full` 과 동일 결과라 무해). 정리는 선택적 후속 작업.
- 부작용 방지: 시설·지하철은 현재 로드뷰를 **높이 래퍼 없이** 렌더(`FacilityRoadview` 자기 200px에 의존). `h-full`로 바꾸면 높이가 0으로 무너지므로, 변경 3에서 **높이 래퍼를 새로 감싼다**.
- `rounded-xl border border-slate-200 bg-slate-100` 등 나머지 클래스 및 absolute 오버레이(loading/unavailable, `absolute inset-0`)는 그대로 유지. `h-full` 부모에서 정상 동작.

### 변경 3 — 렌더 지점에 상수 적용

| 파일:라인 | 현재 | 변경 후 |
|-----------|------|---------|
| `pages/[category]/[id].vue:140` 모바일 지도 래퍼 | `h-[220px]` | 상수 적용(=220 유지) |
| `pages/[category]/[id].vue:157` 로드뷰 | 높이 래퍼 없음(200) | **높이 래퍼 신설**(height-only, 보더 미부여) → 220 |
| `pages/subway/[slug].vue:139` 모바일 지도 래퍼 | `h-[220px]` | 상수 적용(=220 유지) |
| `pages/subway/[slug].vue:156` 로드뷰 | 높이 래퍼 없음(200) | **높이 래퍼 신설**(height-only) → 220 |
| `pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:119` 지도 | `h-[220px] md:h-[300px]` | 상수 적용(동일) |
| `pages/real-estate/.../[buildingName].vue:135` 로드뷰 래퍼 | `h-[200px] md:h-[300px]` | 상수 적용 → 모바일 200→**220** |
| `pages/subscription/[id].vue:5` 모바일 히어로 지도 | `h-[240px]` | 모바일 240→**220** |
| `pages/subscription/[id].vue:319` 모바일 로드뷰 래퍼 | `h-[200px]` | 220 |
| `pages/subscription/[id].vue:302,311` 데스크톱 지도/로드뷰 | `h-[300px]` | 유지(이미 일치) |
| `components/auction/AuctionMap.vue:66,71` 지도/로드뷰 | `h-[200px] md:h-[300px]` | 상수 적용 → 모바일 200→**220** |

- 데스크톱은 전부 300px로 이미 일치 → 변경하지 않는다.
- 시설·지하철 데스크톱 사이드바(`aspect-square`, 로드뷰 없음)는 불변.
- 상수가 모바일·데스크톱을 한 클래스(`h-[220px] md:h-[300px]`)로 묶으므로, 데스크톱이 300px가 아니어야 하는 자리(예: subscription 모바일 히어로는 md:hidden이라 무관)는 적용 맥락을 확인해 동일 결과가 되도록 한다. 모바일 전용 블록(`md:hidden`)에는 모바일 높이만 의미가 있다.

### 보더/라운드 처리

- 시설·지하철 신규 로드뷰 래퍼는 **높이만** 부여하고 보더/라운드는 부여하지 않는다. `FacilityRoadview` 자체가 `rounded-xl border-slate-200` 를 가지므로 이중 보더를 방지.
- 기존 지도 래퍼의 `border-line` 과 로드뷰의 `border-slate-200` 색상 차이는 **이번 작업 범위 밖**(사이징 한정). 필요 시 별도 폴리시 작업으로 분리.

## 비범위 (Out of scope)

- 데스크톱 레이아웃/높이 변경.
- 지도·로드뷰 보더 색상 통일.
- 공유 래퍼 컴포넌트(`<DetailMapMedia>`) 신설(= 검토했던 B안). 구조가 페이지별로 달라 리스크가 커 채택하지 않음.

## 테스트 & 검증

- **단위 테스트**: 높이는 스냅샷/로직과 무관하므로 기존 vitest에 영향 없을 것으로 예상. `cd frontend && npm run test` 로 회귀 확인. 실패 시 즉시 수정.
- **수동 검증**: 모바일 뷰포트(375px)에서 시설·지하철·부동산·청약·공매 상세 5종 각각 지도 높이 == 로드뷰 높이(220px) 육안 확인.
- **린트**: `cd frontend && npm run lint`.

## 영향 범위

- 신규 1파일: `frontend/utils/mapMedia.ts`
- 수정 6파일: `FacilityRoadview.vue`, `pages/[category]/[id].vue`, `pages/subway/[slug].vue`, `pages/real-estate/.../[buildingName].vue`, `pages/subscription/[id].vue`, `components/auction/AuctionMap.vue`
- 모바일 한정. 데스크톱 픽셀 불변.

## 워크플로우

- PR 기반 작업, develop 대상. main 직접 커밋 금지. CI 통과 후 머지.
- Node 20 (`nvm use 20`) 기준.
