import { describe, it, expect } from 'vitest';
import {
  isAllowedLink,
  allowedLinksFor,
} from '../../../src/guideGen/shared/internalLinks.js';

describe('allowedLinksFor', () => {
  it('returns ev-charger paths for ev-charger category', () => {
    const allowed = allowedLinksFor('ev-charger');
    expect(allowed).toContain('/ev-charger');
  });

  it('returns subscription paths for subscription category', () => {
    expect(allowedLinksFor('subscription')).toContain('/subscription');
  });

  it('returns empty for unknown category', () => {
    expect(allowedLinksFor('unknown-cat')).toEqual([]);
  });
});

describe('isAllowedLink', () => {
  it('accepts whitelisted path for category', () => {
    expect(isAllowedLink('/ev-charger', 'ev-charger')).toBe(true);
  });

  it('rejects path not in category whitelist', () => {
    expect(isAllowedLink('/hospital', 'ev-charger')).toBe(false);
  });

  it('rejects external URLs', () => {
    expect(isAllowedLink('https://example.com', 'ev-charger')).toBe(false);
  });
});
