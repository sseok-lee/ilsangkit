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
