# SDD Progress — /real-estate 지도 탐색 화면

Plan: docs/superpowers/plans/2026-08-03-real-estate-map-explorer.md
Spec: docs/superpowers/specs/2026-07-31-real-estate-map-explorer-design.md (2026-08-03 운영실측 개정)
Branch: feat/real-estate-map-explorer (base = origin/develop 3e6911c4)

(이전 ledger 는 통합검색 리디자인 PR#644/645/646 — main 배포 완료. 무관.)

## CRITICAL 제약 (Global Constraints)
- **Node 20 필수.** 셸 상태가 호출 간 유지되지 않으므로 매 명령에 PATH 프리픽스:
  `PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"`
  (시스템 기본은 v25.5.0 — 그대로 쓰면 lock 틀어져 CI npm ci 실패)
- package-lock 재생성 금지. 신규 의존성 0.
- PR→develop, main 직접 금지, self-merge 금지. CI 통과 후 머지. TDD.
- Backend ESM — 로컬 import 에 .js 확장자 필수.
- 라우트는 asyncHandler() 래핑 + validate() Zod. 에러는 클래스 throw.
- BigInt/Decimal → Number 변환 필수.
- **날짜 조건 sargable 필수** — `dealYear * 100 + dealMonth >= ?` 금지(운영 5,862ms vs 529ms, 11배).
- **bbox 는 FORCE INDEX 필수** — 인덱스만 추가하면 옵티마이저가 안 씀(232ms vs 11ms, 21배).
- **지도 상태는 해시(#)** — 쿼리로 새면 Nitro swr 캐시 키 분기(2026-08-02 SIGABRT 사고).
- **monthlyRent 판별: NULL=매매 / 0=전세 / >0=월세.** IS NULL 을 전세로 쓰지 않는다.
- SSR 가드 import.meta.client. 직접 mount 컴포넌트는 ref/computed/watch/onMounted 명시 import.
- **useKakaoMap 수정 금지** — 5개 페이지가 사용 중(시설상세·건물상세·공매·청약·지하철).
- 광고 축소 금지: 기존 AdBanner 1 + 좌측 인피드 1 = 총 2개. AnchorAdBanner 재도입 금지.
- 활성 시/도 **16개** — SIDO_CHIPS(frontend/utils/regionChips.ts) 정본. 새 상수 만들지 않음.

## Deviations / 결정
- **Pre-flight 수정 1건**: 하단 콘텐츠 중복. 초판 계획이 BelowFoldContent 를 바텀시트
  #belowFold 슬롯 + 페이지 본문 양쪽에 렌더 → 모바일 DOM 에 h2 2개·AdBanner 2개(총 3)·
  유형카드 2벌. 사용자 결정 = **본문에 한 번만, 시트는 목록만**. 스펙 6.4 갱신 완료.
  모바일 도달 경로 = 시트 접기(핸들) 또는 페이지 스크롤.
- 전월세 지역 버블은 전세(monthlyRent=0)만 집계. 월세 보증금과 규모가 달라 섞으면 무의미.
  결과: 전월세 타입에서 버블=전세 기준, 마커=전월세 혼합. UI '전세 기준' 표기 여부는 구현 중 확인.
- 거래 축 2종(매매/전월세). 3종은 전세 필터 시 아파트 44.6%·오피스텔 56.4% 누락(운영 실측).

## Tasks (model)
- Task 1: sargable 날짜 빌더 [transcription — haiku]
- Task 2: 좌표 인덱스 + serializeRow export [transcription — haiku]
- Task 3: bbox 건물 조회 (FORCE INDEX) [transcription — sonnet]
- Task 4: 지역 집계 + TTL 캐시 [judgment — sonnet]
- Task 5: granularity + Zod + 라우트 [judgment — sonnet]
- Task 6: useRealEstateMap composable [transcription — sonnet]
- Task 7: useMapOverlays [transcription — sonnet]
- Task 8: MapFilterBar + MapSidebar [judgment — sonnet]
- Task 9: Canvas + Explorer + BottomSheet [integration — sonnet]
- Task 10: 페이지 교체 + SEO [judgment — sonnet]
- Task 11: 회귀 + PR [integration — sonnet, 최종 whole-branch 리뷰 opus]

## Ledger
시작 (base 3e6911c4). 문서 커밋 cherry-pick 복구: 7210ecc9(스펙 개정) + 5b2550a9(계획).
  ★원인: 문서 3커밋을 로컬 develop 에 했는데 브랜치를 origin/develop 에서 따 누락됨.
Pre-flight 스캔: 충돌 1건 발견·해소(하단 콘텐츠 중복, 위 Deviations 참조).
Task 1: complete (commit b5a35383, base 2a9bdde9, review clean — Spec ✅/Quality Approved, Critical·Important 0). recentMonthsCondition(months, now) → sql `((dealYear = ? AND dealMonth >= ?) OR dealYear > ?)` + params [cy, cm, cy]. while 루프라 다년 롤오버도 일반적으로 동작(리뷰어 수기 검증: 25개월→2024/1). months 비정수·<1 throw. 5/5 green(controller 독립 재실행 확인). Minor(DEFER→최종 triage): (T1a) now 가 Invalid Date 면 NaN params 무검증(브리프 범위 밖, 호출자 내부값) · (T1b) months 상한 없음(이론적) · (T1c) 분수·2년 롤오버 테스트 미커버(수기 검증됨).
Task 2: complete (commit cbd1032e, base b5a35383, review clean — Spec ✅/Quality Approved, Critical·Important 0). @@index([type, lat, lng]) + serializeRow export(단일 토큰 추가, eslint 지시문·시그니처 불변). ★MySQL 실제 인덱스명 RealEstateBuildingSummary_type_lat_lng_idx 확인(controller SHOW INDEX 독립검증) = Task 3 FORCE INDEX 하드코딩 문자열과 일치. serializeRow import 실동작 확인(168340n→168340). 리뷰어 grep: auction/land/subscription 서비스는 각자 module-local serializeRow 보유 → 이번 export 영향 0. 3/3 + 인접 75/75 green. Minor(DEFER→최종 triage): (T2a) 스키마 텍스트 테스트가 Prisma 생성 인덱스명은 검증 못함 — Task 3 FORCE INDEX 와의 결합이 CI 미보장(단, 이름 불일치 시 MySQL 이 'Key doesn't exist' 로 즉시 에러라 silent 실패는 아님).
★controller 발견(계획 버그, commit 604a2518): Task 3·4 Step 5 의 `npx tsx -e` 는 CJS 평가라 상대 ESM import 가 MODULE_NOT_FOUND. 임시 .ts 파일 실행 방식으로 교체하고 브리프 3·4 재추출.
Task 3: complete (commit 707915c3, base 604a2518, review clean — Spec ✅/Quality Approved, Critical·Important 0). fetchBuildings(type, bounds) → {items, total, exact}. FORCE INDEX 2곳(COUNT+목록)·total 별도 COUNT·exact = total<=200·lat/lng 별도 Number 코어션(serializeRow 는 bigint 만). 리뷰어 확인: assertKnownType 이 첫 줄이라 양 쿼리 경로 게이트·type 은 바운드 파람이라 우회해도 인젝션 없음·params 배열을 COUNT/목록이 공유해 순서 드리프트 불가·Decimal 코어션은 getComplexList 와 동일 하우스 스타일. 7/7 green. Step5 실DB: total=966 items=200 exact=false.
★controller 실측(구현된 쿼리로 재확인, villa-rent 희소 뷰포트): 힌트없음 357ms → FORCE INDEX 22ms = **16배**. 설계 예측(21배)과 동일 크기. 인덱스만 추가하면 무의미하다는 전제 입증.
Minor(DEFER→최종 triage): (T3a) exact 경계 total===200 미테스트(< vs <= off-by-one 통과 가능) · (T3b) FORCE INDEX 단언이 목록 쿼리(calls[1])만, COUNT 쿼리(calls[0]) 미검증.
Task 4: complete (commit be156036, base 707915c3, review Spec ✅ / Quality "Needs work"→**controller 판정: Critical 기각(운영 반증)**). fetchRegions(type, level) + TTL 1h 캐시 + in-flight 합치기. 매매=dealAmount·전월세=deposit AND monthlyRent=0(전세만)·sargable 조건·실패 시 [] 반환하고 캐시 안 함. 7/7(+Task3 7 = 14/14) green·tsc·lint clean.
  리뷰어 무이슈 판정 항목(추적용): 월경계 캐시 staleness = TTL 1h 로 유계·수용 / in-flight 경합 = set 이 동기, 캐시 쓰기가 finally 삭제보다 먼저, reject 은 catch 가 []로 변환 → 누수 없음 / 나눗셈 = WHERE exclusiveArea > 0 가 같은 쿼리라 0·NULL·음수 사전 배제.
  ★★Critical "구·군 INNER JOIN 이 광주 동구 13,435행을 조용히 버림" = **로컬 스냅샷 아티팩트, 운영 반증됨**. controller 운영 확인: 6개 테이블 전부 탈락 0행, 탈락 조합 0건. 로컬엔 '광주 동구'가 있으나 운영은 2026-07-01 통합으로 '전남광주통합특별시 동구'이고 Region 에 정상 존재. (이번 세션 두 번째 로컬 오탐 — 앞서 latestDealYear 미래날짜 22%도 운영 0건이었음.) 시/도 레벨도 탈락 0 확인. 운영 실쿼리 결과: 시/도 15행(세종은 아파트매매 거래 자체가 0 = 데이터 공백)·구/군 251행.
  → Task 4 블로킹 아님. 단 **구조적 지적은 유효**(INNER JOIN 이 향후 Region 공백을 조용한 손실로 전환. 이 코드베이스는 행정구역 개편마다 실제 드리프트 경험 — 화성·부천 신설구 404 등). 후속 항목으로 이관: Region 드리프트 감시(SEO 카나리 확장 후보). 이번 스코프에서 JOIN 시맨틱 변경 안 함 — LEFT JOIN 은 lat/lng NULL 행을 만들어 버블을 못 찍으므로 지도에 도움 안 되고 잡음만 늘림.
Minor(DEFER→최종 triage): (T4a) 시/도 마커가 구·군 중심 비가중 평균이라 비볼록 도(강원·전남·경기)에서 시각적으로 어긋날 수 있음(미관) · (T4b) $queryRawUnsafe 전면 목이라 실제 JOIN/Region 매칭을 검증하는 테스트 없음(라이브 DB 필요) · (T4c) 계획 오타 '8 passed'→실제 7(수정 완료).
Task 5: complete (commits 5ec72ccb + fix 282886e5 + fix2 eabeb35a, base ffe7209c, 재리뷰 Spec ✅ / Important 1 → fix2 → controller 독립 검증 통과). MapQuerySchema(level 1~14·bbox 4개 동시·KOREA_BOUNDS·sw<=ne·prev optional) + resolveGranularity(level, prev?) + GET /:type/map. rentType 없음(설계대로). 라우트 마운트 순서 정상(리터럴→:type, map 이 마지막). 백엔드 전체 1789/1789 green.
  ★Important #1 (controller 발견): 히스테리시스 로직은 42쌍 전수 검증 결과 정확(양 경계 대칭 2단계 sticky, 진동·과고착 없음)했으나 **라우트가 prev 를 안 넘겨 운영에서 전혀 동작 안 함**. 스펙이 명시 요구한 엣지케이스(줌 경계 진동)인데 배선 누락 = 계획의 결함. fix 282886e5 로 prev optional 쿼리 추가·배선. 라이브 검증: prev 없음 11→city / prev=district 11→district(유지) / prev=city 10→city(유지)·9→district / prev=bogus 422.
  ★Important #2 (리뷰어 발견, 정확): fix 의 "회귀 가드" 테스트가 실제로는 가드 못함. 14개 전부 resolveGranularity 를 직접 호출할 뿐 라우트를 안 탐 → **호출부를 되돌려도 전부 통과**(controller 실험으로 확인). 원래 버그와 동일 실패 유형. fix2 eabeb35a 로 supertest 라우트 테스트 5개 추가(형제 area.test.ts 패턴). controller 독립 재검증: 호출부 되돌림 → 1 FAILED/18 passed, 원복 → 19/19, 소스 diff 0.
  리뷰어 무이슈 항목: 악의적 prev+level 조합은 4개 경계 케이스 밖에서 전부 base 폴백(무해, 쿼리 무한대 없음) / prev 는 이미 올바른 두 캐시 목록 중 선택만 하므로 캐시 오염 없음 / 마운트 순서 무관(단일 세그먼트 접미사라 모호성 없음).
Minor(DEFER→최종 triage): (T5a) city/district 응답의 total=items.length·exact=하드코딩 true 인 반면 building 은 실 COUNT 기반 — 서비스 계층 기존 설계(이번 diff 아님). **프론트는 반드시 granularity 로 분기 후 아이템 필드를 읽어야 함** → Task 6~8 디스패치에 명시.
Task 6: complete (commit 50947847, base eabeb35a, review Spec ✅/Quality Approved, Critical 0 · Important 1 → fix 진행). types/realEstateMap.ts + composables/useRealEstateMap.ts. prev: granularity.value 전송(line 90)·해시 URL·bbox 클램프·seq stale 폐기·vue 명시 import·KOREA_BOUNDS 백엔드 일치(33/39/124/132). 9/9 green, 프론트 전체 2106 green(구현자 보고), lint clean.
  리뷰어 무이슈 판정(controller 질의 3건 답변): stale 응답은 mySeq!==seq 가드 뒤에서만 mutate 하므로 어느 해소 순서에도 오염 없음·pending 은 최신 seq 소유자만 false 로 내려 수렴 / prev 고착 불가 — 히스테리시스 hold 는 전환당 정확히 1레벨 폭(10,7,11,8)이라 다음 스텝에서 항상 전진(13→11→10→9→8→7→6 추적 확인), 다중 팬을 합친 점프는 4규칙 어디에도 안 걸려 base 폴백 / setType 이 타이머를 먼저 지우므로 stale type fetch 없음, 팬 경합도 seq 로 최신 우선 → 지도 표시와 최종 상태 일치. clampBounds 단조성 = controller 판단과 동의(역전 불가), 추가로 backend refine 이 `<=` 라 축퇴 박스도 422 아님 확인.
  ★Important(브리프 기원): itemKey 가 district: null 로 미테스트 — 시/도 레벨은 district 가 **항상 null** 인 정상 경로인데 `?? ''` 폴백이 사라져도 9개 전부 통과. fix 디스패치(고의 파손 시 실패 증명 요구).
Minor(DEFER→최종 triage): (T6a) 요청 abort/timeout 없음 — 최신 seq 요청이 영구 행 시 pending 이 true 고착 · (T6b) level 이 13 하드코딩이라 초기 상태가 district/building 이면 첫 onMapIdle 전까지 불일치 · (T6c) fetch 에러(422 포함) 무음 처리, Task 8~9 가 '로딩'과 '이 영역 실패'를 구분할 신호 없음.
  → fix 49beee72 (itemKey district:null 테스트). controller 독립 검증: 폴백 제거 시 1 FAILED('서울|null' vs '서울|'), 원복 시 10/10, 소스 diff 0. Task 6 최종 complete.
Task 7: complete (commit fa700390, base 49beee72, review Spec ✅/Quality Approved, Critical·Important(결함) 0). useMapOverlays(formatPriceLabel·formatPyeongLabel·renderOverlays·clearOverlays). ★useKakaoMap diff 0 확인(5개 페이지 회귀 표면 0 유지) · 2파일 148줄 순수 추가 · monthlyRent 사다리 null→매매/0→전세/>0→월세 · shallowRef vue 명시 import · import.meta.client 가드. 9/9 green.
  리뷰어 수기 산술 검증: 168340→"16억 8,340" / 30000→"3억"(꼬리 0 없음) / 40500→"4억 500"(="4억 0,500" 아님, 올바른 한국어) / 1234567→"123억 4,567" 정밀도 이상 없음. SSR: 모듈·types 모두 top-level 부작용 0. 좌표 null 스킵이 createElement·kakao 호출보다 앞 확인. overlays 배열은 반환값에 노출 안 되므로 인덱스 정합 의존 불가능.
  → 렌더러 커버리지 0("Important 정보성, 결함 아님") → controller 판단으로 fix 디스패치(happy-dom + 가짜 window.kakao 로 테스트 가능하다는 리뷰어 근거 채택. 이번 세션 '코드는 맞는데 미검증' 결함 3회 반복 패턴 차단).
Minor(DEFER→최종 triage): (T7a) renderOverlays 의 early-return 이 clearOverlays 보다 앞이라, map 이 falsy 로 재호출되면 이전 오버레이가 미분리 잔존(의도된 사용에선 미발생) · (T7b) 월세액이 formatManwon 을 안 거쳐 10,000만원 이상이면 "1억 5,000" 대신 "15,000" (현실적으로 발생 희박) · (T7c) formatManwon(0)→"0" (대시 아님; 실데이터에 0 없음).
★controller 발견(계획 버그, commit 8c6a580e): AdBanner 실제 경로가 components/ads/ 인데 계획이 components/common/ 로 적어둠 → Task 8·10 구현자가 모듈 해석 실패로 막힐 자리. 2곳 수정 후 브리프 8·10 재추출. 나머지 컴포넌트 경로 6개는 전수 확인 정확. +NuxtLink 스텁이 <a :href> 로 렌더 확인(Task 8 링크 단언 성립) · AdBanner 는 명시 import 라 전역 스텁 미적용이나 useRoute 전역 목 존재·matchMedia typeof 가드라 실마운트 안전.
  → fix a8770f4e: **가드 극성 문제 발견·수정 + 렌더러 테스트 5종**. ★★fix 구현자가 테스트 작성 전 구조적 블로커를 보고(억지 우회 안 함): vitest 에서 `import.meta.client`·`import.meta.server` 가 **둘 다 undefined** → `if (!import.meta.client) return` 은 항상 걸려 **renderOverlays 전체가 테스트에서 도달 불가**(dead on arrival). useKakaoMap.ts:124 는 `import.meta.server` 극성이라 클라 로직이 정상 실행 = 이 모듈만 반대 극성이었음. 코드베이스도 같은 한계를 AdBanner.test.ts:181 에 이미 주석화. controller 실증 확인 후 옵션1(극성 뒤집기) 채택 — 실제 Nuxt 빌드에선 두 플래그가 정의·상반되므로 **프로덕션 동작 완전 동일**, 차이는 vitest 뿐. 옵션2(vitest define 전역)는 useAdsPolicy·AdBanner 문서화된 기존 동작까지 바꿔 기각.
    소스 diff = 극성 1줄 + 주석 3줄만. 테스트 14/14(9 포매터 + 5 렌더러). controller 독립 재현: clearOverlays() 주석 처리 → clear-before-render 1 FAILED/13 passed, 원복 → 14/14. 프론트 전체 259파일 2121 green(극성 변경 회귀 0), lint 0 err.
  → Task 7 최종 complete.
★controller 발견(계획 버그, commit c59d2bae): 계획의 SSR 가드 7곳이 전부 `!import.meta.client` 극성 → Task 9 도 같은 함정. 전부 `import.meta.server` 로 교체 + Global Constraints 에 극성 이유 명시. 브리프 9 재추출.
Task 8: complete (commits a851b5b9 + fix 1c38feaf + fix2 1ea81452, base a8770f4e, 리뷰 Spec ✅ / Critical 1 → fix2 → controller 독립 검증 통과). MapFilterBar(6버튼, 전세/월세 분할 없음) + MapSidebar(지역/건물 2모드, SIDO_CHIPS 기반 fail-open, toRealEstateUrl/ListUrl 빌더, AdBanner ~/components/ads/).
  ★fix 1c38feaf — **계획 내부 모순**: Global Constraints 44px vs Step3 코드 min-h-[36px]. 구현자가 브리프대로 구현 후 삼키지 않고 보고(정확한 판단). 코드베이스 확인: min-h-[44px] 16파일, 동일 축 TransactionModeTab·RentTypeToggle·TxnTypeMiniTabs 전부 44px → 계획 코드가 오류. 컴포넌트+계획 양쪽 수정(flex items-center justify-center 동반, 형제 패턴).
  ★★fix2 1ea81452 — **Critical(controller·리뷰어 독립 동시 발견)**: 지역명 매칭 `byName.get(chip.label) ?? byName.get(chip.slug)` 가 전남·광주에서 영구 실패. API가 반환하는 name = DB city 원값인데, 15개 광역은 축약형(서울/경기…)이라 chip.label 과 우연히 일치하지만 통합특별시만 **축약명이 없어 '전남광주통합특별시'** 전체명 → label('전남·광주')·slug('jeonnamgwangju') 어느 쪽과도 불일치 → 실데이터가 있어도 항상 '—'. 27개 시군구를 가진 최대 광역이고, 이 사이드바가 /real-estate 의 유일한 SSR 콘텐츠라 크롤러에 영구 오답 노출. 기존 테스트가 못 잡은 이유 = 테스트 데이터가 정의상 일치하는 '서울'/'세종'만 사용.
    해법: controller 실증한 CITY_SLUG_MAP(slug→DB city 원값: seoul→'서울', jeonnamgwangju→'전남광주통합특별시')을 1차 키로. 3키 폴백. +district 모드 테스트 신설(기존 커버리지 0). 10/10, 프론트 전체 2131 green(baseline 2128, +3), lint 0.
    controller 독립 재현: 매칭 되돌림 → 1 FAILED(전남광주 가드), 원복 → 10/10.
Minor(DEFER→최종 triage): (T8a) 인피드 광고가 rows<5 면 사라짐 — **사용자 결정: 현재대로 유지**(controller 추천 근거=애드센스 무효트래픽 감사의 최우선 처방이 뷰어빌리티였고, 결과 적은 상태에서 광고 추가는 unviewable impression 을 늘리는 바로 그 패턴. 슬롯 정의가 '5번째 뒤'이고 짧은 목록이 미도달하는 건 설계의 자연 결과지 임의 축소 아님. 지도 아래 본문 AdBanner 는 유지되어 페이지 광고 0 아님. 대가=짧은 목록 시 좌측 노출수익 0) · (T8b) MapFilterBar OPTIONS 가 MAP_TYPES 미파생 하드코딩(7번째 타입 추가 시 드리프트) · (T8c) district ?? '' 폴백 도달성 불명(백엔드가 district 로 GROUP BY 하므로 실무상 항상 채워짐).
Task 9: 구현 완료 (commit 90df9b83, base 1ea81452, DONE_WITH_CONCERNS → controller 판정 후 리뷰 진행). RealEstateMapCanvas + MapBottomSheet + RealEstateMapExplorer. ★useKakaoMap diff 0 · 4파일 259줄 순수 추가 · SSR 가드 6곳 전부 import.meta.server 극성 · 바텀시트 footer 슬롯 0(중복 렌더 방지). 14/14 (map 디렉터리), 프론트 전체 261파일 2135 green.
  ★구현자 편차 1건(보고됨, controller 수용): `onNuxtReady` 가 eslint.config.mjs 의 .vue globals allowlist 에 없어 no-undef 에러 → CI lint 게이트 실패. `#app` 명시 import 는 vitest 에서 별칭 부재로 깨짐(구현자가 양쪽 실험). → `// eslint-disable-next-line no-undef` 한 줄로 처리.
    ★controller 판정: **eslint globals 목록은 건드리지 않는다.** 근거 = 같은 파일 주석의 선례 — setResponseHeader 를 잘못 등록했다가 no-undef 가 눌려 "SSR 에서 항상 ReferenceError 나는 코드가 lint 초록 통과"한 사고. 규칙은 "앱 코드에서 실제로 자동 import 되는 것만 등록". onNuxtReady 는 plugins/adsense.client.ts(.ts, 운영 동작 중)가 import 없이 쓰지만 **.vue 선례가 없다**.
    ★검증 시도: `npm run build` 성공했으나 **이번 빌드로는 검증 불가** — 새 컴포넌트가 번들에 부재(고유 문자열 '지역별 평균 평당가'·'map-price-label'·'지도를 이동해' 전부 0파일). Task 10 에서 페이지가 참조하기 전이라 트리셰이킹됨. onNuxtReady 리터럴이 번들에 0건인 것도 이 때문이라 근거로 못 씀.
    → **Task 11 브라우저 검증에 '지도가 실제로 초기화되는가' 를 명시 항목으로 추가**(자동 import 실패 시 ReferenceError 로 지도 전체 사망). Task 10 완료 후 재빌드로 번들 포함 여부 재확인.
  → fix a80c049c. 리뷰 Spec ✅ / Quality "Needs work"(Critical 1 + Important 2) → 전부 수정·검증.
    ★Critical: **Kakao idle 리스너 누수**. useKakaoMap.ts:14 타입이 `addListener: (...) => void` 인데 반환값을 idleListener 에 담아 `if (idleListener && ...)` 로 제거를 가드 → 항상 undefined → removeListener **한 번도 호출 안 됨**. 클라 내비게이션마다 리스너 누적(이 저장소는 프론트 OOM/SIGABRT 이력 보유). 형제 FacilityMap.vue:125-128 은 map.value 만 가드하고 무조건 제거 = 하우스 패턴. 수정: idleListener 변수 제거 + FacilityMap 패턴 채택.
    ★Important 2: onSelect 가 center.value 만 갱신하고 아무도 소비 안 함(Canvas 가 props.center 를 onMounted 에서 1회만 읽고 watch 없음, panTo 미destructure) → 마커 클릭이 아무 반응 없음. **+controller 추가 발견: hoveredKey 도 3곳에서 대입만 되고 아무도 읽지 않음** = 스펙 5.7 "목록↔마커 양방향 연동" 통째 미구현. 수정 범위: panTo destructure + watch(props.center) 로 마커 클릭→지도 이동 구현. 호버 하이라이트는 useMapOverlays 렌더 API 변경 필요라 **후속 분리**(hoveredKey 에 의도 주석).
    ★Important 3: 위험 코드 무커버(Explorer 테스트가 Canvas 를 전면 stub → 실 script setup 미실행, test4 는 stub 만 검증하는 준-동어반복). 수정: RealEstateMapCanvas.test.ts 6종(실 컴포넌트 마운트 + 가짜 kakao) + MapBottomSheet.test.ts 4종 신설.
    controller 독립 재현: 제거 경로 무력화 → 1 FAILED(누수 가드), 원복 → 4파일 24/24. 프론트 전체 263파일 2145 green(baseline 261/2135, +10), lint 0 err.
    리뷰어 ⚠️ 해소(controller 확인): renderOverlays 는 items 를 in-place 변형하지 않음(자체 배열 push 만) → readonly 위반 위험 없음.
  → Task 9 최종 complete.
Minor/후속(DEFER→최종 triage): (T9a) hoveredKey 여전히 dead — 호버 하이라이트는 useMapOverlays 렌더 API 확장 필요, 후속 태스크 · (T9b) onNuxtReady eslint-disable(전역 목록 미변경 판정, Task 11 브라우저 검증으로 담보) · (T9c) ClientOnly 슬롯 스왑 vs 부모 onMounted 타이밍은 추론만 되고 테스트 미실행(리뷰어 ⚠️).
Task 10: 구현 완료 (commit d8ddebda, base a80c049c, 리뷰 진행 중). /real-estate 페이지를 지도 탐색 화면으로 교체 + 정적 FAQ·FAQPage 스키마 제거. 유형 카드 7개(주택 6 + 토지)·ItemList/Dataset/Breadcrumb/DataSourceSection/AdBanner 유지. 프론트 전체 263파일 2146 green(exit 0), tests/pages 65파일 471, lint 0.
  ★구현자 발견 3건(전부 controller 승인):
   (1) 기존 테스트 2개가 제거 대상 동작을 검증 중 → **통째 삭제 대신**: real-estate-hub.test.ts 는 여전히 유효한 H2 단언 2개("부동산 유형별 실거래가"·"부동산 실거래가란?")를 남기고 재작성(+토지카드 단언, Explorer stub) / realEstateFaqSchema.test.ts 는 삭제(제거 대상 스키마만 검증). 통째 삭제했으면 하단 콘텐츠의 **렌더 기반 검증이 소실**될 뻔.
   (2) 브리프의 `readFileSync(new URL(...))` 가 이 저장소 vitest 에서 TypeError → process.cwd() 기반 resolve 로 수정(landListHardLink.test.ts 관행). 브리프 오류.
   (3) ★**토지 카드 누락 = 스펙 6.1 위반**. RealEstateCategoryCards 는 주택 6종만 렌더하고 토지는 구 페이지에서 별도 카드 → 계획 코드가 빠뜨려 6개. 구 페이지 블록 복원(commit 1df38647 로 계획도 수정). NuxtLink 는 vitest 별칭 문제로 resolveComponent 지시했으나, 구현자가 **HardLink** 채택 — 확인 결과 형제 RealEstateCategoryCards 가 이미 HardLink 이고 구 페이지 토지카드만 NuxtLink 로 어긋나 있었음 → 일관성 개선으로 수용.
  ★구현자 추가 발견(범위 밖, 수용): realEstateHub.test.ts 가 Explorer 를 stub 안 해 useKakaoMap→shallowRef 미정의 unhandled rejection → **개별 테스트는 통과하는데 vitest run 이 exit 1** → CI 빨감. stub 4줄 추가. controller 가 "그 파일은 괜찮다"고 한 판단 착오를 구현자가 교정.
  Step5 curl: `서울` SSR 렌더 확인 / `FAQPage` 0건 / `/real-estate/land` 2회. 지도 API 는 로컬 stale DB 로 items:[] 반환했으나 사이드바가 SIDO_CHIPS 폴백으로 전 시/도 렌더 = **fail-open 실동작 확인**.
  ★controller 검증(onNuxtReady): Task 10 로 페이지가 컴포넌트를 참조하게 된 뒤 재빌드 → 신규 컴포넌트가 번들에 포함됨(지역별 평균 평당가·map-price-label·대지·전·답·임야 발견) **그리고 onNuxtReady 리터럴은 클라/서버 청크 양쪽 0건** = import 로 해석·리네임됨 → 자동 import 동작. 브라우저 확정 검증 진행 중.
