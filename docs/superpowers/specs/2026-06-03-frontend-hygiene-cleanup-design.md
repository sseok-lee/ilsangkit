# 프론트엔드 위생 정리 설계 (Frontend Audit ⑥)

- **작성일:** 2026-06-03
- **출처:** `docs/superpowers/specs/2026-06-02-frontend-improvement-audit.md` ⑥ 위생 이슈(낮음)
- **분할:** 1 PR (커밋으로 A/B/C/D 논리 분리)
- **검증:** 단위 테스트 + lint + build. 동작/시각 변화 있는 항목만 신규 테스트.

## 배경

audit ⑥에서 모은 소규모 위생 항목 묶음 — 죽은 코드, 타입 충족용 핵, 그리드 정렬 불일치, 광고 과호출 소지, 이모지 잔재, 용어 혼용. 개별 위험은 낮으나 일관성·정합성을 해친다.

## 확인된 사실 (코드 재확인 완료)

- `pages/index.vue:241` `HomeMarketStats` — import만, 템플릿/어디서도 미사용.
- `pages/search.vue:426` `ComplexCard` — import만. 단지 결과는 인라인 `<NuxtLink>` 카드(228–240행)로 렌더 → import 죽음. (`SearchFilters`는 애초에 import 없음 — 작업 없음.)
- `pages/public-rental/[type]/[id].vue:6-8` `v-if="!rental"` 폴백 — 도달 불가. 81행에서 데이터 없으면 이미 `throw createError(404)`.
- `pages/subscription/[id].vue` `pending = ref(false)`(455행) — 템플릿 4행 로딩 스피너에 쓰이나 어디서도 `true`로 안 됨 → 스피너 영구 미표시.
- `components/common/StaticPageHeader.vue:11` — `<span aria-hidden="true">📅</span>` 이모지.
- `nuxt.config.ts` icon_names에 `calendar_month` **이미 등록됨** → 아이콘 교체에 config/캐시 작업 불필요.
- `components/ads/AdBanner.vue:137` — `watch(() => route.fullPath, …)` → 쿼리 변경(검색 필터)마다 `refresh()`. 페이지 이동 노출은 remount로 별개 처리됨.
- `pages/index.vue:388` quickFacilities 9개 + 그리드 `grid-cols-4 md:grid-cols-8`(117행) → 데스크톱 9번째 외톨이 줄. 각 항목은 `/${q.id}`로 라우팅(`HardLink` + `CategoryIcon`). 16개면 8-col 2줄 정렬.
- 지도 마커 `category: 'toilet' as const` — `pages/subscription/[id].vue:474`, `components/subscription/PublicRentalDetailView.vue:104`. 시설 아님, 마커 타입 충족용 placeholder.
- 용어 혼용 (도메인별 동일 상태/허브의 표기 불일치) — 아래 D 참조.

## 설계

### A. 죽은 코드 제거 (동작 변화 없음, lint/build로 검증)

1. `pages/index.vue` — `HomeMarketStats` import 줄 삭제.
2. `pages/search.vue` — `ComplexCard` import 줄 삭제.
3. `pages/public-rental/[type]/[id].vue` — `v-if="!rental"` 폴백 `<div>` 블록 삭제, `<PublicRentalDetailView v-else …>`의 `v-else`를 일반 렌더로 정리(아래 "구현 주의" 참조).
4. `pages/subscription/[id].vue` — `pending` ref(455행) + 템플릿 로딩 스피너 블록(4행 `v-if="pending"` div) 삭제.

### B. 마이크로 개선

5. `StaticPageHeader.vue:11` — 📅 → `<span class="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">calendar_month</span>`. 인접 텍스트(text-xs)와 정렬되도록 14px. 이미 등록된 아이콘이라 config 변경 없음.
6. `AdBanner.vue:137` — `watch(() => route.fullPath, …)` → `watch(() => route.path, …)`. 같은 path 내 쿼리 변경 시 refresh 미발동. 페이지 이동 시 노출은 불변.
7. `pages/index.vue` quickFacilities — 누락 7개 추가해 16개:
   - 추가 id/라벨(간결형, 기존 스타일): `wifi`/와이파이, `clothes`/의류수거, `aed`/AED, `library`/도서관, `park`/공원, `market`/전통시장, `sports`/체육시설.
   - 순서(생활 그룹 정렬): hospital, pharmacy, parking, ev-charger, subway, school, childcare, toilet, trash, wifi, clothes, aed, library, park, market, sports = 16개.
   - 그리드 클래스 `grid-cols-4 md:grid-cols-8` 유지(16=4×4 / 8×2 정렬).
   - 모든 id는 유효 `CategoryId`(facility 카테고리) — `CategoryIcon`/`/${id}` 라우트 정상.

### C. 주석만 (동작·아이콘 불변)

8. `pages/subscription/[id].vue:474`, `components/subscription/PublicRentalDetailView.vue:104` — `category: 'toilet' as const` 윗줄에 주석 추가:
   `// 지도 마커 타입(FacilityCategory) 충족용 placeholder — 실제 시설 아님(상세 페이지의 단일 위치 핀)`

### D. 용어 통일

정식 용어(결정됨):

- **청약(`/subscription`) `ongoing` 상태 → "청약중"** (현 "접수중" 통일. "접수예정"=upcoming은 유지):
  - `components/subscription/SubscriptionCard.vue:79` `'접수중'` → `'청약중'`
  - `components/subscription/SubscriptionListView.vue:207` `'접수중'` → `'청약중'`
  - `pages/subscription/[id].vue:691` `'접수중'` → `'청약중'`
  - `components/subscription/HomeSubscriptionSection.vue:21` `접수중` → `청약중`
  - (허브 헤더/칩은 이미 "청약중" — 변경 없음.)
- **공공임대(`/public-rental`) `ongoing` 상태 → "모집중"** (현 "진행중" 통일. PublicRentalCard는 이미 "모집중"):
  - `pages/public-rental/announcements/index.vue:114` 필터 옵션 label `'진행중'` → `'모집중'`
  - `pages/public-rental/announcements/index.vue:120` 라벨 맵 `ongoing: '진행중'` → `'모집중'`
  - `pages/public-rental/announcements/[pblancId].vue:163` 라벨 맵 `ongoing: '진행중'` → `'모집중'`
  - (마케팅 산문 "진행중·예정·마감 공고를…"(:8,:193)은 status 라벨이 아니므로 범위 외 — 유지.)
- **`/subscription` 허브 라벨 → "청약 정보"** (보이는 브레드크럼/JSON-LD. "청약·임대"는 AppHeader 우산 그룹명으로만 유지):
  - `pages/subscription/[id].vue:588` 보이는 브레드크럼 `label: '청약·임대'` → `'청약 정보'`
  - `pages/public-rental/index.vue:56` JSON-LD `name: '청약·임대'`(→/subscription) → `'청약 정보'`
  - (JSON-LD `name: '청약 정보'` 다수는 이미 정합 — 변경 없음. AppHeader 내비 그룹 "청약·임대"는 유지.)

## 구현 주의

- **public-rental 폴백 제거(A-3):** 현 구조 `<div v-if="!rental">…</div><PublicRentalDetailView v-else …>`. `!rental` 분기 도달 불가지만, 방어적으로 `rental`이 null이면 페이지는 81행 createError로 이미 404. 폴백 div 제거 후 `<PublicRentalDetailView>`의 `v-else` 제거(단독 렌더). 단, `rental` computed가 만에 하나 null이어도 하위 컴포넌트가 안전하도록 `<PublicRentalDetailView v-if="rental" :rental="rental" …>` 가드는 유지(즉 `v-else` → `v-if="rental"`). 결과적으로 죽은 빈-상태 UI만 제거하고 null 가드는 보존.
- **subscription pending 제거(A-4):** `pending` ref와 템플릿 `v-if="pending"` 스피너 블록만 제거. 데이터 로딩 자체 로직(onMounted/fetch)은 불변.
- **용어 통일 회귀:** 변경 문자열("접수중"/"진행중"/"청약·임대")을 단언하는 기존 테스트가 있으면 함께 갱신.

## 테스트

- **신규/갱신 단위 테스트:**
  - 홈(`pages/index.vue` 테스트): quickFacilities 16개 렌더 + 신규 항목(예 '도서관','공원') 텍스트 단언.
  - `StaticPageHeader` 테스트: `calendar_month` 텍스트(material-symbols) 렌더 + 📅 부재 단언.
  - `AdBanner` 테스트: 같은 path에서 query만 변경 시 `refresh` 미호출, path 변경 시 호출 단언(가능한 범위에서).
  - 용어: 청약 카드 ongoing → "청약중", 공공임대 announcements ongoing → "모집중" 단언(기존 테스트 갱신 또는 추가).
- **회귀:** A 항목(죽은 코드)은 build/lint + 기존 테스트 통과로 검증. 전체 `npm run test` green.

## 효과

코드 정합성·일관성 향상. 홈 빠른찾기 전 카테고리 커버. 상태/허브 용어 단일화로 UX·SEO(앵커/브레드크럼) 정합. 광고 과호출 소지 제거(노출 불변).

## 커밋 분할 (단일 PR)

1. `chore(frontend): 죽은 import·도달불가 폴백·미연결 pending 제거` (A)
2. `feat(frontend): 홈 빠른찾기 전 시설 노출 + 📅→material-symbols + 광고 path watch` (B)
3. `docs(frontend): 지도 마커 placeholder category 설명 주석` (C)
4. `refactor(frontend): 청약/공공임대 상태·허브 용어 통일(청약중·모집중·청약 정보)` (D)

## 비범위

- 광고 개수/배치 변경(메모리 `feedback_adbanner_placement` — 동작 과호출만 손봄, 노출/배치 불변).
- 지도 마커 타입 리팩터(중립 category 도입) — 주석만(C).
- 마케팅 산문/설명 문장의 용어(상태 라벨만 통일).
- AppHeader 내비 그룹 "청약·임대" 명칭(우산 그룹으로 유지).
