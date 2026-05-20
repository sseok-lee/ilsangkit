// frontend/tests/utils/priceFormat.test.ts
import { describe, it, expect } from 'vitest';
import { formatPriceManwon, formatChange } from '~/utils/priceFormat';

describe('formatPriceManwon', () => {
  it('formats >= 10000만원 (1억) as 억 with 1 decimal', () => {
    expect(formatPriceManwon(54000)).toBe('5.4억');
    expect(formatPriceManwon(100000)).toBe('10억');
    expect(formatPriceManwon(184000)).toBe('18.4억');
  });
  it('formats < 10000만원 as N,NNN만', () => {
    expect(formatPriceManwon(8500)).toBe('8,500만');
    expect(formatPriceManwon(120)).toBe('120만');
  });
  it('null/0 returns "—"', () => {
    expect(formatPriceManwon(null)).toBe('—');
    expect(formatPriceManwon(0)).toBe('—');
  });
});

describe('formatChange', () => {
  it('positive returns + sign with 1 decimal', () => {
    expect(formatChange(2.3)).toBe('+2.3%');
  });
  it('negative returns - sign', () => {
    expect(formatChange(-0.8)).toBe('-0.8%');
  });
  it('null returns "—"', () => {
    expect(formatChange(null)).toBe('—');
  });
  it('zero returns 0.0% with no sign', () => {
    expect(formatChange(0)).toBe('0.0%');
  });
  it('|pct|<0.05 rounds to 0.0% without sign', () => {
    expect(formatChange(0.04)).toBe('0.0%');
    expect(formatChange(-0.04)).toBe('0.0%');
  });
});
