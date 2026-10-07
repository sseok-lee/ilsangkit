import { describe, expect, it } from 'vitest';
import {
  affiliateDisclosureProviderParamsSchema,
  affiliateDisclosureSaveSchema,
  affiliateDisclosureTextSchema,
} from '../../src/schemas/affiliateDisclosure.js';

describe('affiliate disclosure schema', () => {
  it('normalizes line endings before measuring length', () => {
    expect(affiliateDisclosureTextSchema.parse('  A\r\nB\rC  ')).toBe('A\nB\nC');
    expect(affiliateDisclosureTextSchema.safeParse('😀'.repeat(500)).success).toBe(true);
    expect(affiliateDisclosureTextSchema.safeParse('😀'.repeat(501)).success).toBe(false);
    expect(affiliateDisclosureTextSchema.safeParse(' \r\n ').success).toBe(false);
    expect(affiliateDisclosureTextSchema.parse('<b>고지</b>')).toBe('<b>고지</b>');
  });

  it('accepts a normalized default disclosure text for saving', () => {
    expect(
      affiliateDisclosureSaveSchema.parse({
        defaultDisclosureText: '  쿠팡 파트너스 활동으로 수수료를 받을 수 있습니다.\r\n감사합니다.  ',
      }),
    ).toEqual({
      defaultDisclosureText: '쿠팡 파트너스 활동으로 수수료를 받을 수 있습니다.\n감사합니다.',
    });
  });

  it.each([
    ['null default disclosure text', { defaultDisclosureText: null }],
    ['empty default disclosure text', { defaultDisclosureText: ' \r\n ' }],
    ['numeric default disclosure text', { defaultDisclosureText: 123 }],
    ['default disclosure text over 1,000 code units', { defaultDisclosureText: 'a'.repeat(1001) }],
    [
      'an unknown save field',
      { defaultDisclosureText: '고지 문구', extra: 'field' },
    ],
  ])('rejects %s', (_name, payload) => {
    expect(affiliateDisclosureSaveSchema.safeParse(payload).success).toBe(false);
  });

  it.each(['coupang', 'ali', 'toss'])('accepts provider %s', (provider) => {
    expect(affiliateDisclosureProviderParamsSchema.safeParse({ provider }).success).toBe(true);
  });

  it.each([
    ['unsupported provider', { provider: 'naver' }],
    ['unknown params field', { provider: 'coupang', extra: 'field' }],
  ])('rejects %s', (_name, params) => {
    expect(affiliateDisclosureProviderParamsSchema.safeParse(params).success).toBe(false);
  });
});
