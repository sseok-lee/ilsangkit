# 카카오 지도·로드뷰 CSP 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카카오 CDN 변경으로 차단된 지도·로드뷰를 필요한 CSP 허용 목록만 보완해 복구하고, 같은 누락을 회귀 검증으로 방지한다.

**Architecture:** 운영 `main` 기준의 독립 수정 브랜치에서 공통 CSP와 Nitro 라우트 규칙 검증을 함께 수정한다. PR 검증 후 운영에서 실제 지도·로드뷰를 확인하고, 같은 수정을 `develop`의 `baseCsp`에 반영한다. SDK 로더나 화면 컴포넌트의 인터페이스는 바꾸지 않는다.

**Tech Stack:** Node 20, Nuxt 3/Nitro, Vitest, 기존 Playwright, GitHub Actions.

**Spec:** [확정 스펙](../specs/2026-10-07-kakao-map-csp-recovery-design.md)

**Status:** Native 방식으로 main/develop의 최소 수정과 로컬 검증·독립 코드 리뷰 완료. PR/CI 진행 예정이며 운영 병합·배포는 미실행. 아래 실행 기록의 E2E 검증 한계를 포함한다.

## Global Constraints

- `script-src`, `connect-src`에 `https://*.kakaocdn.net`을 추가한다. 기존 `img-src`의 카카오 CDN 허용은 유지한다.
- 새 허용은 HTTPS로 한정한다. CSP 제거, `*` 또는 단독 `https:`를 통한 전체 스크립트·통신 허용, report-only 전환은 하지 않는다.
- 다른 보안 헤더와 기존 허용 목록은 유지한다.
- 카카오 앱 키, API 호출 주소, 지도 중심 좌표, 로드뷰 반경·높이·레이아웃, DB 및 API 계약은 변경하지 않는다. 새 패키지나 환경변수는 필요하지 않다.
- Node 20에서 실행한다. 기존 lock 파일을 유지하며 의존성 설치가 필요하면 각 패키지에서 `npm ci`를 사용한다.
- 운영 복구 완료 판정은 배포된 원본 응답으로 수행하며 진단용 헤더 덮어쓰기는 사용하지 않는다.
- 이 복구 때문에 develop 전체를 운영으로 올리지 않는다. main 직접 커밋은 하지 않는다.
- 기존 사용자 작업·미추적 파일을 보존한다. 전체 서비스워커·캐시 삭제를 기본 절차로 삼지 않는다.
- 커밋 전 backend/frontend 전체 단위 테스트를 실행한다. 커밋 메시지는 Conventional Commits 제목과 Lore 결정 기록을 사용한다.

## Review Focus

1. `t1` 외 카카오 CDN 하위 호스트도 허용돼야 한다 → Task 1에서 정확한 HTTPS 와일드카드 토큰을 검증한다.
2. 메인 JS만 허용하고 로드뷰 보조 JSON 통신을 놓치지 않아야 한다 → Task 1에서 두 지시어를 독립 검증하고 Task 2에서 실제 JSON 요청을 확인한다.
3. 시설 SWR·부동산 경로·관리자 정책이 전역 헤더를 덮어쓸 수 있다 → Task 1에서 합성된 규칙, Task 3에서 관리자 이미지 예외까지 검증한다.
4. 기존 방문자의 문서·서비스워커 캐시에 이전 상태가 남을 수 있다 → Task 2에서 새 컨텍스트와 기존 컨텍스트의 새로고침·내부 이동을 확인한다.
5. 촬영 데이터가 없는 정상 안내와 SDK 장애를 혼동할 수 있다 → Task 1에서 기존 반경/미지원 테스트, Task 2에서 촬영 데이터가 있는 실제 위치를 기준으로 확인한다.

## 파일과 작업 경계

| 파일 | 역할 |
| --- | --- |
| `frontend/nuxt.config.ts` | 공통 CSP의 두 허용 목록에 카카오 CDN HTTPS 와일드카드 추가 |
| `frontend/tests/server/kakao-csp.test.ts` (신규) | 실제 Nuxt 설정과 Nitro 규칙 합성을 통해 CSP 계약 검증 |
| 이 계획 및 확정 스펙 | 작업 범위·결정·검증 절차를 수정 브랜치에 보존 |
| `.superpowers/kakao-csp-recovery/` (로컬 산출물) | 테스트 결과, 배포 커밋, 헤더, 키를 제거한 네트워크 기록, 지도 영역 스크린샷 |

`frontend/tests/server/city-payload-cache.test.ts`는 참고용이다. 캐시 테스트 파일에 보안 테스트를 섞지 않고 기존 로딩 방식을 재사용한다. 계획 기준 `origin/main`은 `7ca3aae4914b`, `develop`은 `9fcd5d200fef`이며 실행 시 최신 ref와 차이를 다시 확인한다.

---

## Task 1: 운영 기준 브랜치에서 CSP 복구와 회귀 검증 완료

**Files:** Modify `frontend/nuxt.config.ts`; Create/Test `frontend/tests/server/kakao-csp.test.ts`; 확정 스펙과 계획을 브랜치에 포함.

**Interfaces:** 기존 `nuxt.config` default export의 `nitro.routeRules`를 소비한다. 제품 API를 추가하지 않는다. 산출물은 테스트를 통과한 main 기준 수정 커밋이다.

- [ ] **Step 1: 작업 위치와 기준 커밋을 고정한다.**

실행 단계에서 `superpowers:using-git-worktrees`를 읽고 별도 worktree를 만든다. 원래 작업 디렉터리의 `develop`은 전환하지 않는다.

```bash
git status --short --branch
git fetch origin
git log --oneline origin/main..origin/develop
git worktree add .worktrees/kakao-map-csp-recovery -b fix/kakao-map-csp-recovery origin/main
```

같은 이름의 브랜치·worktree가 있으면 상태를 확인해 재사용 여부를 판단하고 덮어쓰지 않는다. 원래 작업 디렉터리의 스펙·계획 파일을 새 worktree의 같은 경로로 복사한다. `docs/`는 현재 `.gitignore` 대상이므로 마지막에 이 두 파일만 명시적으로 force-add한다.

새 worktree에서 Node 20과 각 패키지의 기존 의존성 가용성을 확인한다. 설치가 필요한 경우 lock 파일을 보존해 `npm ci`한다. 소스 검토 기준은 main의 인라인 CSP이며, develop의 `baseCsp` 리팩터링을 가져오지 않는다.

- [ ] **Step 2: 실패할 보안 계약 테스트를 작성한다.**

`frontend/tests/server/kakao-csp.test.ts` 전체 내용:

```ts
// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { loadOptions } from 'nitropack'
import { createRouter, toRouteMatcher } from 'radix3'
import { defu } from 'defu'

const publicPaths = [
  '/toilet/csp-fixture',
  '/pharmacy/csp-fixture',
  '/real-estate/apt-sale/chungnam/cheonan-dongnam/초원그린타운',
  '/real-estate/apt-rent/gyeongnam/changwon/csp-fixture/주소',
]
const adminPaths = ['/admin', '/admin/affiliate-banners']

describe('Kakao CDN CSP contract', () => {
  let headersFor: (path: string) => Record<string, string>

  function policyFor(path: string): Map<string, string[]> {
    const value = headersFor(path)['content-security-policy']
    expect(value).toBeTruthy()
    const entries = value.split(';').map(part => part.trim()).filter(Boolean)
      .map((part): [string, string[]] => {
        const [name, ...sources] = part.split(/\s+/)
        return [name, sources]
      })
    return new Map(entries)
  }

  beforeAll(async () => {
    vi.stubGlobal('defineNuxtConfig', (config: unknown) => config)
    try {
      const { default: config } = await import('../../nuxt.config')
      const normalized = await loadOptions({ routeRules: config.nitro!.routeRules })
      const matcher = toRouteMatcher(createRouter({ routes: normalized.routeRules }))
      headersFor = (path) => {
        const rules = defu({}, ...matcher.matchAll(path).reverse()) as {
          headers?: Record<string, string>
        }
        return Object.fromEntries(Object.entries(rules.headers ?? {})
          .map(([name, value]) => [name.toLowerCase(), value]))
      }
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it.each([...publicPaths, ...adminPaths])('%s allows CDN scripts and connections', (path) => {
    const policy = policyFor(path)
    for (const directive of ['script-src', 'connect-src']) {
      const sources = policy.get(directive)
      expect(sources).toBeDefined()
      expect(sources).toContain('https://*.kakaocdn.net')
      expect(sources).toContain('https://*.kakao.com')
      expect(sources).toContain('https://*.daumcdn.net')
      for (const forbidden of ['*', 'https:', 'http://*.kakaocdn.net']) {
        expect(sources).not.toContain(forbidden)
      }
    }
  })

  it.each(publicPaths)('%s preserves the existing image permissions', (path) => {
    const images = policyFor(path).get('img-src')
    expect(images).toEqual(expect.arrayContaining([
      "'self'", 'data:', 'https://*.kakaocdn.net', 'https://*.daumcdn.net',
    ]))
    expect(images).not.toContain('https:')
  })

  it.each([...publicPaths, ...adminPaths])('%s keeps security enforcement', (path) => {
    const policy = policyFor(path)
    expect(policy.get('default-src')).toEqual(["'self'"])
    expect(policy.get('object-src')).toEqual(["'none'"])
    expect(policy.get('worker-src')).toEqual(["'self'", 'blob:'])
    expect(headersFor(path)['x-content-type-options']).toBe('nosniff')
    expect(headersFor(path)['x-frame-options']).toBe('DENY')
    expect(headersFor(path)['strict-transport-security'])
      .toBe('max-age=31536000; includeSubDomains; preload')
  })
})
```

`csp-fixture` 경로는 규칙 합성 검증용이며 DB 레코드나 실제 카카오 요청이 필요 없다. 실제 화면 확인에는 Task 2의 실존 데이터를 사용한다.

- [ ] **Step 3: 실패 원인이 두 허용 목록의 누락인지 확인한다.**

`frontend/`에서 실행:

```bash
npm run test -- tests/server/kakao-csp.test.ts
```

예상: `https://*.kakaocdn.net` 포함 단언 실패. 모듈 로딩이나 설정 오류로 실패하면 테스트 준비 문제를 먼저 해결한다. 실패 결과를 기록한다.

- [ ] **Step 4: main의 CSP 두 지시어만 수정한다.**

worktree 루트에서 다음과 동등한 정확한 치환을 적용한다. 각 대상이 한 번씩 존재하는지 검사하므로 구조가 바뀌었다면 중단하고 현재 설정을 읽는다.

```python
from pathlib import Path

path = Path('frontend/nuxt.config.ts')
source = path.read_text()
changes = {
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.kakao.com ":
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.kakao.com https://*.kakaocdn.net ",
    "connect-src 'self' ${apiBase} https://*.kakao.com ":
    "connect-src 'self' ${apiBase} https://*.kakao.com https://*.kakaocdn.net ",
}
for before, after in changes.items():
    assert source.count(before) == 1, before
    source = source.replace(before, after)
path.write_text(source)
```

`git diff -- frontend/nuxt.config.ts`로 두 HTTPS 토큰 외 제품 동작 변경이 없는지 확인한다.

- [ ] **Step 5: 대상 테스트와 기존 지도 테스트를 통과시킨다.**

`frontend/`에서 실행:

```bash
npm run test -- tests/server/kakao-csp.test.ts tests/server/city-payload-cache.test.ts tests/composables/useKakaoMap.test.ts tests/components/map/FacilityMap.test.ts tests/components/facility/FacilityRoadview.test.ts
```

예상: 새 계약과 기존 지도 초기화·로드뷰 반경 확대·모든 반경 미지원·컴포넌트 테스트가 모두 통과한다. 이 결과는 실제 CDN 로딩 확인을 대체하지 않는다.

- [ ] **Step 6: 커밋에 필요한 전체 검증을 실행한다.**

| 위치 | 명령 | 기대 결과 |
| --- | --- | --- |
| `backend/` | `npm run test`, `npm run lint` | 전체 통과 |
| `frontend/` | `npm run test`, `npm run lint` | 전체 통과 |
| `frontend/` | `npm run build` | Nuxt SSR 빌드 성공 |
| `frontend/` | `npm run test:e2e -- --project=chromium --project='Mobile Chrome'` | 데스크톱·모바일 기존 E2E 통과 |
| worktree 루트 | `git diff --check` | 오류 없음 |

양쪽 테스트·린트는 독립적으로 실행할 수 있다. E2E 서버와 빌드는 같은 산출물을 동시에 쓰지 않도록 순차 실행한다. E2E가 사용하는 기존 포트·서버·fixture 전제와 설치된 브라우저를 확인하고, 다른 작업의 서버를 중단하지 않는다.

타입 검사는 `vue-tsc`와 Nuxt 도구가 모두 설치돼 있을 때 `npx --no-install nuxi typecheck`를 실행한다. 조사 시점에는 `vue-tsc`가 없어 실행 불가로 예상된다. 새 의존성을 설치하거나 타입 검사를 통과했다고 보고하지 않는다. 실패는 동일 기준 커밋에서도 재현되는지 분리하고, 해결되지 않은 필수 검증 실패가 있으면 커밋/병합 완료로 처리하지 않는다.

- [ ] **Step 7: 검증한 변경만 커밋하고 리뷰한다.**

전체 테스트 후 제품 코드·테스트와 이 두 문서를 명시적으로 stage한다. 다른 무시된 문서는 추가하지 않는다.

```bash
git add frontend/nuxt.config.ts frontend/tests/server/kakao-csp.test.ts
git add -f docs/superpowers/specs/2026-10-07-kakao-map-csp-recovery-design.md docs/superpowers/plans/2026-10-07-kakao-map-csp-recovery.md
git diff --cached --stat
```

커밋 제목은 `fix(map): restore Kakao maps after the CDN domain change`로 한다. 본문에는 `Constraint: Kakao requires HTTPS *.kakaocdn.net in script-src and connect-src`, `Scope-risk: narrow`, 실제 통과한 명령을 담은 `Tested:`, 운영 미검증과 타입 검사 실행 불가 등 실제 한계를 담은 `Not-tested:`를 적는다. 기록 내용은 그 시점의 실행 결과로 작성한다.

독립 리뷰어가 CSP 확대 범위·Nitro 규칙·테스트 유효성·미배포 기능 혼입 여부를 검토한다. 중요한 지적을 해결한 뒤 관련 검증을 다시 실행한다.

**완료 조건:** 운영 기준 변경이 두 CSP 허용 목록과 회귀 테스트에 한정되고 로컬 검증·독립 리뷰 근거가 확보된다.

---

## Task 2: PR 검증, 운영 반영 및 실제 복구 확인

**Files:** 제품 변경 없음. 검증 근거는 `.superpowers/kakao-csp-recovery/`에 저장.

**Interfaces:** Task 1 수정 커밋을 소비한다. 산출물은 main PR·CI 결과·운영 릴리스 SHA·브라우저 검증 결과다.

- [ ] **Step 1: main 대상 PR을 작성하고 범위를 검증한다.**

PR 본문 파일을 작성한다. 문제(새 CDN 리소스 CSP 차단), 두 지시어 변경, 테스트 결과, 실제 카카오 검증 상태, 알려진 검증 한계를 기록한다. 한글 제목은 `fix(map): 카카오 CDN 변경으로 사라진 지도·로드뷰 복구`로 한다.

```bash
git diff --stat origin/main...HEAD
git push -u origin fix/kakao-map-csp-recovery
gh pr create --base main --head fix/kakao-map-csp-recovery --title 'fix(map): 카카오 CDN 변경으로 사라진 지도·로드뷰 복구' --body-file /tmp/ilsangkit-kakao-csp-pr.md
gh pr checks fix/kakao-map-csp-recovery
```

제휴 배너 DB·API·UI 파일이 PR에 포함되지 않는지 확인한다. 예상 체크는 `Test / test-backend`, `Test / test-frontend`, `Lighthouse CI / lighthouse`다. 모두 통과하고 리뷰가 완료돼야 main 병합 단계로 간다. Lighthouse의 카카오 키는 더미이므로 지도 복구 증거가 아니다.

- [ ] **Step 2: 기존 방문자 검증용 컨텍스트와 기준 화면을 보존한다.**

배포 전 별도 진단 브라우저 컨텍스트에서 아래 상세를 열고 기존 문서 헤더·콘솔 차단을 기록한다. 컨텍스트의 서비스워커/캐시를 초기화하지 않고 배포 후 다시 확인할 수 있게 유지한다. 사용자의 기존 탭·로그인 상태는 건드리지 않는다.

`https://ilsangkit.co.kr/real-estate/apt-sale/chungnam/cheonan-dongnam/초원그린타운`

- [ ] **Step 3: 운영 배포 범위가 승인된 실행 단계에서 main PR을 병합한다.**

사용자는 스펙·계획을 확정하고 Native 구현을 선택했다. 이 선택만으로 자동 운영 배포를 승인한 것으로 간주하지 않는다. 이 문서는 실제 병합·배포를 실행한 기록이 아니다. 실행 단계에 기존 배포 승인이 있으면 재질문하지 않고 그 범위에서 진행하고, 없다면 준비된 PR과 검증 결과를 제시한 뒤 운영 반영 권한을 확인한다.

main 병합 → main의 `Test` 성공 → `Deploy to Cafe24` 자동 실행 순서다. 따라서 main 병합을 단순 브랜치 동기화로 취급하지 않는다. `gh pr merge fix/kakao-map-csp-recovery --merge`를 실행한 뒤 병합 커밋을 기록하고 해당 SHA의 Test·배포 실행을 추적한다. 실행 기록과 운영 `X-Ilsangkit-Release-Id`가 같은 릴리스를 가리키는지 확인한다.

- [ ] **Step 4: 덮어쓰기 없는 실제 문서 응답을 확인한다.**

일반 GET으로 위 상세페이지의 HTTP 상태, `Content-Security-Policy`, `X-Ilsangkit-Release-Id`를 저장한다. 새 CSP의 `script-src`, `connect-src`에 각각 HTTPS 와일드카드가 있는지 확인한다. 단순 `img-src` 검색이나 HEAD 결과만으로 완료 처리하지 않는다.

문서 헤더가 이전 값이면 배포 SHA → 원본 Nuxt 응답 → 프록시/문서 캐시 순서로 추적한다. 오래된 응답이 확인된 계층·URL 범위만 갱신하고 원래 URL로 재검증한다. 캐시 우회 URL의 성공만으로 기존 URL 복구를 판정하지 않는다.

- [ ] **Step 5: 데스크톱·모바일 실동작을 확인한다.**

새 컨텍스트와 Step 2의 기존 컨텍스트에서 데스크톱 `1440×1000`, 모바일 `390×844`를 확인한다. 시작 전에 네트워크·콘솔 수집을 켜고, 헤더 덮어쓰기·SDK mock은 사용하지 않는다.

각 화면에서 아래 절차를 수행한다.

1. 초원그린타운 상세에 직접 진입한 뒤 지도 영역으로 스크롤한다. 지도 타일·마커가 보이고 확대 및 드래그가 동작하는지 확인한다.
2. 로드뷰 파노라마가 보이고 드래그 회전이 되는지 확인한다. 보조 JSON과 파노라마 요청 성공, 카카오 리소스 CSP 위반 없음도 확인한다. SDK 버전 경로 `4.5.28`은 고정하지 않는다.
3. 새로고침 후 동일 동작을 확인한다. 목록·검색 화면으로 이동해 실제 링크를 클릭하여 같은 상세로 돌아오는 내부 이동도 확인한다.
4. 운영 시설 목록에서 지도 좌표와 촬영 데이터가 있는 시설 상세를 한 곳 선택하고, 정확한 URL을 기록한 뒤 같은 절차를 수행한다. 촬영 데이터 없는 시설을 SDK 장애로 판정하지 않는다.
5. 기존 방문자 컨텍스트에서는 캐시·서비스워커를 지우기 전 상태로 새로고침과 내부 이동을 확인한다. 오래된 열린 화면 자체가 새 CSP를 즉시 적용할 것을 요구하지 않는다.

실제 지도·로드뷰 영역을 담은 스크린샷을 저장한다. `Map` 생성자 존재, 이미지 요청 성공, 캔버스 크기만으로 시각적 복구 확인을 대신하지 않는다. 네트워크 기록의 앱 키는 제거하고 관련 없는 광고 오류는 분리한다.

- [ ] **Step 6: 운영 결과를 기록한다.**

PR/커밋/배포 실행, 릴리스 헤더, 확인 URL, 화면 크기, 진입 방식, 네트워크 결과, 스크린샷 경로를 묶어 기록한다. 실패하면 “배포 완료, 복구 확인 실패”로 구분하고 실패 요청부터 다시 진단한다. 기존 버전으로 되돌리면 지도 차단이 재현되므로 단순 롤백을 복구로 간주하지 않는다. 새 수정으로 다른 기능이 손상된 경우에는 영향과 되돌리기 대상을 제시한다.

**완료 조건:** 배포 원본 헤더와 실제 지도·로드뷰 조작이 두 상세 유형·두 화면 크기·새/기존 방문 환경에서 확인된다.

---

## Task 3: develop의 공통 CSP에 반영하고 재발 방지

**Files:** Modify `frontend/nuxt.config.ts`; 반영/확장 `frontend/tests/server/kakao-csp.test.ts`; 문서 동기화.

**Interfaces:** Task 1의 검증된 복구와 Task 2의 main 병합 결과를 소비한다. 산출물은 관리자 이미지 예외를 보존하면서 동일한 복구가 들어간 develop PR이다.

- [ ] **Step 1: 최신 develop 기준 별도 반영 브랜치를 만든다.**

`fix/kakao-map-csp-recovery-develop` 브랜치를 최신 `origin/develop`에서 만든다. 원래 작업 디렉터리의 미추적 파일을 옮기거나 지우지 않는다. 저장소의 원래 루트에서 실행한다.

```bash
git fetch origin
git worktree add .worktrees/kakao-map-csp-recovery-develop -b fix/kakao-map-csp-recovery-develop origin/develop
git show fix/kakao-map-csp-recovery:frontend/tests/server/kakao-csp.test.ts > .worktrees/kakao-map-csp-recovery-develop/frontend/tests/server/kakao-csp.test.ts
```

이름이 이미 있으면 상태를 확인하고 기존 파일을 덮어쓰지 않는다. 확정 스펙과 계획은 main 수정 브랜치에 커밋된 두 파일을 같은 경로로 복사한다. main의 인라인 CSP와 develop의 `baseCsp` 구조가 다르므로 `nuxt.config.ts` 전체를 main 버전으로 교체하지 않는다. 이 단계에서는 검증 파일만 먼저 가져온다.

- [ ] **Step 2: 관리자 예외 보존 검증을 추가한다.**

`kakao-csp.test.ts`의 기존 `describe` 안에 다음 테스트를 추가한다. `adminPaths`, `policyFor`, `headersFor`는 Task 1에서 정의한 것을 그대로 사용한다.

```ts
it.each(adminPaths)('%s preserves the admin image policy and no-store', (path) => {
  const apiBase = process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'
  expect(policyFor(path).get('img-src')).toEqual([
    "'self'", apiBase, 'data:', 'https:',
  ])
  expect(headersFor(path)['cache-control']).toBe('no-store')
})
```

`frontend/`에서 `npm run test -- tests/server/kakao-csp.test.ts`를 실행한다. 새 관리자 이미지 테스트는 통과하고 카카오 CDN의 스크립트·통신 허용 테스트는 실패해야 한다. 이미 다른 PR로 복구가 반영됐다면 중복 수정하지 말고 그 커밋과 테스트 통과를 기록한다.

- [ ] **Step 3: baseCsp를 수정하고 develop 기준 검증 및 PR을 완료한다.**

새 worktree 루트에서 적용할 정확한 수정:

```python
from pathlib import Path

path = Path('frontend/nuxt.config.ts')
source = path.read_text()
changes = {
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.kakao.com ":
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.kakao.com https://*.kakaocdn.net ",
    "connect-src 'self' ${apiBase} https://*.kakao.com ":
    "connect-src 'self' ${apiBase} https://*.kakao.com https://*.kakaocdn.net ",
}
for before, after in changes.items():
    assert source.count(before) == 1, before
    source = source.replace(before, after)
path.write_text(source)
```

`adminCsp`는 수정된 `baseCsp`를 상속한다. 별도의 관리자 스크립트 허용 목록은 만들지 않는다. 새 worktree 루트에서 다음 명령을 실행한다.

```bash
npm --prefix frontend run test -- tests/server/kakao-csp.test.ts tests/server/city-payload-cache.test.ts tests/composables/useKakaoMap.test.ts tests/components/map/FacilityMap.test.ts tests/components/facility/FacilityRoadview.test.ts
npm --prefix backend run test
npm --prefix backend run lint
npm --prefix frontend run test
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix frontend run test:e2e -- --project=chromium --project='Mobile Chrome'
git diff --check
```

타입 검사는 설치된 `vue-tsc`와 Nuxt 도구를 확인해 실행 가능할 때만 `frontend/`에서 `npx --no-install nuxi typecheck`로 수행한다. 설치가 필요하면 실행 불가 사유를 기록한다. 새 `adminCsp` 구조에 대한 검증이므로 main에서 통과한 결과를 대신 재사용하지 않는다.

중요 리뷰 지적을 해결하고 Lore 형식으로 커밋한 뒤 develop 대상 PR을 작성한다. 본문에는 main 복구 PR 링크와 관리자 이미지 정책 유지 여부를 적는다. CI 통과 후 승인된 범위에서 병합한다. develop 병합 자체는 운영 배포를 일으키지 않는다.

- [ ] **Step 4: 최종 상태와 정리 범위를 보고한다.**

운영 복구와 develop 반영을 구분해 커밋·PR·검증 결과를 보고한다. 구현용 브랜치·worktree는 병합 확인과 산출물 보존 후 정리하되, 다른 작업의 브랜치·worktree·기존 미추적 파일은 보존한다. 자동 삭제는 리뷰·배포 실패 상태에서는 수행하지 않는다.

**완료 조건:** 운영 복구가 다음 develop 배포에도 유지되고 `/admin`과 하위 경로의 기존 이미지 정책이 보존된다.

---

## 자체 검토와 실행 방식

- 스펙 R1 → Task 1 Step 2~5의 두 지시어 검증과 최소 수정.
- 스펙 R2 → Task 1의 라우트 합성 및 Task 3의 `baseCsp`/`adminCsp` 보존.
- 스펙 R3 → Task 1의 실패→수정→통과, 전체 검증, 타입 검사 한계 기록.
- 스펙 R4 → Task 2의 원본 응답·실제 화면·캐시·진입 방식 검증.
- 배포 경계 → main 기반 hotfix PR, 자동 배포 연결 명시, 별도 develop 반영.
- 제품 수정 코드는 두 CSP 토큰에 한정한다. 테스트의 새 파일·함수 이름과 Task 3의 참조가 일치하며, 모든 Review Focus 항목에 검증 단계가 있다.
- 문서 링크·참조 파일 존재, 미완성 표식·공백, 코드 블록 경계, Bash/Python 예제 구문 검사를 통과했다. 계획 단계에서 제품 테스트나 배포는 실행하지 않았다.

권장 실행 방식은 **Native**다. 제품 수정이 한 파일이고 세 작업이 수정→배포 확인→develop 반영으로 순차 의존하므로, 한 에이전트가 구현하고 독립 리뷰어가 변경 전체를 검토하는 방식이 적절하다. **Subagent-driven**은 각 작업을 별도 구현자·검토자에게 넘기는 대안이며 이 규모에서는 인계 비용이 더 크다. 실행 방식과 계획 검토가 끝나면 선택된 실행 스킬로 진행한다.

## 2026-10-07 실행 기록

- main `7ca3aae4914b` 기준 및 develop `9fcd5d200fef` 기준의 별도 worktree에서 구현했다. 제품 변경은 각 CSP의 HTTPS 토큰 두 개뿐이다.
- RED: main 신규 계약 6건 실패/10건 통과, script-src만 수정해도 connect-src 6건 실패. 양쪽 추가 후 16건 통과. develop은 관리자 정책 2건을 추가하여 수정 전 6건 실패/12건 통과, 수정 후 18건 통과.
- main: frontend 3,748건 통과/1건 skip, backend 2,640건 통과. develop: frontend 3,786건 통과/1건 skip, backend 2,738건 통과. 두 기준 모두 양쪽 lint 오류 0, Nuxt production build 성공. 기존 lint 경고는 유지된다.
- 기존 지도·캐시·컴포넌트 포함 대상 검증: main 37건, develop 39건 통과. 독립 리뷰에서 두 변경 모두 코드·보안·스펙 지적 없음.
- 두 production build 각각 시설/부동산/관리자 3개 경로 × desktop/mobile에서 원본 응답 CSP가 t1 CDN 스크립트와 t2 CDN JSON 통신을 허용함을 확인했다(각 6건). CDN 응답은 테스트 stub이며 실제 지도 복구 증거로 간주하지 않는다.
- fixture와 호환되는 기존 시설 목록 SEO E2E는 desktop/mobile 각각 실행하여 두 브랜치에서 각 6건 통과했다.
- 전체 기본 E2E는 실제 seeded backend `:8000` 전제와 SEO fixture `:18080`가 혼재하여 main에서 8건 실패/4건 통과/2건 skip/72건 미실행 후 중단했다. 누락 시설 404와 지하철 500 실패는 수정 전 main 설정에서도 동일하게 재현했다. 임시 fixture 환경을 전체 E2E 통과 근거로 사용하지 않는다. 이번 수정 범위 밖의 UI·fixture를 바꾸지 않고 관련 브라우저 검증으로 범위를 제한했다. develop에서는 동일한 부적합 전체 실행을 반복하지 않았다.
- 별도 타입 검사는 설치된 vue-tsc 도구 체인이 없어 완료하지 못했다. build 성공을 타입 검사 성공으로 보고하지 않는다.
- 테스트는 loopback의 전용 `ilsangkit_kakao_csp_test` DB에서 실행했다. 운영 DB·제품 환경변수·lock 파일은 바꾸지 않았다.
- 배포 전 운영의 desktop/mobile에서 release `fixed-7ca3aae4914b`, 지도 이미지 0개, Map/Roadview 미정의, CDN 차단을 기록했다. 전용 브라우저 프로필을 보존했다.
- 실행 순서 조정: 운영 배포에 의존하지 않는 develop 포트 준비를 먼저 완료했다. 운영 복구 완료 판정은 승인된 배포 후 R4의 원본 응답·실제 지도 조작으로 수행한다.
- 로그·임시 E2E 설정·브라우저 근거는 각 worktree의 `.superpowers/sdd/2026-10-07-kakao-map-csp-recovery/`에 보존한다.
