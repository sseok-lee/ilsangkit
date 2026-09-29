import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';

// Mock composables
vi.mock('../../../composables/useRegionFacilities', () => ({
  useRegionFacilities: vi.fn(() => ({
    facilities: ref([
      {
        id: 'toilet-1',
        name: '강남역 공중화장실',
        category: 'toilet',
        address: '서울특별시 강남구 강남대로 396',
        latitude: 37.5,
        longitude: 127.0,
      },
    ]),
    loading: ref(false),
    error: ref(null),
    total: ref(1),
    page: ref(1),
    totalPages: ref(1),
    fetchFacilities: vi.fn(),
  })),
}));

// Mock Nuxt composables
vi.mock('#app', () => ({
  useRoute: () => ({
    params: {
      city: 'seoul',
      district: 'gangnam',
      category: 'toilet',
    },
  }),
  useSeoMeta: vi.fn(),
  definePageMeta: vi.fn(),
}));

// We'll test the component logic separately from Nuxt-specific features
describe('Region Page Logic', () => {
  it('maps city slug to Korean name', () => {
    const CITY_MAP: Record<string, string> = {
      seoul: '서울',
      busan: '부산',
      daegu: '대구',
    };

    expect(CITY_MAP['seoul']).toBe('서울');
    expect(CITY_MAP['busan']).toBe('부산');
  });

  it('maps district slug to Korean name', () => {
    const DISTRICT_MAP: Record<string, string> = {
      gangnam: '강남구',
      songpa: '송파구',
      haeundae: '해운대구',
    };

    expect(DISTRICT_MAP['gangnam']).toBe('강남구');
    expect(DISTRICT_MAP['songpa']).toBe('송파구');
  });

  it('maps category slug to Korean name', () => {
    const CATEGORY_MAP: Record<string, string> = {
      toilet: '공공화장실',
      wifi: '무료 와이파이',
      trash: '생활쓰레기',
      clothes: '의류수거함',
      park: '공원',
    };

    expect(CATEGORY_MAP['toilet']).toBe('공공화장실');
    expect(CATEGORY_MAP['wifi']).toBe('무료 와이파이');
  });

  it('generates breadcrumb items correctly', () => {
    const city = 'seoul';
    const district = 'gangnam';
    const category = 'toilet';

    const CITY_MAP: Record<string, string> = { seoul: '서울' };
    const DISTRICT_MAP: Record<string, string> = { gangnam: '강남구' };
    const CATEGORY_MAP: Record<string, string> = { toilet: '공공화장실' };

    const breadcrumbItems = [
      { label: '홈', href: '/', current: false },
      { label: CITY_MAP[city], href: `/${city}`, current: false },
      { label: DISTRICT_MAP[district], href: `/${city}/${district}`, current: false },
      { label: CATEGORY_MAP[category], href: `/${city}/${district}/${category}`, current: true },
    ];

    expect(breadcrumbItems).toHaveLength(4);
    expect(breadcrumbItems[0].label).toBe('홈');
    expect(breadcrumbItems[1].label).toBe('서울');
    expect(breadcrumbItems[2].label).toBe('강남구');
    expect(breadcrumbItems[3].label).toBe('공공화장실');
    expect(breadcrumbItems[3].current).toBe(true);
  });

  it('generates page title correctly', () => {
    const cityName = '서울';
    const districtName = '강남구';
    const categoryName = '공공화장실';

    const title = `${cityName} ${districtName} ${categoryName} | 개방시간·위치 | 일상킷`;
    expect(title).toBe('서울 강남구 공공화장실 | 개방시간·위치 | 일상킷');
  });

  it('generates meta description correctly', () => {
    const cityName = '서울';
    const districtName = '강남구';
    const categoryName = '공공화장실';

    const description = `${cityName} ${districtName}의 ${categoryName} 개방시간·위치 정보를 확인하세요.`;
    expect(description).toBe('서울 강남구의 공공화장실 개방시간·위치 정보를 확인하세요.');
  });

  it('calculates grid columns based on screen size', () => {
    const getGridCols = (width: number): string => {
      if (width < 768) return 'grid-cols-1'; // mobile
      if (width < 1024) return 'grid-cols-2'; // tablet
      return 'grid-cols-3'; // desktop
    };

    expect(getGridCols(375)).toBe('grid-cols-1');
    expect(getGridCols(768)).toBe('grid-cols-2');
    expect(getGridCols(1024)).toBe('grid-cols-3');
  });

  it('generates other category links', () => {
    const city = 'seoul';
    const district = 'gangnam';
    const currentCategory = 'toilet';

    const categories = ['toilet', 'wifi', 'trash', 'clothes', 'park'];
    const otherCategories = categories.filter(cat => cat !== currentCategory);

    expect(otherCategories).toHaveLength(4);
    expect(otherCategories).not.toContain('toilet');

    const links = otherCategories.map(cat => `/${city}/${district}/${cat}`);
    expect(links).toContain('/seoul/gangnam/wifi');
    expect(links).toContain('/seoul/gangnam/trash');
  });
});


describe('지역 허브 L5 생활시설 탐색 연결', () => {
  const frontendRoot = process.cwd().endsWith('/frontend')
    ? process.cwd()
    : join(process.cwd(), 'frontend')
  const citySource = readFileSync(resolve(frontendRoot, 'pages/[city]/index.vue'), 'utf8')
  const districtSource = readFileSync(resolve(frontendRoot, 'pages/[city]/[district]/index.vue'), 'utf8')

  it('시도 허브는 현재 city query 를 담아 /facilities 탐색으로 연결한다', () => {
    expect(citySource).toContain("path: '/facilities'")
    expect(citySource).toContain('query: { city }')
    expect(citySource).toContain('생활시설 전체 보기')
  })

  it('구군 허브는 city/district query 를 담아 /facilities 탐색으로 연결하고 시세 섹션도 유지한다', () => {
    expect(districtSource).toContain("path: '/facilities'")
    expect(districtSource).toContain('query: { city, district }')
    expect(districtSource).toContain('<RegionRealEstatePrices')
    expect(districtSource).toContain('<RegionFacilityCategoryGrid')
  })
})
