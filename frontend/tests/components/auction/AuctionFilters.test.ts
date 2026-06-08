// frontend/tests/components/auction/AuctionFilters.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionFilters from '~/components/auction/AuctionFilters.vue';

// Stub RegionCascadingDropdown so tests don't need API calls
vi.mock('~/components/common/RegionCascadingDropdown.vue', () => ({
  default: {
    name: 'RegionCascadingDropdown',
    props: ['city', 'district', 'cityValueMode'],
    emits: ['update:city', 'update:district'],
    template: `<div>
      <select data-testid="city" :value="city" @change="$emit('update:city', $event.target.value)"><option value="">전국</option><option value="서울">서울</option><option value="부산">부산</option></select>
      <select data-testid="district" :value="district" @change="$emit('update:district', $event.target.value)"><option value="">전체</option><option value="강남구">강남구</option></select>
    </div>`,
  },
}));

describe('AuctionFilters', () => {
  it('용도 변경 시 update:usage emit', async () => {
    const w = mount(AuctionFilters, { props: { usage: '', status: '', city: '', district: '' } });
    const sel = w.find('select[data-testid="usage"]');
    await sel.setValue('land');
    expect(w.emitted('update:usage')?.[0]).toEqual(['land']);
  });

  it('상태 변경 시 update:status emit', async () => {
    const w = mount(AuctionFilters, { props: { usage: '', status: '', city: '', district: '' } });
    const sel = w.find('select[data-testid="status"]');
    await sel.setValue('ongoing');
    expect(w.emitted('update:status')?.[0]).toEqual(['ongoing']);
  });

  it('시도 변경 시 update:city + update:district 빈값 emit', async () => {
    const w = mount(AuctionFilters, { props: { usage: '', status: '', city: '', district: '' } });
    const sel = w.find('select[data-testid="city"]');
    await sel.setValue('서울');
    const cityEmits = w.emitted('update:city');
    const districtEmits = w.emitted('update:district');
    expect(cityEmits?.[0]).toEqual(['서울']);
    expect(districtEmits?.[0]).toEqual(['']);
  });

  it('구군 변경 시 update:district emit', async () => {
    const w = mount(AuctionFilters, { props: { usage: '', status: '', city: '서울', district: '' } });
    const sel = w.find('select[data-testid="district"]');
    await sel.setValue('강남구');
    expect(w.emitted('update:district')?.[0]).toEqual(['강남구']);
  });
});
