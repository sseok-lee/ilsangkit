# 통합 검색 성능 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색 API를 어떤 키워드든 합산 p95 ~1초로 만든다 (현재 "화장실" 17~22초).

**Architecture:** ① 부동산 `searchAll`을 거래 원본 groupBy(277만행)에서 `RealEstateBuildingSummary`(34만행, 인덱스 완비)로 교체하고 순수 카테고리 키워드는 스킵. ② 생활시설 `searchGrouped`가 파서의 categoryToken으로 조회 범위를 1개 카테고리로 좁힘. ③ freeText 경로는 14개 시설 테이블에 ngram FULLTEXT 인덱스를 깔고 `LIKE '%x%'` → `MATCH AGAINST`로 교체. ③은 `prisma db push`가 ngram 인덱스를 보존하는지 선행 검증(Task 4 GATE)을 통과해야 진행.

**Tech Stack:** Express 5 + TypeScript ESM, Prisma 6.19 (fullTextIndex GA), MySQL 8.0.44 (ngram ACTIVE, token_size=2), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-10-search-performance-design.md`

**작업 규칙 (모든 태스크 공통):**
- 브랜치 `perf/search-speed` (Task 0에서 생성, develop 기준)
- Node 20 (`nvm use 20`), 커밋은 명시 경로만 `git add` (절대 `git add -A` 금지)
- 백엔드 ESM — 로컬 import는 `.js` 확장자 필수
- 테스트 실행: `cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run <파일>`

**파일 구조 (전체 변경 지도):**

| 파일 | 역할 |
|---|---|
| `backend/src/services/realEstateService.ts` | T1 스킵 규칙, T2 summary 교체 (searchAll, 727-788행 부근) |
| `backend/src/services/facilityService.ts` | T3 카테고리 스코핑, T7 MATCH 교체 (searchGrouped·search) |
| `backend/src/services/search/fulltextKeyword.ts` | **신규** T6 — FULLTEXT raw 쿼리 헬퍼 (이스케이프/ids/count) |
| `backend/src/services/cityMapping.ts` | T6 — `cityVariantList()` 추가 |
| `backend/src/services/evChargerService.ts` | T8 — keyword LIKE → MATCH |
| `backend/prisma/schema.prisma` | T4(파일럿 1개)·T5 — `@@fulltext` 선언 14모델+WasteSchedule |
| `backend/src/scripts/applyFulltextNgram.ts` | **신규** T5 — ngram 파서 스왑 스크립트 (멱등) |
| `.github/workflows/deploy*.yml` | T5 — db push 다음에 스크립트 호출 1줄 |
| `backend/__tests__/services/realEstateSearchAll.test.ts` | T1·T2 테스트 추가 |
| `backend/__tests__/services/facilitySearchGrouped.test.ts` | T3·T7 테스트 추가 |
| `backend/__tests__/services/search/fulltextKeyword.test.ts` | **신규** T6 테스트 |

---

### Task 0: 브랜치 생성

- [ ] **Step 1: develop 최신화 + 브랜치**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull origin develop
git checkout -b perf/search-speed
```

---

### Task 1: 부동산 searchAll 스킵 규칙 (S1a)

**Files:**
- Modify: `backend/src/services/realEstateService.ts` (searchAll, ~727행)
- Test: `backend/__tests__/services/realEstateSearchAll.test.ts`

**배경:** `searchAll`은 파서로 keyword를 분해한다. "화장실"이면 `nameText`(freeText)가 비고 지역도 없어서 **필터 없이 거래 테이블 전체를 groupBy**(17~22초). 이 경우 DB에 가지 않고 빈 결과를 반환한다.

- [ ] **Step 1: 실패하는 테스트 작성** — `realEstateSearchAll.test.ts`의 describe 블록 안에 추가:

```ts
  it('freeText도 지역도 없으면(순수 카테고리어) DB 접근 없이 빈 categories 반환', async () => {
    // '화장실'은 파서가 categoryToken으로 흡수 → freeText 없음, 지역 없음
    const res = await searchAll('화장실');
    expect(res.categories).toEqual([]);
    expect(mockGroupBy).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('freeText가 있으면(래미안) 검색을 실행한다', async () => {
    const res = await searchAll('래미안');
    expect(res.categories).toHaveLength(6);
  });

  it('지역만 있어도(강남구) 검색을 실행한다', async () => {
    const res = await searchAll('강남구');
    expect(res.categories).toHaveLength(6);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/services/realEstateSearchAll.test.ts`
Expected: FAIL — 첫 테스트에서 `categories`가 6개(빈 결과 아님) + mockGroupBy 호출됨

- [ ] **Step 3: 최소 구현** — `searchAll`에서 `resolveScope` 호출 직후, `where` 구성 **앞**에 삽입:

```ts
  // 순수 카테고리 키워드("화장실")는 부동산 검색 의도가 아님 — DB 접근 없이 종료.
  // freeText 2자 미만(예: "강")도 buildingName 필터를 못 만들어 전체 스캔이 되므로 동일 처리.
  const hasName = !!(nameText && nameText.length >= 2);
  const hasRegion = !!(effectiveCity || effectiveDistrict);
  if (!hasName && !hasRegion) {
    return { categories: [] };
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run __tests__/services/realEstateSearchAll.test.ts`
Expected: PASS (기존 테스트 포함 전부)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/realEstateService.ts backend/__tests__/services/realEstateSearchAll.test.ts
git commit -m "perf(search): 순수 카테고리 키워드는 부동산 검색 스킵"
```

---

### Task 2: searchAll을 RealEstateBuildingSummary로 교체 (S1b)

**Files:**
- Modify: `backend/src/services/realEstateService.ts` (searchAll 본문)
- Test: `backend/__tests__/services/realEstateSearchAll.test.ts` (mock 구조 변경 포함)

**배경:** 현재 타입당 거래 테이블 groupBy(느림) + summary count. summary 테이블이 응답에 필요한 모든 필드(buildingName/bjdCode/city/district/dongName/buildYear/latestDealYear/latestDealMonth/latestPrice/transactionCount)를 갖고 있고 인덱스(`[type, buildingName]`, `[type, city, district, transactionCount]`)가 있다. groupBy를 버리고 summary findMany로 교체한다. **응답 JSON shape는 불변** (dealYear/dealMonth/dealAmount/deposit 키 유지).

- [ ] **Step 1: 실패하는 테스트 작성** — `realEstateSearchAll.test.ts` 수정. 먼저 mock에 `findMany` 추가 (vi.hoisted 블록과 summaryModel):

```ts
const { mockGroupBy, mockCount, mockSummaryFindMany } = vi.hoisted(() => ({
  mockGroupBy: vi.fn(),
  mockCount: vi.fn(),
  mockSummaryFindMany: vi.fn(),
}));
// vi.mock 내부: const summaryModel = { count: mockCount, findMany: mockSummaryFindMany };
// beforeEach에: mockSummaryFindMany.mockResolvedValue([]);
```

describe에 테스트 추가:

```ts
  it('summary 테이블에서 조회하고 거래 테이블 groupBy를 호출하지 않는다', async () => {
    mockSummaryFindMany.mockResolvedValue([{
      buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
      dongName: '역삼동', buildYear: 2010, latestDealYear: 2026, latestDealMonth: 5,
      latestPrice: 150000n, transactionCount: 12,
    }]);
    mockCount.mockResolvedValue(1);
    const res = await searchAll('래미안');
    expect(mockGroupBy).not.toHaveBeenCalled();
    const aptSale = res.categories.find((c) => c.type === 'apt-sale');
    // 응답 shape 불변: dealYear/dealAmount 키 유지, BigInt → Number 직렬화
    expect(aptSale!.items[0]).toMatchObject({
      buildingName: '래미안강남', dongName: '역삼동',
      dealYear: 2026, dealMonth: 5, dealAmount: 150000, deposit: null, transactionCount: 12,
    });
  });

  it('전월세 타입은 latestPrice를 deposit으로 매핑한다', async () => {
    mockSummaryFindMany.mockResolvedValue([{
      buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
      dongName: '역삼동', buildYear: 2010, latestDealYear: 2026, latestDealMonth: 5,
      latestPrice: 50000n, transactionCount: 3,
    }]);
    const res = await searchAll('래미안');
    const aptRent = res.categories.find((c) => c.type === 'apt-rent');
    expect(aptRent!.items[0]).toMatchObject({ dealAmount: null, deposit: 50000 });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/services/realEstateSearchAll.test.ts`
Expected: FAIL — mockGroupBy 호출됨 / items가 summary가 아닌 groupBy 형태

- [ ] **Step 3: 구현** — `searchAll`의 `Promise.all(ALL_TYPES.map(...))` 본문을 교체:

```ts
  const results = await Promise.all(
    ALL_TYPES.map(async (type) => {
      const isSale = isSaleType(type);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summaryWhere: Record<string, any> = { type, ...buildRegionFilter(effectiveCity, effectiveDistrict) };
      if (hasName) {
        summaryWhere.buildingName = { startsWith: nameText };
      }

      // 거래 원본 groupBy(수백만 행) 대신 사전집계 summary(인덱스 커버) 사용
      const [rows, buildingCount] = await Promise.all([
        prisma.realEstateBuildingSummary.findMany({
          where: summaryWhere,
          orderBy: { transactionCount: 'desc' },
          take: 3,
          select: {
            buildingName: true, bjdCode: true, city: true, district: true,
            dongName: true, buildYear: true, latestDealYear: true,
            latestDealMonth: true, latestPrice: true, transactionCount: true,
          },
        }),
        prisma.realEstateBuildingSummary.count({ where: summaryWhere }),
      ]);

      const items = rows.map((r) => serializeRow({
        buildingName: r.buildingName,
        bjdCode: r.bjdCode,
        city: r.city,
        district: r.district,
        dongName: r.dongName,
        buildYear: r.buildYear,
        dealYear: r.latestDealYear,
        dealMonth: r.latestDealMonth,
        dealAmount: isSale ? r.latestPrice : null,
        deposit: !isSale ? r.latestPrice : null,
        transactionCount: r.transactionCount,
      }));

      return { type, count: buildingCount, items };
    })
  );
```

기존 `where`(거래 테이블용)·`getModel(type)`·`priceMax` 변수가 더 이상 searchAll에서 안 쓰이면 함께 삭제한다 (다른 함수에서 쓰는 `getModel` 자체는 유지).

- [ ] **Step 4: 통과 확인 + 타입체크**

Run: `npx vitest run __tests__/services/realEstateSearchAll.test.ts && npx tsc --noEmit`
Expected: PASS / 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/realEstateService.ts backend/__tests__/services/realEstateSearchAll.test.ts
git commit -m "perf(search): searchAll을 거래 groupBy에서 RealEstateBuildingSummary 조회로 교체"
```

---

### Task 3: searchGrouped 파서 카테고리 스코핑 (S2)

**Files:**
- Modify: `backend/src/services/facilityService.ts` (searchGrouped, ~297행)
- Test: `backend/__tests__/services/facilitySearchGrouped.test.ts`

**배경:** "화장실" 검색 시 파서가 `categoryToken='toilet'`을 주는데도 14개 카테고리 전체 + WasteSchedule을 count한다. categoryToken이 있으면 그 카테고리만 조회한다.

- [ ] **Step 1: 실패하는 테스트 작성** — `facilitySearchGrouped.test.ts` describe에 추가:

```ts
  it('categoryToken이 있으면 해당 카테고리만 조회한다 (화장실 → count 1회)', async () => {
    mockCount.mockResolvedValue(5);
    mockFindMany.mockResolvedValue([]);
    await searchGrouped({ keyword: '화장실', grouped: true } as any);
    // toilet 1개 카테고리만 count (wasteSchedule·나머지 13개 스킵)
    expect(mockCount).toHaveBeenCalledTimes(1);
    // ev-charger raw 쿼리도 스킵
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('categoryToken이 trash면 WasteSchedule만 조회한다', async () => {
    mockCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue([]);
    const res = await searchGrouped({ keyword: '쓰레기', grouped: true } as any);
    // trash 경로: wasteSchedule count 1회만 (시설 14개 카테고리 모두 스킵)
    expect(res.parsed.categoryToken).toBe('trash');
    expect(mockCount).toHaveBeenCalledTimes(1);
  });

  it('categoryToken이 없으면(freeText) 기존처럼 전체 카테고리를 조회한다', async () => {
    await searchGrouped({ keyword: '래미안', grouped: true } as any);
    // 13개 일반 카테고리 + wasteSchedule = 14회 count (ev-charger는 raw)
    expect(mockCount.mock.calls.length).toBeGreaterThanOrEqual(14);
  });
```

참고: '쓰레기'가 categoryToken='trash'로 파싱되지 않으면(동의어 맵에 없으면) 두 번째 테스트의 키워드를 `CATEGORY_SYNONYM_MAP`에서 trash로 매핑된 실제 단어로 바꾼다 — `backend/src/services/search/searchCategorySynonyms.ts`에서 확인. trash 매핑이 아예 없으면 해당 테스트는 "categoryToken이 trash가 아닌 일반 카테고리면 WasteSchedule을 조회하지 않는다"로 대체:

```ts
  it('categoryToken이 일반 카테고리면 WasteSchedule을 조회하지 않는다', async () => {
    mockCount.mockResolvedValue(5);
    await searchGrouped({ keyword: '화장실', grouped: true } as any);
    expect(mockCount).toHaveBeenCalledTimes(1); // toilet만, waste 미포함
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/services/facilitySearchGrouped.test.ts`
Expected: FAIL — count가 14회+ 호출됨

- [ ] **Step 3: 구현** — `searchGrouped`에서:

(a) Phase 1의 `ALL_CATEGORIES.map` 을 스코핑 목록으로 교체:

```ts
  // 파서가 카테고리를 특정하면("화장실"→toilet) 그 카테고리만 조회 — 나머지 13개 테이블 스킵
  const scopedCategories: FacilityCategory[] = parsed.categoryToken && parsed.categoryToken !== 'trash'
    ? ALL_CATEGORIES.filter((c) => c === parsed.categoryToken)
    : parsed.categoryToken === 'trash'
      ? []
      : ALL_CATEGORIES;

  const countResults = await Promise.all(
    scopedCategories.map(async (cat) => {
      // ... 기존 본문 그대로 ...
```

(b) trash(WasteSchedule) 블록 조건 추가 — 기존 `const trashWhere` 위에:

```ts
  // categoryToken이 trash이거나 미특정일 때만 WasteSchedule 조회
  const shouldSearchTrash = !parsed.categoryToken || parsed.categoryToken === 'trash';
```

기존 trash 조회~push 블록 전체를 `if (shouldSearchTrash) { ... }`로 감싼다 (`trashWhere` 선언부터 `categories.push` 닫는 중괄호까지).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run __tests__/services/facilitySearchGrouped.test.ts && npx vitest run __tests__/services/facilityService.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/facilityService.ts backend/__tests__/services/facilitySearchGrouped.test.ts
git commit -m "perf(search): searchGrouped가 파서 categoryToken으로 조회 범위 축소"
```

---

### Task 4: [GATE] ngram FULLTEXT × prisma db push 보존 검증

**Files:**
- Modify: `backend/prisma/schema.prisma` (Toilet 모델에만 파일럿 적용)

**배경:** Prisma 스키마는 `WITH PARSER ngram`을 표현하지 못한다. 전략 = 스키마에 `@@fulltext` 선언(push가 인덱스 존재를 인식) + 실제 인덱스는 ngram 파서로 수동 생성. **db push가 수동 ngram 인덱스를 드랍/재생성하지 않는지** Toilet 테이블 1개로 검증한다. 이 게이트가 실패하면 **Task 5~8을 중단**하고 사용자에게 보고한다 (spec: S3 보류, S1+S2만 1차 출시).

- [ ] **Step 1: Toilet 모델에 @@fulltext 선언** — `schema.prisma`의 `model Toilet` 블록 끝(기존 `@@index` 줄들 아래)에 추가:

```prisma
  @@fulltext([name, address, roadAddress])
```

- [ ] **Step 2: db push로 Prisma 기본 인덱스 생성 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && nvm use 20 && npm run db:push
docker exec $(docker ps -qf "name=mysql" | head -1) mysql -uilsangkit -pilsangkit123 ilsangkit \
  -e "SHOW CREATE TABLE Toilet\G" | grep -i fulltext
```

Expected: `FULLTEXT KEY \`Toilet_name_address_roadAddress_idx\` (\`name\`,\`address\`,\`roadAddress\`)` — **파서 표기 없음**(기본 파서). 인덱스명을 기록해 둔다 (이후 스크립트가 이 이름을 그대로 써야 함).

- [ ] **Step 3: ngram 파서로 스왑**

```bash
docker exec $(docker ps -qf "name=mysql" | head -1) mysql -uilsangkit -pilsangkit123 ilsangkit -e "
ALTER TABLE Toilet DROP INDEX Toilet_name_address_roadAddress_idx;
ALTER TABLE Toilet ADD FULLTEXT INDEX Toilet_name_address_roadAddress_idx (name, address, roadAddress) WITH PARSER ngram;"
docker exec $(docker ps -qf "name=mysql" | head -1) mysql -uilsangkit -pilsangkit123 ilsangkit \
  -e "SHOW CREATE TABLE Toilet\G" | grep -i ngram
```

Expected: `/*!50100 WITH PARSER \`ngram\` */` 포함된 FULLTEXT KEY 출력

- [ ] **Step 4: db push 재실행 → 보존 검증 (게이트 판정)**

```bash
npm run db:push
docker exec $(docker ps -qf "name=mysql" | head -1) mysql -uilsangkit -pilsangkit123 ilsangkit \
  -e "SHOW CREATE TABLE Toilet\G" | grep -i ngram
```

Expected: **여전히 `WITH PARSER ngram` 출력** → 게이트 통과, Task 5 진행.
출력이 사라졌으면(기본 파서로 재생성) → **게이트 실패. 즉시 중단**: Toilet의 `@@fulltext` 줄을 되돌리고(`git checkout backend/prisma/schema.prisma`) 컨트롤러에게 "GATE FAILED: db push가 ngram 인덱스를 재생성함"을 보고. Task 5~8 건너뛰고 Task 9(검증)는 S1+S2 범위로만 수행.

- [ ] **Step 5: 동작 스모크 (검색이 실제로 되는지)**

```bash
docker exec $(docker ps -qf "name=mysql" | head -1) mysql -uilsangkit -pilsangkit123 ilsangkit \
  -e "SELECT COUNT(*) FROM Toilet WHERE MATCH(name, address, roadAddress) AGAINST ('\"강남\"' IN BOOLEAN MODE);"
```

Expected: 0보다 큰 카운트 (강남 소재 화장실 존재). 0이면 인덱스 빌드 직후 지연 가능 — `OPTIMIZE TABLE Toilet;` 후 재시도.

- [ ] **Step 6: 커밋** (게이트 통과 시)

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(search): Toilet에 fulltext 선언 — ngram×db push 보존 게이트 통과"
```

---

### Task 5: 전체 테이블 @@fulltext + ngram 스왑 스크립트 + 배포 연동 (S3a)

**Files:**
- Modify: `backend/prisma/schema.prisma` (13개 모델 + WasteSchedule)
- Create: `backend/src/scripts/applyFulltextNgram.ts`
- Modify: `.github/workflows/` 의 배포 워크플로우 (db push 다음 1줄)
- Modify: `backend/package.json` (스크립트 등록)

- [ ] **Step 1: 나머지 모델에 @@fulltext 선언** — `schema.prisma`에서 아래 13개 모델 각각의 블록 끝에 `@@fulltext([name, address, roadAddress])` 추가 (Toilet은 Task 4에서 완료):

`Wifi, Clothes, Park, School, Childcare, Market, Parking, Aed, Library, EvCharger, Sports, Hospital, Pharmacy`

WasteSchedule에는 필드가 다르므로:

```prisma
  @@fulltext([targetRegion, emissionPlace])
```

- [ ] **Step 2: ngram 스왑 스크립트 작성** — Create `backend/src/scripts/applyFulltextNgram.ts`:

```ts
// FULLTEXT 인덱스를 ngram 파서로 스왑하는 멱등 스크립트.
// prisma db push는 @@fulltext를 기본 파서로 생성한다 — 한국어 부분일치는 ngram이 필요하므로
// push 후 이 스크립트로 파서를 교체한다. 이미 ngram이면 건너뛴다.
// 실행: npx tsx src/scripts/applyFulltextNgram.ts
import { prisma } from '../lib/prisma.js';

const TARGETS: Array<{ table: string; index: string; columns: string }> = [
  ...['Toilet', 'Wifi', 'Clothes', 'Park', 'School', 'Childcare', 'Market', 'Parking',
      'Aed', 'Library', 'EvCharger', 'Sports', 'Hospital', 'Pharmacy'].map((table) => ({
    table,
    index: `${table}_name_address_roadAddress_idx`,
    columns: 'name, address, roadAddress',
  })),
  {
    table: 'WasteSchedule',
    index: 'WasteSchedule_targetRegion_emissionPlace_idx',
    columns: 'targetRegion, emissionPlace',
  },
];

async function main() {
  const [{ plugin }] = await prisma.$queryRawUnsafe<Array<{ plugin: string }>>(
    "SELECT COUNT(*) AS plugin FROM information_schema.PLUGINS WHERE PLUGIN_NAME = 'ngram' AND PLUGIN_STATUS = 'ACTIVE'",
  );
  if (Number(plugin) === 0) {
    console.error('[fulltext-ngram] ngram 플러그인이 비활성 — 중단 (검색은 LIKE 폴백으로 동작)');
    process.exit(1);
  }

  for (const t of TARGETS) {
    const rows = await prisma.$queryRawUnsafe<Array<{ ddl: string }>>(
      `SHOW CREATE TABLE \`${t.table}\``,
    ).then((r) => r as unknown as Array<Record<string, string>>);
    const ddl = Object.values(rows[0]).join(' ');
    const hasIndex = ddl.includes(`\`${t.index}\``);
    const hasNgram = hasIndex && new RegExp(`\`${t.index}\`[^\\n]*ngram`).test(ddl);

    if (hasNgram) {
      console.log(`[fulltext-ngram] ${t.table}: 이미 ngram — 스킵`);
      continue;
    }
    if (hasIndex) {
      console.log(`[fulltext-ngram] ${t.table}: 기본 파서 인덱스 드랍`);
      await prisma.$executeRawUnsafe(`ALTER TABLE \`${t.table}\` DROP INDEX \`${t.index}\``);
    }
    console.log(`[fulltext-ngram] ${t.table}: ngram 인덱스 생성 중...`);
    await prisma.$executeRawUnsafe(
      `ALTER TABLE \`${t.table}\` ADD FULLTEXT INDEX \`${t.index}\` (${t.columns}) WITH PARSER ngram`,
    );
  }
  console.log('[fulltext-ngram] 완료');
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 3: package.json 스크립트 등록** — `backend/package.json`의 scripts에 추가:

```json
    "db:fulltext": "tsx src/scripts/applyFulltextNgram.ts",
```

- [ ] **Step 4: 로컬 적용 + 검증**

```bash
npm run db:push && npm run db:fulltext
docker exec $(docker ps -qf "name=mysql" | head -1) mysql -uilsangkit -pilsangkit123 ilsangkit -e "
SELECT TABLE_NAME, INDEX_NAME FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA='ilsangkit' AND INDEX_TYPE='FULLTEXT' GROUP BY TABLE_NAME, INDEX_NAME;"
```

Expected: 15개 테이블(시설 14 + WasteSchedule)의 FULLTEXT 인덱스 목록. 스크립트 재실행 시 전부 "이미 ngram — 스킵" 출력(멱등 확인).

- [ ] **Step 5: 배포 워크플로우에 1줄 추가** — `.github/workflows/` 안에서 `prisma db push`(또는 `db:push`)를 실행하는 배포 워크플로우 파일을 찾아(`grep -rn "db push\|db:push" .github/workflows/`), 서버에서 push가 실행되는 **바로 다음 줄**에 동일한 실행 컨텍스트로 추가:

```
npm run db:fulltext
```

(들여쓰기·실행 방식은 해당 워크플로우의 기존 db push 줄과 동일하게 맞춘다. 운영 MySQL에 ngram이 없으면 스크립트가 exit 1로 배포를 멈추므로 — **운영 ngram 사전 확인이 안 된 상태라면 `|| echo "[fulltext-ngram] skipped"`를 붙여 비차단으로 추가**한다. 비차단 시 검색은 Task 6의 LIKE 폴백으로 동작.)

- [ ] **Step 6: 커밋**

```bash
git add backend/prisma/schema.prisma backend/src/scripts/applyFulltextNgram.ts backend/package.json .github/workflows/
git commit -m "feat(search): 시설 14테이블+WasteSchedule fulltext ngram 인덱스 + 배포 연동"
```

---

### Task 6: fulltextKeyword 헬퍼 + cityVariantList (S3b)

**Files:**
- Create: `backend/src/services/search/fulltextKeyword.ts`
- Modify: `backend/src/services/cityMapping.ts`
- Test: `backend/__tests__/services/search/fulltextKeyword.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성** — Create `backend/__tests__/services/search/fulltextKeyword.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRawUnsafe } = vi.hoisted(() => ({ mockQueryRawUnsafe: vi.fn() }));
vi.mock('../../../src/lib/prisma.js', () => {
  const prismaClient = { $queryRawUnsafe: mockQueryRawUnsafe };
  return { default: prismaClient, prisma: prismaClient };
});

import {
  canUseFulltext, toBooleanPhrase, fulltextIds, fulltextCount, FULLTEXT_TABLES,
} from '../../../src/services/search/fulltextKeyword.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('canUseFulltext', () => {
  it('2자 이상이면 true, 미만/빈값이면 false (ngram_token_size=2)', () => {
    expect(canUseFulltext('래미안')).toBe(true);
    expect(canUseFulltext('강')).toBe(false);
    expect(canUseFulltext('')).toBe(false);
    expect(canUseFulltext(undefined)).toBe(false);
  });
});

describe('toBooleanPhrase', () => {
  it('BOOLEAN MODE 연산자를 제거하고 구문 검색으로 감싼다', () => {
    expect(toBooleanPhrase('래미안')).toBe('"래미안"');
    expect(toBooleanPhrase('강남+화장실*')).toBe('"강남 화장실"');
    expect(toBooleanPhrase('  "test"  ')).toBe('"test"');
  });
});

describe('fulltextIds', () => {
  it('MATCH AGAINST 쿼리로 id 목록을 반환한다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([{ id: 1 }, { id: 7 }]);
    const ids = await fulltextIds('Toilet', '래미안', {}, 3);
    expect(ids).toEqual([1, 7]);
    const [sql, ...params] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('MATCH(name, address, roadAddress) AGAINST (? IN BOOLEAN MODE)');
    expect(params[0]).toBe('"래미안"');
  });

  it('지역 필터가 있으면 city IN / district 조건을 붙인다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    await fulltextIds('Toilet', '래미안', { cityVariants: ['서울특별시', '서울'], district: '강남구' }, 3);
    const [sql, ...params] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('city IN (?, ?)');
    expect(sql).toContain('district = ?');
    expect(params).toContain('강남구');
  });

  it('화이트리스트에 없는 테이블이면 throw', async () => {
    await expect(fulltextIds('Users; DROP', '래미안', {}, 3)).rejects.toThrow();
  });
});

describe('fulltextCount', () => {
  it('COUNT 결과(BigInt)를 number로 반환한다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([{ cnt: 42n }]);
    const count = await fulltextCount('Toilet', '래미안', {});
    expect(count).toBe(42);
  });
});

describe('FULLTEXT_TABLES', () => {
  it('13개 일반 시설 카테고리를 커버한다 (ev-charger·trash는 별도 경로)', () => {
    expect(Object.keys(FULLTEXT_TABLES)).toHaveLength(13);
    expect(FULLTEXT_TABLES.toilet).toBe('Toilet');
  });
});
```

cityVariantList 테스트 — 기존 cityMapping 테스트 파일이 있으면 거기에, 없으면 위 파일에 추가:

```ts
import { cityVariantList } from '../../../src/services/cityMapping.js';

describe('cityVariantList', () => {
  it('축약/정식 양쪽 variant를 반환한다', () => {
    const v = cityVariantList('서울');
    expect(v).toContain('서울');
    expect(v).toContain('서울특별시');
  });
  it('미등록 도시는 그대로 1개', () => {
    expect(cityVariantList('미지의도시')).toEqual(['미지의도시']);
  });
  it('없으면 빈 배열', () => {
    expect(cityVariantList(undefined)).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/services/search/fulltextKeyword.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: cityVariantList 구현** — `backend/src/services/cityMapping.ts`의 `buildRegionFilter` 아래에 추가 (같은 variant 로직 재사용):

```ts
/**
 * city의 축약/정식 variant 목록 (raw SQL `IN (?)` 용).
 * buildRegionFilter와 동일 로직 — Prisma where가 아닌 배열 형태가 필요할 때 사용.
 */
export function cityVariantList(city?: string): string[] {
  if (!city) return [];
  const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city];
  if (!slug) return [city];
  return [...new Set([city, CITY_SLUG_TO_FULL[slug], CITY_SLUG_TO_SHORT[slug]].filter(Boolean))] as string[];
}
```

- [ ] **Step 4: fulltextKeyword 구현** — Create `backend/src/services/search/fulltextKeyword.ts`:

```ts
// FULLTEXT(ngram) 키워드 검색 헬퍼.
// LIKE '%kw%' 풀스캔을 MATCH AGAINST 인덱스 검색으로 대체한다.
// 패턴: raw로 id/count만 조회 → 호출부가 findMany({ id: { in } })로 기존 select/매핑 재사용.
import { prisma } from '../../lib/prisma.js';

/** 카테고리 slug → MySQL 테이블명 (raw 쿼리 테이블 화이트리스트) */
export const FULLTEXT_TABLES: Record<string, string> = {
  toilet: 'Toilet', wifi: 'Wifi', clothes: 'Clothes', parking: 'Parking',
  aed: 'Aed', library: 'Library', hospital: 'Hospital', pharmacy: 'Pharmacy',
  park: 'Park', school: 'School', market: 'Market', childcare: 'Childcare',
  sports: 'Sports',
};

const ALLOWED_TABLES = new Set([...Object.values(FULLTEXT_TABLES), 'WasteSchedule', 'EvCharger']);
const MIN_FT_LENGTH = 2; // ngram_token_size=2 — 1자는 매칭 불가, 호출부가 LIKE 폴백

export function canUseFulltext(keyword?: string | null): keyword is string {
  return !!keyword && keyword.trim().length >= MIN_FT_LENGTH;
}

/** BOOLEAN MODE 연산자 무력화 + 구문(phrase) 검색 고정 */
export function toBooleanPhrase(keyword: string): string {
  const cleaned = keyword.replace(/["+\-><()~*@]/g, ' ').trim().replace(/\s+/g, ' ');
  return `"${cleaned}"`;
}

export interface FtRegion { cityVariants?: string[]; district?: string }

function assertTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`fulltext 미지원 테이블: ${table}`);
}

function regionClause(region: FtRegion): { sql: string; values: unknown[] } {
  const parts: string[] = [];
  const values: unknown[] = [];
  if (region.cityVariants && region.cityVariants.length > 0) {
    parts.push(`city IN (${region.cityVariants.map(() => '?').join(', ')})`);
    values.push(...region.cityVariants);
  }
  if (region.district) {
    parts.push('district = ?');
    values.push(region.district);
  }
  return { sql: parts.length ? ` AND ${parts.join(' AND ')}` : '', values };
}

/** MATCH 매칭 id 목록 (name 순 정렬 — 페이지네이션 결정성 확보) */
export async function fulltextIds(
  table: string, keyword: string, region: FtRegion, limit: number, offset = 0,
): Promise<number[]> {
  assertTable(table);
  const { sql, values } = regionClause(region);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM \`${table}\` WHERE MATCH(name, address, roadAddress) AGAINST (? IN BOOLEAN MODE)${sql} ORDER BY name ASC LIMIT ? OFFSET ?`,
    toBooleanPhrase(keyword), ...values, limit, offset,
  );
  return rows.map((r) => Number(r.id));
}

export async function fulltextCount(table: string, keyword: string, region: FtRegion): Promise<number> {
  assertTable(table);
  const { sql, values } = regionClause(region);
  const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
    `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE MATCH(name, address, roadAddress) AGAINST (? IN BOOLEAN MODE)${sql}`,
    toBooleanPhrase(keyword), ...values,
  );
  return Number(rows[0]?.cnt ?? 0);
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run __tests__/services/search/fulltextKeyword.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add backend/src/services/search/fulltextKeyword.ts backend/src/services/cityMapping.ts backend/__tests__/services/search/fulltextKeyword.test.ts
git commit -m "feat(search): fulltext ngram 검색 헬퍼 + cityVariantList"
```

---

### Task 7: searchGrouped·flat search()의 키워드 경로 MATCH 교체 (S3c)

**Files:**
- Modify: `backend/src/services/facilityService.ts`
- Test: `backend/__tests__/services/facilitySearchGrouped.test.ts`

**배경:** freeText가 있을 때(`nameText`) 13개 일반 카테고리의 count/findMany가 `LIKE '%x%'`를 탄다. 이를 `fulltextCount`/`fulltextIds`로 교체한다. **2자 미만은 기존 LIKE 유지**(`canUseFulltext` 폴백). trash·ev-charger는 Task 8.

- [ ] **Step 1: 실패하는 테스트 작성** — `facilitySearchGrouped.test.ts`에 fulltext 헬퍼 mock 추가 (파일 상단 vi.mock 블록들 옆):

```ts
const { mockFtIds, mockFtCount } = vi.hoisted(() => ({
  mockFtIds: vi.fn(), mockFtCount: vi.fn(),
}));
vi.mock('../../src/services/search/fulltextKeyword.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/fulltextKeyword.js');
  return { ...actual, fulltextIds: mockFtIds, fulltextCount: mockFtCount };
});
// beforeEach에: mockFtIds.mockResolvedValue([]); mockFtCount.mockResolvedValue(0);
```

describe에 추가:

```ts
  it('freeText 2자 이상이면 LIKE count 대신 fulltextCount를 사용한다', async () => {
    mockFtCount.mockResolvedValue(3);
    mockFtIds.mockResolvedValue([1, 2, 3]);
    mockFindMany.mockResolvedValue([]);
    await searchGrouped({ keyword: '래미안', grouped: true } as any);
    expect(mockFtCount).toHaveBeenCalled();
    // 일반 카테고리의 Prisma count(LIKE)는 호출되지 않음 (waste는 Task 8 전까지 기존 경로)
    // findMany는 id in 형태로 호출됨
    const idInCall = mockFindMany.mock.calls.find(
      (c) => c[0]?.where?.id?.in !== undefined,
    );
    expect(idInCall).toBeTruthy();
  });

  it('1자 키워드는 기존 LIKE 경로를 유지한다', async () => {
    await searchGrouped({ keyword: '강', grouped: true } as any);
    expect(mockFtCount).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/services/facilitySearchGrouped.test.ts`
Expected: FAIL — fulltextCount 미호출

- [ ] **Step 3: searchGrouped 구현** — `facilityService.ts` 상단 import 추가:

```ts
import { FULLTEXT_TABLES, canUseFulltext, fulltextIds, fulltextCount } from './search/fulltextKeyword.js';
import { cityVariantList } from './cityMapping.js';
```

`searchGrouped` 안에서 `where` 구성 아래에:

```ts
  const useFt = canUseFulltext(nameText);
  const ftRegion = { cityVariants: cityVariantList(effectiveCity), district: effectiveDistrict };
```

Phase 1 map 본문의 일반 카테고리 분기 교체:

```ts
      const model = CATEGORY_REGISTRY[cat].model();
      if (useFt && FULLTEXT_TABLES[cat]) {
        const count = await fulltextCount(FULLTEXT_TABLES[cat], nameText!, ftRegion);
        return { category: cat, count, items: null };
      }
      const count = await model.count({ where });
      return { category: cat, count, items: null };
```

Phase 2 map의 findMany 분기 교체:

```ts
      const model = CATEGORY_REGISTRY[cr.category].model();
      let records;
      if (useFt && FULLTEXT_TABLES[cr.category]) {
        const ids = await fulltextIds(FULLTEXT_TABLES[cr.category], nameText!, ftRegion, 3);
        records = await model.findMany({ where: { id: { in: ids } }, select: buildListSelect(cr.category) });
      } else {
        records = await model.findMany({ where, take: 3, select: buildListSelect(cr.category) });
      }
```

- [ ] **Step 4: flat search() 단일 카테고리 경로 교체** — `search()`의 `if (category)` 블록을 교체 (ev-charger는 이 블록 위에서 이미 분기됨을 확인하고, 아니라면 `FULLTEXT_TABLES[category]` 가드가 자연 제외함):

```ts
  if (category) {
    const model = CATEGORY_REGISTRY[category as FacilityCategory].model();
    if (canUseFulltext(keyword) && FULLTEXT_TABLES[category] && !departments?.length) {
      // FULLTEXT 경로: 키워드 매칭 id를 인덱스로 추출 후 기존 select/매핑 재사용
      const ftRegion = { cityVariants: cityVariantList(city), district };
      const [ids, total] = await Promise.all([
        fulltextIds(FULLTEXT_TABLES[category], keyword!, ftRegion, limit, skip),
        fulltextCount(FULLTEXT_TABLES[category], keyword!, ftRegion),
      ]);
      const records = await model.findMany({
        where: { id: { in: ids } },
        select: buildListSelect(category as FacilityCategory),
      });
      // fulltextIds의 name ASC 순서 보존 (findMany in은 순서 비보장)
      const order = new Map(ids.map((id, i) => [id, i]));
      records.sort((a: any, b: any) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)); // eslint-disable-line @typescript-eslint/no-explicit-any
      const items = records.map((r: any) => toFacilityItem(r, category as FacilityCategory)); // eslint-disable-line @typescript-eslint/no-explicit-any
      return { items, total, page, totalPages: Math.ceil(total / limit) };
    }
    // 기존 LIKE 경로 (키워드 없음 / 1자 / 진료과목 필터 동반 시)
    const [records, total] = await Promise.all([
      model.findMany({ where, skip, take: limit, orderBy, select: buildListSelect(category as FacilityCategory) }),
      model.count({ where }),
    ]);
    const items = records.map((r: any) => toFacilityItem(r, category as FacilityCategory)); // eslint-disable-line @typescript-eslint/no-explicit-any
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }
```

주의: FULLTEXT 경로는 정렬이 `name ASC` 고정(raw 쿼리). `sort` 파라미터가 다른 값이면 기존 경로 유지가 안전 — 위 조건에 `&& (!sort || sort === 'name')`을 추가한다.

- [ ] **Step 5: 통과 확인 (관련 테스트 전부)**

Run: `npx vitest run __tests__/services/facilitySearchGrouped.test.ts __tests__/services/facilityService.test.ts __tests__/routes/ && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add backend/src/services/facilityService.ts backend/__tests__/services/facilitySearchGrouped.test.ts
git commit -m "perf(search): 시설 키워드 검색을 LIKE 풀스캔에서 fulltext MATCH로 교체"
```

---

### Task 8: EvCharger·WasteSchedule 키워드 경로 MATCH 교체 (S3d)

**Files:**
- Modify: `backend/src/services/evChargerService.ts` (evChargerStationSearch)
- Modify: `backend/src/services/facilityService.ts` (searchGrouped trash 블록)
- Test: 기존 `__tests__/services/facilitySearchGrouped.test.ts` + `__tests__/services/evChargerStatus.test.ts` 회귀 확인

- [ ] **Step 1: EvCharger — keyword 조건 교체** — `evChargerStationSearch`의 keyword 분기:

```ts
  if (keyword) {
    if (canUseFulltext(keyword)) {
      conditions.push('MATCH(name, address, roadAddress) AGAINST (? IN BOOLEAN MODE)');
      values.push(toBooleanPhrase(keyword));
    } else {
      conditions.push('(name LIKE ? OR address LIKE ? OR roadAddress LIKE ?)');
      values.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }
  }
```

import 추가: `import { canUseFulltext, toBooleanPhrase } from './search/fulltextKeyword.js';`

- [ ] **Step 2: WasteSchedule(trash) — searchGrouped trash 블록 교체** — `trashWhere.OR = [...]` 부분:

```ts
  if (nameText) {
    if (canUseFulltext(nameText)) {
      // FULLTEXT 경로: id를 먼저 뽑아 where in으로 결합 (region 필터는 trashWhere에 이미 있음)
      const trashIds = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT id FROM \`WasteSchedule\` WHERE MATCH(targetRegion, emissionPlace) AGAINST (? IN BOOLEAN MODE) LIMIT 500`,
        toBooleanPhrase(nameText),
      );
      trashWhere.id = { in: trashIds.map((r) => Number(r.id)) };
    } else {
      trashWhere.OR = [
        { targetRegion: { contains: nameText } },
        { emissionPlace: { contains: nameText } },
      ];
    }
  }
```

(WasteSchedule은 컬럼이 달라 공용 `fulltextIds`(name/address/roadAddress 고정)를 못 쓴다 — 인라인 raw. LIMIT 500은 in-절 폭주 방지 안전캡.)

- [ ] **Step 3: 회귀 테스트 추가** — `facilitySearchGrouped.test.ts`:

```ts
  it('trash 키워드 검색이 fulltext id 경로로 동작한다', async () => {
    mockQueryRawUnsafe.mockReset();
    mockQueryRawUnsafe.mockResolvedValue([{ id: 11 }]);
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([]);
    // '서초동 분리수거' 같은 freeText — categoryToken 없음 → trash 블록 진입
    await searchGrouped({ keyword: '서초동', grouped: true } as any);
    const matchCall = mockQueryRawUnsafe.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('MATCH(targetRegion, emissionPlace)'),
    );
    expect(matchCall).toBeTruthy();
  });
```

주의: 이 테스트의 mockQueryRawUnsafe는 ev-charger 경로와 공유된다 — 기존 beforeEach의 ev-charger용 mockResolvedValueOnce 시퀀스와 충돌하면 이 테스트 내에서 `mockReset()` 후 ev-charger 호출 순서에 맞게 재설정한다 (ev-charger도 freeText 경로에서 호출되므로: 1번째 호출=ev-charger count, 2번째=ev-charger rows, 이후=trash MATCH — 실제 호출 순서는 실행해 보고 맞춘다).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run __tests__/services/facilitySearchGrouped.test.ts __tests__/services/evChargerStatus.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/evChargerService.ts backend/src/services/facilityService.ts backend/__tests__/services/facilitySearchGrouped.test.ts
git commit -m "perf(search): EvCharger·WasteSchedule 키워드 검색 fulltext MATCH 적용"
```

---

### Task 9: 전체 검증 + 성능 실측 + PR (S4)

- [ ] **Step 1: 백엔드 전체 테스트 + 린트 + 타입체크**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && nvm use 20
npm run test && npm run lint && npx tsc --noEmit
```

Expected: 전부 green (기존 1353+ 신규 테스트)

- [ ] **Step 2: dev 서버 띄우고 성능 실측** — 백엔드 dev 서버 실행(`npm run dev`, 백그라운드) 후 워밍업 1회 + 3회 측정:

```bash
for kw in 강남 화장실 래미안; do
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$kw")
  for i in 0 1 2 3; do
    fac=$(curl -s -o /dev/null -w "%{time_total}" -X POST "http://localhost:8000/api/facilities/search" -H "Content-Type: application/json" -d "{\"keyword\":\"$kw\",\"grouped\":true}")
    re=$(curl -s -o /dev/null -w "%{time_total}" "http://localhost:8000/api/real-estate/search?keyword=$enc")
    [ $i -gt 0 ] && echo "$kw run$i → fac ${fac}s | re ${re}s"
  done
done
```

Expected (spec S4 기준):
- `화장실`: facilities < 0.3s, real-estate ≈ 0.0Xs (스킵)
- `래미안`: 합산 < 1s
- `강남`: 합산 < 0.5s

기준 미달 시: 해당 쿼리 `EXPLAIN`으로 인덱스 사용 확인 후 수정. **before 수치는 spec 1절 표를 PR 본문에 인용**.

- [ ] **Step 3: 검색 결과 동등성 스모크** — FULLTEXT 전환으로 결과가 비합리적으로 달라지지 않았는지:

```bash
curl -s -X POST "http://localhost:8000/api/facilities/search" -H "Content-Type: application/json" -d '{"keyword":"래미안","grouped":true}' | python3 -c "import sys,json; d=json.load(sys.stdin); print('total:', d['data']['totalCount']); [print(c['category'], c['count']) for c in d['data']['categories'][:5]]"
curl -s "http://localhost:8000/api/search/suggest?q=%EB%9E%98%EB%AF%B8%EC%95%88" | head -c 300
```

Expected: totalCount > 0, 카테고리 분포가 상식적(래미안 → 주차장/어린이집 등 단지 부속시설). suggest는 무관 경로지만 회귀 없음 확인.

- [ ] **Step 4: 프론트 회귀 (응답 shape 불변 확인)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && nvm use 20 && npm run test
```

Expected: 전부 green (프론트 무수정 원칙 — 실패 시 백엔드 shape 회귀를 의심)

- [ ] **Step 5: push + PR 생성**

```bash
git push -u origin perf/search-speed
gh pr create --base develop --head perf/search-speed --title "perf(search): 통합 검색 성능 개선 — 화장실 22초→무스킵, LIKE→fulltext" --body "(spec의 문제/실측 before-after 표 + S1~S3 요약 + 게이트 결과 + 운영 배포 시 db:fulltext 실행 안내 포함)"
```

PR 본문에 반드시 포함: ① before/after 실측 표 ② Task 4 게이트 결과(ngram 보존 여부) ③ 운영 첫 배포 후 `npm run db:fulltext`가 서버에서 실행되는지 확인하는 체크리스트 ④ 운영 ngram 미지원 시 폴백 동작(LIKE 유지) 설명.

---

## Self-Review 체크 결과

- **Spec 커버리지**: S1a→T1, S1b→T2, S2→T3, S3 게이트→T4, S3a→T5, S3b→T6, S3c→T7, S3d→T8, S4→T9. 누락 없음. flat search()의 무(無)카테고리 경로는 spec S3.4가 단일 카테고리로 한정 — 범위 밖 명시.
- **Placeholder**: 모든 코드 스텝에 실제 코드 포함. T3 Step 1의 '쓰레기' 동의어 존재 여부만 실행 시 확인 분기 제공(대체 테스트 코드 포함).
- **타입 일관성**: `FtRegion`/`canUseFulltext`/`toBooleanPhrase`/`fulltextIds`/`fulltextCount`/`FULLTEXT_TABLES`/`cityVariantList` 명칭 T6 정의 = T7·T8 사용 일치. `hasName`은 T1 정의 = T2 사용 일치.
