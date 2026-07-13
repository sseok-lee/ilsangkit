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
