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
npm run sync:facilities  # 전체 시설 동기화 (syncAll.ts)
npm run sync:[slug]      # 개별 카테고리: toilet, trash, wifi, clothes, kiosk, parking, aed, regions
npm run sync:apt-sale    # 부동산: apt-sale, apt-rent, villa-sale, villa-rent, offitel-sale, offitel-rent
npm run sync:geocode-real-estate  # 부동산 좌표 geocoding
```

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

**시설 카테고리 (프론트엔드 10개, 백엔드 14개)**

프론트엔드 3그룹: 생활편의(toilet, wifi, parking, kiosk), 건강안전(hospital, pharmacy, aed), 문화환경(library, clothes, trash)

백엔드 추가 4개: park, school, market, childcare, ev-charger, sports (프론트엔드 미노출)

**부동산 실거래가 (6개)**: `apt-sale`, `apt-rent`, `villa-sale`, `villa-rent`, `offitel-sale`, `offitel-rent`
- 주의: 오피스텔 slug는 `offitel` (officetel 아님)

### Route Structure
- **Frontend pages**: `/[category]/`, `/[city]/[district]/`, `/search`, `/[category]/[id]`
- **Frontend pages (부동산)**: `/real-estate/`, `/real-estate/[propertyType]/`, `/real-estate/[propertyType]/[buildingName]`
- **Backend API**: `/api/facilities`, `/api/real-estate`, `/api/waste-schedules`, `/api/meta`, `/api/sitemap`, `/api/reviews`, `/api/guides`, `/api/area`

## Backend Patterns

### Category Registry (`src/services/facilityService.ts`)
핵심 추상화. 모든 시설 CRUD가 이 레지스트리를 통해 동작:
```typescript
CATEGORY_REGISTRY: Record<FacilityCategory, { model(), listFields[], detailFields[] }>
```
새 카테고리 추가 시 이 레지스트리에 등록해야 라우트가 자동으로 동작.

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

### Composable 패턴
- `readonly()` ref 반환으로 불변성 보장
- `$fetch` + `useRuntimeConfig().public.apiBase`로 API 호출
- 주요 composable: `useFacilitySearch`, `useRealEstate`, `useFacilityDetail`, `useKakaoMap`

### Test Setup (`tests/setup.ts`)
Nuxt auto-import 함수들을 글로벌 mock으로 등록:
- `useAsyncData`, `$fetch`, `useRuntimeConfig`, `useSeoMeta`, `useHead` 등
- `NuxtLink`, `CategoryIcon` 컴포넌트 stub
- Vitest 환경: `happy-dom`

### MSW (Mock Service Worker)
- `frontend/mocks/handlers/`에 핸들러 정의
- `NUXT_PUBLIC_DISABLE_MSW=true`로 프로덕션에서 비활성화

### Server Routes (`server/`)
Nitro 서버사이드: 사이트맵(`/sitemap.xml`), OG 이미지(`/og`), URL 리다이렉트 미들웨어

## Data Sync Pipeline
각 카테고리별 sync 스크립트가 공공데이터 API/CSV를 받아 Prisma로 MySQL에 upsert.
- 카테고리별 Prisma 모델은 별도 테이블 (Toilet, Wifi, Parking 등)
- 부동산: 국토교통부 XML API → transform → `syncRealEstateBase.ts` 공통 유틸로 upsert
- `geocodeRealEstate.ts`로 좌표 데이터 보강

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
- CI: GitHub Actions — Test 워크플로우 성공 시 Deploy 워크플로우 자동 트리거
- 서버: Cafe24, PM2 (`ilsangkit-backend`, `ilsangkit-frontend`)
- 프로덕션 도메인: `ilsangkit.co.kr`

## 카테고리 추가 시 수정 필요 파일
1. `frontend/types/facility.ts` — `FacilityCategory` 타입, `CATEGORY_GROUPS`, `CATEGORY_META`, `CATEGORY_DATA_PORTAL_URL`
2. `backend/prisma/schema.prisma` — 새 모델 추가
3. `backend/src/services/facilityService.ts` — `CATEGORY_REGISTRY`에 등록
4. `backend/src/routes/facilities.ts` — 라우트 핸들러 (보통 변경 불필요)
5. `backend/src/scripts/sync*.ts` — 동기화 스크립트
6. `frontend/components/facility/details/*Detail.vue` — 상세 컴포넌트
7. `frontend/tests/components/facility/details/*Detail.test.ts` — 테스트

## 부동산 카테고리 추가 시 수정 필요 파일
1. `backend/prisma/schema.prisma` — 새 트랜잭션 모델
2. `backend/src/scripts/sync*.ts` — 동기화 스크립트
3. `backend/src/services/realEstateService.ts` — `getModel()` 레지스트리에 추가
4. `backend/src/schemas/realEstate.ts` — `RealEstateTypeSchema` enum 추가
5. `frontend/types/realEstate.ts` — 타입/slug 매핑 추가
6. `frontend/utils/realEstateMeta.ts` — 메타/FAQ/설명 추가
