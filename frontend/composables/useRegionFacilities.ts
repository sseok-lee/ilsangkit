import { ref, readonly } from 'vue';
import type { Facility } from '~/types/facility';

interface RegionFacilitiesResponse {
  items: Facility[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export function useRegionFacilities() {
  const facilities = ref<Facility[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const total = ref(0);
  const page = ref(1);
  const totalPages = ref(0);

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
      const response = await $fetch<RegionFacilitiesResponse>(
        `/api/facilities/region/${city}/${district}/${category}`,
        {
          query: {
            page: currentPage,
            pageSize,
          },
        }
      );

      facilities.value = response.items;
      total.value = response.total;
      page.value = response.page;
      totalPages.value = response.totalPages;
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

  return {
    facilities: readonly(facilities),
    loading: readonly(loading),
    error: readonly(error),
    total: readonly(total),
    page: readonly(page),
    totalPages: readonly(totalPages),
    fetchFacilities,
  };
}
