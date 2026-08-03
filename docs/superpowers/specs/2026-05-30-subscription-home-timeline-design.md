# 메인 "청약 한눈에" 섹션 재설계 — 통합 일정 타임라인

- **작성일**: 2026-05-30
- **대상 컴포넌트**: `frontend/components/subscription/HomeSubscriptionSection.vue`
- **상태**: 설계 확정

## 1. 배경 / 문제

메인 페이지의 "청약 한눈에" 섹션은 현재 청약 공고를 **상태(접수중/접수예정) 카드 그리드**로만 보여준다. 카드에는 단지명·지역·D-day·공급호수만 있고 **청약 타입(아파트/오피스텔/무순위·잔여/임의공급/임대) 구분이 없다.** 사용자가 "어떤 종류의 청약이 언제 열리는지"를 한눈에 파악하기 어렵다.

목표: **모든 청약을 날짜순 타임라인으로 묶고, 타입을 색 뱃지로 구분**해 일정과 종류를 동시에 한눈에 보이게 한다.

## 2. 핵심 결정 (확정)

| 항목 | 결정 |
|---|---|
| 레이아웃 | 카드 그리드 → **통합 일정 타임라인** (날짜순 한 줄 리스트) |
| 표시 범위 | **분양 4종 + 임대 2종 전체** (아파트·오피스텔·무순위/잔여·임의공급·공공임대·민간임대) |
| 시간 그룹 | **접수중 / 접수예정 2그룹** (상태 기준). 접수중=마감 임박순, 예정=시작 임박순 |
| 임대 표기 | 분양 4종은 컬러 뱃지, **임대 2종은 회색 뱃지**(라벨로 공공/민간 구분) |
| 상단 요소 | **요약 한 줄(접수중 N · 예정 N)만 유지.** 평균 분양가 제거, D-3 빨강 배너 제거 |
| 표시 건수 | **접수중 5 + 예정 5 (데스크톱), 모바일 4+4** (CSS로 5번째 줄 숨김). "최대"이며 부족하면 그만큼만 |

## 3. UI 설계

### 3.1 구조 (위→아래)
1. **헤더**: `📅 청약 한눈에` + 우측 `전체 보기 →` (→ `/subscription`)
2. **요약 한 줄**: `🟢 접수중 N건 · 🔵 예정 N건` (슬림 박스)
3. **타임라인 2그룹** (데스크톱 2열, 모바일 1열 스택):
   - `🔴 접수 중` — `receptionEndDate` 오름차순(마감 임박 우선)
   - `🔵 접수 예정` — `receptionStartDate` 오름차순(시작 임박 우선)

### 3.2 타임라인 한 줄 구성
```
[D-day 뱃지] · [타입 뱃지] · [단지명 …] · [지역]
```
- **D-day 뱃지**: 접수중=빨강 계열(`D-1`…, 오늘은 `D-Day`), 예정=파랑 계열(`D-6`…)
- **단지명**: 한 줄, 넘치면 말줄임(`…`). 줄 전체 클릭 → `/subscription/:id`
- **지역**: 데스크톱만 표시. **모바일에서는 생략**(공간 절약)

### 3.3 반응형
- 데스크톱(`sm` 이상): 2열 그리드, 그룹당 최대 5줄, 지역 표시
- 모바일: 1열 스택, 그룹당 최대 4줄(5번째 줄에 `hidden sm:flex` 부여 → **CSS로만** 제어, SSR 안전), 지역 숨김
- 한쪽 그룹이 0건이면 **해당 그룹 헤더를 숨기고** 남은 그룹만 렌더(빈 열 방지)

### 3.4 빈 상태
- 접수중·예정 **둘 다 0건**이면 기존 빈 상태 카드 유지("현재 접수 중이거나 예정된 청약 공고가 없어요 / 지난 공고 보기 →")

## 4. 타입 뱃지 매핑

`(sourceType, rentType)` → 라벨/색. 임대 판별 기준은 백엔드와 동일한 `PUBLIC_RENT_TYPES = ['분양전환 가능임대', '분양전환 불가임대']`.

| 표시 라벨 | 판별 조건 | 색 계열 |
|---|---|---|
| 아파트 | `sourceType === 'APT'` && rentType ∉ PUBLIC_RENT_TYPES | 인디고 (`bg-indigo-50 text-indigo-700`) |
| 오피스텔 | `sourceType === 'OFFITEL'` | 틸 (`bg-teal-50 text-teal-700`) |
| 무순위·잔여 | `sourceType === 'REMAINING'` | 오렌지 (`bg-orange-50 text-orange-700`) |
| 임의공급 | `sourceType === 'OPTIONAL'` | 퍼플 (`bg-fuchsia-50 text-fuchsia-700`) |
| 공공임대 | `sourceType === 'APT'` && rentType ∈ PUBLIC_RENT_TYPES | 회색 (`bg-slate-100 text-slate-600`) |
| 민간임대 | `sourceType === 'PRIVATE_RENT'` | 회색 (`bg-slate-100 text-slate-600`) |

> 기존 `utils/subscriptionMeta.ts`의 `getSourceTypeLabel()`은 rentType을 보지 않아 공공임대/아파트를 구분하지 못한다. **rentType 인지가 가능한 신규 유틸을 추가**한다(아래 4.1).

### 4.1 신규 유틸 `subscriptionTypeBadge(sourceType, rentType)`
- 위치: `frontend/utils/subscriptionMeta.ts` 에 추가
- 반환: `{ label: string; classes: string; kind: 'sale' | 'rent' }`
- 색 클래스는 Tailwind 토큰을 직접 반환(컴포넌트에서 `:class`로 사용). 색 결정은 이 유틸에 일원화.

## 5. 데이터 흐름 / 구현

### 5.1 백엔드 변경 — 정렬 옵션 추가
현재 `getSubscriptionList()`는 항상 `orderBy: { announcementDate: 'desc' }`. 타임라인은 "가장 임박한 것"이 위로 와야 하므로, **limit 적용 전에 reception 날짜로 정렬**해야 한다(클라이언트 정렬로는 임박 건이 누락될 수 있음).

- `backend/src/schemas/subscription.ts`: `SubscriptionListSchema`에 `sort` 추가
  ```ts
  sort: z.enum(['announcement', 'deadline', 'startSoon']).optional()
  // announcement(기본): announcementDate desc
  // deadline: receptionEndDate asc  (접수중 마감 임박순)
  // startSoon: receptionStartDate asc (예정 시작 임박순)
  ```
- `backend/src/services/subscriptionService.ts`: `getSubscriptionList()`의 `orderBy`를 `sort` 값에 따라 분기. 미지정 시 기존 동작(`announcementDate desc`) 유지 → **기존 호출부 영향 없음**.
- `sourceType`/`rentType`은 이미 `findMany`가 row 전체를 반환하므로 **응답에 이미 포함**됨(추가 select 불필요).

### 5.2 프론트엔드 변경

**`frontend/composables/useHomeSubscriptions.ts`**
- `HomeSubscriptionItem`에 `sourceType: string`, `rentType: string | null` 추가
- 두 페치에 정렬/건수 반영:
  - 접수중: `status=ongoing&sort=deadline&limit=5`
  - 예정: `status=upcoming&sort=startSoon&limit=5`
- 응답의 `data.total`로 **접수중/예정 총 건수**를 노출(`ongoingTotal`, `upcomingTotal`) → 요약 한 줄을 이 값으로 렌더(metaService 요약 의존 제거, 섹션 자급자족)

**`frontend/components/subscription/HomeSubscriptionSection.vue`**
- `summary` prop 의존 제거(평균가·imminent 미사용). 요약 한 줄은 composable의 `ongoingTotal`/`upcomingTotal` 사용
- D-3 빨강 배너 블록 **삭제**
- 카드 그리드 → **2그룹 타임라인**으로 교체
- 각 줄에 `subscriptionTypeBadge()` 적용
- 5번째 줄 모바일 숨김(`hidden sm:flex`), 지역 데스크톱 전용(`hidden sm:inline`)
- D-day 계산 로직(`computeDday`/`ddayLabel`)과 SSR `todayIso` useState 패턴은 **재사용**

**`frontend/utils/subscriptionMeta.ts`**
- `subscriptionTypeBadge()` 및 `PUBLIC_RENT_TYPES` 상수 추가

**`pages/index.vue` (또는 섹션 호출부)**
- `HomeSubscriptionSection`에 더 이상 `summary` prop을 넘기지 않아도 동작하도록 정리(기존 prop은 optional 유지 가능, 점진 제거)

### 5.3 영향 없는 것
- `/subscription` 리스트 페이지·상세·기타 `getSubscriptionList` 호출부: `sort` 미지정이면 기존 동작 그대로
- 백엔드 데이터 모델/sync 스크립트: 변경 없음

## 6. 엣지 케이스
- **접수중인데 마감일이 NULL**: D-day 계산 불가 → D-day 뱃지 생략, 타입·단지명만 표시. 정렬 시 NULL은 뒤로(Prisma `nulls: 'last'` 또는 동등 처리)
- **그룹 한쪽만 존재**: 빈 그룹 헤더 숨김, 남은 그룹이 전체 폭 차지
- **둘 다 0건**: 빈 상태 카드
- **긴 단지명**: 말줄임. 모바일에서 지역 생략으로 폭 확보
- **임대 rentType 값 편차**: API가 '임대주택' 대신 '분양전환 가능/불가임대'를 반환하는 케이스를 `PUBLIC_RENT_TYPES`로 흡수

## 7. 테스트
- `frontend/tests/components/subscription/HomeSubscriptionSection.test.ts`(신규 또는 갱신):
  - 6종 타입 뱃지 라벨/색 분기 (특히 APT 분양 vs APT 공공임대 구분)
  - 접수중/예정 2그룹 렌더 및 정렬 순서
  - 한쪽 그룹 0건 → 헤더 숨김
  - 둘 다 0건 → 빈 상태
  - 요약 한 줄이 `ongoingTotal`/`upcomingTotal`을 반영
- `utils/subscriptionMeta` 단위 테스트: `subscriptionTypeBadge()` 매핑표 전 케이스
- 백엔드: `getSubscriptionList` `sort=deadline|startSoon` 정렬 검증 테스트
- 커밋 전 `npm run test`(backend/frontend) 통과 확인

## 8. 범위 밖 (YAGNI)
- 타입 필터 탭(C안)·시간 버킷(방식2)은 채택 안 함
- 평균 분양가 지표(임대 혼입 문제로 제거). 추후 분양 전용으로 되살릴 여지는 남김
- 청약 알림/구독 기능
