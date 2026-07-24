import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Breadcrumb from '~/components/navigation/Breadcrumb.vue';

describe('Breadcrumb', () => {
  it('renders breadcrumb items', () => {
    const items = [
      { label: '홈', href: '/', current: false },
      { label: '서울', href: '/seoul', current: false },
      { label: '강남구', href: '/seoul/gangnam', current: false },
      { label: '공공화장실', href: '/seoul/gangnam/toilet', current: true },
    ];

    const wrapper = mount(Breadcrumb, {
      props: { items },
    });

    expect(wrapper.text()).toContain('홈');
    expect(wrapper.text()).toContain('서울');
    expect(wrapper.text()).toContain('강남구');
    expect(wrapper.text()).toContain('공공화장실');
  });

  it('renders links for non-current items', () => {
    const items = [
      { label: '홈', href: '/', current: false },
      { label: '공공화장실', href: '/toilet', current: true },
    ];

    const wrapper = mount(Breadcrumb, {
      props: { items },
    });

    const links = wrapper.findAll('a');
    expect(links).toHaveLength(1); // Only "홈" is a link
    expect(links[0].attributes('href')).toBe('/');
  });

  it('applies aria-current to current page', () => {
    const items = [
      { label: '홈', href: '/', current: false },
      { label: '공공화장실', href: '/toilet', current: true },
    ];

    const wrapper = mount(Breadcrumb, {
      props: { items },
    });

    const currentItem = wrapper.find('[aria-current="page"]');
    expect(currentItem.exists()).toBe(true);
    expect(currentItem.text()).toContain('공공화장실');
  });

  it('renders separator between items', () => {
    const items = [
      { label: '홈', href: '/', current: false },
      { label: '서울', href: '/seoul', current: false },
      { label: '공공화장실', href: '/seoul/toilet', current: true },
    ];

    const wrapper = mount(Breadcrumb, {
      props: { items },
    });

    // Should have separators between items
    expect(wrapper.html()).toMatch(/\/|>/);
  });

  it('truncates the current (last) item to avoid mobile horizontal overflow', () => {
    const items = [
      { label: '홈', href: '/', current: false },
      { label: '경기', href: '/gyeonggi', current: false },
      { label: '군포시', href: '/gyeonggi/gunpo', current: false },
      { label: '주공(1단지) 아파트 실거래가 매우 긴 이름', href: '/x', current: true },
    ];

    const wrapper = mount(Breadcrumb, {
      props: { items },
    });

    // 현재 항목 span은 truncate로 줄임표 처리
    const current = wrapper.find('[aria-current="page"]');
    expect(current.classes()).toContain('truncate');

    // 현재 항목 li는 축소 가능(min-w-0), 나머지는 shrink-0 유지
    const lis = wrapper.findAll('li');
    const currentLi = lis[lis.length - 1];
    expect(currentLi.classes()).toContain('min-w-0');
    expect(currentLi.classes()).not.toContain('shrink-0');
    expect(lis[0].classes()).toContain('shrink-0');
  });

  it('handles single item breadcrumb', () => {
    const items = [
      { label: '홈', href: '/', current: true },
    ];

    const wrapper = mount(Breadcrumb, {
      props: { items },
    });

    expect(wrapper.text()).toContain('홈');
    expect(wrapper.find('[aria-current="page"]').exists()).toBe(true);
  });
});
