# 타이포그래피 토큰 강제(2차 PR) — 설계

- 날짜: 2026-05-29
- 대상: `frontend/` (Nuxt 3 + Vue 3 + TailwindCSS v3)
- 선행: 1차(색상·컴포넌트 토큰 강제, PR #354) main 배포 완료
- 범위: 타이포그래피 display 토큰 채택 + `text-primary-600` dedup. **모두 시각적 무손실(zero visual change)**.

## 배경 / 데이터 근거

1차 PR 후속으로 타이포 토큰(`.text-display-1/2/3`, `.text-eyebrow`)을 강제하려 했으나, **워크플로우 전수 분석(63개 heading 파일, 119개 요소 분류)**이 가정을 정정함:

- 무손실 채택 가능한 요소는 **13개뿐**(그중 6개는 이미 토큰 사용 → 실질 신규 7).
- 나머지 106개는 사이즈가 변함(57 shifts-both) 또는 토큰 안 맞음(35 no-match).
- **원인**: 정의된 토큰이 코드베이스의 실제 제목 크기보다 큼. 코드베이스는 이미 자기만의 일관된 더 작은 스케일을 사용:
  - 페이지 H1: `text-2xl md:text-3xl font-bold` = 24/30px·700 (12곳, 일관)
  - 섹션 H2: `text-lg font-bold` = 18px flat·700 (16곳, 일관)
  - 서브 H3: `text-base md:text-lg font-bold` = 16/18px·700

따라서 "토큰을 그대로 채택"하면 제목 70여 곳이 커지는 redesign이 됨(범위 밖). 대신 **토큰을 현실 스케일에 맞춰 재정의한 뒤 무손실 채택**한다.

## 핵심 제약 / 정정 사항

- **display-1 재정의 금지**: `PageHero.vue`가 17개 페이지에서 `display-1`(26/32·800)을 사용 중. 재정의 시 17개 히어로가 전부 바뀜. → 유지.
- **`text-primary-500`은 drift가 아니라 의미색**: `falling`/`하락`/음수 변동률을 파랑으로 표시(상승=red-500)하는 관례 + faq 뱃지(`blue: 'text-primary-500'`). `text-primary-700`은 hover 등 의도된 진한색. → **둘 다 보존.** 안전한 색 정리는 `text-primary-600 → text-primary` dedup뿐.
- **카테고리 색상·AdBanner 배치**: 1차와 동일하게 불가침.

## 설계

### 섹션 1 — 토큰 재정의 (display-2 1개만)

`assets/css/main.css`의 `.text-display-2`를 코드베이스 실제 섹션 H2 스케일(18px·700)로 변경:

```css
/* before */
.text-display-2 {
  font-size: 1.25rem; /* 20px mobile */
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: -0.015em;
}
@media (min-width: 768px) {
  .text-display-2 { font-size: 1.5rem; /* 24px desktop */ }
}
/* after */
.text-display-2 {
  font-size: 1.125rem; /* 18px flat */
  line-height: 1.3;
  font-weight: 700;
  letter-spacing: -0.01em;
}
/* (데스크톱 미디어쿼리 제거 — flat 18px) */
```

- `display-1`(26/32·800), `display-3`(16/18·700), `eyebrow`, `body`, `caption`: **변경 없음**.
- display-2는 현재 마크업에서 미사용(grep 0건)이라 재정의 부작용 없음.
- **알려진 한계**: 재정의 후 데스크톱에서 display-2(18)와 display-3(18)이 동일 크기. 이는 현재 사이트의 압축된 위계(섹션18/서브16~18)를 코드화하는 것으로 시각 회귀 아님. 위계 확대는 향후 별도 "타이포 redesign"으로 분리.

### 섹션 2 — 제목 토큰 채택 (무손실, 정확 매칭만)

**원칙**: drift 제거 ≠ 100% 채택. 재정의된 토큰과 size/weight가 정확히 일치하는 것만 `class` 교체. 형태가 다르면 보존.

**`.text-display-2` 채택 — 16곳** (`text-lg font-bold` 섹션 H2):
`pages/index.vue`(3), `pages/[city]/index.vue`(2), `pages/faq.vue`, `components/category/CategoryIntro.vue`, `components/common/DataSourceCard.vue`, `components/guide/RelatedGuides.vue`, `components/home/HomeHotspotSignals.vue`, `components/home/HomeMarketStats.vue`, `components/home/HomeTrendingBuildings.vue`, `components/region/DistrictSummaryCard.vue`, `components/region/RegionFacilityCategoryGrid.vue`, `components/region/RegionRealEstatePrices.vue`, `components/subscription/HomeSubscriptionSection.vue`

**`.text-display-3` 채택 — 7곳** (`text-base md:text-lg font-bold [leading-tight]`):
`components/region/RegionRealEstateCta.vue`, `pages/real-estate/[realEstateType]/[city]/index.vue`, `pages/real-estate/[realEstateType]/index.vue`, `pages/real-estate/index.vue`(3), `pages/subscription/index.vue`

**`.text-eyebrow` 채택 — 정확 매칭만**(uppercase + 11px + 700 + tracking ≈ 0.08em). 스캔상 ~2곳. 정확히 일치하지 않으면 0곳(억지 채택 안 함).

**제외(보존)**: `text-xl font-semibold` H2(20/600), `text-base`/`text-sm font-bold` 카드 제목(16/14 flat), 12× `text-2xl md:text-3xl font-bold`(24/30, 매칭 토큰 없음), sr-only/14px 소형 라벨 등 no-match 35곳.

**미세 정직성 고지**: 토큰은 size/weight 외 `line-height`·`letter-spacing`도 적용. 단일 줄 제목(대부분)은 시각적 동일, 2줄 줄바꿈 제목만 줄간격이 미세하게 좁아질 수 있음. display-3는 이미 4곳에서 동일 lh/tracking 사용 중(선례). 검증에서 스폿체크.

### 섹션 3 — 색 dedup (안전한 것만)

- `text-primary-600` → `text-primary` (둘 다 #2563eb, 순수 dedup, 무손실): **4파일** — `pages/contact.vue`, `pages/privacy.vue`, `pages/about.vue`, `components/common/AppFooter.vue`.
- **보존**: `text-primary-500`(의미색), `text-primary-700`(hover/의도), `text-primary-800/900/300`(소수 의도적).

### 섹션 4 — 검증

1. `npm run test` / `npm run lint` / `npm run build` 통과. 클래스 단언 테스트가 깨지면 새 토큰으로 갱신.
2. grep 불변식:
   - 채택 후 `text-display-2` 사용처 ≥ 16, `text-display-3` ≥ 11(기존 4 + 신규 7).
   - `text-primary-600` 0건.
   - display-2 재정의로 `text-lg font-bold`가 줄었는지(채택분만큼) 확인.
3. **시각 스폿체크**(dev 서버 + Playwright): 재정의된 display-2가 18px로 렌더(=기존 text-lg와 동일)되는지, 핵심 페이지(홈 `/`, 부동산 `/real-estate`, 시설 `/hospital`, 지역 `/seoul`) before-after 동일 확인.

## 커밋 구조 (PR 1개, 원자 커밋 3개)

PR 기반 워크플로우(develop 기반 새 브랜치 → CI 통과 → 머지) 준수. Node 20.

1. `refactor(ui): display-2 토큰을 실제 18px 스케일로 재정의`
2. `refactor(ui): 섹션·서브 제목 ~23곳 display 토큰 채택 (무손실)`
3. `refactor(ui): text-primary-600 → text-primary dedup`

## 성공 기준

- display-2 토큰 = 18px flat·700로 재정의됨.
- `text-display-2`/`text-display-3` 정확 매칭 헤딩에 채택(≈23곳), 형태 다른 것은 보존.
- `text-primary-600` 0건(→ text-primary), `text-primary-500/700`은 그대로.
- `npm run test`+`lint`+`build` 통과.
- 핵심 페이지 시각 회귀 0(스폿체크 확인).

## 범위 밖 (Out of Scope)

- display-1/display-3 재정의, 본문/캡션 대량 토큰화, 12× page-H1(24/30) 토큰화(매칭 토큰 없음).
- 위계 확대(정규화 업) 등 시각 redesign.
- `text-primary-500/700` 등 의미색 변경.

## 리스크 / 완화

- **줄바꿈 제목의 lh 미세 변화**: 단일 줄 대부분 무영향, display-3 선례 존재. 스폿체크로 확인.
- **display-2/display-3 데스크톱 동일 크기(위계 평탄)**: 현재 상태 코드화이며 회귀 아님. 문서에 명시.
- **테스트 클래스 단언 깨짐**: 검증 1번에서 갱신.
- **과잉 채택**: 정확 매칭만 + 제외 목록으로 완화. 채택 0 허용.
