import { describe, it, expect } from 'vitest';
import {
  computeStatus,
  todayInKst,
} from '../../src/services/publicRentalAnnouncementService.js';

describe('computeStatus', () => {
  const TODAY = '2026-05-06';

  it('beginDe/endDe 가 모두 null 이면 unknown', () => {
    expect(computeStatus(null, null, TODAY)).toBe('unknown');
  });

  it('today < beginDe → upcoming (예정)', () => {
    expect(computeStatus('2026-05-10', '2026-05-15', TODAY)).toBe('upcoming');
  });

  it('beginDe ≤ today ≤ endDe → ongoing (진행중)', () => {
    expect(computeStatus('2026-05-01', '2026-05-10', TODAY)).toBe('ongoing');
    expect(computeStatus('2026-05-06', '2026-05-06', TODAY)).toBe('ongoing'); // 당일 시작/종료
  });

  it('today > endDe → closed (마감)', () => {
    expect(computeStatus('2026-04-01', '2026-04-30', TODAY)).toBe('closed');
  });

  it('endDe 만 있고 today ≤ endDe → ongoing', () => {
    expect(computeStatus(null, '2026-05-15', TODAY)).toBe('ongoing');
  });

  it('beginDe 만 있고 today < beginDe → upcoming', () => {
    expect(computeStatus('2026-05-10', null, TODAY)).toBe('upcoming');
  });

  it('beginDe 만 있고 today ≥ beginDe → ongoing (마감일 미상은 진행중으로 간주)', () => {
    expect(computeStatus('2026-05-01', null, TODAY)).toBe('ongoing');
  });
});

describe('todayInKst', () => {
  it('YYYY-MM-DD 형식 문자열을 반환한다', () => {
    expect(todayInKst()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('UTC 기준 자정 직후도 KST 로 계산하면 같은 날짜', () => {
    // 2026-05-06 00:30 UTC → 2026-05-06 09:30 KST → '2026-05-06'
    const d = new Date('2026-05-06T00:30:00Z');
    expect(todayInKst(d)).toBe('2026-05-06');
  });

  it('UTC 기준 22시는 KST 기준 다음날 07시 → 다음 날짜', () => {
    // 2026-05-06 22:00 UTC → 2026-05-07 07:00 KST → '2026-05-07'
    const d = new Date('2026-05-06T22:00:00Z');
    expect(todayInKst(d)).toBe('2026-05-07');
  });
});
