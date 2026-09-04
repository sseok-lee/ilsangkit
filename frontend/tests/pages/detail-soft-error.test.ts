import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
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
