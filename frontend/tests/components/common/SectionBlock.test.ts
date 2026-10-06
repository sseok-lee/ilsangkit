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

  it('variant 를 주지 않아도 흰색 평면형이다', () => {
    const w = mount(SectionBlock, { props: { heading: '제목', subtext: '설명' } })
    const section = w.get('section')
    expect(section.classes()).toContain('section-flat')
    expect(section.classes()).not.toContain('shadow-card')
    expect(w.get('h2').classes()).toContain('ui-h2')
  })

  it('variant="flat" 은 박스·그림자 없이 아래 구분선만 쓴다', () => {
    const w = mount(SectionBlock, { props: { heading: '기본정보', variant: 'flat' } })
    const cls = w.get('section').classes()
    expect(cls).toContain('section-flat')
    for (const c of ['bg-white', 'border', 'rounded-xl', 'shadow-card', 'p-4', 'md:p-5']) {
      expect(cls).not.toContain(c)
    }
    expect(w.get('h2').classes()).toContain('ui-h2')
  })

  it('flat 에서도 subtext·right 슬롯을 렌더한다', () => {
    const w = mount(SectionBlock, {
      props: { heading: '지역', subtext: '시·도로 좁히기', variant: 'flat' },
      slots: { right: '<a data-testid="more">전체 보기</a>' },
    })
    expect(w.text()).toContain('시·도로 좁히기')
    expect(w.find('[data-testid="more"]').exists()).toBe(true)
  })
});
