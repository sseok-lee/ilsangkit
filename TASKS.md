# TASKS.md - 일상킷 Post-MVP 개선 태스크

> 생성일: 2026-02-12
> 소스: `/reverse finalize` 갭 분석 (docs/planning/reverse-gaps.md)
> 모드: analyze (기존 코드베이스 분석 기반)

## 현재 상태

- MVP 기능: **28/28 완료** (100%)
- 카테고리: **7개** (toilet, wifi, clothes, kiosk, parking, aed, library)
- 명세 커버리지: **96%** (18 YAML, ~4,808 LOC)
- 기술 부채: **9건**, 명세 갭: **67건**

---

## Phase 10: Critical 갭 해소 (에러/검증/복구)

> 우선순위: **Critical** | 병렬 가능: R1, R2, R3 독립 실행

### P10-R1: 에러 처리 표준화

- P10-R1-T1: 표준 에러 응답 명세 작성 `specs/api/error-handling.yaml`
  - [x] AppError/ValidationError/NotFoundError 클래스 계약 정의
  - [x] HTTP 상태 코드별 응답 스키마 표준화 (400, 404, 422, 500)
  - [x] 에러 코드 enum 정의 (VALIDATION_ERROR, NOT_FOUND, INTERNAL_ERROR 등)
  - Assignee: backend-specialist
  - Depends: none

- P10-R1-T2: asyncHandler 통합 적용
  - [x] 모든 라우트 핸들러에 asyncHandler 일관 적용
  - [x] try-catch 직접 사용 패턴 제거
  - [x] 에러 미들웨어에서 표준 응답 포맷 강제
  - Assignee: backend-specialist
  - Depends: P10-R1-T1

- P10-R1-T3: Request ID 추적 미들웨어 추가
  - [x] `X-Request-Id` 헤더 생성/전달 미들웨어
  - [x] 에러 로그에 requestId 포함
  - [x] 프론트엔드 에러 리포팅에 requestId 포함
  - Assignee: backend-specialist
  - Depends: P10-R1-T2

### P10-R2: 좌표 검증 범위 통일

- P10-R2-T1: Zod 스키마에 한국 영역 검증 추가
  - [x] lat: 33~39, lng: 124~132 범위 적용 (common.ts)
  - [x] 기존 전역 범위(-90~90, -180~180) → 한국 영역으로 축소
  - [x] 에러 메시지: "한국 영역 외 좌표입니다" 추가
  - Assignee: backend-specialist
  - Depends: none

### P10-R3: 동기화 실패 복구 전략

- P10-R3-T1: sync-processes.yaml 실패 복구 명세 보완
  - [x] 중간 실패 시 롤백 전략 정의 (트랜잭션 단위)
  - [x] 재시도 정책 정의 (최대 3회, 지수 백오프)
  - [x] SyncHistory에 실패 상세 기록 (실패 지점, 처리된 건수)
  - Assignee: backend-specialist
  - Depends: none

- P10-R3-T2: 동기화 스크립트에 트랜잭션 래핑 적용
  - [x] Prisma $transaction 사용하여 배치 upsert 원자성 보장
  - [x] 실패 시 부분 커밋 방지
  - [x] SyncHistory에 처리 progress 기록
  - Assignee: backend-specialist
  - Depends: P10-R3-T1

### P10-V: Phase 10 검증
- [x] 모든 API 엔드포인트가 표준 에러 형식 반환 확인
- [x] 좌표 범위 벗어나는 요청 시 422 반환 확인
- [x] 동기화 중단 후 재실행 시 데이터 정합성 확인
- Depends: P10-R1-T3, P10-R2-T1, P10-R3-T2
- ✅ **검증 완료**: 24 test files, 247 tests passed

---

## Phase 11: 프로덕션 안정성 (보안/성능/접근성)

> 우선순위: **High** | 병렬 가능: R1~R4 독립 실행

### P11-R1: Rate Limiting

- P11-R1-T1: API Rate Limiting 미들웨어 구현
  - [x] express-rate-limit 적용 (IP당 100 req/min)
  - [x] /api/facilities/search에 별도 제한 (IP당 30 req/min)
  - [x] 429 Too Many Requests 응답 + Retry-After 헤더
  - Assignee: backend-specialist
  - Depends: P10-R1-T1

### P11-R2: 보안 강화

- P11-R2-T1: 보안 헤더 미들웨어 추가
  - [x] helmet.js 적용 (CSP, X-Frame-Options, HSTS 등)
  - [x] CORS 설정 명시적 origin 제한 (프로덕션)
  - [x] 입력값 sanitization 확인 (XSS 방지)
  - Assignee: backend-specialist
  - Depends: none

### P11-R3: 성능 요구사항 정의 및 측정

- P11-R3-T1: 비기능 요구사항 명세 작성 `specs/non-functional-requirements.yaml`
  - [x] Core Web Vitals 목표: LCP < 2.5s, FID < 100ms, CLS < 0.1
  - [x] API 응답시간: p50 < 200ms, p95 < 500ms
  - [x] 번들 크기 제한: JS < 200KB (gzipped)
  - Assignee: frontend-specialist
  - Depends: none

- P11-R3-T2: Lighthouse CI 파이프라인 추가
  - [x] GitHub Actions에 Lighthouse CI 워크플로우 추가
  - [x] Performance > 90, SEO > 90, Accessibility > 85 게이트
  - [x] 실패 시 PR 블로킹
  - Assignee: frontend-specialist
  - Depends: P11-R3-T1

### P11-R4: 접근성 개선

- P11-R4-T1: WCAG 2.1 Level AA 감사
  - [x] 전체 페이지 axe-core 자동 검사 실행
  - [x] 키보드 네비게이션 테스트 (Tab, Enter, Escape)
  - [x] 터치 타겟 최소 44x44px 확인
  - [x] 컬러 대비 ratio 4.5:1 이상 확인
  - Assignee: frontend-specialist
  - Depends: none

### P11-V: Phase 11 검증
- [x] Rate limit 초과 시 429 반환 확인
- [x] 보안 헤더 응답에 포함 확인 (curl -I)
- [x] Lighthouse CI 게이트 통과
- [x] axe-core 자동 검사 0 violations
- Depends: P11-R1-T1, P11-R2-T1, P11-R3-T2, P11-R4-T1
- ✅ **검증 완료**: 26 test files, 275 tests passed

---

## Phase 12: 기술 부채 해소

> 우선순위: **Medium** | 병렬 가능: T1~T5 독립 실행

- P12-T1: DB 시드 스크립트 작성
  - [x] `prisma/seed.ts` 생성 (최소 데이터셋)
  - [x] 카테고리별 10건 + Region 10건 + Category 7건
  - [x] `package.json` prisma.seed 설정
  - Assignee: backend-specialist
  - Depends: none

- P12-T2: 프론트엔드 타입 통합
  - [x] `types/api.ts`와 `types/facility.ts` 중복 타입 통합
  - [x] 단일 소스(types/index.ts)에서 re-export
  - [x] 모든 import 경로 업데이트
  - Assignee: frontend-specialist
  - Depends: none

- P12-T3: 매직 넘버 상수화
  - [x] 페이지네이션 기본값 → `constants/defaults.ts`
  - [x] 좌표 범위 → `constants/geo.ts`
  - [x] API 타임아웃 → `constants/sync.ts`
  - Assignee: backend-specialist
  - Depends: none

- P12-T4: 네이밍 통일 (trash vs wasteSchedule)
  - [x] 프론트엔드 라우트: `/trash/` 유지 (사용자 친화적)
  - [x] 백엔드 모델/서비스: `wasteSchedule` 유지 (도메인 정확성)
  - [x] 매핑 문서 작성 (프론트 ↔ 백엔드 네이밍 규칙)
  - Assignee: frontend-specialist
  - Depends: none

- P12-T5: 테스트 커버리지 측정 및 보고
  - [x] Backend vitest coverage 실행 및 현재 커버리지 확인
  - [x] Frontend vitest coverage 실행 및 현재 커버리지 확인
  - [x] 80% 미만 파일 목록 정리 → 테스트 추가 계획
  - Assignee: test-specialist
  - Depends: none

### P12-V: Phase 12 검증
- [x] `npx prisma db seed` 성공 확인
- [x] 타입 import 오류 0건 (`npx tsc --noEmit`)
- [x] 상수 파일에서만 기본값 참조 확인
- [x] Backend/Frontend 테스트 전체 통과
- Depends: P12-T1~T5
- ✅ **검증 완료**: 26 test files, 275 tests passed

---

## Phase 13: 문서 보완

> 우선순위: **Medium-Low** | 병렬 가능: T1~T4 독립 실행

- P13-T1: ADR 작성 (아키텍처 결정 기록)
  - [ ] `docs/adr/001-category-specific-tables.md` - 단일 테이블 → 카테고리별 테이블 결정
  - [ ] `docs/adr/002-ssr-ssg-strategy.md` - Nuxt SSR/ISR 선택 근거
  - Assignee: backend-specialist
  - Depends: none

- P13-T2: 기획 문서 현행화
  - [ ] PRD 카테고리 5개 → 7개 반영
  - [ ] DB 설계 문서에 카테고리별 테이블 구조 반영
  - [ ] 태스크 목록에 Phase 9~10 추가
  - Assignee: docs-specialist
  - Depends: none

- P13-T3: 배포 아키텍처 문서
  - [ ] `docs/deployment.md` 생성
  - [ ] Nginx 리버스 프록시 설정
  - [ ] PM2 클러스터 구성 (2 backend + 2 frontend)
  - [ ] GitHub Actions CI/CD 파이프라인 설명
  - Assignee: docs-specialist
  - Depends: none

- P13-T4: 환경 변수 문서
  - [ ] `docs/env-variables.md` - 모든 환경 변수 목록
  - [ ] Backend/Frontend 각 `.env.example` 최신화
  - [ ] 비밀키 관리 방법 설명
  - Assignee: docs-specialist
  - Depends: none

---

## Phase 14: QA & 수동 검증

> 우선순위: **Medium** | 순차 실행

- P14-T1: Lighthouse 성능 측정
  - [ ] Desktop Performance > 90
  - [ ] Mobile Performance > 85
  - [ ] SEO Score > 90
  - [ ] Accessibility Score > 85
  - Assignee: frontend-specialist
  - Depends: P11-R3-T2

- P14-T2: 크로스 브라우저 테스트
  - [ ] Chrome (Desktop + Mobile)
  - [ ] Safari (Desktop + iOS)
  - [ ] Samsung Internet
  - [ ] Firefox
  - Assignee: test-specialist
  - Depends: none

- P14-T3: Google Search Console 확인
  - [ ] 사이트맵 제출 완료
  - [ ] 인덱싱 상태 확인
  - [ ] 모바일 사용성 리포트 확인
  - Assignee: frontend-specialist
  - Depends: none

- P14-T4: 부하 테스트
  - [ ] 동시 1000명 검색 시 p95 < 500ms
  - [ ] 사이트맵 50K+ URL 생성 성능
  - [ ] Kakao API 쿼터 사용량 모니터링
  - Assignee: backend-specialist
  - Depends: P11-R1-T1

---

## 의존성 그래프

```
Phase 10 (Critical)     Phase 11 (High)         Phase 12 (Medium)    Phase 13 (Docs)
┌─────────────┐         ┌─────────────┐         ┌────────────┐       ┌────────────┐
│ P10-R1 에러 │────────→│ P11-R1 Rate │         │ P12-T1~T5  │       │ P13-T1~T4  │
│ P10-R2 좌표 │    │    │ P11-R2 보안 │         │ (독립 실행) │       │ (독립 실행) │
│ P10-R3 동기화│    │    │ P11-R3 성능 │────────→│            │       │            │
└─────────────┘    │    │ P11-R4 접근성│         └────────────┘       └────────────┘
                   │    └─────────────┘                                     │
                   │          │                                             │
                   │          ▼                                             ▼
                   │    ┌─────────────┐                              ┌────────────┐
                   └───→│ Phase 14    │◀─────────────────────────────│            │
                        │ QA & 검증   │                              │            │
                        └─────────────┘                              └────────────┘
```

---

## 진행 요약

| Phase | 태스크 | 상태 | 설명 |
|-------|--------|------|------|
| P0~P9 | 53 tasks | ✅ 완료 | MVP + 카테고리 확장 |
| P10 | 7 tasks | ✅ 완료 | Critical 갭 해소 |
| P11 | 6 tasks | ✅ 완료 | 프로덕션 안정성 |
| P12 | 6 tasks | ✅ 완료 | 기술 부채 |
| P13 | 4 tasks | ⬜ 대기 | 문서 보완 |
| P14 | 4 tasks | ⬜ 대기 | QA 검증 |
| **합계** | **27 tasks** | | Post-MVP |
