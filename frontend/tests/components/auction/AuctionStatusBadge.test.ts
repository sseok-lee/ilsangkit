// frontend/tests/components/auction/AuctionStatusBadge.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionStatusBadge from '~/components/auction/AuctionStatusBadge.vue';

describe('AuctionStatusBadge', () => {
  it('상태 라벨 렌더', () => {
    expect(mount(AuctionStatusBadge, { props: { status: 'ongoing' } }).text()).toContain('진행중');
    expect(mount(AuctionStatusBadge, { props: { status: 'sold' } }).text()).toContain('낙찰');
  });
});
