# 2026 행정구역 개편 대응 — 지역 해석 복구 설계

**작성일:** 2026-07-14
**상태:** 설계 승인 대기 (결정 사항은 §3에서 확정)
**트리거:** 운영 홈 "오늘의 부동산 시장" 랭킹 클릭 시 404 (`/real-estate/apt-sale//seo`, `/real-estate/apt-sale/incheon/서해구`)
**범위:** 지역명/코드 변경으로 깨진 지역 해석(slug 파생·URL·필터) 복구. **1차 목표는 "오늘의 부동산" 404 제거**이며, 공용 지역 해석 코드를 함께 고쳐 동일 원인의 다른 표면도 해소.

---

## 1. 배경 — 2026-07-01 시행 2건의 행정개편

웹·운영 데이터로 확인 완료. **오염 데이터가 아니라 실제 행정개편**이다.

### 1-1. 전남광주통합특별시 출범 (대한민국 최초 광역통합)
- 광주광역시 + 전라남도 **폐지** → `전남광주통합특별시` 단일 광역단체로 통합.
- 전남 22개 시·군 + 광주 5개 자치구 = **27개 하위 행정구역**, 신설 법정동코드 접두 **`12`**.
- 출처: 연합뉴스 `AKR20260626109000054`, 행안부 korea.kr `148960435`, 특별법 law.go.kr `284111`.

### 1-2. 인천광역시 자치구 개편 ("2군 9구")
- **제물포구 신설**(중구 내륙 + 동구 통합), **영종구 신설**(중구 영종지역 분리), **검단구 신설**(서구 검단지역 분리).
- **서구 → 서해구 명칭 변경**(방위식 명칭 폐지). 데이터상 서해구는 신설 코드 `28275`로, 옛 서구 `28260`과 별개 행.
- 도시(인천광역시)는 불변. 출처: 인천투데이 `320725`, 서울신문 `20260701500070`, 인천시 공식.

---

## 2. 근본 원인 — "이름 문자열 기반" 지역 해석

운영 Region 전수(299행) 분석 결과, **깨짐은 딱 두 종류로 한정**된다(다른 지역엔 미매핑 도시·비ASCII slug 없음).

### 2-1. 데이터 현황 (운영)
- Region 테이블에 **구/신 하이어라키 공존**: 옛 `광주`(코드29·5구)·`전남`(코드46·22군) 잔존 + 신설 `전남광주통합특별시`(코드12·27구) 추가. 인천도 옛 중구/동구/서구 + 신설 4구 공존.
- **거래 데이터는 신설명·신설코드로 재싱크됨**(예: `city="전남광주통합특별시"`, `bjdCode=12240`; `city="인천", district="서해구", bjdCode=28275`).

### 2-2. 코드가 깨지는 두 지점
`realEstateHotspotService.ts`(오늘의 부동산 데이터 소스) 기준:

| # | 지점 | 현재 로직 | 신설 데이터에서의 결과 |
|---|---|---|---|
| A | **citySlug** | `cityToSlug(city) = FULL_TO_SLUG[city] ?? SHORT_TO_SLUG[city] ?? ''` (`cityMapping.ts`) | `전남광주통합특별시` 미등록 → **`''`** → URL `//seo` **404** |
| B | **districtSlug** | `INNER JOIN Region reg` → `reg.slug` (`syncRegion.normalizeKoreanToSlug`가 생성) | 인천 신설 4구 `KOREAN_TO_ROMANIZATION` 미등록 → **한글 원문**(`서해구`) → URL `/incheon/서해구` **404** |

> **핵심**: hotspot의 이름-조인(`reg.city=r.city AND reg.district=r.district`)은 **성공**했다. 깨진 건 순전히 **slug 파생**(하드코딩 이름→slug 맵·로마자 사전 미갱신)이다. 즉 "조인을 코드로 바꾸는 것"이 해법이 아니라, **slug 파생을 신설명/신설코드까지 커버**하는 것이 해법이다.

### 2-3. 도착 페이지도 함께 깨진다 (링크만 고치면 안 되는 이유)
`buildRegionFilter(city, district)`(`cityMapping.ts`)는 citySlug를 city **이름 변형**(광주광역시/광주)으로 풀어 `where city IN (variants)`로 매칭한다. 신설명 `전남광주통합특별시`가 변형 목록에 없으므로 `/gwangju/seo` 페이지는 **코드12 데이터를 못 찾는다**. → 링크 생성부·도착 필터·Region.slug 데이터 **3자를 함께** 맞춰야 실제로 열린다.

---

## 3. 확정된 제품 결정 (대화로 합의)

### D1. 전남광주통합특별시 → **기존 광주/전남 slug 유지** (통합 미채택)
- **결정**: 사용자에게는 `광주`/`전남` 두 허브 그대로. 내부 데이터(코드12)를 기존 slug로 **되돌려 매핑**.
- **근거**: ① 검색 인텐트는 "광주 서구", "여수 부동산"이며 통합명 검색량≈0. ② 통합 채택 시 `/gwangju/*`·`/jeonnam/*` 수천 색인 URL을 301 이관 → **네이버 노출 회복 지연 리스크**(이 사이트의 최대 자산). ③ 27개(도심 자치구+농어촌 시군) 단일 허브는 UX 악화. → **얻는 사용자 가치 대비 리스크 과다**.
- 통합창원시를 마산/진해로 나눠 보여주는 관행과 동일 논리.

### D2. 인천 신설 4구 → **채택** (로마자 slug 신설)
- **결정**: `제물포/영종/서해/검단`을 로마자 slug로 채택하고 Region.slug 갱신. 옛 중구/동구/서구 URL은 **보존**(색인 자산). 신규 데이터는 신설구로 유입.
- **근거**: 광주 통합명과 달리 **검단신도시·영종도 등은 실제 검색되는 진짜 지명**(durable 검색가치 있음).
- **관통 원칙(D1·D2 공통)**: *색인 URL 보존 + durable 검색 인텐트.* 사실이 달라 결론이 다를 뿐.

### D3. 서구→서해구 개명 → **당장 301 안 함, 병존**
- `/incheon/seo`(강한 검색량) 유지 + `/incheon/seohae` 병존. 데이터상 서구(28260)·서해구(28275)가 별개 코드/행이라 충돌 없이 공존. 301 여부는 노출 추이 보고 **추후 결정**(범위 밖).

### D4. 지역 해석은 **bjdCode 기준**으로 (통합시 한정)
- 통합시(코드12) 데이터는 city명이 하나(`전남광주통합특별시`)라 이름만으론 광주/전남을 구분 못 한다. → **bjdCode로 disambiguate**.
- `광주 자치구 코드 집합` = `{12210 동구, 12240 서구, 12270 남구, 12300 북구, 12330 광산구}` → `gwangju`. 그 외 `12###` → `jeonnam`.

---

## 4. 설계

### 4-1. 공용 지역 해석 모듈 (신규 or `cityMapping.ts` 확장)
통합시 매핑 로직을 **한 곳**에 둔다(향후 개편 시 이 파일만 수정). 제안: `backend/src/services/regionResolve.ts`.

```ts
// 광주 5개 자치구 bjdCode(코드12) — 통합시 데이터를 gwangju로 되돌리는 집합
export const GWANGJU_GU_BJD = new Set(['12210', '12240', '12270', '12300', '12330']);

// bjdCode + city명 → 사이트 안정 citySlug + 표시 라벨(short)
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

### 4-2. `buildRegionFilter` — 통합시 데이터 포함 (도착 페이지)
citySlug `gwangju`/`jeonnam` 질의가 코드12 데이터를 잡도록 확장. **city-hub 오버매칭 방지를 위해 bjdCode 조건을 병용**한다.

- **district 지정 시**(예: `/gwangju/seo`): city 변형에 `전남광주통합특별시` 추가해도 안전 — 구명(서구)이 광주/전남 간 겹치지 않아 disambiguate됨.
- **city만 지정 시**(허브 `/gwangju`): 이름 변형에 `전남광주통합특별시`를 넣으면 27구 전체를 끌어와 **오버매칭**(전남 시군까지 노출) → 반드시 `bjdCode IN (해당 slug의 코드집합)` 조건으로 스코프.

```ts
// gwangju: (city IN [광주광역시,광주]) OR (bjdCode IN GWANGJU_GU_BJD)
// jeonnam: (city IN [전라남도,전남]) OR (bjdCode LIKE '12%' AND bjdCode NOT IN GWANGJU_GU_BJD)
```
> RE 거래 테이블·Region 모두 `bjdCode` 보유(거래=인덱스). 조건 병용 가능.

### 4-3. 인천 신설구 로마자화 (데이터)
`syncRegion.ts`의 `KOREAN_TO_ROMANIZATION`에 추가(값은 관례대로 접미 `구` 제외):
```
'제물포구' → 'jemulpo', '영종구' → 'yeongjong', '서해구' → 'seohae', '검단구' → 'geomdan'
```
→ 경량 스크립트 **`fixRegionSlugs.ts`**로 해당 4개 Region.slug만 갱신(전체 재싱크 불필요). 갱신 후 `/incheon/seohae` 링크·도착·필터 3자 정합.

### 4-4. 방어 가드 (hotspot) — 핵심 안전망
`realEstateHotspotService` 최종 산출에서 **citySlug 빈값 또는 districtSlug 비ASCII 행은 제외**(랭킹·링크 미생성).
- 효과: ① 오늘 당장 404 제거(4-2/4-3 반영 전에도). ② **향후 또 개편돼 미처 매핑 못 한 지역이 와도 404를 절대 안 냄**(회귀 영구 방지).
- 로그: 제외된 (city, district, bjdCode)를 `log`로 남겨 미매핑 지역을 조기 인지(무음 누락 금지).

---

## 5. 범위

### In scope (본 스펙)
1. 공용 `resolveCitySlug` + `GWANGJU_GU_BJD` (§4-1)
2. `realEstateHotspotService`: bjdCode SELECT 추가, citySlug/라벨을 `resolveCitySlug`로, 방어 가드 (§4-4)
3. `buildRegionFilter`/`cityVariantList`: 통합시 코드12 스코프(§4-2)
4. `KOREAN_TO_ROMANIZATION` + `fixRegionSlugs` 인천 4구 (§4-3)
5. 테스트 + 운영 데이터 op(fixRegionSlugs) + 라이브 검증

### Out of scope / 후속(별도 결정)
- **통합시 단일 허브화**(D1에서 반려) — 원한다면 별도 대규모 301 이관 이니셔티브.
- **서구→서해구 301**(D3, 추후 노출 추이 보고).
- **옛 코드(29/46, 인천 중구/동구/서구) 잔존 데이터·URL 정리**(301/유지). 현재는 병존 유지.
- **시설(facility) 쪽 동일 원인 점검** — hotspot(부동산)이 보고된 버그. 시설도 `bjdCode` 보유하나 지역 페이지 필터는 별도 확인 필요 → 후속.
- **사이트맵 신설구 반영**(인천 신설 4구 URL 사이트맵 추가) — 채택(D2)이므로 후속 포함 권장.
- city-hub(`/gwangju`, `/jeonnam`) 집계가 코드12 반영되는지 — §4-2로 커버되나 허브 페이지 별도 검증.

---

## 6. 엣지 케이스 · 리스크

| 항목 | 처리 |
|---|---|
| **city-hub 오버매칭** (`/gwangju`가 전남 시군까지) | §4-2 bjdCode 조건 병용으로 방지. 반드시 허브·상세 양쪽 테스트. |
| **Region unique 충돌** | 코드12 행을 `광주광역시`로 rename하면 옛 코드29 행과 `@@unique([city,district])` 충돌 → **rename 안 함**. bjdCode 매핑으로 우회(D4). |
| **옛 코드 데이터 stale** | 신규 데이터가 코드12로 유입되어 옛 광주(29) 페이지는 서서히 정적화. 색인 콘텐츠는 보존(허용). 후속 정리 대상. |
| **구명 충돌 검증** | 광주 자치구(동/서/남/북/광산구) ∩ 전남 시군 = ∅ 확인됨. district-level 변형 매칭 안전. |
| **방어 가드가 실데이터를 숨김** | 인천 4구는 §4-3 반영 전까지 랭킹에서 빠짐(404 대신 미노출). 반영 후 복귀. `log`로 가시화. |
| **운영 캐시** | hotspot 인메모리 캐시(1h TTL) + nitro swr + nginx. 배포 후 캐시 퍼지/재기동 필요(외부 sync는 인메모리 무효화 못함 — 기존 교훈). |

---

## 7. 테스트 전략

- **`resolveCitySlug`(단위)**: 12240→gwangju/광주, 12130→jeonnam/전남, 28275→(city명 인천 경유) incheon, 서울 등 기존 불변, 미지 코드→빈 slug.
- **`buildRegionFilter`(단위)**: `/gwangju/seo`가 코드12 서구 포함, `/gwangju`(허브)가 전남 시군 **미포함**(오버매칭 가드), `/jeonnam/yeosu` 포함, 기존 지역 회귀 없음.
- **hotspot 가드(단위)**: 빈 citySlug·비ASCII districtSlug 행 제외 + 정상 행 유지, 제외 로그.
- **`normalizeKoreanToSlug`(단위)**: 인천 4구 → 로마자.
- **회귀**: 백엔드 전체 vitest.

---

## 8. 롤아웃 · 검증

1. 코드 PR(§4-1/4-2/4-4 + §4-3 사전) → CI green → 리뷰 → develop 머지.
2. main 승격 → Cafe24 배포.
3. **운영 데이터 op**: `npx tsx src/scripts/fixRegionSlugs.ts`(또는 대상 4구 한정) 실행 → Region.slug 로마자화 검증(`/api/meta/regions?city=인천`에 비ASCII slug 0).
4. **캐시 퍼지** + pm2 재기동(hotspot 인메모리 캐시 무효화).
5. **라이브 검증(Playwright)**: 홈 "오늘의 부동산" 전 랭킹 링크 200(광주/전남/인천 포함), `//`·한글 slug URL 0, `/gwangju/seo`·`/jeonnam/yeosu`·`/incheon/seohae` 실데이터 노출.

---

## 9. 미해결/후속 결정
- 서구→서해구 301 시점(노출 추이).
- 옛 코드(29/46, 인천 old) 데이터·URL 최종 처리.
- 시설(facility) 지역 페이지 동일 점검.
- 사이트맵 신설구 반영.
- (선택) 통합시 인지용 안내 문구/리다이렉트 — 현재는 불필요.

---

## 부록 A — 코드12 하위 27구 분류
- **gwangju(자치구 5)**: 12210 동구, 12240 서구, 12270 남구, 12300 북구, 12330 광산구
- **jeonnam(시 5)**: 12110 목포, 12130 여수, 12150 순천, 12170 나주, 12190 광양
- **jeonnam(군 17)**: 12710 담양, 12720 곡성, 12730 구례, 12740 고흥, 12750 보성, 12760 화순, 12770 장흥, 12780 강진, 12790 해남, 12800 영암, 12810 무안, 12820 함평, 12830 영광, 12840 장성, 12850 완도, 12860 진도, 12870 신안

## 부록 B — 인천 신설/변경
- 신설: 28125 제물포구(jemulpo), 28155 영종구(yeongjong), 28290 검단구(geomdan)
- 변경: 28275 서해구(seohae, 옛 서구서 개명·별도 코드)
- 옛(보존): 28110 중구(jung), 28140 동구(dong), 28260 서구(seo)
