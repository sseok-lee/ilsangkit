import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * trash 집계 페이지의 색인 정상화 회귀 가드.
 *
 * 두 결함이 함께 있었다 (2026-07-28 네이버 진단 + 라이브 실측):
 *  1) /trash/{id} 의 301 목적지에 ?schedule={id} 가 붙어, 개별 상세 N 개가 N 개의 서로 다른
 *     URL 로 되살아났다. 표본에서 이미 93건이 그렇게 전환돼 있었다
 *     (전북 고창군 33건이 모두 "전북 고창군 쓰레기 배출정보 | 배출일·분리수거 | 일상킷").
 *  2) 집계 페이지가 배출 일정 목록을 SSR 하지 않아 크롤러가 받는 본문이 "0건 · 조회 중..." 뿐이었고
 *     전국 구·군 페이지의 본문이 사실상 동일했다.
 *
 * 리다이렉트는 `import.meta.server` 가드 안에 있어 vitest 에서 발화하지 않으므로,
 * 이 저장소의 기존 선례(tests/pages/trash-list-modal.test.ts)와 같이 소스 텍스트로 단언한다.
 */
const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')

const trashDetail = readFileSync(resolve(frontendRoot, 'pages/trash/[id].vue'), 'utf8')
const regionCategory = readFileSync(resolve(frontendRoot, 'pages/[city]/[district]/[category].vue'), 'utf8')

describe('/trash/{id} → 구·군 집계 301', () => {
  it('301 목적지에 쿼리를 붙이지 않는다 (경로 문자열만 전달)', () => {
    expect(trashDetail).toContain('await navigateTo(trashRegionPath.value, { redirectCode: 301 })')
  })

  it('schedule 쿼리를 리다이렉트 목적지에 되붙이지 않는다 (회귀 핵심)', () => {
    // 과거 구현: navigateTo({ path, query: { schedule: String(scheduleId.value) } }, ...)
    expect(trashDetail).not.toMatch(/query:\s*\{\s*schedule/)
  })

  it('301 코드를 유지한다 (302 로 약화 금지 — 색인 통합 신호)', () => {
    expect(trashDetail).toContain('redirectCode: 301')
  })
})

describe('구·군 trash 집계 페이지 SSR', () => {
  it('배출 일정 목록을 useAsyncData 로 SSR 로드한다', () => {
    expect(regionCategory).toMatch(/useAsyncData\(\s*\n?\s*`waste-region-/)
    expect(regionCategory).toContain('transformToRegionSchedules(res.data)')
  })

  it('건수만 받던 limit=1 경량 조회로 되돌아가지 않는다', () => {
    // meta description 용 건수는 목록 응답(total)에서 파생한다 — 별도 요청을 만들지 않는다.
    expect(regionCategory).not.toMatch(/`waste-count-/)
    expect(regionCategory).toContain('wasteSsr.value?.total')
  })

  it('SSR 실패는 fail-open(503+no-store) 으로 처리한다 — 빈 본문 200 색인 금지', () => {
    expect(regionCategory).toMatch(/wasteSsrError\.value\)\s*markDegradedResponse\(\)/)
  })

  it('표시 상태를 시설 목록과 동일한 순수 함수에 위임한다', () => {
    expect(regionCategory).toContain('resolveRegionDisplay<RegionSchedule>')
    expect(regionCategory).toContain('wasteSsrConsumed')
  })

  it('템플릿이 SSR 반영 값을 바인딩한다 (클라이언트 전용 ref 직접 바인딩 금지)', () => {
    expect(regionCategory).toContain(':schedules="displayWasteSchedules"')
    expect(regionCategory).toContain(':total="displayWasteTotal"')
    expect(regionCategory).toContain(':total-pages="displayWasteTotalPages"')
    expect(regionCategory).toContain(':loading="displayWasteLoading"')
  })

  it('클라이언트 재조회 시 SSR 데이터를 소비 처리한다', () => {
    expect(regionCategory).toMatch(/async function loadWasteSchedules\(\)\s*\{\s*\n\s*wasteSsrConsumed\.value = true/)
  })
})
