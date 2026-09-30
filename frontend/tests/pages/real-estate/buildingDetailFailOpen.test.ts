// frontend/tests/pages/real-estate/buildingDetailFailOpen.test.ts
//
// 회귀 가드: 부동산 상세 페이지의 SSR building-info 경로는 일시 장애를 확정 부재와
// 구분하고 fail-open 시맨틱을 유지해야 한다.
//
// 배경: 2026-06 데일리 싱크 타임아웃으로 building-info fetch 가 일시 실패하자, SSR 은 06-20 PR #467
// 에서 fetchFailed→fail-open(503) 으로 고쳐졌으나 클라 loadData 는 여전히 fail-CLOSED 였다:
//   buildingInfo.value = infoResult.status === 'fulfilled' ? infoResult.value : null  // ← 일시장애도 null
// 이 경우 loaded=true & hasBuildingInfo=false & fetchFailed=false = confirmedEmpty → 멀쩡한 상세
// 페이지가 클라 렌더(네이버 Yeti 포함)에서 noindex 로 뒤집혀 대량 색인제외가 발생했다.
//
// 고정 불변식: loadData 의 building-info 실패 분기는 buildingInfo 를 null 로 덮지 말고(직전 SSR 값 유지)
// fetchFailed 로 표시해야 한다. 진짜 없는 건물(404)은 getBuildingInfo 가 fulfilled+null 로 오므로
// confirmedEmpty→noindex 가 그대로 유지된다.
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const src = readFileSync(
  resolve(root, 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue'),
  'utf8',
)

describe('부동산 상세 SSR 은 building-info 일시 장애에 fail-open 해야 한다', () => {
  it('SSR 반환값의 infoFetchFailed 를 fetchFailed 로 반영한다', () => {
    expect(src).toContain('fetchFailed.value = data.infoFetchFailed ?? false')
  })

  it('일시 장애는 noindex/redirect 지역 판정에서 제외한다', () => {
    expect(src).toContain('isDetailSsrDegraded')
    expect(src).toContain('if (regionSourceInfo && !fetchFailed.value)')
  })

  it('building-info rejected 분기에서 infoFetchFailed 를 세운다', () => {
    expect(src).toMatch(
      /if\s*\(\s*infoResult\.status === 'rejected'\s*\)\s*infoFetchFailed = true/,
    )
  })
})
