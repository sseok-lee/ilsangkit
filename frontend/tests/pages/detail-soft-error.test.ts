import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 상세 페이지 soft-error 정책 회귀 가드.
 *
 * 정책(#467 / #674): 백엔드가 "없다"고 확정한 경우(404/422)만 하드 404.
 * 그 외 실패(5xx·네트워크·타임아웃)는 fail-open — 503 + no-store 로만 표시하고
 * noindex 나 하드 404 로 굳히지 않는다.
 *
 * 두 페이지가 이 정책에서 어긋나 있었다 (2026-07-28 라이브·진단 실측):
 *  - 토지 동상세: useAsyncData 의 error 를 보지 않고 `!data` 만으로 404 를 던져,
 *    일시 장애가 하드 404 로 굳었다. 네이버 `페이지를 찾을 수 없습니다` 50건 중 49건이 이 경로.
 *  - 청약 상세: getSubscriptionDetail 이 $fetch 예외를 그대로 올리므로 백엔드 404 도
 *    fetchError 로 들어오는데 상태코드를 보지 않아, 존재하지 않는 청약이 503 으로 나갔다
 *    (+ robots index,follow + 공유 title `청약 일정 | 일상킷`).
 *
 * 두 분기 모두 setup 최상단/`import.meta.server` 문맥이라 vitest 에서 그대로 실행되지 않으므로,
 * 이 저장소 선례(tests/pages/trash-list-modal.test.ts)와 같이 소스 단언으로 고정한다.
 */
const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')

const landDong = readFileSync(
  resolve(frontendRoot, 'pages/real-estate/land/[city]/[district]/[dong].vue'), 'utf8')
const subscription = readFileSync(
  resolve(frontendRoot, 'pages/subscription/[id].vue'), 'utf8')
const trashDetail = readFileSync(
  resolve(frontendRoot, 'pages/trash/[id].vue'), 'utf8')
const auctionItem = readFileSync(
  resolve(frontendRoot, 'pages/auction/item/[cltrMngNo].vue'), 'utf8')
const auctionRegion = readFileSync(
  resolve(frontendRoot, 'pages/auction/[city]/[district]/index.vue'), 'utf8')
const guideDetail = readFileSync(
  resolve(frontendRoot, 'pages/guide/[slug].vue'), 'utf8')
const articleDetail = readFileSync(
  resolve(frontendRoot, 'pages/article/[slug].vue'), 'utf8')
const districtHub = readFileSync(
  resolve(frontendRoot, 'pages/[city]/[district]/index.vue'), 'utf8')

describe('토지 동상세 — 일시 장애를 하드 404 로 굳히지 않는다', () => {
  it('useAsyncData 의 error 를 받아 분기한다', () => {
    expect(landDong).toContain('error: landError')
    expect(landDong).toMatch(/if \(landError\.value\) \{[\s\S]{0,120}markDegradedResponse\(\)/)
  })

  it('확정 부재일 때만 404 를 던진다 (error 없음 + data 없음)', () => {
    expect(landDong).toMatch(/\} else if \(!data\.value\) \{[\s\S]{0,140}statusCode: 404/)
  })

  it('error 검사 없이 곧바로 404 를 던지던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    expect(landDong).not.toMatch(/if \(import\.meta\.server \|\| !data\.value\) \{/)
  })

  it('fail-open 헬퍼를 import 한다', () => {
    expect(landDong).toContain("import { markDegradedResponse } from '~/composables/useDegradedResponse'")
  })
})

describe('청약 상세 — 백엔드 404 를 일시 장애로 오인하지 않는다', () => {
  it('에러 상태코드를 먼저 확인한다', () => {
    expect(subscription).toContain('const subErrStatus = fetchError.value?.statusCode')
  })

  it('404/422 는 하드 404 로 확정한다', () => {
    expect(subscription).toMatch(/subErrStatus === 404 \|\| subErrStatus === 422[\s\S]{0,160}statusCode: 404/)
  })

  it('그 외 에러만 degraded(503) 로 처리한다', () => {
    expect(subscription).toMatch(/\} else if \(fetchError\.value\) \{[\s\S]{0,160}markDegradedResponse\(\)/)
  })

  it('모든 에러를 일시 장애로 뭉뚱그리던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    // 과거: if (fetchError.value) { markDegradedResponse() } else if (!data.value) { 404 }
    // → 백엔드 404 가 throw 로 올라와 항상 첫 분기에 걸렸다.
    expect(subscription).not.toMatch(/^if \(fetchError\.value\) \{\s*\n\s*\/\/ 백엔드 일시 장애/m)
  })
})

/**
 * ── 2026-09-04 라이브 실측분 ──────────────────────────────────────────────────
 *
 * 네이버 진단: 접근 불가(4xx/410) 523건 · 소프트 404 25건 · 5xx 7건.
 * 아래 6개 페이지가 그 두 축 모두에 걸려 있었다.
 *  - /trash/{id}: 잘못된 id 를 HTTP 200 으로, 백엔드 5xx 를 "빈 본문 200"으로 응답.
 *  - 나머지 5개: 404/422/5xx/타임아웃을 하나의 null 로 뭉갠 뒤 전부 하드 404.
 */

describe('쓰레기 배출 상세 — 잘못된 id 는 진짜 4xx, 일시 장애는 503', () => {
  it('id 검증을 useAsyncData 보다 먼저 한다 (setup 최상단 throw)', () => {
    const guardAt = trashDetail.indexOf('TRASH_ID_PATTERN.test(rawScheduleId)')
    const asyncDataAt = trashDetail.indexOf('await useAsyncData(')
    expect(guardAt).toBeGreaterThan(-1)
    expect(asyncDataAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(asyncDataAt)
  })

  it('양의 정수만 허용하는 패턴을 쓴다', () => {
    expect(trashDetail).toContain('const TRASH_ID_PATTERN = /^[1-9]\\d*$/')
  })

  it('형식이 어긋나면 400 을 던진다', () => {
    expect(trashDetail).toMatch(
      /if \(!TRASH_ID_PATTERN\.test\(rawScheduleId\)\) \{[\s\S]{0,120}statusCode: 400/)
  })

  it('400 을 useAsyncData 핸들러 안에서 던지던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    // 과거: 핸들러 내부 throw → Nuxt 가 fetchError 로 흡수 → errorMsg 블록이 HTTP 200.
    expect(trashDetail).not.toMatch(/isNaN\(scheduleId\.value\)[\s\S]{0,120}statusCode: 400/)
  })

  it('존재하지 않는 숫자 id 는 그대로 하드 404 다', () => {
    expect(trashDetail).toMatch(
      /errStatus === 404 \|\| errStatus === 422[\s\S]{0,160}statusCode: 404/)
  })

  it('그 외 에러는 503 으로 표시하고 본문을 비우지 않는다', () => {
    expect(trashDetail).toMatch(/\} else if \(import\.meta\.server\) \{[\s\S]{0,600}markDegradedResponse\(\)/)
    expect(trashDetail).toMatch(/if \(fetchError\.value\) return '배출 정보를 불러오지 못했습니다/)
  })

  it('fail-open 헬퍼를 import 한다', () => {
    expect(trashDetail).toContain("import { markDegradedResponse } from '~/composables/useDegradedResponse'")
  })
})

describe('공매 물건 상세 — 일시 장애를 하드 404 로 굳히지 않는다', () => {
  it('useAsyncData 의 error 를 받아 분기한다', () => {
    expect(auctionItem).toContain('error: itemError')
    expect(auctionItem).toMatch(/\} else if \(itemError\.value\) \{[\s\S]{0,120}markDegradedResponse\(\)/)
  })

  it('백엔드 404/422 는 하드 404 로 확정한다', () => {
    expect(auctionItem).toMatch(/itemErrStatus === 404 \|\| itemErrStatus === 422[\s\S]{0,120}statusCode: 404/)
  })

  it('확정 부재(에러 없음 + data 없음)도 404 다', () => {
    expect(auctionItem).toMatch(/\} else if \(!data\.value\) \{[\s\S]{0,140}statusCode: 404/)
  })

  it('실패를 try/catch 로 삼켜 null 로 뭉개던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    expect(auctionItem).not.toMatch(/getItemDetail\(cltrMngNo\)[\s\S]{0,80}\} catch \{[\s\S]{0,40}return null/)
    expect(auctionItem).not.toContain('if (import.meta.server || !data.value) {')
  })

  it('fail-open 헬퍼를 import 한다', () => {
    expect(auctionItem).toContain("import { markDegradedResponse } from '~/composables/useDegradedResponse'")
  })
})

describe('공매 지역 허브 — 일시 장애를 하드 404 로 굳히지 않는다', () => {
  it('useAsyncData 의 error 를 받아 분기한다', () => {
    expect(auctionRegion).toContain('error: regionError')
    expect(auctionRegion).toMatch(/if \(regionError\.value\) \{[\s\S]{0,120}markDegradedResponse\(\)/)
  })

  it('확정 부재일 때만 404 를 던진다 (error 없음 + data 없음)', () => {
    expect(auctionRegion).toMatch(/\} else if \(!data\.value\) \{[\s\S]{0,140}statusCode: 404/)
  })

  it('실패를 try/catch 로 삼켜 null 로 뭉개던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    expect(auctionRegion).not.toMatch(/\} catch \{[\s\S]{0,40}return null/)
    expect(auctionRegion).not.toContain('if (import.meta.server || !data.value) {')
  })

  it('fail-open 헬퍼를 import 한다', () => {
    expect(auctionRegion).toContain("import { markDegradedResponse } from '~/composables/useDegradedResponse'")
  })
})

describe('가이드 상세 — 백엔드 5xx 와 없는 slug 를 구분한다', () => {
  it('useAsyncData 의 error 를 구조분해한다', () => {
    expect(guideDetail).toContain('error: guideError')
    expect(guideDetail).toContain('const guideErrStatus = guideError.value?.statusCode')
  })

  it('404/422 가 아닌 에러만 일시 장애로 본다', () => {
    expect(guideDetail).toContain(
      "const guideTransientFailure = !!guideError.value && guideErrStatus !== 404 && guideErrStatus !== 422")
  })

  it('일시 장애는 degraded(503), 확정 부재만 404/301 경로로 간다', () => {
    expect(guideDetail).toMatch(/if \(guideTransientFailure\) \{[\s\S]{0,80}markDegradedResponse\(\)/)
    expect(guideDetail).toContain('const guideConfirmedMissing = !guideTransientFailure && !guide.value')
  })

  it('301 이전 판정용 article 조회 실패도 부재로 뭉개지 않는다', () => {
    expect(guideDetail).toContain("if (migrated && 'transientFailure' in migrated) {")
    expect(guideDetail).not.toMatch(/fetchArticleBySlug\(slug\.value\)\.catch\(\(\) => null\)/)
  })

  it('error 를 보지 않고 곧바로 404 를 던지던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    expect(guideDetail).not.toMatch(/^if \(!guide\.value\) \{$/m)
  })

  it('fail-open 헬퍼를 import 한다', () => {
    expect(guideDetail).toContain("import { markDegradedResponse } from '~/composables/useDegradedResponse'")
  })
})

describe('오늘의 이슈 상세 — 백엔드 5xx 와 없는 slug 를 구분한다', () => {
  it('useAsyncData 의 error 를 구조분해한다', () => {
    expect(articleDetail).toContain('error: articleError')
    expect(articleDetail).toContain('const articleErrStatus = articleError.value?.statusCode')
  })

  it('404/422 는 하드 404, 그 외는 degraded(503)', () => {
    expect(articleDetail).toMatch(
      /articleErrStatus === 404 \|\| articleErrStatus === 422[\s\S]{0,140}statusCode: 404/)
    expect(articleDetail).toMatch(/\} else if \(articleError\.value\) \{[\s\S]{0,120}markDegradedResponse\(\)/)
  })

  it('확정 부재(에러 없음 + data 없음)도 404 다', () => {
    expect(articleDetail).toMatch(/\} else if \(!article\.value\) \{[\s\S]{0,140}statusCode: 404/)
  })

  it('error 를 보지 않고 곧바로 404 를 던지던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    expect(articleDetail).not.toMatch(/^if \(!article\.value\) \{$/m)
  })

  it('fail-open 헬퍼를 import 한다', () => {
    expect(articleDetail).toContain("import { markDegradedResponse } from '~/composables/useDegradedResponse'")
  })
})

describe('지역 허브(/{city}/{district}) — 지역 목록 blip 이 250개를 404 로 만들지 않는다', () => {
  it('지역 목록을 실제로 받아왔는지로만 확정 부재를 판정한다', () => {
    expect(districtHub).toContain(
      'const regionsLoaded = !regionsError.value && (regionsData.value?.length ?? 0) > 0')
  })

  it('목록을 못 받았으면 404 대신 degraded(503)', () => {
    expect(districtHub).toMatch(/if \(!regionsLoaded\) \{[\s\S]{0,120}markDegradedResponse\(\)/)
  })

  it('목록을 받아온 상태에서 그 구가 없을 때만 404 다', () => {
    expect(districtHub).toMatch(
      /\} else if \(!validDistricts\.some\(d => d\.slug === district\.value\)\) \{[\s\S]{0,140}statusCode: 404/)
  })

  it('빈 목록을 곧바로 404 로 굳히던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    expect(districtHub).not.toContain('if (validDistricts.length === 0 ||')
  })

  it('지역 목록 실패도 fetchFailed 에 포함해 noindex 로 굳지 않게 한다', () => {
    expect(districtHub).toContain('const fetchFailed = computed(() => !!error.value || !regionsLoaded)')
  })
})

describe('TRASH_ID_PATTERN — 양의 정수만 통과한다', () => {
  // 페이지 소스에 박힌 리터럴을 그대로 다시 세워 동작을 고정한다.
  // (SFC 안의 값이라 import 할 수 없어 소스 단언 + 동작 단언을 함께 둔다.)
  const pattern = /^[1-9]\d*$/

  it.each(['1', '7', '42', '6495', '10'])('허용: %s', (id) => {
    expect(pattern.test(id)).toBe(true)
  })

  it.each(['abc', '1.5', '-1', '01abc', '', ' ', '0', '01', '1a', 'NaN', '1e3', '٣'])(
    '거부: %j', (id) => {
      expect(pattern.test(id)).toBe(false)
    })

  it('페이지가 이 리터럴을 그대로 쓴다', () => {
    expect(trashDetail).toContain(`const TRASH_ID_PATTERN = ${pattern.toString()}`)
  })
})

/**
 * ── 전역 불변식 ──────────────────────────────────────────────────────────────
 *
 * 위 describe 들은 페이지를 하나씩 손으로 등록하는 로스터다. 그래서 새 페이지가 같은 실수를
 * 해도 아무도 알려주지 않았다 — 실제로 그렇게 놓쳤다. PR #770 이 상세 6종을 고치는 동안
 * 지하철 상세(사이트맵 제출 985개 URL)는 로스터에 없어서 그대로 남았고, `catch { return null }`
 * 로 에러를 통째로 삼키는 페이지가 4개 더 있었다(공매 목록·공매 허브·공매 시/도·토지 허브).
 *
 * 로스터 대신 불변식으로 고정한다. 페이지가 SSR 조회 실패를 삼키면서 fail-open 신호를
 * 내지 않으면, 파일을 등록하지 않아도 여기서 깨진다.
 *
 * ## ⚠️ 이 파일이 증명하지 못하는 것
 *
 * 여기 있는 검사는 전부 **소스 텍스트**를 읽는다. 프로덕션 코드를 한 줄도 실행하지 않는다.
 * 따라서 "호출이 소스에 있다"까지만 보장하고 "런타임에 그 호출이 실제로 일어난다"는
 * 보장하지 못한다. 예를 들어 `if (false && import.meta.server) markDegradedResponse()`
 * 로 죽여 놓아도 여기서는 통과한다.
 *
 * 이 한계를 적어 두는 이유는, 이 저장소가 정확히 그 오독으로 결함을 오래 놓쳤기 때문이다
 * (커밋 076a1a82 은 호출을 useAsyncData 핸들러 안에 두어 503 이 한 번도 나가지 않았는데
 *  테스트는 전부 초록이었다). "이 파일이 통과했으니 fail-open 이 동작한다"고 읽지 마라.
 * 동작 확인은 실제 요청으로 한다 — 백엔드를 내리거나 잘못된 파라미터를 주고
 * 응답 코드가 503 인지 본다.
 *
 * 아래 첫 불변식은 그 한계 안에서 할 수 있는 가장 강한 것이다: 실행하지 않고도
 * "이 위치에 있으면 반드시 죽는다"는 성질(핸들러 안 = Nuxt 컨텍스트 없음)을 잡는다.
 */
describe('fail-open 전역 불변식 — 삼킨 에러는 반드시 degraded 신호를 낸다', () => {
  function allPageSources(): Array<{ path: string; source: string }> {
    const out: Array<{ path: string; source: string }> = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full)
        else if (entry.name.endsWith('.vue')) {
          out.push({ path: relative(frontendRoot, full), source: readFileSync(full, 'utf8') })
        }
      }
    }
    walk(resolve(frontendRoot, 'pages'))
    return out
  }

  /**
   * `source[openIdx]` 의 여는 괄호와 짝이 되는 닫는 괄호까지를 잘라낸다.
   * 문자열 리터럴 안의 괄호는 세지 않는다.
   */
  function sliceBalanced(source: string, openIdx: number, open: string, close: string): string {
    let depth = 0
    let quote: string | null = null
    for (let i = openIdx; i < source.length; i++) {
      const c = source[i]
      if (quote) {
        if (c === '\\') { i++; continue }
        if (c === quote) quote = null
        continue
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue }
      if (c === open) depth++
      else if (c === close) {
        depth--
        if (depth === 0) return source.slice(openIdx, i + 1)
      }
    }
    return source.slice(openIdx)
  }

  /**
   * ★ 실제로 배포된 결함을 잡는 불변식.
   *
   * markDegradedResponse() 는 useNuxtApp() 을 부른다. useAsyncData 핸들러 본문은 중첩
   * async 라 Nuxt 인스턴스 컨텍스트가 없고, 그 안에서 부르면 useNuxtApp() 이 그 자리에서
   * throw 한다 — 503 은 영영 나가지 않는다.
   *
   * 종전 이 자리의 불변식은 `catch { return null }` 안에 markDegradedResponse 라는
   * **문자열이 있는지**만 봤다. 그래서 호출을 핸들러 안에 두는 것을 막기는커녕 오히려
   * 그 형태를 요구했고, 커밋 076a1a82 의 5개 호출부가 전부 죽은 채로 통과했다
   * (실측 2026-09-04: `/auction/list?page=abc` 가 200 + payload 에
   * "A composable that requires access to the Nuxt instance").
   */
  it('markDegradedResponse 를 useAsyncData 핸들러 안에서 부르지 않는다 (부르면 컨텍스트가 없어 죽는다)', () => {
    const offenders: string[] = []

    for (const { path, source } of allPageSources()) {
      for (const m of source.matchAll(/use(?:Lazy)?AsyncData\s*\(/g)) {
        const openIdx = m.index! + m[0].length - 1
        const call = sliceBalanced(source, openIdx, '(', ')')
        if (call.includes('markDegradedResponse')) {
          const line = source.slice(0, m.index!).split('\n').length
          offenders.push(`${path}:${line}`)
        }
      }
    }

    expect(offenders, [
      'useAsyncData 핸들러 안에서 markDegradedResponse() 를 부르는 곳이 있다.',
      '핸들러 본문에는 Nuxt 컨텍스트가 없어 useNuxtApp() 이 throw 하고, 503 은 나가지 않는다.',
      '핸들러 밖에서 useAsyncData 가 돌려주는 error 를 보고 불러라:',
      "  const { data, error } = await useAsyncData(key, () => fetch())",
      '  if (error.value && import.meta.server) markDegradedResponse()',
    ].join('\n')).toEqual([])
  })

  /**
   * 조회 실패를 삼키면서 아무 신호도 내지 않는 페이지를 찾는다.
   *
   * 종전 정규식은 `catch\s*\{([^}]*)\}` 였다. 거짓 음성이 셋 있었다.
   *  - 본문에 중괄호가 있으면 `[^}]*` 가 조기 종료돼 통째로 놓친다
   *  - `return undefined` / `return []` / `return {}` 형태를 못 본다
   *  - `.catch(() => null)` 체인을 못 본다
   */
  it('조회 실패를 삼키는 페이지는 degraded 신호를 낸다 (삼킨 자리와 무관하게 파일 안에 존재해야 한다)', () => {
    const SENTINEL = /return\s*(?:null|undefined|\[\s*\]|\{\s*\})\s*[;\n}]/
    const offenders: string[] = []

    for (const { path, source } of allPageSources()) {
      const swallows: string[] = []

      // 1) try/catch — 본문을 중괄호 짝으로 정확히 잘라낸다.
      for (const m of source.matchAll(/catch\s*(?:\([^)]*\))?\s*\{/g)) {
        const openIdx = m.index! + m[0].length - 1
        const body = sliceBalanced(source, openIdx, '{', '}')
        if (SENTINEL.test(body)) swallows.push('catch')
      }
      // 2) .catch(() => null) 체인
      if (/\.catch\(\s*\([^)]*\)\s*=>\s*(?:null|undefined|\[\s*\]|\{\s*\})\s*\)/.test(source)) {
        swallows.push('.catch(() => null)')
      }

      if (swallows.length === 0) continue
      // 삼키더라도 그 페이지가 어딘가에서 degraded 를 알리면 된다.
      // (핸들러 밖에서 error 를 보고 부르는 형태가 정상이므로 위치는 따지지 않는다.
      //  위치 규칙은 바로 위 불변식이 따로 강제한다.)
      if (/markDegradedResponse\(\)/.test(source)) continue
      // 명시적 면제. 색인 대상이 아닌 페이지(무조건 noindex)처럼 degraded 신호가 의미 없는
      // 경우가 있다. 소스에서 noindex 여부를 정규식으로 추정하면 조건부 noindex 페이지 9곳을
      // 잘못 면제하게 되므로, 추정하지 않고 현장에 이유를 적게 한다.
      if (/fail-open-exempt:/.test(source)) continue
      offenders.push(`${path} :: ${[...new Set(swallows)].join(', ')}`)
    }

    expect(offenders, [
      '조회 실패를 삼키면서 degraded 신호를 내지 않는 페이지가 있다.',
      '백엔드가 죽으면 그 페이지는 빈 본문 + HTTP 200 + index 로 색인된다(소프트 404).',
    ].join('\n')).toEqual([])
  })

  it('markDegradedResponse 를 쓰는 페이지는 그 헬퍼를 import 한다', () => {
    const missing = allPageSources()
      .filter(({ source }) => /markDegradedResponse\(\)/.test(source))
      .filter(({ source }) => !source.includes("from '~/composables/useDegradedResponse'"))
      .map(({ path }) => path)

    expect(missing, '호출은 하는데 import 가 없다 — 런타임 ReferenceError 가 된다').toEqual([])
  })
})

describe('지하철 상세 — 일시 장애를 하드 404 로 굳히지 않는다', () => {
  const subwayDetail = readFileSync(resolve(frontendRoot, 'pages/subway/[slug].vue'), 'utf8')

  it('확정 부재(404/422)와 일시 장애를 갈라서 처리한다', () => {
    expect(subwayDetail).toMatch(/stationErrStatus === 404 \|\| stationErrStatus === 422/)
    expect(subwayDetail).toMatch(/else if \(error\.value\) \{[\s\S]{0,120}markDegradedResponse\(\)/)
  })

  it('error 와 data 없음을 한 덩어리로 묶어 404 를 던지던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    // 이 형태가 사이트맵 제출 985개 역 URL 을 백엔드 blip 마다 404 로 만들었다.
    expect(subwayDetail).not.toMatch(/if \(\(error\.value \|\| !data\.value\?\.data\) && !pending\.value\)/)
  })

  it('fail-open 헬퍼를 import 한다', () => {
    expect(subwayDetail).toContain("import { markDegradedResponse } from '~/composables/useDegradedResponse'")
  })
})

/**
 * 허브·목록 페이지의 fail-open.
 *
 * 상세 페이지만 보다가 놓친 계열이다. 이 페이지들은 `await useAsyncData(...)` 를 하면서
 * error ref 를 구조분해조차 하지 않았다(또는 빨간 알림 렌더에만 썼다). 백엔드가 흔들리면
 * 스켈레톤·빈 목록·에러 알림만 든 문서가 HTTP 200 + index, follow + self-canonical 로 나간다.
 * 하필 사이트에서 내부링크가 가장 많이 몰리는 페이지들이라 소프트 404 로는 최악의 위치다.
 *
 * 상세와 달리 404 를 던지면 안 된다 — 정상 상태에서 색인 대상인 페이지이므로 fail-open
 * (503 + no-store)만 건다. noindex 도 걸지 않는다.
 */
describe('허브·목록 — 상류 실패를 200 + index 로 굳히지 않는다', () => {
  const HUB_PAGES: Array<[string, string]> = [
    ['시설 허브 15종', 'pages/[category]/index.vue'],
    ['가이드 목록', 'pages/guide/index.vue'],
    ['오늘의 이슈 목록', 'pages/article/index.vue'],
    ['청약 목록', 'pages/subscription/index.vue'],
    ['지하철 목록', 'pages/subway/index.vue'],
    ['공매 허브', 'pages/auction/index.vue'],
    ['공매 목록', 'pages/auction/list.vue'],
    ['공매 시/도', 'pages/auction/[city]/index.vue'],
    ['토지 허브', 'pages/real-estate/land/index.vue'],
  ]

  it.each(HUB_PAGES)('%s 는 상류 실패 시 markDegradedResponse 를 부른다', (_label, relative) => {
    const source = readFileSync(resolve(frontendRoot, relative), 'utf8')

    expect(source).toContain("import { markDegradedResponse } from '~/composables/useDegradedResponse'")
    expect(source).toMatch(/import\.meta\.server[\s\S]{0,80}markDegradedResponse\(\)/)
  })

  it.each(HUB_PAGES)('%s 는 상류 실패를 noindex 로 굳히지 않는다', (_label, relative) => {
    const source = readFileSync(resolve(frontendRoot, relative), 'utf8')

    // 일시 장애로 noindex 를 내면 재크롤 전까지 색인에서 빠진다. degraded 신호와 noindex 가
    // 같은 조건에 함께 붙어 있으면 안 된다.
    expect(source).not.toMatch(/markDegradedResponse\(\)[\s\S]{0,200}robots['"`\s:]+['"`]noindex/)
  })
})
