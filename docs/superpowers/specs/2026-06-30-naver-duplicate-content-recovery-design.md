# 네이버 노출 −83% 회복: 중복 콘텐츠 + 잔여 SEO 결함 처방 (Design)

- 작성일: 2026-06-30
- 상태: Draft (사용자 검토 대기)
- 관련 메모리: `project_ssr_noindex_pool_exhaustion`, `project_naver_realestate_index_coverage`, `project_title_intent_single_source`
- 선행 스펙: `2026-06-20-ssr-fail-closed-noindex-fix-design.md` (Part A 배포 완료)

## 1. 배경 / 증상

네이버 서치어드바이저 기준 사이트 노출이 6월에 **−83%** 급락 (피크 6/8 ≈ 1.12M/일 → 말기 ≈ 146K/일, 클릭 −74%).

사용자 제공 데이터로 확인된 핵심 신호:
- **색인제외(noindex)**: 6/18 +5,886 → 6/21경 정체 → 6/28 94,629 (정체/소폭감소)
- **"SEO 문제"(중복 등)**: ~45K(6/17까지 평평) → **6/28 232,523 (+187K, 5.2배), 계속 증가 중**
- **중복 description**: ~21K → **6/28 115,313 (+94K), 거의 wifi**
- **중복 title 샘플**: wifi 921 · trash 679 · real-estate 151 · aed 85 · parking 73 · subscription 50 · clothes 38 (1,999행 중)
- CTR 1.2%→1.9% 상승 = 고노출·저CTR 롱테일이 먼저 이탈

2개 멀티에이전트 조사 워크플로우(각 13 에이전트, 반증 검증 포함)로 코드/배포/라이브 HTML/DB를 교차검증.

## 2. 근본 원인 (검증 완료)

**−83%의 본체는 "만성 중복 콘텐츠", 방아쇠는 "급성 noindex 사고". 둘 다 6/18에 네이버가 한꺼번에 재분류했다.**

| # | 원인 | 상태 | 검증 |
|---|---|---|---|
| 1 | **만성 중복 title/desc** — 시설 상세 title이 `name`에 의존하나 wifi/aed/trash 등은 `name`이 지역·시설군 단위 → 한 구에 수십~수백 페이지가 동일. (실측 중복그룹: wifi 50%·aed 51%·trash 74%·parking 12%. 최악 청주 wifi 547개=`충청북도 청주시`) | 🔴 진행형 | confirmed (코드+라이브+DB GROUP BY) |
| 2 | **급성 noindex 사고** — 부동산/지역 4종이 풀 고갈 시 200+noindex (`getBuildingInfo catch{return null}`) | ✅ 6/20 수정·배포 | confirmed |
| 3 | **6/18 네이버 재분류 패스** — 기존 stale 색인을 품질/중복 평가 → 만성 중복 ~187K를 SEO문제로 덤프 | — | confirmed (timing) |
| 4 | 백엔드 풀 고갈(부동산 일일 sync 과부하 + 6/10 fulltext db-push)이 #2의 트리거 | ⚠️ unknown (Part B 미배포) | confirmed (sync 코드) |

**검증으로 기각된 가설 (중요):**
- ❌ "6월 title 템플릿 churn이 6/18 폭발을 유발" — 플래그 URL의 마지막 크롤이 4~5월(6/18 후 재크롤 없음), 6/3 더 큰 리팩터는 트리거 안 함. → **배포가 부른 게 아니라 네이버 자체 재평가.** (단 churn으로 색인에 3~4개 stale 포맷 공존 = 별개 해악 → 포맷 동결 필요)
- ❌ "부동산 thin near-dup이 주범" — 부동산 상세는 현재 주변 단지·시설 SSR 콘텐츠로 차별화됨(thin 아님). 부동산은 대부분 6/15 지역·6/18 시세 추가로 이미 완화.

**현재 출혈 상태:**
- ✅ noindex 사고: 멈춤 (색인제외 정체로 독립 확증)
- 🔴 **aed · trash: 아직 `index,follow` + byte-identical title (trash는 desc까지) → 활성 출혈**
- 🔴 subscription: 없는 id가 `200 + '청약 일정' + index` → 라이브 soft-404
- 🟡 wifi: 이미 `noindex,follow` (재크롤되며 점차 이탈, 아직 색인 잔존)
- 🟡 real-estate: 완화됨, stale 타이틀 age-out 중

## 3. 빌더 구조 (수정 대상 분리)

중복 title은 단일 빌더가 아니라 **빌더별로 분리**됨:
- `useFacilityMeta.ts:375-391` `buildDetailTitle` — facility(wifi/aed/parking/clothes) = `${name} ${categoryName} ${intent} | ${loc}` (per-record 변수 = `name`뿐)
- `useFacilityMeta.ts:451-479` `setWasteScheduleDetailMeta` — trash, key=city+구+targetRegion (emissionPlace/details 미사용)
- `useRealEstateDetailMeta.ts:54-69` — real-estate (이미 완화)
- `pages/subscription/[id].vue:544,795` — subscription (soft-404 결함)

## 4. 처방

### 4.1 즉시 출혈 차단 (확실·저위험)
- **subscription soft-404**: `subscription.value` null → `createError({statusCode:404})` (land `[dong].vue` 패턴 미러). `pages/subscription/[id].vue`.
- **잔여 fail-vector 하드닝**: 시설상세 `[category]/[id].vue`(5xx→200 빈페이지), `land/[dong].vue`·`auction/[cltrMngNo].vue`(5xx→404)를 fail-open soft-503(`markDegradedResponse`)로 통일. (6/20 수정 범위 밖, 저볼륨)

### 4.2 구조적 유니크화 (본체)
| 카테고리 | 처방 | 색인 | 데이터 |
|---|---|---|---|
| **AED** (1순위, 깔끔) | title에 `buildPlace`(설치상세위치) 추가. **단 311그룹/1,796행(2.9%)은 buildPlace도 겹침** → 충돌 시 주소꼬리 fallback | 유지 | buildPlace 100% populated |
| **TRASH** | **[결정됨] city+구+targetRegion 단위 집계(8,882→2,647)** — 한 지역 1 캐논 페이지에 emission point(성훈식당/명가 등)·요일/시간을 콘텐츠로 통합, 개별 `/trash/[id]`는 캐논으로 301 또는 noindex | 캐논 index / 개별 통합 | targetRegion 단위 |
| **WIFI** (최대 덩어리) | **[결정됨] 개별 AP noindex 유지 + 동/구 단위 wifi 목록(지역 허브)을 색인 대상으로 신설/승격.** ~40k thin 정리. 개별 유니크화 안 함 | 개별 noindex / 허브 index | name 빈약, 집계가 정답 |
| **PARKING** (낮음) | 지번 `address` + 정원 추가 (roadAddress 58% 빈값이라 jibun 사용) | 유지 | address populated |
| **CLOTHES** (낮음) | `detailLocation`/주소 추가, 또는 동 단위 집계+개별 noindex | — | partial |
| **REAL-ESTATE** | 코드 변경 없음 — 6/15 지역·6/18 시세로 완화됨. **추가 churn 금지.** stale 타이틀 age-out | 유지 | — |

### 4.3 회복 가속
- **title 포맷 동결**: 6월 ~6회 churn 중단. 1개 포맷 확정 후 유지.
- **캐시 퍼지 + 재제출**: nginx proxy_cache(`/var/cache/nginx/ilsangkit`) + Nitro route cache(s-maxage=300) 퍼지 → 네이버 사이트맵 재제출·재수집 요청.

### 4.4 근본 (백엔드, 사용자 서버 확인 필요)
- **Part B 미배포**: 운영 `DATABASE_URL`의 `pool_timeout`을 비정상 200초 → ~10초로 **낮춰 빨리 실패** + `connection_limit` 점검. (Cafe24 SSH로만 확인 가능)
- **일일 sync = 풀 트리거 상존**: sync/geocode 풀 격리·스로틀·statement timeout, 오프피크 실행.
- **관측**: Prisma `$on('query')` 슬로우쿼리 로깅 + DB-gated `/api/health` + MySQL `slow_query_log`.

## 5. 결정 사항 / 미해결

- ✅ **WIFI 전략**: 지역 집계 + 개별 noindex 유지 (사용자 결정)
- ✅ **진행 방식**: 스펙 → 단계적 PR (사용자 결정, CI 통과 후 머지)
- ⏳ **AED/TRASH 즉시 noindex 밴드에이드 여부**: 권장 = 밴드에이드 없이 4.2 구조 수정 직행(색인 유지가 더 나음). 구조 수정 PR 지연 시에만 임시 noindex.
- ⏳ **Part D(백엔드 pool/sync)**: 사용자 서버 접근 필요 — 별도 확인.
- ❌ **lastmod(거래일) 변경**: 이번 스펙 범위 제외 (사용자 결정)

## 6. PR 시퀀스 (제안)

1. **PR1 (quick-win)**: subscription soft-404 + 잔여 fail-vector 하드닝 (4.1)
2. **PR2 (회복 가속)**: title 포맷 동결 (4.3) — 조기 배포
3. **PR3 (AED)**: buildPlace title + 충돌 fallback (4.2)
4. **PR4 (TRASH)**: city+구+targetRegion 단위 집계 페이지 + 개별 schedule 301/noindex (4.2)
5. **PR5 (WIFI 허브)**: 개별 noindex 확정 + 동/구 wifi 목록 페이지 (4.2, 최대 규모 — 별도 플랜 가능)
6. **PR6 (PARKING/CLOTHES)**: 저우선 유니크화/집계
7. **운영**: 캐시 퍼지 + 네이버 재제출 (각 구조 PR 배포 후)
8. **Part D**: 백엔드 별도 (서버 확인 후)

각 PR: TDD/테스트 우선, 백엔드·프론트 `vitest run` 통과, CI green 후 develop 머지 → main 승격.

## 7. 성공 지표 (8~12주)

- "SEO 문제" 바구니 증가 정지 → 감소 전환 (aed/trash 수정·wifi 재크롤 후)
- 색인제외 정체 유지 (재발 없음)
- 노출/클릭 회복 (부동산·지역 코어부터)
- 검증: 네이버 색인/수집 추이 재export로 추적
