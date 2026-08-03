# 공공임대(매입임대·전세임대·모집공고) 기능 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 공공임대(公共임대) 주택 기능 — LH 매입임대·전세임대 매물 카탈로그 + 마이홈 입주자 모집공고 — 를 코드/DB/CI/색인에서 완전히 제거한다.

**Architecture:** 공공임대는 청약(subscription)과 별개 기능이다. 백엔드 모델/라우트/서비스/스크립트와 프론트 페이지/컴포넌트를 통째로 삭제하고, 공유 파일(네비·subscriptionMeta·dataSource·사이트맵·GitHub Actions)은 심볼 단위로 외과적 수정한다. 잔존 색인은 기존 `gone.ts` 미들웨어를 확장해 410 Gone으로 정리한다.

**Tech Stack:** Nuxt 3 (SSR) + Vue 3, Express 5 + TypeScript(ESM), Prisma/MySQL 8, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-07-07-remove-public-rental-feature-design.md`

## Global Constraints

- Node 20 필수 — 작업 전 `nvm use 20`. lock 파일 삭제/재생성 금지 (`npm install`만).
- ESM backend — 모든 로컬 import에 `.js` 확장자.
- PR → develop 워크플로우. main 직접 커밋 금지. CI(lint+test+build) 통과 후 머지.
- **제거 금지 (청약 소유, 이름만 유사):** `components/subscription/RentalPriceStatsBox.vue`, `GET /api/subscription/:id/rental-price-stats`, `backend/__tests__/rentalPriceStats.test.ts`, `frontend/tests/components/subscription/RentalPriceStatsBox.test.ts`.
- 커밋은 각 Task 끝에서 1회 이상. 커밋 메시지 한국어 컨벤션 유지.
- 각 Task 종료 시 해당 워크스페이스(backend 또는 frontend) 빌드·테스트가 그린이어야 한다.

---

## File Structure

**삭제 (공공임대 전용)**
- Backend: `routes/publicRental.ts`, `routes/publicRentalAnnouncement.ts`, `services/publicRentalService.ts`, `services/publicRentalAnnouncementService.ts`, `schemas/publicRental.ts`, `schemas/publicRentalAnnouncement.ts`, `scripts/syncPublicRent.ts`, `scripts/syncRentalAnnouncement.ts`, `scripts/geocodePublicRent.ts`
- Frontend pages: `pages/public-rental/` 트리 전체
- Frontend components: `components/publicRental/` 전체 + `components/subscription/PublicRental*.vue` 12개
- Frontend composables/types/utils: `composables/usePublicRental.ts`, `composables/useRentalAnnouncements.ts`, `types/publicRental.ts`, `types/publicRentalAnnouncement.ts`, `utils/publicRentalContent.ts`, `utils/publicRentalMeta.ts`
- Frontend middleware: `server/middleware/lh-rental-redirect.ts`

**외과적 수정 (공유 파일 — 유지)**
- Backend: `prisma/schema.prisma`, `app.ts`, `scripts/syncAll.ts`
- Frontend: `server/middleware/gone.ts`, `types/facility.ts`, `utils/subscriptionMeta.ts`, `utils/dataSource.ts`, `components/common/AppFooter.vue`, `server/routes/sitemap/static.xml.ts`, `pages/subscription/index.vue`, `pages/subscription/rent/index.vue`, `pages/subscription/rent/[type].vue`
- CI: `.github/workflows/sync-real-estate.yml`

---

## Task 1: 410 Gone 미들웨어 확장 + 레거시 리다이렉트 제거

**Files:**
- Modify: `frontend/server/middleware/gone.ts`
- Delete: `frontend/server/middleware/lh-rental-redirect.ts`
- Delete: `frontend/tests/server/lh-rental-redirect.test.ts`
- Create: `frontend/tests/server/gone.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `/public-rental*`, `/lh-rental*` 경로에 대해 HTTP 410 응답. `/subscription/*`는 절대 매칭하지 않음.

배경: `gone.ts`는 이미 `/kiosk` 제거에 사용 중인 410 미들웨어다. prefix/suffix 목록에 public-rental·lh-rental을 추가한다. 기존 `lh-rental-redirect.ts`(301 리다이렉트)는 제거한다 — 리다이렉트 체인을 남기지 않는다. 테스트는 이 저장소 컨벤션(h3 런타임 회피, 순수 매칭 로직 미러)을 따른다.

- [ ] **Step 1: gone.test.ts 작성 (실패하는 테스트)**

`frontend/tests/server/gone.test.ts` 생성:

```typescript
import { describe, it, expect } from 'vitest'

// middleware/gone.ts 와 동일한 매칭 로직 — h3 런타임 의존 회피
const GONE_PREFIXES = ['/kiosk/', '/public-rental/', '/lh-rental/']
const GONE_SUFFIXES = ['/kiosk', '/public-rental', '/lh-rental']

function isGone(path: string): boolean {
  return (
    GONE_PREFIXES.some((p) => path.startsWith(p)) ||
    GONE_SUFFIXES.some((s) => path.endsWith(s))
  )
}

describe('gone middleware — public-rental 410', () => {
  it('공공임대 허브/목록/상세를 410 처리한다', () => {
    expect(isGone('/public-rental')).toBe(true)
    expect(isGone('/public-rental/buy-lease')).toBe(true)
    expect(isGone('/public-rental/charter')).toBe(true)
    expect(isGone('/public-rental/announcements')).toBe(true)
    expect(isGone('/public-rental/announcements/2024010012345')).toBe(true)
  })

  it('레거시 /lh-rental 경로를 410 처리한다', () => {
    expect(isGone('/lh-rental')).toBe(true)
    expect(isGone('/lh-rental/buy-lease')).toBe(true)
  })

  it('청약 경로는 절대 410 처리하지 않는다', () => {
    expect(isGone('/subscription')).toBe(false)
    expect(isGone('/subscription/rent')).toBe(false)
    expect(isGone('/subscription/rent/public')).toBe(false)
    expect(isGone('/subscription/12345')).toBe(false)
  })

  it('기존 kiosk 제거 동작을 유지한다', () => {
    expect(isGone('/kiosk')).toBe(true)
    expect(isGone('/kiosk/seoul')).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/server/gone.test.ts`
Expected: FAIL — `gone.test.ts`의 로컬 미러는 통과하지만, 이 단계 목적은 다음 스텝에서 `gone.ts` 실제 코드를 이 미러와 일치시키는 것. (미러가 이미 통과하면 Step 3에서 소스 동기화가 핵심)

- [ ] **Step 3: gone.ts에 public-rental/lh-rental 추가**

`frontend/server/middleware/gone.ts` 수정:

```typescript
import { defineEventHandler, setResponseStatus, getRequestURL } from 'h3'

// 제거된 카테고리 — 410 Gone으로 Google de-index 유도
const GONE_PREFIXES = ['/kiosk/', '/public-rental/', '/lh-rental/']
const GONE_SUFFIXES = ['/kiosk', '/public-rental', '/lh-rental']

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (
    GONE_PREFIXES.some((p) => path.startsWith(p)) ||
    GONE_SUFFIXES.some((s) => path.endsWith(s))
  ) {
    setResponseStatus(event, 410)
    return 'Gone'
  }
})
```

- [ ] **Step 4: 레거시 리다이렉트 미들웨어와 테스트 삭제**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
rm frontend/server/middleware/lh-rental-redirect.ts
rm frontend/tests/server/lh-rental-redirect.test.ts
```

- [ ] **Step 5: 테스트 실행 (그린 확인)**

Run: `cd frontend && npx vitest run tests/server/gone.test.ts`
Expected: PASS (4 tests). lh-rental-redirect.test.ts는 삭제되어 수집되지 않음.

- [ ] **Step 6: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/server/middleware/gone.ts frontend/tests/server/gone.test.ts
git add -u frontend/server/middleware/lh-rental-redirect.ts frontend/tests/server/lh-rental-redirect.test.ts
git commit -m "feat(frontend): 공공임대 URL 410 Gone 처리 + 레거시 lh-rental 리다이렉트 제거"
```

---

## Task 2: 백엔드 공공임대 제거 (모델·라우트·서비스·스키마·스크립트)

**Files:**
- Modify: `backend/prisma/schema.prisma` (모델 `PublicRentalComplex`, `PublicRentalAnnouncement` + `@@index` 삭제)
- Modify: `backend/src/app.ts:19,84`
- Modify: `backend/src/scripts/syncAll.ts:71`
- Delete: `backend/src/routes/publicRental.ts`, `backend/src/routes/publicRentalAnnouncement.ts`
- Delete: `backend/src/services/publicRentalService.ts`, `backend/src/services/publicRentalAnnouncementService.ts`
- Delete: `backend/src/schemas/publicRental.ts`, `backend/src/schemas/publicRentalAnnouncement.ts`
- Delete: `backend/src/scripts/syncPublicRent.ts`, `backend/src/scripts/syncRentalAnnouncement.ts`, `backend/src/scripts/geocodePublicRent.ts`
- Delete: `backend/__tests__/scripts/syncRentalAnnouncement.test.ts`, `backend/__tests__/services/publicRentalAnnouncementService.test.ts`, `backend/__tests__/services/publicRentalService.test.ts`

**Interfaces:**
- Consumes: 없음 (두 모델은 `Subscription`과 relation 없음 — 독립 삭제 가능)
- Produces: `/api/public-rental` 라우트 소멸. `PublicRentalComplex`/`PublicRentalAnnouncement` 테이블은 `db push` 시 DROP.

- [ ] **Step 1: 공공임대 라우트/서비스/스키마/스크립트/테스트 파일 삭제**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
rm src/routes/publicRental.ts src/routes/publicRentalAnnouncement.ts
rm src/services/publicRentalService.ts src/services/publicRentalAnnouncementService.ts
rm src/schemas/publicRental.ts src/schemas/publicRentalAnnouncement.ts
rm src/scripts/syncPublicRent.ts src/scripts/syncRentalAnnouncement.ts src/scripts/geocodePublicRent.ts
rm __tests__/scripts/syncRentalAnnouncement.test.ts
rm __tests__/services/publicRentalAnnouncementService.test.ts
rm __tests__/services/publicRentalService.test.ts
```

- [ ] **Step 2: app.ts에서 라우터 import + 마운트 제거**

`backend/src/app.ts` line 19 삭제:
```typescript
import publicRentalRouter from './routes/publicRental.js';
```
`backend/src/app.ts` line 84 삭제:
```typescript
app.use('/api/public-rental', publicRentalRouter);
```

- [ ] **Step 3: syncAll.ts 주석 제거**

`backend/src/scripts/syncAll.ts` line 71 삭제:
```typescript
// public-rental은 API 쿼터 제한으로 별도 수동 실행: npx tsx src/scripts/syncPublicRent.ts
```

- [ ] **Step 4: Prisma 스키마에서 두 모델 삭제**

`backend/prisma/schema.prisma`에서 `model PublicRentalComplex { ... }` 블록(+ 내부 `@@index`)과 `model PublicRentalAnnouncement { ... }` 블록(+ 내부 `@@index`)을 통째로 삭제. 두 모델은 다른 모델에서 참조되지 않으므로 관계 정리 불필요.

- [ ] **Step 5: Prisma Client 재생성 (컴파일 검증)**

Run: `cd backend && npm run db:generate`
Expected: 성공. `PublicRental*` 타입이 Client에서 사라짐. 이 재생성이 실패하면 스키마 문법 오류를 먼저 수정.

- [ ] **Step 6: 타입체크/빌드로 잔여 참조 검증**

Run: `cd backend && npm run build`
Expected: 성공. 만약 `PublicRental*` 심볼 미해결 에러가 나면, 삭제되지 않은 참조가 남은 것 — 해당 파일을 찾아 제거.

- [ ] **Step 7: 백엔드 전체 테스트 실행**

Run: `cd backend && npm run test`
Expected: PASS. 삭제한 3개 테스트 파일만큼 감소, 실패 0. `rentalPriceStats.test.ts`는 **유지·통과**해야 함(청약 시세).

- [ ] **Step 8: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add -A backend/
git commit -m "feat(backend): 공공임대(PublicRentalComplex·Announcement) 모델·라우트·서비스·스크립트 제거"
```

---

## Task 3: GitHub Actions 동기화 제거

**Files:**
- Modify: `.github/workflows/sync-real-estate.yml`

**Interfaces:**
- Consumes: 없음
- Produces: daily sync에서 공공임대·모집공고 동기화 스텝 소멸. 좀비 kill 목록에서 관련 스크립트 제거.

- [ ] **Step 1: 좀비 kill case 목록에서 2줄 제거**

`.github/workflows/sync-real-estate.yml`에서 다음 두 줄 삭제 (case 패턴 목록 내):
```
                  *dist/scripts/syncPublicRent*|\
                  *dist/scripts/syncRentalAnnouncement*|\
```
(주의: 인접한 `syncAuction`, `geocodeAuction`, `generateSitemaps` 패턴은 유지. 목록의 마지막 항목이 `generateSitemaps*)`로 끝나는 구조를 깨지 않도록 두 줄만 제거.)

- [ ] **Step 2: LH 임대 동기화 스텝 블록 제거**

다음 블록 전체 삭제 (기존 line ~138–143):
```bash
            # LH 공공임대 동기화
            echo "[step:public-rent-start]"
            echo "--- LH 임대 동기화 ---"
            timeout --kill-after=30s 30m node dist/scripts/syncPublicRent.js \
              || echo "[WARN] LH 임대 동기화 실패 (exit=$?)"
            echo "[step:public-rent-end]"
```

- [ ] **Step 3: 모집공고 동기화 스텝 블록 제거**

다음 블록 전체 삭제 (기존 line ~145–151):
```bash
            # 마이홈 공공임대 모집공고 동기화 (HWSPR02: 일반+장기 통합)
            # API 가 활성 공고만 반환하는 구조 — 매일 누적되어야 마감 공고가 archive 됨.
            echo "[step:rental-announcement-start]"
            echo "--- 공공임대 모집공고 동기화 ---"
            timeout --kill-after=30s 15m node dist/scripts/syncRentalAnnouncement.js \
              || echo "[WARN] 모집공고 동기화 실패 (exit=$?)"
            echo "[step:rental-announcement-end]"
```

- [ ] **Step 4: 잔여 참조 확인**

Run: `grep -nE "syncPublicRent|syncRentalAnnouncement|public-rent|공공임대|모집공고" .github/workflows/sync-real-estate.yml`
Expected: 출력 없음 (모두 제거됨).

- [ ] **Step 5: YAML 구조 sanity 체크**

Run: `cd /Users/leemyeongseok/projects/ilsangkit && node -e "const y=require('fs').readFileSync('.github/workflows/sync-real-estate.yml','utf8'); if(/syncPublicRent|syncRentalAnnouncement/.test(y)) process.exit(1); console.log('clean')"`
Expected: `clean`. (좀비 kill `case`의 `esac` 종결과 `for` 루프 구조가 온전한지 육안 확인.)

- [ ] **Step 6: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add .github/workflows/sync-real-estate.yml
git commit -m "ci: daily sync에서 공공임대·모집공고 동기화 스텝 제거"
```

---

## Task 4: 프론트 공공임대 전용 파일 삭제 + 죽은 브랜치 정리

**Files:**
- Delete: `frontend/pages/public-rental/` (트리 전체, AGENTS.md 포함)
- Delete: `frontend/components/publicRental/` (전체)
- Delete: `frontend/components/subscription/PublicRental*.vue` (12개 — RentalPriceStatsBox.vue 제외)
- Delete: `frontend/composables/usePublicRental.ts`, `frontend/composables/useRentalAnnouncements.ts`
- Delete: `frontend/types/publicRental.ts`, `frontend/types/publicRentalAnnouncement.ts`
- Delete: `frontend/utils/publicRentalContent.ts`, `frontend/utils/publicRentalMeta.ts`
- Modify: `frontend/pages/subscription/rent/[type].vue:34-37`
- Delete (tests): `frontend/tests/components/subscription/PublicRentalCard.test.ts`, `frontend/tests/components/subscription/PublicRentalDetailView.test.ts`, `frontend/tests/components/subscription/PublicRentalListView.test.ts`, `frontend/tests/composables/usePublicRental.test.ts`, `frontend/tests/e2e/lh-rental.spec.ts`, `frontend/tests/pages/announcements/announcementDetail.test.ts`, `frontend/tests/pages/announcements/announcementList.test.ts`, `frontend/tests/pages/lhRentalHub.test.ts`, `frontend/tests/pages/lhRentalType.test.ts`, `frontend/tests/utils/publicRentalMeta.test.ts`

**Interfaces:**
- Consumes: Task 1의 410 처리 (삭제된 페이지 경로는 410으로 응답)
- Produces: 공공임대 페이지/컴포넌트/로직 소멸. `rent/[type].vue`는 `applyhome` 브랜치만 남음.

배경: `rent/[type].vue`의 `<PublicRentalListView v-else-if="dataSource === 'lh-myhome'">` 브랜치는 죽은 코드다 (`RENT_TYPES`에 `dataSource: 'lh-myhome'` 항목 없음). 컴포넌트 삭제 시 자동 import 해소 실패로 빌드가 깨지므로 **같은 Task에서** 제거한다.

- [ ] **Step 1: 공공임대 전용 파일/디렉터리 삭제**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
rm -rf pages/public-rental
rm -rf components/publicRental
rm components/subscription/PublicRentalListView.vue \
   components/subscription/PublicRentalCard.vue \
   components/subscription/PublicRentalDetailView.vue \
   components/subscription/PublicRentalDetailHeader.vue \
   components/subscription/PublicRentalApplyGuide.vue \
   components/subscription/PublicRentalEligibility.vue \
   components/subscription/PublicRentalFAQ.vue \
   components/subscription/PublicRentalNearbyComplexes.vue \
   components/subscription/PublicRentalPriceCard.vue \
   components/subscription/PublicRentalRentalTypeGuide.vue \
   components/subscription/PublicRentalSiblings.vue \
   components/subscription/PublicRentalSpecGrid.vue
rm composables/usePublicRental.ts composables/useRentalAnnouncements.ts
rm types/publicRental.ts types/publicRentalAnnouncement.ts
rm utils/publicRentalContent.ts utils/publicRentalMeta.ts
```

- [ ] **Step 2: 공공임대 전용 테스트 삭제**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
rm tests/components/subscription/PublicRentalCard.test.ts \
   tests/components/subscription/PublicRentalDetailView.test.ts \
   tests/components/subscription/PublicRentalListView.test.ts \
   tests/composables/usePublicRental.test.ts \
   tests/e2e/lh-rental.spec.ts \
   tests/pages/announcements/announcementDetail.test.ts \
   tests/pages/announcements/announcementList.test.ts \
   tests/pages/lhRentalHub.test.ts \
   tests/pages/lhRentalType.test.ts \
   tests/utils/publicRentalMeta.test.ts
```
(참고: `tests/pages/announcements/` 디렉터리가 비면 함께 제거.)

**중요 — RentalPriceStatsBox 계열은 삭제하지 않는다:** `components/subscription/RentalPriceStatsBox.vue`, `tests/components/subscription/RentalPriceStatsBox.test.ts`는 청약 시세 기능이므로 유지.

- [ ] **Step 3: rent/[type].vue의 lh-myhome 브랜치 제거**

`frontend/pages/subscription/rent/[type].vue`의 template에서 다음 블록 삭제 (line 34–37):
```vue
      <PublicRentalListView
        v-else-if="dataSource === 'lh-myhome'"
        :rental-type-code="typeMeta.rentalTypeCode"
      />
```
결과적으로 `<SubscriptionListView v-if="dataSource === 'applyhome'">` 만 남는다. `PublicRentalListView`는 자동 import이므로 별도 import 구문 제거는 불필요(script 블록에 명시 import 없음 — line 46–50 확인).

- [ ] **Step 4: 잔여 참조 확인 (kept 파일에서 삭제 심볼 사용 여부)**

Run:
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
grep -rnE "usePublicRental|useRentalAnnouncements|PublicRentalListView|PublicRentalCard|publicRentalMeta|publicRentalContent|types/publicRental" --include="*.vue" --include="*.ts" pages components composables utils
```
Expected: 출력 없음. 출력이 있으면 해당 kept 파일에서 참조를 제거(대부분 Task 5에서 다룸 — 겹치면 여기서 처리).

- [ ] **Step 5: 프론트 빌드 검증**

Run: `cd frontend && npm run build`
Expected: 성공. 자동 import 해소 실패(`PublicRentalListView` 등) 에러가 없어야 함.

- [ ] **Step 6: 프론트 테스트 실행**

Run: `cd frontend && npm run test`
Expected: PASS. 이 단계에서 공유 파일(nav/sitemap/dataSource 등)을 아직 안 건드렸으므로, 그와 관련된 mixed 테스트(navGroups, sitemap, dataSource 등)는 **아직 통과** 상태여야 정상. (그것들은 Task 5에서 편집)

- [ ] **Step 7: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add -A frontend/
git commit -m "feat(frontend): 공공임대 페이지·컴포넌트·composable·타입·유틸 제거"
```

---

## Task 5: 공유 파일 외과적 수정 + 혼합 테스트 정리

**Files:**
- Modify: `frontend/types/facility.ts:566-569`
- Modify: `frontend/utils/subscriptionMeta.ts:15,18,20-26,83-98`
- Modify: `frontend/utils/dataSource.ts:155,168,193-194`
- Modify: `frontend/components/common/AppFooter.vue:22`
- Modify: `frontend/server/routes/sitemap/static.xml.ts:115-118`
- Modify: `frontend/pages/subscription/index.vue:17`
- Modify: `frontend/pages/subscription/rent/index.vue:6`
- Modify (tests): `frontend/tests/types/navGroups.test.ts`, `frontend/tests/server/sitemap.test.ts`, `frontend/tests/server/sitemapStatic.test.ts`, `frontend/tests/components/AppFooter.test.ts`, `frontend/tests/utils/dataSource.test.ts`, `frontend/tests/utils/subscriptionMeta.test.ts`, `frontend/tests/components/common/MobileDetailHeader.test.ts`, `frontend/tests/components/subscription/HomeSubscriptionSection.test.ts`, `frontend/tests/components/subscription/SubscriptionScheduleTimeline.test.ts`, `frontend/tests/pages/subscription/subscriptionDetail.test.ts`, `frontend/tests/pages/subscriptionRentType.test.ts`, `frontend/tests/pages/subscriptionRentHub.test.ts`

**Interfaces:**
- Consumes: Task 4 (공공임대 컴포넌트/유틸 삭제 완료)
- Produces: 네비·푸터·사이트맵·데이터소스에서 공공임대 완전 소멸. 청약 심볼(`RENT_TYPES`, `SALE_TYPES` 등)은 유지.

- [ ] **Step 1: 네비 드롭다운 공공임대 링크 3개 삭제**

`frontend/types/facility.ts` line 566–569 삭제:
```typescript
      // 공공임대 입주 — 자격 기반 수시 신청 (LH/SH 등)
      { to: '/public-rental/announcements', label: '모집공고', icon: 'campaign', iconImg: 'subscription', section: '공공임대 입주' },
      { to: '/public-rental/buy-lease', label: '매입임대', icon: 'shopping_cart', iconImg: 'store', section: '공공임대 입주' },
      { to: '/public-rental/charter', label: '전세임대', icon: 'savings', iconImg: 'land', section: '공공임대 입주' },
```
(line 564의 `공공임대 청약`(`/subscription/rent/public`)은 청약이므로 **유지**.)

- [ ] **Step 2: subscriptionMeta.ts에서 LH 관련 심볼 삭제**

`frontend/utils/subscriptionMeta.ts` 에서:
- interface 필드 `rentalTypeCode?: string` (line 15) 삭제
- `export type LhRentalTypeKey = 'buy-lease' | 'charter'` (line 18) 삭제
- `export interface LhRentalTypeMeta { ... }` 블록 (line 20–26) 삭제
- `export const LH_RENTAL_TYPES: Record<LhRentalTypeKey, LhRentalTypeMeta> = { ... }` 블록 (line 83–98) 삭제

`RENT_TYPES`, `SALE_TYPES`, `RentDataSource` 등 나머지는 유지.

- [ ] **Step 3: dataSource.ts에서 public-rental 도메인 삭제**

`frontend/utils/dataSource.ts` 에서:
- `export const PUBLIC_RENTAL_DATA_SOURCE: DataSourceInfo = { ... }` 블록 (line 155~) 삭제
- `DataSourceDomain` union (line 168)에서 `| 'public-rental'` 제거:
  ```typescript
  export type DataSourceDomain = 'facility' | 'real-estate' | 'subscription' | 'auction'
  ```
- switch의 `case 'public-rental': return PUBLIC_RENTAL_DATA_SOURCE` (line 193–194) 삭제

- [ ] **Step 4: AppFooter 공공임대 링크 삭제**

`frontend/components/common/AppFooter.vue` line 22 삭제:
```vue
            <HardLink to="/public-rental" class="text-sm text-muted hover:text-primary transition-colors">공공임대</HardLink>
```

- [ ] **Step 5: 사이트맵에서 public-rental URL 4개 삭제**

`frontend/server/routes/sitemap/static.xml.ts` line 115–118 삭제:
```typescript
  urls.push({ loc: `${SITE_URL}/public-rental`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.8 })
  urls.push({ loc: `${SITE_URL}/public-rental/announcements`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.8 })
  urls.push({ loc: `${SITE_URL}/public-rental/buy-lease`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.7 })
  urls.push({ loc: `${SITE_URL}/public-rental/charter`, lastmod: subscriptionLastmod, changefreq: 'daily', priority: 0.7 })
```

- [ ] **Step 6: 청약 페이지 교차링크 제거**

`frontend/pages/subscription/index.vue` line 17 — `·공공임대` 링크 제거. 수정 후:
```vue
          <NuxtLink to="/subscription/sale" class="text-primary hover:underline">분양</NuxtLink>·<NuxtLink to="/subscription/rent" class="text-primary hover:underline">임대</NuxtLink> 카테고리로 구분해 모아 보여줍니다.
```
(line 147, 195의 "공공임대(LH·SH)"·FAQ는 일반 개념 설명 — 링크가 아니므로 그대로 두되, line 147이 삭제된 기능을 가리키는 안내면 문장에서 공공임대 언급만 제거. 링크가 없으면 유지 가능. 판단 기준: `/public-rental`로 가는 **링크만** 제거, 개념 설명 문구는 유지.)

`frontend/pages/subscription/rent/index.vue` line 6 — `/public-rental`로 가는 `<NuxtLink>`가 포함된 괄호 안내를 제거. 수정 후:
```vue
        <p class="mt-2 text-slate-500 text-sm">청약통장으로 접수하는 공공임대 청약과 공공지원 민간임대 청약 일정을 안내합니다.</p>
```

- [ ] **Step 7: 혼합 테스트에서 public-rental 어서션 제거**

각 테스트 파일을 열어 public-rental/LH 관련 케이스만 삭제하고 청약 케이스는 유지한다. 먼저 대상 식별:
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
grep -rlnE "public-rental|PublicRental|LH_RENTAL|LhRentalType|공공임대|매입임대|전세임대|모집공고|lh-myhome" tests/
```
각 매칭 파일에서:
- `navGroups.test.ts` — `공공임대 입주` 섹션/링크 어서션 삭제
- `sitemap.test.ts`, `sitemapStatic.test.ts` — public-rental URL 존재 어서션 삭제
- `AppFooter.test.ts` — 공공임대 링크 어서션 삭제
- `dataSource.test.ts` — `public-rental` 도메인/`PUBLIC_RENTAL_DATA_SOURCE` 케이스 삭제
- `subscriptionMeta.test.ts` — `LH_RENTAL_TYPES`/`LhRentalType` 관련 케이스 삭제
- `MobileDetailHeader.test.ts` — public-rental 케이스 삭제
- `HomeSubscriptionSection.test.ts`, `SubscriptionScheduleTimeline.test.ts`, `subscriptionDetail.test.ts`, `subscriptionRentType.test.ts`, `subscriptionRentHub.test.ts` — public-rental 관련 어서션만 삭제, 청약 어서션 유지

(위 목록에 없더라도 grep에 걸린 파일은 모두 점검해 public-rental 어서션을 제거한다.)

- [ ] **Step 8: 프론트 빌드 + 린트 검증**

Run: `cd frontend && npm run build && npm run lint`
Expected: 성공. `PUBLIC_RENTAL_DATA_SOURCE`/`LH_RENTAL_TYPES` 등 미해결 참조 에러 없음.

- [ ] **Step 9: 프론트 전체 테스트 실행**

Run: `cd frontend && npm run test`
Expected: PASS, 실패 0. `RentalPriceStatsBox.test.ts`는 유지·통과.

- [ ] **Step 10: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add -A frontend/
git commit -m "refactor(frontend): 네비·subscriptionMeta·dataSource·사이트맵에서 공공임대 참조 제거 + 혼합 테스트 정리"
```

---

## Task 6: 최종 검증 스윕

**Files:** 없음 (검증 전용)

**Interfaces:**
- Consumes: Task 1–5 전체
- Produces: 잔여 공공임대 참조 0 확인, 전체 그린.

- [ ] **Step 1: 전역 잔여 참조 스윕**

Run:
```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -rniE "public.?rental|publicRental|lhRental|lh-myhome|useRentalAnnouncement|LH_RENTAL|매입임대|전세임대|모집공고" \
  backend/src frontend/pages frontend/components frontend/composables frontend/types frontend/utils frontend/server .github/workflows
```
Expected: 청약-소유(`RentalPriceStats`) 항목 외 출력 없음. `RentalPriceStats`만 남으면 정상. 그 외가 남으면 해당 파일 정리 후 재실행.

- [ ] **Step 2: 스펙/plan 문서 참조는 무시 확인**

Run: `grep -rniE "public.?rental" docs/ 2>/dev/null | head`
Expected: 스펙·plan 문서만 매칭 (docs는 .gitignore라 커밋 무관). 무시.

- [ ] **Step 3: 백엔드 전체 게이트**

Run: `cd backend && npm run lint && npm run build && npm run test`
Expected: 모두 PASS.

- [ ] **Step 4: 프론트 전체 게이트**

Run: `cd frontend && npm run lint && npm run build && npm run test`
Expected: 모두 PASS.

- [ ] **Step 5: Prisma DROP 대상 확인 (로컬 DB 있을 때)**

Run: `cd backend && npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script 2>/dev/null || echo "diff 스킵 (로컬 DB 필요)"`
대안: 로컬 `docker compose up -d` 상태에서 `npm run db:push`를 dry하게 실행해 DROP 대상이 `PublicRentalComplex`, `PublicRentalAnnouncement` **두 테이블뿐**인지 확인. 다른 테이블 DROP이 뜨면 중단하고 원인 파악.

- [ ] **Step 6: PR 생성 (develop 대상)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git push -u origin HEAD
```
GitHub에서 develop 대상 PR 생성. 제목: `공공임대(매입임대·전세임대·모집공고) 기능 완전 제거`. CI(lint+test+build) 통과 확인 후 머지.

- [ ] **Step 7: (배포 후) 라이브 검증 체크리스트 기록**

PR 머지 → main 승격 → Cafe24 배포 후 확인할 항목 (실행은 배포 담당 단계):
```bash
curl -sI "https://ilsangkit.co.kr/public-rental?cb=$(date +%s)" | head -1   # → 410
curl -sI "https://ilsangkit.co.kr/public-rental/announcements?cb=$(date +%s)" | head -1  # → 410
curl -sI "https://ilsangkit.co.kr/lh-rental?cb=$(date +%s)" | head -1       # → 410
curl -sI "https://ilsangkit.co.kr/subscription?cb=$(date +%s)" | head -1    # → 200 (청약 회귀 없음)
```
(nginx 캐시 스큐 주의 — cache-bust 쿼리 필수. 메모리 교훈.)

---

## Self-Review 결과

- **Spec 커버리지:** 스펙 A(백엔드)→Task 2, B(프론트)→Task 4, C(410/리다이렉트)→Task 1, D(사이트맵)→Task 5-Step5, E(Actions)→Task 3, F(얽힘 8곳)→Task 5, G(테스트)→Task 2·4·5, H(문서)→docs gitignore라 커밋 무관(Task 6-Step2 확인). 전 항목 매핑됨.
- **Placeholder:** 없음. 모든 삭제/편집 스텝에 실제 경로·코드·명령 포함.
- **타입 일관성:** `GONE_PREFIXES`/`GONE_SUFFIXES`(Task1), `DataSourceDomain`·`PUBLIC_RENTAL_DATA_SOURCE`·`LH_RENTAL_TYPES`·`LhRentalTypeKey`·`rentalTypeCode`(Task5)가 스펙/실제 코드 라인과 일치. `RentalPriceStats` 유지 규칙 전 Task에 명시.
