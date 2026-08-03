# 시설 상세페이지 히어로 영역 디자인 스펙

- 작성일: 2026-05-12
- 범위: `frontend/pages/[category]/[id].vue` (시설 카테고리 15종)
- 적용 컴포넌트: `frontend/components/common/PageHero.vue` (확장) + 카테고리별 stats 매핑 로직

## 1. 배경과 문제

현재 `PageHero`는 [eyebrow / H1 / description / stats grid]의 한 가지 골격을 모든 카테고리에 공통 적용한다. 가장 큰 사용자 문제는 **"히어로에서 사용자가 다음에 할 행동을 못 찾는다"**는 것이다. 길찾기·전화·공유 같은 핵심 CTA가 히어로에 없거나 다른 위치에 흩어져 있어, 모바일 사용자가 부착해서 행동을 잇기 어렵다.

## 2. 결정한 전략

**B안 — 균일 구조 × 조건부 표시.**

- 모든 카테고리 히어로는 **동일한 골격**을 사용한다.
- 일부 슬롯(운영상태 배지, 전화 버튼, stats 라벨)은 카테고리/데이터 존재 여부에 따라 **조건부로 등장**한다.
- 카테고리별 매핑은 `backend/src/services/facilityService.ts`의 `CATEGORY_REGISTRY`와 짝을 이루는 프론트 측 메타에 선언적으로 정의한다.

채택 이유: 한 컴포넌트로 일관성을 유지하면서도 데이터 풍부도가 다른 15종의 정체성을 손상시키지 않는다. 카테고리별 컴포넌트 분기를 도입하면 유지보수 비용이 누적된다.

## 3. 히어로 구성 (모바일 우선)

### 3.1 모바일 (<md)

```
┌─────────────────────────────┐
│  지도 (현행 240px)             │ ← 현행 유지. 좌상단 ← 버튼 + 이름 pill,
│  📍                          │   좌하단 "지도 크게 보기" 버튼.
└─────────────────────────────┘
   홈 › 약국                ↗ 공유   ← breadcrumb + 우측 공유 버튼
┌─────────────────────────────┐
│  [약국]                      │  eyebrow chip (카테고리 라벨)
│  온누리약국 종로점  [영업중]    │  H1 + 운영상태 배지(조건부)
│  서울 종로구 종로 1가          │  주소 한 줄 (description은 주소만)
│  ─────────────────────────  │
│  평일 09–24  토 09–22 …      │  stats 그리드 최대 3개
│  ─────────────────────────  │
│  [🧭 길찾기] [📞 전화] [↗ 공유]│  CTA 행
└─────────────────────────────┘
```

### 3.2 데스크톱 (≥md)

좌측 메인 컬럼에 카드 그대로, 우측 sticky 사이드바에 지도(현행 유지). 모바일 상단 지도 블록은 제거된다.

```
┌──────────────────────┬──────────┐
│  홈 › 약국 › 종로구  │           │
│  ┌──────────────────┐│   📍     │
│  │ [약국]           ││  지도    │
│  │ 온누리약국 [영업중]││  sticky │
│  │ 서울 종로구...    ││          │
│  │ stats × 3        ││          │
│  │ [길찾기][전화][공유]│          │
│  └──────────────────┘│          │
└──────────────────────┴──────────┘
```

데스크톱에서는 CTA 라벨을 더 풍부하게 표시 가능: `🧭 카카오맵에서 길찾기`, `📞 02-732-XXXX` 등.

## 4. CTA 정책

| 액션 | 등장 조건 | 비고 |
|---|---|---|
| 🧭 길찾기 | **항상** (primary) | 클릭 시 인라인 dropdown으로 [카카오맵 / 네이버맵] 두 가지 길찾기 옵션 노출. |
| ↗ 공유 | **항상** | Web Share API + 폴백으로 링크 복사. breadcrumb 우측에도 동일 버튼이 있으므로 카드 안에서는 마지막 위치. |
| 📞 전화 | **조건부** | `facility.phone` 필드가 있을 때만 등장. 데스크톱은 번호를 라벨로 노출. |

히어로에서 제외된 후보: 좌표 복사, 로드뷰 열기, 주변 같은 종류 더보기, 가격 해시태그. 모두 본문(`DetailBasicInfo`, `FacilityRoadview`, `DetailNearby`) 영역에 이미 존재하므로 히어로에 중복 배치하지 않는다.

### 4.1 기존 sticky 하단 CTA 제거

현재 `[id].vue:204`–`232`(데스크톱 사이드바 하단) / `[id].vue:246`–`279`(모바일 fixed bottom)에 존재하는 [공유·길찾기] sticky CTA 블록과 그에 따른 `showNavDropdown`/`showMobileNavDropdown` 상태, mobile 하단 padding spacer(`[id].vue:278`–`279`)를 **모두 제거**한다.

이유:
- 히어로 CTA가 동일 액션 + 더 풍부한 세트(전화 포함)를 제공하므로 sticky는 정보 밀도만 잡아먹는 중복.
- 모바일 sticky는 safe-area를 영구 점유해 본문 가시 영역을 축소시킴.
- 카카오/네이버 dropdown 기능은 히어로 길찾기 버튼으로 이동.

## 5. 운영상태 배지

H1 옆 인라인 배지. 3가지 상태:

| 상태 | 배지 텍스트 | 색 (Tailwind) |
|---|---|---|
| 영업 중 | `영업중` | `bg-green-100 text-green-700` |
| 영업 종료 / 접근 제한 시간 | `마감` 또는 `접근 제한 시간` | `bg-red-100 text-red-700` |
| 24시간 운영 | `24시간` | `bg-indigo-100 text-indigo-700` |

판정 로직은 현재 페이지 안에 흩어진 `hospitalOperatingHours / aedOperatingHours / pharmacyOperatingHours` 계산 결과를 그대로 활용. 배지는 운영시간 데이터를 가진 카테고리에서만 등장:

- 등장: `pharmacy`, `hospital`, `library`, `childcare`, `market`, `sports`, `aed`, `park`
- 미등장: `parking`, `ev-charger`, `wifi`, `clothes`, `toilet`(24시간 명시 시만), `school`

판정이 불가능(데이터 부족)할 땐 배지를 숨긴다 — 잘못된 정보보다 누락이 안전하다.

## 6. Stats 정책

- 최대 **3개**. 카테고리별 라벨 매핑이 정확히 3개를 채울 수 없으면 빈 슬롯을 두지 말고 1~2개만 표시.
- 라벨은 8px uppercase, 값은 11~14px bold. 한 줄에 맞도록 `break-keep`.
- 카테고리별 권장 매핑 (초기값, 데이터 확인 후 조정 가능):

| 카테고리 | stat 1 | stat 2 | stat 3 |
|---|---|---|---|
| toilet | 남/여 | 장애인용 | 기저귀교환대 |
| wifi | 운영기관 | 설치형태 | — |
| clothes | 관리부서 | — | — |
| parking | 기본요금 | 총면수 | 운영시간 |
| aed | 개방시간 | 위치층 | 관리책임자 |
| library | 운영시간 | 휴관일 | 좌석수 |
| hospital | 진료시간 | 진료과목 | 응급실 |
| pharmacy | 평일 | 토요일 | 일요일 |
| park | 개방시간 | 면적 | 운동시설 |
| school | 학교급 | 학생수 | 운동장 |
| market | 운영시간 | 점포수 | 주차 |
| childcare | 운영시간 | 정원 | 유형 |
| ev-charger | 충전기수 | 충전속도 | 운영시간 |
| sports | 종목 | 운영시간 | 예약여부 |

값이 없으면 슬롯 자체를 생략(빈 — 표시 금지).

## 7. 컴포넌트 변경 사항

### 7.1 `frontend/components/common/PageHero.vue`

현재 props: `eyebrow`, `title`, `description`, `stats`. 다음을 추가한다:

```ts
interface OperatingBadge {
  label: string                    // '영업중' | '마감' | '24시간' 등
  variant: 'open' | 'closed' | 'always'
}

interface HeroAction {
  type: 'directions' | 'phone' | 'share'
  label: string                    // 모바일/데스크톱에서 다르게 들어옴
  href?: string                    // tel:..., https://map.kakao.com/...
  primary?: boolean
}

withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  description?: string
  stats?: Stat[]
  badge?: OperatingBadge | null    // 신규
  actions?: HeroAction[]           // 신규 — 비어있으면 CTA 행 숨김
}>(), { ... })
```

기존 `slot="search"`, `slot="sidebar"`는 다른 페이지(목록·검색)에서도 쓰이므로 유지.

### 7.2 `frontend/pages/[category]/[id].vue`

`PageHero` 호출부에 `:badge`와 `:actions` 바인딩 추가. 카테고리 분기는 페이지가 아닌 메타 헬퍼에서:

```ts
// frontend/utils/facilityHeroMeta.ts (신규)
export function buildHeroBadge(category, facility, operatingHours): OperatingBadge | null
export function buildHeroActions(category, facility): HeroAction[]
export function buildHeroStats(category, facility): Stat[]    // 기존 desktopHeroStats 대체
```

페이지에서는 위 헬퍼만 호출. 라벨 매핑 변경 시 페이지 코드 수정 불필요.

### 7.3 모바일 지도 블록

현행 240px 지도 + 오버레이는 유지. 단 카드 위 ↔ 카드 사이 간격은 `pt-3`로 조정해 카드가 지도와 시각적으로 이어지도록 한다.

## 8. 스코프에서 제외

- `trash`(쓰레기 일정), 가이드, 지하철, 부동산, 청약, 공공임대 상세 페이지는 이번 스펙 대상이 아님.
- 본문 섹션(`DetailBasicInfo`, `DetailFacilityStatus`, `DetailNearby`, `DetailContextLinks`)은 변경하지 않음. 단 히어로에 올라간 stats가 본문에서 중복 표시되는 경우 본문에서 제거할지는 구현 PR에서 케이스별로 판단.

## 9. 검증 기준

- 15개 카테고리 모두에서 히어로가 깨지지 않고 렌더링.
- 배지 판정 로직이 잘못된 상태를 만들지 않는지 약국·병원·도서관 각각에 대해 단위 테스트.
- 전화번호 없는 시설에서 전화 버튼이 사라지는지 확인.
- 모바일/데스크톱 두 뷰포트에서 H1이 절단되지 않고 stats가 3열 그리드를 유지.
- Lighthouse CLS가 현재 대비 악화되지 않음.

## 10. 미해결 / 후속 결정

- 데스크톱에서 stats 라벨/값의 폰트 사이즈 정확한 수치 (구현 시 디자인 토큰 검토).
- AED `접근 제한 시간` 배지 카피가 위협적이지 않은 더 나은 문구가 있는지 (UX 카피 검토 단계 추후).
- 전화 버튼이 데스크톱에서 번호를 그대로 노출했을 때 길이 초과 케이스 처리.
