# 부동산 상세 페이지 Hydration 500 에러 — Design

작성일: 2026-05-26
관련 PR: #335 (효과 없음으로 판명), #337 (#335 회귀 fix)

## 문제 정의

운영 사이트의 부동산 상세 페이지(`/real-estate/<type>/<city>/<district>/<buildingName>`)가 **사용자 브라우저에서 항상 "오류가 발생했습니다 - 일상킷" 500 페이지로 표시**된다.

- 메인 페이지·시설 페이지는 정상
- 검색엔진 봇(Yeti, Googlebot 등)은 정상 HTML 색인 가능
- 운영뿐 아니라 로컬 `npm run dev`에서도 동일 재현

## 진단 결과 (2026-05-26 세션)

다음이 확인됐다.

| 단서 | 결과 |
|---|---|
| `curl http://localhost:3000/real-estate/...` HTML 응답 | `<title>` 정상 (예: "세양청구마을 아파트 매매 실거래") |
| `_payload.json?dev` 응답 | `statsResponse`, `transactions`, `buildingInfo`, `areaGroups`, `nearby-transit`, `nearby-facilities` 모두 정상 데이터 |
| `__NUXT_DATA__`의 `_errors` 카운트 | `6` (useAsyncData 단계에서 6건 발생, 다만 cache로 데이터는 채워짐) |
| Playwright(브라우저 hydration 포함) navigate | "오류가 발생했습니다" error.vue 표시 |
| Browser console error | `TypeError: Cannot read properties of undefined (reading 'dispose')` at `@unhead/vue/dist/shared/vue.Cr7xSEtD.mjs:47:13` |
| Vue warn | `Unhandled error during execution of beforeUnmount hook at <[buildingName] onVnodeUnmounted=fn ref=Ref<null>>` |
| Vue warn | `Unhandled error during execution of component update at <NuxtRoot>` |
| dev frontend stderr | `[buildingName].vue` 자체의 SSR throw 로그 없음 (sw.js / workbox 404만 노이즈) |

**진짜 시퀀스**:

1. **SSR은 정상** — HTML, title, useAsyncData payload 모두 정상으로 직렬화
2. **Client hydration 시점에 `[buildingName].vue`의 setup 또는 reactive 트리거가 throw**
3. Vue가 component를 unmount 시도. 이때 `[buildingName]`의 `ref`는 `null` (async setup이 완료되기 전 unmount된 증거)
4. Unmount 과정에서 `@unhead/vue`의 `beforeUnmount` hook이 hook 인스턴스 없이 `dispose()` 호출 → undefined.dispose() throw (**secondary symptom**)
5. Nuxt가 error.vue로 fallback → 사용자가 보는 500 페이지

**Primary throw의 정확한 위치는 미식별**. dispose 에러가 모든 console에 가려져 그 전 throw의 stack을 찾지 못했다. 후보 (`[buildingName].vue` 안):

- 라인 647-650: `const { useRealEstate } = await import('~/composables/useRealEstate'); const { useApiBase } = await import('~/composables/useApiBase')` — client hydration 시 dynamic import 실패 가능성
- 라인 736: `useAsyncData('real-estate-sync-status', ...)` — sync status API 호출
- 라인 948-996: 메인 SSR 데이터 fetch (`re-detail-new-...`) — Promise.allSettled로 잘 막혀있으나 `resolveBuildingContext` 안의 `getComplexList`/`getBuildingInfo` 가 어떤 케이스에 throw 가능
- 어느 reactive watch/computed가 ssrData 갱신 직후 throw

## 비-옵션 (안 함)

- **`@unhead/vue`의 dispose 라인 패치** — 라이브러리 내부. 위험.
- **error.vue 자체를 수정하여 500 안 보이게** — primary throw 안 잡힘. 사이드 효과 큼.
- **`nuxt.config`로 hydration 비활성화** — 인터랙티브 사이트가 망가짐.

## 접근 (2단계)

운영 사용자 영향 즉시 차단 + 진짜 원인 추적을 분리한다.

### 단계 A — Defensive setup wrap (즉시 차단, 우선)

Client hydration 시 `[buildingName].vue` 안에서 throw하는 코드를 안전화한다.

**중요 — useAsyncData 콜백 try/catch의 한계**: useAsyncData는 SSR 결과를 hydration payload로 client에 직렬화하고, client는 그 데이터를 재사용한다. 즉 **콜백은 client에서 재실행되지 않는다**. 따라서 콜백 안 try/catch는 SSR 시점 throw 방지에는 효과적이지만, **client hydration throw는 못 잡는다**. (그래서 이번 케이스의 진짜 trigger 잡기 어렵다.)

다음 두 가지를 같이 적용한다.

**A-1. `[buildingName].vue` 안 await 호출 안전화 (SSR 측 보강)**

`frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`:

1. 라인 647-650: `await import('~/composables/useRealEstate')` / `await import('~/composables/useApiBase')` — `.catch()` 추가. dynamic import 실패 시 기본 객체 반환.
2. 라인 736: `useAsyncData('real-estate-sync-status', ...)` 콜백 안 `$fetch(...)` — `.catch(() => null)`.
3. 라인 948-996: `useAsyncData('re-detail-new-...', ...)` 콜백 전체를 `try/catch`로 wrap. catch 시 EMPTY 객체 반환 + `console.error('[building SSR] swallowed:', e)`.
4. `NearbyFacilities` 두 `useAsyncData` 콜백 — `.catch(() => null)`.

A-1의 효과는 **SSR 측 throw 방지** + **로컬 데이터 폴백**. Client hydration throw는 아래 A-2가 잡는다.

**A-2. Global Vue errorHandler — client hydration throw 안전망**

`frontend/plugins/swallow-page-errors.client.ts` 신설:

```ts
export default defineNuxtPlugin((nuxtApp) => {
  const original = nuxtApp.vueApp.config.errorHandler
  nuxtApp.vueApp.config.errorHandler = (err, instance, info) => {
    // page setup / lifecycle hook throw를 swallow해서 error.vue 전환 차단.
    // 정보는 console로 흘림 (단계 B에서 추적).
    console.error('[hydration swallowed]', { err, info })
    if (typeof original === 'function') original(err, instance, info)
  }
  // unhandledrejection도 잡음 (Vue 3 Promise rejection 일부가 errorHandler 안 거침)
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (evt) => {
      console.error('[hydration promise reject]', evt.reason)
    })
  }
})
```

**효과**:
- Page setup 또는 hydration lifecycle throw가 발생해도 Nuxt가 error.vue로 fallback 안 함
- 사용자는 SSR HTML 페이지 그대로 보임 (interactivity 일부 손상 가능)
- 로그는 console로 남아 단계 B 진단에 활용

**리스크**:
- 모든 Vue throw를 swallow하는 게 의도된 hide. 페이지가 일부 깨졌어도 (예: 차트 안 그려짐) 사용자는 모름. 단계 B를 빨리 진행해 root cause 식별 필요.
- 다른 페이지의 정상 에러 처리에도 영향 가능 — 따라서 `info`나 `instance` 기반으로 부동산 상세 페이지에만 한정할지 검토. 초기 안전망은 글로벌, 추적 후 좁힘.

### 단계 B — Primary throw 정밀 추적 (별도 PR, 시간 가능 시)

운영 또는 dev에서 hydration 시 정확히 어디서 throw하는지 식별.

**방법 (택1 또는 조합)**:

1. **`onErrorCaptured` 게이트 컴포넌트** — `[buildingName].vue` setup 첫 줄에 `onErrorCaptured((err, instance, info) => { console.error('[building captured]', err, info); return false })`. 페이지 자체에서 잡고 stack 콘솔로 흘림.
2. **`Vue.config.errorHandler`** — `plugins/error-trace.client.ts`에서 글로벌 errorHandler 등록. SSR이 끝난 client hydration 단계의 throw를 잡음.
3. **빌드에 sourcemap 활성화** — `nuxt.config.ts`에 `sourcemap: { server: true, client: 'hidden' }`. minified chunk 풀린 stack 확보.
4. **dispose 에러를 dev에서 디버거로 break** — `@unhead/vue/dist/shared/vue.Cr7xSEtD.mjs:47:13` 라인 직전에 breakpoint 걸어 호출자를 정확히 추적.

단계 B는 단계 A로 운영 회복된 다음, 다른 PR로 한다.

## 작업 범위 — 단계 A

### 변경 파일

1. `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (A-1)
   - 라인 647-650: dynamic import에 `.catch()` 추가 + null 체크 후 graceful fallback
   - 라인 736: `useAsyncData('real-estate-sync-status', ...)` 콜백 안 `await $fetch(...)` 호출에 `.catch(() => null)` 추가
   - 라인 948-996: `useAsyncData('re-detail-new-...', ...)` 콜백을 try/catch로 wrap. catch 시 EMPTY 객체 반환.

2. `frontend/components/realEstate/NearbyFacilities.vue` (A-1)
   - 라인 130-138 (`transit/nearby` useAsyncData) — 콜백 `.catch(() => null)` 또는 try/catch
   - 라인 150-159 (`facilities/search` useAsyncData) — 동일

3. `frontend/plugins/swallow-page-errors.client.ts` (A-2, 신규)
   - Global `vueApp.config.errorHandler` 등록
   - `window.unhandledrejection` 핸들러 등록
   - 모든 throw를 console.error로 흘리고 swallow

### 테스트

4. `frontend/tests/components/realEstate/NearbyFacilities.test.ts` (기존 9 tests)
   - 새 케이스 1: `$fetch` reject → 컴포넌트 렌더되고 empty state 표시
   - 새 케이스 2: 두 fetch 모두 reject → throw 없이 mount

5. `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts` (기존 9 tests)
   - 새 케이스: `useRealEstate` mock의 함수가 reject → 페이지 mount 성공 (error.vue로 안 빠짐)

6. `frontend/tests/plugins/swallow-page-errors.test.ts` (신규)
   - errorHandler 등록 검증
   - 모의 throw를 swallow + console.error 호출 검증

### 검증

- `npx vitest run` — 모든 frontend test 통과
- `npx vue-tsc --noEmit` — 신규 TS 에러 0
- `npm run lint` — 신규 lint 에러 0
- 로컬 dev에서 `http://localhost:3000/real-estate/apt-sale/ulsan/nam/세양청구마을` Playwright navigate → `<title>` 정상, `error.vue` 미표시
- 배포 후 운영에서 동일 URL Playwright navigate → 정상 페이지

### Rollback 절차

PR 단일 squash 머지. 문제 발견 시:
- `gh pr revert <num>` 또는 git revert
- 운영 데이터/스키마 변경 없음

## 안전 가드

- 단계 A 적용 후 운영에서 부동산 상세 → 정상이지만 `console.error('[building SSR] swallowed:', ...)`가 빈번하게 찍히면 단계 B를 우선 작업해 root cause 식별. 빈도 낮으면 후속 작업으로.
- 단계 A 후에도 부동산 상세가 여전히 error.vue를 표시한다면 — primary throw가 setup 외부(예: NuxtRoot watcher 또는 다른 plugin)에 있을 가능성. 그 경우 단계 B를 더 적극적으로.

## 관련 자료

- PR #335 NearbyFacilities SSR base URL fix — root cause 아니었음 (정정 코멘트 https://github.com/sseok-lee/ilsangkit/pull/335#issuecomment-4542814496)
- 운영 PM2 메모리 한도 + DATABASE_URL 조정 + nginx 봇 차단/캐시 — 별개로 적용된 운영 안정화 작업
- Notepad `MySQL Zombie Incident` — backend 풀 누수 (이번 fix와 무관)
