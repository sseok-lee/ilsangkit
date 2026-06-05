// frontend/tests/components/auction/AuctionFilters.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionFilters from '~/components/auction/AuctionFilters.vue';
describe('AuctionFilters', () => {
  it('용도 변경 시 update:usage emit', async () => {
    const w = mount(AuctionFilters, { props: { usage: '', status: '', city: '', district: '' } });
    const sel = w.find('select[data-testid="usage"]');
    await sel.setValue('land');
    expect(w.emitted('update:usage')?.[0]).toEqual(['land']);
  });
});
