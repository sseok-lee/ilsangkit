import { describe, expect, it } from 'vitest';
import {
  endDateToExpiresAt,
  expiresAtToEndDate,
  isAffiliateBannerExpired,
  isValidAffiliateEndDate,
} from '../../src/utils/affiliateBannerExpiration.js';

describe('affiliate expiration', () => {
  it.each(['1000-01-01', '2026-10-15', '2026-12-31', '2028-02-29', '9999-12-31'])(
    'round trips %s through the fixed KST boundary',
    (endDate) => {
      const expiry = endDateToExpiresAt(endDate)!;
      expect(expiry.toISOString()).toBe(`${endDate}T15:00:00.000Z`);
      expect(expiresAtToEndDate(expiry)).toBe(endDate);
      expect(isAffiliateBannerExpired(expiry, new Date(expiry.getTime() - 1))).toBe(false);
      expect(isAffiliateBannerExpired(expiry, expiry)).toBe(true);
      expect(isAffiliateBannerExpired(expiry, new Date(expiry.getTime() + 1))).toBe(true);
    }
  );

  it.each([
    '2026-02-30',
    '2026-02-29',
    '2026-2-3',
    '2026-10-15T00:00:00Z',
    ' 2026-10-15',
    '',
    '0999-12-31',
    '10000-01-01',
  ])('rejects %s', (value) => {
    expect(isValidAffiliateEndDate(value)).toBe(false);
    expect(() => endDateToExpiresAt(value)).toThrow(RangeError);
  });

  it('keeps null unlimited and invalid dates out', () => {
    expect(endDateToExpiresAt(null)).toBeNull();
    expect(expiresAtToEndDate(null)).toBeNull();
    expect(isAffiliateBannerExpired(null, new Date())).toBe(false);
    expect(isAffiliateBannerExpired(new Date(NaN), new Date())).toBe(true);
  });
});
