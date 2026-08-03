# 메인페이지 깨짐 — 자동광고 hydration 충돌 + 배포 캐시 스큐 (설계)

- 날짜: 2026-06-09
- 브랜치: `fix/nginx-cache-purge-on-deploy`
- 상태: 설계 승인 대기 (사용자 스펙 검토 단계)

## 1. 증상

운영(ilsangkit.co.kr) 메인페이지에서:

- **콘솔에 에러가 찍힐 때 화면 틀이 순간 깨짐** ("스타일이 안 먹는다") — 첫 로딩에 집중, **간헐적**.
  콘솔: `Hydration completed but contains mismatches` + `adsbygoogle.js ... Error: no_div`
- 별개로, 특정 배포 직후 **옛 디자인이 고정적으로 깔림** (가이드 카드가 신 디자인 세로 그리드가
  아니라 옛 가로 카드로 1열 스택 등).
- 로컬 dev(`npm run dev`)에서는 **재현 안 됨.**

## 2. 두 개의 독립 문제 (실측으로 분리·확정)

### Problem 2 (핵심) — 자동광고가 Nuxt hydration 중 DOM 주입 → mismatch

**메커니즘:** AdSense 자동광고(Auto Ads)가 페이지 콘텐츠 트리 안에 광고 컨테이너를 동적 주입한다.
이 주입이 Vue hydration 도중 일어나면 Vue가 자기가 렌더하지 않은 노드를 만나
hydration mismatch를 일으키고, 일부 서브트리를 재렌더하며 순간 깨짐 + 광고 슬롯 div 소실(`no_div`).
async 스크립트 로드와 hydration 완료의 **타이밍 레이스**라 간헐적이다.

**실측 증거 (Playwright, 2026-06-09):**

ilsangkit.co.kr 메인 DOM:
```
googleAutoPlacedCount: 2            # .google-auto-placed = 자동광고 ON 확정
ins.adsbygoogle 중 2개: parentClass="google-auto-placed", insideNuxtApp=TRUE
                                    # → 자동광고가 #__nuxt(Vue 앱 트리) '안쪽'에 주입
```
- 헤드리스(빠른 CPU) 로드에서는 hydration이 광고 주입보다 먼저 끝나 **깨끗** → 간헐성 입증.
- 메인페이지 Vue 컴포넌트/데이터는 전부 hydration-safe로 검증됨:
  - `index.vue`의 모든 데이터는 단일 `useAsyncData` payload 기반(SSR=CSR).
  - 청약 D-day는 `HomeSubscriptionSection.vue:96-97`에서 `useState('home-today-iso')`로 SSR/CSR
    동일 "오늘" 보장.
  - 레이아웃/헤더/CoupangBanner 모두 SSR-안전.
  - → **mismatch는 Vue 코드가 아니라 외부(자동광고) DOM 주입이 유일 원인.**

**대조군 ayo.pe.kr (실측):** 자동광고 **ON**(`.google-auto-placed` 존재) + async 스크립트 in head로
**광고 설정이 일상킷과 동일**. 그러나 **프레임워크 없음(정적 HTML, hydration 단계 없음)** →
hydration mismatch가 **구조적으로 불가능**, 콘솔은 attestation 잡음만. 광고 설정이 같은데도 정적
사이트엔 버그가 없다 = 원인은 "자동광고 설정"이 아니라 **"자동광고 주입 × Nuxt hydration" 충돌**임을
분리 입증.

### Problem 1 (배포 enabler) — nginx 엣지 캐시 stale

운영 응답 헤더(ground-truth): `cache-control: s-maxage=3600, stale-while-revalidate`,
`Server: nginx`, `X-Cache-Status: ...`.
서버 nginx: `proxy_cache_path /var/cache/nginx/ilsangkit ...`,
`proxy_cache_key "$scheme$request_method$host$request_uri"` (URL 기준, **빌드ID 없음**).

`nuxt.config.ts`의 `routeRules['/'].swr=3600`이 `s-maxage=3600`을 실어 보내고, 앞단 nginx
`proxy_cache`가 홈 HTML을 URL 키로 최대 1시간 HIT 서빙한다. 캐시 키에 빌드ID가 없어 **배포해도
자동 무효화 안 됨** → 옛 HTML(=옛 디자인) 고정 서빙.

추가로 `deploy.yml`(166–179행) 워밍업 루프가 `https://ilsangkit.co.kr/`(nginx 경유)를 GET 하는데,
`pm2 reload` 후에도 nginx 옛 fresh 캐시에 **HIT** → 새 origin 미도달 → **워밍업이 옛 캐시를
재확인**해 stale을 고착시킨다.

**왜 둘 다 고쳐야 하나:** Problem 2 코드 수정을 배포해도, nginx가 옛 HTML을 최대 1시간 서빙하면
사용자가 수정 효과를 못 본다. 배포 시점에 맞물려 있어 함께 처리한다.

### 폐기된 가설 (정직 기록)

- ❌ Nitro 서버 SWR 캐시가 배포 간 stale persist — 빌드 산출물 확인 결과 운영 Nitro 캐시는
  **메모리**(fs 마운트 없음), `pm2 reload` 시 비워짐. 서버 캐시 `rm`은 무의미.
- ❌ 브라우저 `max-age` 캐시 — 운영 헤더에 `max-age` 없음(`s-maxage`만).
- ❌ 폰트 FOUC / 날짜 mismatch — 폰트는 별개, 날짜는 이미 `useState`로 가드됨.
- ❌ "ayo는 수동광고 전용" — 실측 결과 ayo도 자동광고 ON. 차이는 프레임워크(hydration) 유무뿐.

## 3. 해결책

### Fix 2A — adsbygoogle.js를 hydration 완료 후 로드

`nuxt.config.ts`의 head `script` 배열에서 AdSense 스크립트(현재 215행 `async` 로드)를 **제거**하고,
클라이언트 플러그인에서 **`onNuxtReady`(hydration 완료 + idle 이후)** 시점에 동적 주입한다.

신규 파일 `frontend/plugins/adsense.client.ts`:
```ts
export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const s = document.createElement('script')
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088264360250020'
    s.async = true
    s.crossOrigin = 'anonymous'
    document.head.appendChild(s)
  })
})
```

근거/안전성:
- `onNuxtReady`는 hydration 완료 후 `requestIdleCallback` 타이밍에 콜백 실행 → 광고 주입이
  hydration과 레이스 불가 → mismatch 제거. (정적 사이트 ayo가 가진 "이미 안정된 DOM" 상태를
  일상킷에도 부여.)
- 기존 GA gtag도 이미 `requestIdleCallback` 지연 로드(`nuxt.config.ts:211`) — 동일 패턴.
- 수동 슬롯(상세 페이지 `AdBanner.vue`)도 안전: `useDeferredAdSenseRequest`가
  `window.adsbygoogle = window.adsbygoogle || []` 후 `push({})` 하므로, 스크립트가 늦게 로드돼도
  큐에 쌓였다가 처리됨.
- CSP: `script-src`에 `pagead2.googlesyndication.com` 이미 허용됨(`nuxt.config.ts`) → 동적 주입 OK.
- 트레이드오프: **첫 로딩에서 광고 첫 등장이 ~0.3–1초 지연**(SPA 이동은 영향 없음). 페이지 자체는
  대역폭 경쟁 감소로 오히려 소폭 빨라짐. 수익 영향은 무시할 수준이나 0은 아님(사용자 승인됨).

### Fix 1 — 배포 시 nginx 캐시 퍼지

`.github/workflows/deploy.yml` 의 frontend `pm2 reload`/`pm2 save`(138행) **직후**,
워밍업 루프(166행) **이전**에 삽입:
```bash
# 배포 스큐 방지: nginx proxy_cache 의 옛 HTML 제거.
# 워밍업 루프 '앞'에 둬야 워밍업 GET 이 stale HIT 대신 새 origin 을 타격해 새 HTML 로 재캐시한다.
echo "[deploy] nginx proxy_cache 퍼지"
find /var/cache/nginx/ilsangkit -mindepth 1 -delete
```
- 배포 SSH 계정이 **root**(`secrets.SERVER_USER`) 확인 → 권한 OK, sudoers 불필요.
- `find ... -mindepth 1 -delete`: zone 디렉터리 보존, 파일만 제거(빈 디렉터리·glob 안전).
- 전체 zone 퍼지(50m/500m 소규모). `_nuxt` immutable 자산 재캐시 무해. SWR 라우트 전역의 동일
  배포 스큐도 함께 해소.
- `routeRules`의 swr 값은 **변경하지 않음**(엣지 캐시 성능·의도된 데이터 staleness 유지).

## 4. 변경 범위 요약

| 파일 | 변경 |
|------|------|
| `frontend/plugins/adsense.client.ts` | 신규 — `onNuxtReady`로 adsbygoogle.js 지연 주입 |
| `frontend/nuxt.config.ts` | head `script`에서 AdSense 스크립트 항목 제거 |
| `.github/workflows/deploy.yml` | pm2 reload 후·워밍업 전 nginx 캐시 퍼지 1줄 |

## 5. 검증

1. **빌드/유닛:** `cd frontend && npm run lint && npm run test` 통과. (기존 AdBanner 테스트가
   adsbygoogle 글로벌 가정에 의존하면 함께 점검.)
2. **로컬 dev:** 메인 정상 렌더, 광고 스크립트가 mount 후 주입되는지 확인.
3. **Playwright before/after (선택, 권장):** 메인 로드 후
   - `googleAutoPlacedCount` 여전히 >0(광고는 계속 뜸)
   - 콘솔에 `Hydration completed but contains mismatches` / `no_div` **부재**
   - 광고 첫 등장 시점 측정(지연 폭 수치화)
4. **배포 후 운영:** `curl -sI https://ilsangkit.co.kr/` 의 `etag` 변경 + 첫 요청
   `X-Cache-Status: MISS`→재요청 `HIT`. 브라우저 시크릿창에서 신 디자인 + 콘솔 클린(수 회 하드 리로드).

## 6. 범위 밖

- AdSense 자동광고 자체의 켜고/끄기, 인-페이지 포맷 제한 등 **광고 정책 변경은 하지 않음**
  (사용자 결정 영역). 본 작업은 "주입 타이밍"만 조정.
- `routeRules`/swr 값 재설계, 캐시 키 빌드ID 네임스페이스(A3)는 채택 안 함.

## 7. 리스크 / 롤백

- 2A 리스크: 광고 첫 등장 지연(승인된 트레이드오프). 만약 특정 페이지에서 광고 수익/표시 회귀가
  관측되면 플러그인 1개 제거로 즉시 롤백(원복 시 head 스크립트 복구).
- Fix 1 리스크 낮음: 배포 스크립트 1줄. 퍼지 실패해도 배포는 진행되고 최악의 경우 기존(stale)으로
  회귀, 서비스 중단 없음. nginx `proxy_cache_path` 경로 변경 시 deploy.yml 동기화 필요(주석 명시).
- PR 워크플로우: `fix/nginx-cache-purge-on-deploy` → develop PR → CI(lint+test+build) 통과 후 머지.
  main 머지 시 자동 배포·퍼지 적용.
