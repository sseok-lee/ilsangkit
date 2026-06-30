# 시설 상세페이지 기본정보·시설현황 섹션 재정렬 설계

**날짜:** 2026-06-30
**브랜치:** `feat/facility-detail-section-reorder`
**범위:** 프론트엔드 표현 계층만 (백엔드·스키마·동기화 무변경)

## 목표

시설 상세페이지(15개 카테고리 공용 `frontend/pages/[category]/[id].vue`)의 두 콘텐츠 섹션을
**기본정보 → 시설현황** 순서로 바꾸고, 기본정보 내부 필드를 사용자가 스캔하기 쉬운 위계로 정돈한다.

## 현재 상태 (트레이스 결과)

페이지 본문 순서(헤더·광고 이후):

1. **시설현황** (`DetailFacilityStatus`) — "1차 고유 콘텐츠"로 의도적으로 상단 승격됨
2. **기본정보** (`DetailBasicInfo`)

필드는 이미 ~80% 올바른 섹션에 있다. 두 컴포넌트는 이미 실질적 원칙을 따른다:
정체성·접근 정보 → 기본정보, 물리적 수치·설비 → 시설현황.

따라서 본 작업은 **대규모 필드 이동이 아니라 "순서 정리"**다. 실제 문제는 두 가지:

1. **섹션 순서가 반대** — 시설현황이 먼저 렌더된다.
2. **기본정보 내부 정돈 부족** — 일부 카테고리(특히 학교·어린이집)에서 행정 메타데이터
   (팩스·대표자·인가일·교육청·데이터기준일)가 사용자가 먼저 필요로 하는 정보(주소·시간·전화)와
   섞여 상단에 노출된다.

## 분류 원칙 (전 카테고리 공통 규칙)

기본정보 내부를 위→아래로 세 묶음으로 나눈다. **규칙 기반**(카테고리별 즉흥 판단 금지):

### 기본정보 (항상 표시)

1. **핵심** (일반 강조) — "어떻게 가고, 언제 열고, 어떻게 연락하나"
   - 영업상태 배너, 주소(복사·길찾기), 운영시간/개방시간/요일 시간표(병원·AED·약국),
     전화·응급전화, 홈페이지·바로가기
2. **분류** (일반 강조) — "이게 무슨 시설인지"
   - 유형·종별·학교급·도서관유형·시장유형·어린이집유형·시설유형/시설구분,
     운영상태(operationStatus/crstatusname), 설립형태·남녀공학·고교유형·본분교, 국가대표시설
3. **기타 정보** (muted, 맨 아래) — 행정·식별 메타데이터
   - 관리기관/운영기관/서비스제공사, 설치·설립·지정·인가·개설일, 데이터기준일,
     팩스, 대표자, 교육청(시도/지원청), 소유구분, 간호등급·설립구분(병원 행정), 특이사항, 휴지기간

### 시설현황 (수치·설비가 있을 때만 표시)

- 내용 **무변경**. 화장실 칸수·접근성, 좌석·장서, 정원/현원·반·직원·경력, 주차 요금·면수,
  병상·의료진·진료과목, 면적·관람석, 점포·판매품목, EV 충전기 등.
- 위치만 기본정보 뒤로 이동.

## 필드 재배치 감사 결과 (2026-06-30, 14개 카테고리 find→적대적 검증)

분류는 이미 ~정확. 섹션 간 통째 오배치는 **확정 1건**, 경계라 유지 9건.

### 확정 이동 — 1건

- **parking · 주차장 유형(lotType): 시설현황 → 기본정보.** 노상/노외/부설 분류 필드인데
  시설현황 '시설 정보'에 들어가 있다. 동일 성격의 **주차 구분(parkingType)이 이미 기본정보**에 있어
  떨어져 있는 게 비일관. 모든 다른 카테고리가 유형/종별을 기본정보에 두는데 parking만 예외.
  시설현황→기본정보 방향이라 게이팅 손실 없음. 두 필드는 값이 겹칠 수 있으니 기본정보 분류 영역에
  나란히 배치하고 값이 동일하면 표시 중복을 피한다.

### 경계 검토 후 "현행 유지"로 판정 — 9건 (참고용, 변경 없음)

- wifi SSID(시설현황 유지: 설치장소와 묶인 기술 식별자), aed 설치위치(기기 속성, wifi 선례),
  hospital 간호등급(종별 옆 단일 분류 배지·인력 수치 아님), childcare 통학차량(단일 라벨).
- ev-charger 5건(이용시간·연락처·운영기관·설치년도·위치) — 아래 별도 처리.

### ev-charger 구조 보정 — 결정: 기본정보로 끌어올리기

ev-charger는 기본정보에 카테고리 전용 블록이 없고 운영시간·전화 등이 전부 `EvChargerDetail`
(시설현황)에 통합돼 있다. 기본정보 공통 행은 `operatingHours`/`phoneNumber·phone·clerkTel·crtelno`만
읽어 ev-charger의 `useTime`(운영시간)·`busiCall`(전화)이 **기본정보에 전혀 노출되지 않음** →
13개 카테고리와 달리 ev-charger 기본정보가 주소만 보임.

**처방:** ev-charger의 `useTime`→공통 운영시간 행, `busiCall`→공통 전화 폴백으로 **기본정보에 노출**하고,
`EvChargerDetail`에서 해당 중복을 **트림**(이전 redesign의 '라이브전용 트림' 선례와 동일 방식).
운영기관(busiNm)·설치년도(year)·위치(addrDetail/location) 등 나머지는 EvChargerDetail에 유지.

## 페이지 본문 순서 (변경 후)

```
T0  헤더 (MobileDetailHeader / PageHero)   ← h1, 무변경
    [광고: fixed rectangle 280]            ← 무변경
T1  기본정보 (DetailBasicInfo)             ← 위로 이동
    [광고: compact-mobile]                 ← 무변경 (구조적 위치 유지)
T2  시설현황 (DetailFacilityStatus)        ← 아래로 이동
    [광고: compact-mobile]                 ← 무변경
T3  위치·로드뷰                            ← 무변경
    DetailNearby / YouTube / Blog          ← 무변경
    [광고] / Coupang / DetailContextLinks  ← 무변경
```

두 섹션 블록만 맞바꾼다. 광고 배너 3개는 **구조적 구분자**로 제자리에 남으므로
광고 개수·배치는 불변(정책 준수).

## 불변식 (반드시 보존)

- **단일 h1** — h1은 헤더 소유. 섹션 헤딩은 `<h3>`. 재정렬이 h1·헤딩 위계를 건드리지 않는다.
- **SSR-first / 크롤러 가시성** — 기본정보·시설현황은 현재 SSR. **muted 처리는 CSS 강등만**
  (작은 글씨·옅은 색); 텍스트는 SSR HTML에 그대로 남겨 Googlebot·Naver Yeti·Bingbot이 전부 읽도록.
  **`ClientOnly`로 콘텐츠를 감싸지 않는다.**
- **광고 슬롯** — 개수·위치·variant 현행 1:1 보존.
- **JSON-LD** — Facility·Breadcrumb·FAQ·Dataset provenance 모두 `<head>` 발행, 무변경.
- **Tailwind order ≤ 12**, 모바일 지도 220px, 멀티루트 class fall-through 함정 주의.

## SEO 근거 (왜 기본정보-first가 안전한가)

- 두 섹션 모두 SSR → 봇은 첫 응답에서 양쪽 전체 HTML 수신. 시각/DOM 순서가 색인 대상을 게이팅하지 않음.
- 기본정보 첫 콘텐츠 = 주소→운영시간→전화(NAP). 로컬 검색 의도("지역명 시설명 주소/전화")에 부합.
  주소는 페이지별 고유 → "보일러플레이트 우선" 문제 없음.
- h1·구조화 데이터 불변 → 리치 결과 영향 없음.

## 엣지 케이스 / 게이팅

- **clothes·trash** — `DetailFacilityStatus`의 `hasFacilityStatus`가 false라 시설현황 미표시.
  → 본 작업에서 필드를 **시설현황으로 이동하지 않으므로** 정보 유실 없음
  (상세위치·운영기관·수거품목은 기본정보 유지). 게이트 변경 불필요.
- **pharmacy(약사수 0)** — 시설현황 숨김. 동일하게 기본정보로 충분.
- 빈 시설현황(clothes 등) 뒤에 광고가 인접하는 현상은 현행에도 존재(기존과 동등) — 광고 정책상
  개수 축소 금지이므로 현행 유지. (개선 여지는 별도 결정 사항으로 분리.)
- **ev-charger 중복 금지** — `useTime`·`busiCall`을 기본정보 공통 행에 노출하면 반드시
  `EvChargerDetail`에서 같은 값을 제거해 한 페이지에 두 번 나오지 않게 한다.

## 변경 파일

1. `frontend/pages/[category]/[id].vue`
   - `DetailFacilityStatus`(현 L120)와 `DetailBasicInfo`(현 L126) 블록 순서 교환.
   - 사이 광고 배너 3개는 제자리 유지(구조적 구분자).
   - ev-charger 전화 폴백: `facilityPhone` computed에 `|| d.busiCall` 추가(모바일 헤더용).
2. `frontend/components/facility/detail/DetailBasicInfo.vue`
   - 카테고리별 `<template v-if>` 블록 내부를 핵심 → 분류 → 기타(muted) 순으로 재배열.
   - 기타 정보 묶음에 muted 컨테이너 적용(예: `mt-4 pt-4 border-t border-slate-100`,
     라벨 `text-slate-400`, 값 `text-sm`). **CSS 강등만, 콘텐츠 SSR 유지.**
   - **parking 분류 영역에 주차장 유형(lotType) 행 추가**(시설현황에서 이동). 주차 구분과 나란히.
   - **ev-charger**: 공통 운영시간 행이 `useTime`도 읽도록, 공통 전화 행이 `busiCall`도
     폴백하도록 보정(`facilityPhone`에 `|| d.busiCall`).
3. `frontend/components/facility/detail/DetailFacilityStatus.vue`
   - 내용 대부분 무변경(이동만). **parking '시설 정보'에서 주차장 유형(lotType) 행 제거**(기본정보로 이동).
4. `frontend/components/facility/detail/EvChargerDetail.vue`
   - 기본정보로 끌어올린 `useTime`·`busiCall`을 '충전소 기본 정보' 그룹에서 **트림**(중복 제거).
     운영기관·설치년도·위치 등 나머지는 유지.
5. `frontend/tests/components/facility/detail/*` (해당 시)
   - 순서 의존 단언 갱신, 필드 존재(누락 없음) 검증, parking lotType·ev-charger 노출 위치 검증.

## 검증

- `cd frontend && npm run test` (vitest 전체 통과)
- `npm run lint` 0
- `npm run build` 성공
- 클린 `.nuxt` 후 라이브 SSR 스모크: 대표 카테고리(toilet·hospital·childcare·clothes·ev-charger)에서
  기본정보가 시설현황보다 먼저 SSR 렌더되는지, 기타 정보가 HTML에 남아 있는지(크롤러 가시성),
  단일 h1, 광고 슬롯 개수 동일 확인.

## 범위 외 (Out of Scope)

- 백엔드·Prisma·동기화 변경 없음.
- 시설현황 내부 재설계(되돌린 DetailSpecGrid 이니셔티브)와 무관.
- 데스크톱 사이드바(지도·액션·쿠팡·광고) 구조 변경 없음.
- 헤딩 위계 h1→h3 점프(h2 누락)는 기존 이슈로, 본 작업 범위 밖.

## 리스크

- 카테고리별 블록 재배열 시 기존 구분선(`<div class="h-px ...">`) 로직이 꼬일 수 있음
  → 각 카테고리 SSR 스냅샷으로 시각 회귀 확인.
- Vue `<script setup>` 템플릿 top-level ref 자동 언랩 함정(이전 이니셔티브 교훈) — 본 작업은
  주로 템플릿 재배열이라 위험 낮으나, computed 추가 시 주의.
