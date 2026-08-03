# 색인 품질 위험 복구 설계 (Frontend Audit ③)

- **작성일:** 2026-06-02
- **출처:** `docs/superpowers/specs/2026-06-02-frontend-improvement-audit.md` ③ 색인 품질 위험
- **분할:** 2 PR — **PR1 = announcements 색인 위생**(급함), **PR2 = 나머지 색인 품질**(ⓑ noindex 정확도 · ⓒ canonical 보강 · ⓓ 구조화 데이터 · ⓔ 죽은코드/legacy 정리)
- **순서:** PR1 구현·CI·머지 완료 후 PR2 진행
- **검증:** 단위 테스트(모킹) + `npm run build` + 실서버 curl(robots/canonical/JSON-LD grep)

## 탐색으로 보정된 사실 (audit 대비)

- announcements 실제 경로: `pages/public-rental/announcements/[pblancId].vue` + `index.vue`, composable `composables/useRentalAnnouncements.ts`.
- canonical 누락 실제 대상: `about`·`terms`·`privacy`·`contact`(+`subway/[slug]`)뿐. home·faq·trash는 이미 canonical 있음. "seoHelpers 신규 공통 헬퍼"는 불필요 — 기존 `useFacilityMeta.setMeta()`가 canonical 헬퍼 역할(`{ path }` 전달 시 canonical 설정, `canonical:false`로 제거).
- audit ⑫(canonical 깊이 불일치)는 **비이슈 → 드롭**: `[realEstateType]/index.vue:253`의 2-segment 직조는 허브에 맞는 정상값.
- thin 허브 실제 경로: `pages/real-estate/[realEstateType]/[city]/index.vue` (6타입×17시 ≈102개).
- `useStructuredData.ts` 빌더명: `setFAQSchema(faqs)`(line 597), `setItemListSchema(items, opts?)`, `setBreadcrumbSchema(items)`, `setEventSchema(...)` 등 존재.
- `composables/useRealEstateMeta.ts`는 테스트(`tests/composables/useRealEstateMeta.test.ts`)에서만 import — 프로덕션 죽은 코드. 폐기된 2-segment(:21)·불완전 3-segment(:55) canonical 보유.

## 보존 원칙 (회귀 금지)

- `useApiBase` 루프백(SSR 자기-도메인 색인 회귀 방어).
- `page≥2` noindex + canonical 제거 정책(이미 일관 적용).
- noindex 페이지에서는 canonical 제거(신호 충돌 방지) — 기존 패턴 유지.

---

# PR1 — announcements 색인 위생

**대상:** `pages/public-rental/announcements/[pblancId].vue`, `pages/public-rental/announcements/index.vue`, `composables/useRentalAnnouncements.ts`(필요 시), 관련 테스트.

## P1-1. 없는/만료 공고 → 404 (fatal)
**문제:** 상세 fetch 실패 시 composable이 `error.value` 세팅 + `detail=null` 반환, 페이지는 `v-else-if="error"` 에러 블록을 **HTTP 200으로** 렌더 → 없는/만료 공고가 200으로 색인.
**변경:** `[pblancId].vue`에서 SSR fetch 후 `detail`이 없으면(또는 fetch 에러면) `throw createError({ statusCode: 404, statusMessage: 'Announcement not found', fatal: true })`. composable은 현행 유지(null 반환), 404 판정은 페이지에서. (참고: facility 상세 `[category]/[id].vue`의 createError 404 패턴과 동일.)

## P1-2. 마감(closed) 공고 → noindex,follow
**문제:** 마감 공고에 색인 신호 없음 → 만료 콘텐츠가 indexable.
**변경:** `detail.status === 'closed'`이면 `useHead`에 `meta: [{ name: 'robots', content: 'noindex, follow' }]` 추가하고 canonical 제거(noindex 페이지 canonical 충돌 방지, 기존 정책). 진행/예정 공고는 indexable 유지.

## P1-3. 비반응형 useHead → 함수형
**문제:** 정적 `useHead({...})`로 SSR 시점 fallback 제목이 굳음.
**변경:** `useHead(() => ({ title, meta, link }))` 함수형으로 변경해 `detail`/`status` 변화에 반응. title/description/robots/canonical 모두 함수 내부에서 `detail.value`·`status` 기반으로 계산.

## P1-4. 구조화 데이터
**변경:**
- `announcements/index.vue`: `setItemListSchema(items.map((a,i)=>({ name: a.title, url: \`/public-rental/announcements/${a.pblancId}\`, position: i+1 })))` + `setBreadcrumbSchema([홈, 공공임대, 공고])`.
- `[pblancId].vue`: `setBreadcrumbSchema([홈, 공공임대, 공고, <공고명>])`. (Event 스키마는 공고 성격상 오용 우려 → 제외.)

## PR1 테스트
- `[pblancId].vue`: detail null → `createError(404, fatal)` 호출 단언(detail.test.ts의 createError mock 패턴 차용); `status==='closed'` → robots noindex 포함; 정상 공고 → indexable(robots noindex 없음) + Breadcrumb 스키마 호출.
- `index.vue`: items 있을 때 ItemList 스키마 호출.
- 기존 announcements 테스트 회귀 없음.

## PR1 커밋 분할
1. `fix(frontend): announcements 없는/만료 공고 404 + 마감 noindex + reactive head`
2. `feat(frontend): announcements 목록/상세 ItemList·Breadcrumb 스키마`
3. `test(frontend): announcements 색인 위생 단위 테스트`

---

# PR2 — 나머지 색인 품질

## P2-ⓑ noindex 정확도
- **`pages/[city]/[district]/[category].vue` (:355-376):** noindex 판정을 클라 패칭된 `facilities.value.length`(fetch 전 `[]`) 대신 **SSR 주입 `summary.count`** 기반으로. `summary`는 이미 `useAsyncData`로 SSR 주입됨(`/api/area/:city/:district/:category/summary`, `count` 포함). `isEmpty = summary.count === 0`(+ trash는 해당 summary 분기), `isNoindex = isEmpty || page>1`. 클라 fetch 타이밍 의존 제거.
- **`pages/real-estate/[realEstateType]/[city]/index.vue` thin 허브:** (type, city)별 **템플릿 요약 인트로** 추가 — `realEstateMeta`의 타입 라벨/설명 + 도시명 + 데이터 출처/갱신 안내 + 구 단위 탐색 안내 문단. 기존 구 그리드 유지. 신규 API 불요(가능하면 페이지에 이미 있는 카운트 활용, 없으면 텍스트만으로 thin 해소). noindex 부여하지 않음(색인 유지).

## P2-ⓒ canonical 보강
- `about.vue`·`terms.vue`·`privacy.vue`·`contact.vue`·`subway/[slug].vue`에 canonical 추가. 정적 페이지는 `useFacilityMeta().setMeta({ title, description, path: '/about' 등 })` 호출(기존 home/faq 패턴과 동일)하거나 동등한 `useHead` canonical link. subway/[slug]는 해당 슬러그 경로 canonical.

## P2-ⓓ 구조화 데이터
- `real-estate/index.vue`·`real-estate/[realEstateType]/index.vue`: 가시 `<details>` FAQ 데이터를 `setFAQSchema(faqs)`로 연결(faq.vue와 동일 패턴). FAQ 데이터 소스는 페이지 내 기존 배열 재사용.
- `subway/index.vue`·`guide/index.vue`: 목록에 `setItemListSchema` 추가(Breadcrumb는 이미 있음).

## P2-ⓔ 죽은코드/legacy 정리
- `composables/useRealEstateMeta.ts` + `tests/composables/useRealEstateMeta.test.ts` 삭제(프로덕션 미사용). 삭제 전 grep 재확인.
- `components/realEstate/ComplexCard.vue` (:81-92): legacy 2-segment 폴백(`?tab=&bjdCode=`)은 city/district 없을 때만 발동. 데이터에 city/district가 항상 있으면 폴백을 4-segment로 강제하거나 해당 카드 미렌더. 발동 조건/안전성 확인 후 결정(불확실하면 폴백 유지 + noindex 영향 없음 확인).

## PR2 테스트
- `[district]/[category].vue`: summary.count=0 → noindex; count>0 → indexable(클라 배열 무관).
- real-estate 허브: 인트로 텍스트 렌더 단언.
- canonical: 정적 4페이지 + subway/[slug] canonical link 존재 단언.
- FAQ/ItemList 스키마 호출 단언.
- useRealEstateMeta 삭제 후 전체 테스트 통과(죽은 테스트 제거 포함).

## PR2 커밋 분할 (예시)
1. `fix(frontend): [district]/[category] noindex를 SSR summary.count 기반으로`
2. `feat(frontend): real-estate city 허브 요약 인트로(thin-content 방어)`
3. `fix(frontend): about/terms/privacy/contact/subway canonical 보강`
4. `feat(frontend): real-estate FAQ + subway/guide ItemList 구조화 데이터`
5. `chore(frontend): 죽은 useRealEstateMeta 삭제 + ComplexCard legacy URL 정리`

---

## 비범위 (Out of scope)

- audit ⑫ canonical 깊이(비이슈), audit ②(완료)·④⑤⑥.
- announcements Event 스키마(성격상 오용 우려).
- real-estate 허브용 신규 집계 API(텍스트 인트로로 충분, 필요 시 별도).
