import { describe, expect, it } from 'vitest'
import { buildWasteAreaHead } from '~/utils/wasteAreaSeo'

const base = {
  areaId: 101,
  title: '서울특별시 강남구 역삼1동',
  description: '서울특별시 강남구 역삼1동의 쓰레기 배출 요일, 시간, 조건, 원본 출처를 확인하세요.',
  indexEligible: true,
  hasSchedules: true,
  hasQuery: false,
  sourceState: 'ok' as const,
}

describe('buildWasteAreaHead', () => {
  it('uses self-canonical only for index-eligible area pages without query state', () => {
    const head = buildWasteAreaHead(base)

    expect(head.meta).toContainEqual({ name: 'robots', content: 'index, follow' })
    expect(head.link).toEqual([{ rel: 'canonical', href: 'https://ilsangkit.co.kr/trash/areas/101' }])
  })

  it('removes canonical and emits noindex/follow for query URLs', () => {
    const head = buildWasteAreaHead({ ...base, hasQuery: true })

    expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
    expect(head.link).toEqual([])
  })

  it.each(['unresolved', 'empty', 'error'] as const)('noindexes %s area states', (sourceState) => {
    const head = buildWasteAreaHead({ ...base, sourceState })

    expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
    expect(head.link).toEqual([])
  })
})
