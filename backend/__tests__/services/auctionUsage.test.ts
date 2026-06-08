// backend/__tests__/services/auctionUsage.test.ts
import { describe, it, expect } from 'vitest';
import { toUsageGroup, USAGE_GROUPS } from '../../src/services/auctionUsage.js';

describe('toUsageGroup', () => {
  it('주거용 용도를 residential로 매핑', () => {
    expect(toUsageGroup('아파트')).toBe('residential');
    expect(toUsageGroup('다세대주택')).toBe('residential');
    expect(toUsageGroup('오피스텔')).toBe('residential');
  });
  it('토지 용도를 land로 매핑', () => {
    expect(toUsageGroup('대지')).toBe('land');
    expect(toUsageGroup('전')).toBe('land');
    expect(toUsageGroup('임야')).toBe('land');
  });
  it('상가/업무를 commercial로', () => {
    expect(toUsageGroup('근린생활시설')).toBe('commercial');
    expect(toUsageGroup('사무실')).toBe('commercial');
  });
  it('공장/창고를 industrial로', () => {
    expect(toUsageGroup('공장')).toBe('industrial');
    expect(toUsageGroup('창고')).toBe('industrial');
  });
  it('복합/기타', () => {
    expect(toUsageGroup('복합용건물')).toBe('complex');
    expect(toUsageGroup(null)).toBe('etc');
    expect(toUsageGroup('')).toBe('etc');
  });
  it('USAGE_GROUPS는 5개 정식 그룹 + etc', () => {
    expect(USAGE_GROUPS).toEqual(['residential', 'land', 'commercial', 'industrial', 'complex', 'etc']);
  });
});
