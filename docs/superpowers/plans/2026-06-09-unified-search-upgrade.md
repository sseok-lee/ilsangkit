# 통합 검색 업그레이드 Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 키워드를 지역/카테고리/자유텍스트로 분해하는 "검색 두뇌"를 만들어 통합 검색 매칭을 정확하게 하고, 헤더 상주 검색창과 0건 회복 UX를 더해 이탈을 줄인다.

**Architecture:** 백엔드에 순수 함수 쿼리 파서(`parseSearchQuery`)를 두고, 지역 인덱스(캐시된 `getRegions()`)와 카테고리 동의어 맵을 주입한다. `facilityService.searchGrouped`와 `realEstateService.searchAll`이 파서를 거쳐 다중토큰 매칭한다. 프론트는 `AppHeader`에 일반 검색 입력창을 상주시키고(메인은 스크롤 등장), `/search`는 0건/부분0건 회복 UI를 추가한다. GA는 기존 트래커를 재사용한다.

**Tech Stack:** Express 5 + TypeScript(ESM) + Prisma(MySQL), Nuxt 3 + Vue 3 + Tailwind, Vitest. Node 20(`nvm use 20`).

**Spec:** `docs/superpowers/specs/2026-06-09-unified-search-upgrade-design.md`

---

## 사전 규칙 (모든 태스크 공통)

- 모든 명령은 **`nvm use 20`** 후 실행 (CI/서버 Node 20 기준).
- 백엔드 ESM: 로컬 import에 **`.js` 확장자 필수**.
- 백엔드 테스트: `cd backend && npx vitest run __tests__/<path>`.
- 프론트 테스트: `cd frontend && npx vitest run tests/<path>`.
- 커밋은 PR 브랜치 기준(현재 `develop`), main 직접 커밋 금지.
- BigInt/Decimal 응답은 `serializeRow()` 사용.

## File Structure

**백엔드 (신규 디렉터리 `backend/src/services/search/`)**
- Create `backend/src/services/search/searchRegionIndex.ts` — `getRegions()` 결과로 지역 인덱스 빌드 + 캐시. 책임: 지역명→정식명/구 매핑 제공.
- Create `backend/src/services/search/searchCategorySynonyms.ts` — 카테고리 동의어 맵(백엔드 상수). 책임: 동의어 단어→FacilityCategory.
- Create `backend/src/services/search/searchQueryParser.ts` — 순수 파서 `parseSearchQuery` + 캐시 래퍼 `parseSearchQueryCached`. 책임: 키워드→토큰 분해.
- Create `backend/src/services/search/searchRecovery.ts` — 0건 회복 추천 빌더. 책임: 인식 토큰→추천 링크 목록.
- Modify `backend/src/services/facilityService.ts` — `searchGrouped`가 파서 사용 + 응답에 `parsed`/`recovery` 포함.
- Modify `backend/src/services/realEstateService.ts:725-783` — `searchAll`이 파서 사용(contains+지역+동).

**프론트**
- Create `frontend/components/common/HeaderSearch.vue` — 헤더용 일반 검색 입력창(데스크톱 인라인) + 모바일 오버레이 토글. 책임: 입력→`/search` 라우팅 + GA.
- Modify `frontend/components/common/AppHeader.vue` — 검색 링크 → `HeaderSearch` 통합 + 스크롤 등장 상태.
- Modify `frontend/pages/index.vue` — 히어로 검색 GA 트래킹 통일.
- Modify `frontend/pages/search.vue` — 0건/부분0건 회복 UI.

**테스트**
- `backend/__tests__/services/search/searchQueryParser.test.ts`
- `backend/__tests__/services/search/searchRecovery.test.ts`
- `backend/__tests__/services/facilitySearchGrouped.test.ts` (다중토큰)
- `frontend/tests/components/common/HeaderSearch.test.ts`
- `frontend/tests/pages/searchZeroResult.test.ts`

---

## Task 1: 카테고리 동의어 맵 (백엔드 상수)

**Files:**
- Create: `backend/src/services/search/searchCategorySynonyms.ts`
- Test: `backend/__tests__/services/search/searchCategorySynonyms.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// backend/__tests__/services/search/searchCategorySynonyms.test.ts
import { describe, it, expect } from 'vitest';
import { CATEGORY_SYNONYM_MAP } from '../../../src/services/search/searchCategorySynonyms.js';

describe('CATEGORY_SYNONYM_MAP', () => {
  it('화장실 → toilet', () => {
    expect(CATEGORY_SYNONYM_MAP.get('화장실')).toBe('toilet');
  });
  it('공중화장실 → toilet', () => {
    expect(CATEGORY_SYNONYM_MAP.get('공중화장실')).toBe('toilet');
  });
  it('약국 → pharmacy', () => {
    expect(CATEGORY_SYNONYM_MAP.get('약국')).toBe('pharmacy');
  });
  it('주차장 → parking', () => {
    expect(CATEGORY_SYNONYM_MAP.get('주차장')).toBe('parking');
  });
  it('미등록 단어는 undefined', () => {
    expect(CATEGORY_SYNONYM_MAP.get('헬스장')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchCategorySynonyms.test.ts`
Expected: FAIL — Cannot find module 'searchCategorySynonyms.js'

- [ ] **Step 3: 구현**

```ts
// backend/src/services/search/searchCategorySynonyms.ts
import type { FacilityCategory } from '../../schemas/facility.js';

// 단어 → 카테고리. 새 카테고리/별칭 추가 시 여기만 수정.
const SYNONYMS: Record<FacilityCategory, string[]> = {
  toilet: ['화장실', '공중화장실', '공공화장실'],
  trash: ['쓰레기', '쓰레기배출', '분리수거'],
  wifi: ['와이파이', '무료와이파이', 'wifi'],
  clothes: ['의류수거함', '헌옷'],
  parking: ['주차', '주차장', '공영주차장'],
  aed: ['제세동기', '심장충격기', 'aed'],
  library: ['도서관'],
  hospital: ['병원'],
  pharmacy: ['약국'],
  park: ['공원'],
  school: ['학교'],
  market: ['전통시장', '시장'],
  childcare: ['어린이집', '보육'],
  'ev-charger': ['충전소', '전기차충전', '충전기'],
  sports: ['체육시설', '운동시설', '체육관'],
};

export const CATEGORY_SYNONYM_MAP: Map<string, FacilityCategory> = new Map(
  Object.entries(SYNONYMS).flatMap(([category, words]) =>
    words.map((w) => [w, category as FacilityCategory] as const)
  )
);
```

> 주의: `FacilityCategory` 타입의 정확한 키 목록은 `backend/src/schemas/facility.ts`를 열어 확인하고 위 레코드의 키가 그와 정확히 일치하도록 맞춘다(누락 키 = 타입 에러). 위 값은 CLAUDE.md의 15개 카테고리 기준이다.

- [ ] **Step 4: 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchCategorySynonyms.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && nvm use 20
git add src/services/search/searchCategorySynonyms.ts __tests__/services/search/searchCategorySynonyms.test.ts
git commit -m "feat(search): add category synonym map for query parser"
```

---

## Task 2: 지역 인덱스 (캐시)

지역명("강남", "강남구", "서울")을 정식 city/district로 매핑하는 인덱스를 `getRegions()`로 1회 빌드해 캐시한다. 빌드 함수는 순수(테스트용), 캐시 래퍼는 비동기.

**Files:**
- Create: `backend/src/services/search/searchRegionIndex.ts`
- Test: `backend/__tests__/services/search/searchRegionIndex.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// backend/__tests__/services/search/searchRegionIndex.test.ts
import { describe, it, expect } from 'vitest';
import { buildRegionIndex } from '../../../src/services/search/searchRegionIndex.js';

const SAMPLE = [
  { city: '서울특별시', district: '강남구' },
  { city: '서울특별시', district: '서초구' },
  { city: '부산광역시', district: '해운대구' },
];

describe('buildRegionIndex', () => {
  it('정식 city명과 축약명을 모두 인식', () => {
    const idx = buildRegionIndex(SAMPLE);
    expect(idx.cityNames.get('서울특별시')).toBe('서울특별시');
    expect(idx.cityNames.get('서울')).toBe('서울특별시');
  });
  it('district명 → {city, district}', () => {
    const idx = buildRegionIndex(SAMPLE);
    expect(idx.districtNames.get('강남구')).toEqual({ city: '서울특별시', district: '강남구' });
  });
  it('"구" 없는 축약 district도 인식 (강남 → 강남구)', () => {
    const idx = buildRegionIndex(SAMPLE);
    expect(idx.districtNames.get('강남')).toEqual({ city: '서울특별시', district: '강남구' });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchRegionIndex.test.ts`
Expected: FAIL — Cannot find module

- [ ] **Step 3: 구현**

```ts
// backend/src/services/search/searchRegionIndex.ts
import { getRegions } from '../metaService.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT, FULL_TO_SLUG } from '../cityMapping.js';

export interface RegionIndex {
  cityNames: Map<string, string>; // 입력형(정식/축약) → 정식 city명
  districtNames: Map<string, { city: string; district: string }>; // 입력형 → {정식 city, district}
}

export function buildRegionIndex(regions: Array<{ city: string; district: string }>): RegionIndex {
  const cityNames = new Map<string, string>();
  const districtNames = new Map<string, { city: string; district: string }>();

  for (const { city, district } of regions) {
    // city: 정식명 + 축약명 모두 등록
    cityNames.set(city, city);
    const slug = FULL_TO_SLUG[city];
    if (slug && CITY_SLUG_TO_SHORT[slug]) cityNames.set(CITY_SLUG_TO_SHORT[slug], city);
    if (slug && CITY_SLUG_TO_FULL[slug]) cityNames.set(CITY_SLUG_TO_FULL[slug], city);

    // district: 전체명("강남구") + "구/군/시" 제거 축약("강남") 등록
    if (district) {
      districtNames.set(district, { city, district });
      const short = district.replace(/(구|군|시)$/, '');
      if (short && short !== district && !districtNames.has(short)) {
        districtNames.set(short, { city, district });
      }
    }
  }
  return { cityNames, districtNames };
}

// ─── 캐시 래퍼 (TTL 1시간) ───
let cached: { index: RegionIndex; at: number } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function getRegionIndex(now: number = Date.now()): Promise<RegionIndex> {
  if (cached && now - cached.at < TTL_MS) return cached.index;
  const regions = await getRegions(); // [{ city, district }]
  const index = buildRegionIndex(regions);
  cached = { index, at: now };
  return index;
}

export function __resetRegionIndexCache(): void {
  cached = null;
}
```

> 검증: `getRegions()`의 실제 반환 필드를 `backend/src/services/metaService.ts:181` 부근에서 확인하고, `{ city, district }` 형태가 맞는지 맞춘다(다르면 매핑 보정).

- [ ] **Step 4: 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchRegionIndex.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && nvm use 20
git add src/services/search/searchRegionIndex.ts __tests__/services/search/searchRegionIndex.test.ts
git commit -m "feat(search): add cached region index for query parser"
```

---

## Task 3: 쿼리 파서 (순수 함수)

**Files:**
- Create: `backend/src/services/search/searchQueryParser.ts`
- Test: `backend/__tests__/services/search/searchQueryParser.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// backend/__tests__/services/search/searchQueryParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseSearchQuery } from '../../../src/services/search/searchQueryParser.js';
import { buildRegionIndex } from '../../../src/services/search/searchRegionIndex.js';
import { CATEGORY_SYNONYM_MAP } from '../../../src/services/search/searchCategorySynonyms.js';

const idx = buildRegionIndex([{ city: '서울특별시', district: '강남구' }]);
const parse = (kw: string) => parseSearchQuery(kw, idx, CATEGORY_SYNONYM_MAP);

describe('parseSearchQuery', () => {
  it('"강남 래미안" → district=강남구, freeText=래미안', () => {
    const r = parse('강남 래미안');
    expect(r.districtToken).toBe('강남구');
    expect(r.cityToken).toBe('서울특별시');
    expect(r.categoryToken).toBeNull();
    expect(r.freeText).toBe('래미안');
  });
  it('"서울 화장실" → city=서울특별시, category=toilet, freeText=""', () => {
    const r = parse('서울 화장실');
    expect(r.cityToken).toBe('서울특별시');
    expect(r.categoryToken).toBe('toilet');
    expect(r.freeText).toBe('');
  });
  it('"래미안" → freeText만', () => {
    const r = parse('래미안');
    expect(r.cityToken).toBeNull();
    expect(r.districtToken).toBeNull();
    expect(r.freeText).toBe('래미안');
  });
  it('"강남구" → district만, freeText=""', () => {
    const r = parse('강남구');
    expect(r.districtToken).toBe('강남구');
    expect(r.freeText).toBe('');
  });
  it('빈 문자열 → 전부 null/빈', () => {
    const r = parse('');
    expect(r.cityToken).toBeNull();
    expect(r.districtToken).toBeNull();
    expect(r.categoryToken).toBeNull();
    expect(r.freeText).toBe('');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchQueryParser.test.ts`
Expected: FAIL — Cannot find module

- [ ] **Step 3: 구현**

```ts
// backend/src/services/search/searchQueryParser.ts
import type { FacilityCategory } from '../../schemas/facility.js';
import { getRegionIndex, type RegionIndex } from './searchRegionIndex.js';
import { CATEGORY_SYNONYM_MAP } from './searchCategorySynonyms.js';

export interface ParsedQuery {
  cityToken: string | null;       // 정식 city명
  districtToken: string | null;   // district명
  categoryToken: FacilityCategory | null;
  freeText: string;               // 남은 토큰 공백 join
  raw: string;
}

export function parseSearchQuery(
  keyword: string | undefined,
  regionIndex: RegionIndex,
  synonymMap: Map<string, FacilityCategory>,
): ParsedQuery {
  const raw = (keyword ?? '').trim();
  const result: ParsedQuery = { cityToken: null, districtToken: null, categoryToken: null, freeText: '', raw };
  if (!raw) return result;

  const leftover: string[] = [];
  for (const token of raw.split(/\s+/)) {
    if (!result.cityToken && regionIndex.cityNames.has(token)) {
      result.cityToken = regionIndex.cityNames.get(token)!;
      continue;
    }
    if (!result.districtToken && regionIndex.districtNames.has(token)) {
      const hit = regionIndex.districtNames.get(token)!;
      result.districtToken = hit.district;
      if (!result.cityToken) result.cityToken = hit.city;
      continue;
    }
    if (!result.categoryToken && synonymMap.has(token)) {
      result.categoryToken = synonymMap.get(token)!;
      continue;
    }
    leftover.push(token);
  }
  result.freeText = leftover.join(' ');
  return result;
}

// 캐시 래퍼 — 서비스에서 사용
export async function parseSearchQueryCached(keyword: string | undefined): Promise<ParsedQuery> {
  const index = await getRegionIndex();
  return parseSearchQuery(keyword, index, CATEGORY_SYNONYM_MAP);
}
```

> 제약(v1, YAGNI): 공백 기준 토큰화만 한다. "강남래미안"처럼 붙여 쓴 입력은 분해하지 않는다(세그멘테이션/오타교정은 제외 범위).

- [ ] **Step 4: 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchQueryParser.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && nvm use 20
git add src/services/search/searchQueryParser.ts __tests__/services/search/searchQueryParser.test.ts
git commit -m "feat(search): add pure search query parser"
```

---

## Task 4: 0건 회복 추천 빌더

**Files:**
- Create: `backend/src/services/search/searchRecovery.ts`
- Test: `backend/__tests__/services/search/searchRecovery.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// backend/__tests__/services/search/searchRecovery.test.ts
import { describe, it, expect } from 'vitest';
import { buildRecovery } from '../../../src/services/search/searchRecovery.js';
import { FULL_TO_SLUG } from '../../../src/services/cityMapping.js';

describe('buildRecovery', () => {
  it('지역 인식 시: 지역 카테고리 칩(scope=region) 반환', () => {
    const r = buildRecovery({ cityToken: '서울특별시', districtToken: '강남구', categoryToken: null, freeText: '헬스장', raw: '강남 헬스장' });
    expect(r.scope).toBe('region');
    expect(r.regionLabel).toBe('서울특별시 강남구');
    expect(r.chips.length).toBeGreaterThan(0);
    // href는 /[citySlug]/[districtSlug]/[category] 형태
    expect(r.chips[0].href).toMatch(/^\/[a-z-]+\/[^/]+\/[a-z-]+$/);
  });
  it('카테고리만 인식 시: scope=category, href=/category', () => {
    const r = buildRecovery({ cityToken: null, districtToken: null, categoryToken: 'toilet', freeText: '', raw: '화장실' });
    expect(r.scope).toBe('category');
    expect(r.chips.some(c => c.href === '/toilet')).toBe(true);
  });
  it('아무것도 미인식 시: scope=popular, 정적 인기 카테고리', () => {
    const r = buildRecovery({ cityToken: null, districtToken: null, categoryToken: null, freeText: '존재안함', raw: '존재안함' });
    expect(r.scope).toBe('popular');
    expect(r.chips.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchRecovery.test.ts`
Expected: FAIL — Cannot find module

- [ ] **Step 3: 구현**

```ts
// backend/src/services/search/searchRecovery.ts
import type { ParsedQuery } from './searchQueryParser.js';
import type { FacilityCategory } from '../../schemas/facility.js';
import { FULL_TO_SLUG } from '../cityMapping.js';

export interface RecoveryChip { label: string; href: string; category: FacilityCategory }
export interface Recovery {
  scope: 'region' | 'category' | 'popular';
  regionLabel: string | null;
  chips: RecoveryChip[];
}

// 정적 인기 카테고리 (v1 큐레이션). 라벨은 프론트 CATEGORY_META와 일관되게.
const POPULAR: Array<{ category: FacilityCategory; label: string }> = [
  { category: 'toilet', label: '화장실' },
  { category: 'parking', label: '주차장' },
  { category: 'pharmacy', label: '약국' },
  { category: 'hospital', label: '병원' },
];

// district명 → 슬러그. 지역 라우트가 쓰는 변환과 일치해야 함(구현 시 확인).
function districtSlug(district: string): string {
  return encodeURIComponent(district);
}

export function buildRecovery(parsed: ParsedQuery): Recovery {
  // 1) 지역 인식
  if (parsed.cityToken && parsed.districtToken) {
    const citySlug = FULL_TO_SLUG[parsed.cityToken] ?? encodeURIComponent(parsed.cityToken);
    const dSlug = districtSlug(parsed.districtToken);
    return {
      scope: 'region',
      regionLabel: `${parsed.cityToken} ${parsed.districtToken}`,
      chips: POPULAR.map((p) => ({
        label: `${parsed.districtToken} ${p.label}`,
        href: `/${citySlug}/${dSlug}/${p.category}`,
        category: p.category,
      })),
    };
  }
  // 2) 카테고리만 인식
  if (parsed.categoryToken) {
    const cat = parsed.categoryToken;
    return {
      scope: 'category',
      regionLabel: null,
      chips: [{ label: cat, href: `/${cat}`, category: cat }],
    };
  }
  // 3) 미인식 → 정적 인기
  return {
    scope: 'popular',
    regionLabel: null,
    chips: POPULAR.map((p) => ({ label: p.label, href: `/${p.category}`, category: p.category })),
  };
}
```

> 검증: 지역 페이지 라우트(`/[city]/[district]/[category]`)가 기대하는 city/district 슬러그 포맷을 `frontend/pages/[city]/` 라우트와 `cityMapping`으로 확인해 `citySlug`/`districtSlug`를 맞춘다. 슬러그가 영문(romanization)이면 그 변환 유틸을 사용한다.

- [ ] **Step 4: 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchRecovery.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd backend && nvm use 20
git add src/services/search/searchRecovery.ts __tests__/services/search/searchRecovery.test.ts
git commit -m "feat(search): add zero-result recovery builder"
```

---

## Task 5: 시설 검색에 파서 연동 (`searchGrouped`)

`searchGrouped`가 `keyword` 통짜 매칭 대신 파서 토큰을 쓰도록 바꾸고, 응답에 `parsed`/`recovery`를 포함한다.

**Files:**
- Modify: `backend/src/services/facilityService.ts` (`searchGrouped`, 약 293-378행)
- Test: `backend/__tests__/services/facilitySearchGrouped.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// backend/__tests__/services/facilitySearchGrouped.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 파서 캐시가 DB(getRegions)를 타지 않도록 모킹
vi.mock('../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/searchRegionIndex.js');
  return {
    ...actual,
    getRegionIndex: async () => actual.buildRegionIndex([{ city: '서울특별시', district: '강남구' }]),
  };
});

import { searchGrouped } from '../../src/services/facilityService.js';

describe('searchGrouped (다중토큰)', () => {
  it('응답에 parsed 토큰과 recovery를 포함한다', async () => {
    const res = await searchGrouped({ keyword: '서울 화장실', grouped: true } as any);
    expect(res.parsed.cityToken).toBe('서울특별시');
    expect(res.parsed.categoryToken).toBe('toilet');
    expect(res).toHaveProperty('recovery');
  });
});
```

> 이 테스트는 실제 DB가 필요하다(기존 facility 테스트가 DB를 쓰는지 확인: `__tests__` 내 다른 서비스 테스트의 셋업을 따른다). DB 없는 CI 단계라면 `prisma`를 모킹하거나, 본 테스트를 통합 테스트로 분리한다. 우선 `parsed`/`recovery` 필드 존재만 단언해 결합도를 낮춘다.

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/facilitySearchGrouped.test.ts`
Expected: FAIL — `res.parsed` undefined

- [ ] **Step 3: 구현 — `searchGrouped` 수정**

`searchGrouped` 상단을 다음과 같이 바꾼다. 기존:

```ts
export async function searchGrouped(params: FacilitySearchInput): Promise<GroupedSearchResult> {
  const { keyword, city, district } = params;

  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
  };
```

변경 후:

```ts
import { parseSearchQueryCached } from './search/searchQueryParser.js';
import { buildRecovery, type Recovery } from './search/searchRecovery.js';
// ...
export async function searchGrouped(params: FacilitySearchInput): Promise<GroupedSearchResult> {
  const { keyword, city, district } = params;

  // 키워드를 토큰으로 분해. 명시적 city/district 파라미터가 우선.
  const parsed = await parseSearchQueryCached(keyword);
  const effectiveCity = city ?? parsed.cityToken ?? undefined;
  const effectiveDistrict = district ?? parsed.districtToken ?? undefined;
  const nameText = parsed.freeText || undefined; // 통짜 keyword 대신 자유텍스트만 이름 매칭

  const where = {
    ...buildKeywordFilter(nameText),
    ...buildRegionFilter(effectiveCity, effectiveDistrict),
  };
```

그리고 trash 블록의 `if (keyword)`를 `if (nameText)`로, `contains: keyword`를 `contains: nameText`로 바꾼다. ev-charger 호출의 `keyword, city, district`도 `keyword: nameText, city: effectiveCity, district: effectiveDistrict`로 바꾼다.

`GroupedSearchResult` 반환 타입과 return에 `parsed`/`recovery` 추가:

```ts
interface GroupedSearchResult {
  categories: GroupedCategoryResult[];
  totalCount: number;
  parsed: import('./search/searchQueryParser.js').ParsedQuery;
  recovery: Recovery | null;
}
// ...
  const totalCount = categories.reduce((sum, r) => sum + r.count, 0);
  const recovery = totalCount === 0 ? buildRecovery(parsed) : null;
  return { categories, totalCount, parsed, recovery };
```

> 주의: `recovery`는 시설 0건 기준이다. 부동산까지 합쳐 0인지는 프론트가 두 응답을 합쳐 판단한다(Task 9/10). 백엔드는 시설 기준 recovery만 제공하고, 프론트가 부동산도 0일 때만 노출한다.

- [ ] **Step 4: 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/facilitySearchGrouped.test.ts`
Expected: PASS

추가: 회귀 확인 — `cd backend && npx vitest run __tests__/` 전체 그린.

- [ ] **Step 5: 커밋**

```bash
cd backend && nvm use 20
git add src/services/facilityService.ts __tests__/services/facilitySearchGrouped.test.ts
git commit -m "feat(search): wire query parser into facility searchGrouped"
```

---

## Task 6: 부동산 검색에 파서 연동 (`searchAll`)

**Files:**
- Modify: `backend/src/services/realEstateService.ts:725-783`
- Test: 기존 부동산 테스트가 있으면 확장, 없으면 통합 스모크는 수동 확인.

- [ ] **Step 1: 현재 데이터 포맷 확인 (탐색 단계)**

Run:
```bash
cd backend && nvm use 20
npx tsx -e "import {prisma} from './src/lib/prisma.js'; const r = await prisma.realEstateBuildingSummary.findFirst({select:{city:true,district:true}}); console.log(r); process.exit(0)"
```
Expected: `{ city: '...', district: '...' }` — city가 정식명('서울특별시')인지 축약('서울')인지 확인. 파서의 `cityToken`(정식명)과 비교해 매칭 전략 결정.

- [ ] **Step 2: 실패 테스트 작성 (파서 연동 단언)**

```ts
// backend/__tests__/services/realEstateSearchAll.test.ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/searchRegionIndex.js');
  return { ...actual, getRegionIndex: async () => actual.buildRegionIndex([{ city: '서울특별시', district: '강남구' }]) };
});
import { searchAll } from '../../src/services/realEstateService.js';

describe('searchAll (파서 연동)', () => {
  it('"강남 래미안"에서 지역 토큰이 필터로, 래미안이 이름으로 적용돼 에러 없이 반환', async () => {
    const res = await searchAll('강남 래미안');
    expect(res).toHaveProperty('categories');
    expect(Array.isArray(res.categories)).toBe(true);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateSearchAll.test.ts`
Expected: FAIL 또는 PASS(현재 startsWith라 에러는 안 날 수 있음). 핵심은 다음 구현 후 동작 변화.

- [ ] **Step 4: 구현 — `searchAll` 수정**

현재(725-748 발췌):
```ts
export async function searchAll(keyword?, city?, district?): Promise<SearchAllResult> {
  const where: Record<string, any> = {};
  if (keyword) where.buildingName = { startsWith: keyword };
  if (city) where.city = city;
  if (district) where.district = district;
  // ... summaryWhere도 동일하게 keyword startsWith
```

변경 후:
```ts
import { parseSearchQueryCached } from './search/searchQueryParser.js';
// ...
export async function searchAll(keyword?: string, city?: string, district?: string): Promise<SearchAllResult> {
  const parsed = await parseSearchQueryCached(keyword);
  const effCity = city ?? parsed.cityToken ?? undefined;
  const effDistrict = district ?? parsed.districtToken ?? undefined;
  const nameText = parsed.freeText || undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (nameText) {
    where.OR = [
      { buildingName: { contains: nameText } },
      { dongName: { contains: nameText } },
    ];
  }
  if (effCity) where.city = effCity;
  if (effDistrict) where.district = effDistrict;
```

그리고 함수 내부 `summaryWhere`도 동일하게 변경:
```ts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const summaryWhere: Record<string, any> = { type };
      if (nameText) {
        summaryWhere.OR = [
          { buildingName: { contains: nameText } },
          { dongName: { contains: nameText } },
        ];
      }
      if (effCity) summaryWhere.city = effCity;
      if (effDistrict) summaryWhere.district = effDistrict;
```

> city 매칭: Step 1에서 RE의 city가 축약명이면 `effCity`를 축약으로 변환해야 한다. `cityMapping`의 `FULL_TO_SLUG[effCity]` → `CITY_SLUG_TO_SHORT[slug]`로 변환하거나, `{ city: { in: [정식, 축약] } }`로 양형태 매칭(시설의 `buildRegionFilter`와 동일 사상). Step 1 결과에 맞춰 적용.

- [ ] **Step 5: 통과 + 회귀 확인**

Run:
```bash
cd backend && npx vitest run __tests__/services/realEstateSearchAll.test.ts
cd backend && npx vitest run __tests__/
```
Expected: 대상 PASS, 전체 그린.

- [ ] **Step 6: 커밋**

```bash
cd backend && nvm use 20
git add src/services/realEstateService.ts __tests__/services/realEstateSearchAll.test.ts
git commit -m "feat(search): wire query parser into real estate searchAll"
```

---

## Task 7: 헤더 검색 컴포넌트 (`HeaderSearch.vue`)

데스크톱 인라인 입력창 + 모바일 오버레이. 입력→Enter/버튼→`/search?keyword=` 라우팅 + GA `trackSearch`.

**Files:**
- Create: `frontend/components/common/HeaderSearch.vue`
- Test: `frontend/tests/components/common/HeaderSearch.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/tests/components/common/HeaderSearch.test.ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import HeaderSearch from '~/components/common/HeaderSearch.vue';

const navigateToMock = vi.fn();
vi.stubGlobal('navigateTo', navigateToMock);

describe('HeaderSearch', () => {
  it('입력 후 엔터 시 /search로 이동', async () => {
    navigateToMock.mockClear();
    const wrapper = mount(HeaderSearch);
    const input = wrapper.find('input');
    await input.setValue('강남 래미안');
    await input.trigger('keydown.enter');
    expect(navigateToMock).toHaveBeenCalledWith('/search?keyword=' + encodeURIComponent('강남 래미안'));
  });
  it('빈 입력은 라우팅하지 않음', async () => {
    navigateToMock.mockClear();
    const wrapper = mount(HeaderSearch);
    await wrapper.find('input').trigger('keydown.enter');
    expect(navigateToMock).not.toHaveBeenCalled();
  });
});
```

> `navigateTo`/`useRuntimeConfig` 등 Nuxt auto-import의 글로벌 mock 등록 방식은 `frontend/tests/setup.ts`를 따른다(이미 다수 등록됨). 위 `vi.stubGlobal`이 setup과 충돌하면 setup 패턴으로 통일한다.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/components/common/HeaderSearch.test.ts`
Expected: FAIL — 컴포넌트 없음

- [ ] **Step 3: 구현**

```vue
<!-- frontend/components/common/HeaderSearch.vue -->
<template>
  <div class="relative">
    <!-- 데스크톱 인라인 -->
    <div class="hidden md:flex items-center gap-2 bg-slate-50 border border-line rounded-lg px-3 h-10 w-full max-w-md focus-within:border-primary focus-within:bg-white transition-colors">
      <span class="material-symbols-outlined text-slate-400 text-[20px]">search</span>
      <input
        v-model="keyword"
        aria-label="통합 검색"
        class="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
        placeholder="지역·단지명·시설 검색"
        @keydown.enter="submit"
      />
    </div>
    <!-- 모바일 아이콘 -->
    <button
      class="md:hidden flex items-center justify-center w-10 h-10 text-slate-600"
      aria-label="검색 열기"
      @click="overlayOpen = true"
    >
      <span class="material-symbols-outlined">search</span>
    </button>

    <!-- 모바일 전체화면 오버레이 -->
    <div v-if="overlayOpen" class="fixed inset-0 z-50 bg-white md:hidden" role="dialog" aria-label="검색">
      <div class="flex items-center gap-2 px-3 h-14 border-b border-line">
        <button aria-label="닫기" class="text-slate-500" @click="overlayOpen = false">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="flex-1 flex items-center gap-1.5 bg-slate-50 border border-primary rounded-lg px-2 h-9">
          <span class="material-symbols-outlined text-slate-400 text-[18px]">search</span>
          <input
            ref="overlayInput"
            v-model="keyword"
            aria-label="통합 검색"
            class="flex-1 bg-transparent text-sm focus:outline-none"
            placeholder="지역·단지명·시설 검색"
            @keydown.enter="submit"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useAnalytics } from '~/composables/useAnalytics'

const keyword = ref('')
const overlayOpen = ref(false)
const overlayInput = ref<HTMLInputElement | null>(null)
const { trackSearch } = useAnalytics()

function submit() {
  const q = keyword.value.trim()
  if (!q) return
  trackSearch({ keyword: q })
  overlayOpen.value = false
  navigateTo('/search?keyword=' + encodeURIComponent(q))
}

watch(overlayOpen, async (open) => {
  if (!import.meta.client) return
  if (open) { await nextTick(); overlayInput.value?.focus() }
})
</script>
```

> `useAnalytics`가 `trackSearch`를 export하는지 확인(`frontend/composables/useAnalytics.ts`에 존재). 반환 객체에 포함돼 있지 않으면 export 목록에 추가.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run tests/components/common/HeaderSearch.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
cd frontend && nvm use 20
git add components/common/HeaderSearch.vue tests/components/common/HeaderSearch.test.ts
git commit -m "feat(search): add HeaderSearch component (desktop inline + mobile overlay)"
```

---

## Task 8: 헤더 통합 + 메인 스크롤 등장

`AppHeader`의 데스크톱 "검색" 링크 자리에 `HeaderSearch`를 넣고, 모바일 메뉴의 "검색" 링크는 유지(오버레이는 헤더 아이콘). 메인 라우트에선 스크롤로 히어로가 사라지면 데스크톱 검색창을 표시.

**Files:**
- Modify: `frontend/components/common/AppHeader.vue` (데스크톱 검색 링크 163-170행 영역, script 310행 영역)
- Test: `frontend/tests/components/common/AppHeaderSearch.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/tests/components/common/AppHeaderSearch.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AppHeader from '~/components/common/AppHeader.vue';

describe('AppHeader 검색 통합', () => {
  it('HeaderSearch 컴포넌트를 렌더한다', () => {
    const wrapper = mount(AppHeader, { global: { stubs: { HardLink: true, CategoryIcon: true } } });
    expect(wrapper.findComponent({ name: 'HeaderSearch' }).exists()).toBe(true);
  });
});
```

> `AppHeader`가 `useRoute`/auto-import에 의존하면 `tests/setup.ts`의 mock에 맞춰 stub 보강. 기존 AppHeader 테스트가 있으면 그 셋업을 그대로 따른다.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/components/common/AppHeaderSearch.test.ts`
Expected: FAIL — HeaderSearch 없음

- [ ] **Step 3: 구현 — 데스크톱 검색 링크 교체**

`AppHeader.vue`에서 데스크톱 "검색" `HardLink`(아래)를:
```vue
          <HardLink
            to="/search"
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-slate-600 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">search</span>
            검색
          </HardLink>
```
다음으로 교체:
```vue
          <HeaderSearch v-show="showHeaderSearch" class="w-56 lg:w-64" />
```

script에 import + 스크롤 상태 추가:
```ts
import HeaderSearch from '~/components/common/HeaderSearch.vue'
import { useRoute } from 'vue-router'
// ...
const route = useRoute()
const heroOut = ref(false) // 히어로가 화면 밖으로 나갔는지

// 메인이 아니면 항상 표시, 메인이면 heroOut일 때만 표시
const showHeaderSearch = computed(() => route.path !== '/' || heroOut.value)

let scrollHandler: (() => void) | null = null
onMounted(() => {
  if (!import.meta.client) return
  if (route.path === '/') {
    scrollHandler = () => { heroOut.value = window.scrollY > 360 }
    window.addEventListener('scroll', scrollHandler, { passive: true })
    scrollHandler()
  }
})
onUnmounted(() => {
  if (scrollHandler) window.removeEventListener('scroll', scrollHandler)
})
```
`computed`가 import 안 돼 있으면 `import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'`로 보강.

> SSR 가드: 초기 `heroOut=false` → 메인 SSR/클라이언트 모두 검색창 숨김으로 일치(hydration mismatch 없음). 모바일 메뉴의 "검색" `HardLink`는 그대로 둔다.

- [ ] **Step 4: 통과 + 회귀 확인**

Run:
```bash
cd frontend && npx vitest run tests/components/common/AppHeaderSearch.test.ts
cd frontend && npx vitest run tests/components/common/
```
Expected: 대상 PASS, 기존 AppHeader 테스트 그린.

- [ ] **Step 5: 커밋**

```bash
cd frontend && nvm use 20
git add components/common/AppHeader.vue tests/components/common/AppHeaderSearch.test.ts
git commit -m "feat(search): integrate HeaderSearch into AppHeader with scroll reveal on home"
```

---

## Task 9: 메인 히어로 검색 GA 통일

메인 히어로 `handleSearch`가 GA `trackSearch`를 쏘도록 추가(헤더와 동일 동작).

**Files:**
- Modify: `frontend/pages/index.vue` (`handleSearch`, 약 396-399행)

- [ ] **Step 1: 현재 확인**

`index.vue`의 `handleSearch`:
```ts
function handleSearch() {
  if (!searchKeyword.value) return
  navigateTo(`/search?keyword=${encodeURIComponent(searchKeyword.value)}`)
}
```

- [ ] **Step 2: 구현 — GA 추가**

```ts
function handleSearch() {
  const q = searchKeyword.value.trim()
  if (!q) return
  trackSearch({ keyword: q })
  navigateTo(`/search?keyword=${encodeURIComponent(q)}`)
}
```
script에 `const { trackSearch } = useAnalytics()`가 없으면 추가(`import { useAnalytics } from '~/composables/useAnalytics'`).

- [ ] **Step 3: 회귀 확인**

Run: `cd frontend && npx vitest run tests/pages/` (index 페이지 테스트가 있으면 그린 확인)
Expected: PASS / 회귀 없음

- [ ] **Step 4: 커밋**

```bash
cd frontend && nvm use 20
git add pages/index.vue
git commit -m "feat(search): track search event from home hero"
```

---

## Task 10: `/search` 0건/부분0건 회복 UI

백엔드 `recovery`를 받아 지역 인식 추천 칩을 노출하고, 부분0건(한쪽만 0)일 때 전체를 0건으로 덮지 않는다.

**Files:**
- Modify: `frontend/composables/useFacilitySearch.ts` — `searchGrouped` 응답에서 `recovery` 노출
- Modify: `frontend/pages/search.vue` — 0건 회복 블록 + 부분0건 안내
- Test: `frontend/tests/pages/searchZeroResult.test.ts`

- [ ] **Step 1: composable에 recovery 추가 (실패 테스트 먼저)**

```ts
// frontend/tests/composables/useFacilitySearchRecovery.test.ts
import { describe, it, expect, vi } from 'vitest';
import { useFacilitySearch } from '~/composables/useFacilitySearch';

vi.stubGlobal('$fetch', vi.fn(async () => ({
  success: true,
  data: { categories: [], totalCount: 0, recovery: { scope: 'region', regionLabel: '서울특별시 강남구', chips: [{ label: '강남구 화장실', href: '/seoul/gangnam/toilet', category: 'toilet' }] } },
})));

describe('useFacilitySearch recovery', () => {
  it('searchGrouped 후 recovery가 채워진다', async () => {
    const s = useFacilitySearch();
    await s.searchGrouped({ keyword: '강남 헬스장' } as any);
    expect(s.recovery.value?.scope).toBe('region');
    expect(s.recovery.value?.chips[0].href).toBe('/seoul/gangnam/toilet');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/composables/useFacilitySearchRecovery.test.ts`
Expected: FAIL — `recovery` 미존재

- [ ] **Step 3: 구현 — composable**

`useFacilitySearch.ts`에 `recovery` ref 추가:
```ts
import type { /* 기존 */ } from '~/types/facility'

interface RecoveryChip { label: string; href: string; category: string }
interface Recovery { scope: 'region' | 'category' | 'popular'; regionLabel: string | null; chips: RecoveryChip[] }

const recovery = ref<Recovery | null>(null)
```
`searchGrouped` 성공 블록에 추가:
```ts
      if (response.success && response.data) {
        groupedResults.value = response.data.categories
        groupedTotalCount.value = response.data.totalCount
        recovery.value = (response.data as any).recovery ?? null
      }
```
실패/finally에서 초기화하고, return에 `recovery: readonly(recovery)` 추가.
타입 `GroupedSearchResponse`(`~/types/facility`)에 `recovery?: Recovery` 필드 추가.

- [ ] **Step 4: composable 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useFacilitySearchRecovery.test.ts`
Expected: PASS

- [ ] **Step 5: search.vue 0건/부분0건 — 실패 테스트**

```ts
// frontend/tests/pages/searchZeroResult.test.ts
import { describe, it, expect } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SearchPage from '~/pages/search.vue';

// $fetch가 시설 0건 + recovery(region) 반환하도록 setup.ts 기반 mock 구성
describe('/search 0건 회복', () => {
  it('지역 인식 추천 칩을 렌더한다', async () => {
    const wrapper = mount(SearchPage);
    // isMounted 가드 통과 + 검색 완료 대기
    await flushPromises();
    // recovery.scope==='region'일 때 지역 추천 영역 노출
    expect(wrapper.text()).toContain('이런 건 어때요');
  });
});
```

> 이 테스트는 `tests/setup.ts`의 `$fetch`/`useAsyncData` mock 설정에 의존한다. setup의 기본 mock이 빈 배열을 주므로, 이 파일에서 `$fetch`를 0건+recovery로 오버라이드한다(HeaderSearch.test 패턴 참고). 컴포넌트가 무거우면 0건 회복 블록만 별도 작은 컴포넌트로 추출해 단위 테스트하는 방안을 우선 고려한다.

- [ ] **Step 6: 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/searchZeroResult.test.ts`
Expected: FAIL

- [ ] **Step 7: 구현 — search.vue 0건 회복 블록**

`search.vue`의 grouped view EmptyState(시설+부동산 모두 0인 분기)를 recovery 기반으로 교체/보강. 기존:
```vue
        <EmptyState
          v-if="!selectedCategory && groupedResults.length === 0 && realEstateResults.length === 0"
          :title="UI_MESSAGES.emptySearch"
          description="다른 검색어를 입력해보세요"
        >
```
내부에 recovery 추천 추가(EmptyState 슬롯 상단):
```vue
          <!-- 지역 인식 추천 -->
          <div v-if="recovery && recovery.scope === 'region'" class="mb-6 text-left max-w-md mx-auto">
            <p class="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px] text-primary">my_location</span>
              {{ recovery.regionLabel }}에서 이런 건 어때요?
            </p>
            <div class="flex flex-wrap gap-2">
              <NuxtLink
                v-for="chip in recovery.chips"
                :key="chip.href"
                :to="chip.href"
                class="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/5 text-primary border border-primary/20 rounded-full text-xs font-medium hover:bg-primary hover:text-white transition-colors"
              >{{ chip.label }}</NuxtLink>
            </div>
          </div>
```
`recovery`를 composable에서 구조분해로 가져온다:
```ts
const { /* 기존 */, recovery } = useFacilitySearch()
```

**부분0건 안내**: 결과타입 탭 아래에, 시설 0 && 부동산>0(또는 반대)일 때 작은 안내 추가:
```vue
        <div
          v-if="isMounted && searchKeyword && (groupedResults.length === 0) !== (realEstateResults.length === 0)"
          class="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-line rounded-lg px-3 py-2"
        >
          <span class="material-symbols-outlined text-[16px]">info</span>
          <span v-if="groupedResults.length === 0">"{{ searchKeyword }}"에 맞는 <b class="mx-1">생활시설</b> 결과는 없어요. 부동산 결과를 보여드릴게요.</span>
          <span v-else>"{{ searchKeyword }}"에 맞는 <b class="mx-1">부동산</b> 결과는 없어요. 생활시설 결과를 보여드릴게요.</span>
        </div>
```

> `search.vue`는 이미 `trackSearchResultsView`로 0건 시 결과 카운트를 추적한다(loading watch). 0건 시 `trackSearchNoResults`도 쏘도록, loading watch에서 `total===0 && groupedTotalCount===0` 분기에 `useAnalytics().trackSearchNoResults({ keyword })` 추가.

- [ ] **Step 8: 통과 + 회귀 확인**

Run:
```bash
cd frontend && npx vitest run tests/pages/searchZeroResult.test.ts
cd frontend && npx vitest run tests/
```
Expected: 대상 PASS, 전체 그린.

- [ ] **Step 9: 커밋**

```bash
cd frontend && nvm use 20
git add composables/useFacilitySearch.ts pages/search.vue types/facility.ts tests/composables/useFacilitySearchRecovery.test.ts tests/pages/searchZeroResult.test.ts
git commit -m "feat(search): zero-result recovery and partial-empty notice on /search"
```

---

## Task 11: 전체 검증 + 빌드

**Files:** 없음(검증 전용)

- [ ] **Step 1: 백엔드 전체 테스트 + lint + build**

```bash
cd backend && nvm use 20
npx vitest run
npm run lint
npm run build
```
Expected: 전부 그린, 타입 에러 0.

- [ ] **Step 2: 프론트 전체 테스트 + lint**

```bash
cd frontend && nvm use 20
npx vitest run
npm run lint
```
Expected: 전부 그린.

- [ ] **Step 3: 수동 스모크 (dev)**

```bash
# 터미널 1
cd backend && nvm use 20 && npm run dev
# 터미널 2
cd frontend && nvm use 20 && npm run dev
```
브라우저에서 확인:
- 메인 상단: 히어로 검색창만, 스크롤 내리면 헤더 검색창 등장
- 다른 페이지(예: `/toilet`): 헤더 검색창 상주
- "강남 래미안" 검색 → 부동산 매칭, 시설 0 → 부분0건 안내
- "강남 헬스장" 검색 → 0건 회복 칩(강남구 화장실 등) 노출, 클릭 시 지역 페이지 이동
- 모바일 폭: 헤더 검색 아이콘 → 오버레이

- [ ] **Step 4: 최종 커밋(있으면)**

```bash
git add -A && git commit -m "test(search): full verification for unified search upgrade phase 1"
```

---

## Self-Review (작성자 체크 결과)

**1. Spec 커버리지**
- 쿼리 파서(spec §3.1) → Task 1~3 ✅
- 시설 다중토큰(§3.2) → Task 5 ✅
- 부동산 매칭 확장(§3.3) → Task 6 ✅
- 0건 회복(§3.4) → Task 4(빌더) + Task 10(UI) ✅
- 헤더 상주 검색창(§4.1) → Task 7~8 ✅
- 메인 스크롤 등장(§4.2) → Task 8 ✅
- 히어로 일원화(§4.3) → Task 9 ✅
- /search 0건/부분0건(§4.4) → Task 10 ✅
- GA 계측(§5) → 기존 트래커 재사용: `trackSearch`(Task 7·9), `trackSearchNoResults`(Task 10), `trackSearchResultClick`(기존 결과 클릭 경로 유지) ✅
- noindex 유지(§2) → search.vue 기존 `robots: noindex` 손대지 않음 ✅
- Phase 2 이월(suggest/자동완성) → 본 플랜에서 의도적으로 제외 ✅

**2. Placeholder 스캔**: 코드 블록에 실제 구현 포함. "확인/검증" 단계는 탐색용 명령으로 구체화함(데이터 포맷·슬러그 포맷). 추상 지시 없음.

**3. 타입 일관성**: `ParsedQuery`(Task 3) 필드명을 Task 5·6에서 동일 사용(`cityToken`/`districtToken`/`categoryToken`/`freeText`). `Recovery`/`RecoveryChip`(Task 4) 구조를 Task 10 프론트에서 동일 사용. `parseSearchQueryCached`(Task 3) 시그니처를 Task 5·6에서 동일 호출.

**주의(구현자에게)**: Task 5·6의 서비스 테스트는 DB 의존 가능성이 있다. 기존 `backend/__tests__`의 서비스 테스트 셋업(테스트 DB 또는 prisma mock)을 먼저 확인하고 그 패턴을 따를 것. DB가 없으면 파서/회복은 순수 단위 테스트(Task 1~4)로 충분히 커버되며, 서비스 결합은 필드 존재 단언 수준으로 낮춘다.
