import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TxnTypeMiniTabs from '~/components/home/hotspot/TxnTypeMiniTabs.vue';

describe('TxnTypeMiniTabs', () => {
  it('renders 3 tabs: 매매/전세/월세', () => {
    const wrapper = mount(TxnTypeMiniTabs, { props: { modelValue: 'sale' } });
    expect(wrapper.text()).toContain('매매');
    expect(wrapper.text()).toContain('전세');
    expect(wrapper.text()).toContain('월세');
  });

  it('active tab gets distinct styling', () => {
    const wrapper = mount(TxnTypeMiniTabs, { props: { modelValue: 'jeonse' } });
    const buttons = wrapper.findAll('button');
    const jeonseBtn = buttons.find((b) => b.text().includes('전세'))!;
    expect(jeonseBtn.classes()).toContain('bg-strong');
  });

  it('clicking emits update:modelValue with new key', async () => {
    const wrapper = mount(TxnTypeMiniTabs, { props: { modelValue: 'sale' } });
    const wolseBtn = wrapper.findAll('button').find((b) => b.text().includes('월세'))!;
    await wolseBtn.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['wolse']]);
  });
});
