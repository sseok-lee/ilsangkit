import { describe, it, expect, vi } from 'vitest';
import { useFacilitySearch } from '~/composables/useFacilitySearch';

vi.stubGlobal('$fetch', vi.fn(async () => ({
  success: true,
  data: { categories: [], totalCount: 0, recovery: { scope: 'region', regionLabel: '서울특별시 강남구', chips: [{ label: '강남구 화장실', category: 'toilet', city: '서울특별시', district: '강남구' }] } },
})));

describe('useFacilitySearch recovery', () => {
  it('searchGrouped 후 recovery가 채워진다', async () => {
    const s = useFacilitySearch();
    await s.searchGrouped({ keyword: '강남 헬스장' } as any);
    expect(s.recovery.value?.scope).toBe('region');
    expect(s.recovery.value?.chips[0].district).toBe('강남구');
  });
});
