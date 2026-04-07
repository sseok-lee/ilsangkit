# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

### Prerequisites
- **Node 20 필수** (`nvm use 20`) — CI/호스팅 서버가 Node 20 기준
- Docker Compose로 MySQL 8 실행: `docker compose up -d`
- MySQL 접속: `localhost:3307`, user: `ilsangkit`, pw: `ilsangkit123`, db: `ilsangkit`

### Backend (`cd backend`)
```bash
npm run dev          # tsx watch 개발 서버 (port 8000)
npm run build        # tsc 빌드
npm run test         # vitest run (전체 테스트)
npm run test:watch   # vitest (watch 모드)
npx vitest run __tests__/path/to/file.test.ts  # 단일 테스트 파일 실행
npm run lint         # ESLint
npm run lint:fix     # ESLint 자동 수정
```

### Frontend (`cd frontend`)
```bash
npm run dev          # nuxt dev 개발 서버 (port 3000)
npm run build        # nuxt build (SSR)
npm run generate     # nuxt generate (SSG)
npm run test         # vitest run (전체 테스트)
npm run test:watch   # vitest watch
npx vitest run tests/path/to/file.test.ts  # 단일 테스트 파일 실행
npm run test:e2e     # Playwright E2E 테스트
npm run test:e2e:ui  # Playwright UI 모드
npm run lint         # ESLint
```

### Prisma (`cd backend`)
```bash
npm run db:push      # 스키마를 DB에 반영 (dev용)
npm run db:migrate   # 마이그레이션 생성/적용
npm run db:generate  # Prisma Client 재생성
npm run db:studio    # Prisma Studio (DB GUI)
npm run db:seed      # 시드 데이터 삽입
```

### Data Sync (`cd backend`)
```bash
npx tsx src/scripts/syncAll.ts       # 전체 동기화
npx tsx src/scripts/syncToilet.ts    # 개별 카테고리 동기화
```
상세 가이드: [SYNC.md](./backend/SYNC.md)

## Architecture Overview

### Tech Stack
- **Frontend**: Nuxt 3 (SSR) + Vue 3 + Pinia + TailwindCSS
- **Backend**: Express 5 + TypeScript (ESM)
- **Database**: MySQL 8 (Docker, port 3307) + Prisma ORM
- **Testing**: Vitest (unit), Playwright (E2E), MSW (API mocking)
- **Deploy**: GitHub Actions → Cafe24 서버 (SSH/SCP), PM2 프로세스 매니저
- **Data Source**: 공공데이터포털 API/CSV, 국토교통부 실거래가 API

### System Flow
```
Nuxt 3 SSR (port 3000) → Express 5 API (port 8000) → MySQL 8 (Prisma) → 공공데이터 API
```
Frontend에서 `$fetch`로 API 호출 (`useRuntimeConfig().public.apiBase` 사용). nuxt.config에서 `/api/**` → `http://localhost:8000/api/**` 프록시 설정.

### Categories

**시설 카테고리 (15개)**

`toilet`, `trash`, `wifi`, `clothes`, `parking`, `aed`, `library`, `hospital`, `pharmacy`, `park`, `school`, `market`, `childcare`, `ev-charger`, `sports`

프론트엔드 `CATEGORY_GROUPS` 3그룹: 교육/육아(school, childcare, library), 생활편의(parking, ev-charger, toilet, wifi), 생활환경(park, market, clothes, aed, hospital, pharmacy, sports)

- `trash`(쓰레기배출)는 좌표 없는 일정 데이터 — `WasteSchedule` 별도 모델, 시설 카테고리와 분리 처리
- `ev-charger`는 충전소(station) 단위 그룹핑 — `statId` 기준 `$queryRaw` GROUP BY 사용 (일반 Prisma findMany가 아님)

**부동산 실거래가 (6개)**: `apt-sale`, `apt-rent`, `villa-sale`, `villa-rent`, `offitel-sale`, `offitel-rent`
- 주의: 오피스텔 slug는 `offitel` (officetel 아님)

### Route Structure
- **Frontend pages**: `/[category]/`, `/[category]/[id]`, `/search`, `/guide`, `/guide/[slug]`
- **지역 페이지**: `/[city]/` (지역 허브), `/[city]/[district]/`, `/[city]/[district]/[category]`
- **부동산**: `/real-estate/`, `/real-estate/[propertyType]/`, `/real-estate/[propertyType]/[buildingName]`
- **Backend API**: `/api/facilities`, `/api/real-estate`, `/api/waste-schedules`, `/api/meta`, `/api/sitemap`, `/api/reviews`, `/api/guides`, `/api/area`

## Backend Patterns

### Category Registry (`src/services/facilityService.ts`)
핵심 추상화. 모든 시설 CRUD가 이 레지스트리를 통해 동작:
```typescript
CATEGORY_REGISTRY: Record<FacilityCategory, { model(), listFields[], detailFields[] }>
```
새 카테고리 추가 시 이 레지스트리에 등록해야 라우트가 자동으로 동작.

### City Variant Matching
DB에 `서울특별시`/`서울` 두 형태가 혼재. `CITY_SLUG_TO_FULL`, `CITY_SLUG_TO_SHORT` 맵으로 양방향 변환:
```typescript
// slug → 정식명, 축약명
CITY_SLUG_TO_FULL['seoul']  // '서울특별시'
CITY_SLUG_TO_SHORT['seoul'] // '서울'
```
지역 필터 시 반드시 `buildRegionFilter()` 사용하거나 `{ city: { in: cityVariants } }` 패턴으로 양쪽 매칭. raw query에서도 `IN (?, ?)` 패턴 적용 필수.

### Route Handler 패턴
모든 라우트 핸들러는 반드시 `asyncHandler()`로 래핑:
```typescript
router.get('/path', validate(Schema, 'query'), asyncHandler(async (req, res) => { ... }));
```
- `asyncHandler` (`src/lib/asyncHandler.ts`): Promise rejection을 에러 미들웨어로 전파
- `validate` (`src/middlewares/validate.ts`): Zod 스키마로 요청 검증 → 실패 시 422

### Error Classes (`src/lib/errors.ts`)
수동 `res.status().json()` 대신 에러 클래스를 throw:
- `NotFoundError` (404), `ValidationError` (422, with details), `ConflictError` (409)
- 글로벌 에러 핸들러가 `{ success: false, error: { code, message, requestId } }` 형태로 응답

### Sync Pipeline (`src/services/baseSyncService.ts`)
공공데이터 동기화 공통 패턴:
- `runSync()`: SyncHistory 생성/업데이트, 상태 추적 (running → success/failed)
- `batchUpsert()`: 500건 배치 트랜잭셔널 upsert, `sourceId` 기준 중복 방지
- 새 sync 스크립트는 기존 것(예: `syncToilet.ts`)을 참고하여 동일 패턴 사용
- 부동산: 국토교통부 XML API → transform → `syncRealEstateBase.ts` 공통 유틸로 upsert

### ESM Import 규칙
Backend는 ESM — 모든 로컬 import에 `.js` 확장자 필수:
```typescript
import prisma from '../lib/prisma.js';
```

### BigInt/Decimal 직렬화
부동산 서비스(`realEstateService.ts`)에서 BigInt/Decimal을 Number로 변환하는 `serializeRow()` 사용. JSON 응답 시 필수.

### Express 5 주의점
query/params가 read-only. validation 미들웨어에서 `Object.defineProperty`로 교체.

## Frontend Patterns

### SSR 주의사항
브라우저 API(`document`, `window`) 직접 접근 시 반드시 클라이언트 가드:
```typescript
if (!import.meta.client) return  // 또는 if (process.server) return
```
`watch`, `onMounted` 내부라도 SSR 시점에 실행될 수 있으므로 가드 필수. Hydration mismatch 방지.

### Composable 패턴
- `readonly()` ref 반환으로 불변성 보장
- `$fetch` + `useRuntimeConfig().public.apiBase`로 API 호출
- 주요 composable: `useFacilitySearch`, `useRealEstate`, `useFacilityDetail`, `useKakaoMap`, `useRegionFacilities`, `useWasteSchedule`

### Test Setup (`tests/setup.ts`)
Nuxt auto-import 함수들을 글로벌 mock으로 등록:
- `useAsyncData`, `$fetch`, `useRuntimeConfig`, `useSeoMeta`, `useHead` 등
- `NuxtLink`, `CategoryIcon` 컴포넌트 stub
- Vitest 환경: `happy-dom`

### MSW (Mock Service Worker)
- `frontend/mocks/handlers/`에 핸들러 정의
- `NUXT_PUBLIC_DISABLE_MSW=true`로 프로덕션에서 비활성화

### Server Routes (`server/`)
Nitro 서버사이드: 사이트맵(`/sitemap.xml`, `/sitemap/[...].ts`), OG 이미지(`/og`), URL 리다이렉트 미들웨어(`redirects.ts`, `real-estate-redirect.ts`)

## Environment Variables

### Backend
`DATABASE_URL`, `PORT` (default 8000), `NODE_ENV`, `CORS_ORIGIN` (콤마 구분), `UPLOAD_DIR`

### Frontend
`NUXT_PUBLIC_API_BASE` (default `http://localhost:8000`), `NUXT_PUBLIC_KAKAO_MAP_KEY`, `NUXT_PUBLIC_GA_ID`, `NUXT_PUBLIC_SITE_URL` (default `https://ilsangkit.co.kr`), `NUXT_PUBLIC_DISABLE_MSW`

## Constants (`backend/src/constants/`)
- Pagination: DEFAULT_PAGE=1, DEFAULT_LIMIT=20, MAX_LIMIT=100
- Korea bounds: lat 33-39, lng 124-131
- Search: radius 100-50000m, default 1000m
- Sync: batch 500건, API timeout 30초

## Deploy
- CI: GitHub Actions — `Test` 워크플로우(lint+test+build) 성공 시 `Deploy to Cafe24` 워크플로우 자동 트리거
- Test: backend(MySQL 서비스 컨테이너 + prisma db push) / frontend(nuxt prepare + lint + test + build) 병렬
- Deploy: backend/frontend 빌드 → SCP → 서버에서 `npm ci` + `prisma db push` + `pm2 restart`
- 서버: Cafe24, PM2 (`ilsangkit-backend`, `ilsangkit-frontend`)
- 프로덕션 도메인: `ilsangkit.co.kr`

## 카테고리 추가 시 수정 필요 파일
1. `frontend/types/facility.ts` — `FacilityCategory` 타입, `CATEGORY_GROUPS`, `CATEGORY_META`, `CATEGORY_DATA_PORTAL_URL`
2. `backend/prisma/schema.prisma` — 새 모델 추가
3. `backend/src/services/facilityService.ts` — `CATEGORY_REGISTRY`에 등록, `ALL_CATEGORIES` 배열에 추가
4. `backend/src/routes/facilities.ts` — 라우트 핸들러 (보통 변경 불필요)
5. `backend/src/scripts/sync*.ts` — 동기화 스크립트
6. `frontend/components/facility/details/*Detail.vue` — 상세 컴포넌트
7. `frontend/tests/components/facility/details/*Detail.test.ts` — 테스트

## 부동산 카테고리 추가 시 수정 필요 파일
1. `backend/prisma/schema.prisma` — 새 트랜잭션 모델
2. `backend/src/scripts/sync*.ts` — 동기화 스크립트 (`syncRealEstateBase.ts` 공통 유틸 활용)
3. `backend/src/services/realEstateService.ts` — `getModel()` 레지스트리에 추가
4. `backend/src/schemas/realEstate.ts` — `RealEstateTypeSchema` enum 추가
5. `frontend/types/realEstate.ts` — 타입/slug 매핑 추가
6. `frontend/utils/realEstateMeta.ts` — 메타/FAQ/설명 추가

## 하네스: Code Review

**목표:** 4개 전문 에이전트를 병렬 실행하여 종합 코드 리뷰 리포트를 생성

**에이전트 팀:**
| 에이전트 | 역할 |
|---------|------|
| arch-reviewer | 아키텍처 리뷰 (레이어 분리, 의존성, 패턴 일관성) |
| security-reviewer | 보안 취약점 (OWASP Top 10, 인젝션, 인증/인가) |
| perf-reviewer | 성능 병목 (DB 쿼리, SSR, 번들, 캐싱) |
| style-reviewer | 코드 스타일 (네이밍, 복잡도, DRY, 컨벤션) |

**스킬:**
| 스킬 | 용도 | 사용 에이전트 |
|------|------|-------------|
| arch-review | 아키텍처 분석 기준 및 워크플로우 | arch-reviewer |
| security-review | 보안 취약점 탐지 기준 및 워크플로우 | security-reviewer |
| perf-review | 성능 병목 탐지 기준 및 워크플로우 | perf-reviewer |
| style-review | 스타일 일관성 평가 기준 및 워크플로우 | style-reviewer |
| code-review-orchestrator | 4개 에이전트 병렬 실행 및 통합 리포트 생성 | 오케스트레이터 |

**실행 규칙:**
- 코드 리뷰/검토 요청 시 `code-review-orchestrator` 스킬을 통해 에이전트를 병렬 실행하라
- 특정 영역만 리뷰 시에도 오케스트레이터를 통해 해당 에이전트만 실행
- 단순 코드 질문은 에이전트 없이 직접 응답해도 무방
- 모델 라우팅: arch/security → `opus`, perf/style → `sonnet` (비용 절감)
- 중간 산출물: `_workspace/` 디렉토리

**디렉토리 구조:**
```
.claude/
├── agents/
│   ├── arch-reviewer.md
│   ├── security-reviewer.md
│   ├── perf-reviewer.md
│   └── style-reviewer.md
└── skills/
    ├── arch-review/SKILL.md
    ├── security-review/SKILL.md
    ├── perf-review/SKILL.md
    ├── style-review/SKILL.md
    └── code-review-orchestrator/SKILL.md
```

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-07 | 초기 구성 | 전체 | 종합 코드 리뷰 하네스 구축 |

## 하네스: Design UI/UX

**목표:** 웹사이트 디자인을 체계적으로 분석·개선·검증하는 4단계 파이프라인

**에이전트 팀:**
| 에이전트 | 역할 |
|---------|------|
| ux-auditor | UX 감사 (사용자 흐름, 정보 구조, 유저빌리티 분석) |
| visual-designer | 비주얼 디자인 제안 (색상, 타이포, 레이아웃, 시각 계층) |
| design-implementer | Vue/TailwindCSS 코드 구현 |
| design-qa | 반응형, 접근성(a11y), 디자인 일관성 검증 |

**스킬:**
| 스킬 | 용도 | 사용 에이전트 |
|------|------|-------------|
| ux-audit | UX 감사 워크플로우 (IA, 흐름, 휴리스틱 평가) | ux-auditor |
| visual-design | 비주얼 디자인 분석 및 개선안 도출 | visual-designer |
| design-implement | 디자인 제안서를 코드로 변환·적용 | design-implementer |
| design-qa | 구현 결과의 반응형/접근성/일관성 검증 | design-qa |
| design-orchestrator | 4개 에이전트 파이프라인 조율 및 통합 | 오케스트레이터 |

**실행 규칙:**
- 디자인/UI/UX 개선 요청 시 `design-orchestrator` 스킬을 통해 에이전트를 실행하라
- UX 분석만 요청 시 `ux-audit` 스킬 단독 실행 가능
- 디자인 검증만 요청 시 `design-qa` 스킬 단독 실행 가능
- 단순 스타일 질문은 에이전트 없이 직접 응답해도 무방
- 모든 에이전트는 `model: "opus"` 사용
- 중간 산출물: `_workspace/` 디렉토리

**디렉토리 구조:**
```
.claude/
├── agents/
│   ├── ux-auditor.md
│   ├── visual-designer.md
│   ├── design-implementer.md
│   └── design-qa.md
└── skills/
    ├── ux-audit/SKILL.md
    ├── visual-design/SKILL.md
    ├── design-implement/SKILL.md
    ├── design-qa/SKILL.md
    └── design-orchestrator/SKILL.md
```

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-07 | 초기 구성 | 전체 | 디자인 UI/UX 하네스 구축 |
