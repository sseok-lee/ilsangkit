import { describe, it, expect } from 'vitest';
import { buildRealEstateUrlsV2, buildFacilityUrls } from '../../src/services/indexNowService.js';

describe('buildRealEstateUrlsV2 — new URL format (US-008)', () => {
  it('builds absolute URLs in /real-estate/{type}/{city}/{dist}/{bldg} form', () => {
    const urls = buildRealEstateUrlsV2([
      {
        realEstateType: 'apt-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '래미안강남',
      },
    ]);
    expect(urls).toEqual([
      `https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('래미안강남')}`,
    ]);
  });

  it('filters jibun patterns even in new format', () => {
    const urls = buildRealEstateUrlsV2([
      {
        realEstateType: 'villa-sale',
        city: '서울특별시',
        district: '관악구',
        buildingName: '(535-3)',
      },
      {
        realEstateType: 'villa-sale',
        city: '서울특별시',
        district: '관악구',
        buildingName: 'ABC빌라',
      },
    ]);
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain('/real-estate/villa-sale/seoul/gwanak/');
  });

  it('never emits bjdCode= query in new URLs', () => {
    const urls = buildRealEstateUrlsV2([
      {
        realEstateType: 'apt-rent',
        city: '서울',
        district: '강남구',
        buildingName: '래미안강남',
      },
    ]);
    for (const url of urls) {
      expect(url).not.toContain('bjdCode=');
    }
  });

  it('applies NFC normalization before encoding', () => {
    const urls = buildRealEstateUrlsV2([
      {
        realEstateType: 'apt-sale',
        city: '서울',
        district: '강남구',
        buildingName: '래미안'.normalize('NFD'),
      },
    ]);
    expect(urls[0]).toContain(encodeURIComponent('래미안'.normalize('NFC')));
  });
});

describe('buildFacilityUrls', () => {
  it('builds /category/id style URLs', () => {
    expect(buildFacilityUrls('toilet', ['abc', 'def'])).toEqual([
      'https://ilsangkit.co.kr/toilet/abc',
      'https://ilsangkit.co.kr/toilet/def',
    ]);
  });
});
