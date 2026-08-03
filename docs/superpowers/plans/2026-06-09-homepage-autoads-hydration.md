# 메인페이지 자동광고 hydration 충돌 + 배포 캐시 스큐 수정 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AdSense `adsbygoogle.js`를 Nuxt hydration 완료 후에 로드하도록 옮겨 자동광고 DOM 주입과 hydration의 레이스(= 간헐적 mismatch + `no_div` + 메인 레이아웃 깨짐)를 제거하고, 배포 시 nginx 엣지 캐시를 퍼지해 새 빌드가 즉시 반영되게 한다.

**Architecture:** 광고 스크립트를 `nuxt.config.ts` head에서 제거하고, `onNuxtReady`(hydration 완료 + idle 이후)에 `<script>`를 동적 주입하는 클라이언트 플러그인으로 대체한다. 별개로 `deploy.yml`에 nginx `proxy_cache` 디렉터리 퍼지를 `pm2 reload` 직후·워밍업 루프 직전에 한 줄 추가한다.

**Tech Stack:** Nuxt 3 (SSR) / Vue 3 / TypeScript ESM, GitHub Actions(appleboy/ssh-action) + nginx `proxy_cache` + PM2.

**Spec:** `docs/superpowers/specs/2026-06-09-homepage-autoads-hydration-design.md`
**Branch:** `fix/nginx-cache-purge-on-deploy` (develop 기준, 이미 생성됨)

---

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `frontend/plugins/adsense.client.ts` | adsbygoogle.js를 hydration 후 1회 주입 (클라이언트 전용) | **신규** |
| `frontend/nuxt.config.ts` | 앱 head 설정 — AdSense 정적 script 항목 제거 | 수정 (213–218행 삭제) |
| `.github/workflows/deploy.yml` | 배포 스크립트 — nginx 캐시 퍼지 1줄 추가 | 수정 (pm2 save 직후) |

**테스트 전략 메모(중요):** 변경은 (a) Nuxt 런타임 컨텍스트에 의존하는 얇은 클라이언트 플러그인, (b) 빌드 설정, (c) CI YAML 이라 의미 있는 단위 테스트 대상이 아니다. 기존 패턴(`plugins/google-analytics.client.ts`도 단위 테스트 없음)을 따르고, **검증은 lint/test 회귀 없음 + 프로덕션 빌드 + Playwright 통합 실측(콘솔 클린)** 으로 한다. 가짜 단위 테스트를 만들지 않는다. (Task 4가 통합 검증.)

---

## Task 1: AdSense 지연 로드 플러그인 생성

**Files:**
- Create: `frontend/plugins/adsense.client.ts`

- [ ] **Step 1: 플러그인 파일 작성**

`frontend/plugins/adsense.client.ts` (신규):

```ts
// AdSense adsbygoogle.js 를 hydration 완료 후(onNuxtReady)에 주입한다.
// head 에 정적 async 로 두면 Auto Ads 가 hydration 도중 #__nuxt 내부에 광고 DOM 을 주입해
// Vue hydration mismatch + adsbygoogle no_div + 순간 레이아웃 깨짐을 유발한다 (2026-06-09 Playwright 실측).
// onNuxtReady 는 hydration 완료 + requestIdleCallback 이후 콜백을 실행하므로 광고 주입과 hydration 의
// 레이스를 구조적으로 제거한다. (.client 접미사로 클라이언트에서만 실행 → SSR HTML 에 스크립트 미포함)
const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088264360250020'

export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    // HMR/재실행 대비 중복 주입 가드
    if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) return
    const s = document.createElement('script')
    s.src = ADSENSE_SRC
    s.async = true
    s.crossOrigin = 'anonymous'
    document.head.appendChild(s)
  })
})
```

참고: `defineNuxtPlugin`, `onNuxtReady`는 Nuxt 3 auto-import이므로 import 문 불필요. `client` 가드도 `.client.ts` 접미사로 처리되어 별도 `import.meta.client` 분기 불필요.

- [ ] **Step 2: 타입체크/Lint 통과 확인**

Run: `cd frontend && npx nuxi prepare && npm run lint`
Expected: 에러 없음. (`nuxi prepare`가 `.nuxt` 타입 생성 → `onNuxtReady`/`defineNuxtPlugin` 타입 인식)

- [ ] **Step 3: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/plugins/adsense.client.ts
git commit -m "feat(ads): adsbygoogle.js 를 onNuxtReady 후 지연 주입하는 플러그인 추가

자동광고가 hydration 도중 #__nuxt 내부에 DOM 을 주입해 mismatch/no_div/레이아웃
깨짐을 유발 → 스크립트 로드를 hydration 완료 후로 미뤄 레이스 제거."
```

---

## Task 2: nuxt.config.ts head에서 AdSense 정적 script 제거

**Files:**
- Modify: `frontend/nuxt.config.ts:213-218`

- [ ] **Step 1: 현재 블록 확인**

Run: `cd frontend && sed -n '206,224p' nuxt.config.ts`
Expected: `script:` 배열 안에 GA 부트스트랩 → `// AdSense: async 유지 (수익 영향 방지)` 주석 + adsbygoogle src 객체 → 폰트 CSS 순서로 보임.

- [ ] **Step 2: AdSense 항목 삭제 (213–218행)**

아래 블록을 삭제한다 (주석 1줄 + 객체 5줄):

```ts
        // AdSense: async 유지 (수익 영향 방지)
        {
          src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088264360250020',
          async: true,
          crossorigin: 'anonymous',
        },
```

삭제 후 `script:` 배열은 GA 부트스트랩(`...(gaId && ... ? [{ innerHTML: ... }] : [])`) 다음에 바로 폰트 CSS(`{ innerHTML: '(function(){var f=[...]...', type: 'text/javascript' }`)가 오는 형태가 된다. CSP의 `script-src https://pagead2.googlesyndication.com`는 **그대로 유지**(플러그인이 동적 주입하므로 여전히 필요).

- [ ] **Step 3: 정적 스크립트가 빌드 head에서 사라졌는지 확인**

Run: `cd frontend && npx nuxi prepare && npm run lint && grep -n "googlesyndication" nuxt.config.ts`
Expected: lint 통과. `grep`은 **CSP 라인(83행)에서만** 매치되어야 하고, head `script` 배열(206–224행 범위)에는 더 이상 매치 없음.

- [ ] **Step 4: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/nuxt.config.ts
git commit -m "refactor(ads): nuxt.config head 에서 정적 AdSense 스크립트 제거

adsense.client.ts 플러그인이 onNuxtReady 후 동적 주입하므로 head 정적 로드 제거
(중복 로드 방지). CSP allowlist 는 유지."
```

---

## Task 3: deploy.yml에 nginx 캐시 퍼지 추가

**Files:**
- Modify: `.github/workflows/deploy.yml` (frontend `pm2 save` 직후, 워밍업 루프 전)

- [ ] **Step 1: 삽입 위치 확인**

Run: `sed -n '129,148p' .github/workflows/deploy.yml`
Expected: `cd /home/project2/frontend` → frontend `pm2 reload ... --update-env` (또는 `pm2 start`) 분기 → `pm2 save` → 워밍업 주석/`echo "[warmup] backend ..."` 순서로 보임.

- [ ] **Step 2: 퍼지 블록 삽입**

`pm2 save` 줄 **바로 다음**, 워밍업 주석/루프 **이전**에 아래를 추가한다 (script의 들여쓰기는 주변 줄과 동일하게 12-space 유지):

```bash
            # 배포 스큐 방지: nginx proxy_cache 의 옛 HTML 을 제거한다.
            # 캐시 키가 URL 기준($request_uri, 빌드ID 없음)이라 배포해도 자동 무효화되지 않으므로
            # 명시 퍼지한다. 반드시 워밍업 루프 '앞'에 둔다 — 그래야 아래 워밍업 GET 이 stale HIT 대신
            # 새 origin 을 타격해 새 HTML 로 캐시를 재선점한다 (배포 SSH 계정 root 라 권한 OK).
            # 경로는 서버 nginx proxy_cache_path 와 일치해야 함 — 변경 시 함께 수정.
            echo "[deploy] nginx proxy_cache 퍼지"
            find /var/cache/nginx/ilsangkit -mindepth 1 -delete || true
```

`|| true`: 캐시 디렉터리가 비었거나 일시적으로 없어도 배포 전체가 실패하지 않도록(퍼지는 best-effort, 실패해도 최악 stale 회귀일 뿐 서비스 중단 없음).

- [ ] **Step 3: YAML 유효성 + 위치 확인**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('yaml-ok')"` 그리고 `grep -n "proxy_cache 퍼지\|find /var/cache/nginx\|\[warmup\] backend /api/health" .github/workflows/deploy.yml`
Expected: `yaml-ok` 출력. grep에서 `find /var/cache/nginx` 라인이 `[warmup] backend /api/health` 라인보다 **앞 번호**에 위치.

- [ ] **Step 4: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add .github/workflows/deploy.yml
git commit -m "ci(deploy): pm2 reload 후 nginx proxy_cache 퍼지 추가

배포 시 옛 HTML(s-maxage=3600)이 엣지에 HIT 서빙돼 새 디자인이 최대 1h stale 되는
문제 해결. 워밍업 루프 직전에 퍼지해 워밍업이 새 HTML 로 재캐시하도록 함."
```

---

## Task 4: 통합 검증 (회귀 없음 + 콘솔 클린 실측)

**Files:** (코드 변경 없음 — 검증 전용)

- [ ] **Step 1: 프론트엔드 lint + 단위 테스트 회귀 확인**

Run: `cd frontend && npm run lint && npm run test`
Expected: 전부 PASS. 특히 `tests/components/ads/AdBanner.test.ts`가 통과해야 한다 (이 변경은 `useDeferredAdSenseRequest`의 `window.adsbygoogle = window.adsbygoogle || []` 큐 로직을 건드리지 않으므로 영향 없음 — 스크립트가 늦게 로드돼도 push 큐가 처리됨).

- [ ] **Step 2: 프로덕션 빌드 성공 확인**

Run: `cd frontend && npm run build`
Expected: 빌드 성공. 산출물 `.output/server/index.mjs` 생성.

- [ ] **Step 3: 빌드 SSR HTML에 광고 스크립트가 없는지 확인 (preview)**

Run (백그라운드 preview 후 curl):
```bash
cd frontend && (node .output/server/index.mjs &) ; sleep 4
curl -s http://localhost:3000/ | grep -c "googlesyndication" ; kill %1 2>/dev/null || pkill -f ".output/server/index.mjs"
```
Expected: `0` (SSR HTML에 adsbygoogle 스크립트 부재 — 플러그인이 클라이언트에서만 주입하므로). 포트가 다르면 `.output` 로그의 Listening 포트 사용.

- [ ] **Step 4: Playwright 통합 실측 (선택이지만 권장 — 핵심 검증)**

로컬 preview(또는 배포된 develop)에 대해 Playwright로 메인 로드 후 다음을 확인한다:
- 콘솔에 `Hydration completed but contains mismatches` / `no_div` **부재** (수 회 reload)
- `document.querySelectorAll('ins.adsbygoogle')` 또는 `.google-auto-placed`가 hydration **완료 후** 시점에 존재(광고는 계속 뜸) — 단, 주입이 hydration 이후라 mismatch 미발생

확인 방법 예 (브라우저 콘솔/Playwright evaluate):
```js
// onNuxtReady 후 스크립트가 주입됐는지
!!document.querySelector('script[src*="adsbygoogle.js"]')  // → true
```
Expected: 스크립트 존재 true, 콘솔에 hydration mismatch/no_div 없음.

- [ ] **Step 5: 검증 결과를 커밋 메시지 없이 기록 (코드 변경 없으면 커밋 생략)**

검증만 한 경우 커밋 불필요. 검증 중 결함 발견 시 해당 Task로 돌아가 수정 후 재검증.

---

## Task 5: PR 생성 및 머지 (PR 워크플로우)

**Files:** (없음 — git/PR 작업)

- [ ] **Step 1: 브랜치 푸시**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git push -u origin fix/nginx-cache-purge-on-deploy
```

- [ ] **Step 2: develop 대상 PR 생성**

```bash
gh pr create --base develop --head fix/nginx-cache-purge-on-deploy \
  --title "fix(ads): 자동광고 hydration 충돌 제거 + 배포 시 nginx 캐시 퍼지" \
  --body "## 문제
- 메인페이지에서 자동광고가 hydration 도중 #__nuxt 내부에 DOM 주입 → 간헐적 hydration mismatch + adsbygoogle no_div + 레이아웃 순간 깨짐 (Playwright 실측 확정).
- 배포 후 nginx proxy_cache(s-maxage=3600, URL키)가 옛 HTML 을 최대 1h HIT 서빙 → 새 디자인 stale.

## 변경
1. \`plugins/adsense.client.ts\` 신규 — adsbygoogle.js 를 onNuxtReady 후 주입 (레이스 제거).
2. \`nuxt.config.ts\` — head 정적 AdSense script 제거 (중복 방지). CSP 유지.
3. \`deploy.yml\` — pm2 reload 후·워밍업 전 nginx 캐시 퍼지.

## 검증
- lint/test/build 통과, SSR HTML 에 광고 스크립트 부재 확인, Playwright 콘솔 클린.

Spec: docs/superpowers/specs/2026-06-09-homepage-autoads-hydration-design.md"
```

- [ ] **Step 3: CI(Test 워크플로우) 통과 확인**

Run: `gh pr checks --watch`
Expected: lint + test + build 전부 green.

- [ ] **Step 4: 머지 (CI green 확인 후)**

```bash
gh pr merge --merge   # 또는 저장소 관례에 맞는 머지 방식
```
참고: develop → main 승격 시 `Deploy to Cafe24` 워크플로우가 자동 트리거되어 nginx 퍼지 포함 배포가 실행된다.

- [ ] **Step 5: 배포 후 운영 검증 (main 반영 시)**

```bash
curl -sI https://ilsangkit.co.kr/ | grep -iE "etag|x-cache-status"
```
Expected: 직전 대비 `etag` 변경, 첫 요청 `X-Cache-Status: MISS`. 시크릿 브라우저로 메인 신 디자인 + 콘솔 클린(수 회 하드 리로드) 확인.

---

## Self-Review (작성자 체크)

**Spec coverage:**
- Fix 2A(플러그인 지연 주입) → Task 1, 2 ✅
- Fix 1(nginx 퍼지) → Task 3 ✅
- 검증(lint/test/build/SSR-no-script/Playwright) → Task 4 ✅
- PR 워크플로우 → Task 5 ✅
- 범위 밖(광고 정책/캐시 키 재설계) → 계획에 미포함(의도적) ✅

**Placeholder scan:** TODO/TBD 없음. 모든 코드 블록은 실제 삽입/삭제 내용 포함.

**Type/이름 일관성:** `ADSENSE_SRC` 상수가 플러그인 내에서 주입·중복가드 양쪽에 동일 사용. nuxt.config에서 제거하는 URL과 플러그인이 주입하는 URL 동일(`ca-pub-2088264360250020`). nginx 경로 `/var/cache/nginx/ilsangkit` 가 spec과 일치.

**주의:** Task 4 Step 3의 preview 포트/백그라운드 종료는 환경에 따라 조정 필요(포트가 3000 아닐 수 있음 — `.output` 기동 로그의 Listening 포트 사용).
