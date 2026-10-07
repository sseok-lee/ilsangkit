import { describe, expect, it } from 'vitest'
import {
  normalizeAffiliateDisclosureText,
  resolveAffiliateDisclosure,
} from '~/utils/affiliateDisclosure'

describe('affiliate disclosure utilities', () => {
  it('normalizes CRLF and CR line breaks while trimming only outer whitespace', () => {
    expect(normalizeAffiliateDisclosureText('  첫 줄\r\n둘째 줄\r셋째 줄  ')).toBe('첫 줄\n둘째 줄\n셋째 줄')
  })

  it('keeps emoji as UTF-16 text so the 1,000 code-unit boundary is visible to callers', () => {
    const normalized = normalizeAffiliateDisclosureText(` ${'😀'.repeat(500)} `)

    expect(normalized.length).toBe(1000)
    expect(normalized).toBe('😀'.repeat(500))
  })

  it('prefers a banner override over a provider default', () => {
    expect(resolveAffiliateDisclosure('배너 문구', '업체 문구')).toEqual({
      disclosureText: '배너 문구',
      disclosureSource: 'banner',
    })
  })

  it('uses a banner override even when the provider has no default', () => {
    expect(resolveAffiliateDisclosure('배너 문구', null)).toEqual({
      disclosureText: '배너 문구',
      disclosureSource: 'banner',
    })
  })

  it('falls back to the provider default when the banner override is null', () => {
    expect(resolveAffiliateDisclosure(null, '업체 문구')).toEqual({
      disclosureText: '업체 문구',
      disclosureSource: 'provider',
    })
  })

  it('reports missing text when neither banner nor provider text exists', () => {
    expect(resolveAffiliateDisclosure(null, null)).toEqual({
      disclosureText: null,
      disclosureSource: 'missing',
    })
  })
})
