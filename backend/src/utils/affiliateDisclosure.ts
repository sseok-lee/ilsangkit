import type { ResolvedAffiliateDisclosure } from '../types/affiliateDisclosure.js';

export function normalizeAffiliateDisclosureText(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim();
}

export function resolveAffiliateDisclosure(
  override: string | null,
  providerDefault: string | null,
): ResolvedAffiliateDisclosure {
  if (override !== null) {
    return { disclosureText: override, disclosureSource: 'banner' };
  }

  if (providerDefault !== null) {
    return { disclosureText: providerDefault, disclosureSource: 'provider' };
  }

  return { disclosureText: null, disclosureSource: 'missing' };
}
