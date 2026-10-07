import { describe, expect, it } from 'vitest';
import {
  normalizeAffiliateDisclosureText,
  resolveAffiliateDisclosure,
} from '../../src/utils/affiliateDisclosure.js';

describe('affiliate disclosure contract', () => {
  it('normalizes CRLF and CR line endings to LF and trims outside whitespace', () => {
    expect(normalizeAffiliateDisclosureText('  A\r\nB\rC  ')).toBe('A\nB\nC');
  });

  it.each([
    ['개별', '기본', '개별', 'banner'],
    ['개별', null, '개별', 'banner'],
    [null, '기본', '기본', 'provider'],
    [null, null, null, 'missing'],
  ] as const)('resolves %s / %s', (override, defaults, text, source) => {
    expect(resolveAffiliateDisclosure(override, defaults)).toEqual({
      disclosureText: text,
      disclosureSource: source,
    });
  });
});
