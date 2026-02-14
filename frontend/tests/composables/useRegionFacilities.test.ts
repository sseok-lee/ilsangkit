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
});
