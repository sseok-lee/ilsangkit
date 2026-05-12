import { ref, readonly } from 'vue';
import type { Facility, ApiResponse } from '~/types/facility';

interface RegionFacilitiesResponse {
  items: Facility[];
  total: number;
  page: number;
  totalPages: number;
}

export function useRegionFacilities() {
  const facilities = ref<Facility[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const total = ref(0);
  const page = ref(1);
  const totalPages = ref(0);

  function getApiBase(): string {
    try {
      const config = useRuntimeConfig();
      return config.public.apiBase;
    } catch (e) {
      // In test environment, useRuntimeConfig might not be available
      return 'http://localhost:8000';
    }
  }

  // subway는 facility API와 응답 shape가 다르므로 별도 endpoint 호출 후 Facility 형식으로 정규화한다.
  // /api/facilities는 Zod enum에 subway가 없어 422를 반환하므로 분기 필수.
  interface SubwayStationGroup {
    id: string;
    name: string;
    nameSlug: string;
    primaryLine: string;
    lines: string[];
    operator: string | null;
    lat: number;
    lng: number;
    address: string | null;
    roadAddress: string | null;
    city: string | null;
    district: string | null;
  }

  async function fetchSubwayRegion(
    citySlug: string,
    districtName: string,
    currentPage: number,
    pageSize: number,
  ): Promise<RegionFacilitiesResponse | null> {
    const apiBase = getApiBase();
    const response = await $fetch<ApiResponse<{ items: SubwayStationGroup[]; total: number; page: number; limit: number }>>(
      `${apiBase}/api/subway/stations`,
      {
        query: {
          grouped: true,
          page: currentPage,
          limit: pageSize,
          city: citySlug,
          district: districtName,
        },
      },
    );
    if (!response.success || !response.data) return null;
    const totalPagesCalc = Math.max(1, Math.ceil(response.data.total / pageSize));
    return {
      items: response.data.items.map<Facility>((g) => ({
        id: g.nameSlug,
        name: g.name,
        category: 'subway',
        address: g.address,
        roadAddress: g.roadAddress,
        lat: g.lat,
        lng: g.lng,
        city: g.city ?? '',
        district: g.district ?? '',
        extras: {
          primaryLine: g.primaryLine,
          lines: g.lines,
          operator: g.operator,
        },
      })),
      total: response.data.total,
      page: response.data.page,
      totalPages: totalPagesCalc,
    };
  }

  async function fetchFacilities(
    city: string,
    district: string,
    category: string,
    currentPage: number = 1,
    pageSize: number = 20,
    departments?: string[]
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      if (category === 'subway') {
        const normalized = await fetchSubwayRegion(city, district, currentPage, pageSize);
        if (normalized) {
          facilities.value = normalized.items;
          total.value = normalized.total;
          page.value = normalized.page;
          totalPages.value = normalized.totalPages;
        }
        return;
      }

      const apiBase = getApiBase();

      const query: Record<string, unknown> = {
        page: currentPage,
        limit: pageSize,
      };
      if (departments && departments.length > 0) {
        query.departments = departments.join(',');
      }

      const response = await $fetch<ApiResponse<RegionFacilitiesResponse>>(
        `${apiBase}/api/facilities/region/${city}/${district}/${category}`,
        { query },
      );

      if (response.success && response.data) {
        facilities.value = response.data.items;
        total.value = response.data.total;
        page.value = response.data.page;
        totalPages.value = response.data.totalPages;
      }
    } catch (err) {
      console.error('Failed to fetch region facilities:', err);
      error.value = '시설 정보를 불러오는 중 오류가 발생했습니다.';
      facilities.value = [];
      total.value = 0;
      totalPages.value = 0;
    } finally {
      loading.value = false;
    }
  }

  async function fetchAllFacilities(
    city: string,
    district: string,
    currentPage: number = 1,
    pageSize: number = 20
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const apiBase = getApiBase();

      const response = await $fetch<ApiResponse<RegionFacilitiesResponse>>(
        `${apiBase}/api/facilities/region/${city}/${district}`,
        {
          query: {
            page: currentPage,
            limit: pageSize,
          },
        }
      );

      if (response.success && response.data) {
        facilities.value = response.data.items;
        total.value = response.data.total;
        page.value = response.data.page;
        totalPages.value = response.data.totalPages;
      }
    } catch (err) {
      console.error('Failed to fetch all region facilities:', err);
      error.value = '시설 정보를 불러오는 중 오류가 발생했습니다.';
      facilities.value = [];
      total.value = 0;
      totalPages.value = 0;
    } finally {
      loading.value = false;
    }
  }

  return {
    facilities: readonly(facilities),
    loading: readonly(loading),
    error: readonly(error),
    total: readonly(total),
    page: readonly(page),
    totalPages: readonly(totalPages),
    fetchFacilities,
    fetchAllFacilities,
  };
}
