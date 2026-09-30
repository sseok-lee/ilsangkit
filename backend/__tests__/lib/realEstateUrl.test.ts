import { describe, it, expect } from 'vitest';
import {
  REAL_ESTATE_URL_TYPES,
  isRealEstateUrlType,
  toRealEstateUrl,
  toRealEstateListUrl,
  toAbsoluteRealEstateUrl,
  toCitySlugByDistrict,
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

describe('전남광주통합특별시 flat jeonnamgwangju (backend, 사이트맵/IndexNow)', () => {
  it('광주 자치구도 jeonnamgwangju flat으로', () => {
    expect(toRealEstateUrl({ type: 'apt-sale', city: '전남광주통합특별시', district: '광산구', buildingName: 'X' }))
      .toBe(`/real-estate/apt-sale/jeonnamgwangju/gwangsan/${encodeURIComponent('X')}`);
    expect(toCitySlugByDistrict('전남광주통합특별시', '북구')).toBe('jeonnamgwangju');
  });

  it('(구)전남 시·군도 동일 jeonnamgwangju flat으로', () => {
    expect(toRealEstateUrl({ type: 'apt-sale', city: '전남광주통합특별시', district: '나주시', buildingName: '빛가람코오롱하늘채' }))
      .toBe(`/real-estate/apt-sale/jeonnamgwangju/naju/${encodeURIComponent('빛가람코오롱하늘채')}`);
    expect(toRealEstateListUrl({ type: 'apt-rent', city: '전남광주통합특별시', district: '여수시' }))
      .toBe('/real-estate/apt-rent/jeonnamgwangju/yeosu');
  });

  it('절대 URL(사이트맵)에도 한글 slug를 남기지 않는다', () => {
    const url = toAbsoluteRealEstateUrl('https://ilsangkit.co.kr', {
      type: 'apt-sale', city: '전남광주통합특별시', district: '서구', buildingName: 'X',
    });
    expect(url).not.toContain('전남광주통합특별시');
    expect(url).toContain('/jeonnamgwangju/seo/');
  });
});

it('ignores parcel keys unless a registry canonical path is provided', () => {
  const parts = { type: 'villa-sale' as const, city: '서울특별시', district: '강남구', buildingName: '스톤빌리지' };
  const a = toRealEstateUrl({ ...parts, buildingKey: 'a'.repeat(64) });
  const b = toRealEstateUrl({ ...parts, buildingKey: 'b'.repeat(64) });
  expect(a).toBe(`/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('스톤빌리지')}`);
  expect(b).toBe(a);
});

it('prefers registry canonicalPath over keyed fallback when provided', () => {
  expect(toRealEstateUrl({
    type: 'villa-sale',
    city: '서울특별시',
    district: '강남구',
    buildingName: '스톤빌리지',
    buildingKey: 'a'.repeat(64),
    canonicalPath: '/real-estate/villa-sale/seoul/gangnam/%EC%8A%A4%ED%86%A4%EB%B9%8C%EB%A6%AC%EC%A7%80/%EB%8C%80%EC%B9%98%EB%8F%99-934-2',
  })).toBe('/real-estate/villa-sale/seoul/gangnam/%EC%8A%A4%ED%86%A4%EB%B9%8C%EB%A6%AC%EC%A7%80/%EB%8C%80%EC%B9%98%EB%8F%99-934-2');
});

it('ignores a stale hash canonicalPath and falls back to the original public URL', () => {
  const buildingKey = 'A'.repeat(64);
  expect(toRealEstateUrl({
    type: 'villa-sale',
    city: '서울특별시',
    district: '강남구',
    buildingName: '스톤빌리지',
    buildingKey,
    canonicalPath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('스톤빌리지')}/${buildingKey}`,
  })).toBe(`/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('스톤빌리지')}`);
});

it('does not reject a base URL whose building name happens to be 64 hex characters', () => {
  const hexName = 'a'.repeat(64);
  const canonicalPath = `/real-estate/apt-sale/seoul/gangnam/${hexName}`;
  expect(toRealEstateUrl({
    type: 'apt-sale',
    city: '서울특별시',
    district: '강남구',
    buildingName: hexName,
    canonicalPath,
  })).toBe(canonicalPath);
});
