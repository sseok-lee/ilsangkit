import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRealEstateHotspots } from '~/composables/useRealEstateHotspots';
import type { PropertyHotspots, RealEstateHotspots } from '~/composables/useHomeDashboard';

const fetchMock = vi.fn();
vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }));

const sampleBundle = (): PropertyHotspots => ({
  sale:   { rising: [], falling: [], active: [] },
  jeonse: { rising: [], falling: [], active: [] },
  wolse:  { active: [] },
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('useRealEstateHotspots', () => {
  it('initial state seeds from SSR data', () => {
    const initial: RealEstateHotspots = { apt: sampleBundle() };
    const { data } = useRealEstateHotspots(initial);
    expect(data.value.apt).toBeDefined();
    expect(data.value.villa).toBeUndefined();
  });

  it('loadProperty fetches and caches on first call', async () => {
    fetchMock.mockResolvedValue({ success: true, data: sampleBundle() });
    const { data, loadProperty } = useRealEstateHotspots({ apt: sampleBundle() });

    await loadProperty('villa');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/meta/hotspots', { query: { propertyType: 'villa' } });
    expect(data.value.villa).toBeDefined();
  });

  it('loadProperty returns cached on second call (no fetch)', async () => {
    fetchMock.mockResolvedValue({ success: true, data: sampleBundle() });
    const { loadProperty } = useRealEstateHotspots({ apt: sampleBundle() });

    await loadProperty('villa');
    await loadProperty('villa');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
