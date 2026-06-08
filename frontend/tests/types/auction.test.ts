import { describe, it, expect } from 'vitest';
import { formatWon, formatWonKorean, formatBidRate, formatDiscount, statusLabel, AUCTION_SLUG } from '~/types/auction';

describe('auction helpers', () => {
  it('formatWon: 천단위 콤마', () => {
    expect(formatWon(210000000)).toBe('210,000,000');
    expect(formatWon(null)).toBe('-');
  });
  it('formatWonKorean: 억/만원 (원단위 입력)', () => {
    expect(formatWonKorean(210000000)).toBe('2억 1,000만원');
    expect(formatWonKorean(3000000)).toBe('300만원');
    expect(formatWonKorean(100000000)).toBe('1억원');
  });
  it('formatBidRate: % 표기', () => {
    expect(formatBidRate(82.5)).toBe('82.5%');
    expect(formatBidRate(null)).toBe('-');
  });
  it('formatDiscount: 감정가 대비 할인율(음수=할인)', () => {
    expect(formatDiscount(1000, 800)).toBe('-20%'); // 최저가가 감정가보다 20% 낮음
    expect(formatDiscount(null, 800)).toBe('-');
  });
  it('statusLabel: 상태 한글', () => {
    expect(statusLabel('ongoing')).toBe('진행중');
    expect(statusLabel('sold')).toBe('낙찰');
    expect(statusLabel('failed')).toBe('유찰');
  });
  it('AUCTION_SLUG', () => { expect(AUCTION_SLUG).toBe('auction'); });
});
