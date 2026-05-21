import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useComplexHotspots } from '~/composables/useComplexHotspots';
import type { ComplexHotspots, ComplexHotspotsByProperty } from '~/composables/useHomeDashboard';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('$fetch', fetchMock);
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }));
});

const sample: ComplexHotspots = { newHigh: [], active: [], topPyeong: [] };

describe('useComplexHotspots', () => {
  it('이미 캐시된 propertyType은 fetch 안 함', async () => {
    const initial: ComplexHotspotsByProperty = { apt: sample };
    const { loadProperty } = useComplexHotspots(initial);
    await loadProperty('apt');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('미캐시 propertyType은 /api/meta/complex-hotspots 호출', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: sample });
    const { loadProperty, data } = useComplexHotspots({});
    await loadProperty('offitel');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/meta/complex-hotspots',
      { query: { propertyType: 'offitel' } },
    );
    expect(data.value.offitel).toEqual(sample);
  });
});
