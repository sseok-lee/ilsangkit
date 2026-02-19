# CLAUDE.md - ilsangkit Project Guide

## Build & Development Commands

### Prerequisites
- **Node 20 필수** (`nvm use 20`) - CI/호스팅 서버가 Node 20 기준
- Docker Compose로 MySQL 8 실행: `docker compose up -d`
- MySQL 접속: `localhost:3307`, user: `ilsangkit`, pw: `ilsangkit123`, db: `ilsangkit`

### Backend (`cd backend`)
```bash
npm run dev          # tsx watch 개발 서버
npm run build        # tsc 빌드
npm run test         # vitest run (전체 테스트)
npm run test:watch   # vitest (watch 모드)
npx vitest run __tests__/path/to/file.test.ts  # 단일 테스트 파일 실행
npm run lint         # ESLint
npm run lint:fix     # ESLint 자동 수정
```

### Frontend (`cd frontend`)
```bash
npm run dev          # nuxt dev 개발 서버
npm run build        # nuxt build (SSR)
npm run generate     # nuxt generate (SSG)
npm run test         # vitest run (전체 테스트)
npm run test:watch   # vitest watch
npx vitest run tests/path/to/file.test.ts  # 단일 테스트 파일 실행
npm run test:e2e     # Playwright E2E 테스트
npm run test:e2e:ui  # Playwright UI 모드
npm run lint         # ESLint
```

### Prisma (backend)
```bash
npm run db:push      # 스키마를 DB에 반영 (dev용)
npm run db:migrate   # 마이그레이션 생성/적용
npm run db:generate  # Prisma Client 재생성
npm run db:studio    # Prisma Studio (DB GUI)
npm run db:seed      # 시드 데이터 삽입
```

### Data Sync (backend)
```bash
npm run sync:facilities  # 전체 시설 동기화 (syncAll.ts)
npm run sync:toilet      # 공공화장실
npm run sync:trash       # 쓰레기배출
npm run sync:wifi        # 무료와이파이
npm run sync:clothes     # 의류수거함
npm run sync:kiosk       # 무인민원발급기
npm run sync:parking     # 공영주차장
npm run sync:aed         # 자동심장충격기 (AED)
npm run sync:regions     # 지역 정보
```

## Architecture Overview

### Tech Stack
- **Frontend**: Nuxt 3 (SSR) + Vue 3 + Pinia + TailwindCSS
- **Backend**: Express 5 + TypeScript (ESM)
- **Database**: MySQL 8 (Docker, port 3307) + Prisma ORM
- **Testing**: Vitest (unit), Playwright (E2E), MSW (API mocking)
- **Data Source**: 공공데이터포털 API/CSV

### System Flow
```
Nuxt 3 SSR (Frontend) → Express 5 API (Backend) → MySQL 8 (Prisma) → 공공데이터 API
```

Frontend에서 `$fetch`로 API 호출 (runtime config `apiBase` 사용).

### Categories (10개, 3그룹)
| 그룹 | 카테고리 | slug | 한글 |
|------|---------|------|------|
| 생활 편의 | toilet | `toilet` | 공공화장실 |
| | wifi | `wifi` | 무료와이파이 |
| | parking | `parking` | 공영주차장 |
| | kiosk | `kiosk` | 무인민원발급기 |
| 건강/안전 | hospital | `hospital` | 병원 |
| | pharmacy | `pharmacy` | 약국 |
| | aed | `aed` | 자동심장충격기 |
| 문화/환경 | library | `library` | 공공도서관 |
| | clothes | `clothes` | 의류수거함 |
| | trash | `trash` | 쓰레기배출 |

### Route Structure
- **Frontend pages**: `/[category]/`, `/[city]/[district]/`, `/search`, `/[category]/[id]`
- **Backend API routes**: `facilities.ts` (CRUD/검색), `meta.ts` (메타), `sitemap.ts`, `wasteSchedules.ts`

### Data Sync Pipeline
각 카테고리별 sync 스크립트가 공공데이터 API/CSV를 받아 Prisma로 MySQL에 upsert.
- 카테고리별 Prisma 모델은 별도 테이블 (Toilet, Wifi, Parking 등)
- `syncAll.ts`로 전체 일괄 동기화

## Key Conventions

### TypeScript
- **strict mode** 양쪽 모두 사용
- Backend: ESM (`"type": "module"`)
- Frontend: Nuxt 3 auto-import (composables, components)

### Validation & Mocking
- **Backend**: Zod로 요청 파라미터 검증
- **Frontend dev**: MSW로 API mocking (`public/mockServiceWorker.js`)

### Security (Backend)
- Helmet, CORS, express-rate-limit, input sanitization 적용

### 카테고리 추가 시 수정 필요 파일
1. `frontend/types/facility.ts` - `FacilityCategory` 타입, `CATEGORY_GROUPS`, `CATEGORY_META`, `CATEGORY_DATA_PORTAL_URL`
2. `backend/prisma/schema.prisma` - 새 모델 추가
3. `backend/src/routes/facilities.ts` - 라우트 핸들러
4. `backend/src/scripts/sync*.ts` - 동기화 스크립트
5. `frontend/components/facility/details/*Detail.vue` - 상세 컴포넌트
6. `frontend/tests/components/facility/details/*Detail.test.ts` - 테스트
