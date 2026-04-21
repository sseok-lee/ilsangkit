import { describe, it, expect } from 'vitest';
import { buildRealEstateUrls, buildRealEstateUrlsV2, buildFacilityUrls } from '../../src/services/indexNowService.js';

describe('buildRealEstateUrls — legacy propertyType signature', () => {
  it('drops jibun-style buildingNames before producing URLs', () => {
    const urls = buildRealEstateUrls('villa', [
      { buildingName: '(535-3)', bjdCode: '11740' },
      { buildingName: '래미안강남', bjdCode: '11680' },
      { buildingName: '123-456', bjdCode: '11680' },
      { buildingName: '(3-1)아파트', bjdCode: '11200' },
    ]);
    expect(urls.length).toBe(1);
    expect(urls[0]).toContain(encodeURIComponent('래미안강남'));
    expect(urls[0]).toContain('bjdCode=11680');
  });

  it('preserves company-prefix names like (주)래미안타워', () => {
    const urls = buildRealEstateUrls('apt', [
      { buildingName: '(주)래미안타워', bjdCode: '11680' },
      { buildingName: '(사)OO아파트', bjdCode: '11680' },
    ]);
    expect(urls.length).toBe(2);
  });

  it('NFC-normalizes Korean buildingNames before encoding', () => {
    const nfd = '래미안'.normalize('NFD'); // 조합형
    const urls = buildRealEstateUrls('apt', [
      { buildingName: nfd, bjdCode: '11680' },
    ]);
    expect(urls.length).toBe(1);
    const expected = encodeURIComponent('래미안'.normalize('NFC'));
    expect(urls[0]).toContain(expected);
    // 조합형 그대로 인코딩되지 않았는지 확인
    expect(urls[0]).not.toContain(encodeURIComponent(nfd));
  });

  it('returns empty array when nothing is valid', () => {
    const urls = buildRealEstateUrls('villa', [
      { buildingName: '(1)', bjdCode: '11740' },
      { buildingName: '', bjdCode: '11740' },
    ]);
    expect(urls).toEqual([]);
  });

  it('uses correct url shape for legacy propertyType signature', () => {
    const [url] = buildRealEstateUrls('apt', [
      { buildingName: '래미안강남', bjdCode: '11680' },
    ]);
    expect(url).toBe(
      `https://ilsangkit.co.kr/real-estate/apt/${encodeURIComponent('래미안강남')}?bjdCode=11680`,
    );
  });
});

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
