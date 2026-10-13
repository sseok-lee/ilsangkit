import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')
const source = readFileSync(resolve(frontendRoot, 'pages/[category]/index.vue'), 'utf8')

describe('/trash 동별 목록 URL 탐색', () => {
  it('flag-on 동별 목록은 shared list와 실제 URL을 사용한다', () => {
    expect(source).toContain('<WasteAreaList')
    expect(source).toContain(':href-for="wasteAreaPageHref"')
    expect(source).toContain('@search="searchWasteAreas"')
    expect(source).toContain('wasteAreaPathForQuery(route.path')
  })

  it('area mode는 Nuxt async-data key와 dedupe cancel로 query race를 막는다', () => {
    expect(source).toContain('wasteAreaRequestKey(wasteAreaQuery.value)')
    expect(source).toContain("dedupe: 'cancel'")
    expect(source).toContain('watch: [wasteAreaQuery]')
  })

  it('기본 flag-off와 unresolved 원문 모드는 legacy source API를 유지한다', () => {
    expect(source).toContain('runtimeConfig.public.wasteAreaDiscoveryEnabled === true')
    expect(source).toContain("query.coverage !== 'unresolved'")
    expect(source).toContain("'/api/waste-schedules'")
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
