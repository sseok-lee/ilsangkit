import { describe, it, expect } from 'vitest'
import { nearbyCountLabel } from '~/utils/nearbyCountLabel'

describe('nearbyCountLabel', () => {
  it('반경을 km 로 쓰고 개수에 천 단위 쉼표를 넣는다', () => {
    expect(nearbyCountLabel(2000, 14)).toBe('2km 안 14곳')
    expect(nearbyCountLabel(1000, 1942)).toBe('1km 안 1,942곳')
  })

  it('하한값(exact=false)이면 "이상"을 붙인다', () => {
    expect(nearbyCountLabel(2000, 20000, false)).toBe('2km 안 20,000곳 이상')
  })

  it('1km 미만 반경은 m 로 쓴다', () => {
    expect(nearbyCountLabel(500, 3)).toBe('500m 안 3곳')
  })
})
