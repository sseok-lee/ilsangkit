# Reverse Extract Report v2.0

> 실행일: 2026-02-12
> 명령어: `/reverse extract`
> 소스: 코드베이스 직접 분석 (5개 병렬 에이전트)

## 추출 결과 요약

| 카테고리 | 파일 수 | LOC | 항목 수 | 신뢰도 |
|----------|---------|-----|---------|--------|
| Domain Resources | 2 | 1,209 | 11 models + 9 sync | 95% |
| API Contracts | 4 | 778 | 14 endpoints | 90% |
| Screen Specs | 10 | 1,030 | 10 pages | 85% |
| Component Catalog | 1 | 794 | 34 components | 85% |
| Composable Contracts | 1 | 997 | 10 composables | 90% |
| **합계** | **18** | **4,808** | | **89% avg** |

## v1.0 → v2.0 변경 내역

### 신규 도메인 모델 (+3)

| 모델 | 설명 | 데이터 소스 |
|------|------|------------|
| Parking | 공영주차장 | CSV/API (data.go.kr) |
| Aed | 자동심장충격기 | XML API |
| Library | 공공도서관 | CSV |

### 신규 화면 명세 (+6)

| 화면 | 라우트 | 유형 |
|------|--------|------|
| city | `/:city` | 시/도 개요 |
| district | `/:city/:district` | 구/군 개요 |
| trash-detail | `/trash/:id` | 쓰레기 배출 일정 상세 |
| about | `/about` | 소개 (정적) |
| privacy | `/privacy` | 개인정보처리방침 (정적) |
| terms | `/terms` | 이용약관 (정적) |

### 신규 명세 유형 (+2)

| 명세 | 파일 | 설명 |
|------|------|------|
| Component Catalog | `specs/components/catalog.yaml` | 34개 Vue 컴포넌트의 props, emits, slots, dependencies |
| Composable Contracts | `specs/composables/contracts.yaml` | 10개 컴포저블의 input/output 인터페이스, API 의존성 |

## 추출 소스 매핑

```
backend/prisma/schema.prisma ──────→ specs/domain/resources.yaml
backend/src/scripts/*.ts ──────────→ specs/domain/sync-processes.yaml
backend/src/routes/facilities.ts ──→ specs/api/facilities.yaml
backend/src/routes/wasteSchedules.ts → specs/api/waste-schedules.yaml
backend/src/routes/meta.ts ────────→ specs/api/meta.yaml
backend/src/routes/sitemap.ts ─────→ specs/api/sitemap.yaml
frontend/pages/**/*.vue ───────────→ specs/screens/*.yaml (x10)
frontend/components/**/*.vue ──────→ specs/components/catalog.yaml
frontend/composables/*.ts ─────────→ specs/composables/contracts.yaml
```

## 발견된 기술 부채

### 1. 카테고리 enum 불일치
- **위치**: API 스키마 vs 프론트엔드 타입
- **내용**: 일부 코드에서 아직 4개 카테고리(toilet/wifi/clothes/kiosk)만 참조
- **영향**: parking/aed/library 검색 시 클라이언트 타입 오류 가능

### 2. WasteSchedule 좌표 부재
- **위치**: `specs/domain/resources.yaml` → wasteSchedule
- **내용**: 쓰레기 배출 일정에 lat/lng 없어 지도 표시 불가
- **영향**: 통합 검색 화면에서 trash 카테고리 별도 UI 분기 필요

### 3. 지역 슬러그 매핑 불완전
- **위치**: `frontend/pages/[city]/[district]/[category].vue`
- **내용**: DISTRICT_MAP이 일부 지역만 정의
- **영향**: SEO 라우트에서 일부 지역 접근 불가

### 4. 프론트엔드 타입 중복
- **위치**: `frontend/types/api.ts` + `frontend/types/facility.ts`
- **내용**: 유사한 Facility 타입이 두 파일에 분리
- **영향**: 타입 불일치 위험

## 신뢰도 상세

| 추출 영역 | 요소 | 점수 | 근거 |
|-----------|------|------|------|
| DB 스키마 | type_annotations | 1.0 | Prisma 명시적 타입 |
| DB 스키마 | explicit_contracts | 1.0 | 선언적 스키마 |
| API 계약 | type_annotations | 0.9 | Zod 스키마 존재 |
| API 계약 | test_coverage | 0.8 | Supertest 통합 테스트 |
| 화면 구조 | type_annotations | 0.8 | TypeScript + Vue SFC |
| 화면 구조 | consistent_patterns | 0.9 | Nuxt 표준 패턴 |
| 컴포넌트 | explicit_contracts | 0.9 | defineProps/defineEmits |
| 컴포저블 | type_annotations | 0.9 | TypeScript strict |

## 다음 단계

```
→ /reverse review    명세 리뷰 및 수동 보완
→ /reverse finalize  명세 확정 및 갭 분석
→ /sync check        명세-코드 동기화 검증
→ /tasks-generator   갭 기반 태스크 생성
```
