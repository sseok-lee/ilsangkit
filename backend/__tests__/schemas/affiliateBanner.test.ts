import { describe, expect, it } from 'vitest';
import {
  affiliateBannerCreateSchema,
  affiliateBannerPatchSchema,
  affiliateBannerQuerySchema,
} from '../../src/schemas/affiliateBanner.js';

const draft = {
  provider: 'coupang',
  name: '생활용품',
  imageSourceType: 'url',
  imageAssetId: null,
  externalImageUrl: 'https://images.example.com/banner.png',
  targetUrl: 'https://example.com/go?a=%2B&a=2+b&z=%2f',
  altText: '생활용품',
};

describe('affiliate banner input', () => {
  it('preserves the exact tracking URL except outside whitespace', () => {
    expect(
      affiliateBannerCreateSchema.parse({
        ...draft,
        targetUrl: ` ${draft.targetUrl} `,
      }).targetUrl,
    ).toBe(draft.targetUrl);
  });

  it('rejects status through the create contract', () => {
    expect(
      affiliateBannerCreateSchema.safeParse({ ...draft, isEnabled: true }).success,
    ).toBe(false);
  });

  it('defaults only create and leaves omitted patch keys absent', () => {
    expect(affiliateBannerCreateSchema.parse(draft).disclosureOverride).toBeNull();
    expect(affiliateBannerPatchSchema.parse({ name: '새 이름' })).toEqual({ name: '새 이름' });
    expect(affiliateBannerPatchSchema.parse({ disclosureOverride: null }))
      .toEqual({ disclosureOverride: null });
    expect(affiliateBannerPatchSchema.safeParse({ disclosureOverride: '  ' }).success).toBe(false);
  });

  it('parses the literal false filter as false', () => {
    expect(affiliateBannerQuerySchema.parse({ isEnabled: 'false' }).isEnabled).toBe(
      false,
    );
  });

  it.each([
    ['target URL at 4,096 characters', { targetUrl: `https://example.com/${'a'.repeat(4076)}` }],
    [
      'external image URL at 4,096 characters',
      { externalImageUrl: `https://images.example.com/${'a'.repeat(4069)}` },
    ],
    ['name at 100 characters', { name: '가'.repeat(100) }],
    ['alt text at 200 characters', { altText: '가'.repeat(200) }],
  ])('accepts %s', (_name, override) => {
    expect(affiliateBannerCreateSchema.safeParse({ ...draft, ...override }).success).toBe(
      true,
    );
  });

  it.each([
    ['target URL over 4,096 characters', { targetUrl: `https://example.com/${'a'.repeat(4077)}` }],
    [
      'external image URL over 4,096 characters',
      { externalImageUrl: `https://images.example.com/${'a'.repeat(4070)}` },
    ],
    ['name over 100 characters', { name: '가'.repeat(101) }],
    ['alt text over 200 characters', { altText: '가'.repeat(201) }],
    ['target URL with userinfo', { targetUrl: 'https://user@example.com/go' }],
    ['target URL with javascript protocol', { targetUrl: 'javascript:alert(1)' }],
    ['target URL with data protocol', { targetUrl: 'data:text/plain,banner' }],
    ['target URL with file protocol', { targetUrl: 'file:///tmp/banner.png' }],
    ['target URL without scheme', { targetUrl: '//example.com/go' }],
    ['target URL with a control character', { targetUrl: 'https://example.com/go\u0007' }],
    ['target URL with a backslash', { targetUrl: 'https://example.com\\go' }],
    ['unknown provider', { provider: 'naver' }],
    [
      'both upload asset and external URL',
      {
        imageSourceType: 'upload',
        imageAssetId: '1afbe8d7-84e9-49a3-bb1d-7f3e088173a8',
        externalImageUrl: 'https://images.example.com/banner.png',
      },
    ],
    [
      'neither upload asset nor external URL',
      {
        imageSourceType: 'upload',
        imageAssetId: null,
        externalImageUrl: null,
      },
    ],
    ['an unknown field', { unknown: 'field' }],
  ])('rejects %s', (_name, override) => {
    expect(affiliateBannerCreateSchema.safeParse({ ...draft, ...override }).success).toBe(
      false,
    );
  });

  it.each([
    ['page 0', { page: '0' }],
    ['limit 101', { limit: '101' }],
    ['unknown query field', { sort: 'createdAt' }],
  ])('rejects %s', (_name, query) => {
    expect(affiliateBannerQuerySchema.safeParse(query).success).toBe(false);
  });

  it('rejects status through the patch contract', () => {
    expect(affiliateBannerPatchSchema.safeParse({ isEnabled: false }).success).toBe(
      false,
    );
  });

  it('rejects an empty patch body', () => {
    expect(affiliateBannerPatchSchema.safeParse({}).success).toBe(false);
  });
});
