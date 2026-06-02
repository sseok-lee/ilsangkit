import { describe, it, expect } from 'vitest'
import { subwayCanonicalUrl } from '~/utils/subwayCanonical'

describe('subwayCanonicalUrl', () => {
  it('슬러그로 canonical URL을 만든다', () => {
    expect(subwayCanonicalUrl('gangnam')).toBe('https://ilsangkit.co.kr/subway/gangnam')
  })
  it('빈 슬러그는 /subway로', () => {
    expect(subwayCanonicalUrl('')).toBe('https://ilsangkit.co.kr/subway')
  })
})
