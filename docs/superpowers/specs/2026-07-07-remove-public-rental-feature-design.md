# 공공임대(매입임대·전세임대·모집공고) 기능 완전 제거 — 설계

- 작성일: 2026-07-07
- 대상: ilsangkit (Nuxt 3 frontend + Express 5 backend + Prisma/MySQL)
- 목표: **공공임대(公共임대) 주택 기능** — 매입임대·전세임대 매물 카탈로그(LH) + 마이홈 입주자 모집공고 — 를 코드/DB/CI/색인에서 깔끔하게 제거한다.

## 배경 & 범위 원칙

공공임대(public-rental) 기능은 **청약(subscription) 기능과 완전히 별개**다. 데이터 모델·백엔드 라우트·페이지 트리가 분리돼 있다. 다만 몇 지점(네비 드롭다운, `subscriptionMeta.ts`, `dataSource.ts`, 사이트맵, GitHub Actions)에서 얽혀 있어 **외과적 제거**가 필요하다.

| | 청약 (subscription) — **유지** | 공공임대 (public-rental) — **제거** |
|---|---|---|
| 데이터 출처 | 청약홈/applyhome | LH/SH 마이홈 (매입임대/전세임대/모집공고) |
| 모델 | `Subscription` | `PublicRentalComplex`, `PublicRentalAnnouncement` |
| 라우트 | `/api/subscription` | `/api/public-rental` (+ `/announcements`) |
| 페이지 | `/subscription/*` | `/public-rental/*` |

### 이름 함정 (제거 금지 — 청약 소유)
- `components/subscription/RentalPriceStatsBox.vue`
- `GET /api/subscription/:id/rental-price-stats`
- `backend/__tests__/rentalPriceStats.test.ts`
- `frontend/tests/components/subscription/RentalPriceStatsBox.test.ts`

> 위 4개는 이름에 `Rental`이 들어가지만 **청약 임대주택 시세** 기능이다. 절대 제거하지 않는다.

## 결정 사항 (사용자 승인)

1. **URL 처리 = 410 Gone.** 기능을 영구 종료하므로 301이 아닌 410으로 색인 제거를 신호한다. 상세→허브 301은 soft-404 위험(이 사이트 기존 교훈)이라 회피한다.
2. **DB = 모델+테이블 모두 제거.** `schema.prisma`에서 두 모델 삭제 → `db push` 시 테이블 DROP. 데이터 영구 삭제(복구 불가) 수용.
3. **GitHub Actions에 등록된 동기화도 제거.**
4. **PR → develop 워크플로우 준수.** main 직접 커밋 금지, CI 통과 후 머지.

## 제거 대상 상세

### A. 백엔드

**모델 (`backend/prisma/schema.prisma`)**
- `PublicRentalComplex` (+ `@@index` 블록)
- `PublicRentalAnnouncement` (+ `@@index` 블록)
- 두 모델은 `Subscription`과 관계(relation)가 없어 독립 삭제 가능.

**라우트 / 서비스 / 스키마**
- `backend/src/routes/publicRental.ts`
- `backend/src/routes/publicRentalAnnouncement.ts`
- `backend/src/services/publicRentalService.ts`
- `backend/src/services/publicRentalAnnouncementService.ts` (`computeStatus`, `todayInKst`를 `publicRentalService.ts`가 import — 둘 다 함께 제거되므로 문제 없음)
- `backend/src/schemas/publicRental.ts`
- `backend/src/schemas/publicRentalAnnouncement.ts`

**스크립트**
- `backend/src/scripts/syncPublicRent.ts`
- `backend/src/scripts/syncRentalAnnouncement.ts`
- `backend/src/scripts/geocodePublicRent.ts`

**앱 마운트 (`backend/src/app.ts`)**
- `import publicRentalRouter ...` (line ~19) 제거
- `app.use('/api/public-rental', publicRentalRouter)` (line ~84) 제거

**`backend/src/scripts/syncAll.ts`**
- line 71 주석 (`// public-rental은 API 쿼터 제한으로 별도 수동 실행: ...`) 제거

### B. 프론트엔드

**페이지 (`frontend/pages/public-rental/` 전체 트리)**
- `index.vue` (허브)
- `[type]/index.vue` (매입임대/전세임대 목록: buy-lease/charter)
- `[type]/[id].vue` (매물 상세)
- `announcements/index.vue` (모집공고 목록)
- `announcements/[pblancId].vue` (모집공고 상세)
- 각 디렉터리의 `AGENTS.md` 포함, 디렉터리 전체 삭제

**컴포넌트**
- `frontend/components/publicRental/` 전체 (`PublicRentalFilterTabs.vue`, `AGENTS.md`)
- `frontend/components/subscription/` 아래 public-rental 전용 12개 (소비처가 public-rental 트리뿐인 것 확인됨):
  - `PublicRentalListView.vue`, `PublicRentalCard.vue`, `PublicRentalDetailView.vue`, `PublicRentalDetailHeader.vue`, `PublicRentalApplyGuide.vue`, `PublicRentalEligibility.vue`, `PublicRentalFAQ.vue`, `PublicRentalNearbyComplexes.vue`, `PublicRentalPriceCard.vue`, `PublicRentalRentalTypeGuide.vue`, `PublicRentalSiblings.vue`, `PublicRentalSpecGrid.vue`
- ⚠️ `components/subscription/RentalPriceStatsBox.vue`는 **유지**

**composable / types / utils**
- `frontend/composables/usePublicRental.ts`
- `frontend/composables/useRentalAnnouncements.ts`
- `frontend/types/publicRental.ts`
- `frontend/types/publicRentalAnnouncement.ts`
- `frontend/utils/publicRentalContent.ts`
- `frontend/utils/publicRentalMeta.ts`

### C. URL 처리 (410 Gone)

- **신규**: `frontend/server/middleware/public-rental-gone.ts` (파일명은 구현 시 확정) — 요청 경로가 `/public-rental` 또는 `/lh-rental` prefix면 `410` 상태로 응답. `event.node.res.statusCode = 410` 후 종료. SSR 404 페이지 렌더 대신 순수 410 신호 목적.
- **제거**: `frontend/server/middleware/lh-rental-redirect.ts` (레거시 `/lh-rental/*` 및 `/subscription/rent/{buy-lease,charter}` → `/public-rental/*` 301). 리다이렉트 체인을 남기지 않는다.
  - 주의: 이 미들웨어가 처리하던 `/subscription/rent/{buy-lease,charter}` 경로도 이제 410 대상 prefix에 포함되지 않는다. 해당 옛 경로 유입은 Nuxt 기본 404로 떨어진다 (공공임대 종료와 함께 자연 소멸). 필요 시 410 미들웨어 prefix에 추가 검토.

### D. 사이트맵

- `frontend/server/routes/sitemap/static.xml.ts` (line ~115–118) — `/public-rental`, `/public-rental/announcements`, `/public-rental/buy-lease`, `/public-rental/charter` 4개 URL push 제거.

### E. GitHub Actions (`.github/workflows/sync-real-estate.yml`)

- 좀비 kill `case` 목록에서 제거:
  - line 56: `*dist/scripts/syncPublicRent*|\`
  - line 59: `*dist/scripts/syncRentalAnnouncement*|\`
- 동기화 step 블록 제거:
  - line 138–143: `# LH 공공임대 동기화` (`[step:public-rent-*]`)
  - line 145–151: `# 마이홈 공공임대 모집공고 동기화` (`[step:rental-announcement-*]`)

### F. 얽힌 지점 외과적 수정 (파일 자체는 유지)

1. **`frontend/types/facility.ts`** (`NAV_LINK_GROUPS`, `청약·임대` 드롭다운, line ~566–569) — `section: '공공임대 입주'`의 모집공고·매입임대·전세임대 링크 3개 삭제. 청약 링크(557–565)는 유지.
2. **`frontend/utils/subscriptionMeta.ts`** — `LhRentalTypeKey`(line 18), `LhRentalTypeMeta`(20–26), `LH_RENTAL_TYPES`(83–98), `rentalTypeCode?` 필드(line 15) 삭제. `RENT_TYPES`, `SALE_TYPES` 등 나머지는 유지. (이 심볼들의 소비처는 public-rental 페이지 + `publicRentalMeta.ts`뿐)
3. **`frontend/utils/dataSource.ts`** — `PUBLIC_RENTAL_DATA_SOURCE`(155), `DataSourceDomain` union의 `'public-rental'`(168), `case 'public-rental'`(193–194) 삭제.
4. **`frontend/components/common/AppFooter.vue`** (line ~22) — `<HardLink to="/public-rental">공공임대</HardLink>` 삭제.
5. **`frontend/components/common/MobileDetailHeader.vue`** (line 2) — 공공임대 언급 주석 정리 (cosmetic).
6. **`frontend/pages/subscription/index.vue`** (line ~17, 147) — `/public-rental` 교차링크/문구 제거.
7. **`frontend/pages/subscription/rent/index.vue`** (line ~6) — `/public-rental` 링크 제거.
8. **`frontend/pages/subscription/rent/[type].vue`** (line ~34–37) — `<PublicRentalListView v-else-if="dataSource === 'lh-myhome'">` 브랜치 + import 제거. (현재 `RENT_TYPES`에 `dataSource: 'lh-myhome'` 항목이 없어 **죽은 코드**임)

### G. 테스트

**삭제 (public-rental 전용)**
- 백엔드:
  - `backend/__tests__/scripts/syncRentalAnnouncement.test.ts`
  - `backend/__tests__/services/publicRentalAnnouncementService.test.ts`
  - `backend/__tests__/services/publicRentalService.test.ts`
- 프론트:
  - `frontend/tests/components/subscription/PublicRentalCard.test.ts`
  - `frontend/tests/components/subscription/PublicRentalDetailView.test.ts`
  - `frontend/tests/components/subscription/PublicRentalListView.test.ts`
  - `frontend/tests/composables/usePublicRental.test.ts`
  - `frontend/tests/e2e/lh-rental.spec.ts`
  - `frontend/tests/pages/announcements/announcementDetail.test.ts`
  - `frontend/tests/pages/announcements/announcementList.test.ts`
  - `frontend/tests/pages/lhRentalHub.test.ts`
  - `frontend/tests/pages/lhRentalType.test.ts`
  - `frontend/tests/server/lh-rental-redirect.test.ts`
  - `frontend/tests/utils/publicRentalMeta.test.ts`

**편집 (혼합 — public-rental 어서션/케이스만 제거)**
- `frontend/tests/types/navGroups.test.ts`
- `frontend/tests/server/sitemap.test.ts`
- `frontend/tests/components/AppFooter.test.ts`
- `frontend/tests/utils/dataSource.test.ts`
- `frontend/tests/utils/subscriptionMeta.test.ts`
- `frontend/tests/components/common/MobileDetailHeader.test.ts`
- `frontend/tests/components/subscription/HomeSubscriptionSection.test.ts` (public-rental 관련 어서션 존재 시)
- `frontend/tests/components/subscription/SubscriptionScheduleTimeline.test.ts` (동일)
- `frontend/tests/pages/subscription/subscriptionDetail.test.ts`
- `frontend/tests/pages/subscriptionRentType.test.ts`
- `frontend/tests/pages/subscriptionRentHub.test.ts`

**유지 (청약 소유)**
- `backend/__tests__/rentalPriceStats.test.ts`
- `frontend/tests/components/subscription/RentalPriceStatsBox.test.ts`

### H. 문서

- `docs/superpowers/plans/2026-06-15-detail-ordering-07-public-rental.md` — 삭제 (또는 히스토리 보존 시 유지 결정). 기본은 삭제.

## 검증 계획

1. **grep 잔여 확인**: 작업 후 `grep -rniE "public.?rental|publicRental|lhRental|useRentalAnnouncement|매입임대|전세임대|모집공고"` 결과가 청약-소유 항목(`RentalPriceStats`)과 이 스펙/plan 문서만 남아야 한다.
2. **타입/빌드**: `cd backend && npm run build`, `cd frontend && npm run build` 성공.
3. **린트**: `npm run lint` (backend/frontend) 클린.
4. **테스트**: `npm run test` (vitest run) 백엔드/프론트 그린. 기존 pass 수 대비 삭제분만 감소, 실패 0.
5. **Prisma**: `npm run db:generate` 성공 (모델 삭제 반영), 로컬 `db push` 시 두 테이블 DROP 확인.

## 배포 & 롤아웃

1. feature 브랜치 → **PR to develop**. CI(lint+test+build) 통과 후 머지.
2. develop → main 승격 PR (기존 승격 워크플로우).
3. Cafe24 배포 시 `prisma db push`로 프로덕션 테이블 DROP.
4. 배포 후 라이브 검증:
   - `curl -I https://ilsangkit.co.kr/public-rental` → `410`
   - `curl -I https://ilsangkit.co.kr/public-rental/announcements` → `410`
   - `curl -I https://ilsangkit.co.kr/lh-rental/...` → `410`
   - (nginx 캐시 스큐 주의 — 필요 시 cache-bust 쿼리로 재확인)
5. 청약 기능 회귀 없음 확인: `/subscription`, `/subscription/rent`, `/subscription/[id]` 정상 + `RentalPriceStatsBox` 렌더 유지.

## 리스크 & 완화

- **`db push`가 예상 밖 테이블을 drop할 위험**: 배포 전 로컬에서 `prisma migrate diff` 또는 `db push --preview-feature`로 DROP 대상이 두 테이블뿐인지 확인.
- **shared 파일 과잉 삭제**: `subscriptionMeta.ts`, `dataSource.ts`는 심볼 단위로만 제거하고 청약 심볼은 반드시 유지. 삭제 후 타입 컴파일로 소비처 누락 검증.
- **410 미들웨어가 청약 경로를 삼킬 위험**: prefix 매칭을 `/public-rental`, `/lh-rental`로 엄격히 한정. `/subscription/*`는 절대 매칭 금지.
- **사이트맵 count-drop 가드**: 정적 사이트맵에서 public-rental URL 4개 제거는 소량이라 가드(threshold 0.2) 미저촉 예상. 발효 안 되면 `Regen Sitemaps` workflow_dispatch 참고.
