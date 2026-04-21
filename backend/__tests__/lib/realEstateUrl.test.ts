import { describe, it, expect } from 'vitest';
import {
  REAL_ESTATE_URL_TYPES,
  isRealEstateUrlType,
  toRealEstateUrl,
  toRealEstateListUrl,
  toAbsoluteRealEstateUrl,
} from '../../src/lib/realEstateUrl.js';

describe('isRealEstateUrlType', () => {
  it('accepts all 6 canonical types', () => {
    for (const t of REAL_ESTATE_URL_TYPES) {
      expect(isRealEstateUrlType(t)).toBe(true);
    }
  });

  it('rejects unknown types', () => {
    expect(isRealEstateUrlType('apt')).toBe(false);
    expect(isRealEstateUrlType('apt-trade')).toBe(false);
    expect(isRealEstateUrlType('store-sale')).toBe(false);
    expect(isRealEstateUrlType('')).toBe(false);
  });
});

describe('toRealEstateUrl', () => {
  it('builds canonical path for Gangnam apt-sale', () => {
    expect(
      toRealEstateUrl({
        type: 'apt-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '래미안강남',
      }),
    ).toBe(
      `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('래미안강남')}`,
    );
  });

  it('accepts short city names (서울) in addition to full (서울특별시)', () => {
    expect(
      toRealEstateUrl({
        type: 'villa-rent',
        city: '서울',
        district: '강남구',
        buildingName: 'ABC빌라',
      }),
    ).toBe(
      `/real-estate/villa-rent/seoul/gangnam/${encodeURIComponent('ABC빌라')}`,
    );
  });

  it('handles 세종특별자치시 with sejong/sejong redundant hierarchy (G3 decision)', () => {
    expect(
      toRealEstateUrl({
        type: 'apt-sale',
        city: '세종특별자치시',
        district: '세종시',
        buildingName: '세종첫마을',
      }),
    ).toBe(`/real-estate/apt-sale/sejong/sejong/${encodeURIComponent('세종첫마을')}`);
  });

  it('handles compound district slugs (수원시 장안구 → suwon-jangan)', () => {
    expect(
      toRealEstateUrl({
        type: 'apt-sale',
        city: '경기도',
        district: '수원시 장안구',
        buildingName: '광교자이',
      }),
    ).toBe(
      `/real-estate/apt-sale/gyeonggi/suwon-jangan/${encodeURIComponent('광교자이')}`,
    );
  });

  it('NFC-normalizes NFD buildingNames', () => {
    const nfd = '래미안'.normalize('NFD');
    const url = toRealEstateUrl({
      type: 'apt-sale',
      city: '서울',
      district: '강남구',
      buildingName: nfd,
    });
    expect(url).toContain(encodeURIComponent('래미안'.normalize('NFC')));
    expect(url).not.toContain(encodeURIComponent(nfd));
  });

  it('falls back to lowercase slug when city/district are unknown', () => {
    const url = toRealEstateUrl({
      type: 'apt-sale',
      city: 'Unknown',
      district: 'Nowhere',
      buildingName: 'X',
    });
    expect(url).toBe(`/real-estate/apt-sale/unknown/nowhere/${encodeURIComponent('X')}`);
  });

  it('encodes special chars safely (spaces, slashes)', () => {
    const url = toRealEstateUrl({
      type: 'apt-sale',
      city: '서울',
      district: '강남구',
      buildingName: 'A/B 타워',
    });
    expect(url).toContain(encodeURIComponent('A/B 타워'.normalize('NFC')));
  });

  it('all 6 types produce matching prefixes', () => {
    for (const t of REAL_ESTATE_URL_TYPES) {
      const url = toRealEstateUrl({
        type: t,
        city: '서울',
        district: '강남구',
        buildingName: 'X',
      });
      expect(url.startsWith(`/real-estate/${t}/`)).toBe(true);
    }
  });
});

describe('toRealEstateListUrl', () => {
  it('produces hub URL without buildingName', () => {
    expect(
      toRealEstateListUrl({ type: 'apt-rent', city: '서울특별시', district: '송파구' }),
    ).toBe('/real-estate/apt-rent/seoul/songpa');
  });
});

describe('toAbsoluteRealEstateUrl', () => {
  it('prefixes origin for IndexNow/sitemap usage', () => {
    const url = toAbsoluteRealEstateUrl('https://ilsangkit.co.kr', {
      type: 'apt-sale',
      city: '서울특별시',
      district: '강남구',
      buildingName: '래미안강남',
    });
    expect(url).toBe(
      `https://ilsangkit.co.kr/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('래미안강남')}`,
    );
  });
});
