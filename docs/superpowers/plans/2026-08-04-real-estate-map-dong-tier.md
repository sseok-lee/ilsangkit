# 부동산 지도 동(洞) 단계 추가 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도 줌 단계를 시/도 → 구·군 → 건물 3계층에서 시/도 → 구·군 → **동** → 건물 4계층으로 늘린다.

**Architecture:** 백엔드는 기존 지역 집계(`buildRegions`)에 `dong` 분기를 더한다 — 좌표만 출처가 다르다(`Region` 테이블에 동이 없어 거래 좌표 평균을 쓴다). 캐시·bbox 필터·라우트는 구조를 그대로 재사용한다. 프론트는 `Granularity` 에 `'dong'` 을 더하고 목록에 동 행을 그린다. 동 행만 링크가 아니라 버튼이다(동 페이지가 없다).

**Tech Stack:** Express 5 + TypeScript(ESM) · Prisma/MySQL 8 · Nuxt 3 + Vue 3 · Vitest

**설계 문서:** [docs/superpowers/specs/2026-08-04-real-estate-map-dong-tier-design.md](../specs/2026-08-04-real-estate-map-dong-tier-design.md)

**브랜치:** `feat/real-estate-map-dong-tier` (base = `develop`, PR #712 머지 이후)

## Global Constraints

- **Node 20 필수.** 시스템 기본은 v25.5.0 이고 그대로 돌리면 무관한 프론트 테스트 27건이 거짓 실패한다. **`nvm use 20` 은 무효** — Bash 도구는 호출마다 독립 셸이라 셸 상태가 유지되지 않는다. 테스트·린트 명령마다 앞에 붙인다:
  ```bash
  export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
  ```
  `node --version` 이 `v20.19.5` 인지 확인하고 진행한다.
- **테스트는 각 패키지 디렉터리에서 돌린다.** 저장소 루트에서 `npx vitest run` 하면 백엔드까지 긁어 수백 건이 거짓 실패한다. 프론트는 `frontend/`, 백엔드는 `backend/`.
- **Backend 는 ESM** — 모든 로컬 import 에 `.js` 확장자 필수.
- **날짜 조건은 `recentMonthsCondition()` 만 쓴다.** 문자열로 `STR_TO_DATE` 를 조립하면 인덱스를 못 타 운영에서 33초가 걸린 이력이 있다.
- **bbox 를 캐시 키에 넣지 않는다.** 뷰포트는 무한하므로 캐시가 폭발한다. 전국 1벌을 캐시하고 반환 직전 메모리 필터.
- **URL·크롤 경로를 바꾸지 않는다.** 필터바 6개 `href` 는 `apt-rent`·`villa-rent`·`offitel-rent` 의 유일한 내부 링크이고, `SIDO_CHIPS` 16개 링크는 이 페이지의 핵심 SSR 콘텐츠다.
- **좌표에 `0` 을 "없음" 의미로 쓰지 않는다.** `(0,0)` 은 기니만 앞바다의 유효한 좌표라 지도가 실제로 그리로 이동한 사고가 있었다. 없으면 `null`.
- **`useKakaoMap` 을 수정하지 않는다.** 시설상세·건물상세·공매·청약·지하철 5개 페이지가 함께 쓴다.
- 커밋 전 관련 테스트를 돌린다. `main` 에 직접 커밋하지 않는다.
- `docs/` 는 `.gitignore` 대상 — 문서 커밋 시 `git add -f <파일>` 로 개별 지정한다.

---

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `backend/src/schemas/realEstateMap.ts` | 레벨→단위 해석, 히스테리시스 | 수정 (Task 1) |
| `backend/src/services/realEstateMapService.ts` | 지역 집계 쿼리, 캐시, bbox 필터 | 수정 (Task 2) |
| `frontend/types/realEstateMap.ts` | 공유 타입 | 수정 (Task 3) |
| `frontend/composables/useRealEstateMap.ts` | `itemKey` 고유성 | 수정 (Task 3) |
| `frontend/components/realEstate/map/MapSidebar.vue` | 동 행 렌더 | 수정 (Task 4) |
| `frontend/components/realEstate/map/RealEstateMapExplorer.vue` | 드릴 레벨 | 수정 (Task 5) |

라우트(`backend/src/routes/realEstate.ts`)는 **변경하지 않는다.** 이미 `fetchRegions(type, granularity, bounds)` 로 호출하므로 `granularity` 가 `'dong'` 이어도 같은 경로를 탄다.

---

### Task 1: 레벨 배분과 히스테리시스 3경계

**Files:**
- Modify: `backend/src/schemas/realEstateMap.ts`
- Test: `backend/__tests__/routes/realEstateMap.test.ts` (기존 파일 — `resolveGranularity` 테스트가 여기 있다. 새 파일을 만들지 말 것)

**Interfaces:**
- Consumes: 없음
- Produces: `type Granularity = 'city' | 'district' | 'dong' | 'building'`, `resolveGranularity(level: number, prev?: Granularity): Granularity`. Task 2 가 `RegionLevel` 을 이 타입에 맞춰 넓히고, Task 3 이 프론트 타입을 같은 값으로 맞춘다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`backend/__tests__/routes/realEstateMap.test.ts` 에 추가한다. `resolveGranularity` 를 검증하는 기존 테스트가 이 파일에 있으므로, **그 단언들이 새 배분과 어긋나면 함께 갱신한다**(레벨 8·7 이 `'district'` → `'dong'` 으로 바뀐다). import 는 파일 상단에 이미 있는 것을 재사용한다.

```ts
describe('resolveGranularity 4계층', () => {
  it('prev 없이 레벨만으로 4단위를 가른다', () => {
    expect(resolveGranularity(14)).toBe('city');
    expect(resolveGranularity(11)).toBe('city');
    expect(resolveGranularity(10)).toBe('district');
    expect(resolveGranularity(9)).toBe('district');
    expect(resolveGranularity(8)).toBe('dong');
    expect(resolveGranularity(7)).toBe('dong');
    expect(resolveGranularity(6)).toBe('building');
    expect(resolveGranularity(1)).toBe('building');
  });

  // 설계문서 5.1.1 전이표. 각 단위가 양방향 모두 정확히 2칸을 차지하고
  // 건너뛰는 단위가 없어야 한다 — 구·군 밴드가 9~10 두 칸뿐이라 특히 중요하다.
  it('한 칸씩 확대할 때 city→district→dong→building 을 순서대로 거친다', () => {
    const seen: Granularity[] = [];
    let prev: Granularity = 'city';
    for (const level of [12, 11, 10, 9, 8, 7, 6, 5]) {
      prev = resolveGranularity(level, prev);
      seen.push(prev);
    }
    expect(seen).toEqual([
      'city', 'city', 'city', 'district', 'district', 'dong', 'dong', 'building',
    ]);
  });

  it('한 칸씩 축소할 때 building→dong→district→city 를 순서대로 거친다', () => {
    const seen: Granularity[] = [];
    let prev: Granularity = 'building';
    for (const level of [5, 6, 7, 8, 9, 10, 11, 12]) {
      prev = resolveGranularity(level, prev);
      seen.push(prev);
    }
    expect(seen).toEqual([
      'building', 'building', 'building', 'dong', 'dong', 'district', 'district', 'city',
    ]);
  });

  it('경계에서 한 칸 왕복해도 단위가 바뀌지 않는다 (깜빡임 방지)', () => {
    // district(9~10) 에 있다가 8 로 내렸다 9 로 되돌리면 계속 district 여야 한다
    let g: Granularity = 'district';
    g = resolveGranularity(8, g);
    expect(g).toBe('district');
    g = resolveGranularity(9, g);
    expect(g).toBe('district');

    // dong(7~8) 에 있다가 6 으로 내렸다 7 로 되돌려도 dong
    g = 'dong';
    g = resolveGranularity(6, g);
    expect(g).toBe('dong');
    g = resolveGranularity(7, g);
    expect(g).toBe('dong');
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run __tests__/routes/realEstateMap.test.ts
```

Expected: FAIL — 현재는 `'dong'` 이 없어 레벨 8·7 이 `'district'` 로 나온다.

- [ ] **Step 3: 상수와 타입을 바꾼다**

`backend/src/schemas/realEstateMap.ts` 의 타입과 상수를 바꾼다.

변경 전:
```ts
export type Granularity = 'city' | 'district' | 'building';

/** 카카오맵 level 은 숫자가 클수록 축소된다. 1=20m, 14=전국. */
const CITY_MIN_LEVEL = 11;
const DISTRICT_MIN_LEVEL = 8;
```

변경 후:
```ts
export type Granularity = 'city' | 'district' | 'dong' | 'building';

/**
 * 카카오맵 level 은 숫자가 클수록 축소된다. 1=20m, 14=전국.
 * 각 단위가 정확히 2칸을 차지하도록 잡았다(설계문서 5.1.1 전이표).
 * 이 값을 바꾸면 전이표를 다시 그려 건너뛰는 단위가 없는지 확인할 것.
 */
const CITY_MIN_LEVEL = 11;
const DISTRICT_MIN_LEVEL = 9;
const DONG_MIN_LEVEL = 7;
```

- [ ] **Step 4: `resolveGranularity` 를 4단위로 바꾼다**

같은 파일의 함수 본문을 통째로 바꾼다.

변경 전:
```ts
export function resolveGranularity(level: number, prev?: Granularity): Granularity {
  const base: Granularity =
    level >= CITY_MIN_LEVEL ? 'city' : level >= DISTRICT_MIN_LEVEL ? 'district' : 'building';

  if (!prev || prev === base) return base;

  // 확대 방향(level 감소)으로 내려갈 때: 경계 바로 위 한 칸은 이전 단위를 유지
  if (prev === 'city' && base === 'district' && level === DISTRICT_MIN_LEVEL + 2) return 'city';
  if (prev === 'district' && base === 'building' && level === DISTRICT_MIN_LEVEL - 1) return 'district';
  // 축소 방향(level 증가)으로 올라갈 때
  if (prev === 'district' && base === 'city' && level === CITY_MIN_LEVEL) return 'district';
  if (prev === 'building' && base === 'district' && level === DISTRICT_MIN_LEVEL) return 'building';

  return base;
}
```

변경 후:
```ts
/** 축소된 순서(큰 단위 → 작은 단위). 인접 판정과 히스테리시스에 쓴다. */
const ORDER: readonly Granularity[] = ['city', 'district', 'dong', 'building'];

/** 각 단위가 시작되는 최소 레벨. 경계는 여기 한 곳에서만 정의된다. */
const MIN_LEVEL: Record<Exclude<Granularity, 'building'>, number> = {
  city: CITY_MIN_LEVEL,
  district: DISTRICT_MIN_LEVEL,
  dong: DONG_MIN_LEVEL,
};

export function resolveGranularity(level: number, prev?: Granularity): Granularity {
  const base: Granularity =
    level >= MIN_LEVEL.city
      ? 'city'
      : level >= MIN_LEVEL.district
        ? 'district'
        : level >= MIN_LEVEL.dong
          ? 'dong'
          : 'building';

  if (!prev || prev === base) return base;

  // 히스테리시스: 경계에서 미세하게 줌하면 단위가 왕복하며 목록·마커가 깜빡인다.
  // 이미 어떤 단위에 있으면 경계를 **한 칸 더** 넘어야 전환한다.
  //
  // 인접 단위 사이에서만 적용한다 — 두 칸 이상 건너뛴 전환(드릴다운으로 city→dong 등)은
  // 사용자의 명시적 동작이므로 붙잡지 않는다.
  const prevIdx = ORDER.indexOf(prev);
  const baseIdx = ORDER.indexOf(base);
  if (Math.abs(prevIdx - baseIdx) !== 1) return base;

  if (baseIdx > prevIdx) {
    // 확대(level 감소): prev 밴드 바로 아래 한 칸까지는 prev 를 유지한다.
    // `MIN_LEVEL[prev] - 1` 은 곧 다음(작은) 밴드의 꼭대기 칸이다.
    // 예: prev=district(9~10) → 8 에서는 아직 district, 7 부터 dong.
    if (prev !== 'building' && level === MIN_LEVEL[prev] - 1) return prev;
  } else {
    // 축소(level 증가): base 밴드의 첫 칸에서는 아직 prev 를 유지한다.
    // 예: prev=dong, base=district → 9 에서는 아직 dong, 10 부터 district.
    if (base !== 'building' && level === MIN_LEVEL[base]) return prev;
  }

  return base;
}
```

`prev !== 'building'` / `base !== 'building'` 가드는 타입 좁히기 겸 실제 로직이다 — `building` 은 밴드의 바닥이라 `MIN_LEVEL` 항목이 없고, 그 방향의 특례는 반대편 분기가 이미 처리한다.

**이 로직이 설계문서 5.1.1 전이표와 일치하는지 손으로 한 번 따라가 본다.** 확대 12→5 는 `city, city, city, district, district, dong, dong, building`, 축소 5→12 는 `building, building, building, dong, dong, district, district, city` 가 나와야 한다. Step 1 의 테스트가 이걸 그대로 검증한다.
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run __tests__/routes/realEstateMap.test.ts
```

Expected: PASS. **실패하면 Step 4 의 로직이 전이표와 어긋난 것이다** — 설계문서 5.1.1 의 표를 기준으로 삼고, 표에 맞추기 위해 테스트를 고치지 말 것.

- [ ] **Step 6: 백엔드 전체 테스트를 돌린다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npm test
```

Expected: PASS — 라우트 테스트가 `resolveGranularity(level)` 결과를 검증하고 있으면 레벨 8·7 기대값이 `'district'` 에서 `'dong'` 으로 바뀐다. 그런 단언이 있으면 새 배분에 맞게 갱신하고, 무엇을 왜 바꿨는지 리포트에 적는다.

- [ ] **Step 7: 커밋한다**

```bash
git add backend/src/schemas/realEstateMap.ts backend/__tests__/routes/realEstateMap.test.ts
git commit -m "feat(real-estate-map): 줌 단위를 4계층으로 — 동 밴드 신설, 히스테리시스 3경계"
```

---

### Task 2: 동 집계 쿼리

**Files:**
- Modify: `backend/src/services/realEstateMapService.ts`
- Test: `backend/__tests__/services/realEstateMapRegions.test.ts` (기존 파일 — `fetchRegions` 테스트가 여기 있다)

**Interfaces:**
- Consumes: Task 1 의 `Granularity` (`'dong'` 포함)
- Produces: `type RegionLevel = 'city' | 'district' | 'dong'`, `MapRegionItem` 에 `dong: string | null` 필드. Task 3 이 프론트 타입을 같은 모양으로 맞춘다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`backend/__tests__/services/realEstateMapRegions.test.ts` 에 추가한다. 이 파일은 프리즈마를 모듈 목으로 잡고 **`queryRawUnsafe` 라는 로컬 `vi.fn()`** 을 쓴다(`vi.mocked(prisma...)` 가 아니다). 파일 상단에 이미 있는 그 변수와 `KOREA_BOUNDS`/`SEOUL_BOUNDS` 상수를 그대로 재사용한다.

```ts
describe('동 집계', () => {
  it("level='dong' 이면 dongName 으로 GROUP BY 하고 거래 좌표 평균을 쓴다", async () => {
    // Region 테이블에는 동이 없다(@@unique([city, district])). JOIN 으로 좌표를
    // 얻으려 하면 0행이 나오므로 거래의 AVG(lat)/AVG(lng) 를 써야 한다.
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'dong', KOREA_BOUNDS);

    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/GROUP BY[\s\S]*t\.dongName/);
    expect(sql).toMatch(/AVG\(t\.lat\)/);
    expect(sql).toMatch(/AVG\(t\.lng\)/);
    expect(sql).not.toMatch(/JOIN Region/);
  });

  it('좌표 없는 거래를 평균에서 제외한다', async () => {
    // 거래의 0.1% 는 지오코딩이 안 돼 lat/lng 가 NULL 이다. 걸러내지 않으면
    // 동 중심이 흔들린다.
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'dong', KOREA_BOUNDS);

    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/t\.lat IS NOT NULL/);
    expect(sql).toMatch(/t\.lng IS NOT NULL/);
  });

  it('dong 필드를 채워 반환한다', async () => {
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([
      { name: '서울', district: '강북구', dong: '미아동', lat: '37.63', lng: '127.02',
        avgPricePerPyeong: 3225n, transactionCount: 42n },
    ]);
    const items = await fetchRegions('apt-sale', 'dong', KOREA_BOUNDS);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: '서울', district: '강북구', dong: '미아동' });
  });

  it('city/district 레벨의 dong 은 null 이다', async () => {
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([
      { name: '서울', district: null, lat: '37.55', lng: '126.99', avgPricePerPyeong: 5164n, transactionCount: 100n },
    ]);
    const items = await fetchRegions('apt-sale', 'city', KOREA_BOUNDS);
    expect(items[0].dong).toBeNull();
  });

  it('캐시 키는 (type, level) 뿐 — 다른 bbox 는 재조회하지 않는다', async () => {
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'dong', KOREA_BOUNDS);
    await fetchRegions('apt-sale', 'dong', SEOUL_BOUNDS);
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('전월세 동 집계는 전세만 본다 (구·군과 동일 규칙)', async () => {
    __resetMapCacheForTest();
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-rent', 'dong', KOREA_BOUNDS);

    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toMatch(/t\.monthlyRent = 0/);
    expect(sql).toMatch(/deposit/);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run __tests__/services/realEstateMapRegions.test.ts
```

Expected: FAIL — `'dong'` 이 `RegionLevel` 에 없어 타입 에러이거나, 있어도 `district` 쿼리가 나온다.

- [ ] **Step 3: 타입을 넓힌다**

`backend/src/services/realEstateMapService.ts` 에서 두 곳을 바꾼다.

변경 전:
```ts
export type RegionLevel = 'city' | 'district';

export interface MapRegionItem {
  /** level='city' 면 시/도명, 'district' 면 시/도명 (district 필드와 짝) */
  name: string;
  district: string | null;
```

변경 후:
```ts
export type RegionLevel = 'city' | 'district' | 'dong';

export interface MapRegionItem {
  /** 항상 시/도명. district/dong 필드와 짝을 이뤄 단위를 표현한다. */
  name: string;
  district: string | null;
  /** level='dong' 일 때만 채워진다. city/district 에서는 null. */
  dong: string | null;
```

- [ ] **Step 4: `buildRegions` 에 dong 분기를 더한다**

같은 파일의 `groupCols` / `selectName` / `joinCoord` 블록과 SQL 을 바꾼다.

변경 전:
```ts
  const groupCols = level === 'city' ? 't.city' : 't.city, t.district';
  const selectName =
    level === 'city'
      ? 't.city AS name, NULL AS district'
      : 't.city AS name, t.district AS district';
  const joinCoord =
    level === 'city'
      ? `JOIN (SELECT city, AVG(lat) AS lat, AVG(lng) AS lng FROM Region GROUP BY city) r
           ON r.city = t.city`
      : `JOIN Region r ON r.city = t.city AND r.district = t.district`;

  const sql = `
    SELECT ${selectName},
           r.lat AS lat, r.lng AS lng,
           ROUND(AVG(t.${priceCol} / (t.exclusiveArea / ${PYEONG_M2}))) AS avgPricePerPyeong,
           COUNT(*) AS transactionCount
    FROM ${table} t
    ${joinCoord}
    WHERE t.exclusiveArea > 0 ${rentFilter} AND ${dateSql}
    GROUP BY ${groupCols}, r.lat, r.lng
  `;
```

변경 후:
```ts
  // 동은 좌표 출처가 다르다. Region 테이블은 @@unique([city, district]) 라 동이 없어
  // JOIN 하면 0행이 된다 — 거래 좌표의 평균을 중심으로 쓴다. 거래의 99.9% 가 좌표를
  // 갖고 있어(2026-08 운영 실측) 평균이 안정적이다.
  const isDong = level === 'dong';

  const groupCols = isDong
    ? 't.city, t.district, t.dongName'
    : level === 'city'
      ? 't.city'
      : 't.city, t.district';

  const selectName = isDong
    ? 't.city AS name, t.district AS district, t.dongName AS dong'
    : level === 'city'
      ? 't.city AS name, NULL AS district, NULL AS dong'
      : 't.city AS name, t.district AS district, NULL AS dong';

  const joinCoord = isDong
    ? ''
    : level === 'city'
      ? `JOIN (SELECT city, AVG(lat) AS lat, AVG(lng) AS lng FROM Region GROUP BY city) r
           ON r.city = t.city`
      : `JOIN Region r ON r.city = t.city AND r.district = t.district`;

  // 좌표 컬럼과 GROUP BY 꼬리가 동/그 외에서 다르다. 동은 집계 함수라 GROUP BY 에
  // 넣지 않고, 그 외는 JOIN 으로 가져온 상수라 GROUP BY 에 넣어야 한다.
  const coordCols = isDong ? 'AVG(t.lat) AS lat, AVG(t.lng) AS lng' : 'r.lat AS lat, r.lng AS lng';
  const groupTail = isDong ? '' : ', r.lat, r.lng';

  // 좌표 없는 거래(0.1%)가 AVG 에 섞이면 동 중심이 흔들린다. 동일 때만 건다 —
  // city/district 는 좌표를 Region 에서 가져오므로 거래 좌표와 무관하다.
  const coordFilter = isDong ? 'AND t.lat IS NOT NULL AND t.lng IS NOT NULL' : '';

  const sql = `
    SELECT ${selectName},
           ${coordCols},
           ROUND(AVG(t.${priceCol} / (t.exclusiveArea / ${PYEONG_M2}))) AS avgPricePerPyeong,
           COUNT(*) AS transactionCount
    FROM ${table} t
    ${joinCoord}
    WHERE t.exclusiveArea > 0 ${rentFilter} ${coordFilter} AND ${dateSql}
    GROUP BY ${groupCols}${groupTail}
  `;
```

- [ ] **Step 5: 행 매핑에 `dong` 을 더한다**

같은 파일의 `rows.map(...)` 반환 객체에 한 줄을 더한다.

변경 전:
```ts
  return rows.map((r) => ({
    name: String(r.name),
    district: r.district == null ? null : String(r.district),
```

변경 후:
```ts
  return rows.map((r) => ({
    name: String(r.name),
    district: r.district == null ? null : String(r.district),
    dong: r.dong == null ? null : String(r.dong),
```

- [ ] **Step 6: 캐시 주석의 조합 수를 갱신한다**

같은 파일 `fetchRegions` 의 doc 주석에서 "12개" 를 고친다.

변경 전:
```
 * 캐시/in-flight dedup 은 (type, level) 조합 12개만 커버하면 되므로 **전국 목록**을
```

변경 후:
```
 * 캐시/in-flight dedup 은 (type, level) 조합 18개(6 타입 × 3 레벨)만 커버하면 되므로 **전국 목록**을
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run __tests__/services/realEstateMapRegions.test.ts
```

Expected: PASS

- [ ] **Step 8: 실제 DB 로 동 집계를 확인한다**

로컬 DB 에 운영 스냅샷이 들어 있다(2026-08-04 복사). 목이 아닌 실제 쿼리가 도는지 본다.

```bash
docker compose exec -T mysql mysql -uilsangkit -pilsangkit123 ilsangkit -N -e "
SELECT COUNT(*) FROM (
  SELECT t.city, t.district, t.dongName, AVG(t.lat) la, AVG(t.lng) ln,
         ROUND(AVG(t.dealAmount / (t.exclusiveArea / 3.3058))) p, COUNT(*) c
  FROM AptSaleTransaction t
  WHERE t.exclusiveArea > 0 AND t.lat IS NOT NULL AND t.lng IS NOT NULL
        AND ((t.dealYear = 2026 AND t.dealMonth >= 6) OR t.dealYear > 2026)
  GROUP BY t.city, t.district, t.dongName) x;" 2>&1 | grep -v Warning
```

Expected: 2,800 내외의 숫자(2026-08-04 실측 2,877). 0 이 나오면 날짜 조건이나 좌표 필터가 잘못된 것이다.

- [ ] **Step 9: 백엔드 전체 테스트와 린트를 돌린다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npm test && npm run lint
```

Expected: PASS

- [ ] **Step 10: 커밋한다**

```bash
git add backend/src/services/realEstateMapService.ts backend/__tests__/services/realEstateMapRegions.test.ts
git commit -m "feat(real-estate-map): 동 단위 집계 — 좌표는 거래 평균, Region 조인 없음"
```

---

### Task 3: 프론트 타입과 `itemKey` 고유성

**Files:**
- Modify: `frontend/types/realEstateMap.ts`
- Modify: `frontend/composables/useRealEstateMap.ts`
- Test: `frontend/tests/composables/useRealEstateMap.test.ts` (기존 파일)

**Interfaces:**
- Consumes: Task 2 의 `MapRegionItem` 모양(`dong: string | null`)
- Produces: 프론트 `Granularity` 에 `'dong'`, `MapRegionItem.dong`, `itemKey` 가 동을 포함해 고유 키를 만든다. Task 4·5 가 쓴다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`frontend/tests/composables/useRealEstateMap.test.ts` 에 추가한다.

```ts
describe('itemKey 고유성', () => {
  // 같은 구 안의 동들은 name(시/도)·district(구·군)가 모두 같다. dong 을 키에 넣지
  // 않으면 전부 같은 문자열이 되어 Vue :key 가 충돌하고 목록 렌더가 깨진다.
  it('같은 구의 서로 다른 동은 서로 다른 키를 갖는다', () => {
    const mia = { name: '서울', district: '강북구', dong: '미아동',
      lat: 37.63, lng: 127.02, avgPricePerPyeong: 3225, transactionCount: 42 }
    const beon = { name: '서울', district: '강북구', dong: '번동',
      lat: 37.64, lng: 127.03, avgPricePerPyeong: 3100, transactionCount: 31 }
    expect(itemKey(mia)).not.toBe(itemKey(beon))
  })

  it('dong 이 없는 구·군 항목은 기존 키 형태를 유지한다', () => {
    const gangbuk = { name: '서울', district: '강북구', dong: null,
      lat: 37.63, lng: 127.02, avgPricePerPyeong: 3225, transactionCount: 42 }
    expect(itemKey(gangbuk)).toBe('서울|강북구|')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/composables/useRealEstateMap.test.ts
```

Expected: FAIL — 현재 `itemKey` 는 `${name}|${district ?? ''}` 라 미아동과 번동이 둘 다 `'서울|강북구'` 가 된다.

- [ ] **Step 3: 프론트 타입을 넓힌다**

`frontend/types/realEstateMap.ts` 에서 두 곳을 바꾼다.

변경 전:
```ts
export type Granularity = 'city' | 'district' | 'building'
```

변경 후:
```ts
export type Granularity = 'city' | 'district' | 'dong' | 'building'
```

그리고 `MapRegionItem` 에 필드를 더한다.

변경 전:
```ts
export interface MapRegionItem {
  name: string
  district: string | null
```

변경 후:
```ts
export interface MapRegionItem {
  name: string
  district: string | null
  /** granularity='dong' 일 때만 채워진다. city/district 에서는 null. */
  dong: string | null
```

- [ ] **Step 4: `itemKey` 에 동을 포함한다**

`frontend/composables/useRealEstateMap.ts` 의 함수를 바꾼다.

변경 전:
```ts
export function itemKey(item: MapItem): string {
  return isBuildingItem(item)
    ? `${item.buildingName}|${item.district}`
    : `${item.name}|${item.district ?? ''}`
}
```

변경 후:
```ts
/**
 * 목록·오버레이의 Vue :key. 같은 구 안의 동들은 name(시/도)·district(구·군)가 모두
 * 같으므로 dong 까지 넣어야 고유해진다 — 빼면 강북구의 모든 동이 같은 키가 되어
 * 목록 렌더가 깨진다.
 */
export function itemKey(item: MapItem): string {
  return isBuildingItem(item)
    ? `${item.buildingName}|${item.district}`
    : `${item.name}|${item.district ?? ''}|${item.dong ?? ''}`
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/composables/useRealEstateMap.test.ts
```

Expected: PASS. **기존 테스트 중 `itemKey` 반환값을 문자열로 직접 비교하는 것이 있으면 새 형태(`|` 하나 추가)로 갱신한다** — 키의 정확한 문자열은 계약이 아니라 고유성이 계약이다.

- [ ] **Step 6: 커밋한다**

```bash
git add frontend/types/realEstateMap.ts frontend/composables/useRealEstateMap.ts frontend/tests/composables/useRealEstateMap.test.ts
git commit -m "feat(real-estate-map): 프론트 타입에 dong 추가 + itemKey 충돌 방지"
```

---

### Task 4: 사이드바 동 행

**Files:**
- Modify: `frontend/components/realEstate/map/MapSidebar.vue`
- Test: `frontend/tests/components/realEstate/map/MapSidebar.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `Granularity`(`'dong'`), `MapRegionItem.dong`, `itemKey`
- Produces: 동 granularity 에서 목록이 `<button>` 행을 그린다(`href` 없음). Task 5 가 그 클릭을 받아 줌한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`frontend/tests/components/realEstate/map/MapSidebar.test.ts` 맨 아래에 추가한다.

```ts
describe('MapSidebar 동 모드', () => {
  const DONGS: MapItem[] = [
    { name: '서울', district: '강북구', dong: '미아동', lat: 37.63, lng: 127.02,
      avgPricePerPyeong: 3225, transactionCount: 42 },
    { name: '서울', district: '강북구', dong: '번동', lat: 37.64, lng: 127.03,
      avgPricePerPyeong: 3100, transactionCount: 31 },
  ]

  function mountDong(over = {}) {
    return mount(MapSidebar, {
      props: {
        items: DONGS, granularity: 'dong', total: 2, exact: true, pending: false,
        type: 'apt-sale', ...over,
      },
    })
  }

  it('동 이름을 title, 시/도 구·군을 subtitle 로 그린다', () => {
    const w = mountDong()
    const first = w.findAll('[data-testid="map-sidebar-item"]')[0]
    expect(first.text()).toContain('미아동')
    expect(first.text()).toContain('서울 강북구')
  })

  it('동 행은 링크가 아니라 버튼이다 — 6종에는 동 페이지가 없다', () => {
    // href 를 만들면 죽은 링크가 되고, 크롤러가 존재하지 않는 URL 을 따라간다.
    const w = mountDong()
    const first = w.findAll('[data-testid="map-sidebar-item"]')[0]
    expect(first.find('a').exists()).toBe(false)
    expect(first.find('button').exists()).toBe(true)
    expect(first.find('button').attributes('type')).toBe('button')
  })

  it('동 행 클릭이 select 를 emit 한다', async () => {
    const w = mountDong()
    await w.findAll('[data-testid="map-sidebar-item"]')[0].find('button').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toMatchObject({ dong: '미아동' })
  })

  it('헤딩이 동별 평균 평당가다', () => {
    expect(mountDong().text()).toContain('동별 평균 평당가')
  })

  it('동 목록도 20개씩 자른다 — 수도권은 뷰포트 안에도 20개를 넘는다', () => {
    // visibleRows 조건이 `granularity !== 'city'` 라 동은 자연히 포함된다.
    // city 만 예외인 이유는 SIDO_CHIPS 16개 링크가 핵심 SSR 콘텐츠이기 때문.
    const many: MapItem[] = Array.from({ length: 25 }, (_, i) => ({
      name: '서울', district: '강남구', dong: `${i}동`, lat: 37.5, lng: 127.05,
      avgPricePerPyeong: 5000 + i, transactionCount: 10,
    }))
    const w = mountDong({ items: many, total: 25 })
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(20)
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(true)
  })

  it('구·군 행은 여전히 href 를 갖는다 (크롤 경로 회귀 가드)', () => {
    const w = mount(MapSidebar, {
      props: {
        items: [{ name: '서울', district: '강북구', dong: null, lat: 37.63, lng: 127.02,
          avgPricePerPyeong: 3225, transactionCount: 42 }],
        granularity: 'district', total: 1, exact: true, pending: false, type: 'apt-sale',
      },
    })
    expect(w.find('[data-testid="map-sidebar-item"] a').attributes('href')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/realEstate/map/MapSidebar.test.ts
```

Expected: FAIL — dong 분기가 없어 `rows` 가 city 분기(SIDO_CHIPS 16개)로 떨어진다.

- [ ] **Step 3: `Row` 의 `href` 를 nullable 로 바꾼다**

`frontend/components/realEstate/map/MapSidebar.vue` 의 인터페이스를 바꾼다.

변경 전:
```ts
interface Row {
  key: string
  title: string
  subtitle: string | null
  price: string
  href: string
  item: MapItem
}
```

변경 후:
```ts
interface Row {
  key: string
  title: string
  subtitle: string | null
  price: string
  /** null = 갈 페이지가 없는 행(동). 템플릿이 링크 대신 버튼을 그린다. */
  href: string | null
  item: MapItem
}
```

- [ ] **Step 4: `rows` 에 dong 분기를 더한다**

같은 파일의 `rows` computed 에서, `district` 분기 **바로 뒤**에 다음을 넣는다(city 분기 앞).

```ts
  if (props.granularity === 'dong') {
    return props.items.map((i) => {
      const r = i as MapRegionItem
      return {
        key: itemKey(i),
        title: r.dong ?? '',
        subtitle: `${r.name} ${r.district ?? ''}`.trim(),
        price: formatPyeongLabel(r),
        // 동 페이지가 없다(6종 라우트는 구·군까지). href 를 만들면 죽은 링크가 되므로
        // null 을 주고 템플릿이 버튼을 그리게 한다.
        href: null,
        item: i,
      }
    })
  }
```

- [ ] **Step 5: 헤딩에 dong 분기를 더한다**

같은 파일의 `heading` computed 를 바꾼다.

변경 전:
```ts
const heading = computed(() =>
  props.granularity === 'building' ? '이 지역 건물' : '지역별 평균 평당가',
)
```

변경 후:
```ts
const heading = computed(() => {
  if (props.granularity === 'building') return '이 지역 건물'
  if (props.granularity === 'dong') return '동별 평균 평당가'
  return '지역별 평균 평당가'
})
```

- [ ] **Step 6: 템플릿에 버튼 분기를 더한다**

같은 파일 템플릿에서, `<a v-else ...>` 를 `v-else-if="row.href"` 로 바꾸고 그 뒤에 버튼 분기를 더한다.

변경 전:
```vue
          <a
            v-else
            :href="row.href"
```

변경 후:
```vue
          <a
            v-else-if="row.href"
            :href="row.href"
```

그리고 그 `</a>` 바로 뒤, `</li>` 앞에 버튼을 넣는다.

```vue
          <!--
            동 행. 6종 유형에 동 라우트가 없어(land 만 있다) 갈 페이지가 없으므로
            링크가 아니라 버튼이다 — href 를 만들면 죽은 링크가 되고 크롤러가
            존재하지 않는 URL 을 따라간다. 클릭은 지도를 그 동으로 확대한다.
          -->
          <button
            v-else
            type="button"
            class="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-background-light transition-colors"
            @click="emit('select', row.item)"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 truncate">{{ row.title }}</span>
              <span v-if="row.subtitle" class="block text-xs text-slate-600 truncate">{{ row.subtitle }}</span>
            </span>
            <span class="text-sm font-semibold text-primary whitespace-nowrap">{{ row.price }}</span>
          </button>
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/realEstate/map/MapSidebar.test.ts
```

Expected: PASS — 기존 테스트(시/도 16개, 더보기, 푸터)도 모두 유지되어야 한다.

- [ ] **Step 8: 되돌려서 가드가 무는지 확인한다**

`href: null` 을 `href: toRealEstateListUrl(...)` 같은 문자열로 바꾸면 "버튼이다" 테스트가 실패해야 한다. 확인 후 복원하고 `git status` 가 깨끗한지 본다.

- [ ] **Step 9: 커밋한다**

```bash
git add frontend/components/realEstate/map/MapSidebar.vue frontend/tests/components/realEstate/map/MapSidebar.test.ts
git commit -m "feat(real-estate-map): 사이드바 동 행 — 링크 없는 버튼, 헤딩 분기"
```

---

### Task 5: 드릴 레벨 9 → 7 → 5

**Files:**
- Modify: `frontend/components/realEstate/map/RealEstateMapExplorer.vue`
- Test: `frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts`

**Interfaces:**
- Consumes: Task 1 의 레벨 배분(히스테리시스 되돌림 밴드), Task 3 의 `Granularity`
- Produces: 없음 (마지막 태스크)

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts` 의 `describe('RealEstateMapExplorer onSelect 드릴다운 zoom level', ...)` 블록을 고친다. 이 파일에는 이미 `mountWithGranularity(granularity, items)` 헬퍼가 있고 `{ canvas }` 를 돌려준다 — 새 헬퍼를 만들지 말고 그대로 쓴다.

**(a) describe 위의 주석 블록을 새 배분에 맞게 갱신한다.** 현재 "CITY_MIN_LEVEL=11, DISTRICT_MIN_LEVEL=8 이며 city→10, district→7 은 각각 되돌림 특례에 걸려" 라고 적혀 있는데, 상수와 밴드가 모두 바뀌었다.

변경 후:
```ts
// 9/7/5 는 backend resolveGranularity(backend/src/schemas/realEstateMap.ts)의 히스테리시스를
// 피해 실제로 다음 단위로 전환되는 값이다 — CITY_MIN_LEVEL=11, DISTRICT_MIN_LEVEL=9,
// DONG_MIN_LEVEL=7 이며 city→10, district→8, dong→6 은 각각 되돌림 특례에 걸려
// 드릴다운되지 않는다(클릭해도 아무 일이 없는 것처럼 보인다).
```

**(b) district 기대값을 6 → 7 로 바꾼다.**

변경 전:
```ts
  it('granularity=district 에서 select 시 level 6 을 세팅한다 (building 으로 드릴다운)', async () => {
    const { canvas } = mountWithGranularity('district', ITEMS)
    canvas.vm.$emit('select', ITEMS[0])
    await nextTick()
    expect(canvas.props('level')).toBe(6)
  })
```

변경 후:
```ts
  it('granularity=district 에서 select 시 level 7 을 세팅한다 (dong 으로 드릴다운)', async () => {
    const { canvas } = mountWithGranularity('district', ITEMS)
    canvas.vm.$emit('select', ITEMS[0])
    await nextTick()
    expect(canvas.props('level')).toBe(7)
  })
```

**(c) dong 케이스를 그 뒤에 추가한다.**

```ts
  it('granularity=dong 에서 select 시 level 5 를 세팅한다 (building 으로 드릴다운)', async () => {
    const { canvas } = mountWithGranularity('dong', DONG_ITEMS)
    canvas.vm.$emit('select', DONG_ITEMS[0])
    await nextTick()
    expect(canvas.props('level')).toBe(5)
  })
```

**(d) `DONG_ITEMS` 상수를 파일 상단의 `ITEMS`/`BUILDING_ITEMS` 옆에 더한다.**

```ts
const DONG_ITEMS: MapItem[] = [
  { name: '서울', district: '강북구', dong: '미아동', lat: 37.63, lng: 127.02,
    avgPricePerPyeong: 3225, transactionCount: 42 },
]
```

기존 `ITEMS` 의 지역 항목들에도 `dong: null` 을 더해야 타입이 맞는다 — 컴파일 에러가 나면 그 항목들을 확인한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/realEstate/map/RealEstateMapExplorer.test.ts
```

Expected: FAIL — 현재 매핑은 city→9, district→6 이고 dong 분기가 없다.

- [ ] **Step 3: 드릴 매핑을 바꾼다**

`frontend/components/realEstate/map/RealEstateMapExplorer.vue` 의 `onSelect` 를 바꾼다.

변경 전:
```ts
  if (granularity.value === 'city') setLevel(9)
  else if (granularity.value === 'district') setLevel(6)
```

변경 후:
```ts
  // 9/7/5 는 임의값이 아니라 backend resolveGranularity 의 히스테리시스 되돌림 밴드를
  // 피해 실제로 다음 단위로 넘어가는 값이다(설계문서 5.2):
  // - city(≥11) 에서 10 으로 가면 city 로 되돌아간다 → 9
  // - district(9~10) 에서 8 로 가면 district 로 되돌아간다 → 7
  // - dong(7~8) 에서 6 으로 가면 dong 으로 되돌아간다 → 5
  if (granularity.value === 'city') setLevel(9)
  else if (granularity.value === 'district') setLevel(7)
  else if (granularity.value === 'dong') setLevel(5)
```

주석 블록 위쪽에 이미 9/6 설명이 있으면 함께 갱신한다.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/realEstate/map/
```

Expected: PASS

- [ ] **Step 5: 되돌려서 가드가 무는지 확인한다**

`setLevel(7)` 을 `setLevel(8)` 로 바꾸면 district 테스트가, `setLevel(5)` 를 `setLevel(6)` 으로 바꾸면 dong 테스트가 각각 실패해야 한다. 둘 다 확인하고 복원한다.

- [ ] **Step 6: 프론트 전체 테스트와 린트를 돌린다**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run && npm run lint
```

Expected: PASS. **Node 20 인지 반드시 확인한다** — Node 25 면 무관한 27건이 거짓 실패한다.

- [ ] **Step 7: 커밋한다**

```bash
git add frontend/components/realEstate/map/RealEstateMapExplorer.vue frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts
git commit -m "feat(real-estate-map): 드릴 레벨 9→7→5 — 동 단계 경유"
```

---

## 라이브 검증 (전체 태스크 완료 후)

단위 테스트로 닿지 않는 것들이다. **로컬 DB 에 운영 스냅샷이 있어야 의미가 있다** — 데이터가 비면 목록이 비어 아무것도 드러나지 않는다. 백엔드·프론트 dev 서버를 띄우고 브라우저에서 확인한다.

- [ ] **4단계가 실제로 이어지는지** — 시/도 → 구·군 → 동 → 건물. 각 단계에서 지도가 그 지역으로 이동하고 목록 헤딩이 바뀌는지
- [ ] **동 목록에 동 이름이 뜨는지** — `미아동`, `번동` 처럼. 빈 문자열이면 `dong` 필드가 안 온 것이다
- [ ] **경계 왕복에도 깜빡이지 않는지** — 레벨 9↔8, 7↔6 을 휠로 왔다갔다 하며 목록 단위가 요동치지 않는지(히스테리시스 실동작)
- [ ] **동 행 클릭이 페이지를 이탈하지 않는지** — URL 경로가 `/real-estate` 로 유지되는지
- [ ] **동 버블이 읽히는지** — 겹치면 `useMapOverlays` 가 점으로 접는다. 수도권에서 확인
- [ ] **수도권에서 동이 20개를 넘으면 더보기가 뜨는지**
- [ ] **크롤 경로 회귀 없음** — `curl -s http://localhost:3000/real-estate | grep -o 'href="/real-estate/[a-z-]*"' | sort -u` 로 필터 6종 + `/real-estate/land` 가 그대로 나오는지
