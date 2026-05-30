import { describe, it, expect } from 'vitest'
import {
  getDetailEyebrow, getTrendSectionTitle, getTxSectionTitle,
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
})
