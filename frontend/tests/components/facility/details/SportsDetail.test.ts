import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SportsDetail from '~/components/facility/details/SportsDetail.vue'
import DetailRow from '~/components/facility/DetailRow.vue'
import type { SportsDetails } from '~/types/facility'

describe('SportsDetail', () => {
  const globalConfig = {
    global: {
      components: { DetailRow },
    },
  }

  it('ftypeNm 뱃지 색상: 축구장 (green)', () => {
    const details: SportsDetails = { ftypeNm: '축구장' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-green-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('축구장')
  })

  it('ftypeNm 뱃지 색상: 농구장 (orange)', () => {
    const details: SportsDetails = { ftypeNm: '농구장' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-orange-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('농구장')
  })

  it('ftypeNm 뱃지 색상: 수영장 (blue)', () => {
    const details: SportsDetails = { ftypeNm: '수영장' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-blue-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('수영장')
  })

  it('ftypeNm 뱃지 색상: 체육관 (purple)', () => {
    const details: SportsDetails = { ftypeNm: '체육관' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-purple-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('체육관')
  })

  it('ftypeNm 뱃지 색상: 기타 (gray)', () => {
    const details: SportsDetails = { ftypeNm: '테니스장' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    const ftypeBadge = wrapper.find('.bg-slate-100')
    expect(ftypeBadge.exists()).toBe(true)
  })

  it('faciGbNm 뱃지: 공공 (blue)', () => {
    const details: SportsDetails = { faciGbNm: '공공' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-blue-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('공공')
  })

  it('faciGbNm 뱃지: 민간 (orange)', () => {
    const details: SportsDetails = { faciGbNm: '민간' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    const badge = wrapper.find('.bg-orange-100')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('민간')
  })

  it('fcobNm 업종명 표시', () => {
    const details: SportsDetails = { fcobNm: '체육시설업' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('체육시설업')
  })

  it('faciGfa 시설면적 ㎡ 포맷팅', () => {
    const details: SportsDetails = { faciGfa: '1500.00' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('1500.00㎡')
  })

  it('standCptPsnCnt 관람석수 숫자 포맷팅', () => {
    const details: SportsDetails = { standCptPsnCnt: 5000 }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('5,000')
  })

  it('faciHomepage 외부 링크 target="_blank" rel="noopener"', () => {
    const details: SportsDetails = { faciHomepage: 'https://example.com' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    const link = wrapper.find('a[target="_blank"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('https://example.com')
    expect(link.attributes('rel')).toContain('noopener')
  })

  it('fmngTypeGbNm 관리유형 표시', () => {
    const details: SportsDetails = { fmngTypeGbNm: '공공관리' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('공공관리')
  })

  it('nationYn Y일 때 국가대표시설 뱃지 표시', () => {
    const details: SportsDetails = { nationYn: 'Y' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).toContain('국가대표시설')
  })

  it('nationYn N일 때 국가대표시설 뱃지 숨김', () => {
    const details: SportsDetails = { nationYn: 'N' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).not.toContain('국가대표시설')
  })

  it('null/undefined 필드 숨김 처리', () => {
    const details: SportsDetails = { ftypeNm: '축구장' }
    const wrapper = mount(SportsDetail, { props: { details }, ...globalConfig })
    expect(wrapper.text()).not.toContain('업종명')
    expect(wrapper.text()).not.toContain('시설면적')
    expect(wrapper.text()).not.toContain('관람석수')
    expect(wrapper.text()).not.toContain('관리유형')
    expect(wrapper.text()).not.toContain('홈페이지')
  })
})
