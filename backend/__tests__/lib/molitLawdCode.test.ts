import { describe, it, expect } from 'vitest';
import { toMolitLawdCode } from '../../src/lib/molitLawdCode';

describe('toMolitLawdCode', () => {
  it('세종 36111 → 36110, 나머지는 그대로', () => {
    expect(toMolitLawdCode('36111')).toBe('36110');
    expect(toMolitLawdCode('11680')).toBe('11680');
  });
});
