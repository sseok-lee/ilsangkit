import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SectionBlock from '~/components/common/SectionBlock.vue';

describe('SectionBlock', () => {
  it('renders the default heading as <h2> (document outline: page h1 → section h2)', () => {
    const wrapper = mount(SectionBlock, {
      props: { heading: '지역 선택' },
    });

    const h2 = wrapper.find('h2');
    expect(h2.exists()).toBe(true);
    expect(h2.text()).toBe('지역 선택');
    // h1→h3 점프 방지: 기본 heading은 h3가 아니어야 함
    expect(wrapper.find('h3').exists()).toBe(false);
  });

  it('does not render a heading element when no heading prop is given', () => {
    const wrapper = mount(SectionBlock);
    expect(wrapper.find('h2').exists()).toBe(false);
  });

  it('allows overriding the heading via the heading slot', () => {
    const wrapper = mount(SectionBlock, {
      props: { heading: '기본' },
      slots: { heading: '<h1>커스텀</h1>' },
    });
    expect(wrapper.find('h1').exists()).toBe(true);
    // 슬롯이 있으면 기본 h2 미출력
    expect(wrapper.find('h2').exists()).toBe(false);
  });

  it('renders subtext when provided', () => {
    const wrapper = mount(SectionBlock, {
      props: { heading: '지역', subtext: '시·도로 좁히기' },
    });
    expect(wrapper.text()).toContain('시·도로 좁히기');
  });
});
