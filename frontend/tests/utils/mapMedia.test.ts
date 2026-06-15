import { describe, it, expect } from 'vitest'
import { DETAIL_MAP_MEDIA_HEIGHT } from '~/utils/mapMedia'

describe('DETAIL_MAP_MEDIA_HEIGHT — 상세페이지 지도·로드뷰 공통 높이', () => {
  it('모바일 220px / 데스크톱 300px 클래스를 반환', () => {
    expect(DETAIL_MAP_MEDIA_HEIGHT).toBe('h-[220px] md:h-[300px]')
  })

  it('모바일 220px 토큰을 포함 (회귀 가드)', () => {
    expect(DETAIL_MAP_MEDIA_HEIGHT).toContain('h-[220px]')
  })
})
