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
