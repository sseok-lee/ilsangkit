# 카테고리 상세 렌더링 일관성 설계 (Frontend Audit ④)

- **작성일:** 2026-06-02
- **출처:** `docs/superpowers/specs/2026-06-02-frontend-improvement-audit.md` ④ 카테고리 상세 렌더링 구조
- **접근:** 전면 per-category 분해는 **하지 않음**. 공유 프리미티브 추출 + 4개 불일치 제자리 통일.
- **분할:** 2 PR — **PR1 = 운영시간 통일 + WeekdayHoursTable**, **PR2 = 카드 스타일 + 정보없음 정책 + heroStats registry**
- **순서:** PR1 구현·CI·머지 후 PR2.
- **검증:** 단위 테스트 + `npm run build` + 실서버 curl/시각 확인(카테고리별 시각 회귀 방지).

## 현황 (탐색 확인)

3개 거대 분기 표면:
- `pages/[category]/[id].vue` `desktopHeroStats` switch (`:517-602`, 13 카테고리 + `else`=clothes 폴백).
- `components/facility/detail/DetailBasicInfo.vue` (~730줄, 16 v-if 블록): 공통 주소/전화 + 카테고리별 필드 + 운영시간.
- `components/facility/detail/DetailFacilityStatus.vue` (~813줄, 17 v-if 블록): 시설 현황 그리드/표.

실제 불일치 4종:
1. **운영시간**: hospital(`:344-378`)·aed(`:265-291`) 요일표+오늘 / pharmacy(`:476-507`) 단순 행 / 나머지 `formatOperatingHours()` 1줄.
2. **카드 스타일**: school/market/childcare 회색 그리드 칩 / 나머지 label-value 행.
3. **정보없음 정책**: parking/library 항상 표시+'정보없음' / childcare/clothes 값 있을 때만.
4. **heroStats 폴백**: `else`(clothes) → 전화만. 신규 카테고리 미등록 시 조용히 전화만.

## 보존 원칙 (회귀 금지)

- schema.org 카테고리 @type 매핑(`useStructuredData.ts:114-131`) — 변경 금지.
- `DataSourceCard`(상세 출처), `DetailRow.vue`(label-value 행) — 재사용.
- hospital/aed 요일표 + "오늘" 강조 시각/동작 — 프리미티브로 옮기되 출력 동일.
- `EvChargerDetail.vue`(폴링 포함) — 이번 범위에서 건드리지 않음.

## 통일 결정 (사용자 승인)

- **정보없음**: **항상 표시 + '정보 없음'** 폴백으로 통일(parking/library 패턴). 숨기던 childcare/clothes도 전환. **신규 필드 추가는 안 함** — 각 카테고리의 현재 렌더 필드 집합 유지, 빈 값만 폴백 노출.
- **카드 스타일 규칙**: 수치/카운트 통계 → `FieldGrid`, 서술형 사실 → `DetailRow`, 열거 목록 → `TagBadges`.

---

# PR1 — 운영시간 통일 + WeekdayHoursTable

**대상:** `components/facility/detail/WeekdayHoursTable.vue`(신규), `DetailBasicInfo.vue`(hospital/aed/pharmacy 운영시간 블록), `tests/components/facility/detail/DetailBasicInfo.test.ts`.

## P1-1. WeekdayHoursTable 프리미티브 추출
hospital/aed의 요일별 표(월~일 행, "오늘" 강조, 점심시간 옵션 컬럼, 휴무 표기)를 받아 렌더하는 프리미티브. props 예:
- `rows`: `Array<{ day: string; isToday: boolean; open?: string|null; close?: string|null; lunch?: string|null; closed?: boolean }>` (정확한 형태는 hospital/aed 기존 인라인 데이터에서 도출 — 구현 시 확정)
- `showLunch?: boolean` (hospital만 점심 컬럼)
"오늘" 강조 스타일, 휴무/정보없음 표기는 기존 hospital/aed 출력과 동일하게 보존.

## P1-2. hospital/aed → WeekdayHoursTable 교체
DetailBasicInfo의 hospital(`:344-378`)·aed(`:265-291`) 인라인 표를 `WeekdayHoursTable`로 교체. 렌더 출력은 기존과 동일(요일/오늘/점심/휴무). 기존 weekday 데이터 가공 로직은 컴포넌트로 전달할 props로 매핑.

## P1-3. pharmacy → WeekdayHoursTable 통일
pharmacy 단순 행(`:476-507`)을 `WeekdayHoursTable`로 교체. pharmacy는 동일한 요일 데이터를 보유(현재 조건부 weekday 행 렌더 중)하므로 동일 프리미티브로 enrich. 점심 컬럼은 데이터 유무에 따라.

## P1-4. 운영시간 일관 규칙
요일별 구조 데이터가 있는 카테고리(hospital/aed/pharmacy) → `WeekdayHoursTable`. 단일 `openTime` 문자열만 있는 카테고리(toilet 등) → 기존 `formatOperatingHours()` 1줄 유지(변경 없음). library는 open/close+휴관일 별도 구조 — 이번 PR에서 변경하지 않음(범위 한정).

## PR1 테스트
- `WeekdayHoursTable` 단위: 요일 행 렌더, "오늘" 강조 적용, 휴무/빈 값 표기, 점심 컬럼 옵션.
- `DetailBasicInfo.test.ts` 갱신: 기존 "pharmacy 단순 행/표 없음" 계약 → **"pharmacy도 WeekdayHoursTable 사용"**으로 재정의. hospital/aed 요일표·"오늘" 계약 유지(프리미티브 경유여도 출력 동일).
- 회귀: 단일-openTime 카테고리(toilet)는 1줄 유지 확인.

## PR1 커밋 분할
1. `feat(frontend): WeekdayHoursTable 프리미티브 추출 + 단위 테스트`
2. `refactor(frontend): hospital/aed 운영시간을 WeekdayHoursTable로 교체`
3. `feat(frontend): pharmacy 운영시간을 WeekdayHoursTable로 통일 + 테스트 재정의`

---

# PR2 — 카드 스타일 + 정보없음 정책 + heroStats registry

**대상:** `FieldGrid.vue`/`TagBadges.vue`(신규), `DetailFacilityStatus.vue`, `DetailBasicInfo.vue`(정보없음), `pages/[category]/[id].vue`(heroStats), 관련 테스트.

## P2-1. FieldGrid + TagBadges 추출 + 카드 스타일 정규화
- `FieldGrid.vue`: 회색 칩 수치 그리드(라벨+값 카드, 2~4열). school/market/childcare가 쓰던 ad-hoc 그리드를 이걸로.
- `TagBadges.vue`: 칩/태그 목록(부서·취급품목·자격 등). hospital departments/market products/childcare career의 ad-hoc 칩을 이걸로.
- 규칙 적용: 수치 통계→FieldGrid, 서술 사실→DetailRow, 열거→TagBadges. DetailFacilityStatus의 카테고리 블록을 규칙대로 정규화(출력 의미 보존, 스타일만 일관).

## P2-2. 정보없음 정책 통일 (항상 표시 + '정보 없음')
- `DetailRow`/`FieldGrid`에 빈 값 → "정보 없음" 폴백을 일관 적용(이미 parking/library가 하는 방식).
- childcare/clothes 등 "값 있을 때만" 숨기던 필드를 현재 필드 집합 한도 내에서 항상 표시로 전환.
- 섹션 전체가 비어도 최소 컨텍스트는 유지(불필요한 빈 섹션 방지 — 단, 신규 카피 추가는 최소화).

## P2-3. heroStats registry
- `[id].vue` `desktopHeroStats` 80줄 switch를 카테고리별 설정(맵/함수 registry)으로 추출(별도 util 또는 `[id].vue` 내 상수). 출력 동일.
- `else` 기본값(전화)은 명시적 default로 유지하되, 미등록 카테고리 진입 시 dev에서 `console.warn`(prod 무영향)으로 "조용한 폴백" 가시화.

## PR2 테스트
- `FieldGrid`/`TagBadges` 단위: 렌더/빈 값 폴백/열거 칩.
- `DetailFacilityStatus.test.ts` 갱신: 카드 스타일 정규화 후에도 카테고리별 필드 가시성 계약 유지(예: school education authority가 status에 안 나옴).
- 정보없음: childcare/clothes 빈 필드가 "정보 없음"으로 표시되는지.
- heroStats: registry가 카테고리별 기존 stat과 동일 산출, 미등록 시 default+warn.

## PR2 커밋 분할 (예시)
1. `feat(frontend): FieldGrid·TagBadges 프리미티브 추출 + 테스트`
2. `refactor(frontend): DetailFacilityStatus 카드 스타일 규칙 정규화`
3. `fix(frontend): 상세 정보없음 정책 통일(항상 표시 + 정보없음)`
4. `refactor(frontend): heroStats를 카테고리 registry로 추출 + 미등록 경고`

---

## 비범위 (Out of scope)

- 15개 카테고리 전면 per-category 컴포넌트 분해(별도 대형 이니셔티브).
- `EvChargerDetail` 변경, library 운영시간 구조 변경.
- audit ⑤(UX 동선)·⑥(위생).
