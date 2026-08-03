# 화성시 동탄구(외 6개 일반구) 부동산 지역 404 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인페이지 "오늘의 부동산 시장" 핫스팟에서 화성시/부천시 7개 일반구 클릭 시 발생하는 404를, 깨진 DB `Region.slug`를 교정하고 재발을 막는 가드 테스트를 추가해 해결한다.

**Architecture:** 핫스팟 링크는 DB `Region.slug`로 만들어지고 지역 상세 페이지는 그 slug를 프론트 `DISTRICT_SLUG_MAP`에서 역해석한다. 백엔드 `syncRegion.ts`의 `KOREAN_TO_ROMANIZATION` 맵에 신규 일반구가 빠져 `hwaseong-동탄구`처럼 한글이 섞인 slug가 DB에 저장됐다(불일치 → 404). 맵에 7개를 추가하고, 기존 `fixRegionSlugs.ts`로 DB 행을 교정하며, 백엔드↔프론트 맵 드리프트를 잡는 유닛 테스트를 추가한다.

**Tech Stack:** TypeScript(ESM), Node 20, Prisma + MySQL 8(Docker), Vitest.

> **참고:** 이 저장소는 `docs/`가 `.gitignore`에 있어 spec/plan 문서는 로컬 전용이다(기존 spec들과 동일). 코드/테스트 변경만 커밋한다.
> **환경 전제:** 모든 명령은 `cd backend` 기준이며 **Node 20**에서 실행한다(`nvm use 20`). Docker MySQL(`ilsangkit-mysql`, port 3307)이 떠 있어야 한다.

---

## File Structure

- **Create** `backend/__tests__/scripts/regionSlugRomanization.test.ts` — 백엔드 `normalizeKoreanToSlug` 산출 slug가 (1) 프론트 `DISTRICT_SLUG_MAP`과 전부 일치하고 (2) 한글이 섞이지 않는지 검증하는 가드 테스트.
- **Modify** `backend/src/scripts/syncRegion.ts` — `KOREAN_TO_ROMANIZATION`에 화성시·부천시 7개 일반구 복합명 키 추가.
- **Data (코드 아님)** `npm run fix:region-slugs` 실행으로 DB `Region.slug` 7개 행 교정 — 로컬 1회, 프로덕션 1회.

---

## Task 1: 재발 방지 가드 테스트 (RED)

**Files:**
- Create: `backend/__tests__/scripts/regionSlugRomanization.test.ts`

근거(검증 완료): 패치 전 이 테스트는 정확히 7개 구에서 실패(RED)하고, Task 2 패치 후 통과(GREEN)한다. 프론트 파일 `frontend/shared/regionSlugs.ts`는 의존성 없는 standalone이라 백엔드 vitest에서 상대경로로 import해도 Prisma 등을 끌어오지 않는다.

- [ ] **Step 1: 가드 테스트 작성 (실패하도록)**

Create `backend/__tests__/scripts/regionSlugRomanization.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeKoreanToSlug } from '../../src/scripts/syncRegion.js';
// 프론트엔드 단일 소스(standalone, 무의존) — 백엔드↔프론트 slug 드리프트 방지용
import { DISTRICT_SLUG_MAP } from '../../../frontend/shared/regionSlugs';

describe('Region slug 로마자화 가드', () => {
  it('백엔드 normalizeKoreanToSlug 결과가 프론트 DISTRICT_SLUG_MAP과 전부 일치한다', () => {
    const mismatches: string[] = [];
    for (const [district, expectedSlug] of Object.entries(DISTRICT_SLUG_MAP)) {
      const got = normalizeKoreanToSlug(district);
      if (got !== expectedSlug) {
        mismatches.push(`${district}: front=${expectedSlug} back=${got}`);
      }
    }
    expect(mismatches).toEqual([]);
  });

  it('어떤 구/군/시도 한글이 섞인 slug를 생성하지 않는다 (한글 fallback 차단)', () => {
    const koreanLeak: string[] = [];
    for (const district of Object.keys(DISTRICT_SLUG_MAP)) {
      const slug = normalizeKoreanToSlug(district);
      if (!/^[a-z0-9-]+$/.test(slug)) {
        koreanLeak.push(`${district} → ${slug}`);
      }
    }
    expect(koreanLeak).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run:
```bash
cd backend && npx vitest run __tests__/scripts/regionSlugRomanization.test.ts
```
Expected: **FAIL**. 첫 번째 테스트가 정확히 7개 항목으로 실패한다:
`부천시 소사구/오정구/원미구`(front=bucheon-sosa/ojeong/wonmi, back=bucheon-소사구/오정구/원미구),
`화성시 동탄구/만세구/병점구/효행구`(front=hwaseong-dongtan/manse/byeongjeom/hyohaeng, back=hwaseong-동탄구/…). 두 번째 테스트도 동일 7개로 실패.

- [ ] **Step 3: 커밋 (RED 상태 테스트)**

```bash
cd backend && git add __tests__/scripts/regionSlugRomanization.test.ts
git commit -m "test(region): 백엔드↔프론트 slug 로마자화 드리프트 가드 추가 (RED)"
```

---

## Task 2: romanization 맵 보강 (GREEN)

**Files:**
- Modify: `backend/src/scripts/syncRegion.ts` (`KOREAN_TO_ROMANIZATION`, 경기 섹션)

- [ ] **Step 1: 부천시 일반구 3개 추가**

`backend/src/scripts/syncRegion.ts`에서 다음 줄을 찾는다 (현재 line 194):

```ts
  부천시: 'bucheon',
```

다음으로 교체한다:

```ts
  부천시: 'bucheon',
  '부천시 원미구': 'bucheon-wonmi',
  '부천시 소사구': 'bucheon-sosa',
  '부천시 오정구': 'bucheon-ojeong',
```

- [ ] **Step 2: 화성시 일반구 4개 추가**

같은 파일에서 다음 줄을 찾는다 (현재 line 221):

```ts
  화성시: 'hwaseong',
```

다음으로 교체한다:

```ts
  화성시: 'hwaseong',
  '화성시 동탄구': 'hwaseong-dongtan',
  '화성시 병점구': 'hwaseong-byeongjeom',
  '화성시 효행구': 'hwaseong-hyohaeng',
  '화성시 만세구': 'hwaseong-manse',
```

근거: `normalizeKoreanToSlug`는 `KOREAN_TO_ROMANIZATION[koreanName]`를 1순위로 조회하므로, 복합명 키(`'화성시 동탄구'`)가 있으면 공백 분할/한글 fallback 분기를 타지 않고 바로 정확한 slug를 반환한다. (검증: 7개 추가 후 프론트 246개 구와 0 mismatch)

- [ ] **Step 3: 가드 테스트 실행 → 통과 확인**

Run:
```bash
cd backend && npx vitest run __tests__/scripts/regionSlugRomanization.test.ts
```
Expected: **PASS** (2 passed).

- [ ] **Step 4: 백엔드 전체 테스트 실행 → 회귀 없음 확인**

Run:
```bash
cd backend && npm run test
```
Expected: 전체 PASS (기존 `regionSync.test.ts` 포함 회귀 없음).

- [ ] **Step 5: 커밋**

```bash
cd backend && git add src/scripts/syncRegion.ts
git commit -m "fix(region): 화성시·부천시 7개 일반구 romanization 매핑 추가 (slug 한글 fallback 제거)"
```

---

## Task 3: DB slug 데이터 교정 + 검증 (로컬)

**Files:** 없음 (데이터 마이그레이션 — `npm run fix:region-slugs`)

- [ ] **Step 1: 교정 전 DB 상태 확인 (한글 섞인 slug 7건 존재)**

Run:
```bash
docker exec -i ilsangkit-mysql mysql --default-character-set=utf8mb4 -uilsangkit -pilsangkit123 ilsangkit \
  -e "SELECT city, district, slug FROM Region WHERE slug REGEXP '[가-힣]';"
```
Expected: 7행 출력 (`hwaseong-동탄구`, `hwaseong-병점구`, `hwaseong-효행구`, `hwaseong-만세구`, `bucheon-오정구`, `bucheon-소사구`, `bucheon-원미구`).

- [ ] **Step 2: 교정 스크립트 실행**

Run:
```bash
cd backend && npm run fix:region-slugs
```
Expected: 로그에 `fix: 경기 화성시 동탄구: "hwaseong-동탄구" → "hwaseong-dongtan"` 등 7줄 + `7개 Region slug 수정 완료.` (다른 지역이 함께 교정되면 그 줄도 정상으로 간주).

- [ ] **Step 3: 교정 후 DB 상태 확인 (0건)**

Run:
```bash
docker exec -i ilsangkit-mysql mysql --default-character-set=utf8mb4 -uilsangkit -pilsangkit123 ilsangkit \
  -e "SELECT city, district, slug FROM Region WHERE slug REGEXP '[가-힣]';"
```
Expected: **빈 결과 (0행)**.

- [ ] **Step 4: 교정된 slug 값 확인**

Run:
```bash
docker exec -i ilsangkit-mysql mysql --default-character-set=utf8mb4 -uilsangkit -pilsangkit123 ilsangkit \
  -e "SELECT district, slug FROM Region WHERE slug LIKE 'hwaseong-%' OR slug LIKE 'bucheon-%';"
```
Expected: `hwaseong-dongtan`, `hwaseong-byeongjeom`, `hwaseong-hyohaeng`, `hwaseong-manse`, `bucheon-ojeong`, `bucheon-sosa`, `bucheon-wonmi` 포함.

- [ ] **Step 5: 신고된 404 페이지 실제 렌더 확인**

dev 서버 2개를 띄운 뒤(`cd backend && npm run dev`, 별도 터미널 `cd frontend && npm run dev`), 브라우저에서 다음 경로를 연다:
```
http://localhost:3000/real-estate/offitel-rent/gyeonggi/hwaseong-dongtan
```
Expected: 404가 아니라 "화성시 동탄구 오피스텔 전월세 실거래가" 지역 허브 페이지가 정상 렌더. 추가로 메인페이지(`http://localhost:3000`) "오늘의 부동산 시장"에서 화성시 동탄구/부천 구 링크 클릭 시 정상 이동.

> 커밋 없음: 데이터 변경만 발생(코드 무변경).

---

## Task 4: 프로덕션 데이터 교정 런북 (배포 후 1회)

**Files:** 없음 (운영 절차)

- [ ] **Step 1: main 승격/배포 후 서버에서 교정 스크립트 1회 실행**

배포 파이프라인은 `prisma db push`만 수행하고 데이터 스크립트는 돌리지 않으므로, Task 1~2가 main에 반영돼 배포된 뒤 Cafe24 서버 backend 디렉터리에서 수동 실행한다:
```bash
npm run fix:region-slugs
```
Expected: 프로덕션 DB의 깨진 slug 7건(또는 그 이상) 교정 완료 로그.

- [ ] **Step 2: 프로덕션 검증**

배포 도메인에서 다음을 연다:
```
https://ilsangkit.co.kr/real-estate/offitel-rent/gyeonggi/hwaseong-dongtan
```
Expected: 200 정상 렌더(404 아님). 메인 "오늘의 부동산 시장" 핫스팟 링크 정상.

> 이 Task는 운영 권한이 필요한 수동 절차다. 이 세션에서 실행할 수 없으면 사용자에게 인계한다.

---

## Self-Review

- **Spec coverage:** 스펙 §1(맵 보강)=Task 2, §2(fix:region-slugs 로컬+프로덕션)=Task 3·4, §3(가드 테스트)=Task 1, §4(검증: SQL 0건/테스트/페이지 렌더)=Task 3 Step 3~5 + Task 2 Step 3~4. 누락 없음.
- **Placeholder scan:** 모든 코드/명령/기대 출력이 구체값으로 채워짐. "적절히 처리" 류 없음.
- **Type/이름 일관성:** `normalizeKoreanToSlug`, `KOREAN_TO_ROMANIZATION`, `DISTRICT_SLUG_MAP`, `npm run fix:region-slugs` 등 실제 심볼/스크립트명 사용 확인(코드베이스에서 검증됨). import 경로 `../../../frontend/shared/regionSlugs`는 vitest에서 해석됨을 실측 확인.
- **TDD/검증 실측:** Task 1 RED(정확히 7건 실패), Task 2 후 GREEN(프론트 246구 0 mismatch) 모두 사전 실행으로 확인됨.
