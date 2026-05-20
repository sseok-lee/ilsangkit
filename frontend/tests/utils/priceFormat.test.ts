// frontend/tests/utils/priceFormat.test.ts
import { describe, it, expect } from 'vitest';
import { formatPrice, formatChange } from '~/utils/priceFormat';

describe('formatPrice', () => {
  it('formats >= 10000만원 (1억) as 억 with 1 decimal', () => {
    expect(formatPrice(54000)).toBe('5.4억');
    expect(formatPrice(100000)).toBe('10억');
    expect(formatPrice(184000)).toBe('18.4억');
  });
  it('formats < 10000만원 as N,NNN만', () => {
    expect(formatPrice(8500)).toBe('8,500만');
    expect(formatPrice(120)).toBe('120만');
  });
  it('null/0 returns "—"', () => {
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(0)).toBe('—');
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
