# 정적 페이지 4종 최신화 설계

- **작성일**: 2026-06-01
- **대상**: `frontend/pages/about.vue`, `contact.vue`, `privacy.vue`, `terms.vue`
- **목표**: (1) 콘텐츠 정확성 수정 (카테고리 세트 최신화), (2) 디자인/UI 리프레시 (정돈형)
- **범위 외**: 사업자등록번호·대표자·주소 등 법적 정보 신규 추가, 개인정보/약관의 법적 문구 확대

---

## 1. 배경 / 문제

4개 정적 페이지는 모두 존재하고 기본 구조는 양호하나(시행일 2026-03-14), 실제 서비스 카테고리와 **불일치**한다.

- `about.vue`는 시설 10종만 나열하고, **무인민원발급기**(코드베이스에서 제거된 카테고리)를 포함한다.
- `terms.vue` 제2조는 "부동산 6 + 시설 10 = 16개"로 명시 → 실제는 **부동산 6 + 시설 15 = 21개**.
- `about.vue` 데이터 출처 표에 **병원·약국이 누락**되어 있고, 무인민원발급기 행이 남아 있다.
- 신규 시설 6종(공원·학교·전통시장·어린이집·전기차충전소·체육시설)이 어느 페이지에도 반영되지 않았다.

검증 결과(백엔드 `categoryRegistry.ts`): 좌표 기반 시설 14종(`toilet, wifi, clothes, parking, aed, library, hospital, pharmacy, park, school, market, childcare, ev-charger, sports`) + 별도 일정 모델 `trash`(쓰레기배출) = **사용자 노출 시설 15종**. `subway`는 `ALL_CATEGORIES`에서 의도적으로 제외(노출 안 함). `무인민원/minwon`은 코드베이스에서 완전히 제거됨.

---

## 2. 정식 카테고리 세트 (Single Source of Truth)

이 작업에서 4개 페이지가 공유해야 하는 정식 목록.

**시설 15종**
1. 공공화장실 (toilet)
2. 쓰레기배출 (trash)
3. 무료와이파이 (wifi)
4. 의류수거함 (clothes)
5. 공영주차장 (parking)
6. 자동심장충격기(AED) (aed)
7. 공공도서관 (library)
8. 병원 (hospital)
9. 약국 (pharmacy)
10. 공원 (park) — **신규**
11. 학교 (school) — **신규**
12. 전통시장 (market) — **신규**
13. 어린이집 (childcare) — **신규**
14. 전기차충전소 (ev-charger) — **신규**
15. 체육시설 (sports) — **신규**

**부동산 6종**: 아파트 매매, 아파트 전월세, 빌라(연립다세대) 매매, 빌라 전월세, 오피스텔 매매, 오피스텔 전월세

**제거 대상**: 무인민원발급기 (모든 페이지에서 삭제)

**프론트 그룹핑** (`frontend/types/facility.ts`의 `CATEGORY_GROUPS` 기준, about 제공정보 나열 시 사용):
- 교육/육아: school, childcare, library
- 생활편의: parking, ev-charger, toilet, wifi
- 생활환경: park, market, clothes, aed, hospital, pharmacy, sports
- (trash는 일정 데이터 — 별도 항목으로 표기)

---

## 3. 콘텐츠 변경 상세

### 3.1 `about.vue`
- **제공 정보** 섹션: 시설 10종 목록 → 15종으로 확장, 무인민원발급기 항목 삭제. `CATEGORY_GROUPS` 3그룹으로 묶어 나열(카드 아님, 글머리표 유지). 신규 6종 각 1줄 설명 추가. 부동산 3줄(아파트/빌라/오피스텔 실거래가)은 현행 유지.
- **데이터 출처 표**: 15개 시설 전체로 완성.
  - 무인민원발급기 행 삭제
  - 병원·약국 행 추가 (현재 누락)
  - 신규 6종 행 추가
  - 각 행의 `데이터명 / 제공기관 / 출처(data.go.kr URL)`은 각 sync 스크립트·서비스의 `sourceUrl` 상수에서 **정확히 추출**한다. 추측 금지. CSV 기반 출처(toilet, school 등)는 API 링크 대신 출처를 사실대로 표기.
  - 참조 파일(출처 추출 위치):
    - park → `src/services/parkSyncService.ts`
    - school → `src/services/schoolSyncService.ts` (CSV `prisma/data/school.csv` 기반)
    - market → `src/services/marketSyncService.ts`
    - childcare → `src/services/childcareSyncService.ts`
    - ev-charger → `src/services/evChargerSyncService.ts`
    - sports → `src/services/sportsSyncService.ts`
    - hospital → `src/scripts/syncHospital.ts` (data.go.kr 15001698)
    - pharmacy → `src/scripts/syncPharmacy.ts` (data.go.kr 15000576)

### 3.2 `terms.vue`
- 제2조 (서비스의 내용): 시설 항목을 15종으로 확장, 무인민원발급기 삭제. 총 21개 항목(부동산 6 + 시설 15).
- 부칙 시행일 `2026년 3월 14일` **유지**.

### 3.3 `privacy.vue`
- 본문 법적 문구는 유지(범위 외). 제9조 시행일 `2026년 3월 14일` 유지.
- 디자인 리프레시(업데이트 배지/구분선)만 적용.

### 3.4 `contact.vue`
- 콘텐츠 변경 없음. 디자인 리프레시만 적용(공통 헤더 패턴 일관화).

---

## 4. 디자인 리프레시 (방향 A — 정돈형)

브랜드 톤 준수: 실용적 미니멀리즘, 정보 우선, 라이트 전용, 그라데이션/네온/글래스 지양. 기존 `max-w-4xl mx-auto`, slate 팔레트, primary `#2563eb` 유지.

### 4.1 공용 헤더 컴포넌트 `components/common/StaticPageHeader.vue`
4개 페이지의 중복 헤더 마크업을 작은 단위로 추출.
- **Props**: `title: string`, `lead?: string`, `updatedAt?: string`
- **렌더**: `h1`(기존 타이포 유지) + (`lead` 있으면) 리드 문단 + (`updatedAt` 있으면) "📅 마지막 업데이트 {updatedAt}" 배지(`bg-slate-100 text-slate-600` 등 연한 칩)
- 책임: 페이지 상단 헤더 표현만 담당. 본문 섹션은 각 페이지가 보유.

### 4.2 페이지별 적용
- **about / contact**: `StaticPageHeader`(title + lead, updatedAt 없음). 섹션 사이 연한 구분선(`border-t border-slate-100`) 또는 기존 `space-y` 유지하며 시각 정돈.
- **privacy / terms**: `StaticPageHeader`(title + lead + `updatedAt="2026.06.01"`). 번호 섹션 사이 구분선으로 또렷하게. 목차 없음.

### 4.3 리드 문단(예시, 구현 시 다듬기)
- about: "부동산 실거래가와 내 주변 생활시설을 한곳에서."
- contact: "문의·데이터 오류 신고·제휴 제안을 받습니다."
- privacy: "일상킷이 개인정보를 어떻게 처리하는지 안내합니다."
- terms: "일상킷 서비스 이용 조건과 절차를 규정합니다."

---

## 5. 테스트

`frontend/tests/`에 페이지 단위 컴포넌트 테스트 추가/갱신 (vitest, happy-dom, `tests/setup.ts` 글로벌 mock 활용).
- **about**: 15개 시설명 모두 렌더 / 데이터 출처 표에 병원·약국·신규6 포함 / `"무인민원발급기"` 문자열 부재 단언
- **terms**: 제2조에 신규 6종 포함 / `"무인민원발급기"` 부재 / 시행일 `2026년 3월 14일` 유지
- **privacy**: 업데이트 배지 `2026.06.01` 노출 / 시행일 유지
- **contact**: 정상 렌더 + 헤더 컴포넌트 사용
- **StaticPageHeader**: `updatedAt` 유무에 따른 배지 조건부 렌더

커밋 전 `cd frontend && npm run test && npm run lint` 통과 필수. 기존 실패 테스트가 있으면 즉시 수정.

---

## 6. 작업 순서(개략)

1. 백엔드 sync 스크립트에서 신규6 + 병원/약국 데이터 출처(데이터명·제공기관·URL) 정확히 추출 → 표 데이터 확정
2. `StaticPageHeader.vue` 작성 + 단위 테스트
3. `about.vue` 콘텐츠(제공정보·출처표) + 헤더 적용 + 테스트
4. `terms.vue` 제2조 + 헤더(배지) + 테스트
5. `privacy.vue` 헤더(배지)/디자인 + 테스트
6. `contact.vue` 헤더/디자인 + 테스트
7. `npm run test` + `npm run lint` 통과 확인

## 7. 검증 기준 (완료 조건)
- 4개 페이지 어디에도 "무인민원발급기" 문자열 없음
- about 제공정보 + terms 제2조 + about 데이터출처 표가 모두 정식 15종 시설과 일치
- privacy·terms에 "마지막 업데이트 2026.06.01" 배지 노출, 시행일 2026-03-14 본문 유지
- 프론트 vitest 전체 통과 + lint 통과
