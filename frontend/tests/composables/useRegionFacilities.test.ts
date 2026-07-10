import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRegionFacilities } from '../../composables/useRegionFacilities';

// Mock $fetch
const mockFetch = vi.fn();
vi.stubGlobal('$fetch', mockFetch);

describe('useRegionFacilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default state', () => {
    const { facilities, loading, error, total, page, totalPages } = useRegionFacilities();

    expect(facilities.value).toEqual([]);
    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
    expect(total.value).toBe(0);
    expect(page.value).toBe(1);
    expect(totalPages.value).toBe(0);
  });

  it('fetches region facilities successfully', async () => {
    const mockItems = [
      {
        id: 'toilet-1',
        name: '강남역 공중화장실',
        category: 'toilet',
        address: '서울특별시 강남구',
        latitude: 37.5,
        longitude: 127.0,
      },
    ];

    mockFetch.mockResolvedValueOnce({
      success: true,
      data: {
        items: mockItems,
        total: 1,
        page: 1,
        totalPages: 1,
      },
    });

    const { facilities, loading, error, fetchFacilities, total, totalPages } = useRegionFacilities();

    await fetchFacilities('seoul', 'gangnam', 'toilet', 1);

    expect(loading.value).toBe(false);
    expect(error.value).toBeNull();
    expect(facilities.value).toEqual(mockItems);
    expect(total.value).toBe(1);
    expect(totalPages.value).toBe(1);
  });

  it('handles fetch errors', async () => {
    const mockError = new Error('Network error');
    mockFetch.mockRejectedValueOnce(mockError);

    const { facilities, loading, error, fetchFacilities } = useRegionFacilities();

    await fetchFacilities('seoul', 'gangnam', 'toilet', 1);

    expect(loading.value).toBe(false);
    expect(error.value).toBe('시설 정보를 불러오는 중 오류가 발생했습니다.');
    expect(facilities.value).toEqual([]);
  });

  it('calls API with correct parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 2,
        totalPages: 0,
      },
    });

    const { fetchFacilities } = useRegionFacilities();

    await fetchFacilities('seoul', 'gangnam', 'wifi', 2);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/facilities/region/seoul/gangnam/wifi',
      {
        query: { page: 2, limit: 20 },
      }
    );
  });

  it('sets loading state during fetch', async () => {
    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(promise);

    const { loading, fetchFacilities } = useRegionFacilities();

    const fetchPromise = fetchFacilities('seoul', 'gangnam', 'toilet', 1);

    // Should be loading
    expect(loading.value).toBe(true);

    // Resolve the promise
    resolvePromise!({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      },
    });

    await fetchPromise;

    // Should not be loading anymore
    expect(loading.value).toBe(false);
  });

  it('supports custom page size', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: {
        items: [],
        total: 0,
        page: 1,
        totalPages: 0,
      },
    });

    const { fetchFacilities } = useRegionFacilities();

    await fetchFacilities('seoul', 'gangnam', 'toilet', 1, 50);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/facilities/region/seoul/gangnam/toilet',
      {
        query: { page: 1, limit: 50 },
      }
    );
  });

  // SSR 지원: ref 를 건드리지 않고 데이터만 반환하는 순수 함수.
  // useAsyncData(SSR)와 클라이언트 fetchFacilities 가 공유한다.
  describe('loadRegionFacilities (순수 페치)', () => {
    it('성공 시 정규화된 응답을 반환하며 ref 를 변경하지 않는다', async () => {
      const items = [{ id: 'toilet-1', name: '강남역 공중화장실', category: 'toilet' }];
      mockFetch.mockResolvedValueOnce({
        success: true,
        data: { items, total: 1, page: 1, totalPages: 1 },
      });

      const { loadRegionFacilities, facilities, total, loading } = useRegionFacilities();
      const data = await loadRegionFacilities('seoul', 'gangnam', 'toilet', 1);

      expect(data).toEqual({ items, total: 1, page: 1, totalPages: 1 });
      // 순수 함수이므로 ref 는 초기값 유지
      expect(facilities.value).toEqual([]);
      expect(total.value).toBe(0);
      expect(loading.value).toBe(false);
    });

    it('페치 실패 시 삼키지 않고 throw 한다 (degraded 판정용)', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Internal Server Error'));

      const { loadRegionFacilities } = useRegionFacilities();

      await expect(
        loadRegionFacilities('seoul', 'gangnam', 'toilet', 1)
      ).rejects.toThrow();
    });

    it('API 가 success:false 면 null 을 반환한다 (throw 아님)', async () => {
      mockFetch.mockResolvedValueOnce({ success: false });

      const { loadRegionFacilities } = useRegionFacilities();
      const data = await loadRegionFacilities('seoul', 'gangnam', 'toilet', 1);

      expect(data).toBeNull();
    });

    it('departments 가 있으면 쿼리에 콤마결합으로 전달한다', async () => {
      mockFetch.mockResolvedValueOnce({
        success: true,
        data: { items: [], total: 0, page: 1, totalPages: 0 },
      });

      const { loadRegionFacilities } = useRegionFacilities();
      await loadRegionFacilities('seoul', 'gangnam', 'hospital', 1, 20, ['내과', '소아과']);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/facilities/region/seoul/gangnam/hospital',
        { query: { page: 1, limit: 20, departments: '내과,소아과' } }
      );
    });

    it('subway 는 stations 엔드포인트로 정규화해 반환한다', async () => {
      mockFetch.mockResolvedValueOnce({
        success: true,
        data: {
          items: [{
            id: 'g1', name: '강남', nameSlug: 'gangnam', primaryLine: '2호선',
            lines: ['2호선'], operator: null, lat: 37.5, lng: 127.0,
            address: null, roadAddress: null, city: '서울', district: '강남구',
          }],
          total: 1, page: 1, limit: 20,
        },
      });

      const { loadRegionFacilities } = useRegionFacilities();
      const data = await loadRegionFacilities('seoul', '강남구', 'subway', 1, 20);

      expect(data?.items[0].id).toBe('gangnam');
      expect(data?.items[0].category).toBe('subway');
      expect(data?.total).toBe(1);
    });
  });
});
