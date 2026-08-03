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
