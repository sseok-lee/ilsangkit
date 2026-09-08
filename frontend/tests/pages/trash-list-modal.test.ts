import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')
const source = readFileSync(resolve(frontendRoot, 'pages/[category]/index.vue'), 'utf8')

describe('/trash 목록 상세 모달 연결', () => {
  it('카드 선택을 query 기반 상세 모달로 연결한다', () => {
    expect(source).toContain('@select="openWasteSchedule"')
    expect(source).toContain('<WasteScheduleDetailModal')
    expect(source).toContain(':open="selectedWasteScheduleId !== null"')
    expect(source).toContain('getScheduleDetail')
    expect(source).toContain('route.query.schedule')
  })
})

describe('/trash 허브 재조회 실패 처리', () => {
  /**
   * useWasteSchedule.getSchedules 는 실패를 가짜 일정('{구} 1동~3동', '02-1234-5678')으로
   * 덮지 않고 throw 한다. 허브의 지역/키워드 변경도 이 함수를 호출하므로
   * 잡지 않으면 unhandled rejection 이 되고 목록이 조용히 이전 상태로 남는다.
   */
  it('재조회 실패를 잡아 오류 상태로 남긴다', () => {
    expect(source).toMatch(/catch\s*\{[\s\S]*?wasteLoadError\.value = true/)
  })

  it('실패를 "등록된 배출 일정이 없습니다" 빈 상태로 표시하지 않는다', () => {
    expect(source).toMatch(/EmptyState[\s\S]{0,200}?v-if="!wasteLoadError && wasteSchedules\.length === 0/)
  })

  it('오류 배너에서 재시도할 수 있다', () => {
    expect(source).toContain('@click="loadWasteSchedules"')
  })
})
