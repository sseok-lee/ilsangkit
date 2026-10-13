import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')
const source = readFileSync(resolve(frontendRoot, 'pages/[category]/index.vue'), 'utf8')

describe('/trash 동별 목록 URL 탐색', () => {
  it('trash 목록은 source-list controls와 panel을 사용한다', () => {
    expect(source).toContain('<WasteListSearch')
    expect(source).toContain('<WasteListPanel')
    expect(source).toContain('useWasteList({')
    expect(source).toContain('await wasteList.state')
  })

  it('동 옵션은 보조 async-data로 분리해서 기다린다', () => {
    expect(source).toContain('useWasteAreaOptions({')
    expect(source).toContain('await wasteAreaOptions.state')
  })

  it('동 필터와 pagination은 source-list query href를 사용한다', () => {
    expect(source).toContain('wasteListPathForQuery(route.path')
    expect(source).toContain('areaId: query.areaId')
  })
})

describe('/trash 허브 재조회 실패 처리', () => {
  /**
   * useWasteSchedule.getSchedules 는 실패를 가짜 일정('{구} 1동~3동', '02-1234-5678')으로
   * 덮지 않고 throw 한다. 허브의 지역/키워드 변경도 이 함수를 호출하므로
   * 잡지 않으면 unhandled rejection 이 되고 목록이 조용히 이전 상태로 남는다.
   */
  it('재조회 실패를 잡아 오류 상태로 남긴다', () => {
    expect(source).toContain('wasteList.state.error.value')
  })

  it('실패를 "등록된 배출 일정이 없습니다" 빈 상태로 표시하지 않는다', () => {
    expect(source).toContain(':error="wasteList.state.error.value"')
  })

  it('오류 배너에서 재시도할 수 있다', () => {
    expect(source).toContain('@retry="refreshWasteList"')
  })
})
