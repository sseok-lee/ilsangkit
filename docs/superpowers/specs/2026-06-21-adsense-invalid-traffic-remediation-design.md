# AdSense 무효 트래픽(광고 게재 제한) 대응 설계

- **작성일**: 2026-06-21
- **상태**: 설계 확정(구현 플랜 대기) — critic 적대 검증 1회 반영
- **트리거**: 2026-06-20 AdSense "광고 게재가 현재 제한적입니다 — 무효 트래픽 우려" (광고 게재 제한 시작일 2026-06-20)
- **퍼블리셔**: `ca-pub-2088264360250020`

---

## 1. 개요

2026-06-20 AdSense가 "무효 트래픽 우려"로 **광고 게재 제한**(서빙 스로틀)을 걸었다. 이는 계정 정지가 아니라 트래픽 품질 재평가 동안 노출량을 줄이는 보호 조치이며, **공식 이의신청 절차가 없고 트래픽이 정상화되면 자동 재심사로 해제**된다(통상 수 주~30일+).

본 설계의 목표:
1. 무효 트래픽을 발생시키는 **구조적 원인을 제거**하여 자동 재심사를 통과한다.
2. 재발을 막는 **항구적 게이팅/모니터링**을 도입한다.
3. 정당한 사용자 수익 인벤토리는 보존한다.

근본 원인 한 줄 요약: **"모바일 고밀도·대형 광고가 우발 클릭(클릭 품질 저하)을 유발하고, 동시에 실사용자가 아닌 컨텍스트(CI·봇·헤드리스·degraded 페이지)에서도 광고가 진짜로 발화된다."** (AdSense 데이터상 1차 원인은 클릭 품질 — §2.8 인과 비중 참조.)

---

## 2. 진단 (증거 기반)

### 2.1 AdSense 보고서 (6/14~6/20) — 클릭측 신호

| 날짜 | 수입($) | 페이지뷰 | 노출 | 클릭 | CTR | CPC($) |
|---|---|---|---|---|---|---|
| 6/14 | 28.67 | 7,458 | 40,148 | 564 | 1.40% | 0.05 |
| 6/15 | 35.09 | 9,242 | 50,856 | 586 | 1.15% | 0.06 |
| 6/16 | 26.73 | 8,278 | 44,719 | 564 | 1.26% | 0.05 |
| 6/17 | 25.12 | 7,318 | 38,951 | 566 | 1.45% | 0.04 |
| 6/18 | 21.75 | 6,043 | 31,636 | 465 | 1.47% | 0.05 |
| 6/19 | 21.70 | 5,183 | 27,152 | 412 | 1.52% | 0.05 |
| 6/20 | 19.13 | 4,607 | 23,507 | 415 | **1.77%** | 0.05 |

- **CTR이 1.15%→1.77%로 상승** + **CPC가 $0.04~0.06로 매우 낮음** = 전형적인 **우발/저품질 클릭** 시그니처.
- 페이지뷰 -38%·노출 -41%에 비해 클릭은 -26%만 감소 → 클릭이 트래픽과 무관하게 sticky.
- 노출·트래픽은 감소 추세 → **임프레션 폭주가 아니라 클릭 품질이 문제.**

### 2.2 nginx access log 포렌식 (서버 읽기전용, 6/14~6/21)

- **요청량은 스파이크가 아니라 감소**: 6/14 747,250 → 6/20 404,895 req/day. "갑작스런 유입" 가설 기각.
- **봇 비중 높음(6/20 상위 UA)**: Amazonbot 29k, Yeti(네이버) 22k, bingbot 14k, **HeadlessChrome 13.6k**, YandexBot 12k, curl 6.6k, Mediapartners-Google 6.9k(정상), IAS/comscore(광고검증, 정상).
- **HeadlessChrome 13.6k/일**은 대부분 `/sw.js`·`/_nuxt/builds/latest.json`·footer `_payload.json`을 ~50초 간격으로 폴링(콘텐츠 페이지 로드는 6건). 비인간이나 광고 임프레션 생성은 거의 없음 → 게이팅 대상이되 인과 비중 낮음.
- **취약점 스캐너** `185.177.72.x`(curl, 정확히 3000건씩): `/.env`·`/.git/config`·`/yarn.lock` 등 탐색 = 악성 정크, 광고 무관.
- incident(6/18~19)는 nginx 상태코드로 구분 불가(5xx 정상 수준) — 풀고갈 실패가 `200 OK + noindex`로 렌더됐기 때문.

### 2.3 코드 감사

- **광고 봇 게이팅 0**: `adsense.client.ts`가 UA 구분 없이 `adsbygoogle.js`를 onNuxtReady에 무조건 주입. `useDeferredAdSenseRequest`의 `canRequest` 기본값 `() => true`. **JS 실행하는 모든 비인간이 사람과 동일하게 광고 발화.**
- **degraded/noindex 페이지도 광고 그대로**: `markDegradedResponse`/`shouldNoindexSsr`로 503·noindex가 돼도 `AdBanner`는 무조건 렌더·요청. 4개 페이지(부동산 상세·지역 허브 2종·부동산 목록)에서 fetch 실패해도 광고 발화.
- **SPA soft-nav 재요청 스로틀 없음**: `AdBanner.vue`의 `watch(() => route.path)` → 즉시 push. debounce·쿨다운·체류 검증 없음.
- **단일 슬롯 공유**: 30+ 페이지가 `data-ad-slot="1878068382"` 하나를 공유.
- **모바일 고밀도·대형 광고**: 시설 상세 **모바일 6개**(article 내 280px 고정 4 + auto 2; L263 사이드바는 `<aside class="hidden md:flex">` 데스크톱 전용 → **데스크톱은 7개**), 부동산 상세 6개. 280px 사각형이 로드뷰·클릭 카드 인접.

### 2.4 Lighthouse CI — 자가 발화 (입증된 임프레션 위생 벡터)

`lighthouserc.js` + `.github/workflows/lighthouse.yml`:
- `npm run preview`(프로덕션 빌드)를 `localhost:4173`에 띄움 → `adtest` 꺼짐 + 진짜 `ca-pub-2088264360250020`.
- 측정 URL 6개(`/`, `/toilet`, `/toilet/<id>`(광고 7개), `/seoul/gangnam/toilet`, `/real-estate`, `/guide`) × `numberOfRuns: 3`.
- `nuxt.config` CSP가 `googlesyndication`·`doubleclick`·`adtrafficquality`를 허용 → 광고 요청 차단 없음.
- **`frontend/**` 변경 PR마다** GitHub Actions(Azure) 헤드리스 크롬이 실제 광고를 요청. 로그의 `4.155.x`/`40.125.x` Azure IP = GitHub 러너. (Lighthouse는 localhost를 서빙하므로 그 광고 요청은 nginx 로그엔 안 남지만, **광고 요청 자체는 러너에서 구글로 발화**된다.)
- 규모: PR당 ~18 광고페이지 로드(6 URL × 3회, 그중 광고 다수 페이지는 1개). 일 2.3만~4만 노출 대비 작음 → **단독 주범 아님, 위생 차원**(§2.8).

### 2.5 MPA(전면 document-load) 전환 — 증폭자

- `f15926d1`(2026-05-08) **"Reset ad-critical navigation to document loads"**: SPA가 모든 페이지를 "하나의 document 컨텍스트"로 묶어 누적 fill 한도로 unfill되던 문제를, 페이지간 주요 내비게이션을 `HardLink`(`<a href>`, 전체 새로고침)로 전환해 해결. 헤더/푸터/카드/홈 14파일, 이후 #410(auction)·#416(land) 확장, 현재 `HardLink` 112곳.
- 효과: **예전엔 unfill로 묻히던 광고 요청이 전면적으로 "카운트되는 노출"로 승격.** 사람·JS실행 봇 모두에 적용.
- `app/router.options.ts`는 slug 정규식일 뿐 MPA와 무관.
- **판정: 정책 위반 아님(document-load는 정책상 정상). 롤백 금지 — 정답은 봇 게이팅.**

### 2.6 레퍼런스 비교: ayo.pe.kr(찾아요!홈즈) vs 우리 (모바일 병원 상세, 실측)

| | ayo 병원상세 | 우리 병원상세 |
|---|---|---|
| 전체 높이 | ~9,161px | **7,558px** |
| 콘텐츠 | ~7,900px | 5,850px |
| 광고 총높이 | ~1,235px (**13%**) | **1,708px (23%)** |
| 광고 개수(모바일) | ~6 | **6**(L263 사이드바는 데스크톱 전용) |
| 광고 개당 높이 | 대부분 ~100px | 대부분 ~287px |
| 광고 밀도 | 1개 / ~1,317px | 1개 / **~975px** |

- ayo는 콘텐츠를 길게 패딩(지도·"같은 지역 병원" 링크 리스트)하고 **광고는 작게(100px)·13%**.
- 우리는 콘텐츠가 더 짧은데 **광고는 크게(287px)·23%**, 특히 상단에 280px 광고가 연속(시설 상세 기준). → 우발 클릭의 물리적 원인.

### 2.7 통합 인과 타임라인

```
5/08  전면 MPA(document loads)        → unfill→fill, 전역 노출 카운트 증가 (구조적 토대)
6/8~9 auction·land HardLink + onNuxtReady 플러그인 → 승격 확대·fill 신뢰도↑
6월   프론트 PR 폭증 → Lighthouse CI  → 매 PR Azure 헤드리스가 실광고 발화 (소량, 위생)
상시  봇 게이팅 0 + 모바일 고밀도·대형 광고 → 비인간 노출 + 우발 클릭(높은 CTR·낮은 CPC)
─────────────────────────────────────────
누적 "카운트되는 클릭/노출" 중 우발·비인간 비중 임계 초과 → 6/20 광고 게재 제한
```

### 2.8 인과 비중 (우선순위 결정)

AdSense 데이터(§2.1)가 가리키는 **1차 원인은 클릭 품질**(CTR↑·CPC↓ = 우발 클릭). 이를 직접 고치는 건 §4.2 **1.4(밀도·배치·간격)이며 이것이 1차 레버**다. CI/봇 게이팅(1.1·1.2)·degraded 분리(1.3)는 **임프레션측 위생/방어** — Lighthouse는 PR당 ~18 광고로드로 일 2.3만~4만 노출 대비 작아 단독 주범이 아니다. 따라서 우선순위:

> **1.4(클릭 품질) ＞ 1.1·1.2(임프레션 위생) ≈ 1.3(degraded).**

다만 1.1·1.2·1.3도 재발 방지·정책 정합을 위해 함께 시행한다.

### 2.9 범인에서 제외

- Playwright E2E(`ad-cls.spec.ts` 등): `localhost:3000` + dev `adtest=on`(테스트 광고) → 무죄. (현 `test.yml` PR 게이트는 E2E 미실행: vitest+build만.)
- 6/20 광고 커밋 `56d3cb70`(모바일 여백 축소): 시각 변경만, 요청 로직 불변 → 무죄.
- 자가 클릭: 사용자 확인 결과 없음(추정).
- ads.txt: `pub-2088264360250020` 정상.

---

## 3. 목표 / 성공 기준

1. **모바일 우발 클릭 구조 제거**(1차): 광고/콘텐츠 비율 ~13% 수준, 인터랙티브 요소와 안전 여백, 로드뷰·클릭카드 인접 광고 제거.
2. **실사용자가 아닌 컨텍스트에서 실광고 요청 0**: CI/Lighthouse/preview(=`adsEnabled=false`), 프로덕션 봇/헤드리스(=게이팅 best-effort).
3. **degraded/noindex 페이지에서 광고 발화 0**(SSR·클라이언트 네비 모두).
4. 정당한 사용자 노출/클릭은 유지(과탐 최소화) — **배포 후 실사용자 광고 정상 발화를 스모크로 확인**.
5. 배포 후 AdSense 무효 트래픽 지표 안정화 → 자동 재심사로 제한 해제.

---

## 4. 설계 (Approach A — 단계형 defense-in-depth)

### 4.1 핵심 추상화: 단일 광고 게이트

광고 발화 여부를 한 곳에서 결정한다. **레이어 주의**: 스크립트 주입(플러그인, 부팅 시 1회)은 페이지별 suppression을 반영할 수 없다(부팅 시점엔 페이지 상태가 없고, 한 번 주입된 스크립트는 되돌릴 수 없음). 따라서:

```
// frontend/composables/useAdsPolicy.ts (신규)
canLoadAdScript() === adsEnabled && !isLikelyBot()              // adsense.client.ts 플러그인 (2요소)
shouldServeAds()  === adsEnabled && !isLikelyBot() && !adsSuppressed()  // AdBanner / canRequest (3요소)
```

- **adsEnabled** — *CI/Lighthouse 차단의 유일한 보증*:
  - `nuxt.config.ts`에 **리터럴 boolean** `public: { adsEnabled: true }`로 선언. ⚠️ 문자열/`process.env` 읽기 금지 — 그래야 `NUXT_PUBLIC_ADS_ENABLED=false` 런타임 override가 boolean으로 강제 변환된다. 문자열이면 `"false"`가 truthy라 게이트가 열린 채 CI가 실광고를 계속 쏨(**green CI에서 조용히 실패**).
  - `useRuntimeConfig().public.adsEnabled`로 읽음.
- **isLikelyBot()** — *프로덕션 미지의 헤드리스에 대한 best-effort 방어(CI 주 방어 아님)*:
  - `navigator.webdriver === true` — **Playwright/Selenium은 잡지만 Lighthouse는 못 잡음**(Lighthouse는 chrome-launcher/CDP라 `webdriver=false`). Lighthouse는 `adsEnabled=false`로만 보증.
  - UA 매칭: `/Headless|playwright|puppeteer|bot|crawl|spider|slurp|bingbot|googlebot|yeti|yandex|amazonbot|bytespider|ahrefs|semrush/i` — `Headless`로 둬 구버전 `HeadlessChrome`와 신헤드리스 UA를 모두 커버(신 헤드리스 모드는 `HeadlessChrome` 토큰을 안 쓸 수 있음).
  - **allowlist-wins(우선)**: 실모바일(`NAVER(inapp`, `SamsungBrowser`, iPhone/Android Safari·Chrome)이면 위 매칭보다 **먼저** 통과(과탐=수익 손실). 구현 시 allowlist 우선순위 명시.
  - **SSR 시맨틱**: `navigator`/UA는 클라이언트 전용 → SSR에선 throw 금지, `false`(봇 아님) 기본, 실제 판정은 클라이언트. `AdBanner`의 `<ins>`가 `<ClientOnly>` + push도 클라이언트뿐이라 안전.
  - 비고: `Mediapartners-Google`(애드센스 자체 크롤러)는 push를 안 하므로 게이트 아웃돼도 무해하나, 페이지/광고 슬롯 **읽기는 막지 말 것**(광고 타게팅).
- **adsSuppressed()** — **`AdBanner`에서만** 소비(플러그인은 못 읽음): degraded/noindex 페이지가 set한 `useState<boolean>('ads:suppressed')`. 설정 방식은 §4.2 1.3 — **반드시 reactive**.

### 4.2 Phase 1 — 지혈 (우선 배포)

**1.4 (1차 레버) 우발 클릭 방지 — 개수 + 포맷 + 간격 + 라벨**

> ⚠️ 광고 개수/위치는 사용자 수익 정책. 본 변경은 **사용자 승인 완료**(상세 2종 6→4).

목표: 광고/콘텐츠 비율 23%→~13%, 모바일 상단 대형 광고 연속 제거.

- **시설 상세 `pages/[category]/[id].vue` (모바일 6 → 4)**

  | 라인 | 위치 | 조치 |
  |---|---|---|
  | L117 | HERO 아래 | 유지 (상단 1개 대형 사각형 허용) |
  | L123 | 상태↔기본정보 | 유지하되 280px 고정 → `variant="compact-mobile"`(≤150px) |
  | L138 | 기본정보↔지도 | 유지하되 280px 고정 → `variant="compact-mobile"`(≤150px) |
  | L166 | 로드뷰 직후 | **제거 (로드뷰 인접 오탭)** |
  | L178 | 주변시설 직후 | **제거 (클릭 카드 인접 + L196과 연속)** |
  | L196 | NEARBY 이후 | 유지(compact) |
  | L263 | 데스크톱 사이드바 | 유지(데스크톱 전용, 오탭 무관) |

  결과: 모바일 = HERO 사각형 1(L117) + compact 3(L123, L138, L196) = **4개**, 데스크톱 사이드바 유지. (필수 제거 = 오탭 2개 L166·L178)

- **부동산 상세 `pages/real-estate/.../[buildingName].vue` (6 → 4)**

  | 라인 | 위치 | 조치 |
  |---|---|---|
  | L84 | Hero 직후 | 유지 |
  | L144 | 로드뷰 직후 | **제거 (오탭)** |
  | L258 | 시세↔위치 | 유지 |
  | L287 | 거래내역 이후 | 유지 |
  | L362 | 인근 단지 이후 | **제거 (L375와 연속 스택)** |
  | L375 | 주변 생활시설 이후 | 유지 |

  (모두 이미 `compact-mobile`. 참고: 이 영역엔 RelatedGuides·CoupangBanner·footer도 `order-12`라, L362 제거로 스택이 완전 해소되진 않음 — 추가 간격은 안전여백 규칙으로 처리.)

- **포맷 일반화**: 사이사이 광고는 `compact-mobile`(≤150px), "큰 사각형"은 상단 1개로 제한.
- **안전 여백**: `AdBanner` 컨테이너에 인터랙티브 요소(버튼/링크/카드/로드뷰/복사 pill)와 **상하 ≥40px** 마진 보장. 로드뷰·클릭 카드 바로 인접 배치 금지.
- **라벨**: 광고가 콘텐츠와 시각적으로 구분되도록(AdSense 기본 라벨 유지, 위장 배치 금지).
- **가이드 상세(2개)·허브/리스트/검색(1~2개)**: 변경 없음.

**1.1 CI/Lighthouse/preview 실광고 차단 (green CI에서 조용히 깨질 수 있는 지점)**
- `nuxt.config.ts`: `public: { adsEnabled: true }` **리터럴 boolean**(§4.1 ⚠️).
- `adsense.client.ts`: `canLoadAdScript()` 거짓이면 `adsbygoogle.js` 미주입.
- **`adtest`는 preview를 보호하지 않음**: `AdBanner.vue:33` `adTest = import.meta.dev ? 'on' : undefined` — `npm run preview`는 프로덕션 빌드라 `import.meta.dev=false` → `adtest` 꺼짐 → **실광고**. 그래서 Lighthouse 차단은 전적으로 `adsEnabled=false`에 달림.
- `.github/workflows/lighthouse.yml` 빌드 스텝 env + `lighthouserc.js`의 `startServerCommand`(preview) **둘 다** `NUXT_PUBLIC_ADS_ENABLED=false`.
- `frontend/playwright.config.ts` `webServer`에도 동일 — 단 **로컬 E2E 하드닝**(현 CI PR 게이트는 E2E 미실행이라 CI 레이어 아님).
- ⚠️ 프로덕션 빌드(`deploy.yml`)에는 `NUXT_PUBLIC_ADS_ENABLED`를 **절대 주입하지 말 것**(주입 시 prod 광고 0). public 기본값 `true`가 빌드/런타임에 유지되는지 확인.

**1.2 프로덕션 봇/헤드리스 게이팅(best-effort)**
- `adsense.client.ts`: `canLoadAdScript()` 거짓이면 스크립트 미주입.
- `AdBanner.vue`: `shouldServeAds()` 거짓이면 렌더/push 안 함. `useDeferredAdSenseRequest(container, shouldServeAds)`로 `canRequest` 주입(push 시점 재평가됨 — `useDeferredAdSenseRequest.ts:40` 확인).

**1.3 degraded/noindex 페이지 광고 분리**
- ⚠️ **반드시 reactive로 구현** — `markDegradedResponse()` 호출부에 붙이면 안 됨. 그 함수는 SSR 전용(`useDegradedResponse.ts`: `useRequestEvent()` 없으면 return; 호출부도 `if (import.meta.server && ...)`)이라, **`<NuxtLink>` 클라이언트 네비로 degraded 페이지 진입 시 set이 안 돼 광고가 그대로 발화**(목표 #3 정면 실패, §4.3 2.1 "NuxtLink 잔여 경로"에서 발생).
- 구현: 각 페이지의 **이미 존재하는 reactive 상태**(`fetchFailed` ref/computed, `isNoindex` computed — SSR·클라이언트 양쪽 존재)를 소스로 `watchEffect(() => suppressAds(fetchFailed.value || isNoindex.value))` 또는 computed→`useState` 동기화. SSR 렌더와 클라이언트 재fetch 둘 다 추적.
- 대상 페이지(reactive 소스): 부동산 상세 `[buildingName].vue`, 지역 허브 `[city]/index`, `[city]/[district]/index`, 부동산 목록 `real-estate/.../[district]/index`.
- `AdBanner`만 `adsSuppressed()`를 읽는다(§4.1 레이어).

### 4.3 Phase 2 — 하드닝

**2.1 SPA soft-nav 재요청 스로틀**: `AdBanner.vue`의 `watch(route.path)` 재요청에 rapid-nav 가드(짧은 간격 연속 이동 무시) + `shouldServeAds()` 적용. (HardLink로 주요 내비는 full-reload이므로 대상은 NuxtLink 잔여 경로 — 1.3의 degraded 케이스도 이 경로에서 발생하므로 함께 검증.)

**2.2 악성 스캐너 차단 (서버 nginx)**: Cafe24 `/etc/nginx/sites-available/ilsangkit`에서 `.env`/`.git`/`.yml` 등 비정상 경로 + 스캐너 패턴(`185.177.72.x`류) 403/444. crawl-delay/공격적 봇은 SEO 가치 판단 후 별도. (서버 변경 = 리포 외, 배포 절차 문서화 필요.)

**2.3 (선택) 슬롯 배치별 분리**: 단일 `1878068382` → 배치별 고유 광고 유닛(AdSense 대시보드 작업 동반). 구글 귀속·채움률 개선. 비용 큼 → Phase 2 후반/별도.

### 4.4 Phase 3 — 회복 & 모니터링

- 배포 후 AdSense 정책센터·무효 트래픽 지표 관찰(**공식 이의신청 불필요, 자동 재심사**). CTR 정상화·노출 회복 추적.
- 게이팅 동작 회귀 테스트로 고정.
- 주기적 nginx 로그 점검: 헤드리스/봇 광고 발화 0(우리 제어 범위), 신규 스캐너.
- 통제 불가 항목(외부 클릭봇 등)은 구글 IVT 시스템에 위임.

---

## 5. 컴포넌트 / 데이터 흐름

```
adsEnabled(리터럴 boolean) ─┬─▶ canLoadAdScript() ─▶ adsense.client.ts: 스크립트 주입(부팅 1회, 2요소)
isLikelyBot()(client) ──────┘

adsEnabled ───┬─▶ shouldServeAds() ─▶ AdBanner.vue: 렌더/push ─▶ useDeferredAdSenseRequest(canRequest=shouldServeAds, push 시점 재평가)
isLikelyBot ──┤
adsSuppressed ┘ ▲
page degraded/noindex ─▶ watchEffect(fetchFailed || isNoindex) ─▶ useState('ads:suppressed')   (AdBanner에서만 소비)
```
- suppression은 **플러그인에 들어가지 않는다**(스크립트 주입은 전역·1회라 페이지별 상태 반영 불가).

### 영향 파일
- 신규: `frontend/composables/useAdsPolicy.ts` (게이트: adsEnabled/isLikelyBot/suppression)
- `frontend/plugins/adsense.client.ts` (`canLoadAdScript()`로 스크립트 주입 가드)
- `frontend/components/ads/AdBanner.vue` (`shouldServeAds()`로 렌더/push 가드, 라우트 스로틀, 포맷/배치)
- `frontend/components/ads/useDeferredAdSenseRequest.ts` (`canRequest` = `shouldServeAds`)
- `frontend/composables/useDegradedResponse.ts` (+ degraded/noindex 페이지 4종) — reactive `suppressAds()`
- `frontend/nuxt.config.ts` — `runtimeConfig.public.adsEnabled`(리터럴 boolean)
- `frontend/pages/[category]/[id].vue` — 광고 모바일 4개로 정비
- `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` — 광고 4개로 정비
- `lighthouserc.js`, `.github/workflows/lighthouse.yml`, `frontend/playwright.config.ts` — `NUXT_PUBLIC_ADS_ENABLED=false`
- (서버) `/etc/nginx/sites-available/ilsangkit` — 스캐너 차단
- (대시보드, 선택) AdSense 배치별 슬롯

---

## 6. 테스트 전략

- **단위(`useAdsPolicy`)**: `adsEnabled=false` / `navigator.webdriver=true` / 봇 UA / `adsSuppressed=true` 각각에서 `shouldServeAds()===false`; 실모바일 UA(NAVER inapp, SamsungBrowser)는 `true`(allowlist-wins). `NUXT_PUBLIC_ADS_ENABLED=false`일 때 `useRuntimeConfig().public.adsEnabled === false`(**strict boolean**) 단언.
- **컴포넌트(`AdBanner`)**: 게이트 거짓 시 `adsbygoogle.push` 미호출 단언(기존 `AdBanner.test.ts` 확장). degraded suppression이 클라이언트 네비에서도 동작하는지(reactive) 단언.
- **회귀**: 시설/부동산 상세 광고 개수(모바일 4) 단언 + 안전 여백(가능 범위).
- **배포 후 스모크(필수)**: 실모바일 UA로 라이브 상세에서 광고 push 발생 확인(M1 오변환 → prod 광고 0 조기 감지). 자동화/봇 UA로는 push 0 확인.
- **(선택)** Lighthouse 실행 중 `googlesyndication` 요청 0 검증 — LHCI는 score 기반이라 커스텀 Puppeteer/감사 신규 인프라 필요.
- **검증(수동)**: 광고 도메인 차단 인터셉트로 production 페이지 px/배치 재측정(노출 0 보장).

---

## 7. 리스크 / 트레이드오프

- **봇 게이팅 과탐 → 수익 손실**: 보수적 목록 + 실모바일 allowlist-wins. `navigator.webdriver`는 Playwright/Selenium만 잡고 **Lighthouse는 못 잡음**(CI 보증은 `adsEnabled=false`); 프로덕션 헤드리스엔 best-effort.
- **게이트 오변환(M1) → prod 광고 0(조용한 수익 붕괴)**: green CI로도 안 잡힘. 리터럴 boolean 강제 + 배포 후 스모크 체크(§6)로 분 단위 감지.
- **MPA/HardLink 롤백 금지**: document-load는 정책상 정상. 롤백 시 unfill(수익 손실)만 복귀, 원인 미해결.
- **광고 개수 축소 = 수익 정책**: 사용자 승인(상세 2종 6→4) 완료. 추가 축소/복원은 사용자 결정.
- **회복 시점 불확실**: 자동 재심사로 수 주 소요 가능. 즉시 효과 보장 없음.
- **외부 클릭봇/경쟁 사보타주**: 코드로 통제 불가, 구글 IVT에 위임.
- **단일 슬롯 유지(Phase 2.3 보류 시)**: 페이지별 귀속 불가 한계 잔존.

---

## 8. 롤아웃 순서

1. **Phase 1 전체를 한 PR(또는 묶음)로** 먼저 배포 — 1.4(클릭품질, 1차)·1.1·1.2·1.3.
2. 배포 직후 **스모크(실사용자 광고 정상 + 봇/CI 광고 0)** → 이후 AdSense 지표·nginx 로그로 검증.
3. Phase 2(스로틀·nginx 차단)는 후속 PR.
4. Phase 2.3(슬롯 분리)·Phase 3 모니터링 상시화는 별도.

PR 워크플로우 준수(main 직접 커밋 금지, CI 통과 후 머지). Node 20 고정.

---

## 9. 미해결 / 후속

- AdSense 배치별 고유 슬롯 전환(채움률·귀속 개선) 여부.
- 콘텐츠 길이 보강으로 광고 밀도 추가 희석(ayo식 과패딩은 지양).
- 헤드리스 폴러(Azure, sw.js/latest.json) 정체 추가 규명 — 게이팅으로 광고 영향은 차단되므로 우선순위 낮음.
- 광고 게재 제한 해제 후 노출/CTR 정상 범위 기준선 재설정.
- 프로덕션 public runtime-config 주입 경로(빌드타임 vs pm2 env) 확인 — `adsEnabled` 기본 true가 prod에서 유지되는지.
