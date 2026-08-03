# 일상킷 디자인 진화판 적용 (OD 시안 → 코드) — 전체 프로그램

- 작성일: 2026-06-12
- 상태: 설계 승인 대기 (사용자 리뷰 게이트)
- 출처 디자인: Open Design 프로젝트 `ilsangkit` (id `fc452fb1-2065-4f53-a744-2ba9075b348d`)
  — `css/app.css`(디자인 시스템) + 14개 화면 HTML + `js/nav.js`. **15개 파일 전수 정독 완료.**

## 1. 배경 & 목표

OD 시안은 기존 디자인을 갈아엎은 게 아니라 **진화**시킨 버전이다. CSS 주석:
"기존 톤(파랑·Pretendard·Public Sans·카테고리색) 유지 + 에디토리얼/휴먼 다듬기."

전수 확인 결과: **OD 시안의 HTML 주석이 우리 실제 Vue 컴포넌트명을 그대로 명시**한다
(`FacilityCard.vue`, `ComplexCard.vue`, `NearbyFacilities.vue`, `WasteTypeSection.vue`,
`SubscriptionScheduleTimeline`, `AuctionCard`, `PublicRentalDetailHeader`, `PageHero`,
`SectionBlock`, `DetailBasicInfo`, `DetailFacilityStatus`, `DetailNearby` 등). OD 에이전트가
우리 코드 구조를 읽고 그 구조 위에 맞춰 그렸다 → **거의 전부가 "리스타일"이고 재건축이 아니다.**

**목표**: OD 토큰을 전역 적용하고, 14개 화면을 OD 룩으로 일치시킨다. 기능·데이터·SSR·라우팅·광고 위치 불변.

## 2. 전체 화면 인벤토리 (15/15 정독)

| OD 파일 | 우리 페이지(추정) | 성격 | 고유 위젯(신규 스타일) |
|---|---|---|---|
| `css/app.css` | tailwind.config + main.css | **디자인 시스템** | 토큰·헤더·푸터·모바일 드로어·버튼·pill |
| `home.html` | `pages/index.vue` | 메인(부동산 중심 IA) | gradient hero, live-row, search-box, stat-box, **market signal+sparkline**, **trending 탭(매매/전세/월세)**, subscription D-day 카드, 16시설 그리드, region pills, guide 카드 |
| `facility-list.html` | `pages/[category]/index.vue` | 시설 목록 | filter-row(시/도·구/군·키워드), `.fc`(FacilityCard), pager, empty, rel-chips, faq |
| `facility-detail.html` | `pages/[category]/[id].vue` | 시설 상세 ★파일럿 | hero-stats(4), `.field`, `.stile`, amenity chip, geo, `.fcard`, media, tips/faq, sticky aside |
| `real-estate-list.html` | `pages/real-estate/[type]/...` | 부동산 목록 | mode-tabs, filter, `.cx`(ComplexCard 3-meta), infra-pills, hub-chips, faq |
| `real-estate-detail.html` | `.../[buildingName].vue` | 부동산 상세 | re-hero, map2, **bar chart(mode/period/area 탭)**, summary 5칸, **tx-table**, nearby단지, `.nf-card`(NearbyFacilities) |
| `subway-detail.html` | 지하철 상세 | 시설 상세 변형 | **line-badge(노선색)**, `.fcard .flines`, detail-grid+aside |
| `trash-detail.html` | `pages/trash/[id].vue` | 풀폭 단일 컬럼 | **waste-grid 2열 + day-chips(JS)**, notice 행, aux-grid 3열 |
| `subscription-detail.html` | `pages/subscription/[id].vue` | 청약 상세 | hero-stats(flex), **vertical timeline**, **표 3종(공급/경쟁률/가점)**, ext-links, guides |
| `auction-detail.html` | `pages/auction/item/[..].vue` | 공매 상세 | **status-badge**, bid-dl, stat3, kv blocks, compare, ac-grid(AuctionCard), nf-grid, faq 카드 |
| `public-rental-detail.html` | 공공임대 상세 | 부동산 변형 | pr-hero(tags), price-card 3, spec-grid 4, sib-grid, **신청절차 steps timeline**, apply-links, elig |
| `guide.html` | `pages/guide/index.vue` | 가이드 목록 | chip 필터, `.gc`(gradient thumb 카드), pager |
| `faq.html` | `pages/faq` 등 | 정적 | 760px, group→cat→accordion |
| `about.html` | `pages/about` 등 | 정적 | 820px, editorial doc 섹션, prov-list(컬러닷), src-table, contact |
| `js/nav.js` | (참고만) | 모바일 드로어 동작 | — (우리 헤더 컴포넌트로 대체, 이식 안 함) |

## 3. 번역 원칙 (확정)

- **Tailwind 유틸리티 중심.** 토큰은 `tailwind.config.js` + `assets/css/main.css @layer`.
- 반복 복합 패턴만 `@layer components`로 추출: `.hero-stats`, `.stile`, `.fcard`,
  `.cx`(complex card), `.nf-card`(nearby facilities), `.timeline`/`.step`, 차트 막대.
- OD 손수 CSS는 클래스째 가져오지 않는다 — 룩만 유틸리티/소량 @layer로 재현.
- 신규 색은 토큰 클래스(`text-strong/ink/muted/faint`, `border-line`, `bg-surface-2`, `shadow-card`) 사용.

## 4. 토큰 기반 (전역) — PR1

### 4.1 `tailwind.config.js`
- `primary`: `#2563eb → #2450DC` (dark `#1A3CB0`, press `#16358F`, ink `#0F2C8C`, tint 50 `#EBF0FE` / 100 `#DCE6FD`)
- 중성: `background-light #F7F8FA`, `surface-2 #FBFCFE`, `ink #15213B`, `strong #0C1424`, `muted #56627A`, `faint #677087`, `line #E6E9F0`, `line-2 #D7DCE7`
- 카테고리 16색 OD 헥스로 정렬 + `subway #64748B`:
  `toilet #7C4DEC, trash #0FA968, wifi #E8920C, clothes #E2548E, hospital #3B82F6,
  pharmacy #14B8A6, parking #0EA5E9, ev-charger #06B6D4, subway #64748B, school #6366F1,
  childcare #EC6AA5, aed #E0443B, library #D9820B, park #22A95B, market #F2730C, sports #8B5CF6`
- radius 2단계: `lg/sm 10px`, `xl/2xl 16px`, `full` ⚠️ 전역 영향
- shadow: `card`(sh-1) 유지 + `card-2`(sh-2) 추가

### 4.2 `assets/css/main.css`
- `:root` CSS 변수(`--cat` 16색 `--c-*` 포함 — fcard/nf-card 카테고리 테마링용)
- 에디토리얼 타입 스케일: `.text-display-1`(hero clamp 28→44), `.text-display-2`(20→24/800), `.text-eyebrow`(12px/.14em/brand)

> 이 PR을 켜는 순간 **전 사이트의 블루 톤·모서리·타이포가 한 번에** OD 톤으로 바뀐다(의도된 변화). 단독 PR로 시각 회귀 QA.

## 5. PR 프로그램 (전체)

| PR | 범위 | 핵심 작업 | 난이도 |
|---|---|---|---|
| **PR1** | 전역 토큰 | tailwind.config + main.css | 중 (전역 회귀 주의) |
| **PR2** | 시설 상세 파일럿 | `[id].vue`+자식 6종 리스타일 | 중 |
| **PR3** | 목록 2종 | 시설/부동산 목록(FacilityCard·ComplexCard·필터·pager·infra-pills) | 중 |
| **PR4** | 부동산 상세 | re-hero·차트·tx-table·summary·NearbyFacilities 카드 | 상 (차트 위젯) |
| **PR5** | 메인 | hero·market signal(sparkline)·trending 탭·청약 카드·시설 그리드 — **신규 섹션 다수 + IA** | 상 (가장 큼) |
| **PR6** | 상세 변형 + 정적 | 지하철·쓰레기·청약·공매·공공임대 상세 + 가이드·FAQ·소개 | 중~상 (timeline·표·status badge·day-chips) |

각 PR은 PR1 토큰 위에서 동작. PR2~6은 독립적이라 순서 조정 가능하나, PR1 선행 필수.

## 6. 신규/주의 컴포넌트 (리스타일 외 실제 신규 가능성)

대부분 리스타일이지만 아래는 **현재 코드에 없을 수 있어 신규 구현 검토 필요**:
- 메인(PR5): market signal sparkline, trending 매매/전세/월세 탭 — 현재 메인 구성과 대조 필요
- 부동산 상세(PR4): bar chart(기간/면적/매매·전월세 토글) — 현재 차트 유무 확인 필요
- 청약(PR6): vertical timeline + 경쟁률/가점 표 — 현재 SubscriptionScheduleTimeline 존재 확인됨(주석), 표는 확인 필요

각 PR 착수 시 해당 우리 페이지를 먼저 읽어 "리스타일 vs 신규"를 확정한다.

## 7. 리스크 & 완화
- 전역 톤 변화: PR1에서 메인·목록·상세 before/after 스크린샷으로 회귀 확인
- radius 전역(lg 8→10): 광범위 영향 → QA 포인트
- 신규 의존성 없음(순수 CSS/토큰). `nvm use 20` 유지, lock 재생성 금지
- 광고 슬롯(AdBanner)·SSR·데이터 바인딩·라우팅 절대 불변 — 스타일만

## 8. 검증 (PR 공통)
- `cd frontend && npm run dev` 실데이터 확인 (카테고리 다중)
- before/after 스크린샷(데스크톱 1280 + 모바일 390)
- `npm run lint` / `npm run test` green
- 기능 무결성: 길찾기·공유·복사·지도·필터·탭·페이저·광고
- 커밋 전 백/프론트 테스트 실행 (프로젝트 규칙)

## 9. 작업 순서
PR1(토큰) → PR2(시설상세 파일럿) → [톤 확정] → PR3·PR4·PR6(리스타일, 병렬 가능) → PR5(메인, 신규 섹션 큼) 마지막.
각 PR 독립 브랜치·독립 CI·독립 머지(사용자 PR 워크플로우).
