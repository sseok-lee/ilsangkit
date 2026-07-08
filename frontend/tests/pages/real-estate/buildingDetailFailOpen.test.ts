// frontend/tests/pages/real-estate/buildingDetailFailOpen.test.ts
//
// 회귀 가드: 부동산 상세 페이지의 클라이언트 재요청 경로(loadData)는 SSR 팩토리와 동일한
// fail-open 시맨틱을 유지해야 한다.
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

describe('부동산 상세 loadData 는 building-info 일시 장애에 fail-open 해야 한다', () => {
  it('클라 재요청 실패를 fetchFailed 로 표시한다 (fail-open 배선 존재)', () => {
    // loadData 종료 시 클라 실패 여부를 fetchFailed 로 반영해야 noindex 판정이 fail-open 된다.
    expect(src).toContain('fetchFailed.value = infoFetchFailed')
  })

  it('일시 장애를 buildingInfo=null 로 덮는 fail-closed 패턴이 없어야 한다', () => {
    // 구 버그 라인(클라 전용). SSR 팩토리의 `const resolvedBuildingInfo = ... : null` 과는 구분된다.
    expect(src).not.toMatch(
      /buildingInfo\.value\s*=\s*infoResult\.status === 'fulfilled'\s*\?\s*infoResult\.value\s*:\s*null/,
    )
  })

  it('building-info rejected 분기에서 fetchFailed 를 세운다 (fail-open)', () => {
    // infoResult 가 fulfilled 면 값 반영, 아니면(rejected=일시장애) fetchFailed 로 표시.
    expect(src).toMatch(
      /if\s*\(\s*infoResult\.status === 'fulfilled'\s*\)\s*\{[\s\S]*?buildingInfo\.value = infoResult\.value[\s\S]*?\}\s*else\s*\{[\s\S]*?infoFetchFailed = true[\s\S]*?\}/,
    )
  })
})
