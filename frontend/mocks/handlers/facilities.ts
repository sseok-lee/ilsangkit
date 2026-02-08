// @TASK T0.5.3 - MSW 핸들러 정의
// @SPEC docs/planning/02-trd.md#계약-정의

import { http, HttpResponse } from 'msw';
import { mockCategories, mockFacilities, mockRegions, mockFacilityDetails } from '../data/facilities';

const API_BASE = process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000';

export const facilityHandlers = [
  // 헬스체크
  http.get(`${API_BASE}/api/health`, () => {
    return HttpResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 12345,
    });
  }),

  // 카테고리 목록
  http.get(`${API_BASE}/api/meta/categories`, () => {
    return HttpResponse.json({
      success: true,
      data: mockCategories.filter(c => c.isActive),
    });
  }),

  // 지역 목록
  http.get(`${API_BASE}/api/meta/regions`, () => {
    return HttpResponse.json({
      success: true,
      data: mockRegions,
    });
  }),

  // 카테고리별 시설 개수 통계
  http.get(`${API_BASE}/api/meta/stats`, () => {
    const toiletCount = mockFacilities.filter(f => f.category === 'toilet').length;
    const wifiCount = mockFacilities.filter(f => f.category === 'wifi').length;
    const clothesCount = mockFacilities.filter(f => f.category === 'clothes').length;
    const kioskCount = mockFacilities.filter(f => f.category === 'kiosk').length;
    const trashCount = mockFacilities.filter(f => f.category === 'trash').length;

    return HttpResponse.json({
      success: true,
      data: {
        toilet: toiletCount,
        wifi: wifiCount,
        clothes: clothesCount,
        kiosk: kioskCount,
        trash: trashCount,
        total: toiletCount + wifiCount + clothesCount + kioskCount + trashCount,
      },
    });
  }),

  // 시설 검색
  http.post(`${API_BASE}/api/facilities/search`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const { category, lat, lng, radius, page = 1, limit = 20 } = body;

    let filtered = [...mockFacilities];

    // 카테고리 필터
    if (category) {
      filtered = filtered.filter(f => f.category === category);
    }

    // 위치 기반 필터 (간단한 시뮬레이션)
    if (lat && lng) {
      // 실제로는 거리 계산이 필요하지만, mock에서는 distance 필드 사용
      if (radius) {
        filtered = filtered.filter(f => f.distance <= Number(radius));
      }
      // 거리순 정렬
      filtered.sort((a, b) => a.distance - b.distance);
    }

    const total = filtered.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const items = filtered.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    return HttpResponse.json({
      success: true,
      data: {
        items,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }),

  // 시설 상세
  http.get(`${API_BASE}/api/facilities/:category/:id`, ({ params }) => {
    const { category, id } = params;
    const facility = mockFacilities.find(f => f.id === id && f.category === category);

    if (!facility) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: '시설을 찾을 수 없습니다',
          },
        },
        { status: 404 }
      );
    }

    const details = mockFacilityDetails[id as keyof typeof mockFacilityDetails] || {};

    return HttpResponse.json({
      success: true,
      data: {
        ...facility,
        details,
        viewCount: Math.floor(Math.random() * 1000) + 50,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-15T00:00:00Z',
      },
    });
  }),

  // 지역별 시설 조회
  http.get(`${API_BASE}/api/facilities/region/:city/:district/:category`, ({ params }) => {
    const { city, district, category } = params;

    const filtered = mockFacilities.filter(
      f => f.city === city && f.district === district && f.category === category
    );

    return HttpResponse.json({
      success: true,
      data: {
        region: { city, district },
        category,
        items: filtered,
        total: filtered.length,
      },
    });
  }),

  // 인기 시설 목록 (예시)
  http.get(`${API_BASE}/api/facilities/popular`, ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const limit = Number(url.searchParams.get('limit')) || 10;

    let filtered = [...mockFacilities];
    if (category) {
      filtered = filtered.filter(f => f.category === category);
    }

    // 거리순으로 정렬하여 인기 시설 시뮬레이션
    const items = filtered.sort((a, b) => a.distance - b.distance).slice(0, limit);

    return HttpResponse.json({
      success: true,
      data: items,
    });
  }),

  // 시설 통계 (예시)
  http.get(`${API_BASE}/api/facilities/stats`, () => {
    const stats = mockCategories.map(category => ({
      category: category.id,
      count: mockFacilities.filter(f => f.category === category.id).length,
    }));

    return HttpResponse.json({
      success: true,
      data: {
        total: mockFacilities.length,
        byCategory: stats,
        lastUpdated: '2024-01-15T00:00:00Z',
      },
    });
  }),
];
