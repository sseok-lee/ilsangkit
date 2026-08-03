# 2026 행정개편 지역 해석 복구 — 구현 플랜 (오늘의 부동산 404)

> **For agentic workers:** 스펙 `docs/superpowers/specs/2026-07-14-region-admin-reorg-2026-design.md` 참조. TDD, 태스크별 백엔드 vitest 통과 후 커밋.

**Goal:** 홈 "오늘의 부동산" 랭킹의 404(전남광주통합특별시 미매핑·인천 신설구 한글 slug)를 제거하고, 도착 부동산 지역 페이지가 코드12 데이터를 찾도록 한다.

**Architecture:** 이름 문자열 기반 지역 slug 파생을, 통합시(코드12) 한정 **bjdCode 기반 되돌림 매핑**으로 보강. 광주/전남은 기존 slug 유지, 인천 신설구는 로마자 채택. hotspot에 방어 가드.

**Tech Stack:** Express5/TS(ESM) 백엔드, Prisma/MySQL, vitest. 로컬 import는 `.js` 확장자 필수.

## Global Constraints
- **광주/전남 기존 slug 유지**(통합 미채택). 코드12 자치구 `{12210,12240,12270,12300,12330}`→`gwangju`, 그 외 `12###`→`jeonnam`.
- **인천 신설 4구 채택**: 제물포→jemulpo, 영종→yeongjong, 서해→seohae, 검단→geomdan. 옛 중구/동구/서구 slug 불변.
- `buildRegionFilter` **반환 shape 불변**(소비처 4개 무해) — 변형(variant) `in` 목록에만 추가, **district 있을 때만** 통합명 추가(city-hub 오버매칭 방지).
- `cityVariantList`(facility 전용) **불변**(범위 밖).
- 프로덕션 Region.slug 갱신은 **인천 4구 타깃**(broad `fixRegionSlugs` 지양).
- hotspot 방어 가드: citySlug 빈값·districtSlug 비ASCII 행 제외 + 제외 로그.

---

## Task 1: `resolveCitySlug` + `GWANGJU_GU_BJD` (cityMapping.ts)

**Files:**
- Modify: `backend/src/services/cityMapping.ts`
- Test: `backend/__tests__/services/cityMapping.test.ts` (없으면 생성; 위치는 기존 테스트 관례 확인)

**Interfaces:**
- Produces: `GWANGJU_GU_BJD: Set<string>`, `resolveCitySlug(bjdCode: string, city: string): { citySlug: string; cityLabel: string }`

- [ ] **Step 1: 실패 테스트** — 12240→{gwangju,광주}, 12130→{jeonnam,전남}, 12110→{jeonnam,전남}, 12330→gwangju, "44"+충남→{chungnam,충남}, 미지코드+미지도시→{'',그도시}.
- [ ] **Step 2: 구현**
```ts
export const GWANGJU_GU_BJD = new Set(['12210', '12240', '12270', '12300', '12330']);

export function resolveCitySlug(bjdCode: string, city: string): { citySlug: string; cityLabel: string } {
  if (bjdCode.startsWith('12')) {
    return GWANGJU_GU_BJD.has(bjdCode)
      ? { citySlug: 'gwangju', cityLabel: '광주' }
      : { citySlug: 'jeonnam', cityLabel: '전남' };
  }
  const slug = SHORT_TO_SLUG[city] || FULL_TO_SLUG[city] || '';
  return { citySlug: slug, cityLabel: CITY_SLUG_TO_SHORT[slug] || city };
}
```
- [ ] **Step 3: 테스트 통과 + 커밋**

---

## Task 2: `buildRegionFilter` 통합시 district-level 변형 추가

**Files:**
- Modify: `backend/src/services/cityMapping.ts` (`buildRegionFilter`)
- Test: 동 test 파일

**Interfaces:**
- Consumes: 기존 시그니처 `buildRegionFilter(city?, district?)` 불변.

- [ ] **Step 1: 실패 테스트**
  - `buildRegionFilter('광주광역시','서구')` → `city.in`에 `전남광주통합특별시` 포함, `district==='서구'`
  - `buildRegionFilter('전라남도','여수시')` → `city.in`에 통합명 포함
  - `buildRegionFilter('광주광역시')` (district 없음) → `city.in`에 통합명 **미포함**(city-hub 안전)
  - `buildRegionFilter('부산광역시','서구')` → 통합명 미포함(무관 도시 회귀 없음)
- [ ] **Step 2: 구현** — `if (slug)` 블록에서 variants 계산 직후:
```ts
if ((slug === 'gwangju' || slug === 'jeonnam') && district) {
  variants.add('전남광주통합특별시');
}
```
- [ ] **Step 3: 테스트 통과 + 커밋**

---

## Task 3: 인천 신설구 로마자 매핑 (syncRegion.ts)

**Files:**
- Modify: `backend/src/scripts/syncRegion.ts` (`KOREAN_TO_ROMANIZATION`)
- Test: `backend/__tests__/scripts/normalizeKoreanToSlug.test.ts`(관례 위치) — `normalizeKoreanToSlug`가 export됨.

- [ ] **Step 1: 실패 테스트** — `normalizeKoreanToSlug('제물포구')==='jemulpo'`, `'영종구'==='yeongjong'`, `'서해구'==='seohae'`, `'검단구'==='geomdan'`, 기존 `'서구'==='seo'` 회귀 없음.
- [ ] **Step 2: 구현** — `KOREAN_TO_ROMANIZATION`에 4쌍 추가(접미 `구` 제외 값):
```
'제물포구': 'jemulpo', '영종구': 'yeongjong', '서해구': 'seohae', '검단구': 'geomdan',
```
- [ ] **Step 3: 테스트 통과 + 커밋**

> 프로덕션 Region.slug 실제 갱신은 롤아웃(Task 5)에서 **타깃 업데이트**로 수행. 이 태스크는 사전(사전 갱신 후 재싱크도 정상) 코드만.

---

## Task 4: hotspot 서비스 — bjdCode 해석 + 방어 가드

**Files:**
- Modify: `backend/src/services/realEstateHotspotService.ts`
- Test: `backend/__tests__/services/realEstateHotspotService.test.ts` (순수 함수 대상)

**Interfaces:**
- Consumes: `resolveCitySlug` (Task 1)
- 쿼리 SELECT에 `reg.bjdCode AS bjdCode` 추가; `RawPricedRow`/`RawWolseRow`에 `bjdCode: string` 추가.

- [ ] **Step 1: 순수화** — normalize+guard를 테스트 가능한 순수 함수로 추출. 예:
```ts
export function normalizeAndGuard(rows: RawPricedRow[]): HotspotRegion[] {
  const out: HotspotRegion[] = [];
  for (const r of rows) {
    const { citySlug, cityLabel } = resolveCitySlug(r.bjdCode, r.city);
    const districtSlug = r.districtSlug ?? '';
    // 방어 가드: 미매핑 도시 / 로마자화 안 된 구 → URL 불가 → 제외
    if (!citySlug || !/^[\x00-\x7F]+$/.test(districtSlug)) {
      console.warn(`[hotspot] skip unroutable region: ${r.city} ${r.district} (${r.bjdCode})`);
      continue;
    }
    out.push({
      citySlug, city: cityLabel, districtSlug, district: r.district,
      pricePerPyeong: toNumberOrNull(r.pricePerPyeong),
      txnCount: Number(r.txnCount),
      changePct: toNumberOrNull(r.changePct),
      volumeChangePct: toNumberOrNull(r.volumeChangePct),
    });
  }
  return out;
}
```
- [ ] **Step 2: 실패 테스트**
  - 코드12 서구 행 → `citySlug==='gwangju'`, `city==='광주'`, 유지
  - 코드12 여수시 행 → `citySlug==='jeonnam'`, `city==='전남'`
  - districtSlug 한글('서해구') 행 → **제외**(guard)
  - citySlug 빈값 유발(bjdCode 비'12' + 미지 city) → **제외**
  - 정상 충남 아산 행 → 유지, citySlug='chungnam'
- [ ] **Step 3: 구현** — 두 쿼리 SELECT에 `reg.bjdCode AS bjdCode`; 타입에 `bjdCode` 추가; `getPricedSliceHotspots`는 `normalizeAndGuard(rows)`로 `all` 산출; `getWolseHotspots`는 동일 가드 적용(citySlug 해석·비ASCII 제외).
- [ ] **Step 4: 백엔드 전체 vitest + 커밋**

---

## Task 5: 롤아웃 · 검증 (코드 아님)

- [ ] 코드 PR(Task 1~4) → CI green → **opus 코드리뷰**(공용 소비처 4개 영향 검증) → develop 머지 → main 승격 → Cafe24 배포.
- [ ] **프로덕션 데이터 op**(인천 4구 타깃):
```sql
UPDATE Region SET slug='jemulpo'   WHERE bjdCode='28125';
UPDATE Region SET slug='yeongjong' WHERE bjdCode='28155';
UPDATE Region SET slug='seohae'    WHERE bjdCode='28275';
UPDATE Region SET slug='geomdan'   WHERE bjdCode='28290';
```
(또는 bjdCode 화이트리스트 스크립트. broad `fixRegionSlugs` 지양.)
- [ ] hotspot 인메모리 캐시(1h TTL) 무효화 → **pm2 restart** + nginx/nitro 캐시 퍼지.
- [ ] **라이브 검증(Playwright)**: 홈 오늘의 부동산 전 탭·전 랭킹 링크 200; `//`·한글 slug URL 0; `/real-estate/apt-sale/gwangju/seo`·`/jeonnam/yeosu`·`/incheon/seohae` 실데이터 노출; `/api/meta/regions?city=인천` 비ASCII slug 0.

---

## 후속(별도, 이 플랜 밖)
city-hub(`/gwangju` 등) bjdCode 스코프 · 서구→서해 301 · 옛코드29/46 정리 · 시설 지역페이지 점검 · 사이트맵 신설구 반영.
