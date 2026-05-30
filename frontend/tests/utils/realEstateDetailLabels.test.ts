import { describe, it, expect } from 'vitest'
import {
  getDetailEyebrow, getTrendSectionTitle, getTxSectionTitle, getJeonsePct,
} from '~/utils/realEstateDetailLabels'

describe('realEstateDetailLabels', () => {
  it('eyebrow는 모드별로 다르다', () => {
    expect(getDetailEyebrow('아파트', 'sale')).toBe('아파트 매매 실거래')
    expect(getDetailEyebrow('아파트', 'rent')).toBe('아파트 전세·월세 시세')
  })
  it('시세 추이 제목', () => {
    expect(getTrendSectionTitle('sale')).toBe('매매가 추이')
    expect(getTrendSectionTitle('rent')).toBe('전월세 시세 추이')
  })
  it('거래 내역 제목', () => {
    expect(getTxSectionTitle('sale')).toBe('매매 거래 내역')
    expect(getTxSectionTitle('rent')).toBe('전월세 거래 내역')
  })
  it('전세 비율을 반올림해 계산한다', () => {
    expect(getJeonsePct(7, 3)).toBe(70)
    expect(getJeonsePct(1, 1)).toBe(50)
    expect(getJeonsePct(2, 1)).toBe(67)
  })
  it('합계가 0이면 0을 반환한다', () => {
    expect(getJeonsePct(0, 0)).toBe(0)
  })
})
