import { beforeEach, describe, expect, it, vi } from 'vitest';

const { regionFindMany } = vi.hoisted(() => ({ regionFindMany: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { region: { findMany: regionFindMany } },
}));

import { ValidationError } from '../../src/lib/errors.js';
import { listMarketRegionKeys, resolveMarketRegion } from '../../src/services/marketRegionResolver.js';

const mergedRegions = [
  { bjdCode: '12210', city: '전남광주통합특별시', district: '동구', slug: 'dong' },
  { bjdCode: '12240', city: '전남광주통합특별시', district: '서구', slug: 'seo' },
  { bjdCode: '12330', city: '전남광주통합특별시', district: '광산구', slug: 'gwangsan' },
  { bjdCode: '12110', city: '전남광주통합특별시', district: '목포시', slug: 'mokpo' },
  { bjdCode: '12130', city: '전남광주통합특별시', district: '여수시', slug: 'yeosu' },
];
const seoulRegions = [
  { bjdCode: '11680', city: '서울특별시', district: '강남구', slug: 'gangnam' },
  { bjdCode: '11710', city: '서울특별시', district: '송파구', slug: 'songpa' },
];

beforeEach(() => {
  regionFindMany.mockReset();
  regionFindMany.mockImplementation(async ({ where }: { where: { city: { in: string[] } } }) => {
    const cities = where.city.in;
    return [...seoulRegions, ...mergedRegions].filter((r) => cities.includes(r.city));
  });
});

describe('listMarketRegionKeys', () => {
  it('첫 원소는 전국 키다', async () => {
    const keys = await listMarketRegionKeys();
    expect(keys[0]).toEqual({ scope: 'nation', citySlug: '', districtSlug: '', label: '전국' });
  });

  it('시·도 키는 CITY_SLUG_TO_FULL 의 모든 slug 를 포함한다', async () => {
    const keys = await listMarketRegionKeys();
    const citySlugs = keys.filter((k) => k.scope === 'city').map((k) => k.citySlug);
    expect(citySlugs).toEqual(expect.arrayContaining(['seoul', 'gwangju', 'jeonnam']));
  });

  it('gwangju 는 광주 구만, jeonnam 은 광주 구 제외 통합시 행만 districtLimit 에 담는다', async () => {
    const keys = await listMarketRegionKeys();
    const gwangju = keys.find((k) => k.scope === 'city' && k.citySlug === 'gwangju');
    const jeonnam = keys.find((k) => k.scope === 'city' && k.citySlug === 'jeonnam');
    expect(gwangju && 'districtLimit' in gwangju && [...gwangju.districtLimit].sort()).toEqual(['광산구', '동구', '서구'].sort());
    expect(jeonnam && 'districtLimit' in jeonnam && [...jeonnam.districtLimit].sort()).toEqual(['목포시', '여수시'].sort());
  });

  it('모든 district 키가 resolveMarketRegion 과 같은 queryDistrict 로 풀린다', async () => {
    const keys = await listMarketRegionKeys();
    const districts = keys.filter((k) => k.scope === 'district');
    expect(districts.length).toBeGreaterThan(0);
    for (const k of districts) {
      const resolved = await resolveMarketRegion({ city: k.citySlug, district: k.districtSlug });
      expect(resolved.queryDistrict).toBe(k.queryDistrict);
      expect(resolved.queryCity).toBe(k.queryCity);
    }
  });
});

describe('listMarketRegionKeys 중복 slug', () => {
  it('전체명/축약명에 같은 slug 가 있어도 district 키는 한 번만, 첫 행이 이긴다', async () => {
    regionFindMany.mockResolvedValue([
      { bjdCode: '11680', city: '서울특별시', district: '강남구', slug: 'gangnam' },
      { bjdCode: '11680', city: '서울', district: '강남구', slug: 'gangnam' },
      { bjdCode: '11710', city: '서울', district: '송파구', slug: 'songpa' },
    ]);
    const keys = await listMarketRegionKeys();
    const seoul = keys.filter((k) => k.citySlug === 'seoul' && k.scope === 'district');
    expect(seoul.map((k) => k.districtSlug)).toEqual(['gangnam', 'songpa']);
    const tuples = keys.map((k) => `${k.scope}|${k.citySlug}|${k.districtSlug}`);
    expect(new Set(tuples).size).toBe(tuples.length);
  });
});

describe('resolveMarketRegion 오류 경로', () => {
  it('city 없이 district 만 주면 ValidationError', async () => {
    await expect(resolveMarketRegion({ district: 'gangnam' })).rejects.toThrow(ValidationError);
    await expect(resolveMarketRegion({ district: 'gangnam' })).rejects.toThrow('city is required when district is provided');
  });

  it('알 수 없는 city slug 는 ValidationError', async () => {
    await expect(resolveMarketRegion({ city: 'nowhere' })).rejects.toThrow(ValidationError);
    await expect(resolveMarketRegion({ city: 'nowhere' })).rejects.toThrow('unknown city slug');
  });

  it('city 에 속하지 않는 district 는 ValidationError', async () => {
    await expect(resolveMarketRegion({ city: 'seoul', district: 'mokpo' })).rejects.toThrow(ValidationError);
    await expect(resolveMarketRegion({ city: 'seoul', district: 'mokpo' })).rejects.toThrow('district does not belong to city');
  });
});
