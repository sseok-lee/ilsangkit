# 부동산 단지 상세 페이지 SEO 메타 & OG 라우트 개선

- 작성일: 2026-05-22
- 상태: Draft (사용자 리뷰 대기)
- 관련 페이지: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
- 관련 라우트: `frontend/server/routes/og.get.ts`, `frontend/server/routes/og-map.get.ts`

## 배경

네이버 검색 결과에서 부동산 단지 상세 페이지가 노출되는 카드 품질이 두 가지 측면에서 부실하다.

1. **메타 description이 채택되지 않음.** 단지 페이지의 `<meta name="description">`이 네이버 SERP에 노출되지 않고, 페이지 본문에서 발췌된 문자열("최근 거래 : 1억 700만원, 최근 거래일 : 2026년 5월, 건축년도 : 1996년, 전용면적 : 59.95㎡" 같은 형태)이 대신 표시된다. 우리가 의도한 description의 키워드 농도가 본문보다 낮거나 정보 매칭이 약하다는 신호.
2. **OG 지도 이미지가 일부 단지에서 누락.** 좌표가 있는 단지에서도 OG 카드에 지도가 표시되지 않는 케이스가 관찰됨. 원인 진단 결과 `og-map.get.ts`가 NCP 호출 실패 시 `og`로 302 리다이렉트하는 다단계 fallback 구조가 봇 친화적이지 않음 + 한글 label이 NCP markers spec을 깨뜨리는 케이스 존재.

타이틀도 모든 단지에 동일 패턴이라 차별점이 부족하고, `| 일상킷` 접미가 네이버 SERP 글자수 한도에서 잘리는 문제.

## 목표

- 네이버가 본문 발췌 대신 우리 description을 채택할 가능성을 높인다.
- 단지마다 다른 텍스트로 타이틀을 차별화한다.
- OG 지도 이미지가 좌표 있는 모든 단지에서 안정적으로 노출되도록 한다.

## 비목표 (Out of Scope)

- 시군구/시도 허브 페이지의 SEO 메타 (별도 PR).
- OG 카드 SVG 디자인 자체의 리뉴얼.
- 좌표 없는 단지의 지오코딩 백필 작업.
- 구글/카카오 SERP 동작 검증 (네이버 우선).

## 설계

### Title 패턴

```
{buildingName} {typeLabel} {transactionLabel} 실거래 · {city} {district} {dongName?}
```

- 변경:
  - 기존 `시세 · 매매 실거래가` 의미 중복 → `매매 실거래`로 단순화.
  - 후미 `| 일상킷` 제거 (네이버 SERP에서 어차피 잘림).
  - 위치 표기에 동/리(`dongName`) 추가해 단지마다 다른 타이틀 확보.
- 예: `새한A 아파트 매매 실거래 · 광주 북구 용봉동` (30자 내외)
- `dongName` 누락 시: `새한A 아파트 매매 실거래 · 광주 북구`
- city/district 동시 누락 시: `새한A 아파트 매매 실거래`

### Description 패턴 (문장형 A)

```
{region} {buildingName} {typeLabel} {transactionLabel} 실거래 {totalCount}건.
최근 거래가는 {recentPrice}({recentDate}), {buildYear}년 준공된 단지입니다.
전용 {areaRange}㎡ 면적별 시세와 거래 내역,
인근 {facilitySummary}과 주변 시세를 함께 확인하세요.
```

- 길이: ~130~145자 (네이버 description 최적 영역).
- `facilitySummary`는 기존 SSR 코드가 이미 산출 (`인근 학교 5곳, 병원 12곳 등 생활시설` 같은 형태). 추가 fetch 없음.
- "주변 시세"는 실제 데이터 fetch가 아니라 호소문구. 사용자가 페이지 안에서 priceAnalysis/nearby를 확인할 수 있다는 안내.

#### 빈 값 fallback

| 누락 | 처리 |
|---|---|
| `summary.totalCount` 없음 | "실거래 N건. 최근 거래가는 ..." 절 통째 생략 |
| `summary.recentDeal` 없음 | "최근 거래가는 X(날짜)" 절 생략 |
| `buildYear` 없음 | "준공된 단지입니다" 표현 제거, "최근 거래가는 X입니다"로 마무리 |
| `areaRange` 없음 | "전용 N㎡" 제거, "면적별 시세와 거래 내역" 부분 단순화 |
| `facilitySummary` 없음 | "인근 ... 등 생활시설" 절 통째 생략, "주변 시세를 함께 확인하세요" 만 남김 |
| 전부 없음 | `{region} {buildingName} {typeLabel} {transactionLabel} 실거래가. 주변 시세를 함께 확인하세요.` |

#### 면적 범위 포매팅

- 단일 면적: `전용 60㎡`
- 범위: `전용 39~59㎡` (소수점 반올림)

### 데이터 소스 변경

#### Backend: `getBuildingInfo`에 대표 동/리 추가

`backend/src/services/realEstateService.ts:getBuildingInfo`가 반환 객체에 `dongName: string | null` 필드 추가.

```typescript
// 현재
return { name, city, district, lat, lng, bjdCode, ... }
// 변경
return { name, city, district, dongName, lat, lng, bjdCode, ... }
```

대표 동 산출 방법: 해당 단지의 트랜잭션을 `dongName`으로 groupBy → 가장 거래량 많은 동 1개. 0건이면 null. 시군구 페이지에서 단지를 노출할 때도 동일 필드를 활용 가능 (보너스 효과).

추가 쿼리는 단지 단위 1회 — N+1 없음.

#### Frontend: useHead 재작성

`buildingName.vue:558-611`의 `useHead()` 콜백을 별도 composable로 추출.

```typescript
// frontend/composables/useRealEstateDetailMeta.ts (신규)
export function buildRealEstateDetailMeta(input: {
  buildingName: string
  region: { city: string; district: string; dong?: string | null }
  propertyType: 'apt' | 'villa' | 'offitel'
  transactionMode: 'sale' | 'rent'
  summary: {
    totalCount?: number
    recentDeal?: { amount: number; dealDate: string }
  } | null
  buildYear?: number | null
  areaRange?: { min: number; max?: number } | null
  facilitySummary?: string | null
}): { title: string; description: string }
```

순수 함수로 만들어 단위 테스트 가능. `buildingName.vue`는 이 결과를 받아 `useHead`에 넘김.

### OG 라우트 fix

#### `og-map.get.ts` — 다단계 302 제거 (핵심)

**현재 동작**: NCP 호출 실패 시 `fallbackRedirect`로 `/og`로 302 → og가 SVG/PNG 반환. 봇은 og:image에서 다단계 302를 잘 따라가지 않음.

**변경**: NCP 실패 시 동일 핸들러 내에서 `generateOgImageSvg`를 직접 호출해 200 응답으로 끝낸다.

```typescript
async function inlineFallback(event, query) {
  const category = String(query.category ?? 'apt') as FacilityCategory
  const title = String(query.title ?? '')
  const city = query.city ? String(query.city) : undefined
  const district = query.district ? String(query.district) : undefined

  const svg = generateOgImageSvg({ category, title, city, district })
  try {
    const sharp = await import('sharp').then(m => m.default)
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return pngBuffer
  } catch {
    setHeader(event, 'Content-Type', 'image/svg+xml')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return svg
  }
}
```

기존 `fallbackRedirect`는 제거.

#### `og-map.get.ts` — 한글 label sanitize

NCP markers spec(`type:d|size:mid|pos:LNG LAT|label:LABEL`)은 `|`, `:`, 공백이 구분자. label에 이 문자가 들어가면 spec이 깨진다. 또한 길이 30자도 NCP 권장(20자)보다 길다.

```typescript
function sanitizeLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const cleaned = raw
    .replace(/[|:]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 20)
  return cleaned || undefined
}
const label = sanitizeLabel(query.label ? String(query.label) : undefined)
```

#### `og-map.get.ts` — 실패 로깅

`catch {}`를 `catch (err) { console.warn('[og-map] NCP failed', { lat, lng, error: String(err) }); return inlineFallback(...) }`로 변경. PM2 로그에서 실패 빈도 추적 가능.

#### `og.get.ts` — 변경 없음

`VALID_CATEGORIES`는 옛 슬러그(`apt`, `villa`, `offitel`)만 유지. 단지 상세 페이지가 `category=apt` 등 옛 슬러그를 보내는 게 정식 (`propertyTypeParam = realEstateType.split('-')[0]`). 새 슬러그 추가는 불필요.

기존 테스트 `tests/composables/useRealEstateMeta.test.ts`가 `/og?category=villa` 같은 호출을 검증 중 → **변경 없음으로 회귀 없음**.

## 영향 범위

### 변경되는 파일

| 파일 | 변경 |
|---|---|
| `backend/src/services/realEstateService.ts` | `getBuildingInfo`에 `dongName` 추가 (groupBy 쿼리 1회) |
| `backend/src/routes/realEstate.ts` 또는 관련 schema | `BuildingInfoSchema`에 `dongName` 옵션 필드 추가 |
| `frontend/composables/useRealEstateDetailMeta.ts` | 신규 — title/description 빌더 |
| `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` | `useHead` 콜백이 신규 composable 사용 |
| `frontend/server/routes/og-map.get.ts` | sanitizeLabel + inlineFallback + 로깅 |
| `frontend/tests/composables/useRealEstateDetailMeta.test.ts` | 신규 단위 테스트 |
| `frontend/tests/server/og-map.test.ts` | NCP mock 통합 테스트 (필요 시 신규) |

### 변경되지 않는 파일

- `frontend/server/routes/og.get.ts` (VALID_CATEGORIES 그대로)
- `frontend/server/utils/ogImage.ts` (SVG 생성 그대로)
- 시도/시군구 허브 페이지
- canonical, robots, structured data 로직

## 데이터 흐름

```
URL /real-estate/apt-sale/seoul/mapo/마포프레스티지자이
  ↓
buildingName.vue SSR asyncData
  ↓
[Promise.allSettled]
  - getTransactionStats     → summary
  - searchTransactions      → recent deal
  - getBuildingInfo         → coords + dongName (NEW)
  - getAreaGroups           → area range
  - $fetch /api/facilities  → facilitySummary
  ↓
buildRealEstateDetailMeta({ ... })   ← 신규 composable
  ↓
useHead({ title, description, og:image, ... })
  ↓
SSR HTML response
```

OG 이미지 측면:

```
<meta property="og:image" content="/og-map?lat=...&lng=...&label=...&category=apt&...">
  ↓
GET /og-map?...
  ↓
좌표 + 인증 유효?
  ├─ NO  → inlineFallback → 200 SVG/PNG
  └─ YES → NCP Static Map API
            ├─ 200 OK → 200 PNG (1024x536)
            └─ 실패   → console.warn + inlineFallback → 200 SVG/PNG
```

## 테스트 전략

### Unit (Vitest)

`frontend/tests/composables/useRealEstateDetailMeta.test.ts`:
- ✅ 풀세트 입력 → 기대 title/description 정확 매칭
- ✅ `dong` 없음 → title에 동 부분 생략
- ✅ `summary.totalCount` 0 → description에서 거래량 문장 생략
- ✅ `buildYear` null → "준공된 단지입니다" 부분 제거
- ✅ `areaRange` 단일값 vs 범위
- ✅ `facilitySummary` null → 인근 시설 절 통째 생략
- ✅ 모든 옵셔널 누락 → 최소 description ("실거래가. 주변 시세를 함께 확인하세요.")

`frontend/tests/server/og-map-sanitize.test.ts`:
- ✅ `sanitizeLabel('새한A')` === `'새한A'`
- ✅ `sanitizeLabel('새한|A')` === `'새한A'`
- ✅ `sanitizeLabel('a:b')` === `'ab'`
- ✅ `sanitizeLabel('  공백  ')` === `'공백'`
- ✅ 21자 → 20자로 잘림
- ✅ `undefined` → `undefined`

### Integration (Vitest + fetch mock)

`frontend/tests/server/og-map.test.ts`:
- ✅ NCP mock 200 → PNG 반환 (1024x536, content-type image/png)
- ✅ NCP mock 4xx → SVG/PNG inline fallback 200 (302 아님)
- ✅ NCP mock timeout → 동일 fallback
- ✅ 좌표 무효 → 즉시 inline fallback 200
- ✅ NCP 인증 정보 없음 → 즉시 inline fallback 200

### Smoke (production curl)

`scripts/verify-og.sh` (새로 추가):
```bash
#!/bin/bash
set -euo pipefail
URLS=(
  "https://ilsangkit.co.kr/og-map?lat=35.17&lng=126.91&label=test&category=apt"
  "https://ilsangkit.co.kr/og-map?lat=35.17&lng=126.91&label=%EC%83%88%ED%95%9CA&category=apt"
  "https://ilsangkit.co.kr/og?category=apt&title=test"
)
for url in "${URLS[@]}"; do
  http=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  echo "$http $url"
  [ "$http" = "200" ] || exit 1
done
```

배포 직후 수동 실행. 모두 200이어야 함.

### E2E (Playwright, optional)

`frontend/tests/e2e/real-estate-detail-seo.spec.ts`:
```typescript
test('단지 상세 SEO 메타', async ({ page }) => {
  await page.goto('/real-estate/apt-sale/seoul/mapo/마포프레스티지자이')
  const title = await page.title()
  expect(title).toContain('마포프레스티지자이')
  expect(title).toContain('매매 실거래')
  expect(title).not.toContain('일상킷')

  const desc = await page.locator('meta[name="description"]')
    .getAttribute('content')
  expect(desc).toMatch(/매매 실거래 \d+건/)
  expect(desc).toContain('주변 시세를 함께 확인')

  const ogImage = await page.locator('meta[property="og:image"]')
    .getAttribute('content')
  expect(ogImage).toMatch(/^https?:\/\//)

  // og:image가 실제로 200으로 응답하는지
  const ogResp = await page.request.get(ogImage!)
  expect(ogResp.status()).toBe(200)
})
```

## 롤아웃 & 검증

1. **PR 머지 → 배포** (기존 워크플로우, PM2 reload).
2. **smoke 스크립트 실행** — 3개 URL 모두 200 확인.
3. **수동 SERP 검증** — 24~48시간 후 네이버 서치어드바이저에서 단지 페이지 색인 검사 실행, 갱신된 description/OG 이미지가 잡히는지 확인.
4. **로그 모니터링** — `[og-map] NCP failed` 빈도 추적. 일 100건 이상이면 NCP 쿼터/안정성 별도 조사.
5. **2~3주 후 효과 측정** — 부동산 카테고리의 CTR 변화, "발견됨-색인안됨" 큐 변화.

## 리스크 & 대응

| 리스크 | 가능성 | 대응 |
|---|---|---|
| 네이버가 여전히 본문 발췌 채택 | 중 | description 길이/키워드 조정 후 재배포. 본문에서 발췌되는 패턴(`최근 거래 : X만원`) 자체를 description에 더 가깝게 옮기는 옵션도 검토 |
| `getBuildingInfo`에 추가 쿼리로 응답 지연 | 낮 | dongName groupBy는 단일 쿼리 + bjdCode 인덱스 활용. 부하 미미 추정. 회귀 시 캐시 추가 |
| OG 이미지 sharp 미설치 시 SVG 응답 → 일부 봇이 SVG OG 거부 | 낮 | Cafe24 서버에 sharp 설치 상태 확인. 미설치면 PNG 대신 SVG로 응답하는 현재 동작 유지 |
| 한글 label sanitize가 NCP 마커 한글 노출에 영향 | 낮 | `|`/`:` 만 제거하고 한글 자체는 유지. NCP가 한글 label을 지원하지 않으면 시각적으로 마커 라벨만 잘릴 뿐 이미지는 정상 |

## 미해결 / 후속 작업

- 시군구/시도 허브 페이지 SEO 메타 개선 (별도 PR).
- 좌표 없는 단지의 지오코딩 백필 (별도 PR, 데이터 작업).
- OG 카드 SVG 디자인 리뉴얼 (별도 PR, 디자인 작업).
- description에 실제 priceAnalysis(평당가/역대 최고가) 통합 → SSR fetch 추가 필요, 효과 측정 후 별도 PR.

## 참고

- 5/3 부동산 URL 리팩터: `feat(seo): 부동산 허브 URL /real-estate/apt → /real-estate/apt-sale 구조 변경` (commit `ff8b24ff`)
- 5/14 cold-boot + 빈 캐시 패치: PR #244, #245
- 네이버 수집 차트 (2026-02-22 ~ 2026-05-22): 일 28k건/일 흡수 중, 응답시간 200~600ms로 자연 상승
