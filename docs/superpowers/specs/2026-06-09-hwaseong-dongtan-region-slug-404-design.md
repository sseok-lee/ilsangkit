# 화성시 동탄구(외 6개 일반구) 부동산 지역 404 수정

**날짜**: 2026-06-09
**상태**: 설계 승인됨 → 구현 계획 대기
**범위**: 데이터 수정 + 재발 방지 가드 (Approach A)

## 문제

메인페이지 "오늘의 부동산 시장"(`HomeHotspotSignals`) 섹션에서 **경기 화성시 동탄구**를 클릭하면 404가 뜬다.

## 근본 원인

핫스팟 링크는 `HotspotCard.vue`의 `buildHref()`에서 다음 형태로 생성된다:

```
/real-estate/{type}/{citySlug}/{districtSlug}
```

여기서 `districtSlug`는 **DB `Region.slug` 컬럼**에서 온다 (`realEstateHotspotService.ts`가 `INNER JOIN Region reg ... reg.slug AS districtSlug`로 조회).

지역 상세 페이지(`frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue:162-165`)는 이 slug를 **프론트엔드** `DISTRICT_SLUG_MAP`(`frontend/shared/regionSlugs.ts`)에서 역으로 한글명으로 되돌리고, 못 찾으면 `createError({ statusCode: 404 })`를 던진다.

두 소스가 불일치한다:

| 소스 | 화성시 동탄구 slug |
|---|---|
| **DB `Region.slug`** (링크가 사용) | `hwaseong-동탄구` (한글 구 접미사 그대로) |
| **프론트 `DISTRICT_SLUG_MAP`** (페이지가 기대) | `hwaseong-dongtan` |

원인은 `backend/src/scripts/syncRegion.ts`의 `KOREAN_TO_ROMANIZATION` 맵이다. 이 맵은 `화성시 → hwaseong`은 알지만 **새로 생긴 일반구**(동탄구/병점구/효행구/만세구)에 대한 항목이 없다. `normalizeKoreanToSlug("화성시 동탄구")`는 공백으로 쪼갠 뒤 각 토큰을 매핑하는데, 두 번째 토큰을 못 찾아 **원본 한글로 fallback** → `hwaseong-동탄구`를 생성한다.

화성시·부천시가 일반구 체제로 전환되면서 행정안전부 StanReginCd API가 이 구들을 내려보내기 시작했고, 프론트 맵은 이미 정확한 로마자로 갱신됐으나 백엔드 romanization 맵과 DB 행은 stale 상태로 남았다.

### 손상 범위 — 7개 구

DB에서 `slug REGEXP '[가-힣]'` 조회 결과:

| DB (깨짐) | 기대 (프론트에 이미 존재) |
|---|---|
| `hwaseong-동탄구` | `hwaseong-dongtan` |
| `hwaseong-병점구` | `hwaseong-byeongjeom` |
| `hwaseong-효행구` | `hwaseong-hyohaeng` |
| `hwaseong-만세구` | `hwaseong-manse` |
| `bucheon-오정구` | `bucheon-ojeong` |
| `bucheon-소사구` | `bucheon-sosa` |
| `bucheon-원미구` | `bucheon-wonmi` |

프론트 `DISTRICT_SLUG_MAP`은 7개 모두 이미 올바르다. **백엔드 romanization 맵 + DB 행만 stale.**

> 참고: 기존 수리 스크립트 `fixRegionSlugs.ts`는 동일한 깨진 `normalizeKoreanToSlug`를 호출하므로, 맵을 먼저 패치하기 전에는 이 7개를 고칠 수 없다. 또한 `backend/src/lib/regionSlugs.ts`는 어디서도 import되지 않는 세 번째 slug 맵 사본이다(이번 범위 밖).

## 설계

### 1. Backend romanization 맵 보강 — `backend/src/scripts/syncRegion.ts`

`KOREAN_TO_ROMANIZATION`에 누락된 7개 일반구를 **복합명 키**로 추가한다. 프론트 `DISTRICT_SLUG_MAP`과 정확히 일치시킨다:

```ts
'화성시 동탄구': 'hwaseong-dongtan',
'화성시 병점구': 'hwaseong-byeongjeom',
'화성시 효행구': 'hwaseong-hyohaeng',
'화성시 만세구': 'hwaseong-manse',
'부천시 오정구': 'bucheon-ojeong',
'부천시 소사구': 'bucheon-sosa',
'부천시 원미구': 'bucheon-wonmi',
```

이렇게 하면 `normalizeKoreanToSlug("화성시 동탄구")`가 복합 분기/한글 fallback을 타지 않고 맵에서 바로 `hwaseong-dongtan`을 반환한다. (복합명 키는 함수의 1순위 lookup인 `KOREAN_TO_ROMANIZATION[koreanName]`에서 잡힌다.)

### 2. DB slug 교정 — `npm run fix:region-slugs`

맵 보강 후 기존 스크립트(`fixRegionSlugs.ts`)를 실행하면 7개 행이 자동 교정된다(`hwaseong-동탄구 → hwaseong-dongtan` 등).

**운영 런북 (중요)**: 배포 파이프라인은 `prisma db push`만 수행하고 데이터 스크립트는 돌리지 않는다. 따라서:
- 로컬: `cd backend && npm run fix:region-slugs` 1회 실행
- 프로덕션(Cafe24): main 승격 배포 후 서버에서 `npm run fix:region-slugs` 1회 수동 실행

부수 효과: 사이트맵/검색엔진에 노출되던 깨진 부동산 지역 URL도 함께 정상화된다.

### 3. 재발 방지 가드 — 백엔드 유닛 테스트

신규 테스트(`backend/__tests__/scripts/regionSlugRomanization.test.ts`)로 백엔드↔프론트 slug 드리프트를 차단한다.

- **1차(기본)**: 프론트 `frontend/shared/regionSlugs.ts`의 `DISTRICT_SLUG_MAP`을 상대경로로 직접 import(해당 파일은 의존성 없는 standalone이라 import 시 Prisma 등을 끌어오지 않음). 모든 `[koreanName, expectedSlug]` 항목에 대해 `normalizeKoreanToSlug(koreanName) === expectedSlug`를 단언.
- **2차(폴백/추가)**: 모든 산출 slug가 `/^[a-z0-9-]+$/`만 만족하는지 단언 — 한글 fallback이 발생하면 즉시 실패.

`normalizeKoreanToSlug`는 순수 함수지만 `syncRegion.ts`가 상단에서 `prisma`/`geocode`를 import하므로, 기존 백엔드 테스트(`backend/__tests__/services/regionSync.test.ts`)와 동일한 방식으로 백엔드 vitest 환경에서 import한다.

이후 어떤 시가 일반구로 분리돼 API가 새 구를 내려보내도, `KOREAN_TO_ROMANIZATION`에 추가하기 전까지 CI가 빨갛게 막는다.

### 4. 검증

- 로컬에서 맵 패치 + `npm run fix:region-slugs` 실행 후:
  `SELECT city, district, slug FROM Region WHERE slug REGEXP '[가-힣]';` → **0건** 확인
- 신규 가드 테스트 + 기존 백엔드 vitest 전체 통과 (`cd backend && npm run test`)
- 신고된 케이스 실제 렌더 확인: `/real-estate/offitel-rent/gyeonggi/hwaseong-dongtan` (및 다른 핫스팟 링크 1~2개)

## 범위 밖 (의도적)

- 3개 slug 맵(백엔드 syncRegion / 백엔드 lib / 프론트 shared) 단일 소스 통합 리팩터 — 1Approach C, 미선택
- 신규 일반구 중심 좌표(`REGION_COORDINATES`) 보강 — slug 수정과 무관하며, 좌표는 sync 시 Kakao geocoding fallback으로 이미 채워져 있음
- `backend/src/lib/regionSlugs.ts`(미사용 사본) 제거

## 변경 파일 요약

1. `backend/src/scripts/syncRegion.ts` — `KOREAN_TO_ROMANIZATION`에 7개 구 추가
2. `backend/__tests__/scripts/regionSlugRomanization.test.ts` — 신규 가드 테스트
3. (코드 아님) DB 데이터: `npm run fix:region-slugs` 로컬+프로덕션 1회 실행
