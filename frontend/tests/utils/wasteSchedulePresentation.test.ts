import { describe, expect, it } from 'vitest'
import {
  splitWasteTargetForDisplay,
  summarizeWasteTarget,
  wasteSourceTitle,
} from '~/utils/wasteSchedule'

describe('waste schedule presentation helpers', () => {
  it.each([
    ['요양원,칠량면소재지,초등학교.칠량시장,덕동', '', '요양원·칠량면소재지 등'],
    ['송산,구로,칠량면소재지,영동뒷길', '', '송산·구로·칠량면소재지 등'],
    ['봉황(월궁,안길),보련', '', '봉황(월궁,안길)·보련'],
    ['신동읍', '예미2길 26-49', '예미2길 26-49'],
    ['가나무로', '문앞', '가나무로'],
    ['없음', '', '적용 구역 확인 필요'],
  ])('titles %s without changing coverage', (targetRegion, emissionPlace, expected) => {
    expect(wasteSourceTitle({ targetRegion, emissionPlace, city: '경기도', district: '의왕시' })).toBe(expected)
  })

  it('splits only top-level separators and keeps dotted place names intact', () => {
    expect(splitWasteTargetForDisplay('초등학교.칠량시장,봉황(월궁,안길)+보련;덕동')).toEqual([
      '초등학교.칠량시장',
      '봉황(월궁,안길)',
      '보련',
      '덕동',
    ])
  })

  it('keeps unbalanced parentheses as opaque text', () => {
    expect(splitWasteTargetForDisplay('봉황(월궁,안길,보련')).toEqual(['봉황(월궁,안길,보련'])
  })

  it('does not escape or rewrite HTML-looking source text while summarizing', () => {
    expect(summarizeWasteTarget('<b>대상</b>,시장')).toBe('<b>대상</b>·시장')
  })

  it('treats empty placeholders as no provided target while retaining meaningful closed states elsewhere', () => {
    expect(wasteSourceTitle({ targetRegion: '해당사항없음', emissionPlace: null, city: '서울특별시', district: '강남구' })).toBe('적용 구역 확인 필요')
    expect(summarizeWasteTarget('미운영')).toBe('미운영')
  })

  it('keeps a long first token instead of dropping identity text', () => {
    expect(summarizeWasteTarget('아주아주아주긴대상지역명입니다,다음지역')).toBe('아주아주아주긴대상지역명입니다 등')
  })
})
