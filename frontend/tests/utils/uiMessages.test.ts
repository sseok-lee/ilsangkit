import { describe, it, expect } from 'vitest'
import { UI_MESSAGES, emptyFiltered } from '~/utils/uiMessages'

describe('UI_MESSAGES', () => {
  it('고정 메시지에 마침표가 없다', () => {
    Object.values(UI_MESSAGES).forEach(msg => {
      expect(msg.endsWith('.')).toBe(false)
    })
  })
  it('검색 빈상태 / 로딩 / 에러 표준 문구', () => {
    expect(UI_MESSAGES.emptySearch).toBe('검색 결과가 없습니다')
    expect(UI_MESSAGES.loading).toBe('불러오는 중…')
    expect(UI_MESSAGES.fetchError).toBe('데이터를 불러오는 중 오류가 발생했습니다')
    expect(UI_MESSAGES.notFound).toBe('요청한 정보를 찾을 수 없습니다')
  })
  it('emptyFiltered는 대상별 문구를 만든다', () => {
    expect(emptyFiltered('청약')).toBe('조건에 맞는 청약이 없습니다')
    expect(emptyFiltered('매물')).toBe('조건에 맞는 매물이 없습니다')
  })
})
