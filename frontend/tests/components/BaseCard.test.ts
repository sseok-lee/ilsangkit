import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseCard from '~/app/components/common/BaseCard.vue'

describe('BaseCard', () => {
  describe('Rendering', () => {
    it('should render card element', () => {
      const wrapper = mount(BaseCard)
      expect(wrapper.element.tagName).toBe('DIV')
      expect(wrapper.classes()).toContain('bg-white')
    })

    it('should render default slot content', () => {
      const wrapper = mount(BaseCard, {
        slots: {
          default: '<p>Card content</p>',
        },
      })

      expect(wrapper.html()).toContain('<p>Card content</p>')
    })
  })

  describe('Props', () => {
    it('should render title when provided', () => {
      const wrapper = mount(BaseCard, {
        props: { title: 'Card Title' },
      })

      expect(wrapper.text()).toContain('Card Title')
    })

    it('should render subtitle when provided', () => {
      const wrapper = mount(BaseCard, {
        props: { subtitle: 'Card Subtitle' },
      })

      expect(wrapper.text()).toContain('Card Subtitle')
    })

    it('should render both title and subtitle', () => {
      const wrapper = mount(BaseCard, {
        props: {
          title: 'Main Title',
          subtitle: 'Sub Title',
        },
      })

      expect(wrapper.text()).toContain('Main Title')
      expect(wrapper.text()).toContain('Sub Title')
    })
  })

  describe('Slots', () => {
    it('should render header slot', () => {
      const wrapper = mount(BaseCard, {
        slots: {
          header: '<div class="custom-header">Header Content</div>',
        },
      })

      expect(wrapper.html()).toContain('custom-header')
      expect(wrapper.text()).toContain('Header Content')
    })

    it('should render footer slot', () => {
      const wrapper = mount(BaseCard, {
        slots: {
          footer: '<div class="custom-footer">Footer Content</div>',
        },
      })

      expect(wrapper.html()).toContain('custom-footer')
      expect(wrapper.text()).toContain('Footer Content')
    })

    it('should render all slots together', () => {
      const wrapper = mount(BaseCard, {
        props: {
          title: 'Title',
        },
        slots: {
          header: '<div>Header</div>',
          default: '<div>Body</div>',
          footer: '<div>Footer</div>',
        },
      })

      const text = wrapper.text()
      expect(text).toContain('Header')
      expect(text).toContain('Title')
      expect(text).toContain('Body')
      expect(text).toContain('Footer')
    })
  })

  describe('Styling', () => {
    it('should have rounded corners', () => {
      const wrapper = mount(BaseCard)
      expect(wrapper.classes()).toContain('rounded-lg')
    })

    it('should have shadow', () => {
      const wrapper = mount(BaseCard)
      expect(wrapper.classes()).toContain('shadow-md')
    })

    it('should have padding', () => {
      const wrapper = mount(BaseCard)
      expect(wrapper.classes()).toContain('p-6')
    })
  })
})
