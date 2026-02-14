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

  async function fetchFacilities(
    city: string,
    district: string,
    category: string,
    currentPage: number = 1,
    pageSize: number = 20
  ): Promise<void> {
    loading.value = true;
    error.value = null;

    try {
      const apiBase = getApiBase();

      const response = await $fetch<ApiResponse<RegionFacilitiesResponse>>(
        `${apiBase}/api/facilities/region/${city}/${district}/${category}`,
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
